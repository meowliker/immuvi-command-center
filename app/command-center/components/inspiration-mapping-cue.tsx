import { MapPin, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { inspirationSuggestions, mappingNeedsReview } from '../../../lib/domain/inspiration-mapping.js';
import type { Inspiration } from '../hooks/use-inspiration-library';
import styles from '../inspiration.module.css';

export function InspirationMappingCue({row,kind,items,creatives,disabled,open,compact=false}:{row:Inspiration;kind:'angle'|'persona';items:Record<string,any>[];creatives:Record<string,any>[];disabled:boolean;compact?:boolean;open:(row:Inspiration,kind:'angle'|'persona',target?:string)=>void}) {
  const first=useMemo(()=>inspirationSuggestions(row,kind,items,creatives)[0],[row,kind,items,creatives]);
  const top=first?.score>=.45 && first.name!==row[kind]?first:null;
  const review=mappingNeedsReview(row,kind,items);
  const flagged=!!row.editFields?.[kind==='angle'?'_needsAngleReview':'_needsPersonaReview'];
  if(compact && !flagged && (!row[kind] || !review))return null;
  return <div className={styles.mappingCue}>
    <button type="button" disabled={disabled} aria-label={`Map ${kind} for ${row.id}`} data-review={review} title={review?`Review ${kind} mapping`:`Change ${kind} mapping`} onClick={()=>open(row,kind)}>{review?<TriangleAlert size={13}/>:<MapPin size={13}/>}</button>
    {top?<button type="button" disabled={disabled} title={`${Math.round(top.score*100)}% similar`} aria-label={`Suggested ${kind} ${top.name} for ${row.id}`} onClick={()=>open(row,kind,top.id)}>{top.name}</button>:null}
  </div>;
}
