import { X } from 'lucide-react';
import styles from '../../command-center.module.css';

export function WinningFilePreview({ fileId, close }: { fileId: string; close: () => void }) {
  if (!/^[\w-]+$/.test(fileId)) return null;
  return <section className={styles.trackerPreview}>
    <button type="button" aria-label="Close preview" title="Close preview" onClick={close}><X size={16} /></button>
    <iframe title="Winning file preview" src={`https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`} allowFullScreen />
  </section>;
}
