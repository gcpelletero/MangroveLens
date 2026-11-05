const fs = require('fs');
const path = require('path');
const ee = require('@google/earthengine');

let initializationPromise = null;

const loadPrivateKey = () => {
  const keyPath = path.join(
    process.cwd(),
    'secrets',
    'gee-key.json'
  );

  if (!fs.existsSync(keyPath)) {
    throw new Error(
      'Earth Engine key was not found at secrets/gee-key.json'
    );
  }

  const keyContents = fs.readFileSync(keyPath, 'utf8');

  return JSON.parse(keyContents);
};

const initEE = () => {
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = new Promise((resolve, reject) => {
    const projectId = process.env.GEE_PROJECT_ID;

    if (!projectId) {
      reject(
        new Error('GEE_PROJECT_ID is missing from .env.local')
      );
      return;
    }

    let privateKey;

    try {
      privateKey = loadPrivateKey();
    } catch (error) {
      reject(error);
      return;
    }

    const initialize = () => {
      ee.initialize(
        null,
        null,
        () => {
          console.log('Google Earth Engine initialized');
          resolve();
        },
        (error) => {
          reject(
            new Error(
              `Earth Engine initialization failed: ${String(error)}`
            )
          );
        },
        null,
        projectId
      );
    };

    ee.data.authenticateViaPrivateKey(
      privateKey,
      initialize,
      (error) => {
        reject(
          new Error(
            `Earth Engine authentication failed: ${String(error)}`
          )
        );
      }
    );
  }).catch((error) => {
    // Allow another initialization attempt after an error.
    initializationPromise = null;
    throw error;
  });

  return initializationPromise;
};

module.exports = {
  ee,
  initEE
};