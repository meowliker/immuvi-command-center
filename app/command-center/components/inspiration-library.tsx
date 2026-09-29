'use client';
import { useId, useState, type ReactNode } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, Ellipsis, ExternalLink, FileText, RotateCcw, X, Columns3, CircleAlert, Plus, Trash2, Monitor, CircleDot, Magnet, Video, ChartNoAxesCombined, LayoutGrid, Package } from 'lucide-react';
import { INSPIRATION_FILTERS } from '../../../lib/domain/inspiration-library.js';
import { INSPIRATION_OPTIONS, inspirationRelativeDate, inspirationUsageCounts } from '../../../lib/domain/inspiration-table.js';
import type { Inspiration, useInspirationLibrary } from '../hooks/use-inspiration-library';
import { InspirationInline, type InlineDraft } from './inspiration-inline';
import { InspirationMappingCue } from './inspiration-mapping-cue';
import { InspirationStatus } from './inspiration-status';
import { PrivateInspirationRetry } from './private-inspiration-retry';
import { useAnchoredPopover } from '../hooks/use-anchored-popover';
import styles from '../inspiration.module.css';

const columns = [['id','#'],['formatName','Format Name'],['brand','Brand'],['angle','Angle'],['persona','Persona'],['creativeStructure','Structure'],['hookType','Hook'],['productionStyle','Production'],['funnelStage','Funnel'],['adType','Type'],['platform','Platform'],['hypothesis','Hypothesis'],['notes','Notes'],['bodyCopy','Ad Copy'],['sourceUrl','Source'],['duration','Duration'],['status','Status'],['createdAt','Created'],['addedBy','Added By'],['usage','Cells'],['briefUrl','Brief'],['tags','Tags'],['reuse','Reuse'],['actions','Actions']] as const;
const expandedFields=new Set(['hypothesis','notes','bodyCopy','duration','tags','reuse']);
const textFields:Record<string,string>={formatName:'formatName',hypothesis:'creativeHypothesis',notes:'notes',addedBy:'addedBy'};
const selectFields=new Set(['angle','persona','creativeStructure','hookType','productionStyle','funnelStage','adType']);
const nonsort=new Set(['usage','briefUrl','tags','reuse','actions','sourceUrl']);
const facets=[['platform','Platform',Monitor],['status','Status',CircleDot],['hookType','Hook',Magnet],['adType','Type',Video],['performance','Performance',ChartNoAxesCombined],['formatName','Format',LayoutGrid],['source','Source',Package]] as const;
const optionLabels:Record<string,string>={winner:'Has winner',loser:'Has loser',original:'Original only',imported:'Imported only'};
export function InspirationLibrary({library,clearFilters,context,db,run,notice,remove,now,map,navigation,showTable=true}:{library:ReturnType<typeof useInspirationLibrary>;navigation?:ReactNode;showTable?:boolean;clearFilters?:()=>void;context?:{loaded:boolean;error:string;byId:Record<string,any>};db:SupabaseClient;run:(op:()=>Promise<unknown>)=>Promise<unknown>;notice:(message:string)=>void;remove:(row:Inspiration)=>void;now:number;map:(row:Inspiration,kind:'angle'|'persona',target?:string)=>void}) {
  const {rows,visible,filters,setFilters,sort,setSort}=library;
  const [expanded,setExpanded]=useState(false),[draft,setDraft]=useState<InlineDraft|null>(null);
  const menuId=useId();
  const menu=useAnchoredPopover();
  const controlsLocked=!!draft;
  const visibleColumns=columns.filter(([key])=>expanded || !expandedFields.has(key));
  const optionKeys=[...new Set([...selectFields,...facets.map(([key])=>key)])];
  const optionSets=Object.fromEntries(optionKeys.map((key)=>[key,new Set<string>([...(INSPIRATION_OPTIONS[key as keyof typeof INSPIRATION_OPTIONS] || []),...(library.taxonomy[key as 'angle'|'persona'] || [])])]));
  for(const row of rows)for(const key of optionKeys){const value=row[key as keyof Inspiration];if(typeof value==='string' && value)optionSets[key].add(value);}
  const optionLists=Object.fromEntries(Object.entries(optionSets).map(([key,values])=>[key,[...values]]));
  const options=(key:string)=>optionLists[key] || [];
  // Keep the mounted editor and its immutable receipt if a live change hides/deletes its row.
  const displayRows:Inspiration[]=draft && !visible.some((row:Inspiration)=>row.id===draft.row.id)?[draft.row,...visible]:visible;
  const open=(row:Inspiration,field:string,label:string,initial?:string,choices?:string[])=>setDraft({row,field,label,initial,options:choices});
  const canEdit=(row:Inspiration)=>!row.queueOnly && !!row.version && !library.error && !library.busy && !controlsLocked;
  const finish=(message:string)=>{setDraft(null);notice(message);};
  function cell(row:Inspiration,key:string,label:string) {
    const field=textFields[key] || key;
    if(draft?.row.id===row.id && draft.field===field)return <InspirationInline key={`${row.id}:${field}`} draft={draft} db={db} run={run} close={()=>setDraft(null)} done={finish}/>;
    const held=['Queued','Classifying','Blocked','Failed','Cancelled'].includes(row.status);
    if(key==='id')return <><button className={styles.rowButton} type="button" aria-label={`Open inspiration ${row.id}`} onClick={()=>library.setSelectedId(row.id)}>{row.id}</button>{row.duplicate && !row.duplicateReviewed?<button className={styles.duplicate} aria-label={`Duplicate review for ${row.id}`} title={row.duplicate} onClick={()=>library.setSelectedId(row.id)}><CircleAlert size={14}/></button>:null}</>;
    if(key==='formatName' && held)return <div className={styles.queueSummary}><span>{row.formatName || 'Pending classification'}</span></div>;
    if(held && ['brand','angle','persona','creativeStructure','hookType','productionStyle','funnelStage','adType','hypothesis','notes','bodyCopy','duration'].includes(key))return '-';
    if(selectFields.has(key))return <><select className={styles.inlineSelect} aria-label={`${label} for ${row.id}`} disabled={!canEdit(row)} value={String(row[key as keyof Inspiration] || '')} onChange={(event)=>event.target.value==='__custom__'?open(row,field,label):open(row,field,label,event.target.value,options(key))}><option value="">-</option>{options(key).map((value)=><option key={value}>{value}</option>)}{key==='angle' || key==='persona'?<option value="__custom__">Custom...</option>:null}</select>{key==='angle' || key==='persona'?<InspirationMappingCue compact={!expanded} row={row} kind={key} items={library.taxonomyRows[key]} creatives={library.creatives} disabled={!canEdit(row)} open={map}/>:null}</>;
    if(textFields[key])return <button type="button" className={styles.rowButton} disabled={!canEdit(row)} aria-label={`Edit ${label} for ${row.id}`} title={String(row[key as keyof Inspiration] || 'Edit')} onClick={()=>open(row,field,label)}>{String(row[key as keyof Inspiration] || '-')}</button>;
    if(key==='status')return <InspirationStatus id={row.id} status={row.status} error={row.queueError}>{!row.queueOnly && ['Failed','Blocked','Cancelled'].includes(row.status)?<PrivateInspirationRetry db={db} productId={row.productId} inspirationId={row.id} done={message=>{notice(message);void library.refresh({background:true});}}/>:null}</InspirationStatus>;
    if(key==='createdAt')return <time title={row.createdAt?new Date(row.createdAt).toLocaleString():''}>{inspirationRelativeDate(row.createdAt,now)}</time>;
    if(key==='sourceUrl')return row.sourceUrl?<a className={styles.sourceLink} href={row.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Source for ${row.id}`} title={row.sourceUrl}>{row.sourceUrl}<ExternalLink size={12}/></a>:'-';
    if(key==='usage')return <button type="button" className={styles.usagePill} aria-label={`Usage for ${row.id}`} title={`${row.cellCount} cells / ${row.usage.length} ads`} onClick={()=>library.setSelectedId(row.id)}>{row.usage.length?Object.entries(inspirationUsageCounts(row)).filter(([,count])=>count).map(([kind,count])=><span key={kind} data-kind={kind}>{count} {kind}</span>):'Unused'}</button>;
    if(key==='briefUrl') {const url=row.briefUrl || (!context?.error && context?.byId[row.id]?.inheritedBriefUrl);return url?<a className={styles.briefLink} href={url} target="_blank" rel="noopener noreferrer" aria-label={`Brief for ${row.id}`}><FileText size={13}/>Brief</a>:<button type="button" className={styles.briefButton} aria-label={`Find brief for ${row.id}`} title="Brief details" onClick={()=>library.setSelectedId(row.id)}><FileText size={15}/></button>;}
    if(key==='tags')return row.tags.length?row.tags.map((tag:string,index:number)=><span key={`${tag}:${index}`} className={styles.badge}>{tag}</span>):'-';
    if(key==='reuse')return <button type="button" className={styles.rowButton} aria-label={`Reuse for ${row.id}`} onClick={()=>library.setSelectedId(row.id)}>{context?.loaded && !context.error?`${(row.usage.length?1:0)+(context.byId[row.id]?.products.length || 0)} products`:'-'}</button>;
    if(key==='actions')return <div className={styles.rowActions}><button type="button" title="Use this format" aria-label={`Use format ${row.id}`} disabled={held || !canEdit(row)} onClick={()=>library.setSelectedId(row.id)}><Plus size={15}/></button><button type="button" title="Delete inspiration" aria-label={`Delete inspiration ${row.id}`} disabled={!canEdit(row)} onClick={()=>remove(row)}><Trash2 size={14}/></button></div>;
    return <span title={String(row[key as keyof Inspiration] || '')}>{String(row[key as keyof Inspiration] || '-')}</span>;
  }
  return <>
    {library.error?<p role="alert" className={styles.error}>{library.error} {library.loaded?'Previously loaded results are shown.':''}</p>:null}
    {draft && !visible.some((row:Inspiration)=>row.id===draft.row.id)?<p role="status">The edited row no longer matches the current view. Its draft is retained until saved or cancelled.</p>:null}
    <div className={styles.filters}>
      {facets.map(([key,label,Icon])=><label key={key} data-active={!!filters[key]}><Icon size={13}/><span>{filters[key]?optionLabels[filters[key]] || filters[key]:label}</span><ChevronDown size={10}/><select disabled={controlsLocked} aria-label={`Inspiration ${label.toLowerCase()}`} value={filters[key]} onChange={(event)=>setFilters({...filters,[key]:event.target.value})}><option value="">All {label.toLowerCase()}</option>{[...new Set([...options(key),filters[key]].filter(Boolean))].map((value)=><option key={value} value={value}>{optionLabels[value] || value}</option>)}</select></label>)}
      <input className={styles.search} disabled={controlsLocked} aria-label="Search inspirations" placeholder="Search inspirations..." value={filters.query} onChange={(event)=>setFilters({...filters,query:event.target.value})}/>
      <span aria-live="polite">{library.loaded?`${visible.length} / ${rows.length}`:'-'}</span>
    </div>
    {Object.values(filters).some(Boolean)?<div className={styles.chips}>{Object.entries(filters).filter(([,value])=>value).map(([key,value])=><button key={key} type="button" disabled={controlsLocked} aria-label={`Clear ${key} filter`} onClick={()=>setFilters({...filters,[key]:''})}>{key==='query'?'Search':facets.find(([field])=>field===key)?.[1]}: {value}<X size={12}/></button>)}</div>:null}
    <div className={styles.viewBar}>{navigation}<button ref={menu.trigger} type="button" className={styles.icon} popoverTarget={menuId} aria-label="Inspiration table options" title="Table options"><Ellipsis size={17}/></button>
      <div ref={menu.panel} id={menuId} popover="auto" className={styles.tableOptions}>
        <button type="button" disabled={controlsLocked} aria-label="Clear inspiration filters" onClick={clearFilters || (()=>setFilters({...INSPIRATION_FILTERS}))}><RotateCcw size={15}/>Clear filters</button>
        <button type="button" disabled={controlsLocked} aria-label="Expand inspiration columns" aria-pressed={expanded} onClick={()=>setExpanded(!expanded)}><Columns3 size={15}/>{expanded?'Hide detailed columns':'Show detailed columns'}</button>
        <button type="button" disabled={library.busy} aria-label="Refresh inspirations" onClick={()=>void library.refresh()}><RotateCcw size={15}/>Refresh</button>
      </div>
    </div>
    {!showTable?null:!library.loaded?<p role="status">{library.error?'Inspiration library unavailable.':'Loading inspirations...'}</p>:<>
      <div className={styles.tableWrap} tabIndex={0} role="region" aria-label="Inspiration library table"><table className={styles.table} data-expanded={expanded}><thead><tr>{visibleColumns.map(([key,label])=><th key={key} aria-sort={nonsort.has(key)?undefined:sort.key===key?sort.direction===1?'ascending':'descending':'none'}>{nonsort.has(key)?label:<button type="button" disabled={controlsLocked} onClick={()=>setSort({key,direction:sort.key===key?-sort.direction:1})}>{label}{sort.key!==key?<ArrowUpDown size={11}/>:sort.direction===1?<ArrowUp size={11}/>:<ArrowDown size={11}/>}</button>}</th>)}</tr></thead>
      <tbody>{displayRows.map((row)=><tr key={row.id} data-inspiration-id={row.id} data-imported={row.source==='imported'} data-status={row.status} aria-selected={library.selectedId===row.id}>{visibleColumns.map(([key,label])=><td key={key} data-field={key} data-editing={!!draft && draft.row.id===row.id && draft.field===(textFields[key] || key)}>{cell(row,key,label)}{key==='formatName' && (expanded || row.formatDetail) && (draft && draft.row.id===row.id && draft.field==='formatDetail' || !['Queued','Classifying','Blocked','Failed'].includes(row.status))?<div className={styles.formatDetail}>{draft && draft.row.id===row.id && draft.field==='formatDetail'?<InspirationInline key={`${row.id}:formatDetail`} draft={draft} db={db} run={run} close={()=>setDraft(null)} done={finish}/>:<button type="button" className={styles.rowButton} disabled={!canEdit(row)} title={row.formatDetail} aria-label={`Edit Format detail for ${row.id}`} onClick={()=>open(row,'formatDetail','Format detail')}>{row.formatDetail || 'Add detail...'}</button>}</div>:null}</td>)}</tr>)}</tbody></table></div>
      {!visible.length?<p className={styles.empty}>{rows.length?'No inspirations match these filters.':'No inspirations yet.'}</p>:null}
    </>}
  </>;
}
