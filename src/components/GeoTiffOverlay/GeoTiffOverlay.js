import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import parseGeoraster from 'georaster';
import GeoRasterLayer from 'georaster-layer-for-leaflet';

export default function GeoTiffOverlay({
  url,
  opacity = 0.75,
  pixelValuesToColorFn = null,
  onLoadingChange = null
}) {
  const map = useMap();

  /*
   * Store these props in refs so changing the loading state
   * does not restart the entire raster-loading effect.
   */
  const loadingCallbackRef = useRef(onLoadingChange);
  const colorFunctionRef = useRef(pixelValuesToColorFn);

  useEffect(() => {
    loadingCallbackRef.current = onLoadingChange;
  }, [onLoadingChange]);

  useEffect(() => {
    colorFunctionRef.current = pixelValuesToColorFn;
  }, [pixelValuesToColorFn]);

  useEffect(() => {
    let layer = null;
    let cancelled = false;

    async function loadRaster() {
      loadingCallbackRef.current?.(true);

      try {
        console.log('Fetching raster from:', url);

        const response = await fetch(url);

        console.log(
          'Fetch response:',
          response.status,
          response.ok
        );

        if (!response.ok) {
          throw new Error(
            `Unable to fetch raster: ${response.status}`
          );
        }

        const arrayBuffer = await response.arrayBuffer();
        const georaster = await parseGeoraster(arrayBuffer);

        if (cancelled) return;

        console.log('GeoTIFF loaded successfully');

        layer = new GeoRasterLayer({
          georaster,
          opacity,
          resolution: 64,
          pixelValuesToColorFn: colorFunctionRef.current
        });

        layer.addTo(map);

        const rasterBounds = layer.getBounds();

        if (rasterBounds?.isValid?.()) {
          map.fitBounds(rasterBounds);
        }

        console.log('Raster added to map');
      } catch (error) {
        if (!cancelled) {
          console.error('GeoTIFF overlay error:', error);
        }
      } finally {
        if (!cancelled) {
          loadingCallbackRef.current?.(false);
        }
      }
    }

    loadRaster();

    return () => {
      cancelled = true;

      if (layer && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }

      loadingCallbackRef.current?.(false);
    };
  }, [map, url, opacity]);

  return null;
}