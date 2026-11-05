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

const DEFAULT_CENTER = [11.02, 119.48];
const DEFAULT_ZOOM = 11;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [center, setCenter] = useState(DEFAULT_CENTER);
  const [bounds, setBounds] = useState(null);
  const [mapInstance, setMapInstance] = useState(null);

  // Date range for analysis
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [appliedStartDate, setAppliedStartDate] = useState('');
  const [appliedEndDate, setAppliedEndDate] = useState('');
  const [hasAppliedStudyPeriod, setHasAppliedStudyPeriod] = useState(false);


  const [isUpdating, setIsUpdating] = useState(false);
  const [isRasterLoading, setIsRasterLoading] = useState(false);
  const [selectedLayer, setSelectedLayer] = useState(null);

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
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedMunicipality, setSelectedMunicipality] = useState(null);
  const [regions] = useState(regionsData);
  const [provinces, setProvinces] = useState([]);
  const [municipalities, setMunicipalities] = useState([]);

  // Animation state
  const [isAnimationPlaying, setIsAnimationPlaying] = useState(false);

  const [showModal, setShowModal] = useState(true);


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

      setCenter(DEFAULT_CENTER);
      setZoom(DEFAULT_ZOOM);
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

  setCenter(DEFAULT_CENTER);
  setZoom(DEFAULT_ZOOM);
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

  const response = await fetch(
    `/api/mangrove-year?year=${encodeURIComponent(
      selectedYear
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

  setCenter(DEFAULT_CENTER);
  setZoom(DEFAULT_ZOOM);
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
    setStartDate(newStartDate);
    setEndDate(newEndDate);

    // Hide the current raster until the user clicks Apply Changes again
    setHasAppliedStudyPeriod(false);
    setAppliedStartDate('');
    setAppliedEndDate('');
  };

  const handleUpdateMap = (start, end) => {
    const startYear = getYear(start);
    const endYear = getYear(end);

    if (!startYear || !endYear) {
      setError('Please select a historical year and a current year.');
      return;
    }

    if (startYear > endYear) {
      setError('Historical year must be earlier than or equal to current year.');
      return;
    }

    setAppliedStartDate(start);
    setAppliedEndDate(end);
    setHasAppliedStudyPeriod(true);

    if (selectedLayer === 'ndvi') {
      setIsLegendVisible(true);
    } else {
      setIsLegendVisible(false);
    }

    fetchMapData(start, end, selectedLayer);
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
      appliedStartYear === 2019 &&
      appliedEndYear === 2024;

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
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; OpenStreetMap contributors &copy; CARTO'
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
            keepBuffer={2}

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

        {/* Active Layer Info */}
        {selectedLayer && (
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              zIndex: 1000,
              background: 'rgba(255, 255, 255, 0.95)',
              padding: '12px 16px',
              borderRadius: '10px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
              minWidth: '240px'
            }}
          >
            <div
              style={{
                fontSize: '14px',
                fontWeight: '700',
                marginBottom: '6px',
                color: '#1f2937'
              }}
            >
            {selectedLayer === 'ndvi'
              ? 'NDVI View'
              : selectedLayer === 'mvi'
                ? timeSeriesMetadata?.year
                  ? `Mangrove Candidate Extent — ${timeSeriesMetadata.year}`
                  : 'Mangrove Candidate Extent'
                : selectedLayer === 'decline'
                  ? timeSeriesMetadata?.historicalYear &&
                    timeSeriesMetadata?.currentYear
                    ? `Mangrove Candidate Change — ${timeSeriesMetadata.historicalYear} to ${timeSeriesMetadata.currentYear}`
                    : 'Mangrove Candidate Change'
                  : 'MangroveLens'}
            </div>

            <div style={{ fontSize: '12px', color: '#4b5563', lineHeight: '1.5' }}>
              {selectedLayer === 'ndvi'
                ? 'View annual vegetation condition using Sentinel-2 NDVI.'
                : selectedLayer === 'mvi'
                  ? timeSeriesMetadata?.year
                    ? `Green areas show the ${timeSeriesMetadata.year} MVI-derived mangrove candidate extent after threshold, patch-size, and water-proximity screening.`
                    : 'Loading the annual MVI-derived mangrove candidate extent.'
                  : selectedLayer === 'decline'
                    ? timeSeriesMetadata?.historicalYear &&
                      timeSeriesMetadata?.currentYear
                      ? `Green shows persistent candidate extent, red shows candidate loss, and blue shows candidate gain between ${timeSeriesMetadata.historicalYear} and ${timeSeriesMetadata.currentYear}. These are provisional candidate changes, not confirmed deforestation or restoration.`
                      : 'Loading the mangrove candidate change map.'
                    : ''}
            </div>
          </div>
        )}

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

  return (
    <Layout>
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 'calc(100dvh - 64px)',
          minHeight: 0,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Toggle Button */}
        <button
          onClick={togglePanel}
          style={{
            position: 'absolute',
            top: '78px',
            left: isPanelVisible ? '330px' : '10px',
            zIndex: 1001,
            background: 'rgba(255, 255, 255, 0.95)',
            border: '1px solid #a6a8a9ff',
            borderRadius: '6px',
            padding: '10px 12px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            fontSize: '16px',
            transition: 'all 0.3s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '44px',
            minHeight: '44px'
          }}
          title={isPanelVisible ? 'Hide Control Panel' : 'Show Control Panel'}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 1)';
            e.target.style.transform = 'scale(1.05)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.95)';
            e.target.style.transform = 'scale(1)';
          }}
        >
          {isPanelVisible ? '◀' : '▶'}
        </button>

        {/* Control Panel */}
        <div
          style={{
            width: isPanelVisible ? '320px' : '0px',
            minWidth: isPanelVisible ? '320px' : '0px',
            height: '100%',
            overflow: 'hidden',
            transition: 'width 0.3s ease, min-width 0.3s ease',
            flexShrink: 0,
            zIndex: 1000
          }}
        >
          <div
            style={{
              width: '320px',
              height: '100%'
            }}
          >
          <ControlPanel
            startDate={startDate}
            endDate={endDate}
            selectedLayer={selectedLayer}
            selectedRegion={selectedRegion}
            selectedProvince={selectedProvince}
            selectedMunicipality={selectedMunicipality}
            regions={regions}
            provinces={provinces}
            municipalities={municipalities}
            onLayerChange={handleLayerChange}
            onRegionChange={handleRegionChange}
            onProvinceChange={handleProvinceChange}
            onMunicipalityChange={handleMunicipalityChange}
            onDateChange={handleDateChange}
            onUpdateMap={handleUpdateMap}
            isUpdating={isUpdating}
            error={error}
          />
        </div>
      </div>

        {/* Map Container */}
        <div
          style={{
            flex: '1 1 0',
            minWidth: 0,
            height: '100%',
            position: 'relative'
          }}
        >
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%'
          }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%'
              }}
            >
              <Map
                center={center}
                zoom={zoom}
                selectedRegion={selectedRegion}
                selectedProvince={selectedProvince}
                selectedLayer={selectedLayer}
              >
                {renderMapLayers}
              </Map>  
            </div>

            {(loading || isUpdating || isRasterLoading) && (
              <div className={styles.mapUpdatingNotice}>
                <span className={styles.mapUpdatingSpinner} />
                {selectedLayer === 'ndvi'
                  ? 'Loading NDVI map...'
                  : selectedLayer === 'mvi'
                    ? 'Loading mangrove candidate map...'
                    : selectedLayer === 'decline'
                      ? 'Loading mangrove change map...'
                      : 'Updating map...'}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
