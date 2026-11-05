const { ee, initEE } = require('../../lib/earthEngine');

const NDVI_PALETTE = [
  '#FFFFFF',
  '#f7fcf5',
  '#e5f5e0',
  '#c7e9c0',
  '#a1d99b',
  '#74c476',
  '#41ab5d',
  '#238b45',
  '#006d2c',
  '#00441b'
];

const evaluateAsync = (earthEngineObject) =>
  new Promise((resolve, reject) => {
    earthEngineObject.evaluate((value, error) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }

      resolve(value);
    });
  });

const getMapAsync = (image, visParams) =>
  new Promise((resolve, reject) => {
    image.getMap(visParams, (map, error) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }

      if (!map || !map.urlFormat) {
        reject(
          new Error(
            'Earth Engine did not return a map tile URL.'
          )
        );
        return;
      }

      resolve(map);
    });
  });

/**
 * Remove invalid, cloudy, shadowed, cirrus, and snow pixels.
 *
 * Sentinel-2 SCL classes removed:
 * 0  = No data
 * 1  = Saturated or defective
 * 3  = Cloud shadow
 * 8  = Medium-probability cloud
 * 9  = High-probability cloud
 * 10 = Cirrus
 * 11 = Snow or ice
 */
const maskSentinel2Clouds = (image) => {
  const scl = image.select('SCL');

  const clearMask = scl
    .neq(0)
    .and(scl.neq(1))
    .and(scl.neq(3))
    .and(scl.neq(8))
    .and(scl.neq(9))
    .and(scl.neq(10))
    .and(scl.neq(11));

  return image
    .updateMask(clearMask)
    .copyProperties(image, ['system:time_start']);
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);

    return res.status(405).json({
      success: false,
      error: 'Only GET requests are allowed.'
    });
  }

  try {
    await initEE();

    const year = Number(req.query.year);

    if (!Number.isInteger(year)) {
      return res.status(400).json({
        success: false,
        error: 'A valid year is required.'
      });
    }

    if (year < 2019 || year > 2026) {
      return res.status(400).json({
        success: false,
        error: 'Year must currently be between 2019 and 2026.'
      });
    }

    const startDate = `${year}-01-01`;
    const endDate = `${year + 1}-01-01`;

    /*
     * Step 1: Obtain the Palawan administrative boundary.
     */
    const palawan = ee
      .FeatureCollection('FAO/GAUL/2015/level2')
      .filter(
        ee.Filter.eq('ADM0_NAME', 'Philippines')
      )
      .filter(
        ee.Filter.eq('ADM2_NAME', 'Palawan')
      );

    const palawanCount = await evaluateAsync(
      palawan.size()
    );

    if (palawanCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Palawan boundary was not found.'
      });
    }

    const palawanGeometry = palawan.geometry();

    /*
     * Step 2: Load Sentinel-2 Surface Reflectance images.
     */
    const sentinelCollection = ee
      .ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(palawanGeometry)
      .filterDate(startDate, endDate)
      .filter(
        ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)
      )
      .map(maskSentinel2Clouds);

    const imageCount = await evaluateAsync(
      sentinelCollection.size()
    );

    if (imageCount === 0) {
      return res.status(404).json({
        success: false,
        error: `No Sentinel-2 images were found for ${year}.`
      });
    }

    /*
     * Step 3: Calculate NDVI for every Sentinel-2 image.
     *
     * B8 = Near-infrared
     * B4 = Red
     */
    const ndviCollection = sentinelCollection.map(
      (image) =>
        image
          .normalizedDifference(['B8', 'B4'])
          .rename('NDVI')
          .copyProperties(image, [
            'system:time_start'
          ])
    );

    /*
     * Step 4: Combine the year's images using median.
     */
    let annualNdvi = ndviCollection
      .median()
      .clip(palawanGeometry);

    /*
     * Step 5: Limit the display to the mangrove baseline.
     */
    const mangroveMask = ee
      .ImageCollection('LANDSAT/MANGROVE_FORESTS')
      .mosaic()
      .gt(0)
      .clip(palawanGeometry);

    annualNdvi = annualNdvi.updateMask(
      mangroveMask
    );

    /*
     * Step 6: Apply the palette inside Earth Engine.
     *
     * This is the same visualization method used
     * by your professor: min + max + palette.
     */
    const visParams = {
      min: 0,
      max: 0.8,
      palette: NDVI_PALETTE
    };

    /*
     * Step 7: Ask Earth Engine for a colored map URL.
     */
    const map = await getMapAsync(
      annualNdvi,
      visParams
    );

    return res.status(200).json({
      success: true,
      mapUrl: map.urlFormat,
      metadata: {
        year,
        startDate,
        endDate,
        area: 'Palawan',
        dataset: 'COPERNICUS/S2_SR_HARMONIZED',
        imageCount,
        composite: 'Annual median',
        visualization: visParams,
        interpretation: {
          bareOrVeryLowVegetation: '0.0â€“0.1',
          sparseVegetation: '0.1â€“0.3',
          moderateVegetation: '0.3â€“0.5',
          denseVegetation: '0.5â€“0.8',
          veryDenseVegetation: '> 0.8'
        }
      }
    });
  } catch (error) {
    console.error('NDVI API error:', error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        'Unable to generate the NDVI map.'
    });
  }
}
