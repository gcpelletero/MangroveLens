const {
  ee,
  initEE
} = require('../../lib/earthEngine');

/*
 * Fixed prototype parameters selected during
 * the previous reference-screening stage.
 */
const ANALYSIS_CRS = 'EPSG:32650';
const ANALYSIS_SCALE_METERS = 20;

const MVI_THRESHOLD = 3.5;
const MIN_PATCH_PIXELS = 5;
const MAX_CONNECTED_PIXELS = 100;

const MAX_WATER_DISTANCE_METERS = 1000;
const MIN_WATER_OCCURRENCE_PERCENT = 10;

/*
 * Convert an Earth Engine evaluate callback
 * into an awaitable Promise.
 */
const evaluateAsync = (earthEngineObject) =>
  new Promise((resolve, reject) => {
    earthEngineObject.evaluate(
      (value, error) => {
        if (error) {
          reject(
            new Error(String(error))
          );
          return;
        }

        resolve(value);
      }
    );
  });

/*
 * Request an Earth Engine map tile URL.
 */
const getMapAsync = (
  image,
  visParams = {}
) =>
  new Promise((resolve, reject) => {
    image.getMap(
      visParams,
      (map, error) => {
        if (error) {
          reject(
            new Error(String(error))
          );
          return;
        }

        if (!map?.urlFormat) {
          reject(
            new Error(
              'Earth Engine did not return a change-map URL.'
            )
          );
          return;
        }

        resolve(map);
      }
    );
  });

/*
 * Remove cloudy and invalid Sentinel-2 pixels
 * using the Scene Classification Layer.
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
    .copyProperties(
      image,
      ['system:time_start']
    );
};

/*
 * Prepare the Sentinel-2 bands required
 * for the MVI calculation.
 */
const prepareSentinel2ForMvi = (image) => {
  const green = image
    .select('B3')
    .resample('bilinear');

  const nir = image
    .select('B8')
    .resample('bilinear');

  const swir1 = image
    .select('B11')
    .resample('bilinear');

  return green
    .addBands(nir)
    .addBands(swir1)
    .copyProperties(
      image,
      ['system:time_start']
    );
};

/*
 * Create the candidate mangrove extent
 * for one selected year.
 */
const buildAnnualCandidate = async ({
  year,
  palawanGeometry,
  analysisProjection,
  nearWaterMask
}) => {
  const startDate = `${year}-01-01`;
  const endDate = `${year + 1}-01-01`;

  console.log(
    `Building annual candidate extent for ${year}...`
  );

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
    .map(prepareSentinel2ForMvi);

  const imageCount = await evaluateAsync(
    sentinelCollection.size()
  );

  if (imageCount === 0) {
    throw new Error(
      `No usable Sentinel-2 images were found for ${year}.`
    );
  }

  const annualComposite = sentinelCollection
    .median()
    .divide(10000)
    .setDefaultProjection(
      analysisProjection,
      null,
      ANALYSIS_SCALE_METERS
    );

  const green = annualComposite.select('B3');
  const nir = annualComposite.select('B8');
  const swir1 = annualComposite.select('B11');

  const numerator = nir.subtract(green);
  const denominator = swir1.subtract(green);

  const validDenominator = denominator
    .abs()
    .gt(0.0001);

  const rawMvi = numerator
    .divide(denominator)
    .updateMask(validDenominator)
    .rename('MVI')
    .setDefaultProjection(
      analysisProjection,
      null,
      ANALYSIS_SCALE_METERS
    )
    .clip(palawanGeometry);

  /*
   * Remove only extreme numerical values.
   */
  const stableMvi = rawMvi.updateMask(
    rawMvi
      .gte(-20)
      .and(rawMvi.lte(20))
  );

  /*
   * Apply the selected MVI threshold.
   */
  const rawCandidateExtent = stableMvi
    .gte(MVI_THRESHOLD)
    .selfMask()
    .rename('candidate_mangrove')
    .setDefaultProjection(
      analysisProjection,
      null,
      ANALYSIS_SCALE_METERS
    );

  /*
   * Remove connected patches smaller
   * than five 20-meter pixels.
   */
  const connectedPixelCount =
    rawCandidateExtent.connectedPixelCount(
      MAX_CONNECTED_PIXELS,
      true
    );

  const patchCleanedCandidate =
    rawCandidateExtent
      .updateMask(
        connectedPixelCount.gte(
          MIN_PATCH_PIXELS
        )
      )
      .selfMask()
      .rename('candidate_mangrove')
      .setDefaultProjection(
        analysisProjection,
        null,
        ANALYSIS_SCALE_METERS
      );

  /*
   * Apply the selected 1,000-meter
   * water-proximity constraint.
   */
  const finalCandidate =
    patchCleanedCandidate
      .updateMask(nearWaterMask)
      .selfMask()
      .rename('candidate_mangrove')
      .setDefaultProjection(
        analysisProjection,
        null,
        ANALYSIS_SCALE_METERS
      )
      .clip(palawanGeometry);

  console.log(
    `Annual candidate extent completed for ${year}.`
  );

  return {
    candidate:
      finalCandidate,

    imageCount,

    startDate,

    endDate
  };
};

export default async function handler(
  req,
  res
) {
  if (req.method !== 'GET') {
    res.setHeader(
      'Allow',
      ['GET']
    );

    return res.status(405).json({
      success: false,
      error:
        'Only GET requests are allowed.'
    });
  }

  try {
    await initEE();

    const historicalYear = Number(
      req.query.historicalYear
    );

    const currentYear = Number(
      req.query.currentYear
    );

    if (
      !Number.isInteger(historicalYear) ||
      !Number.isInteger(currentYear)
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Valid historicalYear and currentYear values are required.'
      });
    }

    if (
      historicalYear < 2019 ||
      historicalYear > 2026 ||
      currentYear < 2019 ||
      currentYear > 2026
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Years must currently be between 2019 and 2026.'
      });
    }

    if (
      historicalYear >= currentYear
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Historical year must be earlier than current year.'
      });
    }

    console.log(
      `Creating mangrove candidate change map for ${historicalYear}-${currentYear}...`
    );

    /*
     * Palawan study boundary.
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

    const palawanCount =
      await evaluateAsync(
        palawan.size()
      );

    if (palawanCount === 0) {
      return res.status(404).json({
        success: false,
        error:
          'Palawan boundary was not found.'
      });
    }

    const palawanGeometry =
      palawan.geometry();

    const analysisProjection =
      ee.Projection(
        ANALYSIS_CRS
      );

    /*
     * Build one common water-proximity mask
     * used by both years.
     */
    const waterSearchGeometry =
      palawanGeometry.buffer(
        MAX_WATER_DISTANCE_METERS + 1000
      );

    const waterReference = ee
      .Image(
        'JRC/GSW1_4/GlobalSurfaceWater'
      )
      .select('occurrence')
      .unmask(0)
      .gte(
        MIN_WATER_OCCURRENCE_PERCENT
      )
      .rename('water_reference')
      .clip(waterSearchGeometry);

    const waterDistance =
      waterReference
        .distance(
          ee.Kernel.euclidean(
            MAX_WATER_DISTANCE_METERS,
            'meters'
          ),
          false
        )
        .rename(
          'distance_to_water_meters'
        );

    const nearWaterMask =
      waterDistance
        .lte(
          MAX_WATER_DISTANCE_METERS
        )
        .unmask(0)
        .rename('near_water');

    /*
     * Generate the two annual candidate masks.
     */
    const historicalResult =
      await buildAnnualCandidate({
        year:
          historicalYear,

        palawanGeometry,

        analysisProjection,

        nearWaterMask
      });

    const currentResult =
      await buildAnnualCandidate({
        year:
          currentYear,

        palawanGeometry,

        analysisProjection,

        nearWaterMask
      });

    /*
     * Convert both masked candidate images
     * into explicit binary 0-or-1 images.
     */
    const historicalBinary =
      historicalResult.candidate
        .unmask(0)
        .gt(0);

    const currentBinary =
      currentResult.candidate
        .unmask(0)
        .gt(0);

    /*
     * Persistent:
     * candidate in both years.
     */
    const persistentMask =
      historicalBinary
        .and(currentBinary)
        .selfMask()
        .rename('persistent_candidate')
        .setDefaultProjection(
          analysisProjection,
          null,
          ANALYSIS_SCALE_METERS
        );

    /*
     * Candidate loss:
     * candidate in the historical year,
     * but not in the current year.
     */
    const lossMask =
      historicalBinary
        .and(currentBinary.not())
        .selfMask()
        .rename('candidate_loss')
        .setDefaultProjection(
          analysisProjection,
          null,
          ANALYSIS_SCALE_METERS
        );

    /*
     * Candidate gain:
     * not candidate in the historical year,
     * but candidate in the current year.
     */
    const gainMask =
      historicalBinary
        .not()
        .and(currentBinary)
        .selfMask()
        .rename('candidate_gain')
        .setDefaultProjection(
          analysisProjection,
          null,
          ANALYSIS_SCALE_METERS
        );

    /*
     * Create separate visual layers.
     */
    const persistentVisual =
      persistentMask.visualize({
        palette: ['00C853'],
        opacity: 0.8
      });

    const lossVisual =
      lossMask.visualize({
        palette: ['FF1744'],
        opacity: 0.9
      });

    const gainVisual =
      gainMask.visualize({
        palette: ['2979FF'],
        opacity: 0.9
      });

    /*
     * Combine the mutually exclusive
     * change classes.
     */
    const changeMap =
      persistentVisual
        .blend(lossVisual)
        .blend(gainVisual)
        .clip(palawanGeometry);

    const map = await getMapAsync(
      changeMap,
      {}
    );

    console.log(
      `Mangrove candidate change map completed for ${historicalYear}-${currentYear}.`
    );

    return res.status(200).json({
      success: true,

      mapUrl:
        map.urlFormat,

      metadata: {
        product:
          'MVI-derived mangrove candidate extent change',

        changeStatus:
          'Provisional candidate extent change; not confirmed land-cover conversion',

        area:
          'Palawan',

        historicalYear,

        currentYear,

        comparisonPeriod:
          `${historicalYear}-${currentYear}`,

        historicalImageCount:
          historicalResult.imageCount,

        currentImageCount:
          currentResult.imageCount,

        dataset:
          'COPERNICUS/S2_SR_HARMONIZED',

        composite:
          'Annual median reflectance for each year',

        formula:
          '(B8 - B3) / (B11 - B3)',

        analysisGrid: {
          crs:
            ANALYSIS_CRS,

          scaleMeters:
            ANALYSIS_SCALE_METERS
        },

        candidateRule:
          `MVI >= ${MVI_THRESHOLD}, connected patch >= ${MIN_PATCH_PIXELS} pixels, and distance to mapped water <= ${MAX_WATER_DISTANCE_METERS} meters`,

        changeClasses: {
          persistent:
            'Candidate mangrove extent in both selected years',

          loss:
            `Candidate mangrove extent in ${historicalYear}, but not in ${currentYear}`,

          gain:
            `Not candidate mangrove extent in ${historicalYear}, but candidate in ${currentYear}`
        },

        colors: {
          persistentCandidate:
            '#00C853',

          candidateLoss:
            '#FF1744',

          candidateGain:
            '#2979FF'
        },

        areaStatisticsIncluded:
          false,

        fieldValidated:
          false,

        limitation:
          'Detected differences may include classification variability, image-composite differences, disturbance, recovery, or actual mangrove extent change.'
      }
    });
  } catch (error) {
    console.error(
      'Mangrove change API error:',
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        'Unable to generate the mangrove candidate change map.'
    });
  }
}