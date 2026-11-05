const {
  ee,
  initEE
} = require('../../lib/earthEngine');

/*
 * Reuse the generated reference map URL
 * for two hours.
 */
const CACHE_TTL_MS =
  2 * 60 * 60 * 1000;

const referenceMapCache =
  globalThis.__mangroveLensReferenceMapCache ??
  new Map();

globalThis.__mangroveLensReferenceMapCache =
  referenceMapCache;

/*
 * Convert Earth Engine getMap() into a Promise.
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
              'Earth Engine did not return a reference map URL.'
            )
          );
          return;
        }

        resolve(map);
      }
    );
  });

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
      error: 'Only GET requests are allowed.'
    });
  }

  try {
    const source = String(
      req.query.source || 'cgmd'
    ).toLowerCase();

    const year = Number(
      req.query.year || 2023
    );

    /*
     * Only CGMD is connected for now.
     *
     * More sources can be added later.
     */
    if (source !== 'cgmd') {
      return res.status(400).json({
        success: false,
        error:
          `Unsupported reference source: ${source}`
      });
    }

    if (
      !Number.isInteger(year) ||
      year < 1984 ||
      year > 2023
    ) {
      return res.status(400).json({
        success: false,
        error:
          'CGMD reference year must be between 1984 and 2023.'
      });
    }

    const cacheKey =
      `${source}:${year}:outline-v1`;

    const cached =
      referenceMapCache.get(cacheKey);

    if (
      cached &&
      cached.expiresAt > Date.now()
    ) {
      res.setHeader(
        'X-MangroveLens-Reference-Cache',
        'HIT'
      );

      return res
        .status(200)
        .json(cached.result);
    }

    await initEE();

    /*
     * Palawan administrative boundary.
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

    const palawanGeometry =
      palawan.geometry();

    /*
     * CGMD annual mangrove extent polygons.
     */
    const cgmdReference = ee
      .FeatureCollection(
        'projects/mangrovedatahub2/assets/CGMD-Extent30'
      )
      .filter(
        ee.Filter.eq(
          'year',
          year
        )
      )
      .filterBounds(
        palawanGeometry
      );

    /*
     * Transparent interior and magenta outline.
     *
     * The reference remains separate from the
     * green MVI candidate classification.
     */
    const referenceOutline =
      cgmdReference.style({
        color: 'FF00FF',
        fillColor: '00000000',
        width: 2,
        lineType: 'solid'
      });

    const map = await getMapAsync(
      referenceOutline,
      {}
    );

    const result = {
      success: true,

      mapUrl:
        map.urlFormat,

      metadata: {
        product:
          'Mangrove extent comparison reference',

        source:
          'CGMD',

        fullName:
          'Continuous Global Mangrove Dynamics',

        year,

        dataset:
          'projects/mangrovedatahub2/assets/CGMD-Extent30',

        role:
          'Visual comparison outline only',

        usedAsClassificationMask:
          false,

        isFieldGroundTruth:
          false,

        color:
          '#FF00FF'
      }
    };

    referenceMapCache.set(
      cacheKey,
      {
        result,

        expiresAt:
          Date.now() +
          CACHE_TTL_MS
      }
    );

    res.setHeader(
      'X-MangroveLens-Reference-Cache',
      'MISS'
    );

    return res
      .status(200)
      .json(result);
  } catch (error) {
    console.error(
      'Mangrove reference API error:',
      error
    );

    return res.status(500).json({
      success: false,

      error:
        error.message ||
        'Unable to load the mangrove reference outline.'
    });
  }
}