'use client';
import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import styles from '../../command-center.module.css';
import { useModalDialog } from '../hooks/use-modal-dialog';

export function TrackerDialog({ title, titleContent, subtitle, children, onClose, busy, error, closeLabel='Close editor', className='' }: { title: string; titleContent?: ReactNode; subtitle?: ReactNode; children: ReactNode; onClose: () => void; busy: boolean; error?: string; closeLabel?: string; className?: string }) {
  const ref = useModalDialog({ onClose, busy });
  useEffect(() => { if (ref.current) ref.current.scrollTop=0; }, [title]);
  return <dialog ref={ref} className={`${styles.trackerDialog} ${className}`} aria-label={title} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <header>{subtitle || titleContent ? <div><h2>{titleContent || title}</h2>{subtitle}</div> : <h2>{title}</h2>}<button type="button" aria-label={closeLabel} title={closeLabel} disabled={busy} onClick={onClose}><X size={18} /></button></header>
    {error ? <p role="alert" className={styles.error}>{error}</p> : null}
    {children}
  </dialog>;
}
