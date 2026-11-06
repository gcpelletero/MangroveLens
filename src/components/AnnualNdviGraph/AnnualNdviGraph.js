
import { ANNUAL_NDVI_MEANS } from '../../lib/annualNdviMeans';

const AnnualNdviGraph = ({ startYear, endYear }) => {
  const data = ANNUAL_NDVI_MEANS.filter(
    (item) =>
      item.year >= Number(startYear) &&
      item.year <= Number(endYear)
  );

  if (data.length === 0) return null;

  const left = 48;
  const right = 390;
  const top = 20;
  const bottom = 200;

  const minNdvi = 0.80;
  const maxNdvi = 0.88;

  const getX = (index) =>
    data.length === 1
      ? (left + right) / 2
      : left + (index / (data.length - 1)) * (right - left);

  const getY = (value) =>
    bottom -
    ((value - minNdvi) / (maxNdvi - minNdvi)) *
      (bottom - top);

  const linePath = data
    .map(
      (item, index) =>
        `${index === 0 ? 'M' : 'L'} ${getX(index)} ${getY(
          item.meanNdvi
        )}`
    )
    .join(' ');

  const yTicks = [0.80, 0.82, 0.84, 0.86, 0.88];

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
    >
      <h4
        style={{
          margin: '0 0 5px',
          color: '#1f2937',
          fontSize: '16px'
        }}
      >
        Annual Mean NDVI
      </h4>

      <p
        style={{
          margin: '0 0 10px',
          fontSize: '12px',
          color: '#6b7280'
        }}
      >
        Palawan mangrove candidate areas • {startYear}–{endYear}
      </p>

      <svg
        viewBox="0 0 420 250"
        width="100%"
        role="img"
        aria-label="Annual mean NDVI line graph"
      >
        {yTicks.map((value) => (
          <g key={value}>
            <line
              x1={left}
              x2={right}
              y1={getY(value)}
              y2={getY(value)}
              stroke="#e5e7eb"
              strokeDasharray="4 4"
            />
            <text
              x={left - 8}
              y={getY(value) + 4}
              textAnchor="end"
              fontSize="11"
              fill="#6b7280"
            >
              {value.toFixed(2)}
            </text>
          </g>
        ))}

        <path
          d={linePath}
          fill="none"
          stroke="#16a34a"
          strokeWidth="3"
          strokeLinejoin="round"
        />

        {data.map((item, index) => (
          <g key={item.year}>
            <circle
              cx={getX(index)}
              cy={getY(item.meanNdvi)}
              r="5"
              fill="#16a34a"
              stroke="white"
              strokeWidth="2"
            >
              <title>
                {`${item.year}: ${item.meanNdvi.toFixed(4)}`}
              </title>
            </circle>

            <text
              x={getX(index)}
              y={bottom + 20}
              textAnchor="middle"
              fontSize="11"
              fill="#4b5563"
            >
              {item.year}
            </text>
          </g>
        ))}
      </svg>

      <p
        style={{
          margin: '0',
          color: '#6b7280',
          fontSize: '11px',
          lineHeight: '1.5'
        }}
      >
        Annual mean NDVI within each year's MVI-derived
        mangrove candidate extent. Changes may reflect
        differences in the mapped area as well as greenness;
        they do not confirm vegetation degradation or recovery.
      </p>
    </div>
  );
};

export default AnnualNdviGraph;
