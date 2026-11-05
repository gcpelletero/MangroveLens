const { ee, initEE } = require('../../lib/earthEngine');

const evaluateAsync = (earthEngineObject) =>
  new Promise((resolve, reject) => {
    earthEngineObject.evaluate((value, error) => {
      if (error) {
        reject(new Error(String(error)));
        return;
      }

      resolve(value);
    });
  });

export default async function handler(req, res) {
  try {
    await initEE();

    const answer = await evaluateAsync(
      ee.Number(1).add(2)
    );

    return res.status(200).json({
      success: true,
      message: 'Earth Engine connection is working.',
      answer
    });
  } catch (error) {
    console.error('Earth Engine test error:', error);

    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}