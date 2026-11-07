
const { ee, initEE } = require('../../lib/earthEngine');

const ASSET_ROOT =
  'projects/meta-origin-451614-s3/assets';

const ANALYSIS_CRS = 'EPSG:32650';
const ANALYSIS_SCALE_METERS = 20;

// Load the annual MVI candidate asset already
// prepared using the documented 3.75 threshold.
const loadAnnualCandidate = (year, geometry) => {
  return ee
    .Image(`${ASSET_ROOT}/mvi_candidate_${year}`)
    .eq(1)
    .unmask(0)
    .reproject({
      crs: ANALYSIS_CRS,
      scale: ANALYSIS_SCALE_METERS
    })
    .clip(geometry);
};

const getMapAsync = (image) =>
  new Promise((resolve, reject) => {
    image.getMap({}, (map, error) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }

      if (!map?.urlFormat) {
        reject(new Error('No map URL returned.'));
        return;
      }

      resolve(map.urlFormat);
    });
  });

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Only GET requests are allowed.'
    });
  }

  const historicalYear = Number(
    req.query.historicalYear
  );

  const currentYear = Number(
    req.query.currentYear
  );

  if (
    !Number.isInteger(historicalYear) ||
    !Number.isInteger(currentYear) ||
    historicalYear < 2019 ||
    currentYear > 2025 ||
    currentYear <= historicalYear
  ) {
    return res.status(400).json({
      success: false,
      error: 'Select two different years from 2019–2025, in chronological order.'
    });
  }

  try {
    await initEE();

    const palawan = ee
      .FeatureCollection('FAO/GAUL/2015/level2')
      .filter(ee.Filter.eq('ADM0_NAME', 'Philippines'))
      .filter(ee.Filter.eq('ADM2_NAME', 'Palawan'));

    const geometry = palawan.geometry();

    const historical = loadAnnualCandidate(
      historicalYear,
      geometry
    );

    const current = loadAnnualCandidate(
      currentYear,
      geometry
    );

    // Candidate in both years.
    const persistent = historical
      .and(current)
      .selfMask();

    // Candidate in historical year only.
    const loss = historical
      .and(current.not())
      .selfMask();

    // Candidate in current year only.
    const gain = historical
      .not()
      .and(current)
      .selfMask();

    const changeMap = persistent
      .visualize({ palette: ['00C853'] })
      .blend(
        loss.visualize({ palette: ['FF1744'] })
      )
      .blend(
        gain.visualize({ palette: ['2979FF'] })
      )
      .clip(geometry);

    const mapUrl = await getMapAsync(changeMap);

    return res.status(200).json({
      success: true,
      mapUrl,
      metadata: {
        product: 'MVI-derived candidate extent change',
        historicalYear,
        currentYear,
        comparisonPeriod:
          `${historicalYear}-${currentYear}`,
        processingMode: 'Precomputed annual MVI assets',
        formula: '|B8 - B3| / |B11 - B3|',
        documentedThreshold: 3.75,
        analysisGrid: {
          crs: ANALYSIS_CRS,
          scaleMeters: ANALYSIS_SCALE_METERS
        },
        changeClasses: {
          persistent: 'Candidate in both years',
          loss: 'Candidate in historical year only',
          gain: 'Candidate in current year only'
        },
        colors: {
          persistentCandidate: '#00C853',
          candidateLoss: '#FF1744',
          candidateGain: '#2979FF'
        },
        areaStatisticsIncluded: false,
        fieldValidated: false,
        limitation:
          'Changes are provisional and may include classification variability or missing observations.'
      }
    });
  } catch (error) {
    console.error('Mangrove change API error:', error);

    return res.status(500).json({
      success: false,
      error: error.message ||
        'Unable to generate the change map.'
    });
  }
}
