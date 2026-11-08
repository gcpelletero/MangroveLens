import styles from './ControlPanel.module.scss';

const YEARS = ['2019','2020','2021','2022','2023','2024','2025'];
const yearOf = (date) => date ? String(date).slice(0,4) : '';

export default function ControlPanel({
  startDate, endDate, onDateChange, onUpdateMap, onLayerChange,
  isUpdating=false, error=null, selectedLayer, selectedMunicipality,
  onMunicipalityChange, municipalities=[],

  showReferenceOutline=false, onShowReferenceOutlineChange,
  onReferenceSourceChange,
  showPersistentOverlay=false, onShowPersistentOverlayChange

}) {
  const isMvi = selectedLayer === 'mvi';
  const selectedYear = yearOf(endDate);
  const historicalYear = yearOf(startDate);
  const invalidRange = !isMvi && historicalYear && selectedYear &&
    Number(historicalYear) > Number(selectedYear);
  const canApply = isMvi ? Boolean(selectedYear) :
    Boolean(historicalYear && selectedYear && !invalidRange);
  const setMviYear = (year) => onDateChange({startDate:'',endDate:year+'-12-31'});
  const setStartYear = (year) => onDateChange({startDate:year ? year+'-01-01' : '',endDate});
  const setEndYear = (year) => onDateChange({startDate,endDate:year ? year+'-12-31' : ''});

  return (
    <aside className={styles.panel} aria-label="Map filters">
      <h2 className={styles.heading}>Explore your coastline</h2>
      <p className={styles.description}>Choose a location and year to explore satellite-derived maps.</p>

      <div className={styles.field}>
        <label htmlFor="ml-study-region">Study region</label>
        <select id="ml-study-region" value="palawan" disabled aria-label="Study region (Palawan pilot)">
          <option value="palawan">Palawan</option>
        </select>
      </div>
      <div className={styles.field}>
        <label htmlFor="ml-focus-area">Focus area</label>
        <select id="ml-focus-area"
          value={selectedMunicipality || ''}
          disabled={isUpdating}
          onChange={(event)=>onMunicipalityChange(event.target.value)}>
          <option value="">All of Palawan</option>
          {municipalities.map((m)=>(
            <option key={m.ADM3_PCODE} value={m.ADM3_PCODE}>{m.ADM3_EN}</option>
          ))}
        </select>
        {selectedMunicipality && <p className={styles.help}>Municipality selection does not yet clip the satellite layer.</p>}
      </div>

      <div className={styles.rule}/>
      {isMvi ? (
        <>
          <div className={styles.yearHead}>
            <strong>Observation year</strong>
            {selectedYear && <span className={styles.yearTag}>{selectedYear}</span>}
          </div>
          <div className={styles.yearOptions} role="group" aria-label="Observation year">
            {YEARS.map((year)=>(
              <button key={year} type="button" disabled={isUpdating}
                aria-pressed={selectedYear===year}
                className={selectedYear===year ? styles.yearActive : styles.yearButton}
                onClick={()=>setMviYear(year)}>{year}</button>
            ))}
          </div>
          <p className={styles.help}>Annual Sentinel-2 MVI-derived candidate extent: 2019–2025</p>
        </>
      ):(
        <>
          <div className={styles.yearHead}><strong>Observation period</strong></div>
          <div className={styles.field}>
            <label htmlFor="ml-start-year">Historical year</label>
            <select id="ml-start-year" disabled={isUpdating} value={historicalYear}
              onChange={(event)=>setStartYear(event.target.value)}>
              <option value="">Select year</option>
              {YEARS.map((y)=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="ml-end-year">Current year</label>
            <select id="ml-end-year" disabled={isUpdating} value={selectedYear}
              onChange={(event)=>setEndYear(event.target.value)}>
              <option value="">Select year</option>
              {YEARS.map((y)=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="ml-analysis-layer">Analysis layer</label>
            <select id="ml-analysis-layer" disabled={isUpdating} value={selectedLayer}
              onChange={(event)=>onLayerChange(event.target.value)}>
              <option value="ndvi">NDVI vegetation condition</option>
              <option value="decline">Candidate change</option>
            </select>
          </div>
          {invalidRange && <p className={styles.error}>Historical year cannot be later than current year.</p>}
        </>
      )}
      <div className={styles.rule}/>
      {isMvi && (
        <div className={styles.field}>
          <label htmlFor="ml-reference-layer">Reference layer</label>
          <select id="ml-reference-layer" disabled={isUpdating}
            value={showReferenceOutline ? 'gmw' : 'mvi'}
            onChange={(event)=>{
              const enabled=event.target.value==='gmw';
              onShowReferenceOutlineChange?.(enabled);
              if(enabled)onReferenceSourceChange?.('gmw');
            }}>
            <option value="mvi">MVI candidate extent</option>
            <option value="gmw">MVI + same-year GMW outline</option>
          </select>
        </div>
      )}


      {selectedLayer === 'ndvi' && (
        <div className={styles.field}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer'
            }}
          >
            <input
              type="checkbox"
              checked={showPersistentOverlay}
              onChange={(event) =>
                onShowPersistentOverlayChange?.(event.target.checked)
              }
            />
            <span>Show Persistent Areas (2019–2025)</span>
          </label>
        </div>
      )}


      <button className={styles.apply} type="button" disabled={isUpdating || !canApply}
        onClick={()=>onUpdateMap(startDate,endDate)}>
        {isUpdating ? 'Updating map…' : 'Update map view'}
      </button>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <p className={styles.note}><span className={styles.dot}/>Provisional observations only. GMW is a comparison reference, not ground truth.</p>
    </aside>
  );
}
