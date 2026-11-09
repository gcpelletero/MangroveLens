const { ee, initEE } = require('../../lib/earthEngine');

const ASSET_ROOT = 'projects/meta-origin-451614-s3/assets';
const ANALYSIS_CRS = 'EPSG:32650';
const ANALYSIS_SCALE = 20;
const FIRST_YEAR = 2019;
const LAST_YEAR = 2025;

const getMapAsync = (image) =>
  new Promise((resolve, reject) => {
    image.getMap(
      { min: 0, max: 1, palette: ['#FFD700'] },
      (map, error) => {
        if (error) return reject(new Error(String(error)));
        if (!map?.urlFormat) {
          return reject(new Error('Earth Engine did not return a map tile URL.'));
        }
        resolve(map.urlFormat);
      }
    );
  });

const getInfoAsync = (object) =>
  new Promise((resolve, reject) => {
    object.getInfo((result, error) => {
      if (error) return reject(new Error(String(error)));
      if (!result) return reject(new Error('Earth Engine did not return persistent NDVI statistics.'));
      resolve(result);
    });
  });

const analysisOptions = (geometry, reducer) => ({
  reducer,
  geometry,
  crs: ANALYSIS_CRS,
  scale: ANALYSIS_SCALE,
  maxPixels: 1e10,
  tileScale: 8
});

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ success: false, error: 'Only GET requests are allowed.' });
  }

  const { startYear: startText, endYear: endText } = req.query;
  if (
    typeof startText !== 'string' ||
    typeof endText !== 'string' ||
    !/^\d{4}$/.test(startText) ||
    !/^\d{4}$/.test(endText)
  ) {
    return res.status(400).json({
      success: false,
      error: 'Start Year and End Year are required.'
    });
  }

  const startYear = Number(startText);
  const endYear = Number(endText);
  if (startYear < FIRST_YEAR || endYear > LAST_YEAR || startYear > endYear) {
    return res.status(400).json({
      success: false,
      error: 'Choose a period between 2019 and 2025, with Start Year not later than End Year.'
    });
  }

  try {
    await initEE();

    // Match the Palawan study boundary and 20 m grid used for the candidate change maps.
    const palawan = ee.FeatureCollection('FAO/GAUL/2015/level2')
      .filter(ee.Filter.eq('ADM0_NAME', 'Philippines'))
      .filter(ee.Filter.eq('ADM2_NAME', 'Palawan'))
      .geometry();

    const loadCandidate = (year) =>
      ee.Image(`${ASSET_ROOT}/mvi_candidate_${year}`)
        .select(0)
        .unmask(0)
        .gt(0)
        .reproject({ crs: ANALYSIS_CRS, scale: ANALYSIS_SCALE })
        .clip(palawan);

    let persistent = loadCandidate(startYear);
    for (let year = startYear + 1; year <= endYear; year++) {
      persistent = persistent.and(loadCandidate(year));
    }
    persistent = persistent.selfMask();

    // A yellow outline preserves the end-year NDVI colors underneath.
    const interior = persistent.focal_min({ radius: 1, units: 'pixels' });
    const outline = persistent.and(interior.not()).selfMask();

    // All chart years share this exact selected-period candidate footprint.
    const ndviBands = [];
    for (let year = startYear; year <= endYear; year++) {
      ndviBands.push(
        ee.Image(`${ASSET_ROOT}/ndvi_mangrove_candidate_${year}`)
          .select('NDVI')
          .updateMask(persistent)
          .rename(`ndvi_${year}`)
      );
    }

    const means = ee.Image.cat(ndviBands).reduceRegion(
      analysisOptions(palawan, ee.Reducer.mean())
    );

    const areaSquareMeters = ee.Image.pixelArea()
      .rename('area_m2')
      .updateMask(persistent)
      .reduceRegion(analysisOptions(palawan, ee.Reducer.sum()))
      .get('area_m2');

    const statistics = ee.Dictionary({
      areaHa: ee.Number(ee.Algorithms.If(areaSquareMeters, areaSquareMeters, 0)).divide(10000),
      means
    });

    const [mapUrl, result] = await Promise.all([
      getMapAsync(outline),
      getInfoAsync(statistics)
    ]);

    const ndviMeans = [];
    for (let year = startYear; year <= endYear; year++) {
      const value = result.means?.[`ndvi_${year}`];
      ndviMeans.push({
        year,
        meanNdvi: typeof value === 'number' && Number.isFinite(value) ? value : null
      });
    }

    return res.status(200).json({
      success: true,
      mapUrl,
      ndviMeans,
      metadata: {
        layer: 'Persistent MVI-derived mangrove candidate outline',
        startYear,
        endYear,
        period: `${startYear}–${endYear}`,
        candidateAreaHa: typeof result.areaHa === 'number' ? result.areaHa : null,
        color: '#FFD700',
        analysisCrs: ANALYSIS_CRS,
        analysisScaleMeters: ANALYSIS_SCALE,
        annualAssets: 'Precomputed MVI candidate and NDVI images',
        interpretation:
          'An intersection of all annual MVI candidate masks within the selected period. The NDVI statistics use this same fixed selected-period footprint. Neither the outline nor the NDVI means independently confirm mangrove condition or degradation.'
      }
    });
  } catch (error) {
    console.error('Selected-period persistent MVI analysis error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Unable to calculate the selected-period persistent candidate layer.'
    });
  }
}
