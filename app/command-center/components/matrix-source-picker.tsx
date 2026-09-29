'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Folder, Lightbulb, Pencil, Repeat2 } from 'lucide-react';
import { AD_TYPES, FUNNEL_STAGES, safeCreativeUrl } from '../../../lib/domain/tracker-editing.js';
import { matrixBucket, matrixDateMatches } from '../../../lib/domain/creative-matrix.js';
import type { MatrixModel } from '../hooks/use-creative-matrix';
import styles from '../../command-center.module.css';

type Source = {id:string;name:string;version:string;status:string;adType:string;funnelStage:string;angle:string;createdAt:number;driveLink:string;notes:string;url:string;disabled:boolean};
type Filters = {search:string;dateRange:string;statuses:string[];funnels:string[];types:string[]};
const defaults:Filters={search:'',dateRange:'all',statuses:[],funnels:[],types:[]};
const blankDefault={name:'',hypothesis:'',notes:'',adType:'',funnelStage:'TOF'};
export function MatrixSourcePicker({ model:m }: { model:MatrixModel }) {
  const [kind,setKind]=useState<'tracker'|'inspiration'|'blank'>('tracker');
  const [filterSets,setFilterSets]=useState({tracker:defaults,inspiration:defaults});
  const [sort,setSort]=useState<{key:string;dir:number}>({key:'',dir:1});
  const [chosen,setChosen]=useState<string[]>([]);
  const [blank,setBlank]=useState(blankDefault);
  const [push,setPush]=useState(true);
  const toolbar=useRef<HTMLDivElement>(null);
  const busy=!!m.busyAction;
  const sourceKind=kind==='inspiration' ? 'inspiration' : 'tracker';
  const filters=filterSets[sourceKind];
  const setFilters=(next:Partial<Filters>)=>setFilterSets(current=>({...current,[sourceKind]:{...current[sourceKind],...next}}));
  const closeMenus=()=>toolbar.current?.querySelectorAll('details[open]').forEach(menu=>menu.removeAttribute('open'));
  useEffect(()=>{
    const dismiss=(event:PointerEvent)=>{if(!toolbar.current?.contains(event.target as Node))closeMenus();};
    document.addEventListener('pointerdown',dismiss);return ()=>document.removeEventListener('pointerdown',dismiss);
  },[]);
  const tracker=m.creatives.filter(ad=>!ad.deletedAt && !ad.productBoundaryQuarantined && !ad.trackerRefId && ad.taskType!=='production' && !ad.sourceFormatId && (!ad.parentAdId || ad.adOrigin==='Winner Variation'));
  const sources:Source[]=kind==='inspiration' ? m.inspirations.map(i=>({...i,disabled:i.pending}))
    : tracker.map(ad=>({id:ad.id,name:ad.formatName,version:ad.version,status:ad.status,adType:ad.adType,funnelStage:ad.funnelStage,angle:ad.angle,createdAt:ad.createdAt,driveLink:ad.driveLink,notes:ad.notes,url:ad.adLink,disabled:false}));
  const inCell=(id:string)=>m.selectedCreatives.some(ad=>kind==='inspiration' ? ad.fromInspoId===id : ad.sourceFormatId===id);
  const selected=sources.filter(source=>chosen.includes(source.id) && !source.disabled && !inCell(source.id));
  const toggle=(id:string)=>setChosen(current=>current.includes(id) ? current.filter(value=>value!==id) : [...current,id]);
  const rank=(status:string)=>({winner:0,testing:1,prelaunch:2,untested:3,loser:4})[matrixBucket(status)];
  const value=(source:Source,key:string):string|number=>key==='status' && kind==='tracker' ? rank(source.status) : source[key as keyof Source] as string|number;
  const rows=sources.filter(source=>(!filters.search || `${source.id} ${source.name} ${source.angle} ${source.notes} ${source.adType}`.toLowerCase().includes(filters.search.trim().toLowerCase()))
    && (!filters.statuses.length || filters.statuses.includes(source.status)) && (!filters.funnels.length || filters.funnels.includes(source.funnelStage))
    && (!filters.types.length || filters.types.includes(source.adType)) && (!source.createdAt || matrixDateMatches(source,{...filters,dateBasis:'created'})))
    .sort((a,b)=>{
      const disabled=Number(a.disabled || inCell(a.id))-Number(b.disabled || inCell(b.id));if(disabled)return disabled;
      if(!sort.key)return (kind==='tracker' ? rank(a.status)-rank(b.status) : 0) || b.createdAt-a.createdAt;
      const av=value(a,sort.key),bv=value(b,sort.key);
      return sort.dir*(typeof av==='number' && typeof bv==='number' ? av-bv : String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:'base'}));
    });
  const columns=kind==='inspiration' ? [['id','INS #'],['name','Task Name'],['status','Status'],['adType','Type'],['funnelStage','Funnel'],['angle','Angle'],['createdAt','Added'],['driveLink','Drive'],['notes','Notes']]
    : [['name','Task Name'],['status','Status'],['adType','Type'],['funnelStage','Funnel'],['angle','Angle'],['createdAt','Created'],['driveLink','Drive']];
  const facets=[['statuses','Status','All statuses','status'],['funnels','Funnel','All funnels','funnelStage'],['types','Type','All types','adType']] as const;
  const cancel=()=>{setChosen([]);m.setInspectorTab('creatives');};
  return <div className={styles.sourcePicker}>
    <div className={styles.sourceTabs} role="group" aria-label="Creative source">{([
      ['tracker','Creative Tracker',Repeat2],['inspiration','From Inspiration',Lightbulb],['blank','Blank Brief',Pencil],
    ] as const).map(([id,label,Icon])=><button type="button" key={id} disabled={busy} aria-pressed={kind===id} onClick={()=>{setKind(id);setChosen([]);setSort({key:'',dir:1});}}><Icon size={17} />{label}</button>)}</div>
    {kind==='blank' ? <div className={styles.blankBriefArea}><form className={styles.blankBrief} onSubmit={e=>{e.preventDefault();if(blank.name.trim())void m.create('blank',[{...blank,name:blank.name.trim()}],push);}}>
      <fieldset disabled={busy}><h3>New creative brief</h3>
        <label>Format / Task Name *<input aria-label="Brief name" required value={blank.name} placeholder="e.g. UGC teacher reaction - variation 4" onChange={e=>setBlank({...blank,name:e.target.value})} /></label>
        <label>Creative hypothesis<textarea rows={3} aria-label="Creative hypothesis" value={blank.hypothesis} placeholder="What are we testing? e.g. Teacher POV outperforms parent POV at MOF" onChange={e=>setBlank({...blank,hypothesis:e.target.value})} /></label>
        <details className={styles.blankBriefNotes}><summary>Additional notes</summary><label>Brief notes<textarea aria-label="Brief notes" value={blank.notes} onChange={e=>setBlank({...blank,notes:e.target.value})} /></label></details>
        <div className={styles.blankBriefOptions}><label>Funnel<select aria-label="Brief funnel" value={blank.funnelStage} onChange={e=>setBlank({...blank,funnelStage:e.target.value})}>{FUNNEL_STAGES.map(value=><option key={value}>{value}</option>)}</select></label>
          <label>Ad type<select aria-label="Brief ad type" value={blank.adType} onChange={e=>setBlank({...blank,adType:e.target.value})}><option value="">-</option>{AD_TYPES.filter(Boolean).map(value=><option key={value}>{value}</option>)}</select></label></div>
        <label className={styles.sourcePlanToggle}><input type="checkbox" checked={push} onChange={e=>setPush(e.target.checked)} />Push to Action Plan now</label>
        <footer><button type="button" onClick={()=>{setBlank(blankDefault);cancel();}}>Cancel</button><button type="submit" className={styles.sourceCreate} disabled={!blank.name.trim()}>Create brief</button></footer>
      </fieldset>
    </form></div> : <>
      <div ref={toolbar} className={styles.sourceToolbar} onClick={e=>{const summary=(e.target as HTMLElement).closest('summary');if(summary)toolbar.current?.querySelectorAll('details[open]').forEach(menu=>{if(menu!==summary.parentElement)menu.removeAttribute('open');});}}
        onKeyDown={e=>{if(e.key==='Escape' && toolbar.current?.querySelector('details[open]')){e.preventDefault();e.stopPropagation();closeMenus();}}}>
        <input type="search" aria-label="Search matrix sources" placeholder="Search creatives..." value={filters.search} onChange={e=>setFilters({search:e.target.value})} />
        <label>Date<select aria-label="Source date filter" value={filters.dateRange} onChange={e=>setFilters({dateRange:e.target.value})}>{Object.entries({all:'All time',today:'Today',week:'This week','14d':'Last 14d','30d':'Last 30d'}).map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
        {facets.map(([key,label,empty,field])=><div key={key} className={styles.cellFilterGroup}><span>{label}</span><details><summary aria-label={`Source ${label.toLowerCase()} filter`}>{filters[key].length ? `${filters[key].length} selected` : empty}<ChevronDown size={10} /></summary><div className={styles.cellMenu}>
          <button type="button" onClick={()=>setFilters({[key]:[]})}>Clear {label.toLowerCase()}</button>
          {[...new Set(sources.map(source=>source[field]).filter(Boolean))].sort().map(option=><label key={option}><input type="checkbox" checked={filters[key].includes(option)} onChange={e=>setFilters({[key]:e.target.checked ? [...filters[key],option] : filters[key].filter(value=>value!==option)})} />{option}</label>)}
        </div></details></div>)}
        {filters.search || filters.dateRange!=='all' || filters.statuses.length || filters.funnels.length || filters.types.length ? <button type="button" onClick={()=>setFilters(defaults)}>Reset</button> : null}
      </div>
      <div className={styles.sourceTableScroll} role="region" aria-label={kind==='tracker' ? 'Tracker source table' : 'Inspiration source table'} tabIndex={0}>
        <table className={styles.sourceTable} data-source={kind}><thead><tr><th aria-label="Select" />{columns.map(([key,label])=><th key={key} aria-sort={key==='driveLink' ? undefined : sort.key===key ? sort.dir===1 ? 'ascending' : 'descending' : 'none'}>{key==='driveLink' ? label : <button type="button" onClick={()=>setSort({key,dir:sort.key===key ? -sort.dir : 1})}>{label}{sort.key===key ? sort.dir===1 ? <ArrowUp size={11} /> : <ArrowDown size={11} /> : <ChevronDown size={10} />}</button>}</th>)}</tr></thead>
          <tbody>{rows.map(source=>{
            const used=inCell(source.id),disabled=source.disabled || used || busy;
            return <tr key={source.id} data-selected={chosen.includes(source.id)} data-disabled={source.disabled || used} onClick={()=>{if(!disabled)toggle(source.id);}}>
              <td><input type="checkbox" aria-label={`Select ${source.name}`} checked={chosen.includes(source.id) || used} disabled={disabled} onClick={e=>e.stopPropagation()} onChange={()=>toggle(source.id)} /></td>
              {columns.map(([key])=><td key={key} data-column={key}>{key==='name' ? <span title={source.name}>{source.name}{used ? <small>In cell</small> : null}</span>
                : key==='status' ? <span className={styles.sourceStatus} data-bucket={matrixBucket(source.status)}>{source.status}</span>
                : key==='driveLink' ? safeCreativeUrl(source.driveLink) ? <a href={safeCreativeUrl(source.driveLink)} target="_blank" rel="noreferrer" title="Open Drive" aria-label={`Drive for ${source.name}`} onClick={e=>e.stopPropagation()}><Folder size={15} /></a> : '-'
                : key==='id' ? safeCreativeUrl(source.url) ? <a href={safeCreativeUrl(source.url)} target="_blank" rel="noreferrer" title={source.id} onClick={e=>e.stopPropagation()}>{source.id.match(/INS-?\d+/i)?.[0] || source.id}</a> : source.id
                : key==='createdAt' ? source.createdAt ? new Date(source.createdAt).toLocaleDateString() : '-'
                : <span title={String(value(source,key))}>{value(source,key) || '-'}</span>}</td>)}
            </tr>;
          })}{!rows.length ? <tr><td colSpan={columns.length+1} className={styles.sourceEmpty}>No sources match.{kind==='tracker' ? <button type="button" onClick={()=>setKind('blank')}>Create new</button> : null}</td></tr> : null}</tbody>
        </table>
      </div>
      <footer className={styles.sourceFooter}><label className={styles.sourcePlanToggle}><input type="checkbox" checked={push} disabled={busy} onChange={e=>setPush(e.target.checked)} />Push to Action Plan now</label>
        <button type="button" disabled={busy} onClick={cancel}>Cancel</button><button className={styles.sourceCreate} type="button" disabled={!selected.length || selected.length>50 || busy} onClick={()=>void m.create(kind,selected.map(source=>({sourceId:source.id,version:source.version})),push)}>Add {selected.length} selected</button>
      </footer>
    </>}
  </div>;
}
