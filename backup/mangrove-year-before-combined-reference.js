const {
  ee,
  initEE
} = require('../../lib/earthEngine');

/*
 * Precomputed annual MVI assets.
 *
 * The expensive Sentinel-2 processing was already
 * completed during the Earth Engine asset export.
 */
const YEAR_CONFIG = {
  2024: {
    assetId:
      'projects/meta-origin-451614-s3/assets/mvi_candidate_2024',

    threshold:
      3.75,

    imageCount:
      415
  }
};

/*
 * Reuse a generated Earth Engine map URL
 * for two hours.
 */
const CACHE_TTL_MS =
  2 * 60 * 60 * 1000;

/*
 * Keep the cache while the current Node.js
 * process is running.
 */
const mapCache =
  globalThis.__mangroveLensMviMapCache ??
  new Map();

globalThis.__mangroveLensMviMapCache =
  mapCache;

/*
 * Prevent duplicate Earth Engine requests when
 * several users request the same year together.
 */
const pendingRequests =
  globalThis.__mangroveLensMviPendingRequests ??
  new Map();

globalThis.__mangroveLensMviPendingRequests =
  pendingRequests;

/*
 * Convert Earth Engine's callback-based getMap()
 * into a Promise.
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
 * Load and visualize one prepared yearly asset.
 */
const createMapResult = async (
  year,
  config
) => {
  /*
   * The stored raster contains:
   *
   * 1 = mangrove candidate
   * masked/0 = background
   */
  const candidateMask = ee
    .Image(config.assetId)
    .eq(1)
    .selfMask()
    .rename('candidate_mangrove');

  /*
   * Convert the binary mask into the same green
   * visual layer used by MangroveLens.
   */
  const candidateVisual =
    candidateMask.visualize({
      min:
        1,

      max:
        1,

      palette:
        ['00E676'],

      opacity:
        0.78
    });

  const map = await getMapAsync(
    candidateVisual,
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
        config.threshold,

      thresholdMethod: {
        selectedValue:
          config.threshold,

        basis:
          'Reference-agreement screening against CGMD 2023 using the annual Sentinel-2 median-composite workflow',

        status:
          'Provisional Palawan prototype parameter; not independently field-validated'
      },

      effectiveMviRange: {
        minimum:
          config.threshold,

        maximum:
          20,

        rule:
          `${config.threshold} <= MVI <= 20`
      },

      formula:
        '|B8 - B3| / |B11 - B3|',

      candidateRule:
        `MVI ${config.threshold}–20, connected patch >= 5 pixels, and distance to mapped water <= 1000 meters`,

      area:
        'Palawan',

      dataset:
        'COPERNICUS/S2_SR_HARMONIZED',

      imageCount:
        config.imageCount,

      composite:
        'Annual median reflectance',

      analysisGrid: {
        crs:
          'EPSG:32650',

        scaleMeters:
          20
      },

      assetId:
        config.assetId,

      processingMode:
        'Precomputed Earth Engine image asset',

      dynamicSentinelProcessing:
        false,

      mapUrlCacheHours:
        2,

      colors: {
        candidateExtent:
          '#00E676'
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

    if (!Number.isInteger(year)) {
      return res.status(400).json({
        success:
          false,

        error:
          'A valid year is required.'
      });
    }

    const config =
      YEAR_CONFIG[year];

    if (!config) {
      return res.status(404).json({
        success:
          false,

        error:
          `No precomputed mangrove asset is available for ${year}.`
      });
    }

    const cacheKey =
      `mvi-year:${year}:asset-v1`;

    const now =
      Date.now();

    const cached =
      mapCache.get(cacheKey);

    /*
     * Return the existing Earth Engine map URL
     * when it is still inside the two-hour cache.
     */
    if (
      cached &&
      cached.expiresAt > now
    ) {
      console.log(
        `MVI asset map cache HIT for ${year}.`
      );

      res.setHeader(
        'X-MangroveLens-Cache',
        'HIT'
      );

      res.setHeader(
        'Cache-Control',
        'private, max-age=300'
      );

      return res
        .status(200)
        .json(cached.result);
    }

    console.log(
      `MVI asset map cache MISS for ${year}.`
    );

    await initEE();

    /*
     * Reuse the same in-progress Promise when
     * duplicate requests arrive together.
     */
    let requestPromise =
      pendingRequests.get(cacheKey);

    if (!requestPromise) {
      requestPromise =
        createMapResult(
          year,
          config
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

    res.setHeader(
      'Cache-Control',
      'private, max-age=300'
    );

    return res
      .status(200)
      .json(result);
  } catch (error) {
    console.error(
      'Precomputed MVI asset API error:',
      error
    );

    return res.status(500).json({
      success:
        false,

      error:
        error.message ||
        'Unable to load the precomputed mangrove asset.'
    });
  }
}