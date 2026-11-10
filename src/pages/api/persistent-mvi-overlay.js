
const { ee, initEE } = require('../../lib/earthEngine');

const ASSET_ROOT =
  'projects/meta-origin-451614-s3/assets';

const getMapAsync = (image) =>
  new Promise((resolve, reject) => {
    image.getMap(
      {
        min: 0,
        max: 1,
        palette: ['#FFD700']
      },
      (map, error) => {
        if (error) {
          reject(new Error(String(error)));
          return;
        }

        if (!map || !map.urlFormat) {
          reject(
            new Error('Earth Engine did not return a map tile URL.')
          );
          return;
        }

        resolve(map);
      }
    );
  });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);

    return res.status(405).json({
      success: false,
      error: 'Only GET requests are allowed.'
    });
  }


    // Get the observation period selected by the user.
    // Default to 2019–2025 for existing requests.
    const startYear = Number(req.query.startYear ?? 2019);
    const endYear = Number(req.query.endYear ?? 2025);

    // Validate the selected years.
    if (
      !Number.isInteger(startYear) ||
      !Number.isInteger(endYear) ||
      startYear < 2019 ||
      endYear > 2025 ||
      startYear > endYear
    ) {
      return res.status(400).json({
        success: false,
        error: 'Please select a valid period from 2019 to 2025.'
      });
    }

    try {
      await initEE();



    // Load the candidate mask for the selected Start Year.
    let persistent = ee.Image(
      `${ASSET_ROOT}/mvi_candidate_${startYear}`
    )
      .select(0)
      .unmask(0)
      .gt(0);

    // Keep locations classified as candidates
    // in EVERY year of the selected period.
    for (let year = startYear + 1; year <= endYear; year++) {
      const annualCandidate = ee.Image(
        `${ASSET_ROOT}/mvi_candidate_${year}`
      )
        .select(0)
        .unmask(0)
        .gt(0);

      persistent = persistent.and(annualCandidate);
    }


    // Create a boundary around persistent locations.
    // This avoids covering the underlying NDVI colors.
    const interior = persistent.focal_min({
      radius: 1,
      units: 'pixels'
    });

    const outline = persistent
      .and(interior.not())
      .selfMask();

    // Generate the outline tile URL.
    const map = await getMapAsync(outline);

    return res.status(200).json({
      success: true,
      mapUrl: map.urlFormat,

      metadata: {
        layer: 'Persistent MVI candidate outline',
        period: `${startYear}–${endYear}`,
        startYear,
        endYear,
        area: 'Palawan',
        color: '#FFD700',
        interpretation:
          `Locations classified as mangrove candidates in every year from ${startYear} to ${endYear}. This does not independently confirm mangrove presence or ecological stability.`
      }
    });
  } catch (error) {
    console.error('Persistent MVI overlay error:', error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        'Unable to load the persistent MVI overlay.'
    });
  }
}
