import { NDVI_CLASSES } from '../../config/ndviConfig';


const LegendPanel = ({
  selectedLayer,
  isVisible,
  onToggle
}) => {
  // For now, this component only handles the NDVI legend.
  if (selectedLayer !== 'ndvi') {
    return null;
  }

  return (
    <>
      {/* Show or hide legend button */}
      <button
        type="button"
        onClick={onToggle}
        title={isVisible ? 'Hide NDVI legend' : 'Show NDVI legend'}
        style={{
          position: 'absolute',
          right: '20px',
          bottom: '20px',
          zIndex: 1200,
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '10px 13px',
          background: 'rgba(255, 255, 255, 0.96)',
          border: '1px solid #d8dee4',
          borderRadius: '7px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
          color: '#495057',
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        <span>🎨</span>
        {isVisible ? 'Hide Legend' : 'Show Legend'}
      </button>

      {/* Legend card */}
      {isVisible && (
        <div
          style={{
            position: 'absolute',
            right: '20px',
            bottom: '75px',
            zIndex: 1190,
            width: '355px',
            padding: '17px',
            background: 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #d8dee4',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16)'
          }}
        >
          {/* Header */}
          <div style={{ marginBottom: '13px' }}>
            <h4
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                margin: '0 0 6px',
                color: '#24322a',
                fontSize: '16px',
                fontWeight: '700'
              }}
            >
              <span>🌱</span>
              Mangrove NDVI Legend
            </h4>

            <p
              style={{
                margin: 0,
                color: '#606b64',
                fontSize: '11px',
                lineHeight: '1.45'
              }}
            >
              NDVI represents vegetation greenness within baseline
              mapped mangrove areas. Higher values generally indicate
              greener and more continuous vegetation.
            </p>
          </div>

          {/* Legend items */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '7px',
              marginBottom: '13px'
            }}
          >
            {NDVI_CLASSES.map((item) => (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  minWidth: 0,
                  padding: '6px 7px',
                  background: 'rgba(248, 250, 248, 0.9)',
                  border: '1px solid #edf0ed',
                  borderRadius: '5px'
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '14px',
                    height: '14px',
                    flexShrink: 0,
                    backgroundColor: item.color,
                    border: '1px solid rgba(0, 0, 0, 0.12)',
                    borderRadius: '3px'
                  }}
                />

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: '#344039',
                      fontSize: '10px',
                      fontWeight: '600',
                      lineHeight: '1.2'
                    }}
                  >
                    {item.name}
                  </div>

                  <div
                    style={{
                      marginTop: '2px',
                      color: '#748078',
                      fontSize: '9px'
                    }}
                  >
                    NDVI {item.range}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Transparency explanation */}
          <div
            style={{
              marginBottom: '11px',
              padding: '7px 9px',
              background: '#f6f8f6',
              borderRadius: '5px',
              color: '#657068',
              fontSize: '10px',
              lineHeight: '1.4'
            }}
          >
            Transparent areas are outside the baseline mangrove mask,
            contain no data, or have NDVI below 0.05.
          </div>

          {/* Source */}
          <div
            style={{
              paddingTop: '10px',
              borderTop: '1px solid #e4e9e5',
              color: '#6c757d',
              fontSize: '9.5px',
              lineHeight: '1.5',
              textAlign: 'center'
            }}
          >
            <div>
              NDVI source: Copernicus Sentinel-2 SR Harmonized
            </div>
            <div>
              Mangrove mask: Landsat-derived Global Mangrove Forests
              (2000 baseline)
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LegendPanel;