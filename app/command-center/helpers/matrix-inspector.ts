import type { Creative } from '../types';
import { matrixDateMatches, matrixSource } from '../../../lib/domain/creative-matrix.js';

export const cellColumns = [
  { id:'source', label:'Source', width:56 }, { id:'name', label:'Task name', width:280 },
  { id:'type', label:'Type', width:80 }, { id:'funnel', label:'Funnel', width:80 },
  { id:'origin', label:'Origin', width:110 }, { id:'created', label:'Created', width:100 },
  { id:'due', label:'Due', width:140 }, { id:'status', label:'Status', width:130 },
  { id:'taxonomy', label:'Angle / Persona', width:260 }, { id:'inspirationTrace', label:'Inspiration', width:150 },
  { id:'creativeUSP', label:'Creative USP', width:230 }, { id:'notes', label:'Notes', width:170 },
  { id:'action', label:'Action', width:560 }, { id:'delete', label:'', width:52 },
];
export const defaultCellColumns = cellColumns.map(column => column.id);
export type CellFilters = { search:string; statuses:string[]; funnels:string[]; dateRange:string; dateFrom:string; dateTo:string; dateBasis:string };
export type CellSort = { col:string; dir:1|-1 };
export type CellView = { id:string; name:string; columns:string[]; filters:CellFilters; sort:CellSort };
export const defaultCellFilters:CellFilters = { search:'', statuses:[], funnels:[], dateRange:'all', dateFrom:'', dateTo:'', dateBasis:'created' };

export function cellColumnValue(ad:Creative, column:string):string|number {
  const values:Record<string,string|number> = { source:matrixSource(ad), name:ad.formatName || ad.id, type:ad.adType, funnel:ad.funnelStage,
    origin:ad.adOrigin, created:ad.createdAt, due:ad.dueDate, status:ad.status, taxonomy:`${ad.angle} ${ad.persona}`,
    inspirationTrace:ad.fromInspoId, creativeUSP:ad.creativeUSP || ad.creativeHypothesis, notes:ad.notes };
  if (column.startsWith('cu:')) {
    const value=ad._customFields?.[column.slice(3)];
    return typeof value==='string' || typeof value==='number' ? value : '';
  }
  return values[column] ?? '';
}
export function filterCellCreatives(ads:Creative[], filters:CellFilters, sort:CellSort) {
  const query=filters.search.trim().toLowerCase();
  return ads.filter(ad => (!query || `${ad.formatName} ${ad.id} ${ad.notes} ${ad.clickupTaskId}`.toLowerCase().includes(query))
    && (!filters.statuses.length || filters.statuses.includes(ad.status))
    && (!filters.funnels.length || filters.funnels.includes(ad.funnelStage))
    && matrixDateMatches(ad,filters)).sort((a,b) => {
      const av=cellColumnValue(a,sort.col), bv=cellColumnValue(b,sort.col);
      if (av==='' || bv==='') return av===bv ? 0 : av==='' ? 1 : -1;
      return sort.dir*(typeof av==='number' && typeof bv==='number' ? av-bv : String(av).localeCompare(String(bv),undefined,{numeric:true,sensitivity:'base'}));
    });
}
export function cellRelativeDate(timestamp:number, now=Date.now()) {
  if (!timestamp) return '-';
  const days=Math.max(0,Math.floor((now-timestamp)/86400000));
  return days===0 ? 'Today' : days<7 ? `${days}d ago` : days<30 ? `${Math.floor(days/7)}w ago` : new Date(timestamp).toLocaleDateString();
}
