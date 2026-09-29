'use client';
import { useId, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { useAnchoredPopover } from '../hooks/use-anchored-popover';
import styles from '../inspiration.module.css';

export function InspirationStatus({id,status,error,children}:{id:string;status:string;error?:string;children?:ReactNode}) {
  const expandable=status==='Failed' || status==='Blocked';
  const popoverId=useId(), headingId=useId();
  const {trigger,panel}=useAnchoredPopover(expandable);
  if(!expandable)return <span className={styles.badge} data-status={status}>{status}</span>;
  return <>
    <button ref={trigger} type="button" className={`${styles.badge} ${styles.statusTrigger}`} data-status={status}
      popoverTarget={popoverId} aria-haspopup="dialog" aria-controls={popoverId} aria-label={`${status} details for ${id}`}>{status}</button>
    <div ref={panel} id={popoverId} popover="auto" role="dialog" aria-labelledby={headingId} className={styles.failurePopover}>
      <header><strong id={headingId}>{status==='Failed'?'Processing failed':'Processing blocked'}</strong>
        <button type="button" aria-label="Close processing error" title="Close" onClick={()=>panel.current?.hidePopover()}><X size={14}/></button></header>
      <p>{error || 'No error details were recorded for this attempt.'}</p>
      {children}
    </div>
  </>;
}
