
const { ee, initEE } = require('../../lib/earthEngine');

const ASSET_ROOT = 'projects/meta-origin-451614-s3/assets';

const MVI_ROOT = `${ASSET_ROOT}/mvi_candidate_`;
const NDVI_ROOT = `${ASSET_ROOT}/ndvi_mangrove_candidate_`;

// Convert Earth Engine results into a Promise.
const getInfoAsync = (object) =>
  new Promise((resolve, reject) => {
    object.getInfo((result, error) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }

      if (!result) {
        reject(new Error('No statistics returned from Earth Engine.'));
        return;
      }

      resolve(result);
    });
  });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Only GET requests are allowed.'
    });
  }

  // Get the selected observation period.
  const startParam = req.query.startYear;
  const endParam = req.query.endYear;

  if (
    typeof startParam !== 'string' ||
    typeof endParam !== 'string' ||
    !/^\d{4}$/.test(startParam) ||
    !/^\d{4}$/.test(endParam)
  ) {
    return res.status(400).json({
      success: false,
      error: 'Start Year and End Year are required.'
    });
  }

  const startYear = Number(startParam);
  const endYear = Number(endParam);

  if (
    startYear < 2019 ||
    endYear > 2025 ||
    startYear > endYear
  ) {
    return res.status(400).json({
      success: false,
      error: 'Select a valid period from 2019 to 2025.'
    });
  }


    // Check for precomputed NDVI statistics first.
    const {
        getPrecomputedPersistentNdviStats
    } = require('../../lib/precomputedPersistentNdviStats');

    const precomputedResult =
        getPrecomputedPersistentNdviStats(startYear, endYear);

    // Return precomputed results immediately when available.
    if (precomputedResult) {
        return res.status(200).json(precomputedResult);
    }

    // Fall back to Google Earth Engine if needed.
    try {
        await initEE();


    // STEP 1: Calculate the persistent candidate mask.
    const first = ee.Image(MVI_ROOT + startYear)
      .select(0)
      .unmask(0)
      .gt(0);

    let persistent = first;

    for (let year = startYear + 1; year <= endYear; year++) {
      const candidate = ee.Image(MVI_ROOT + year)
        .select(0)
        .unmask(0)
        .gt(0);

      persistent = persistent.and(candidate);
    }

    const region = ee.Image(MVI_ROOT + startYear).geometry();

    // STEP 2: Keep pixels with valid NDVI in every
    // selected year, matching our verified GEE script.
    let validAllYears = persistent;

    for (let year = startYear; year <= endYear; year++) {
      const annualNdvi = ee.Image(NDVI_ROOT + year)
        .select('NDVI');

      const validPixels = annualNdvi.mask()
        .unmask(0)
        .gt(0);

      validAllYears = validAllYears.and(validPixels);
    }

    // STEP 3: Build annual NDVI bands using exactly
    // the same valid persistent candidate footprint.
    let ndviStack = null;

    for (let year = startYear; year <= endYear; year++) {
      const annualNdvi = ee.Image(NDVI_ROOT + year)
        .select('NDVI')
        .updateMask(validAllYears)
        .rename(`NDVI_${year}`);

      ndviStack = ndviStack
        ? ndviStack.addBands(annualNdvi)
        : annualNdvi;
    }

    const options = {
      geometry: region,
      crs: 'EPSG:32650',
      scale: 20,
      maxPixels: 1e13,
      tileScale: 4
    };

    // STEP 4: Calculate the mean NDVI for each year.
    const meanResults = ndviStack.reduceRegion({
      reducer: ee.Reducer.mean(),
      ...options
    });

    // STEP 5: Calculate persistent candidate area.
    const persistentArea = ee.Image.pixelArea()
      .divide(10000)
      .updateMask(persistent)
      .reduceRegion({
        reducer: ee.Reducer.sum(),
        ...options
      })
      .get('area');

    // Calculate the area with valid NDVI in every year.
    const validNdviArea = ee.Image.pixelArea()
      .divide(10000)
      .updateMask(validAllYears)
      .reduceRegion({
        reducer: ee.Reducer.sum(),
        ...options
      })
      .get('area');

    // STEP 6: Retrieve statistics from Earth Engine.
    const results = await getInfoAsync(
      ee.Dictionary({
        means: meanResults,
        persistentAreaHa: persistentArea,
        validNdviAreaHa: validNdviArea
      })
    );

    // STEP 7: Format annual values for the graph.
    const ndviMeans = [];

    for (let year = startYear; year <= endYear; year++) {
      const value = results.means?.[`NDVI_${year}`];

      ndviMeans.push({
        year,
        meanNdvi:
          typeof value === 'number' && Number.isFinite(value)
            ? value
            : null
      });
    }

    return res.status(200).json({
      success: true,
      startYear,
      endYear,
      period: `${startYear}–${endYear}`,
      persistentAreaHa: results.persistentAreaHa ?? null,
      validNdviAreaHa: results.validNdviAreaHa ?? null,
      ndviMeans,
      interpretation:
        'Mean NDVI within locations classified as mangrove candidates in every selected year, with valid NDVI across the period. Values describe vegetation greenness, not confirmed degradation or recovery.'
    });

  } catch (error) {
    console.error('Persistent NDVI statistics error:', error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        'Unable to calculate persistent NDVI statistics.'
    });
  }
}
