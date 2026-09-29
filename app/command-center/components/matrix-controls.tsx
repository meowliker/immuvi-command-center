import { Grid2X2, List, Rows3, RotateCcw, RefreshCw, X, ChevronDown } from 'lucide-react';
import { MATRIX_SORTS } from '../../../lib/domain/creative-matrix.js';
import { AD_TYPES, FUNNEL_STAGES } from '../../../lib/domain/tracker-editing.js';
import type { MatrixModel } from '../hooks/use-creative-matrix';
import styles from '../../command-center.module.css';

export function MatrixControls({ model:m }: { model:MatrixModel }) {
  const f=m.preferences;
  return <section className={styles.matrixControls} aria-label="Matrix controls">
    <div className={styles.matrixControlGroup}>
      <div className={styles.matrixSearch}><input aria-label="Search matrix" type="search" placeholder="Search creative name or ID..." value={f.search} onChange={(e) => m.change('search',e.target.value)} />
        <button type="button" aria-label="Clear matrix search" title="Clear search" disabled={!f.search} onClick={() => m.change('search','')}><X size={14} /></button></div>
      <span className={styles.matrixFilterLabel}>Filter</span>
      <select aria-label="Matrix source" value={f.source} onChange={(e) => m.change('source',e.target.value)}><option value="">All sources</option><option value="app">App</option><option value="clickup">ClickUp</option><option value="inspo">Inspiration</option></select>
      <select aria-label="Matrix funnel" value={f.funnel} onChange={(e) => m.change('funnel',e.target.value)}><option value="">All funnels</option>{FUNNEL_STAGES.map((v) => <option key={v}>{v}</option>)}</select>
      <select aria-label="Matrix ad type" value={f.adType} onChange={(e) => m.change('adType',e.target.value)}><option value="">All types</option>{AD_TYPES.map((v) => <option key={v}>{v}</option>)}</select>
      <span className={styles.matrixFilterLabel}>Time</span>
      <select aria-label="Matrix date range" value={f.dateRange} onChange={(e) => m.change('dateRange',e.target.value)}>{Object.entries({ all:'All time',today:'Today',week:'Last 7 days','14d':'Last 14 days','30d':'Last 30 days',custom:'Custom range' }).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select>
      <div className={styles.matrixMode} role="group" aria-label="Date filter mode">{['scope','highlight'].map((mode) => <button key={mode} type="button" disabled={f.dateRange==='all'} aria-pressed={f.filterMode===mode} onClick={() => m.change('filterMode',mode)}>{mode==='scope' ? 'In window' : 'Lifetime'}</button>)}</div>
      <span className={styles.matrixFilterLabel}>Status</span>
      <details className={styles.matrixFilterMenu} onKeyDown={(event) => { if(event.key==='Escape') { event.currentTarget.open=false; event.currentTarget.querySelector('summary')?.focus(); } }}><summary>{f.statuses.length ? `${f.statuses.length} statuses` : 'All statuses'}<ChevronDown size={12} /></summary><div>
        {Object.entries({winner:'Winner',testing:'Testing',prelaunch:'In production / Ready',loser:'Loser',untested:'Untested'}).map(([value,label]) => <label key={value}><input type="checkbox" checked={f.statuses.includes(value)} onChange={(e) => m.change('statuses',e.target.checked ? [...f.statuses,value] : f.statuses.filter((v) => v!==value))} />{label}</label>)}
      </div></details>
    </div>
    {f.dateRange!=='all' ? <div className={styles.matrixControlGroup}>
      {f.dateRange==='custom' ? <><label>From<input aria-label="Matrix date from" type="date" value={f.dateFrom} onChange={(e) => m.change('dateFrom',e.target.value)} /></label><label>To<input aria-label="Matrix date to" type="date" value={f.dateTo} onChange={(e) => m.change('dateTo',e.target.value)} /></label></> : null}
      <label>Date basis<select aria-label="Matrix date basis" value={f.dateBasis} onChange={(e) => m.change('dateBasis',e.target.value)}><option value="created">Created</option><option value="status">Status changed</option><option value="updated">Last edit</option></select></label>
      {!m.range.valid ? <span role="alert" className={styles.error}>Invalid date range.</span> : null}
    </div> : null}
    <div className={styles.matrixControlGroup}>
      <span className={styles.matrixFilterLabel}>View</span>
      <select aria-label="Matrix sort" value={f.sort} onChange={(e) => m.change('sort',e.target.value)}>{Object.entries(MATRIX_SORTS).map(([id,label]) => <option key={id} value={id}>{label}</option>)}</select>
      <div role="group" aria-label="Matrix density" className={styles.matrixMode}>{[{name:'compact',label:'Compact',Icon:Grid2X2},{name:'comfortable',label:'Comfort',Icon:Rows3},{name:'detailed',label:'Detailed',Icon:List}].map(({name,label,Icon}) => <button key={name} type="button" aria-label={`${name} density`} title={`${name} density`} aria-pressed={f.density===name} onClick={() => m.change('density',name)}><Icon size={12} />{label}</button>)}</div>
      <label className={styles.matrixCheckbox}><input type="checkbox" checked={f.staleOnly} onChange={(e) => m.change('staleOnly',e.target.checked)} />Stale only</label>
      <label className={styles.matrixCheckbox}><input type="checkbox" checked={f.showAll} onChange={(e) => m.change('showAll',e.target.checked)} />Show all personas</label>
      <select aria-label="Matrix persona" value={f.personaId} onChange={(e) => m.change('personaId',e.target.value)}><option value="">All personas</option>{m.personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <button type="button" title="Refresh Matrix from QA" aria-label="Refresh Matrix" disabled={m.busy||!!m.busyAction} onClick={() => void m.reload()}><RefreshCw size={13} />Refresh</button>
      <button type="button" title="Reset Matrix filters" aria-label="Reset Matrix filters" onClick={m.reset}><RotateCcw size={14} /></button>
    </div>
  </section>;
}
