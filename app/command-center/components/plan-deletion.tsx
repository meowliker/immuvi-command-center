import { useState } from 'react';
import { Trash2, RotateCcw } from 'lucide-react';
import { TrackerDialog } from './tracker-dialog';
import type { usePlanDeletion, PlanDeletionTarget } from '../hooks/use-plan-deletion';
import styles from '../../command-center.module.css';

type Control = ReturnType<typeof usePlanDeletion>;
export function PlanDeleteDialog({ deletion }: { deletion: Control }) {
  const target = deletion.target!;
  const [remote, setRemote] = useState(Boolean(target.deletedAt));
  return <TrackerDialog title={target.deletedAt ? 'Delete linked ClickUp task' : 'Delete creative'} closeLabel="Close creative deletion" busy={deletion.busy} error={deletion.error} onClose={deletion.close}>
    <form className={`${styles.trackerForm} ${styles.planDeleteForm}`} onSubmit={(e) => { e.preventDefault(); void deletion.save(Boolean(target.deletedAt) || remote); }}>
      <h3>{target.title}</h3>
      {target.deletedAt ? <p>The creative is already deleted in QA. This permanently deletes ClickUp task <strong>{target.taskId}</strong> from the linked test list.</p>
        : <p>Delete this creative from QA, including its matching Action Plan entries and Matrix assignments? Independent variations and source files are preserved. This cannot be undone here.</p>}
      {!target.deletedAt && target.taskId ? <label className={styles.planReviewPush}><input type="checkbox" checked={remote} disabled={deletion.busy} onChange={(e) => setRemote(e.target.checked)} />Also delete linked ClickUp task ({target.taskId})</label> : null}
      <footer><button type="button" disabled={deletion.busy} onClick={deletion.close}>Cancel</button>
        <button type="submit" className={styles.dangerButton} disabled={deletion.busy}><Trash2 size={16} />{deletion.busy ? 'Deleting...' : target.deletedAt ? 'Delete ClickUp task' : 'Delete creative'}</button></footer>
    </form>
  </TrackerDialog>;
}

export function PlanDeletedCreatives({ rows, deletion, busy }: { rows: PlanDeletionTarget[]; deletion: Control; busy: boolean }) {
  if (!rows.length) return null;
  return <details className={styles.planHistory}><summary>Deleted creatives ({rows.length})</summary>
    <ul className={styles.planDeletedList}>{rows.map((row) => <li key={row.adId}><div><strong>{row.title}</strong><small>{row.adId}</small></div>
      {row.taskId ? deletion.remoteDeleted.includes(row.adId) ? <span>ClickUp deletion confirmed</span> : <button type="button" aria-label={`Delete linked ClickUp task for ${row.title}`} title="Delete linked ClickUp task" disabled={busy} onClick={() => deletion.openDeleted(row)}><RotateCcw size={15} />Delete ClickUp task</button> : <span>No linked ClickUp task</span>}
    </li>)}</ul>
  </details>;
}
