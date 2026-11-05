const privateKey = process.env.GOOGLE_SERVICE_KEY;

export default async function handler(req, res) {


  
  var ee = require('@google/earthengine');
  var generateMap = () => {

    var landsat = ee.ImageCollection('MODIS/006/MOD13A1').select('NDVI');

    // Define a region of interest (ROI)
    // 12, 120.036546
    var roi = ee.Geometry.Polygon(
      [[
        [127.94248139921513, 5.33459854167601],
        [126.74931782819613, 11.825234466620996],
        [124.51107186428203, 17.961503806746318],
        [121.42999903167879, 19.993626604011016],
        [118.25656974884657, 18.2117821750514],
        [116.27168958893185, 6.817365082528201],
        [122.50121143769957, 3.79887124351577],
        [127.94248139921513, 5.33459854167601]
      ]], null, false);
    // Define a time range
    var startDate = '2018-01-01';
    var endDate = '2018-05-01';

    // Filter the image collection based on the ROI and time range
    var filteredCollection = landsat
      .filterBounds(roi)
      .filterDate(startDate, endDate);


    // Get the median NDVI image
    var ndviMedian = filteredCollection.median();

    var clippedImage = ndviMedian.clip(roi);

    // Define visualization parameters
    var visParams = {
      min: 0,
      max: 9000,

      palette: [
        'ffffff', 'ce7e45', 'df923d', 'f1b555', 'fcd163', '99b718', '74a901',
        '66a000', '529400', '3e8601', '207401', '056201', '004c00', '023b01',
        '012e01', '011d01', '011301'
      ]
    };

    var mapUrl = clippedImage.getMap(visParams);
    res.statusCode = 200;
    res.end(JSON.stringify(mapUrl));


  }


  ee.data.authenticateViaPrivateKey(key, generateMap, function (error) {
    console.error('Error authenticating with Earth Engine: ' + error);
    res.status(500).send('Internal Server Error');
  });

}