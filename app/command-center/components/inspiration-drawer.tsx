'use client';
import { useId, type ReactNode } from 'react';
import { ExternalLink, FileText, X } from 'lucide-react';
import type { Inspiration } from '../hooks/use-inspiration-library';
import { useModalDialog } from '../hooks/use-modal-dialog';
import shared from '../../command-center.module.css';
import styles from '../inspiration.module.css';
import { InspirationStoredBrief } from './inspiration-brief';

export function InspirationDrawer({ inspiration: ins, error, close, actions, placement, briefLookup, context,duplicateLinks=[],openCreative }: { inspiration: Inspiration; error: string; close: () => void; actions?: ReactNode; placement?:ReactNode;briefLookup?:ReactNode;context?:{loaded:boolean;error:string;products:{id:string;name:string}[];inheritedBriefUrl?:string;inheritedBrief?:Record<string,any>|null};duplicateLinks?:{id:string;available:boolean;title:string;status:string;matchType:string}[];openCreative?:(id:string)=>void }) {
  const ref = useModalDialog({ onClose: close, panelSelector: '[data-modal-panel]' }), title = useId();
  const facts = [['Angle', ins.angle], ['Persona', ins.persona], ['Hook', ins.hookType], ['Structure', ins.creativeStructure], ['Production', ins.productionStyle],
    ['Funnel', ins.funnelStage], ['Type', ins.adType], ['Duration',ins.duration], ['Status', ins.status], ['Added by', ins.addedBy], ['Created', ins.createdAt ? new Date(ins.createdAt).toLocaleString() : '']];
  const briefUrl=ins.briefUrl || (!context?.error?context?.inheritedBriefUrl:'');
  const brief=ins.editFields._classificationBrief || (!context?.error?context?.inheritedBrief:null);
  const task=ins.editFields._sourceClickupId;
  return <dialog ref={ref} className={shared.planDrawer} aria-labelledby={title} aria-modal="true" onCancel={(event) => { event.preventDefault(); close(); }}
    onKeyDown={(event) => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex]')].filter((item) => item.tabIndex >= 0 && item.getClientRects().length);
      if (document.activeElement === (event.shiftKey ? controls[0] : controls.at(-1))) { event.preventDefault(); (event.shiftKey ? controls.at(-1) : controls[0])?.focus(); }
    }}>
    <aside className={shared.planDrawerPanel} data-modal-panel>
      <header className={shared.planDrawerHeader}>
        <div className={shared.planDrawerSource}><span>Inspiration / {ins.id}</span><button type="button" autoFocus aria-label="Close inspiration detail" title="Close inspiration detail" onClick={close}><X size={16} /></button></div>
        <h2 id={title}>{ins.formatName}</h2><p>{ins.brand || '-'} / {ins.platform || '-'} / {ins.source}</p>
        <div className={shared.planDrawerActions}>{ins.sourceUrl ? <a href={ins.sourceUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} />Source</a> : null}
          {briefUrl ? <a href={briefUrl} target="_blank" rel="noopener noreferrer"><FileText size={14} />Brief</a> : typeof task==='string' && /^[a-zA-Z0-9_-]+$/.test(task)?<a href={`https://app.clickup.com/t/${task}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14}/>Source task</a>:null}{actions}</div>
      </header>
      <div className={`${shared.actionInspectorBody} ${shared.planDrawerBody} ${styles.drawerBody}`}>
        {error ? <p role="alert" className={styles.error}>{error} Previously loaded details are shown.</p> : null}
        {ins.queueError ? <section><h3>Queue</h3><p role="alert" className={styles.error}>{ins.queueError}</p><p>{ins.status} / {ins.queueAttempts} attempts / {ins.queueWorker || 'Unclaimed'}</p></section> : null}
        {ins.recovery?<section><h3>Recovered queue history</h3><p>{ins.recovery.status} / {ins.recovery.attempts} attempts / {ins.recovery.worker || 'Unclaimed'}</p>{ins.recovery.error?<p className={styles.prose}>{ins.recovery.error}</p>:null}</section>:null}
        <section><h3>Classification</h3><dl className={styles.facts}>{facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '-'}</dd></div>)}</dl></section>
        {[['Hypothesis', ins.hypothesis], ['Notes', ins.notes], ['Ad Copy', ins.bodyCopy], ['Voice Over', ins.voiceOver], ['Duplicate review', ins.duplicate]].filter(([, value]) => value).map(([label, value]) => <section key={label}><h3>{label}</h3><p className={styles.prose}>{value}</p></section>)}
        {ins.formatDetail?<section><h3>Format detail</h3><p className={styles.prose}>{ins.formatDetail}</p></section>:null}
        {ins.tags.length?<section><h3>Tags</h3><p>{ins.tags.join(' / ')}</p></section>:null}
        {duplicateLinks.length?<section><h3>Similar creatives</h3><ul className={styles.duplicateLinks}>{duplicateLinks.map((ad)=><li key={ad.id}><strong>{ad.title}</strong><button type="button" disabled={!ad.available || !!error || !openCreative} aria-label={`View related creative ${ad.id}`} onClick={()=>openCreative?.(ad.id)}>View</button><small>{ad.available?[ad.id,ad.matchType==='combo'?'Same combination':ad.matchType==='exact'?'Exact match':ad.matchType==='format'?'Similar format':'',ad.status].filter(Boolean).join(' / '):'Missing, deleted, inaccessible or ambiguous reference'}</small></li>)}</ul></section>:null}
        {briefLookup}
        {brief && typeof brief==='object' && !Array.isArray(brief)?<InspirationStoredBrief brief={brief}/>:null}
        {placement}
        <section><h3>Usage / {ins.usage.length} ads / {ins.cellCount} cells</h3>
          {ins.usage.length ? <ul className={styles.usage}>{ins.usage.map((ad: Inspiration['usage'][number]) => <li key={ad.id}><strong>{ad.title}</strong><span>{ad.angle || '-'} x {ad.persona || '-'}</span><span className={styles.badge} data-status={ad.status}>{ad.status}</span></li>)}</ul> : <p>Not used yet.</p>}
        </section>
        {ins.sourceProductId ? <section><h3>Imported from</h3><p>{ins.sourceProductName || ins.sourceProductId}{ins.sourceRecordId ? ` / ${ins.sourceRecordId}` : ''}</p></section> : null}
        {context?<section><h3>Reuse across accessible products</h3>{context.error?<p role="alert" className={styles.error}>{context.error} Reuse totals unavailable.</p>:!context.loaded?<p role="status">Loading reuse...</p>:<><p>{(ins.usage.length?1:0)+context.products.length} products / {ins.usage.length} local creatives</p>{context.products.length?<ul>{context.products.map((product)=><li key={product.id}>{product.name}</li>)}</ul>:<p>No copies in other accessible products.</p>}</>}</section>:null}
      </div>
    </aside>
  </dialog>;
}
