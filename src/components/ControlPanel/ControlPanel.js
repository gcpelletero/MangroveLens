import styles from './ControlPanel.module.scss';

const YEARS = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];

const yearOf = (value) => value ? String(value).slice(0, 4) : '';

export default function ControlPanel({
  startDate,
  endDate,
  onDateChange,
  onUpdateMap,
  isUpdating = false,
  error = null,
  regions = [],
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
  referenceSource = 'gmw',
  onReferenceSourceChange
}) {
  const currentYear = yearOf(endDate);
  const historicalYear = yearOf(startDate);
  const isMvi = selectedLayer === 'mvi';
  const isInvalidRange = !isMvi && historicalYear && currentYear &&
    Number(historicalYear) > Number(currentYear);
  const canUpdate = isMvi
    ? Boolean(currentYear)
    : Boolean(historicalYear && currentYear && !isInvalidRange);

  const chooseMviYear = (year) => onDateChange({
    startDate: '',
    endDate: year + '-12-31'
  });

  const chooseHistoricalYear = (year) => onDateChange({
    startDate: year ? year + '-01-01' : '',
    endDate
  });

  const chooseCurrentYear = (year) => onDateChange({
    startDate,
    endDate: year ? year + '-12-31' : ''
  });

  return (
    <aside className={styles.panel} aria-label="Map controls">
      <div className={styles.section}>
        <label className={styles.label} htmlFor="focus-region">Focus area</label>
        <select
          id="focus-region"
          className={styles.select}
          value={selectedRegion || ''}
          onChange={(event) => onRegionChange(event.target.value)}
          disabled={isUpdating}
        >
          <option value="">Select region</option>
          {regions.map((region) => (
            <option key={region.ADM1_PCODE} value={region.ADM1_PCODE}>
              {region.ADM1_EN}
            </option>
          ))}
        </select>

        {selectedRegion && (
          <select
            aria-label="Province"
            className={styles.select}
            value={selectedProvince || ''}
            onChange={(event) => onProvinceChange(event.target.value)}
            disabled={isUpdating}
          >
            <option value="">Select province</option>
            {provinces.map((province) => (
              <option key={province.ADM2_PCODE} value={province.ADM2_PCODE}>
                {province.ADM2_EN}
              </option>
            ))}
          </select>
        )}

        {selectedProvince && (
          <select
            aria-label="Municipality"
            className={styles.select}
            value={selectedMunicipality || ''}
            onChange={(event) => onMunicipalityChange(event.target.value)}
            disabled={isUpdating}
          >
            <option value="">All municipalities</option>
            {municipalities.map((municipality) => (
              <option key={municipality.ADM3_PCODE} value={municipality.ADM3_PCODE}>
                {municipality.ADM3_EN}
              </option>
            ))}
          </select>
        )}
        <p className={styles.helper}>
          Earth Engine map layers currently cover the Palawan pilot area.
          Municipality selection is not yet a separate raster clip.
        </p>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionHeading}>
          <span>{isMvi ? 'Observation year' : 'Observation period'}</span>
          {currentYear && <span className={styles.yearBadge}>{currentYear}</span>}
        </div>

        {isMvi ? (
          <>
            <div className={styles.yearGrid} role="group" aria-label="Observation year">
              {YEARS.map((year) => (
                <button
                  key={year}
                  type="button"
                  disabled={isUpdating}
                  className={currentYear === year ? styles.yearActive : styles.yearButton}
                  aria-pressed={currentYear === year}
                  onClick={() => chooseMviYear(year)}
                >
                  {year}
                </button>
              ))}
            </div>
            <p className={styles.helper}>
              Annual Sentinel-2 MVI-derived mangrove candidate extent, 2019–2025.
            </p>
          </>
        ) : (
          <div className={styles.periodFields}>
            <label className={styles.label} htmlFor="historical-year">
              {selectedLayer === 'ndvi' ? 'Start year' : 'Historical year'}
            </label>
            <select
              id="historical-year"
              className={styles.select}
              value={historicalYear}
              onChange={(event) => chooseHistoricalYear(event.target.value)}
              disabled={isUpdating}
            >
              <option value="">Select year</option>
              {YEARS.map((year) => <option value={year} key={year}>{year}</option>)}
            </select>
            <label className={styles.label} htmlFor="current-year">
              {selectedLayer === 'ndvi' ? 'End year' : 'Current year'}
            </label>
            <select
              id="current-year"
              className={styles.select}
              value={currentYear}
              onChange={(event) => chooseCurrentYear(event.target.value)}
              disabled={isUpdating}
            >
              <option value="">Select year</option>
              {YEARS.map((year) => <option value={year} key={year}>{year}</option>)}
            </select>
            {isInvalidRange && (
              <p className={styles.error}>Historical year cannot be later than current year.</p>
            )}
          </div>
        )}
      </div>

      {isMvi && (
        <div className={styles.section}>
          <div className={styles.sectionHeading}>Reference layer</div>
          <select
            className={styles.select}
            aria-label="Reference layer"
            disabled={isUpdating}
            value={showReferenceOutline ? 'gmw' : 'none'}
            onChange={(event) => {
              const enabled = event.target.value === 'gmw';
              onShowReferenceOutlineChange?.(enabled);
              if (enabled) onReferenceSourceChange?.('gmw');
            }}
          >
            <option value="none">MVI candidate extent</option>
            <option value="gmw">MVI + same-year GMW outline</option>
          </select>
          {showReferenceOutline && referenceSource === 'gmw' && (
            <p className={styles.helper}>
              GMW is an independent comparison reference, not ground truth.
              The current map draws its outline rather than a four-class agreement raster.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        className={styles.updateButton}
        onClick={() => onUpdateMap(startDate, endDate)}
        disabled={isUpdating || !canUpdate}
      >
        {isUpdating ? 'Updating map…' : 'Update map view'}
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}

      <p className={styles.footnote}>
        <span className={styles.dot} />
        Results are provisional satellite-derived observations, not field-validated ground truth.
      </p>
    </aside>
  );
}
