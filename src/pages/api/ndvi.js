
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

const ASSET_ROOT =
  'projects/meta-origin-451614-s3/assets';

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

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);

    return res.status(405).json({
      success: false,
      error: 'Only GET requests are allowed.'
    });
  }

  const yearParam = req.query.year;

  if (
    typeof yearParam !== 'string' ||
    !/^\d{4}$/.test(yearParam)
  ) {
    return res.status(400).json({
      success: false,
      error: 'A valid year is required.'
    });
  }

  const year = Number(yearParam);

  if (year < 2019 || year > 2025) {
    return res.status(400).json({
      success: false,
      error: 'Year must be between 2019 and 2025.'
    });
  }

  try {
    await initEE();

    /*
     * Step 1: Load the precomputed annual NDVI asset.
     *
     * Each asset already contains:
     * - Annual median Sentinel-2 NDVI
     * - Same-year MVI mangrove candidate mask
     */
    const assetId =
      `${ASSET_ROOT}/ndvi_mangrove_candidate_${year}`;

    const mangroveNdvi = ee.Image(assetId)
      .select('NDVI');

    /*
     * Step 2: Apply the NDVI visualization.
     */
    const visParams = {
      min: 0,
      max: 0.9,
      palette: NDVI_PALETTE
    };

    /*
     * Step 3: Generate the Earth Engine tile URL.
     */
    const map = await getMapAsync(
      mangroveNdvi,
      visParams
    );

    /*
     * Step 4: Return the map URL to the frontend.
     */
    return res.status(200).json({
      success: true,
      mapUrl: map.urlFormat,
      metadata: {
        year,
        startDate: `${year}-01-01`,
        endDate: `${year + 1}-01-01`,
        area: 'Palawan',
        dataset: 'COPERNICUS/S2_SR_HARMONIZED',
        composite: 'Annual median of per-image NDVI',
        mask: `mvi_candidate_${year}`,
        assetId,
        band: 'NDVI',
        resolutionMeters: 20,
        visualization: visParams,
        interpretation:
          'NDVI represents vegetation greenness within MVI-derived mangrove candidate areas. It does not independently establish mangrove health, degradation, loss, or recovery.'
      }
    });
  } catch (error) {
    console.error('NDVI API error:', error);

    return res.status(500).json({
      success: false,
      error:
        error.message ||
        'Unable to load the NDVI map.'
    });
  }
}
