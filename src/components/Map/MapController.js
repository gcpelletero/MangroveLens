import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

const REGION_BOUNDS = {
  'PH01': [[16.2, 119.7], [18.7, 121.0]],   // Region I - Ilocos
  'PH02': [[15.8, 121.0], [18.7, 122.7]],   // Region II - Cagayan Valley
  'PH03': [[14.4, 119.9], [16.0, 121.5]],   // Region III - Central Luzon
  'PH04': [[13.4, 120.6], [14.9, 122.1]],   // Region IV-A - CALABARZON
  'PH17': [[8.3,  117.0], [13.6, 122.7]],   // MIMAROPA
  'PH05': [[11.9, 122.4], [14.2, 124.6]],   // Region V - Bicol
  'PH06': [[9.8,  121.0], [11.9, 123.0]],   // Region VI - Western Visayas
  'PH07': [[9.0,  123.1], [11.4, 124.5]],   // Region VII - Central Visayas
  'PH08': [[9.8,  124.0], [12.6, 125.6]],   // Region VIII - Eastern Visayas
  'PH09': [[6.6,  121.5], [9.1,  123.8]],   // Region IX - Zamboanga Peninsula
  'PH10': [[7.5,  123.2], [9.2,  125.7]],   // Region X - Northern Mindanao
  'PH11': [[5.9,  125.0], [8.3,  126.7]],   // Region XI - Davao
  'PH12': [[5.9,  124.0], [7.5,  125.5]],   // Region XII - SOCCSKSARGEN
  'PH13': [[14.3, 120.9], [14.8, 121.2]],   // NCR
  'PH14': [[16.3, 120.3], [18.5, 121.7]],   // CAR
  'PH15': [[4.6,  119.0], [8.4,  124.0]],   // BARMM
  'PH16': [[7.6,  125.1], [10.2, 126.7]],   // Region XIII - Caraga
};

// Default Philippines view
const DEFAULT_CENTER = [12.0, 122.5];
const DEFAULT_ZOOM = 6;

const MapController = ({ center, zoom, selectedRegion }) => {
  const map = useMap();

  console.log('MapController received selectedRegion:', selectedRegion);
  console.log('REGION_BOUNDS has key:', REGION_BOUNDS[selectedRegion]);
  console.log(selectedRegion); // inside the useEffect for selectedRegion
  // console.log('Regions sample:', regions[0]);

  // Fly to region bounds when region changes
  useEffect(() => {
    if (!map) return;

    if (selectedRegion && REGION_BOUNDS[selectedRegion]) {
      map.flyToBounds(REGION_BOUNDS[selectedRegion], {
        padding: [40, 40],
        duration: 1.2,
      });
    } else if (!selectedRegion) {
      map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 1.2 });
    }
  }, [map, selectedRegion]);

  // Handle manual center/zoom prop changes (existing behavior)
  useEffect(() => {
    if (map && center && zoom && !selectedRegion) {
      map.setView(center, zoom);
    }
  }, [map, center, zoom]);

  return null;
};

export default MapController;