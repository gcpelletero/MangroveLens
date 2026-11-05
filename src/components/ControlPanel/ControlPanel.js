const ControlPanel = ({
  startDate,
  endDate,
  onDateChange,
  onUpdateMap,
  onLayerChange,
  isUpdating = false,
  error = null,
  regions,
  selectedLayer,
  selectedRegion,
  selectedProvince,
  selectedMunicipality,
  onRegionChange,
  onProvinceChange,
  onMunicipalityChange,
  provinces = [],
  municipalities = [],

  showReferenceOutline = false,
  onShowReferenceOutlineChange,
  referenceSource = 'cgmd',
  onReferenceSourceChange,
}) => {

  const handleBackToLayers = () => {
    onLayerChange(null);
  };

  const handleStartDateChange = (date) => {
    onDateChange({ startDate: date, endDate });
  };

  const handleEndDateChange = (date) => {
    onDateChange({ startDate, endDate: date });
  };

  const handleLayerChange = (layerType) => {
    onLayerChange(layerType);
  }

const layerOptions = [
  {
    id: 'ndvi',
    name: 'NDVI',
    fullName: 'Normalized Difference Vegetation Index',
    description: 'View vegetation condition and compare mangrove-related NDVI patterns over time.',
    color: '#22c55e',
    icon: '🌿',
    features: ['Vegetation Index', 'Historical vs Current', 'Time Series']
  },
  {
    id: 'mvi',
    name: 'MVI Preview',
    fullName: 'Mangrove Vegetation Index',
    description:
      'Preview the raw annual MVI surface before mangrove classification.',
    color: '#7c3aed',
    icon: '🌿',
    features: [
      'Sentinel-2',
      'Annual Median',
      'Raw Preview'
    ]
  },
  {
    id: 'decline',
    name: 'Decline',
    fullName: 'Vegetation Decline Layer',
    description: 'Highlight areas where NDVI decreased between the selected historical and current periods.',
    color: '#ef4444',
    icon: '📉',
    features: ['Change Detection', 'NDVI Drop', 'Possible Degradation']
  }
];

  // const presetYears = ['2020', '2021', '2022', '2023'];

  const yearOptions = ['2019', '2020', '2021', '2022', '2023', '2024'];

  const getYearFromDate = (dateValue) => {
    if (!dateValue) return '';

    const dateString = String(dateValue);
    const yearMatch = dateString.match(/^\d{4}/);

    if (yearMatch) return yearMatch[0];

    const parsedDate = new Date(dateValue);
    return Number.isNaN(parsedDate.getTime()) ? '' : String(parsedDate.getFullYear());
  };

  const startYear = getYearFromDate(startDate);
  const endYear = getYearFromDate(endDate);

  const isInvalidYearRange =
    startYear &&
    endYear &&
    Number(startYear) > Number(endYear);

  const handleStartYearChange = (year) => {
    onDateChange({
      startDate: year ? `${year}-01-01` : '',
      endDate
    });
  };

  const handleEndYearChange = (year) => {
    onDateChange({
      startDate,
      endDate: year ? `${year}-12-31` : ''
    });
  };

  /*
  * Only years with a prepared Earth Engine
  * MVI asset should appear here.
  */


const availableMviYears = [
  '2019',
  '2020',
  '2021',
  '2022',
  '2023',
  '2024',
  '2025'
];



  /*
  * MVI uses only one selected annual year.
  */
  const handleMviYearChange = (year) => {
    onDateChange({
      startDate: '',
      endDate: year
        ? `${year}-12-31`
        : ''
    });
  };

  // Layer Selection View
  if (!selectedLayer) {
    return (
      <div style={{
        width: '320px',
        backgroundColor: '#f8f9fa',
        padding: '20px',
        borderRight: '1px solid #dee2e6',
        overflowY: 'auto',
        height: '100vh'
      }}>
        {/* Header */}
        <div style={{ marginBottom: '30px' }}>
          <h3 style={{
            margin: '0 0 10px 0',
            fontSize: '26px',
            fontWeight: '600',
            color: '#343a40'
          }}>
            MangroveLens
          </h3>
          <p style={{
            margin: 0,
            fontSize: '14px',
            color: '#6c757d',
            lineHeight: '1.5'
          }}>
            Explore mangrove-related satellite layers, NDVI comparison, and possible vegetation decline in selected coastal areas.
          </p>
        </div>

        {/* Layer Selection */}
        <div style={{ marginBottom: '30px' }}>
          <h4 style={{
            margin: '0 0 20px 0',
            fontSize: '16px',
            fontWeight: '500',
            color: '#495057'
          }}>
            Choose Mangrove Layer
          </h4>

          <div style={{ display: 'grid', gap: '10px' }}>
            {layerOptions.map((layer) => (
              <button
                key={layer.id}
                onClick={() => handleLayerChange(layer.id)}
                style={{
                  padding: '20px',
                  backgroundColor: 'white',
                  border: '2px solid #e9ecef',
                  borderRadius: '12px',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
                onMouseEnter={(e) => {
                  e.target.style.borderColor = layer.color;
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = `0 4px 12px rgba(0,0,0,0.1)`;
                }}
                onMouseLeave={(e) => {
                  e.target.style.borderColor = '#e9ecef';
                  e.target.style.transform = 'translateY(0px)';
                  e.target.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '5px'
                }}>
                  <span style={{ fontSize: '24px' }}>{layer.icon}</span>
                  <div>
                    <div style={{
                      fontWeight: '600',
                      fontSize: '16px',
                      color: '#343a40'
                    }}>
                      {layer.name}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: layer.color,
                      fontWeight: '500'
                    }}>
                      {layer.fullName}
                    </div>
                  </div>
                </div>
                <p style={{
                  margin: '0 0 8px 0',
                  fontSize: '13px',
                  color: '#6c757d',
                  lineHeight: '1.4'
                }}>
                  {layer.description}
                </p>
                
                {/* Features List */}
                <div style={{ 
                  display: 'flex', 
                  flexWrap: 'wrap', 
                  gap: '4px',
                  marginTop: '4px'
                }}>
                  {layer.features.map((feature, index) => (
                    <span
                      key={index}
                      style={{
                        fontSize: '10px',
                        background: `${layer.color}20`,
                        color: layer.color,
                        padding: '2px 6px',
                        borderRadius: '8px',
                        fontWeight: '500'
                      }}
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Info Section */}
        <div style={{
          padding: '20px',
          backgroundColor: '#e7f3ff',
          borderRadius: '12px',
          fontSize: '13px',
          border: '1px solid #b8daff'
        }}>
          <div style={{
            fontWeight: '600',
            color: '#004085',
            marginBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>ℹ️</span> Getting Started
          </div>
          <p style={{
            margin: 0,
            color: '#0056b3',
            lineHeight: '1.4'
          }}>
            Select a mangrove layer above to begin exploring satellite imagery. Use NDVI to compare vegetation condition, or use the decline layer to view possible areas of mangrove-related vegetation decrease.
          </p>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '40px',
          paddingTop: '20px',
          borderTop: '1px solid #dee2e6',
          fontSize: '11px',
          color: '#6c757d',
          textAlign: 'center'
        }}>
          Powered by Google Earth Engine
        </div>
      </div>
    );
  }

  // Date Range Selection View (when layer is selected)
  return (
    <div style={{
      width: '320px',
      backgroundColor: '#f8f9fa',
      padding: '20px',
      borderRight: '1px solid #dee2e6',
      overflowY: 'auto',
      height: '100vh'
    }}>
      {/* Header with Back Button */}
      <div style={{ marginBottom: '25px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '10px'
        }}>
          <button
            onClick={handleBackToLayers}
            style={{
              padding: '6px 8px',
              backgroundColor: 'transparent',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#6c757d'
            }}
          >
            ← Back
          </button>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: '600',
            color: '#343a40'
          }}>
            {layerOptions.find(l => l.id === selectedLayer)?.name} Controls
          </h3>
        </div>
        <p style={{
          margin: 0,
          fontSize: '13px',
          color: '#6c757d',
          lineHeight: '1.4'
        }}>
          Configure parameters for {layerOptions.find(l => l.id === selectedLayer)?.fullName.toLowerCase()} analysis.
        </p>
        
        {/* Layer-specific info */}
        {selectedLayer === 'ndvi' && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: '#d4edda',
            borderRadius: '8px',
            fontSize: '12px',
            border: '1px solid #c3e6cb'
          }}>
            <div style={{
              fontWeight: '600',
              color: '#155724',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>🕒</span> Time Series Enabled
            </div>
            <p style={{
              margin: 0,
              color: '#155724',
              lineHeight: '1.3'
            }}>
              This layer includes temporal analysis, calendar patterns, and animation controls for vegetation monitoring over time.
            </p>
          </div>
        )}

        {selectedLayer === 'decline' && (
          <div style={{
            marginTop: '12px',
            padding: '12px',
            backgroundColor: '#fde2e2',
            borderRadius: '8px',
            fontSize: '12px',
            border: '1px solid #f5b5b5'
          }}>
            <div style={{
              fontWeight: '600',
              color: '#991b1b',
              marginBottom: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>📉</span> Change Detection
            </div>
            <p style={{
              margin: 0,
              color: '#991b1b',
              lineHeight: '1.3'
            }}>
              This layer highlights places where NDVI dropped between the selected periods, which may indicate possible vegetation decline.
            </p>
          </div>
        )}
      </div>



      {/* Error Display */}
      {error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          fontSize: '13px',
          marginBottom: '20px',
          border: '1px solid #f5c6cb'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Study Area Selection */}
      <div style={{ marginBottom: '25px' }}>
        <h4 style={{
          margin: '0 0 15px 0',
          fontSize: '14px',
          fontWeight: '500',
          color: '#6c757d',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          Location Selection
        </h4>

        <div style={{ marginBottom: '15px' }}>
          <label style={{
            display: 'block',
            marginBottom: '5px',
            fontSize: '13px',
            fontWeight: '500',
            color: '#495057'
          }}>
            Region
          </label>
          <select
            value={selectedRegion || ''}
            onChange={(e) => onRegionChange(e.target.value)}
            disabled={isUpdating}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px',
              backgroundColor: isUpdating ? '#e9ecef' : 'white',
              cursor: isUpdating ? 'not-allowed' : 'pointer'
            }}
          >
            <option value="">All</option>
            {regions.map((region) => (
              <option key={region.ADM1_PCODE} value={region.ADM1_PCODE}>
                {region.ADM1_EN}
              </option>
            ))}
          </select>
        </div>

        {selectedRegion && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '13px',
              fontWeight: '500',
              color: '#495057'
            }}>
              Province
            </label>
            <select
              value={selectedProvince || ''}
              onChange={(e) => onProvinceChange(e.target.value)}
              disabled={isUpdating}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: isUpdating ? '#e9ecef' : 'white',
                cursor: isUpdating ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="">All</option>
              {provinces.map((province) => (
                <option key={province.ADM2_PCODE} value={province.ADM2_PCODE}>
                  {province.ADM2_EN}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedProvince && (
          <div style={{ marginBottom: '15px' }}>
            <label style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '13px',
              fontWeight: '500',
              color: '#495057'
            }}>
              Municipality
            </label>
            <select
              value={selectedMunicipality || ''}
              onChange={(e) => onMunicipalityChange(e.target.value)}
              disabled={isUpdating}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor: isUpdating ? '#e9ecef' : 'white',
                cursor: isUpdating ? 'not-allowed' : 'pointer'
              }}
            >
              <option value="">Entire Province</option>
              {municipalities.map((municipality) => (
                <option key={municipality.ADM3_PCODE} value={municipality.ADM3_PCODE}>
                  {municipality.ADM3_EN}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Date Range Section */}
      <div style={{ marginBottom: '25px' }}>
        <h4 style={{
          margin: '0 0 15px 0',
          fontSize: '14px',
          fontWeight: '500',
          color: '#6c757d',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          {selectedLayer === 'mvi'
            ? 'MVI Year'
            : 'Study Period'}
          {selectedLayer === 'ndvi' && (
            <span style={{
              marginLeft: '8px',
              fontSize: '10px',
              background: '#22c55e20',
              color: '#22c55e',
              padding: '2px 6px',
              borderRadius: '8px',
              fontWeight: '500',
              textTransform: 'none'
            }}>
              Time Series
            </span>
          )}
        </h4>

        {selectedLayer === 'ndvi' && (
          <div style={{
            marginBottom: '15px',
            padding: '12px',
            backgroundColor: '#fff3cd',
            borderRadius: '8px',
            fontSize: '12px',
            border: '1px solid #ffeaa7'
          }}>
            <div style={{
              fontWeight: '600',
              color: '#856404',
              marginBottom: '4px'
            }}>
              💡 Tip for Time Series Analysis
            </div>
            <p style={{
              margin: 0,
              color: '#856404',
              lineHeight: '1.3'
            }}>
              Select a historical year and a current year to compare mangrove vegetation condition over time.
            </p>
          </div>
        )}

        {selectedLayer === 'mvi' ? (
          /*
          * MVI represents one annual mangrove
          * candidate extent, so only one year
          * selector is needed.
          */
          <div style={{ marginBottom: '15px' }}>
            <label
              style={{
                display: 'block',
                marginBottom: '5px',
                fontSize: '13px',
                fontWeight: '500',
                color: '#495057'
              }}
            >
              MVI Year
            </label>

            <select
              value={endYear}
              onChange={(e) =>
                handleMviYearChange(
                  e.target.value
                )
              }
              disabled={isUpdating}
              style={{
                width: '100%',
                padding: '8px 12px',
                border:
                  '1px solid #ced4da',
                borderRadius: '4px',
                fontSize: '14px',
                backgroundColor:
                  isUpdating
                    ? '#e9ecef'
                    : 'white',
                cursor:
                  isUpdating
                    ? 'not-allowed'
                    : 'pointer'
              }}
            >
              <option value="">
                Select MVI year
              </option>

              {availableMviYears.map(
                (year) => (
                  <option
                    key={year}
                    value={year}
                  >
                    {year}
                  </option>
                )
              )}
            </select>

            <div
              style={{
                marginTop: '6px',
                fontSize: '11px',
                color: '#6c757d',
                lineHeight: '1.4'
              }}
            >
              Select the yearly mangrove candidate
              extent to display.
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: '15px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '5px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#495057'
                }}
              >
                Historical Year
              </label>

              <select
                value={startYear}
                onChange={(e) =>
                  handleStartYearChange(
                    e.target.value
                  )
                }
                disabled={isUpdating}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border:
                    '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor:
                    isUpdating
                      ? '#e9ecef'
                      : 'white',
                  cursor:
                    isUpdating
                      ? 'not-allowed'
                      : 'pointer'
                }}
              >
                <option value="">
                  Select historical year
                </option>

                {yearOptions.map(
                  (year) => (
                    <option
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  )
                )}
              </select>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label
                style={{
                  display: 'block',
                  marginBottom: '5px',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: '#495057'
                }}
              >
                Current Year
              </label>

              <select
                value={endYear}
                onChange={(e) =>
                  handleEndYearChange(
                    e.target.value
                  )
                }
                disabled={isUpdating}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border:
                    '1px solid #ced4da',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor:
                    isUpdating
                      ? '#e9ecef'
                      : 'white',
                  cursor:
                    isUpdating
                      ? 'not-allowed'
                      : 'pointer'
                }}
              >
                <option value="">
                  Select current year
                </option>

                {yearOptions.map(
                  (year) => (
                    <option
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  )
                )}
              </select>
            </div>
          </>
        )}


        {/* <div style={{ marginBottom: '15px' }}>
          <label style={{
            display: 'block',
            marginBottom: '5px',
            fontSize: '13px',
            fontWeight: '500',
            color: '#495057'
          }}>
            Historical Year
          </label>

          <select
            value={startYear}
            onChange={(e) => handleStartYearChange(e.target.value)}
            disabled={isUpdating}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px',
              backgroundColor: isUpdating ? '#e9ecef' : 'white',
              cursor: isUpdating ? 'not-allowed' : 'pointer'
            }}
          >
            <option value="">Select historical year</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{
            display: 'block',
            marginBottom: '5px',
            fontSize: '13px',
            fontWeight: '500',
            color: '#495057'
          }}>
            Current Year
          </label>

          <select
            value={endYear}
            onChange={(e) => handleEndYearChange(e.target.value)}
            disabled={isUpdating}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid #ced4da',
              borderRadius: '4px',
              fontSize: '14px',
              backgroundColor: isUpdating ? '#e9ecef' : 'white',
              cursor: isUpdating ? 'not-allowed' : 'pointer'
            }}
          >
            <option value="">Select current year</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div> */}

  {/* Independent mangrove reference */}
  {selectedLayer === 'mvi' && (
    <div
      style={{
        marginTop: '6px',
        marginBottom: '16px',
        padding: '12px',
        backgroundColor: '#fdf2ff',
        border: '1px solid #f0abfc',
        borderRadius: '6px'
      }}
    >
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '9px',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: '600',
          color: '#86198f'
        }}
      >
        <input
          type="checkbox"
          checked={
            showReferenceOutline
          }
          onChange={(event) =>
            onShowReferenceOutlineChange?.(
              event.target.checked
            )
          }
          disabled={
            isUpdating
          }
          style={{
            width: '16px',
            height: '16px',
            cursor:
              isUpdating
                ? 'not-allowed'
                : 'pointer'
          }}
        />

        Show reference outline
      </label>

      {showReferenceOutline && (
        <>
          <label
            style={{
              display: 'block',
              marginTop: '12px',
              marginBottom: '5px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#6b217e'
            }}
          >
            Reference source
          </label>

          <select
            value={referenceSource}
            onChange={(event) =>
              onReferenceSourceChange?.(
                event.target.value
              )
            }
            disabled={
              isUpdating 
            }
            style={{
              width: '100%',
              padding: '7px 10px',
              border:
                '1px solid #e879f9',
              borderRadius: '4px',
              backgroundColor: 'white',
              fontSize: '12px',
              cursor:
                isUpdating
                  ? 'not-allowed'
                  : 'pointer'
            }}
          >
            <option value="gmw">
              Global Mangrove Watch — same year
            </option> 
          </select>

          <div
            style={{
              marginTop: '8px',
              fontSize: '11px',
              lineHeight: '1.4',
              color: '#7e22ce'
            }}
          >
          Magenta outline is for visual comparison only and is not used to classify the green MVI layer.
          </div>
        </>
      )}
    </div>
  )}

        {selectedLayer !== 'mvi' &&
          isInvalidYearRange && (
          <div style={{
            marginBottom: '10px',
            padding: '10px',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
            fontSize: '12px',
            border: '1px solid #f5c6cb'
          }}>
            Historical year must be earlier than or equal to current year.
          </div>
        )}

        <button
          onClick={() => onUpdateMap(startDate, endDate)}
          disabled={
            isUpdating ||
            (
              selectedLayer === 'mvi'
                ? !endYear
                : !startYear ||
                  !endYear ||
                  isInvalidYearRange
            )
          }
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: isUpdating ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: isUpdating ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s'
          }}
        >
          {isUpdating ? 'Updating...' : 'Apply Changes'}
        </button>
      </div>

      {/* Current Selection Display */}
      {(
        (
          selectedLayer === 'mvi' &&
          endDate
        ) ||
        (
          selectedLayer !== 'mvi' &&
          startDate &&
          endDate
        )
      ) && (
        <div style={{
          padding: '15px',
          backgroundColor: '#e7f3ff',
          borderRadius: '4px',
          fontSize: '13px',
          marginBottom: '25px',
          border: '1px solid #b8daff'
        }}>
          <div style={{ marginBottom: '5px', fontWeight: '500', color: '#004085' }}>
            Current Selection:
          </div>
          <div style={{ color: '#0056b3', marginBottom: '5px' }}>
            <strong>Study Area:</strong> {selectedMunicipality ? municipalities.find(m => m.ADM3_PCODE === selectedMunicipality)?.ADM3_EN : selectedProvince ? provinces.find(p => p.ADM2_PCODE === selectedProvince)?.ADM2_EN : selectedRegion ? regions.find(r => r.ADM1_PCODE === selectedRegion)?.ADM1_EN : 'Philippines'}
          </div>
            {selectedLayer === 'mvi' ? (
              <>
                <div
                  style={{
                    color: '#0056b3',
                    marginBottom: '5px'
                  }}
                >
                  <strong>MVI Year:</strong>{' '}
                  {endYear}
                </div>

                <div
                  style={{
                    fontSize: '12px',
                    color: '#6c757d'
                  }}
                >
                  Annual mangrove candidate extent
                  for {endYear}
                </div>
              </>
            ) : (
              <>
                <div
                  style={{
                    color: '#0056b3',
                    marginBottom: '5px'
                  }}
                >
                  <strong>Period:</strong>{' '}
                  {startYear} - {endYear}
                </div>

                <div
                  style={{
                    fontSize: '12px',
                    color: '#6c757d'
                  }}
                >
                  Comparison window:
                  {' '}
                  {startYear}
                  {' to '}
                  {endYear}

                  {selectedLayer === 'ndvi' && (
                    <span
                      style={{
                        display: 'block',
                        marginTop: '4px',
                        color: '#22c55e',
                        fontWeight: '500'
                      }}
                    >
                      📊 Time series analysis enabled
                    </span>
                  )}
                </div>
              </>
            )}
            {selectedLayer === 'ndvi' && (
              <span style={{ display: 'block', marginTop: '4px', color: '#22c55e', fontWeight: '500' }}>
                📊 Time series analysis enabled
              </span>
            )}
          </div>

      )}

      {/* Study Period Info */}
      <div
        style={{
          padding: '15px',
          backgroundColor: '#fff8e1',
          borderRadius: '4px',
          fontSize: '13px',
          marginBottom: '20px',
          border: '1px solid #ffe082'
        }}
      >
      <div
        style={{
          marginBottom: '8px',
          fontWeight: '600',
          color: '#8d6e00'
        }}
      >
        {selectedLayer === 'mvi'
          ? 'Selected MVI Year'
          : 'Study Period'}
      </div>

      {selectedLayer === 'mvi' ? (
        <>
          <div
            style={{
              color: '#6d4c41',
              marginBottom: '6px'
            }}
          >
            <strong>Year:</strong>{' '}
            {endYear || 'Not selected'}
          </div>

          <div
            style={{
              fontSize: '12px',
              color: '#6d4c41',
              marginTop: '8px',
              lineHeight: '1.4'
            }}
          >
            This layer shows the provisional
            MVI-derived mangrove candidate
            extent for the selected year.
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              color: '#6d4c41',
              marginBottom: '6px'
            }}
          >
            <strong>Historical Year:</strong>{' '}
            {startYear || 'Not selected'}
          </div>

          <div
            style={{
              color: '#6d4c41',
              marginBottom: '6px'
            }}
          >
            <strong>Current Year:</strong>{' '}
            {endYear || 'Not selected'}
          </div>

          <div
            style={{
              fontSize: '12px',
              color: '#6d4c41',
              marginTop: '8px',
              lineHeight: '1.4'
            }}
          >
            This view compares the selected
            historical and current years.
          </div>
        </>
      )}
      </div>

      {/* Mangrove Summary */}
      <div
        style={{
          padding: '15px',
          backgroundColor: '#eef7f0',
          borderRadius: '4px',
          fontSize: '13px',
          marginBottom: '25px',
          border: '1px solid #cfe8d3'
        }}
      >
        <div style={{ marginBottom: '8px', fontWeight: '600', color: '#1b5e20' }}>
          {selectedLayer === 'ndvi' ? 'NDVI Summary' : 'Decline Summary'}
        </div>

        {selectedLayer === 'ndvi' ? (
          <>
            <div style={{ color: '#2e7d32', marginBottom: '6px' }}>
              <strong>Mean NDVI 2019:</strong> 0.1618
            </div>

            <div style={{ color: '#2e7d32', marginBottom: '6px' }}>
              <strong>Mean NDVI 2024:</strong> 0.1687
            </div>

            <div style={{ fontSize: '12px', color: '#5f6b6d', marginTop: '8px', lineHeight: '1.4' }}>
              The selected pilot area shows a slight increase in overall mean NDVI from 2019 to 2024.
            </div>
          </>
        ) : (
          <>
            <div style={{ color: '#c62828', marginBottom: '6px' }}>
              <strong>Decline Pixel Count:</strong> 197208.56
            </div>

            <div style={{ fontSize: '12px', color: '#5f6b6d', marginTop: '8px', lineHeight: '1.4' }}>
              The selected pilot area shows localized vegetation decline in some pixels, which may indicate possible degradation zones.
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '30px',
        paddingTop: '20px',
        borderTop: '1px solid #dee2e6',
        fontSize: '11px',
        color: '#6c757d',
        textAlign: 'center'
      }}>
        {selectedLayer === 'ndvi'
          ? 'Sentinel-2 NDVI layer for mangrove vegetation monitoring'
          : 'Vegetation decline layer derived from NDVI comparison'}
      </div>
    </div>
  );
};

export default ControlPanel;