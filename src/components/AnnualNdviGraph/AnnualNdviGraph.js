// Means are computed on demand from Earth Engine for the selected persistent footprint.
// Do not use the fixed 2019–2025 reference series for other periods.
const AnnualNdviGraph = ({
  startYear,
  endYear,
  data = [],
  areaHa = null,
  isLoading = false,
  error = null
}) => {
  const observations = data.filter(
    (item) =>
      item.year >= Number(startYear) &&
      item.year <= Number(endYear) &&
      typeof item.meanNdvi === 'number' &&
      Number.isFinite(item.meanNdvi)
  );

  const values = observations.map((item) => item.meanNdvi);
  const smallest = Math.min(...values);
  const largest = Math.max(...values);

  const minNdvi = values.length
    ? Math.max(-1, Math.floor((smallest - 0.015) * 20) / 20)
    : 0;
  const maxNdvi = values.length
    ? Math.min(1, Math.ceil((largest + 0.015) * 20) / 20)
    : 1;
  const range = maxNdvi > minNdvi ? maxNdvi - minNdvi : 0.1;

  const left = 48;
  const right = 390;
  const top = 20;
  const bottom = 200;

  const getX = (index) =>
    observations.length === 1
      ? (left + right) / 2
      : left + (index / (observations.length - 1)) * (right - left);

  const getY = (value) =>
    bottom - ((value - minNdvi) / range) * (bottom - top);

  const linePath = observations
    .map((item, index) => `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(item.meanNdvi)}`)
    .join(' ');

  const yTicks = Array.from({ length: 5 }, (_, index) =>
    minNdvi + ((maxNdvi - minNdvi) * index) / 4
  );

  return (
    <div
      style={{
        position: 'absolute',
        top: '120px',
        right: '20px',
        width: '420px',
        maxWidth: 'calc(100% - 40px)',
        background: 'rgba(255, 255, 255, 0.97)',
        borderRadius: '12px',
        padding: '16px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
        zIndex: 1000
      }}
      aria-live="polite"
    >
      <h4 style={{ margin: '0 0 5px', color: '#1f2937', fontSize: '16px' }}>
        Persistent Mangrove Candidate NDVI
      </h4>

      <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#6b7280' }}>
        Palawan · Persistent candidate area for {startYear}–{endYear}
      </p>

      {isLoading ? (
        <p style={{ color: '#6b7280', fontSize: '12px' }}>
          Calculating selected-period persistent candidate NDVI in Earth Engine…
        </p>
      ) : error ? (
        <p role="alert" style={{ color: '#b45309', fontSize: '12px', lineHeight: 1.5 }}>
          Persistent candidate NDVI is unavailable: {error}
        </p>
      ) : observations.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: '12px' }}>
          No valid persistent candidate NDVI means were returned for this period.
        </p>
      ) : (
        <>
          <svg
            viewBox="0 0 420 250"
            width="100%"
            role="img"
            aria-label={`Mean NDVI in candidate areas persistent from ${startYear} to ${endYear}`}
          >
            {yTicks.map((value, index) => (
              <g key={index}>
                <line x1={left} x2={right} y1={getY(value)} y2={getY(value)}
                  stroke="#e5e7eb" strokeDasharray="4 4" />
                <text x={left - 8} y={getY(value) + 4}
                  textAnchor="end" fontSize="11" fill="#6b7280">
                  {value.toFixed(3)}
                </text>
              </g>
            ))}

            <path d={linePath} fill="none" stroke="#16a34a"
              strokeWidth="3" strokeLinejoin="round" />

            {observations.map((item, index) => (
              <g key={item.year}>
                <circle cx={getX(index)} cy={getY(item.meanNdvi)} r="5"
                  fill="#16a34a" stroke="white" strokeWidth="2">
                  <title>{`${item.year}: ${item.meanNdvi.toFixed(4)}`}</title>
                </circle>
                <text x={getX(index)} y={bottom + 20}
                  textAnchor="middle" fontSize="11" fill="#4b5563">
                  {item.year}
                </text>
              </g>
            ))}
          </svg>

          <p style={{ margin: '0 0 8px', fontWeight: 600, color: '#395e51', fontSize: '12px' }}>
            {typeof areaHa === 'number' && Number.isFinite(areaHa)
              ? `Persistent candidate area: ${areaHa.toLocaleString(undefined, { maximumFractionDigits: 2 })} ha`
              : 'Persistent candidate area: unavailable'}
          </p>

          <p style={{ margin: 0, color: '#6b7280', fontSize: '11px', lineHeight: 1.5 }}>
            Each annual mean is measured within the same area classified as an
            MVI-derived mangrove candidate in every year from {startYear} through {endYear}.
            These values indicate vegetation greenness, not confirmed degradation,
            recovery, or field-verified mangrove presence.
          </p>
        </>
      )}
    </div>
  );
};

export default AnnualNdviGraph;
