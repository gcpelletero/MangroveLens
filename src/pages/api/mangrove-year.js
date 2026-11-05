const {
  ee,
  initEE
} = require('../../lib/earthEngine');


/*
 * Prepared annual MVI assets.
 */
const YEAR_CONFIG = {

  2019: {
    assetId:
      'projects/meta-origin-451614-s3/assets/mvi_candidate_2019',

    threshold:
      3.75,

    imageCount:
      532
  },

  2020: {
    assetId:
      'projects/meta-origin-451614-s3/assets/mvi_candidate_2020',

    threshold:
      3.75,

    imageCount:
      503
  },

  2021: {
    assetId:
      'projects/meta-origin-451614-s3/assets/mvi_candidate_2021',

    threshold:
      3.75,

    imageCount:
      234
  },

  2022: {
    assetId:
      'projects/meta-origin-451614-s3/assets/mvi_candidate_2022',

    threshold:
      3.75,

    imageCount:
      179
  },


  2023: {
    assetId:
      'projects/meta-origin-451614-s3/assets/mvi_candidate_2023',

    threshold:
      3.75,

    imageCount:
      null
  },

  2024: {
    assetId:
      'projects/meta-origin-451614-s3/assets/mvi_candidate_2024',

    threshold:
      3.75,

    imageCount:
      415
  },

  2025: {
    assetId:
      'projects/meta-origin-451614-s3/assets/mvi_candidate_2025',

    threshold:
      3.75,

    imageCount:
      223
  }

};


/*
 * Prepared comparison references.
 */
const REFERENCE_CONFIG = {
  gmw: {
    2019: {
      assetId:
        'projects/meta-origin-451614-s3/assets/gmw_reference_2019_outline',

      year:
        2019,

      name:
        'GMW',

      fullName:
        'Global Mangrove Watch v4.1.12'
    },

    2020: {
      assetId:
        'projects/meta-origin-451614-s3/assets/gmw_reference_2020_outline',

      year:
        2020,

      name:
        'GMW',

      fullName:
        'Global Mangrove Watch v4.1.12'
    },

    2021: {
      assetId:
        'projects/meta-origin-451614-s3/assets/gmw_reference_2021_outline',

      year:
        2021,

      name:
        'GMW',

      fullName:
        'Global Mangrove Watch v4.1.12'
    },


    2022: {
      assetId:
        'projects/meta-origin-451614-s3/assets/gmw_reference_2022_outline',

      year: 2022,
      name: 'GMW',
      fullName: 'Global Mangrove Watch v4.1.12'
    },


    2023: {
      assetId:
        'projects/meta-origin-451614-s3/assets/gmw_reference_2023_outline',

      year: 2023,
      name: 'GMW',
      fullName: 'Global Mangrove Watch v4.1.12'
    },


2024: {
  assetId:
    'projects/meta-origin-451614-s3/assets/gmw_reference_2024_outline',

  year: 2024,
  name: 'GMW',
  fullName: 'Global Mangrove Watch v4.1.12'
},

2025: {
  assetId:
    'projects/meta-origin-451614-s3/assets/gmw_reference_2025_outline',

  year: 2025,
  name: 'GMW',
  fullName: 'Global Mangrove Watch v4.1.12'
}


  }
};




/*
 * Cache each map configuration for two hours.
 *
 * MVI only and MVI + CGMD have different
 * cache entries.
 */
const CACHE_TTL_MS =
  2 * 60 * 60 * 1000;

const mapCache =
  globalThis.__mangroveLensCombinedMapCache ??
  new Map();

globalThis.__mangroveLensCombinedMapCache =
  mapCache;


/*
 * Avoid duplicate getMap requests.
 */
const pendingRequests =
  globalThis.__mangroveLensCombinedPending ??
  new Map();

globalThis.__mangroveLensCombinedPending =
  pendingRequests;


/*
 * Promise wrapper for Earth Engine getMap().
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
              'Earth Engine did not return a map URL.'
            )
          );
          return;
        }

        resolve(map);
      }
    );
  });


/*
 * Build one final display image.
 */
const createMapResult = async (
  year,
  yearConfig,
  referenceSource
) => {
  /*
   * Prepared MVI binary asset.
   */
  const mviMask = ee
    .Image(
      yearConfig.assetId
    )
    .eq(1)
    .selfMask();


  /*
   * Green MVI visualization.
   */
  const mviVisual = mviMask
    .visualize({
      min:
        1,

      max:
        1,

      palette:
        ['00E676'],

      opacity:
        0.78
    });


  /*
   * Start with green MVI only.
   */
  let finalVisual =
    mviVisual;

  let referenceMetadata =
    null;


  /*
   * Add an optional prepared reference.
   */
  if (
    referenceSource &&
    referenceSource !== 'none'
  ) {
    const referenceConfig =
      REFERENCE_CONFIG[
        referenceSource
      ]?.[year];

    if (!referenceConfig) {
      throw new Error(
        `Unsupported reference source: ${referenceSource}`
      );
    }


    /*
     * Prepared CGMD outline asset.
     */
    const referenceMask = ee
      .Image(
        referenceConfig.assetId
      )
      .eq(1)
      .selfMask();


    /*
     * Magenta visualization.
     */
    const referenceVisual =
      referenceMask.visualize({
        min:
          1,

        max:
          1,

        palette:
          ['FF00FF'],

        opacity:
          1
      });


    /*
     * ONE combined visual image.
     *
     * Green MVI = bottom
     * Magenta reference = top
     */
    finalVisual =
      mviVisual.blend(
        referenceVisual
      );


    referenceMetadata = {
      included:
        true,

      source:
        referenceConfig.name,

      fullName:
        referenceConfig.fullName,

      year:
        referenceConfig.year,

      assetId:
        referenceConfig.assetId,

      role:
        'Visual comparison only',

      usedAsClassificationMask:
        false,

      isFieldGroundTruth:
        false,

      color:
        '#FF00FF'
    };
  }


  /*
   * Generate ONE Earth Engine map URL.
   */
  const map =
    await getMapAsync(
      finalVisual,
      {}
    );


  return {
    success:
      true,

    mapUrl:
      map.urlFormat,

    metadata: {
      product:
        'Annual MVI-derived mangrove candidate extent',

      classificationStatus:
        'Precomputed provisional annual MVI-derived mangrove candidate extent',

      year,

      threshold:
        yearConfig.threshold,

      effectiveMviRange: {
        minimum:
          yearConfig.threshold,

        maximum:
          20
      },

      formula:
        '|B8 - B3| / |B11 - B3|',

      candidateRule:
        `MVI ${yearConfig.threshold}–20, connected patch >= 5 pixels, and distance to mapped water <= 1000 meters`,

      dataset:
        'COPERNICUS/S2_SR_HARMONIZED',

      imageCount:
        yearConfig.imageCount,

      composite:
        'Annual median reflectance',

      analysisGrid: {
        crs:
          'EPSG:32650',

        scaleMeters:
          20
      },

      assetId:
        yearConfig.assetId,

      processingMode:
        'Precomputed Earth Engine image assets',

      dynamicSentinelProcessing:
        false,

      reference:
        referenceMetadata,

      displayMode:
        referenceMetadata
          ? 'MVI + reference combined into one Earth Engine tile layer'
          : 'MVI only',

      colors: {
        candidateExtent:
          '#00E676',

        referenceOutline:
          '#FF00FF'
      },

      fieldValidated:
        false
    }
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
      success:
        false,

      error:
        'Only GET requests are allowed.'
    });
  }


  try {
    const year =
      Number(req.query.year);


    /*
     * Values:
     *
     * none
     * cgmd
     */
    const referenceSource =
      String(
        req.query.reference ||
        'none'
      ).toLowerCase();


    if (!Number.isInteger(year)) {
      return res.status(400).json({
        success:
          false,

        error:
          'A valid year is required.'
      });
    }


    const yearConfig =
      YEAR_CONFIG[year];


    if (!yearConfig) {
      return res.status(404).json({
        success:
          false,

        error:
          `No precomputed MVI asset is available for ${year}.`
      });
    }


  if (
    referenceSource !== 'none' &&
    !REFERENCE_CONFIG[
      referenceSource
    ]?.[year]
  ) {
    return res.status(404).json({
      success: false,

      error:
        `No ${referenceSource.toUpperCase()} reference is available for ${year}.`
    });
  }


    /*
     * Important:
     *
     * MVI only and MVI + CGMD need
     * different cache keys.
     */
    const cacheKey =
      `mvi:${year}:reference:${referenceSource}:v1`;

    const now =
      Date.now();

    const cached =
      mapCache.get(
        cacheKey
      );


    if (
      cached &&
      cached.expiresAt > now
    ) {
      console.log(
        `Combined map cache HIT: ${cacheKey}`
      );

      res.setHeader(
        'X-MangroveLens-Cache',
        'HIT'
      );

      return res
        .status(200)
        .json(
          cached.result
        );
    }


    console.log(
      `Combined map cache MISS: ${cacheKey}`
    );


    await initEE();


    let requestPromise =
      pendingRequests.get(
        cacheKey
      );


    if (!requestPromise) {
      requestPromise =
        createMapResult(
          year,
          yearConfig,
          referenceSource
        );

      pendingRequests.set(
        cacheKey,
        requestPromise
      );
    }


    let result;

    try {
      result =
        await requestPromise;
    } finally {
      pendingRequests.delete(
        cacheKey
      );
    }


    mapCache.set(
      cacheKey,
      {
        result,

        expiresAt:
          Date.now() +
          CACHE_TTL_MS
      }
    );


    res.setHeader(
      'X-MangroveLens-Cache',
      'MISS'
    );


    return res
      .status(200)
      .json(
        result
      );

  } catch (error) {
    console.error(
      'Combined MVI map API error:',
      error
    );


    return res.status(500).json({
      success:
        false,

      error:
        error.message ||
        'Unable to load the annual mangrove map.'
    });
  }
}