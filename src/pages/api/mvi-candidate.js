const { ee, initEE } = require('../../lib/earthEngine');

/*
 * Fixed analysis settings.
 *
 * EPSG:32650 = WGS 84 / UTM Zone 50N
 * 20 meters = common grid based on Sentinel-2 B11
 */
const ANALYSIS_CRS = 'EPSG:32650';
const ANALYSIS_SCALE_METERS = 20;

/*
 * The map remains at 20 meters. Numerical agreement
 * summaries use a lighter grid to avoid API timeouts.
 */
const AGREEMENT_SCALE_METERS = 90;
/*
 * Remove provisional candidate patches containing
 * fewer than five connected 20-meter pixels.
 *
 * 5 pixels × 400 m² = 2,000 m² = 0.2 hectares.
 */
const DEFAULT_MIN_PATCH_PIXELS = 5;

/*
 * connectedPixelCount only needs to distinguish
 * objects smaller or larger than our minimum.
 */
const MAX_CONNECTED_PIXELS = 100;

/*
 * Provisional water-proximity settings.
 *
 * A candidate pixel must be within this distance
 * of mapped surface water.
 */
const DEFAULT_MAX_WATER_DISTANCE_METERS = 1000;

/*
 * Water must have been observed in at least
 * 10% of valid JRC observations.
 *
 * This is an initial screening value,
 * not yet a finalized methodological parameter.
 */
const DEFAULT_MIN_WATER_OCCURRENCE_PERCENT = 10;

const MAX_ALLOWED_WATER_DISTANCE_METERS = 5000;

const roundNumber = (value, decimalPlaces = 2) => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Number(
    numericValue.toFixed(decimalPlaces)
  );
};

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

const getMapAsync = (image, visParams = {}) =>
  new Promise((resolve, reject) => {
    image.getMap(visParams, (map, error) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }

      if (!map?.urlFormat) {
        reject(
          new Error(
            'Earth Engine did not return a candidate map URL.'
          )
        );
        return;
      }

      resolve(map);
    });
  });

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

/**
 * Prepare the three continuous reflectance bands
 * used by the MVI calculation.
 *
 * Resampling is declared on the original Sentinel-2
 * images, not on the annual composite.
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
    .copyProperties(image, [
      'system:time_start'
    ]);
};

/**
 * Measure candidate, reference, overlap, and
 * rejected areas on the same 20-meter grid.
 *
 * CGMD is used only as an independent reference.
 * These values are reference-agreement measurements,
 * not field-validated accuracy statistics.
 */
const getReferenceAgreementAreas = (
  candidateImage,
  rejectedImage,
  referenceImage,
  geometry
) => {
  const pixelArea = ee.Image.pixelArea();

  /*
   * Convert all layers to explicit binary images.
   */
  const candidateMask = candidateImage
    .unmask(0)
    .gt(0);

  const rejectedMask = rejectedImage
    .unmask(0)
    .gt(0);

  const referenceMask = referenceImage
    .unmask(0)
    .gt(0);

  /*
   * Agreement means:
   *
   * candidate = yes
   * AND
   * CGMD reference = yes
   */
  const overlapMask = candidateMask.and(
    referenceMask
  );

  /*
   * Calculate four areas in one Earth Engine
   * operation to reduce the number of requests.
   */
  const areaImage = ee.Image.cat([
    pixelArea
      .updateMask(candidateMask)
      .rename('candidateAreaM2'),

    pixelArea
      .updateMask(referenceMask)
      .rename('referenceAreaM2'),

    pixelArea
      .updateMask(overlapMask)
      .rename('overlapAreaM2'),

    pixelArea
      .updateMask(rejectedMask)
      .rename('rejectedAreaM2')
  ]);

return areaImage.reduceRegion({
  reducer: ee.Reducer.sum(),
  geometry,
  crs: ANALYSIS_CRS,

  /*
   * Numerical agreement summary only.
   * The displayed map remains at 20 meters.
   */
  scale: AGREEMENT_SCALE_METERS,

  maxPixels: 1e8,
  tileScale: 8
});
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
    const threshold = Number(req.query.threshold);

    const minPatchPixels =
    req.query.minPatchPixels === undefined
        ? DEFAULT_MIN_PATCH_PIXELS
        : Number(req.query.minPatchPixels);

    const maxWaterDistanceMeters =
    req.query.maxWaterDistanceMeters === undefined
        ? DEFAULT_MAX_WATER_DISTANCE_METERS
        : Number(req.query.maxWaterDistanceMeters);

    const minWaterOccurrencePercent =
    req.query.minWaterOccurrencePercent === undefined
        ? DEFAULT_MIN_WATER_OCCURRENCE_PERCENT
        : Number(req.query.minWaterOccurrencePercent);

    if (!Number.isInteger(year)) {
      return res.status(400).json({
        success: false,
        error: 'A valid year is required.'
      });
    }

    if (year < 2019 || year > 2026) {
      return res.status(400).json({
        success: false,
        error:
          'Year must currently be between 2019 and 2026.'
      });
    }

    if (
      !Number.isFinite(threshold) ||
      threshold < 0 ||
      threshold > 10
    ) {
      return res.status(400).json({
        success: false,
        error:
          'Threshold must be a number between 0 and 10.'
      });
    }

    if (
    !Number.isInteger(minPatchPixels) ||
    minPatchPixels < 1 ||
    minPatchPixels > MAX_CONNECTED_PIXELS
    ) {
    return res.status(400).json({
        success: false,
        error:
        `Minimum patch size must be an integer between 1 and ${MAX_CONNECTED_PIXELS}.`
    });
    }

    if (
    !Number.isInteger(maxWaterDistanceMeters) ||
    maxWaterDistanceMeters < 100 ||
    maxWaterDistanceMeters >
        MAX_ALLOWED_WATER_DISTANCE_METERS
    ) {
    return res.status(400).json({
        success: false,
        error:
        `Maximum water distance must be an integer between 100 and ${MAX_ALLOWED_WATER_DISTANCE_METERS} meters.`
    });
    }

    if (
    !Number.isFinite(minWaterOccurrencePercent) ||
    minWaterOccurrencePercent < 1 ||
    minWaterOccurrencePercent > 100
    ) {
    return res.status(400).json({
        success: false,
        error:
        'Minimum water occurrence must be between 1 and 100 percent.'
    });
    }

    const startDate = `${year}-01-01`;
    const endDate = `${year + 1}-01-01`;

    console.log(
      `Creating MVI candidate map for ${year} using threshold ${threshold}...`
    );

    /*
     * Step 1: Palawan study boundary.
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
     * Step 2: Sentinel-2 images for one year.
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
    .map(prepareSentinel2ForMvi);

    const imageCount = await evaluateAsync(
      sentinelCollection.size()
    );

    if (imageCount === 0) {
      return res.status(404).json({
        success: false,
        error:
          `No usable Sentinel-2 images were found for ${year}.`
      });
    }

    /*
    * Step 3: Annual median reflectance composite.
    *
    * Use one fixed 20-meter projected grid so that
    * every annual result follows the same pixel size
    * and projection.
    */
    const analysisProjection = ee.Projection(
    ANALYSIS_CRS
    );

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

    const numerator = nir
    .subtract(green)
    .abs();

    const denominator = swir1
    .subtract(green)
    .abs();

    const validDenominator = denominator
    .gt(0.0001);

    /*
     * Step 4: Raw MVI.
     */
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
     *
     * This is not the classification threshold.
     */
    const stableMvi = rawMvi.updateMask(
    rawMvi
        .gte(0)
        .and(rawMvi.lte(20))
    );

    /*
    * Step 5: Initial candidate classification.
    *
    * A pixel becomes an initial candidate when:
    * MVI >= selected threshold.
    */
    const rawCandidateExtent = stableMvi
    .gte(threshold)
    .selfMask()
    .rename('candidate_mangrove')
    .setDefaultProjection(
        analysisProjection,
        null,
        ANALYSIS_SCALE_METERS
    );

    /*
    * Count neighboring candidate pixels.
    *
    * true means eight-connected:
    * horizontal, vertical, and diagonal connections
    * are treated as belonging to the same patch.
    */
    const connectedPixelCount =
    rawCandidateExtent.connectedPixelCount(
        MAX_CONNECTED_PIXELS,
        true
    );

    /*
    * Candidate extent after small-patch cleanup,
    * but before water-proximity filtering.
    */
    const patchCleanedCandidate = rawCandidateExtent
    .updateMask(
        connectedPixelCount.gte(
        minPatchPixels
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
    * Step 6: Build a long-term surface-water
    * reference for proximity screening.
    *
    * The geometry is buffered so that seawater
    * immediately outside the Palawan administrative
    * boundary remains available for the distance
    * calculation.
    */
    const waterSearchGeometry =
    palawanGeometry.buffer(
        maxWaterDistanceMeters + 1000
    );

    const jrcSurfaceWater = ee.Image(
    'JRC/GSW1_4/GlobalSurfaceWater'
    );

    /*
    * The occurrence band ranges from 0 to 100.
    *
    * unmask(0) is important because the dataset's
    * occurrence-band mask follows the occurrence
    * value itself.
    */
    const waterReference = jrcSurfaceWater
    .select('occurrence')
    .unmask(0)
    .gte(minWaterOccurrencePercent)
    .rename('water_reference')
    .clip(waterSearchGeometry);

    /*
    * Calculate Euclidean distance to the nearest
    * mapped water pixel.
    *
    * The kernel radius is also the maximum distance
    * that Earth Engine needs to search.
    */
    const waterDistance = waterReference
    .distance(
        ee.Kernel.euclidean(
        maxWaterDistanceMeters,
        'meters'
        ),
        false
    )
    .rename('distance_to_water_meters');

    /*
    * Pixels farther than the kernel radius may be
    * masked in the distance output.
    *
    * unmask(0) is applied after the boolean test so
    * those pixels become false: not near water.
    */
    const nearWaterMask = waterDistance
    .lte(maxWaterDistanceMeters)
    .unmask(0)
    .rename('near_water');

/*
 * Candidate pixels retained by the
 * water-proximity constraint.
 */
const proximityScreenedCandidate =
  patchCleanedCandidate
    .updateMask(nearWaterMask)
    .selfMask()
    .rename('candidate_mangrove')
    .setDefaultProjection(
      analysisProjection,
      null,
      ANALYSIS_SCALE_METERS
    );

    /*
    * Candidate pixels rejected only because
    * they are farther than the selected distance
    * from mapped water.
    *
    * This orange layer is shown temporarily
    * for visual inspection.
    */
    const rejectedByProximity =
    patchCleanedCandidate
        .updateMask(nearWaterMask.not())
        .selfMask()
        .rename('rejected_by_proximity')
        .setDefaultProjection(
        analysisProjection,
        null,
        ANALYSIS_SCALE_METERS
        );

    /*
     * Step 6: Load CGMD 2023 for visual comparison.
     *
     * This remains a reference and is not used
     * as the final mask.
     */
    const cgmd2023 = ee
      .FeatureCollection(
        'projects/mangrovedatahub2/assets/CGMD-Extent30'
      )
      .filter(
        ee.Filter.eq('year', 2023)
      )
      .filterBounds(palawanGeometry);

    /*
    * Convert the CGMD polygons into a filled
    * raster reference mask.
    *
    * This is different from referenceOutline,
    * which only draws the magenta borders.
    */
    const cgmdReferenceMask = ee
    .Image(0)
    .byte()
    .paint(cgmd2023, 1)
    .selfMask()
    .rename('cgmd_reference')
    .setDefaultProjection(
        analysisProjection,
        null,
        ANALYSIS_SCALE_METERS
    )
    .clip(palawanGeometry);

console.log(
  `Starting reference-agreement calculation at ${AGREEMENT_SCALE_METERS} meters...`
);

const agreementAreaValues =
  await evaluateAsync(
    getReferenceAgreementAreas(
      proximityScreenedCandidate,
      rejectedByProximity,
      cgmdReferenceMask,
      palawanGeometry
    )
  );

console.log(
  'Reference-agreement calculation completed:',
  agreementAreaValues
);

/*
 * Step 1: Read the four Earth Engine area values.
 */
const candidateAreaM2 = Number(
  agreementAreaValues?.candidateAreaM2 || 0
);

const referenceAreaM2 = Number(
  agreementAreaValues?.referenceAreaM2 || 0
);

const overlapAreaM2 = Number(
  agreementAreaValues?.overlapAreaM2 || 0
);

const rejectedAreaM2 = Number(
  agreementAreaValues?.rejectedAreaM2 || 0
);

/*
 * Step 2: Calculate derived areas.
 */
const preProximityCandidateAreaM2 =
  candidateAreaM2 + rejectedAreaM2;

const candidateOutsideReferenceAreaM2 =
  Math.max(
    candidateAreaM2 - overlapAreaM2,
    0
  );

const referenceOutsideCandidateAreaM2 =
  Math.max(
    referenceAreaM2 - overlapAreaM2,
    0
  );

/*
 * Step 3: Calculate percentages.
 *
 * These variables must be created before they
 * are used in referenceAgreementAssessment.
 */
const referenceRetentionPercent =
  referenceAreaM2 > 0
    ? (
        overlapAreaM2 /
        referenceAreaM2
      ) * 100
    : 0;

const candidateAgreementPercent =
  candidateAreaM2 > 0
    ? (
        overlapAreaM2 /
        candidateAreaM2
      ) * 100
    : 0;

const proximityRemovalPercent =
  preProximityCandidateAreaM2 > 0
    ? (
        rejectedAreaM2 /
        preProximityCandidateAreaM2
      ) * 100
    : 0;

/*
 * Step 4: Build the readable result object.
 *
 * This must come after all area and percentage
 * variables above.
 */
const referenceAgreementAssessment = {
  status:
    'Reference agreement only; not field-validated accuracy',

  candidateYear:
    year,

  referenceDataset:
    'projects/mangrovedatahub2/assets/CGMD-Extent30',

  referenceYear:
    2023,

  comparisonGrid: {
    crs:
      ANALYSIS_CRS,

    scaleMeters:
      AGREEMENT_SCALE_METERS,

    purpose:
      'Reference-agreement area summary only; displayed candidate map remains at 20 meters'
  },

  parameters: {
    mviThreshold:
      threshold,

    minimumPatchPixels:
      minPatchPixels,

    maximumWaterDistanceMeters:
      maxWaterDistanceMeters,

    minimumWaterOccurrencePercent:
      minWaterOccurrencePercent
  },

  areasKm2: {
    retainedCandidate:
      roundNumber(
        candidateAreaM2 / 1e6,
        3
      ),

    cgmdReference:
      roundNumber(
        referenceAreaM2 / 1e6,
        3
      ),

    candidateReferenceOverlap:
      roundNumber(
        overlapAreaM2 / 1e6,
        3
      ),

    candidateOutsideReference:
      roundNumber(
        candidateOutsideReferenceAreaM2 / 1e6,
        3
      ),

    referenceOutsideCandidate:
      roundNumber(
        referenceOutsideCandidateAreaM2 / 1e6,
        3
      ),

    rejectedByWaterProximity:
      roundNumber(
        rejectedAreaM2 / 1e6,
        3
      ),

    candidateBeforeWaterProximity:
      roundNumber(
        preProximityCandidateAreaM2 / 1e6,
        3
      )
  },

  percentages: {
    referenceRetention:
      roundNumber(
        referenceRetentionPercent,
        2
      ),

    candidateAgreement:
      roundNumber(
        candidateAgreementPercent,
        2
      ),

    removedByWaterProximity:
      roundNumber(
        proximityRemovalPercent,
        2
      )
  },

  interpretation: {
    referenceRetention:
      'Percentage of the CGMD 2023 reference area captured by the retained candidate layer',

    candidateAgreement:
      'Percentage of the retained candidate layer overlapping the CGMD 2023 reference',

    removedByWaterProximity:
      'Percentage of the patch-cleaned MVI candidate area rejected by the water-distance constraint'
  },

  limitation:
    'CGMD is an independent mapped reference and not field-verified ground truth.'
};

console.log(
  'MVI reference agreement assessment:',
  referenceAgreementAssessment
);

    /*
    * Retained candidate pixels are green.
    */
    const candidateVisual =
    proximityScreenedCandidate
        .visualize({
        palette: ['00E676'],
        opacity: 0.78
        });

    /*
    * Candidate pixels removed by the proximity
    * constraint are orange.
    *
    * This is a temporary diagnostic layer.
    */
    const rejectedVisual =
    rejectedByProximity
        .visualize({
        palette: ['FF9800'],
        opacity: 0.78
        });

    /*
     * CGMD reference boundaries are magenta.
     */
    const referenceOutline = ee
      .Image(0)
      .byte()
      .paint(cgmd2023, 1, 1)
      .selfMask()
      .visualize({
        palette: ['FF00FF'],
        opacity: 1
      });

    /*
    * Display order:
    * 1. Orange rejected candidates
    * 2. Green retained candidates
    * 3. Magenta CGMD outline
    */
    const comparisonMap = rejectedVisual
    .blend(candidateVisual)
    .blend(referenceOutline)
    .clip(palawanGeometry);

    const map = await getMapAsync(
      comparisonMap,
      {}
    );

    console.log(
      `MVI candidate map completed for threshold ${threshold}.`
    );

    return res.status(200).json({
      success: true,
      mapUrl: map.urlFormat,
      metadata: {
        product:
          'MVI-derived candidate mangrove extent',
        classificationStatus:
        'Provisional candidate threshold with patch and water-proximity screening',
        year,
        threshold,
        startDate,
        endDate,
        area: 'Palawan',
        dataset:
          'COPERNICUS/S2_SR_HARMONIZED',
        imageCount,
        composite:
          'Annual median reflectance',
        formula:
        '|B8 - B3| / |B11 - B3|',

        analysisGrid: {
        crs: ANALYSIS_CRS,
        scaleMeters: ANALYSIS_SCALE_METERS,
        resampling:
            'Bilinear resampling applied to source reflectance bands',
        purpose:
            'Consistent grid for yearly MVI and change comparison'
        },

        candidateRule:
        `MVI >= ${threshold}, connected patch >= ${minPatchPixels} pixels, and distance to mapped water <= ${maxWaterDistanceMeters} meters`,

        cleanup: {
        method:
            'Eight-connected pixel filtering',
        minimumPatchPixels:
            minPatchPixels,
        approximateMinimumPatchAreaHectares:
            (
            minPatchPixels *
            ANALYSIS_SCALE_METERS *
            ANALYSIS_SCALE_METERS
            ) / 10000,
        removes:
            'Small isolated candidate patches only'
        },

        proximityConstraint: {
        status:
            'Provisional environmental screening parameter',

        dataset:
            'JRC/GSW1_4/GlobalSurfaceWater',

        datasetPeriod:
            '1984-2021',

        band:
            'occurrence',

        minimumWaterOccurrencePercent:
            minWaterOccurrencePercent,

        maximumDistanceMeters:
            maxWaterDistanceMeters,

        rule:
            `Candidate must be within ${maxWaterDistanceMeters} meters of water occurrence >= ${minWaterOccurrencePercent}%`,

        role:
            'Reduce candidate vegetation located far from coastlines and mapped surface water',

        usedAsMangroveReference:
            false,

        limitation:
            'Candidates near inland rivers, lakes, or reservoirs may still be retained'
        },
        reference: {
        dataset:
            'projects/mangrovedatahub2/assets/CGMD-Extent30',

        year:
            2023,

        role:
            'Visual and numerical agreement reference only',

        usedAsFinalMask:
            false,

        isFieldGroundTruth:
            false
        },

        referenceAgreementAssessment:
        referenceAgreementAssessment,
        colors: {
        retainedCandidateExtent: '#00E676',
        rejectedByWaterProximity: '#FF9800',
        cgmdReferenceOutline: '#FF00FF'
        },
        finalThresholdSelected: false,
        finalWaterDistanceSelected: false
      }
    });
  } catch (error) {
    console.error(
      'MVI candidate API error:',
      error
    );

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        'Unable to generate the candidate MVI map.'
    });
  }
}