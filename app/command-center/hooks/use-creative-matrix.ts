'use client';
import { useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizeTaxonomyRow } from '../../../lib/domain/taxonomy.js';
import { indexMatrix, matrixKey, matrixSearchMatches, classifyMatrixCell, matrixDecisions, sortMatrixAngles, normalizeMatrixInspiration, matrixDateRange, moveMatrixAngle } from '../../../lib/domain/creative-matrix.js';
import { readProductRows } from '../../../lib/services/product-rows.js';
import { inspirationQueueStatus } from '../../../lib/domain/inspiration-library.js';
import { loadTrackerData, trackerRpc } from '../services/tracker';
import { useTrackerActions } from './use-tracker-actions';
import { useLiveQuery, type RefreshOptions } from './use-live-query';
import { useReconciledState } from './use-reconciled-state';
import { useMatrixPreferences } from './use-matrix-preferences';
import { addCreativeToPlan,pushPlanCreative,type CreationJob } from '../services/plan-workflow';
import type { Creative, MatrixSelection, MatrixInspectorTab, TaxonomyRow } from '../types';

export type MatrixRecord = { id: string; product_id: string; angle_id: string; persona_id: string; creative_assignments: string[]; meta?: { _excludedCreativeIds?: string[] }; updated_at?: string };
export type MatrixInspiration = ReturnType<typeof normalizeMatrixInspiration> & { version: string };
export function useCreativeMatrix({ supabase, activeProductId }: { supabase: SupabaseClient; activeProductId: string }) {
  const [angles,setAngles] = useReconciledState<TaxonomyRow[]>([]);
  const [personas,setPersonas] = useReconciledState<TaxonomyRow[]>([]);
  const [creatives,setCreatives] = useReconciledState<Creative[]>([]);
  const [cells,setCells] = useReconciledState<MatrixRecord[]>([]);
  const [inspirations,setInspirations] = useReconciledState<MatrixInspiration[]>([]);
  const [plannedIds,setPlannedIds] = useReconciledState<string[]>([]);
  const [creationJobs,setCreationJobs] = useReconciledState<CreationJob[]>([]);
  const [selection,setSelection] = useState<MatrixSelection | null>(null);
  const [inspectorTab,setInspectorTab] = useState<MatrixInspectorTab>('creatives');
  const [loadedAt,setLoadedAt] = useState('');
  const [error,setError] = useState('');
  const [busyAction,setBusyAction] = useState('');
  const preferences = useMatrixPreferences(activeProductId);
  const actions = useTrackerActions(supabase,activeProductId,(creative) => setCreatives((rows) => rows.map((row) => row.id===creative.id ? creative : row)));
  const request = useRef<{ input: string; id: string } | null>(null);
  const live = useLiveQuery({ supabase,productId:activeProductId,tables:['ads','angles','personas','matrix_cells','inspirations','inspiration_queue','manual_actions','qa_clickup_creations'],enabled:!!activeProductId,load,
    onMutationError:setError,onMutationEnd:() => { setBusyAction(''); actions.setBusyAction(''); } });
  async function load(signal: AbortSignal, options: RefreshOptions) {
    const [data,inspo,plan,jobs,queue] = await Promise.all([loadTrackerData(supabase,activeProductId,signal),readProductRows(supabase,'inspirations',activeProductId,signal),
      readProductRows(supabase,'manual_actions',activeProductId,signal),readProductRows(supabase,'qa_clickup_creations',activeProductId,signal),readProductRows(supabase,'inspiration_queue',activeProductId,signal)]);
    const queueById = new Map(queue.map((row) => [row.ins_id,row]));
    return () => {
      setAngles(data.angles.map(normalizeTaxonomyRow)); setPersonas(data.personas.map(normalizeTaxonomyRow));
      setCreatives(data.creatives); setCells(data.cells);
      setPlannedIds(plan.map((row) => row.payload?.sourceAdId || row.payload?.adId || row.payload?._sourceAdId).filter(Boolean));
      setCreationJobs(jobs);
      setInspirations(inspo.map((row) => ({ ...normalizeMatrixInspiration({...row,status:inspirationQueueStatus(row.status,queueById.get(row.id))}),version:row.updated_at })));
      if (!options.background) setLoadedAt(new Date().toISOString());
    };
  }
  const index = useMemo(() => indexMatrix({ productId:activeProductId,angles,personas,creatives,cells }),[activeProductId,angles,personas,creatives,cells]);
  const filters = preferences.preferences;
  const states = useMemo(() => {
    const result = new Map<string,ReturnType<typeof classifyMatrixCell>>();
    for (const angle of index.angles) for (const persona of index.personas) {
      const key=matrixKey(angle.id,persona.id); result.set(key,classifyMatrixCell(index.byCell.get(key)||[],filters));
    }
    return result;
  },[index,filters]);
  const decisions = matrixDecisions(states);
  const visibleAngles = sortMatrixAngles(index.angles,states,filters).filter((angle) => !filters.search || index.personas.some((persona) =>
    matrixSearchMatches(filters.search, angle.name, persona.name, states.get(matrixKey(angle.id,persona.id))?.ads || [])));
  const visiblePersonas = index.personas.filter((persona) => (!filters.personaId || persona.id===filters.personaId) && (filters.showAll || visibleAngles.some((angle) => states.get(matrixKey(angle.id,persona.id))?.total)));
  const key = selection ? matrixKey(selection.angleId,selection.personaId) : '';
  const selectedAngle = index.angles.find((angle) => angle.id===selection?.angleId);
  const selectedPersona = index.personas.find((persona) => persona.id===selection?.personaId);
  const selectedCreatives = (index.byCell.get(key)||[]) as Creative[];
  const selectedCell = index.records.get(key) as MatrixRecord | undefined;
  const run = <Args extends unknown[]>(fn: (...args: Args) => Promise<unknown>) => live.mutate(async (...args: Args) => {
    setError(''); actions.setNotice(''); return fn(...args);
  });
  async function create(kind: string, items: Record<string,unknown>[], toPlan=false) {
    if (!selection || !selectedAngle || !selectedPersona) throw new Error('Choose an active cell.');
    setBusyAction('create');
    const input={ p_product_id:activeProductId,p_angle_id:selection.angleId,p_persona_id:selection.personaId,p_kind:kind,p_items:items };
    const signature=JSON.stringify(input);
    if (request.current?.input!==signature) request.current={ input:signature,id:crypto.randomUUID() };
    const ids=await trackerRpc(supabase,'qa_matrix_create',{ ...input,p_request_id:request.current.id });
    request.current=null;
    let staged=0;
    if(toPlan) {
      try {
        const rows=await readProductRows(supabase,'ads',activeProductId);
        for(const id of ids) {
          const row=rows.find(row=>row.id===id);
          if(!row) throw new Error('A created creative could not be reloaded.');
          await addCreativeToPlan(supabase,activeProductId,id,row.updated_at);
          staged++;
          setPlannedIds(current=>current.includes(id) ? current : [...current,id]);
        }
      } catch(cause) {
        setError(`Creatives were created, but only ${staged}/${ids.length} were added to Action Plan. Use each row's Plan button for the rest. ${cause instanceof Error ? cause.message : ''}`);
      }
    }
    setInspectorTab('creatives'); actions.setNotice(`${ids.length} creatives available in this cell.${toPlan ? ` ${staged} added to Action Plan.` : ''}`);
  }
  async function assignment(creative: Creative, assigned: boolean) {
    if (!selection) return;
    setBusyAction('assignment');
    await trackerRpc(supabase,'qa_matrix_assignment',{ p_product_id:activeProductId,p_angle_id:selection.angleId,p_persona_id:selection.personaId,
      p_ad_id:creative.id,p_assigned:assigned,p_expected_updated_at:selectedCell?.updated_at||null });
    actions.setNotice(assigned ? 'Creative restored to this cell.' : 'Removed from this cell. The creative and its Action Plan entry were retained.');
  }
  function reorder(source: string,target: string) { preferences.change('manualOrder',moveMatrixAngle(sortMatrixAngles(index.angles,states,filters).map((a) => a.id),source,target)); }
  async function stage(creative:Creative) {
    setBusyAction('plan'); await addCreativeToPlan(supabase,activeProductId,creative.id,creative.version);
    setPlannedIds((ids) => ids.includes(creative.id) ? ids : [...ids,creative.id]);
    actions.setNotice('Creative added to Action Plan.');
  }
  async function pushPlan(creative:Creative, taskId?:string) {
    setBusyAction('push-plan'); actions.setNotice(await pushPlanCreative(supabase,activeProductId,creative.id,taskId));
  }
  return { db:supabase, ...preferences, angles:index.angles,personas:index.personas,visibleAngles,visiblePersonas,states,decisions,index,creatives,inspirations,
    plannedIds,creationJobs,stage:run(stage),pushPlan:run(pushPlan),
    selectedAngle,selectedPersona,selectedCreatives,selectedCell,selection,setSelection,inspectorTab,setInspectorTab,reorder,
    selectCell:(angleId: string,personaId: string) => { setSelection({angleId,personaId}); setInspectorTab('creatives'); setError(''); actions.setNotice(''); },
    create:run(create),assignment:run(assignment),loadedAt,reload:live.refresh,busy:live.busy,busyAction:busyAction||actions.busyAction,error:error||live.error,
    range:matrixDateRange(filters),filled:[...states.values()].filter((state) => state.total).length,
    actions:{ ...actions, save:run(actions.save),remove:run(actions.remove),spawn:run(actions.spawn),winner:run(actions.winner),shareWinner:run(actions.shareWinner),loadSchema:run(actions.loadSchema),push:run(actions.push),
      open:(kind:'edit'|'spawn'|'winners'|'delete', creative:Creative) => { setError('');actions.setNotice('');actions.setEditor({kind,creative}); } },
  };
}
export type MatrixModel = ReturnType<typeof useCreativeMatrix>;
