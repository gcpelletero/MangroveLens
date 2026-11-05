export const NDVI_CLASSES = [
  {
    name: 'Low vegetation condition',
    range: '0.05–0.19',
    min: 0.05,
    max: 0.20,
    color: '#d9f0d3'
  },
  {
    name: 'Sparse vegetation',
    range: '0.20–0.34',
    min: 0.20,
    max: 0.35,
    color: '#bae4b3'
  },
  {
    name: 'Moderate vegetation',
    range: '0.35–0.49',
    min: 0.35,
    max: 0.50,
    color: '#74c476'
  },
  {
    name: 'High vegetation condition',
    range: '0.50–0.64',
    min: 0.50,
    max: 0.65,
    color: '#238b45'
  },
  {
    name: 'Very high vegetation condition',
    range: '0.65–1.00',
    min: 0.65,
    max: 1.01,
    color: '#005a32'
  }
];

export const ndviColorFn = (values) => {
  const value = values?.[0];

  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return null;
  }

  // Hide water, no-data and very low values.
  if (value < 0.05) {
    return null;
  }

  const ndviClass = NDVI_CLASSES.find(
    (item) => value >= item.min && value < item.max
  );

  return ndviClass?.color ?? null;
};