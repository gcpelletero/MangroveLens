import * as ee from '@google/earthengine';

import {
  evaluateEE,
  getAdminGeometry,
  getDateBoundaries,
  getGeometryInfo,
  initializeEE,
  isValidDate
} from './function';

// Fail-fast environment check
if (!process.env.GOOGLE_SERVICE_KEY) {
  throw new Error('GOOGLE_SERVICE_KEY environment variable is not set');
}

console.log(11);
const privateKey = JSON.parse(process.env.GOOGLE_SERVICE_KEY);
let isInitialized = false;

const initEE = async () => {
  if (isInitialized) return;
  await initializeEE(privateKey);
  isInitialized = true;
};

const getMapPromise = (image, visParams) => {
  return new Promise((resolve, reject) => {
    image.getMap(visParams, (map, err) => {
      if (err) reject(err);
      else resolve(map);
    });
  });
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    // 1. Extract and Pattern Parameters
    const { 
      beforeStart = '2020-10-01', beforeEnd = '2020-11-01', 
      afterStart = '2020-11-02', afterEnd = '2020-11-25',
      region, province, municipality,
      polarization = 'VH', 
      passDirection = 'DESCENDING'
    } = req.query;

    const diffThreshold = parseFloat(req.query.differenceThreshold) || 1.25;
    const smoothingRadius = parseInt(req.query.smoothingRadius) || 50;
    const slopeThreshold = parseInt(req.query.slopeThreshold) || 5;
    const connectedThreshold = parseInt(req.query.connectedPixelThreshold) || 8;

    // 2. Validate Dates (Patterned with LULC logic)
    if (![beforeStart, beforeEnd, afterStart, afterEnd].every(isValidDate)) {
      return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' });
    }
    getDateBoundaries(beforeStart, beforeEnd);
    getDateBoundaries(afterStart, afterEnd);

    // 3. Initialize GEE
    await initEE();

    // 4. Get ROI
    const roi = await getAdminGeometry(region, province, municipality);
    if (!roi) {
      return res.status(400).json({ success: false, error: 'Could not create valid geometry' });
    }

    // 5. SAR Processing
    const collection = ee.ImageCollection('COPERNICUS/S1_GRD')
      .filter(ee.Filter.eq('instrumentMode', 'IW'))
      .filter(ee.Filter.listContains('transmitterReceiverPolarisation', polarization))
      .filter(ee.Filter.eq('orbitProperties_pass', passDirection))
      .filterBounds(roi)
      .select(polarization);

    const beforeCol = collection.filterDate(beforeStart, beforeEnd);
    const afterCol = collection.filterDate(afterStart, afterEnd);

    // Parallel processing for performance
    const [beforeSize, afterSize] = await Promise.all([
      evaluateEE(beforeCol.size()),
      evaluateEE(afterCol.size())
    ]);

    if (beforeSize === 0 || afterSize === 0) {
      return res.status(404).json({
        success: false,
        error: 'Insufficient Sentinel-1 data for the specified dates',
        metadata: { beforeSize, afterSize }
      });
    }

    // 6. Flood Detection Logic
    const beforeFiltered = beforeCol.mosaic().clip(roi).focal_mean(smoothingRadius, 'circle', 'meters');
    const afterFiltered = afterCol.mosaic().clip(roi).focal_mean(smoothingRadius, 'circle', 'meters');
    
    const difference = afterFiltered.divide(beforeFiltered);
    let flooded = difference.gt(diffThreshold);

    // Masking & Refinement
    const swater = ee.Image('JRC/GSW1_0/GlobalSurfaceWater').select('seasonality');
    const terrain = ee.Algorithms.Terrain(ee.Image('WWF/HydroSHEDS/03VFDEM'));
    
    flooded = flooded
      .where(swater.gte(10), 0) // Remove permanent water
      .updateMask(terrain.select('slope').lt(slopeThreshold)) // Remove steep slopes
      .updateMask(flooded);

    const connections = flooded.connectedPixelCount();
    flooded = flooded.updateMask(connections.gte(connectedThreshold));

    // 7. Generate Response Data (Patterned with LULC Metadata)
    const floodStats = flooded.multiply(ee.Image.pixelArea()).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: roi,
      scale: 10,
      maxPixels: 1e9,
      bestEffort: true
    });

    const [floodAreaHa, geometryInfo, beforeMap, afterMap, floodMap] = await Promise.all([
      evaluateEE(ee.Number(floodStats.get(polarization)).divide(10000).round()),
      getGeometryInfo(roi),
      getMapPromise(beforeFiltered, { min: -25, max: 0, palette: ['000000', 'FFFFFF'] }),
      getMapPromise(afterFiltered, { min: -25, max: 0, palette: ['000000', 'FFFFFF'] }),
      getMapPromise(flooded, { min: 0, max: 1, palette: ['0000FF'] })
    ]);

    res.status(200).json({
      success: true,
      maps: {
        before: beforeMap.urlFormat,
        after: afterMap.urlFormat,
        flooded: floodMap.urlFormat,
        floodMapId: floodMap.mapid
      },
      center: geometryInfo.center,
      bounds: geometryInfo.bounds,
      zoom: geometryInfo.zoom,
      statistics: {
        floodedAreaHa: floodAreaHa || 0,
        floodedAreaKm2: ((floodAreaHa || 0) / 100).toFixed(2)
      },
      metadata: {
        beforePeriod: { start: beforeStart, end: beforeEnd },
        afterPeriod: { start: afterStart, end: afterEnd },
        region: region || 'Philippines',
        dataset: 'Sentinel-1 GRD / UN-SPIDER Methodology',
        parameters: { polarization, diffThreshold, slopeThreshold }
      }
    });

  } catch (error) {
    console.error('Flood API Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}