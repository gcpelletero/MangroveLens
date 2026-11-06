
import { NDVI_CLASSES } from '../../config/ndviConfig';

const LegendPanel = ({
  selectedLayer,
  isVisible,
  onToggle
}) => {
  if (selectedLayer !== 'ndvi') {
    return null;
  }

  return (
    <>
      {/* Legend toggle button */}
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
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          color: '#495057',
          fontSize: '13px',
          fontWeight: '600',
          cursor: 'pointer'
        }}
      >
        <span>🎨</span>
        {isVisible ? 'Hide Legend' : 'Show Legend'}
      </button>

      {/* Compact NDVI legend */}
      {isVisible && (
        <div
          style={{
            position: 'absolute',
            right: '20px',
            bottom: '75px',
            zIndex: 1190,
            width: '480px',
            maxWidth: 'calc(100% - 40px)',
            boxSizing: 'border-box',
            padding: '10px 12px',
            background: 'rgba(255, 255, 255, 0.97)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #d8dee4',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.16)'
          }}
        >
          {/* Header */}
          <h4
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              margin: '0 0 4px',
              color: '#24322a',
              fontSize: '14px',
              fontWeight: '700'
            }}
          >
            <span>🌱</span>
            Mangrove NDVI Legend
          </h4>

          <p
            style={{
              margin: '0 0 8px',
              color: '#606b64',
              fontSize: '10px',
              lineHeight: '1.3'
            }}
          >
            NDVI indicates vegetation greenness within
            each year's MVI-derived mangrove candidate areas.
          </p>

          {/* NDVI categories in three columns */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(3, minmax(0, 1fr))',
              gap: '5px',
              marginBottom: '7px'
            }}
          >
            {NDVI_CLASSES.map((item) => (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  minWidth: 0,
                  padding: '4px 5px',
                  background: '#f8faf8',
                  border: '1px solid #edf0ed',
                  borderRadius: '5px'
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: '11px',
                    height: '11px',
                    flexShrink: 0,
                    backgroundColor: item.color,
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: '3px'
                  }}
                />

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      color: '#344039',
                      fontSize: '9px',
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
                      fontSize: '8px'
                    }}
                  >
                    NDVI {item.range}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Transparency explanation */}
          <p
            style={{
              margin: '0 0 7px',
              padding: '5px 7px',
              background: '#f6f8f6',
              borderRadius: '5px',
              color: '#657068',
              fontSize: '9px',
              lineHeight: '1.3'
            }}
          >
            Transparent areas are outside the annual
            mangrove candidate mask or contain no NDVI data.
          </p>

          {/* Data sources */}
          <div
            style={{
              paddingTop: '6px',
              borderTop: '1px solid #e4e9e5',
              color: '#6c757d',
              fontSize: '9px',
              lineHeight: '1.35',
              textAlign: 'center'
            }}
          >
            <div>
              NDVI: Copernicus Sentinel-2 SR Harmonized
            </div>
            <div>
              Mask: Same-year MVI-derived mangrove candidate extent
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LegendPanel;
  