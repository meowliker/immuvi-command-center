'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Columns3, Trash2 } from 'lucide-react';
import { planVariationGroups } from '../../../lib/domain/action-plan-variations.js';
import { matrixBucket } from '../../../lib/domain/creative-matrix.js';
import type { MatrixModel } from '../hooks/use-creative-matrix';
import { workflowStatuses } from '../helpers/creatives';
import { cellColumns, defaultCellColumns, defaultCellFilters, filterCellCreatives, type CellFilters, type CellSort, type CellView } from '../helpers/matrix-inspector';
import { MatrixInspectorRow } from './matrix-inspector-row';
import styles from '../../command-center.module.css';

export function MatrixInspectorTable({ model:m }: { model:MatrixModel }) {
  const [filters,setFilters]=useState<CellFilters>(()=>({...defaultCellFilters,dateRange:m.preferences.filterMode==='scope' ? m.preferences.dateRange : 'all',
    dateFrom:m.preferences.dateFrom,dateTo:m.preferences.dateTo,dateBasis:m.preferences.dateBasis,
    statuses:m.preferences.statuses.length ? [...new Set([...workflowStatuses(''),...m.selectedCreatives.map(ad=>ad.status)])].filter(status=>m.preferences.statuses.includes(matrixBucket(status))) : [] }));
  const [sort,setSort]=useState<CellSort>({col:'created',dir:-1});
  const [columns,setColumns]=useState(defaultCellColumns);
  const [views,setViews]=useState<CellView[]>([]);
  const [activeView,setActiveView]=useState('');
  const [viewName,setViewName]=useState('');
  const [columnSearch,setColumnSearch]=useState('');
  const [storageNotice,setStorageNotice]=useState('');
  const controls=useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const dismiss=(event:PointerEvent)=>{if(!controls.current?.contains(event.target as Node)) controls.current?.querySelectorAll('details[open]').forEach(menu=>menu.removeAttribute('open'));};
    document.addEventListener('pointerdown',dismiss);
    return ()=>document.removeEventListener('pointerdown',dismiss);
  },[]);
  const key=`qa.matrix.cell.views.${m.selectedAngle?.productId || ''}`;
  useEffect(()=>{
    try { const stored=JSON.parse(localStorage.getItem(key) || '[]');
      if(Array.isArray(stored)) setViews(stored.filter((view):view is CellView=>typeof view?.id==='string' && typeof view.name==='string'
        && Array.isArray(view.columns) && view.columns.every((col:unknown)=>typeof col==='string') && view.columns.length
        && typeof view.filters?.search==='string' && Array.isArray(view.filters?.statuses) && Array.isArray(view.filters?.funnels)
        && typeof view.filters?.dateRange==='string' && typeof view.sort?.col==='string' && [1,-1].includes(view.sort.dir)));
    } catch { setStorageNotice('Saved views could not be loaded in this browser.'); }
  },[key]);
  const registry=useMemo(()=>{
    const skip=new Set(['creative usp','angle','angles','persona','personas','funnel','funnel type','funnel stage','photo/video','ad type','parent ad','angle tag','persona tag','inspiration link','drive link']);
    const custom=[...new Set(m.creatives.flatMap(ad=>Object.keys(ad._customFields || {})))].filter(name=>!skip.has(name.toLowerCase())).sort();
    return [...cellColumns,...custom.map(name=>({id:`cu:${name}`,label:name,width:180}))];
  },[m.creatives]);
  const visibleColumns=columns.filter(id=>registry.some(column=>column.id===id));
  const ads=filterCellCreatives(m.selectedCreatives,filters,sort);
  const groups=useMemo(()=>new Map(planVariationGroups(m.creatives,[],m.creatives[0]?.productId || '').map(group=>[group.id,group])),[m.creatives]);
  const statuses=[...new Set([...workflowStatuses(''),...m.selectedCreatives.map(ad=>ad.status)])];
  const change=(patch:Partial<CellFilters>)=>{setFilters(current=>({...current,...patch}));setActiveView('');};
  const toggle=(field:'statuses'|'funnels',value:string)=>change({[field]:filters[field].includes(value) ? filters[field].filter(item=>item!==value) : [...filters[field],value]});
  const persist=(next:CellView[])=>{ setViews(next);try { localStorage.setItem(key,JSON.stringify(next));setStorageNotice(''); } catch { setStorageNotice('This view is available for this session only; browser storage is unavailable.'); } };
  const apply=(view?:CellView)=>{setColumns(view?.columns.filter(id=>registry.some(col=>col.id===id)).length ? view.columns : defaultCellColumns);setFilters(view?.filters || defaultCellFilters);setSort(view?.sort || {col:'created',dir:-1});setActiveView(view?.id || '');};
  const closeMenus=()=>controls.current?.querySelectorAll('details[open]').forEach(menu=>menu.removeAttribute('open'));
  const menuLabel=(selected:string[],empty:string)=>!selected.length ? empty : selected.length===1 ? selected[0] : `${selected.length} selected`;
  return <>
    <div className={styles.cellSearch}><input type="search" aria-label="Search cell creatives" placeholder="Search creatives..." value={filters.search} onChange={e=>change({search:e.target.value})} /></div>
    <div ref={controls} className={styles.cellFilters} onClick={e=>{const summary=(e.target as HTMLElement).closest('summary');if(summary)controls.current?.querySelectorAll('details[open]').forEach(menu=>{if(menu!==summary.parentElement)menu.removeAttribute('open');});}} onKeyDown={e=>{if(e.key==='Escape' && controls.current?.querySelector('details[open]')) {e.preventDefault();e.stopPropagation();closeMenus();}}}>
      <label>Date<select aria-label="Cell date filter" value={filters.dateRange} onChange={e=>change({dateRange:e.target.value})}>
        {Object.entries({all:'All time',today:'Today',week:'This week','14d':'Last 14d','30d':'Last 30d',custom:'Custom range'}).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
      <div className={styles.cellFilterGroup}><span>Status</span><details><summary aria-label="Cell status filter">{menuLabel(filters.statuses,'All statuses')}<ChevronDown size={10} /></summary><div className={styles.cellMenu}>
        <button type="button" onClick={()=>change({statuses:[]})}>Clear statuses</button>{statuses.map(status=><label key={status}><input type="checkbox" checked={filters.statuses.includes(status)} onChange={()=>toggle('statuses',status)} />{status}</label>)}</div></details></div>
      <div className={styles.cellFilterGroup}><span>Funnel</span><details><summary aria-label="Cell funnel filter">{menuLabel(filters.funnels,'All funnels')}<ChevronDown size={10} /></summary><div className={styles.cellMenu}>
        <button type="button" onClick={()=>change({funnels:[]})}>Clear funnels</button>{['TOF','MOF','BOF'].map(funnel=><label key={funnel}><input type="checkbox" checked={filters.funnels.includes(funnel)} onChange={()=>toggle('funnels',funnel)} />{funnel}</label>)}</div></details></div>
      {filters.dateRange==='custom' ? <><input type="date" aria-label="Cell date from" value={filters.dateFrom} onChange={e=>change({dateFrom:e.target.value})} /><input type="date" aria-label="Cell date to" value={filters.dateTo} onChange={e=>change({dateTo:e.target.value})} /></> : null}
      <span className={styles.cellFilterDivider} />
      <details><summary aria-label="Cell saved views">{views.find(view=>view.id===activeView)?.name || 'Default view'}<ChevronDown size={10} /></summary><div className={styles.cellMenu}>
        <button type="button" onClick={()=>{apply();closeMenus();}}>Default view</button>
        {views.map(view=><div key={view.id} className={styles.cellViewItem}><button type="button" onClick={()=>{apply(view);closeMenus();}}>{view.name}</button><button type="button" title="Delete saved view" aria-label={`Delete view ${view.name}`} onClick={()=>{persist(views.filter(item=>item.id!==view.id));if(activeView===view.id)setActiveView('');}}><Trash2 size={13} /></button></div>)}
        <form onSubmit={e=>{e.preventDefault();const name=viewName.trim();if(!name)return;const view={id:crypto.randomUUID(),name,columns,filters,sort};persist([...views,view]);setActiveView(view.id);setViewName('');closeMenus();}}>
          <input aria-label="Cell view name" placeholder="View name" required maxLength={80} value={viewName} onChange={e=>setViewName(e.target.value)} /><button type="submit">Save current view</button></form>
      </div></details>
      <details><summary aria-label="Cell columns"><Columns3 size={12} />Columns</summary><div className={styles.cellMenu}>
        <input type="search" aria-label="Search cell columns" placeholder="Search columns..." value={columnSearch} onChange={e=>setColumnSearch(e.target.value)} />
        {registry.filter(column=>(column.label || 'Delete').toLowerCase().includes(columnSearch.toLowerCase())).map(column=><label key={column.id}><input type="checkbox" checked={columns.includes(column.id)} disabled={visibleColumns.length===1 && columns.includes(column.id)} onChange={e=>{setColumns(e.target.checked ? [...columns,column.id] : columns.filter(id=>id!==column.id));setActiveView('');}} />{column.label || 'Delete'}{column.id.startsWith('cu:') ? <small>CU</small> : null}</label>)}
        <button type="button" onClick={()=>{setColumns(defaultCellColumns);setActiveView('');}}>Reset columns</button>
      </div></details>
      {filters.search || filters.statuses.length || filters.funnels.length || filters.dateRange!=='all' ? <button type="button" onClick={()=>change(defaultCellFilters)}>Reset filters</button> : null}
    </div>
    {storageNotice ? <p role="status">{storageNotice}</p> : null}
    <div className={styles.cellTableScroll} role="region" aria-label="Cell creative table" tabIndex={0}>
      <table className={styles.cellTable} style={{width:visibleColumns.reduce((sum,id)=>sum+(registry.find(col=>col.id===id)?.width || 180),0)}}>
        <colgroup>{visibleColumns.map(id=><col key={id} style={{width:registry.find(col=>col.id===id)?.width}} />)}</colgroup>
        <thead><tr>{visibleColumns.map(id=>{
          const label=registry.find(col=>col.id===id)?.label;
          const sortable=!['action','delete','creativeUSP','notes'].includes(id);
          return <th key={id} scope="col" aria-label={id==='delete' ? 'Delete' : undefined} aria-sort={sortable ? sort.col===id ? sort.dir===1 ? 'ascending' : 'descending' : 'none' : undefined}>
            {sortable ? <button type="button" onClick={()=>{setSort({col:id,dir:sort.col===id && sort.dir===-1 ? 1 : -1});setActiveView('');}}>{label}{sort.col===id ? sort.dir===1 ? <ArrowUp size={10} /> : <ArrowDown size={10} /> : <ChevronDown size={10} />}</button> : label}
          </th>;
        })}</tr></thead>
        <tbody>{ads.map(ad=><MatrixInspectorRow key={ad.id} ad={ad} model={m} columns={visibleColumns} group={groups.get(ad.id)} />)}
          {!ads.length ? <tr><td colSpan={visibleColumns.length} className={styles.cellEmpty}>No creatives match this cell view.</td></tr> : null}
        </tbody>
      </table>
    </div>
  </>;
}
