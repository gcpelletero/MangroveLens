const { ee, initEE } = require('../../lib/earthEngine');

const MVI_PALETTE = [
  '#313695',
  '#4575b4',
  '#74add1',
  '#abd9e9',
  '#e0f3f8',
  '#ffffbf',
  '#fee090',
  '#fdae61',
  '#f46d43',
  '#d73027'
];

const CANDIDATE_THRESHOLDS = [
  3.0,
  3.5,
  4.0,
  4.5,
  5.0
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
            'Earth Engine did not return an MVI map tile URL.'
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
    .copyProperties(image, [
      'system:time_start'
    ]);
};

const getMviReferenceStats = (
  mviImage,
  referenceMask,
  geometry
) => {
  /*
   * The number of reference pixels is about 135,000.
   * maxRaw is set above that number so Earth Engine
   * can calculate the percentiles directly rather
   * than relying on a coarse approximate histogram.
   */
  const percentileReducer =
    ee.Reducer.percentile(
      [5, 10, 25, 50, 75, 90, 95],
      [
        'p5',
        'p10',
        'p25',
        'p50',
        'p75',
        'p90',
        'p95'
      ],
      2048,
      0.01,
      200000
    );

  const statisticsReducer = percentileReducer
    .combine({
      reducer2: ee.Reducer.minMax(),
      sharedInputs: true
    })
    .combine({
      reducer2: ee.Reducer.mean(),
      sharedInputs: true
    })
    .combine({
      reducer2: ee.Reducer.stdDev(),
      sharedInputs: true
    })
    .combine({
      reducer2: ee.Reducer.count(),
      sharedInputs: true
    });

  return mviImage
    .updateMask(referenceMask)
    .reduceRegion({
      reducer: statisticsReducer,
      geometry,
      scale: 60,
      bestEffort: true,
      maxPixels: 1e9,
      tileScale: 4
    });
};

/**
 * Screen several possible MVI thresholds.
 *
 * For each threshold, calculate:
 * 1. Candidate mangrove area across Palawan
 * 2. Amount of the CGMD 2023 reference retained
 *
 * These are screening results only—not final accuracy values.
 */
const getCandidateThresholdSummary = async (
  mviImage,
  referenceMask,
  geometry
) => {
  /*
   * Convert the recent reference into an explicit
   * 1 = mangrove, 0 = outside reference format.
   */
  const reference = referenceMask
    .unmask(0)
    .eq(1);

  /*
   * Use a coarser scale only for lightweight
   * threshold screening.
   *
   * Final maps can still use finer resolution.
   */
  const screeningScale = 90;

  /*
   * Calculate total CGMD 2023 reference area once.
   */
  const referenceAreaResult =
    await evaluateAsync(
      ee.Image.pixelArea()
        .updateMask(reference)
        .rename('referenceArea')
        .reduceRegion({
          reducer: ee.Reducer.sum(),
          geometry,
          scale: screeningScale,
          bestEffort: true,
          maxPixels: 1e9,
          tileScale: 4
        })
    );

  const referenceAreaM2 = Number(
    referenceAreaResult?.referenceArea || 0
  );

  const results = [];

  /*
   * Test one threshold at a time.
   */
  for (const threshold of CANDIDATE_THRESHOLDS) {
    console.log(
      `Testing candidate MVI threshold ${threshold}...`
    );

    /*
     * Pixels equal to or above the threshold become
     * candidate mangrove pixels.
     */
    const candidateMask = mviImage
      .gte(threshold);

    /*
     * Candidate area:
     * all Palawan pixels passing the threshold.
     *
     * Retained reference area:
     * CGMD 2023 pixels also passing the threshold.
     */
    const areaImage = ee.Image.cat([
      ee.Image.pixelArea()
        .updateMask(candidateMask)
        .rename('candidateArea'),

      ee.Image.pixelArea()
        .updateMask(
          candidateMask.and(reference)
        )
        .rename('retainedReferenceArea')
    ]);

    const areaResult = await evaluateAsync(
      areaImage.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry,
        scale: screeningScale,
        bestEffort: true,
        maxPixels: 1e9,
        tileScale: 4
      })
    );

    const candidateAreaM2 = Number(
      areaResult?.candidateArea || 0
    );

    const retainedReferenceAreaM2 = Number(
      areaResult?.retainedReferenceArea || 0
    );

    const referenceRetentionPercent =
      referenceAreaM2 > 0
        ? (
            retainedReferenceAreaM2 /
            referenceAreaM2
          ) * 100
        : 0;

    const areaRatioToReference =
      referenceAreaM2 > 0
        ? candidateAreaM2 / referenceAreaM2
        : null;

    results.push({
      threshold,

      candidateAreaKm2:
        candidateAreaM2 / 1e6,

      retainedReferenceAreaKm2:
        retainedReferenceAreaM2 / 1e6,

      referenceRetentionPercent,

      areaRatioToReference
    });
  }

  return {
    screeningScaleMeters: screeningScale,
    referenceAreaKm2:
      referenceAreaM2 / 1e6,
    candidateThresholds: results
  };
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

    console.log(`Starting raw MVI preview for ${year}...`);

    /*
     * Step 1: Obtain the Palawan boundary.
     */
    const palawan = ee
      .FeatureCollection(
        'FAO/GAUL/2015/level2'
      )
      .filter(
        ee.Filter.eq(
          'ADM0_NAME',
          'Philippines'
        )
      )
      .filter(
        ee.Filter.eq(
          'ADM2_NAME',
          'Palawan'
        )
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
     * Step 2: Load clear Sentinel-2 images.
     */
    const sentinelCollection = ee
      .ImageCollection(
        'COPERNICUS/S2_SR_HARMONIZED'
      )
      .filterBounds(palawanGeometry)
      .filterDate(startDate, endDate)
      .filter(
        ee.Filter.lt(
          'CLOUDY_PIXEL_PERCENTAGE',
          20
        )
      )
      .map(maskSentinel2Clouds)
      .select([
        'B3',
        'B8',
        'B11'
      ]);

    const imageCount = await evaluateAsync(
      sentinelCollection.size()
    );

    console.log(
      `Sentinel-2 images found for ${year}:`,
      imageCount
    );

    if (imageCount === 0) {
      return res.status(404).json({
        success: false,
        error:
          `No usable Sentinel-2 images were found for ${year}.`
      });
    }

    /*
     * Step 3: Combine all usable images from the
     * selected year into one annual median image.
     *
     * Sentinel-2 SR values are divided by 10,000
     * to convert them into surface reflectance.
     */
    const annualComposite = sentinelCollection
      .median()
      .divide(10000);

    /*
     * Step 4: Calculate raw MVI.
     *
     * B3  = Green
     * B8  = Near-infrared
     * B11 = Shortwave infrared 1
     *
     * MVI =
     * |B8 - B3| / |B11 - B3|
     */
    const green = annualComposite.select('B3');
    const nir = annualComposite.select('B8');
    const swir1 = annualComposite.select('B11');

    /*
    * Published Sentinel-2 MVI formula:
    *
    * MVI = (B8 - B3) / (B11 - B3)
    *
    * Preserve the signs of the numerator and denominator.
    */
    const numerator = nir.subtract(green);

    const denominator = swir1.subtract(green);

    /*
    * Only use the absolute denominator here to check
    * whether it is too close to zero. This prevents
    * unstable division while preserving its original sign.
    */
    const validDenominator = denominator
    .abs()
    .gt(0.0001);

    const rawMvi = numerator
      .divide(denominator)
      .updateMask(validDenominator)
      .rename('MVI')
      .clip(palawanGeometry);

    /*
    * Temporarily remove extreme numerical outliers
    * while retaining both negative and positive MVI.
    *
    * This is only for inspecting the distribution.
    * It is not a mangrove-classification threshold.
    */
    const mviForStatistics = rawMvi.updateMask(
    rawMvi
        .gte(-20)
        .and(rawMvi.lte(20))
    );

    /*
    * Step 4.1: Load the year-2000 mangrove layer only
    * as a historical reference for inspecting MVI values.
    *
    * This layer is NOT applied as the final MVI mask.
    */
    const historicalMangroveReference = ee
    .ImageCollection('LANDSAT/MANGROVE_FORESTS')
    .mosaic()
    .gt(0)
    .clip(palawanGeometry);

    /*
    * Inspect the distribution of 2024 raw MVI values
    * inside historically mapped mangrove areas.
    */
    const historicalReferenceStats =
    await evaluateAsync(
        getMviReferenceStats(
        mviForStatistics,
        historicalMangroveReference,
        palawanGeometry
        )
    );

    console.log(
    'Raw MVI statistics inside historical mangrove reference:',
    historicalReferenceStats
    );

    /*
    * Step 4.2: Load the latest available CGMD
    * annual mangrove extent as a recent reference.
    *
    * CGMD currently provides annual extent through 2023.
    * It is used here only for threshold inspection.
    */
    const cgmdExtentCollection = ee
    .FeatureCollection(
        'projects/mangrovedatahub2/assets/CGMD-Extent30'
    )
    .filter(
        ee.Filter.eq('year', 2023)
    )
    .filterBounds(palawanGeometry);

    const cgmdFeatureCount = await evaluateAsync(
    cgmdExtentCollection.size()
    );

    if (cgmdFeatureCount === 0) {
    throw new Error(
        'No CGMD 2023 mangrove features were found for Palawan.'
    );
    }

    /*
    * Convert the CGMD polygons into a raster mask:
    * 1 = mapped mangrove
    * masked = outside mapped mangrove extent
    */
    const cgmd2023Reference = ee
    .Image(0)
    .byte()
    .paint(cgmdExtentCollection, 1)
    .selfMask()
    .clip(palawanGeometry);

    /*
    * Inspect the 2024 MVI values inside areas mapped
    * as mangrove by CGMD in 2023.
    */
    const cgmd2023ReferenceStats =
    await evaluateAsync(
        getMviReferenceStats(
        mviForStatistics,
        cgmd2023Reference,
        palawanGeometry
        )
    );

    console.log(
    'Raw MVI statistics inside CGMD 2023 reference:',
    cgmd2023ReferenceStats
    );

    /*
    * Step 4.3: Screen several possible MVI thresholds
    * using CGMD 2023 as a recent reference.
    *
    * Use mviForStatistics so unstable values outside
    * -20 to 20 do not influence the candidate masks.
    */
    const thresholdSummary =
    await getCandidateThresholdSummary(
        mviForStatistics,
        cgmd2023Reference,
        palawanGeometry
    );

    console.log(
    'Candidate MVI threshold summary:',
    thresholdSummary
    );

    /*
     * Step 5: Temporary raw-MVI visualization.
     *
     * This is not yet a mangrove classification.
     * Values above the display maximum are simply
     * shown using the final palette color.
     */
    const visParams = {
    min: -2,
    max: 10,
    palette: MVI_PALETTE
    };

    /*
     * Step 6: Request the web-tile URL.
     */
    const map = await getMapAsync(
      rawMvi,
      visParams
    );

    console.log(
      `Raw MVI preview completed for ${year}.`
    );

    return res.status(200).json({
      success: true,
      mapUrl: map.urlFormat,
      metadata: {
        product: 'Raw MVI preview',
        year,
        startDate,
        endDate,
        area: 'Palawan',
        dataset:
          'COPERNICUS/S2_SR_HARMONIZED',
        imageCount,
        composite: 'Annual median reflectance',
        formula:
        '(B8 - B3) / (B11 - B3)',
        referenceInspection: {
        dataset: 'LANDSAT/MANGROVE_FORESTS',
        referenceYear: 2000,
        role:
            'Historical reference for threshold inspection only',
        usedAsFinalMask: false,
        statisticsScaleMeters: 60,
        mviStatistics: historicalReferenceStats
        },
        recentReference: {
            dataset:
            'projects/mangrovedatahub2/assets/CGMD-Extent30',
            referenceYear: 2023,
            role:
            'Recent mapped mangrove reference for threshold inspection only',
            usedAsFinalMask: false,
            featureCount: cgmdFeatureCount,
            mviStatistics: cgmd2023ReferenceStats
        },
        statisticsValueRange: {
        minimum: -20,
        maximum: 20,
        purpose:
            'Temporary removal of unstable numerical outliers during threshold inspection'
        },
        thresholdInspection: {
            status:
            'Candidate threshold screening only',
            referenceDataset:
            'projects/mangrovedatahub2/assets/CGMD-Extent30',
            referenceYear: 2023,
            finalThresholdSelected: false,
            explanation:
            'Candidate thresholds are compared using reference retention and total candidate area.',
            results: thresholdSummary
        },
        bands: {
          green: 'B3',
          nearInfrared: 'B8',
          shortwaveInfrared1: 'B11'
        },
        visualization: visParams,
        classificationApplied: false,
        note:
          'This raw MVI preview is not yet a final mangrove extent classification.'
      }
    });
  } catch (error) {
    console.error('MVI API error:', error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        'Unable to generate the raw MVI preview.'
    });
  }
}