import { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Plus } from 'lucide-react';
import { matrixBucket, matrixKey, matrixSearchMatches } from '../../../lib/domain/creative-matrix.js';
import type { MatrixModel } from '../hooks/use-creative-matrix';
import styles from '../../command-center.module.css';

const statusNames: Record<string,string> = { winner:'Winner', testing:'Testing', loser:'Kill', mixed:'Mixed', prelaunch:'In Prod', untested:'New' };
export function MatrixGrid({ model:m }: { model:MatrixModel }) {
  const [drag,setDrag]=useState('');
  const f=m.preferences;
  return <div className={styles.matrixGridScroll} role="region" aria-label="Angle by persona matrix" tabIndex={0}>
    <table className={styles.matrixGridTable} data-density={f.density} style={{ width: `calc(var(--matrix-angle) + ${m.visiblePersonas.length * (f.density==='compact' ? 140 : f.density==='detailed' ? 220 : 155)}px)` }}>
      <colgroup><col style={{width:'var(--matrix-angle)'}} />{m.visiblePersonas.map((persona) => <col key={persona.id} />)}</colgroup>
      <thead><tr><th scope="col"><span className={styles.matrixCorner}>Angle / Persona</span></th>{m.visiblePersonas.map((p) => <th key={p.id} scope="col"><span className={styles.matrixPersonaName} title={p.name} tabIndex={0}>{p.name}</span></th>)}</tr></thead>
      <tbody>{m.visibleAngles.map((angle,index) => {
        const filled = m.visiblePersonas.filter((p) => m.states.get(matrixKey(angle.id,p.id))?.total).length;
        const coverage = m.visiblePersonas.length ? Math.round(filled / m.visiblePersonas.length * 100) : 0;
        return <tr key={angle.id} data-angle-id={angle.id}
          onDragOver={(e) => { if (drag && f.sort==='manual') e.preventDefault(); }} onDrop={(e) => { e.preventDefault(); if (drag && f.sort==='manual') m.reorder(drag,angle.id); setDrag(''); }}>
          <th scope="row" data-status={matrixBucket(angle.status)}><div className={styles.matrixAngleHeader}>
            {f.sort==='manual' ? <div className={styles.matrixRowActions}>
              <button draggable type="button" title="Drag angle row" aria-label={`Drag ${angle.name}`} onDragStart={(e) => { e.dataTransfer.setData('text/plain',angle.id);setDrag(angle.id); }} onDragEnd={() => setDrag('')}><GripVertical size={13} /></button>
              <button type="button" disabled={index===0} aria-label={`Move ${angle.name} up`} title="Move angle up" onClick={() => m.reorder(angle.id,m.visibleAngles[index-1].id)}><ArrowUp size={12} /></button>
              <button type="button" disabled={index===m.visibleAngles.length-1} aria-label={`Move ${angle.name} down`} title="Move angle down" onClick={() => m.reorder(angle.id,m.visibleAngles[index+1].id)}><ArrowDown size={12} /></button>
            </div> : null}
            <strong className={styles.matrixAngleName} title={angle.name}>{angle.name}</strong>
            <span className={styles.matrixStatusChip} data-status={matrixBucket(angle.status)}>{angle.status || 'Untested'}</span>
            <div className={styles.matrixAngleCoverage}><span><i style={{width:`${coverage}%`}} /></span><small>{coverage}%</small></div>
            <small className={styles.matrixAngleStat}>{filled} / {m.visiblePersonas.length} active</small>
          </div></th>
          {m.visiblePersonas.map((persona) => {
            const key=matrixKey(angle.id,persona.id), state=m.states.get(key)!;
            const highlighted=!f.overlay || (m.decisions[f.overlay as keyof typeof m.decisions]||[]).includes(key);
            const dim=!state.matches || !highlighted || !matrixSearchMatches(f.search,angle.name,persona.name,state.ads);
            return <td key={persona.id}><button type="button" data-matrix-cell={key} data-dominant={state.dominant}
              className={`${styles.matrixCellButton} ${dim ? styles.matrixCellMuted : ''}`} onClick={() => m.selectCell(angle.id,persona.id)}
              aria-label={`${angle.name} x ${persona.name}: ${state.total} creatives`}
              title={`${state.total} in view; ${state.lifetimeTotal} lifetime. ${Object.entries(state.counts).map(([s,n]) => `${s}: ${n}`).join(', ')}`}>
              {state.total ? <>
                <span className={styles.matrixCellTop}><span>{state.total} creative{state.total===1 ? '' : 's'}</span><span className={styles.matrixStatusChip} data-status={state.dominant}>{statusNames[state.dominant]}</span></span>
                {state.total!==state.lifetimeTotal ? <small>{state.lifetimeTotal} lifetime</small> : null}
                <span className={styles.matrixStatusBar} aria-hidden="true">{Object.entries(state.counts).filter(([,n]) => n).map(([s,n]) => <i key={s} data-status={s} style={{flex:n}} />)}</span>
                {f.density!=='compact' ? <span className={styles.matrixCellChips}>{Object.entries(state.counts).filter(([,n]) => n).map(([s,n]) => <span key={s} className={styles.matrixStatusChip} data-status={s}>{statusNames[s]} {n}</span>)}</span> : null}
                {f.density==='detailed' ? <span className={styles.matrixCreativePreview}>{state.ads.slice(0,3).map((ad) => <span key={ad.id} title={ad.formatName || ad.id}>{ad.formatName || ad.id}</span>)}</span> : null}
                <span className={styles.matrixCellFooter}><span className={styles.matrixFunnels}>{['TOF','MOF','BOF'].map((stage) => <span key={stage} data-active={state.ads.some((ad) => ad.funnelStage===stage)} title={`${stage}: ${state.ads.filter((ad) => ad.funnelStage===stage).length}`}><i />{stage[0]}</span>)}</span>{state.stale ? <small>Stale</small> : null}</span>
              </> : <span className={styles.matrixEmptyCell}>{state.lifetimeTotal ? <><strong>0 / {state.lifetimeTotal}</strong><small>No creatives in window</small></> : <><Plus size={21} strokeWidth={1.5} /><small>Untested</small></>}</span>}
              {m.index.unresolved.get(key) ? <small>{m.index.unresolved.get(key)} unresolved references</small> : null}
            </button></td>;
          })}
        </tr>;
      })}</tbody>
    </table>
    {!m.visibleAngles.length || !m.visiblePersonas.length ? <p className={styles.emptyState}>No active axes match this view.</p> : null}
  </div>;
}
