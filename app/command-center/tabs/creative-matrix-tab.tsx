import { useEffect, useState } from 'react';
import { resolvePlanMatrixCell } from '../../../lib/domain/action-plan-presentation.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useCreativeMatrix } from '../hooks/use-creative-matrix';
import { MatrixControls } from '../components/matrix-controls';
import { MatrixGrid } from '../components/matrix-grid';
import { MatrixInspector } from '../components/matrix-inspector';
import styles from '../../command-center.module.css';

export function CreativeMatrixTab({ supabase, activeProductId, target, consumeTarget }: {
  supabase: SupabaseClient; activeProductId: string; target?: { angle: string; persona: string } | null; consumeTarget?: () => void;
}) {
  const model=useCreativeMatrix({supabase,activeProductId});
  const [navigationError, setNavigationError] = useState('');
  const { loadedAt, angles, personas, setSelection, setInspectorTab } = model;
  useEffect(() => {
    if (!target || !loadedAt) return;
    const cell = resolvePlanMatrixCell(target, angles, personas);
    if (cell) { setSelection(cell); setInspectorTab('creatives'); }
    else setNavigationError(`The cell ${target.angle} x ${target.persona} is missing, archived, or ambiguous.`);
    consumeTarget?.();
  }, [target, loadedAt, angles, personas, setSelection, setInspectorTab, consumeTarget]);
  const coverage = model.states.size ? Math.round(model.filled / model.states.size * 100) : 0;
  const descriptions = { winners: `winning cells of ${model.states.size}`, replicate: 'winning cells with fewer than 3 creatives', gaps: 'gaps in winning rows / columns', kill: 'cells with 2+ losers, 0 winners' };
  return <div className={styles.matrixWorkspace}>
    {model.error && !model.selection ? <p role="alert" className={styles.error}>{model.error}</p> : null}
    {navigationError ? <p role="alert" className={styles.error}>{navigationError}</p> : null}
    <p className={styles.matrixCoverage}>Coverage <strong>{coverage}%</strong> &middot; {model.filled} / {model.states.size} cells filled</p>
    <section className={styles.matrixDecisionStrip} aria-label="Matrix opportunities">
      {Object.entries({ winners:"Where's the money",replicate:'Replicate next',gaps:'Test next',kill:'Kill list' }).map(([key,label]) => <button type="button" key={key} data-opportunity={key} aria-pressed={model.preferences.overlay===key} onClick={() => model.change('overlay',model.preferences.overlay===key ? '' : key)}>
        <span>{label}</span><strong>{model.decisions[key as keyof typeof model.decisions].length}</strong><small>{descriptions[key as keyof typeof descriptions]}</small>
        <span className={styles.matrixDecisionMeter} aria-hidden="true"><i style={{ width: `${Math.min(100, model.decisions[key as keyof typeof model.decisions].length / Math.max(1, model.states.size) * 100)}%` }} /></span>
      </button>)}
    </section>
    <MatrixControls model={model} />
    <header className={styles.matrixHeading}><h2>Creative Matrix</h2><span>{model.visibleAngles.length} angles &times; {model.visiblePersonas.length} active personas</span></header>
    <MatrixGrid model={model} />
    {model.selection && model.selectedAngle && model.selectedPersona ? <MatrixInspector key={JSON.stringify(model.selection)} model={model} /> : null}
  </div>;
}
