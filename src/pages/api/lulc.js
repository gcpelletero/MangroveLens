import * as ee from '@google/earthengine';

import {
    evaluateEE,
    getAdminGeometry,
    getDateBoundaries,
    getGeometryInfo,
    initializeEE,
    isValidDate
} from './function';

// Check for environment variable outside the handler to fail fast on cold starts
  if (!process.env.GOOGLE_SERVICE_KEY) {
    throw new Error('GOOGLE_SERVICE_KEY environment variable is not set');
  }

  const privateKey = JSON.parse(process.env.GOOGLE_SERVICE_KEY);
  let isInitialized = false;

  /**
   * Wrapper for Earth Engine initialization
   */
  const initEE = async () => {
    if (isInitialized) return;
    await initializeEE(privateKey);
    isInitialized = true;
  };

  export default async function handler(req, res) {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
      const { startDate, endDate, region, province, municipality } = req.query;

      // 1. Handle Dates
      const defaultEndDate = new Date().toISOString().split('T')[0];
      const defaultStartDate = new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const finalStartDate = startDate || defaultStartDate;
      const finalEndDate = endDate || defaultEndDate;

      if (!isValidDate(finalStartDate) || !isValidDate(finalEndDate)) {
        return res.status(400).json({ success: false, error: 'Invalid date format. Use YYYY-MM-DD.' });
      }

      // Validate range logic
      getDateBoundaries(finalStartDate, finalEndDate);

      // 2. Initialize GEE
      await initEE();

      // 3. Define Visualization
      const colors = [
        "#1A5BAB", "#358221", "#87D19E", "#FFDB5C", "#ED022A", 
        "#EDE9E4", "#F2FAFF", "#C8C8C8", "#C6AD8D"
      ];

      // 4. Get ROI (Region of Interest)
      const roi = await getAdminGeometry(region, province, municipality);
      if (!roi) {
        throw new Error('Could not create valid geometry for the specified region');
      }

      // 5. Process LULC Collection
      // Using ESRI Global LULC 10m TS
      const lulcCollection = ee.ImageCollection('projects/sat-io/open-datasets/landcover/ESRI_Global-LULC_10m_TS')
        .filterDate(finalStartDate, finalEndDate)
        .filterBounds(roi);

      const collectionSize = await evaluateEE(lulcCollection.size());

      console.log(collectionSize);


      if (collectionSize === 0) {
        return res.status(404).json({
          success: false,
          error: 'No data found for this range/region.',
          metadata: { startDate: finalStartDate, endDate: finalEndDate }
        });
      }

      // Mosaic and Remap classes to 1-9 for consistent visualization
      const lulcImage = lulcCollection
        .mosaic()
        .remap([1, 2, 4, 5, 7, 8, 9, 10, 11], [1, 2, 3, 4, 5, 6, 7, 8, 9])
        .clip(roi);

      // 6. Generate Map Assets
      // Note: getMap returns an object containing the urlFormat
      const mapDetails = await new Promise((resolve, reject) => {
        lulcImage.getMap({ min: 1, max: 9, palette: colors }, (map, err) => {
          if (err) reject(err);
          else resolve(map);
        });
      });

      const geometryInfo = await getGeometryInfo(roi);

      // 7. Success Response
      res.status(200).json({
        success: true,
        mapUrl: mapDetails.urlFormat, // The actual tile URL template
        mapId: mapDetails.mapid,
        center: geometryInfo.center,
        bounds: geometryInfo.bounds,
        zoom: geometryInfo.zoom,
        metadata: {
          startDate: finalStartDate,
          endDate: finalEndDate,
          region: region || 'Philippines',
          dataset: 'ESRI Global Land Use Land Cover',
          collectionSize,
          classes: {
            1: 'Water', 2: 'Trees', 3: 'Flooded Vegetation', 
            4: 'Crops', 5: 'Built Area', 6: 'Bare Ground', 
            7: 'Snow/Ice', 8: 'Clouds', 9: 'Rangeland'
          }
        }
      });

    } catch (error) {
      console.error('LULC API Error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }