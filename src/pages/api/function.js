const ee = require('@google/earthengine');

// Utility function to validate date format
const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && dateString.match(/^\d{4}-\d{2}-\d{2}$/);
};

// Utility function to get date range boundaries
const getDateBoundaries = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Ensure end date is after start date
  if (end <= start) {
    throw new Error('End date must be after start date');
  }

  // Check if date range is reasonable (not more than 10 years)
  const diffYears = (end - start) / (1000 * 60 * 60 * 24 * 365);
  if (diffYears > 10) {
    throw new Error('Date range cannot exceed 10 years');
  }

  return { start, end };
};

// Utility function to evaluate Earth Engine objects asynchronously
const evaluateEE = (eeObject) => {
  return new Promise((resolve, reject) => {
    eeObject.evaluate((result, error) => {
      if (error) {
        reject(new Error(`Earth Engine evaluation failed: ${error}`));
      } else {
        resolve(result);
      }
    });
  });
};

// Utility function to calculate appropriate zoom level based on geometry bounds
const calculateZoomLevel = async (geometry) => {
  try {
    // Get the bounding box of the geometry with error margin
    const bounds = await evaluateEE(geometry.bounds(1));

    // Extract coordinates from bounds
    const coords = bounds.coordinates[0];
    const minLon = Math.min(...coords.map(c => c[0]));
    const maxLon = Math.max(...coords.map(c => c[0]));
    const minLat = Math.min(...coords.map(c => c[1]));
    const maxLat = Math.max(...coords.map(c => c[1]));

    // Calculate the span in degrees
    const latSpan = maxLat - minLat;
    const lonSpan = maxLon - minLon;
    const maxSpan = Math.max(latSpan, lonSpan);

    // Calculate zoom level based on span
    // This is an approximation for web mapping zoom levels
    let zoom;
    if (maxSpan >= 10) zoom = 5;        // Country/large region level
    else if (maxSpan >= 5) zoom = 6;    // Large province level
    else if (maxSpan >= 2) zoom = 7;    // Province level
    else if (maxSpan >= 1) zoom = 8;    // Large city level
    else if (maxSpan >= 0.5) zoom = 9;  // City level
    else if (maxSpan >= 0.2) zoom = 10; // Municipality level
    else if (maxSpan >= 0.1) zoom = 11; // Town level
    else if (maxSpan >= 0.05) zoom = 12; // District level
    else zoom = 13;                     // Neighborhood level

    return zoom;
  } catch (error) {
    console.warn('Error calculating zoom level:', error);
    return 8; // Default zoom level
  }
};

// Utility function to get geometry center and bounds info
const getGeometryInfo = async (geometry) => {
  try {
    // Get the centroid of the geometry with error margin
    const centroid = await evaluateEE(geometry.centroid(1).coordinates());

    // Get the bounding box with error margin
    const bounds = await evaluateEE(geometry.bounds(1));
    const coords = bounds.coordinates[0];

    // Calculate bounds
    const minLon = Math.min(...coords.map(c => c[0]));
    const maxLon = Math.max(...coords.map(c => c[0]));
    const minLat = Math.min(...coords.map(c => c[1]));
    const maxLat = Math.max(...coords.map(c => c[1]));

    // Calculate zoom level
    const zoom = await calculateZoomLevel(geometry);

    return {
      center: {
        longitude: centroid[0],
        latitude: centroid[1]
      },
      bounds: {
        north: maxLat,
        south: minLat,
        east: maxLon,
        west: minLon
      },
      zoom: zoom
    };
  } catch (error) {
    console.warn('Error getting geometry info, trying with larger error margin:', error.message);

    // Try with larger error margin if the first attempt fails
    try {
      const centroid = await evaluateEE(geometry.centroid(10).coordinates());
      const bounds = await evaluateEE(geometry.bounds(10));
      const coords = bounds.coordinates[0];

      const minLon = Math.min(...coords.map(c => c[0]));
      const maxLon = Math.max(...coords.map(c => c[0]));
      const minLat = Math.min(...coords.map(c => c[1]));
      const maxLat = Math.max(...coords.map(c => c[1]));

      const zoom = await calculateZoomLevel(geometry);

      return {
        center: {
          longitude: centroid[0],
          latitude: centroid[1]
        },
        bounds: {
          north: maxLat,
          south: minLat,
          east: maxLon,
          west: minLon
        },
        zoom: zoom
      };
    } catch (secondError) {
      console.warn('Second attempt failed, using fallback method:', secondError.message);

      // Final fallback: use bounds center instead of centroid
      try {
        const bounds = await evaluateEE(geometry.bounds(100));
        const coords = bounds.coordinates[0];

        const minLon = Math.min(...coords.map(c => c[0]));
        const maxLon = Math.max(...coords.map(c => c[0]));
        const minLat = Math.min(...coords.map(c => c[1]));
        const maxLat = Math.max(...coords.map(c => c[1]));

        // Calculate center from bounds
        const centerLon = (minLon + maxLon) / 2;
        const centerLat = (minLat + maxLat) / 2;

        // Calculate zoom from span
        const latSpan = maxLat - minLat;
        const lonSpan = maxLon - minLon;
        const maxSpan = Math.max(latSpan, lonSpan);

        let zoom;
        if (maxSpan >= 10) zoom = 5;
        else if (maxSpan >= 5) zoom = 6;
        else if (maxSpan >= 2) zoom = 7;
        else if (maxSpan >= 1) zoom = 8;
        else if (maxSpan >= 0.5) zoom = 9;
        else if (maxSpan >= 0.2) zoom = 10;
        else if (maxSpan >= 0.1) zoom = 11;
        else if (maxSpan >= 0.05) zoom = 12;
        else zoom = 13;

        return {
          center: {
            longitude: centerLon,
            latitude: centerLat
          },
          bounds: {
            north: maxLat,
            south: minLat,
            east: maxLon,
            west: minLon
          },
          zoom: zoom
        };
      } catch (finalError) {
        console.warn('All geometry info attempts failed, using Philippines default:', finalError.message);
        // Default to Philippines center if all attempts fail
        return {
          center: {
            longitude: 121.7740,
            latitude: 12.8797
          },
          bounds: {
            north: 21.0,
            south: 4.5,
            east: 127.0,
            west: 116.0
          },
          zoom: 6
        };
      }
    }
  }
};

// Function to get the geometry of a specific administrative unit
const getAdminGeometry = async (region, province, municipality) => {
  try {
    console.log('getAdminGeometry called with:', { region, province, municipality });

    // If no parameters are provided, default to the entire Philippines
    if (!region && !province && !municipality) {
      console.log('No admin parameters provided, using Philippines boundary');
      const philippines = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017')
        .filter(ee.Filter.eq('country_na', 'Philippines'))
        .first()
        .geometry();
      return philippines;
    }

    let phBoundaries;
    let filters = [];

    // Determine which administrative level to use based on the most specific parameter provided
    if (municipality) {
      console.log('Using municipality level (admin3)');
      phBoundaries = ee.FeatureCollection('projects/decoded-academy-219803/assets/ph_admin3');
      filters.push(ee.Filter.eq('ADM3_PCODE', municipality));
      
      // Include parent filters if provided
      if (province) filters.push(ee.Filter.eq('ADM2_PCODE', province));
      if (region) filters.push(ee.Filter.eq('ADM1_PCODE', region));
      
    } else if (province) {
      console.log('Using province level (admin2)');
      phBoundaries = ee.FeatureCollection('projects/decoded-academy-219803/assets/ph_admin2');
      filters.push(ee.Filter.eq('ADM2_PCODE', province));
      
      // Include parent filter if provided
      if (region) filters.push(ee.Filter.eq('ADM1_PCODE', region));
      
    } else if (region) {
      console.log('Using region level (admin1)');
      phBoundaries = ee.FeatureCollection('projects/decoded-academy-219803/assets/ph_admin1');
      filters.push(ee.Filter.eq('ADM1_PCODE', region));
    }

    if (filters.length === 0) {
      console.log('No valid filters created, using Philippines boundary');
      const philippines = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017')
        .filter(ee.Filter.eq('country_na', 'Philippines'))
        .first()
        .geometry();
      return philippines;
    }

    // Combine all filters
    let combinedFilter = filters.length > 1 ?
      ee.Filter.and(...filters) :
      filters[0];

    console.log('Applying filters to collection...');
    const filteredCollection = phBoundaries.filter(combinedFilter);

    // Check if the collection has any features
    const collectionSize = await evaluateEE(filteredCollection.size());
    console.log(`Filtered collection size: ${collectionSize}`);

    if (collectionSize === 0) {
      console.log('No features found with current filters, falling back to Philippines boundary');
      const philippines = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017')
        .filter(ee.Filter.eq('country_na', 'Philippines'))
        .first()
        .geometry();
      return philippines;
    }

    // Get the geometry from the first (and likely only) feature
    const geometry = filteredCollection.first().geometry();
    console.log('Successfully retrieved geometry');
    
    return geometry;

  } catch (error) {
    console.error('Error in getAdminGeometry:', error);

    // Always fallback to Philippines boundary in case of any error
    console.log('Falling back to Philippines boundary due to error');
    const philippines = ee.FeatureCollection('USDOS/LSIB_SIMPLE/2017')
      .filter(ee.Filter.eq('country_na', 'Philippines'))
      .first()
      .geometry();

    return philippines;
  }
};

// Earth Engine initialization function
const initializeEE = (privateKey) => {
  return new Promise((resolve, reject) => {
    console.log('Authenticating with Earth Engine...');

    // Authenticate using the private key
    ee.data.authenticateViaPrivateKey(
      privateKey,
      () => {
        console.log('Authentication succeeded!');
        // Initialize Earth Engine after successful authentication
        ee.initialize(
          null,
          null,
          () => {
            console.log('Earth Engine client library initialized.');
            resolve();
          },
          (err) => {
            console.error('Failed to initialize Earth Engine:', err);
            reject(err);
          }
        );
      },
      (err) => {
        console.error('Authentication failed:', err);
        reject(err);
      }
    );
  });
};

module.exports = {
  isValidDate,
  getDateBoundaries,
  evaluateEE,
  calculateZoomLevel,
  getGeometryInfo,
  getAdminGeometry,
  initializeEE
};