import { useEffect, useState } from 'react';

import ControlPanel from '@components/ControlPanel';
import Layout from '@components/Layout';
import Map from '@components/Map';
import TimeDimensionController from '@components/TimeDimensionController';
// import axios from 'axios';
import municipalitiesData from './locdata/table_municipality.json';
import provincesData from './locdata/table_province.json';
import regionsData from './locdata/table_region.json';
import styles from '@styles/Home.module.scss';
import dynamic from 'next/dynamic';
import LegendPanel from '@components/LegendPanel';
import AnnualNdviGraph from '@components/AnnualNdviGraph/AnnualNdviGraph';


// The first view is a real map of the Philippines, with no Earth Engine tiles yet.
const DEFAULT_CENTER = [12.0, 122.5];
const DEFAULT_ZOOM = 6;

// Once a mangrove layer is loaded, focus on the Palawan pilot area.
const PALAWAN_CENTER = [11.02, 119.48];
const PALAWAN_ZOOM = 11;
const MAX_BOUNDS = [
  [21.063944194047764, 134.95605468750003],
  [2.9349970669152285, 105.38085937500001],
];
const DECLINE_IMAGE_BOUNDS = [
  [10.88, 119.38], // south-west
  [11.08, 119.58]  // north-east
];

const GeoTiffOverlay = dynamic(
  () => import('@components/GeoTiffOverlay/GeoTiffOverlay'),
  { ssr: false }
);

export default function Home() {
  const [mapUrl, setMapUrl] = useState('');

  /*
  * Optional mangrove-reference overlay.
  */
  const [
    showReferenceOutline,
    setShowReferenceOutline
  ] = useState(false);

  const [
    referenceSource,
    setReferenceSource
  ] = useState('gmw')

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [bounds, setBounds] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);

  // Date range for analysis
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('2024-12-31');

  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [hasAppliedStudyPeriod, setHasAppliedStudyPeriod] = useState(false);


  const [isUpdating, setIsUpdating] = useState(false);
  const [isRasterLoading, setIsRasterLoading] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState('mvi');

  // Control panel visibility
  const [isPanelVisible, setIsPanelVisible] = useState(true);

  // Legend panel visibility
  const [isLegendVisible, setIsLegendVisible] = useState(false);

  // NDVI Graph panel visibility
  const [isGraphVisible, setIsGraphVisible] = useState(false);

  // Time dimension controller visibility
  const [isTimeControllerVisible, setIsTimeControllerVisible] = useState(false);

  // Time series data
  const [timeSeriesData, setTimeSeriesData] = useState([]);
  const [timeSeriesMaps, setTimeSeriesMaps] = useState([]);
  const [calendarDayAverages, setCalendarDayAverages] = useState([]);
  const [timeSeriesMetadata, setTimeSeriesMetadata] = useState(null);

  // Current selected date for time series
  const [selectedDate, setSelectedDate] = useState(null);
  const [currentTimeSeriesUrl, setCurrentTimeSeriesUrl] = useState('');

  // Location selection state
  const [selectedRegion, setSelectedRegion] = useState('PH17');
  const [selectedProvince, setSelectedProvince] = useState('PH17053');
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [regions] = useState(regionsData);
  const [provinces, setProvinces] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);

  // Animation state
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [showProjectInfo, setShowProjectInfo] = useState(false);


useEffect(() => {
  if (selectedRegion) {
    // Let MapController handle the zoom via flyToBounds
    // Don't override with setCenter/setZoom here
    setBounds(null);
  }
}, [selectedRegion]);

useEffect(() => {
  if (!mapInstance) return;

  const resizeTimer = setTimeout(() => {
    mapInstance.invalidateSize();
  }, 350);

  return () => clearTimeout(resizeTimer);
}, [isPanelVisible, mapInstance]);


  useEffect(() => {
    if (selectedRegion) {
      console.log(selectedRegion);
      const filteredProvinces = provincesData.filter(
        (prov) => prov.ADM1_PCODE === (selectedRegion)
      );
      setProvinces(filteredProvinces);
    } else {
      setProvinces([]);
    }
    setSelectedMunicipality(null);
  }, [selectedRegion]);

  useEffect(() => {
    if (selectedProvince) {
      const filteredMunicipalities = municipalitiesData.filter(
        (munc) => munc.ADM2_PCODE === (selectedProvince)
      );
      setMunicipalities(filteredMunicipalities);
    } else {
      setMunicipalities([]);
    }
    setSelectedMunicipality(null);
  }, [selectedProvince]);

  // Show panels based on selected layer
useEffect(() => {
  if (selectedLayer === 'ndvi') {
    setIsLegendVisible(false);
    setIsGraphVisible(false);
    setIsTimeControllerVisible(false);
    setShowModal(false);
  } else if (selectedLayer === 'decline') {
    setIsLegendVisible(false);
    setIsGraphVisible(false);
    setIsTimeControllerVisible(false);
    setShowModal(false);
    setTimeSeriesData([]);
    setTimeSeriesMaps([]);
    setCalendarDayAverages([]);
    setSelectedDate(null);
  } else {
    setIsLegendVisible(false);
    setIsGraphVisible(false);
    setIsTimeControllerVisible(false);
    setTimeSeriesData([]);
    setTimeSeriesMaps([]);
    setCalendarDayAverages([]);
    setSelectedDate(null);
  }
}, [selectedLayer]);

  // Function to update map view when bounds/center/zoom changes
  useEffect(() => {
    if (mapInstance && bounds) {
      try {
        const leafletBounds = [
          [bounds.south, bounds.west],
          [bounds.north, bounds.east]
        ];
        mapInstance.fitBounds(leafletBounds, {
          padding: [20, 20],
          maxZoom: 15
        });
      } catch (e) {
        console.warn('Error fitting bounds, using center/zoom fallback:', e);
        mapInstance.setView([center[0], center[1]], zoom);
      }
    } else if (mapInstance && center && zoom) {
      console.log('Updating map view with center/zoom:', center, zoom);
      mapInstance.setView([center[0], center[1]], zoom);
    }
  }, [mapInstance, bounds, center, zoom]);

  // Update map URL when time series date changes
  useEffect(() => {
    if (selectedDate && timeSeriesMaps.length > 0) {
      const selectedMap = timeSeriesMaps.find(map => map.date === selectedDate);
      if (selectedMap) {
        setCurrentTimeSeriesUrl(selectedMap.url);
      }
    } else {
      setCurrentTimeSeriesUrl('');
    }
  }, [selectedDate, timeSeriesMaps]);

const fetchMapData = async (
  start = startDate,
  end = endDate,
  layerType = selectedLayer
) => {
  if (!layerType) {
    setLoading(false);
    return;
  }

  try {
    setLoading(true);
    setIsUpdating(true);
    setError(null);

    /*
    * Keep the currently loaded Earth Engine layer
    * visible while a replacement is being prepared.
    */
    setCurrentTimeSeriesUrl('');

    if (layerType === 'ndvi') {
      const selectedYear = getYear(end);

      if (!selectedYear) {
        throw new Error(
          'Please select a current year.'
        );
      }

      if (
        selectedRegion !== 'PH17' ||
        selectedProvince !== 'PH17053'
      ) {
        throw new Error(
          'The Earth Engine NDVI prototype is currently available for Palawan only.'
        );
      }


      const response = await fetch(
        `/api/ndvi?year=${encodeURIComponent(
          selectedYear
        )}`,
        {
          cache: 'no-store'
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.error ||
          'Earth Engine could not generate the NDVI map.'
        );
      }

      console.log(
        'Earth Engine NDVI result:',
        result
      );

      setMapUrl(result.mapUrl);
      setIsLegendVisible(true);

      setTimeSeriesMetadata(
        result.metadata || null
      );

      setCenter(PALAWAN_CENTER);
      setZoom(PALAWAN_ZOOM);
      setBounds(null);
    }

if (layerType === 'decline') {
  const historicalYear = getYear(start);
  const currentYear = getYear(end);

  if (!historicalYear || !currentYear) {
    throw new Error(
      'Please select both a historical year and a current year.'
    );
  }

  if (historicalYear >= currentYear) {
    throw new Error(
      'Historical year must be earlier than current year.'
    );
  }

  if (
    selectedRegion !== 'PH17' ||
    selectedProvince !== 'PH17053'
  ) {
    throw new Error(
      'The mangrove change prototype is currently available for Palawan only.'
    );
  }

  /*
   * Remove the previously displayed map while
   * Earth Engine prepares the new change layer.
   */
  setMapUrl('');

  const response = await fetch(
    `/api/mangrove-change?historicalYear=${encodeURIComponent(
      historicalYear
    )}&currentYear=${encodeURIComponent(
      currentYear
    )}`,
    {
      cache: 'no-store'
    }
  );

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      result.error ||
      'Earth Engine could not generate the mangrove candidate change map.'
    );
  }

  console.log(
    'Earth Engine mangrove candidate change result:',
    result
  );

  setMapUrl(result.mapUrl);

  setTimeSeriesMetadata(
    result.metadata || null
  );

  /*
   * We will use this to show the
   * green-red-blue change legend.
   */
  setIsLegendVisible(true);

  setCenter(PALAWAN_CENTER);
  setZoom(PALAWAN_ZOOM);
  setBounds(null);
}

if (layerType === 'mvi') {
  /*
   * The selected current/end year controls
   * which annual MVI candidate map is displayed.
   */
  const selectedYear = getYear(end);

  if (!selectedYear) {
    throw new Error(
      'Please select a current year for the MVI candidate map.'
    );
  }

  if (
    selectedRegion !== 'PH17' ||
    selectedProvince !== 'PH17053'
  ) {
    throw new Error(
      'The MVI candidate prototype is currently available for Palawan only.'
    );
  }

  /*
   * Temporary threshold for visual comparison.
   *
   * Change this value between:
   * 3.5 and 4
   */
  // const testThreshold = 3.5;
  // const minPatchPixels = 5;

  // const maxWaterDistanceMeters = 1000;
  // const minWaterOccurrencePercent = 10;

  // /*
  //  * Remove any previous raw MVI map before
  //  * requesting the candidate classification.
  //  */
  // setMapUrl('');

  // const response = await fetch(
  //   `/api/mvi-candidate?year=${encodeURIComponent(
  //     selectedYear
  //   )}&threshold=${encodeURIComponent(
  //     testThreshold
  //   )}&minPatchPixels=${encodeURIComponent(
  //     minPatchPixels
  //   )}&maxWaterDistanceMeters=${encodeURIComponent(
  //     maxWaterDistanceMeters
  //   )}&minWaterOccurrencePercent=${encodeURIComponent(
  //     minWaterOccurrencePercent
  //   )}`,
  //   {
  //     cache: 'no-store'
  //   }
  // );

  /*
  * Remove the previous map before requesting
  * the clean annual mangrove candidate layer.
  */
  // setMapUrl('');

const referenceParameter =
  showReferenceOutline
    ? referenceSource
    : 'none';

const response = await fetch(
  `/api/mangrove-year?year=${encodeURIComponent(
    selectedYear
  )}&reference=${encodeURIComponent(
    referenceParameter
  )}`
);

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      result.error ||
      'Earth Engine could not generate the annual mangrove candidate map.'
    );
  }

  console.log(
    'Earth Engine annual mangrove result:',
    result
  );

  setMapUrl(result.mapUrl);

  setTimeSeriesMetadata(
    result.metadata || null
  );

  /*
   * No separate legend panel yet.
   * The temporary candidate colors are described
   * in the map information box.
   */
  setIsLegendVisible(false);

  setCenter(PALAWAN_CENTER);
  setZoom(PALAWAN_ZOOM);
  setBounds(null);
}

  } catch (error) {
    console.error(
      'Map update error:',
      error
    );

    /*
     * Keep the last successful map visible
     * when the new request fails.
     */
    setIsLegendVisible(false);

    setError(
      error.message ||
      'Something went wrong while updating the map.'
    );
  } finally {
    /*
     * Always stop the loading indicators,
     * whether the request succeeds or fails.
     */
    setLoading(false);
    setIsUpdating(false);
  }
};

const handleLayerChange = (layerType) => {
  setSelectedLayer(layerType);
  setMapUrl('');
  setCurrentTimeSeriesUrl('');
  setError(null);

  setCenter(DEFAULT_CENTER);
  setZoom(DEFAULT_ZOOM);
  setBounds(null);

  setTimeSeriesData([]);
  setTimeSeriesMaps([]);
  setCalendarDayAverages([]);
  setSelectedDate(null);

  setHasAppliedStudyPeriod(false);
  setAppliedStartDate('');
  setAppliedEndDate('');

  /*
   * MVI represents one annual mangrove extent,
   * so it only needs one selected year.
   *
   * Only the prepared 2024 asset is currently
   * available.
   */
  if (layerType === 'mvi') {
    setStartDate('');
    setEndDate('2024');
  }

  if (layerType) {
    setShowModal(false);
  }
};

  const handleRegionChange = (regionId) => {
    setSelectedRegion(regionId || null);
    setSelectedProvince(null);
    setSelectedMunicipality(null);

    setHasAppliedStudyPeriod(false);
    setAppliedStartDate('');
    setAppliedEndDate('');
  };

  const handleProvinceChange = (provinceId) => {
    setSelectedProvince(provinceId || null);
    setSelectedMunicipality(null);

    setHasAppliedStudyPeriod(false);
    setAppliedStartDate('');
    setAppliedEndDate('');
  };

  const handleMunicipalityChange = (municipalityId) => {
    setSelectedMunicipality(municipalityId || null);
  };

  const handleDateChange = ({ startDate: newStartDate, endDate: newEndDate }) => {
    setMapUrl('');
    setTimeSeriesMetadata(null);
    setStartDate(newStartDate);
    setEndDate(newEndDate);

    // Hide the current raster until the user clicks Apply Changes again
    setHasAppliedStudyPeriod(false);
    setAppliedStartDate('');
    setAppliedEndDate('');
  };

const handleUpdateMap = (start, end) => {
  /*
   * MVI mode uses only one annual map year.
   */
  if (selectedLayer === 'mvi') {
    const selectedMviYear = getYear(end);

    if (!selectedMviYear) {
      setError(
        'Please select an MVI year.'
      );
      return;
    }

    setAppliedStartDate('');
    setAppliedEndDate(
      String(selectedMviYear)
    );

    setHasAppliedStudyPeriod(true);
    setIsLegendVisible(false);
    setError(null);

    fetchMapData(
      '',
      String(selectedMviYear),
      'mvi'
    );

    return;
  }

  /*
   * NDVI comparison and decline/change mode
   * continue using historical and current years.
   */
  const startYear = getYear(start);
  const endYear = getYear(end);

  if (!startYear || !endYear) {
    setError(
      'Please select a historical year and a current year.'
    );
    return;
  }

  if (startYear > endYear) {
    setError(
      'Historical year must be earlier than or equal to current year.'
    );
    return;
  }

  setAppliedStartDate(start);
  setAppliedEndDate(end);
  setHasAppliedStudyPeriod(true);
  setError(null);

  if (selectedLayer === 'ndvi') {
    setIsLegendVisible(true);
  } else {
    setIsLegendVisible(false);
  }

  fetchMapData(
    start,
    end,
    selectedLayer
  );
};

  const togglePanel = () => {
    setIsPanelVisible(!isPanelVisible);
  };

  const toggleLegend = () => {
    setIsLegendVisible(!isLegendVisible);
  };

  const toggleGraph = () => {
    setIsGraphVisible(!isGraphVisible);
  };

  const toggleTimeController = () => {
    setIsTimeControllerVisible(!isTimeControllerVisible);
  };

  const handleTimeSeriesDateChange = (date) => {
    setSelectedDate(date);
  };

  const handleAnimationPlayStateChange = (isPlaying) => {
    setIsAnimationPlaying(isPlaying);
  };

  const getYear = (dateValue) => {
    if (!dateValue) return null;
    return Number(String(dateValue).slice(0, 4));
  };

  const declineColorFn = (values) => {
    const value = values?.[0];

    if (value === null || value === undefined || isNaN(value)) return null;

    // Your decline raster is 1 = decline, 0 = no decline
    if (value >= 1) return 'rgba(255, 0, 0, 0.85)';

    // Hide non-decline areas
    return null;
  };

  const renderMapLayers = ({ TileLayer, ImageOverlay, Marker, Popup, map }) => {
    // Store map instance for programmatic control
    if (map && !mapInstance) {
      setMapInstance(map);
    }
    
    // Determine which URL to use for the tile layer
    const activeTileUrl = currentTimeSeriesUrl || mapUrl;

    const appliedStartYear = getYear(appliedStartDate);
    const appliedEndYear = getYear(appliedEndDate);

    const shouldShowDecline =
      selectedLayer === 'decline' &&
      selectedRegion === 'PH17' &&
      selectedProvince === 'PH17053' &&
      hasAppliedStudyPeriod &&
      appliedStartYear === 2019 &&
      appliedEndYear === 2024;

  const shouldShowNdvi =
    selectedLayer === 'ndvi' &&
    selectedRegion === 'PH17' &&
    selectedProvince === 'PH17053' &&
    hasAppliedStudyPeriod &&
    appliedEndYear >= 2019 &&
    appliedEndYear <= 2025;


    // console.log('selectedLayer:', selectedLayer);
    // console.log('selectedRegion:', selectedRegion);
    // console.log('selectedProvince:', selectedProvince);
    // console.log('startDate:', startDate);
    // console.log('endDate:', endDate);
    // console.log('appliedStartYear:', appliedStartYear);
    // console.log('appliedEndYear:', appliedEndYear);
    // console.log('hasAppliedStudyPeriod:', hasAppliedStudyPeriod);
    // console.log('shouldShowNdvi:', shouldShowNdvi);

    // console.log('shouldShowDecline:', shouldShowDecline);
    // console.log('appliedStartYear:', appliedStartYear);
    // console.log('appliedEndYear:', appliedEndYear);
    // console.log('hasAppliedStudyPeriod:', hasAppliedStudyPeriod);

    return (
      <>
        {/* Base Map Layer */}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />

        {/* Data Layer */}
        {activeTileUrl && (
          <TileLayer
            key={activeTileUrl}
            url={activeTileUrl}
            attribution="Google Earth Engine"
            opacity={1}

            /*
            * Wait for the user's pan or zoom movement
            * to finish before requesting the new tile set.
            */
            updateWhenIdle={true}
            updateWhenZooming={false}

            /*
            * Retain nearby tiles without requesting
            * an excessive four-tile buffer.
            */
            keepBuffer={1}

            /*
            * Prevent extra high-density tile requests.
            */
            detectRetina={false}

            /*
            * The stored asset has a 20-meter native grid.
            * Above zoom 13, enlarge the prepared tiles.
            */
            maxNativeZoom={13}
            maxZoom={18}
          />
        )}


        {/* {shouldShowNdvi && (
          <GeoTiffOverlay
            url="/data/palawan_mangrove_ndvi_2024_single.tif"
            opacity={1}
            pixelValuesToColorFn={ndviColorFn}
            onLoadingChange={setIsRasterLoading}
          />
        )} */}

        {/* {shouldShowDecline && (
          <GeoTiffOverlay
            url="/data/palawan_mangrove_decline_2019_2024_web.tif"
            opacity={1}
            pixelValuesToColorFn={declineColorFn}
            onLoadingChange={setIsRasterLoading}
          />
        )} */}

        {/* Decline Image Overlay */}
        {/* {selectedLayer === 'decline' && (
          <GeoTiffOverlay
            url="/data/palawan_mangrove_decline_2019_2024.tif"
            opacity={0.65}
            pixelValuesToColorFn={(values) => {
              const val = values?.[0];
              if (val === 1) return 'rgba(255, 0, 0, 0.7)';
              return null;
            }}
          />
        )} */}

        {/* Real GEE Output Preview */}
        {/* {selectedLayer === 'decline' && (
          <div
            style={{
              position: 'absolute',
              bottom: '20px',
              right: '20px',
              zIndex: 1000,
              background: 'rgba(255, 255, 255, 0.95)',
              padding: '12px',
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              width: '260px'
            }}
          >
            <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '8px', color: '#1f2937' }}>
              Decline Layer Preview
            </div>

            <img
              src="/assets/decline-map.png"
              alt="Vegetation Decline Map"
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                marginBottom: '8px'
              }}
            />

            <div style={{ fontSize: '12px', color: '#4b5563', lineHeight: '1.5' }}>
              Screenshot exported from the Google Earth Engine decline analysis for the selected pilot area.
            </div>
          </div>
        )} */}

        {/* Decline Map Overlay */}
        {/* {selectedLayer === 'decline' && (
          <img
            src="/assets/decline-map.png"
            alt="Decline Map Overlay"
            style={{
              position: 'absolute',
              top: '180px',
              left: '420px',
              width: '220px',
              height: '220px',
              objectFit: 'cover',
              opacity: 0.65,
              zIndex: 900,
              border: '2px solid rgba(255,255,255,0.7)',
              borderRadius: '4px',
              pointerEvents: 'none'
            }}
          />
        )} */}

        {/* Welcome Modal */}
        {!selectedLayer && !loading && showModal && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '24px 32px',
            borderRadius: '12px',
            zIndex: 1000,
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            textAlign: 'center',
            maxWidth: '300px'
          }}>
            <button
              onClick={() => { setShowModal(false); }}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'transparent',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#6c757d',
                lineHeight: '1',
                padding: '0'
              }}
            >
              &times;
            </button>
            <div style={{
              fontSize: '48px',
              marginBottom: '16px'
            }}>🛰️</div>
            <h3 style={{
              margin: '0 0 8px 0',
              fontSize: '18px',
              fontWeight: '600',
              color: '#343a40'
            }}>
              Welcome to MangroveLens
            </h3>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: '#6c757d',
              lineHeight: '1.4'
            }}>
              Select a mangrove layer to explore NDVI comparison and possible vegetation decline in your study area.
            </p>
          </div>
        )}

        {/* Flood View Selector */}
        {/*
        {selectedLayer === 'flood' && floodMaps.flooded && (
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'rgba(255, 255, 255, 0.95)',
            padding: '12px',
            borderRadius: '8px',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: '200px'
          }}>
            <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '10px', color: '#343a40' }}>
              Flood Analysis Views
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <button
                onClick={() => setSelectedFloodView('flooded')}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  background: selectedFloodView === 'flooded' ? '#0066cc' : 'white',
                  color: selectedFloodView === 'flooded' ? 'white' : '#495057',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: selectedFloodView === 'flooded' ? '600' : '400'
                }}
              >
                🌊 Flooded Areas
              </button>
              <button
                onClick={() => setSelectedFloodView('before')}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  background: selectedFloodView === 'before' ? '#0066cc' : 'white',
                  color: selectedFloodView === 'before' ? 'white' : '#495057',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: selectedFloodView === 'before' ? '600' : '400'
                }}
              >
                📡 Before Flood
              </button>
              <button
                onClick={() => setSelectedFloodView('after')}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  background: selectedFloodView === 'after' ? '#0066cc' : 'white',
                  color: selectedFloodView === 'after' ? 'white' : '#495057',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: selectedFloodView === 'after' ? '600' : '400'
                }}
              >
                📡 After Flood
              </button>
              <button
                onClick={() => setSelectedFloodView('difference')}
                style={{
                  padding: '6px 12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  background: selectedFloodView === 'difference' ? '#0066cc' : 'white',
                  color: selectedFloodView === 'difference' ? 'white' : '#495057',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: selectedFloodView === 'difference' ? '600' : '400'
                }}
              >
                🔄 Difference
              </button>
            </div>
            {floodStatistics && (
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #dee2e6' }}>
                <div style={{ fontSize: '13px', color: '#6c757d', marginBottom: '4px' }}>Flood Extent:</div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#dc3545' }}>
                  {floodStatistics.floodedAreaHa} ha
                </div>
                <div style={{ fontSize: '12px', color: '#6c757d' }}>
                  ({floodStatistics.floodedAreaKm2} km²)
                </div>
              </div>
            )}
          </div>
        )}
        */}

        {/* Time Controller for NDVI */}
        {selectedLayer === 'ndvi' && timeSeriesMaps.length > 0 && !isTimeControllerVisible && (
          <button
            onClick={toggleTimeController}
            style={{
              position: 'absolute',
              bottom: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1001,
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              padding: '10px 16px',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              fontSize: '14px',
              transition: 'all 0.3s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontWeight: '500',
              color: '#495057'
            }}
            title="Show Time Controls"
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 1)';
              e.target.style.transform = 'translateX(-50%) scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.95)';
              e.target.style.transform = 'translateX(-50%) scale(1)';
            }}
          >
            <span>⏯️</span>
            Time Controls ({timeSeriesMaps.length} maps)
          </button>
        )}

        {/* Legend Panel */}
          {shouldShowNdvi && (
            <LegendPanel
              selectedLayer="ndvi"
              isVisible={isLegendVisible}
              onToggle={toggleLegend}
            />
          )}


        {/* Annual NDVI Graph */}
        {shouldShowNdvi && appliedStartYear && appliedEndYear && (
          <AnnualNdviGraph
            startYear={appliedStartYear}
            endYear={appliedEndYear}
          />
        )}


        {/* NDVI Graph Panel */}
        {/* {selectedLayer === 'ndvi' && (
          <NDVIGraphPanel
            calendarDayAverages={calendarDayAverages}
            isVisible={isGraphVisible}
            onToggle={toggleGraph}
            selectedDate={selectedDate}
            metadata={timeSeriesMetadata}
          />
        )} */}
      </>
    );
  };

  const selectedYearLabel = getYear(endDate) || '—';
  const activeView = selectedLayer === 'ndvi' ? 'trends'
    : selectedLayer === 'decline' ? 'trends'
    : showReferenceOutline ? 'comparison' : 'extent';
  const hasLiveMap = Boolean(mapUrl);
  const selectView = (view) => {
    if (view === 'extent' || view === 'comparison') {
      const outline = view === 'comparison';
      setShowReferenceOutline(outline);
      setReferenceSource('gmw');
      if (selectedLayer !== 'mvi') {
        handleLayerChange('mvi');
      } else {
        setMapUrl('');
        setTimeSeriesMetadata(null);
      }
    } else if (view === 'trends' && selectedLayer !== 'ndvi' && selectedLayer !== 'decline') {
      handleLayerChange('ndvi');
    }
  };

  return (
    <Layout>
      <div className={styles.pageShell}>
        <nav className={styles.rail} aria-label="Primary navigation">
          <div className={styles.mark} title="MangroveLens">
            <svg viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <path d="M16 27V12m0 9-9 5m9-7 8 6M16 13c-8 0-11-5-10-10 7 0 10 3 10 10Zm0-1c0-7 5-10 11-10 0 6-4 10-11 10Z"
                stroke="#c7f6e0" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"/>
            </svg>
          </div>
          <button title="Overview" aria-label="Overview" type="button"
            className={styles.navButton} onClick={()=>selectView('extent')}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
              <rect x="3" y="3" width="8" height="8" rx="2"/>
              <rect x="13" y="3" width="8" height="5" rx="2"/>
              <rect x="13" y="10" width="8" height="11" rx="2"/>
              <rect x="3" y="13" width="8" height="8" rx="2"/>
            </svg>
          </button>
          <button title="Map Explorer" aria-label="Map Explorer" type="button"
            className={activeView !== 'trends' ? styles.navActive : styles.navButton}
            onClick={()=>selectView('extent')}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
              <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15"/>
            </svg>
          </button>
          <button title="Monitoring" aria-label="Monitoring" type="button"
            className={activeView === 'trends' ? styles.navActive : styles.navButton}
            onClick={()=>selectView('trends')}>
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" aria-hidden="true">
              <path d="M4 19V6m0 13h16M7 15l4-4 3 2 5-7"/>
            </svg>
          </button>
          <div className={styles.navBottom}>
            <button title="About the project" aria-label="About the project" type="button"
              className={styles.navButton} onClick={()=>setShowProjectInfo(!showProjectInfo)}>
              <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.7" aria-hidden="true">
                <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-3a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-4L10 6a7 7 0 0 0-1.7 1L6 6 4 9.5 6 11a7 7 0 0 0 0 2l-2 1.5L6 18l2.3-1a7 7 0 0 0 1.7 1l.5 3h4l.5-3a7 7 0 0 0 1.7-1l2.3 1 2-3.5-2-1.5a7 7 0 0 0 .1-1Z"/>
              </svg>
            </button>
            <div className={styles.avatar}>ML</div>
          </div>
        </nav>
        {showProjectInfo && (
          <div style={{position:'fixed',left:83,bottom:22,zIndex:1200,maxWidth:260,padding:15,
            background:'white',border:'1px solid #e4ebe6',borderRadius:12,fontSize:12,
            boxShadow:'0 12px 32px #153a3030'}}>
            MangroveLens is a research prototype for monitoring provisional mangrove candidate extent.
            <button type="button" style={{display:'block',marginTop:10}} onClick={()=>setShowProjectInfo(false)}>Close</button>
          </div>
        )}
        <div className={styles.content}>
          <div className={styles.headingRow}>
            <div>
              <h1>Mangrove Map Explorer</h1>
              <p>Explore candidate extent and same-year reference agreement through time.</p>
            </div>
            <div className={styles.segmented} role="group" aria-label="Analysis mode">
              {[['extent','Extent'],['comparison','Comparison'],['trends','Trends']].map(([view,label])=>(
                <button key={view} type="button" aria-pressed={activeView===view}
                  className={activeView===view ? styles.tabActive : styles.tab}
                  onClick={()=>selectView(view)}>{label}</button>
              ))}
            </div>
          </div>
          <div className={styles.workspace}>
            <section className={styles.controlsCard}>
              <ControlPanel
                startDate={startDate}
                endDate={endDate}
                selectedLayer={selectedLayer}
                selectedMunicipality={selectedMunicipality}
                municipalities={municipalities}
                onMunicipalityChange={handleMunicipalityChange}
                onLayerChange={handleLayerChange}
                onDateChange={handleDateChange}
                onUpdateMap={handleUpdateMap}
                isUpdating={isUpdating}
                error={error}
                showReferenceOutline={showReferenceOutline}
                onShowReferenceOutlineChange={(value)=>{
                  setShowReferenceOutline(value);
                  setMapUrl('');
                  setTimeSeriesMetadata(null);
                }}
                referenceSource={referenceSource}
                onReferenceSourceChange={setReferenceSource}
              />
            </section>
            <section className={styles.mapCard} aria-label="Interactive Philippines map">
              <Map
                center={center}
                zoom={zoom}
                // The pilot selection is used for GEE requests, not for auto-zoom on startup.
                // MapController uses center/zoom to show the Philippines first and Palawan after loading.
                selectedRegion={null}
                selectedProvince={selectedProvince}
                selectedLayer={selectedLayer}
              >
                {renderMapLayers}
              </Map>

              <div className={styles.mapTop}>
                <div className={styles.mapLabel}>
                  <div className={styles.mapPin}>⌖</div>
                  <div>
                    <strong>
                      {hasLiveMap
                        ? `Palawan · ${selectedYearLabel} ${activeView === 'comparison' ? 'MVI + GMW outline' : selectedLayer === 'mvi' ? 'MVI candidate extent' : selectedLayer === 'ndvi' ? 'NDVI' : 'candidate change'}`
                        : 'Philippines · Map overview'}
                    </strong>
                    <small>
                      {hasLiveMap
                        ? 'Sentinel-2 · Google Earth Engine layer'
                        : 'OpenStreetMap basemap · Choose a year and update the map'}
                    </small>
                  </div>
                </div>
              </div>

              {(loading || isUpdating || isRasterLoading) && (
                <div className={styles.mapUpdatingNotice} role="status">
                  <span className={styles.mapUpdatingSpinner} />
                  Loading map from Earth Engine…
                </div>
              )}
            </section>

            <aside className={styles.infoCard} aria-label="Analysis summary">
              <h2>Analysis summary</h2>
              <div className={styles.status}>
                <span className={styles.statusDot}/>
                {hasLiveMap ? 'Map layer loaded' : 'Results will appear when connected'}
              </div>
              <p className={styles.metricHead}>Selected observation</p>
              <div className={styles.metric}>
                <div className={styles.metricLabel}>
                  {selectedLayer==='mvi' ? 'MVI candidate extent' : selectedLayer==='ndvi' ? 'NDVI condition' : 'Candidate change'}
                </div>
                <p className={styles.metricValue}>— <span className={styles.metricUnit}>ha</span></p>
                <div className={styles.metricSub}>No computed area statistic loaded</div>
              </div>
              <div className={styles.metric}>
                <div className={styles.metricLabel}>Agreement with GMW</div>
                <p className={styles.metricValue}>— <span className={styles.metricUnit}>%</span></p>
                <div className={styles.metricSub}>No computed agreement statistic loaded</div>
              </div>
              <div className={styles.rule}/>
              <p className={styles.legendTitle}>Map interpretation</p>
              {selectedLayer==='mvi' && (
                <div className={styles.legend} style={{marginBottom:16}}>
                  <div className={styles.legendRow}>
                    <span className={styles.swatch} style={{background:'#00E676'}}/>Current MVI candidate layer
                  </div>
                  {showReferenceOutline && <div className={styles.legendRow}>
                    <span className={styles.swatch} style={{background:'#FF00FF'}}/>GMW outline (currently available reference)
                  </div>}
                </div>
              )}
              <p className={styles.smallNote}>Four-color GMW comparison key (not yet loaded as a map layer):</p>
              <div className={styles.legend}>
                {[
                  ['#337fd3','Overlap: MVI and GMW'],
                  ['#ca4aa3','GMW only'],
                  ['#eb8743','MVI only (GMW valid non-mangrove)'],
                  ['#e7bf34','MVI candidate (GMW NoData)']
                ].map(([color,label])=>(
                  <div className={styles.legendRow} key={label}>
                    <span className={styles.swatch} style={{background:color}}/>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className={styles.source}>
                GMW is a comparison reference, not ground truth. Yellow does not imply GMW disagreement.
                The separate NoData-aware comparison uses a 30 m common grid; it is not this map's current tile layer.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </Layout>
  );
}
