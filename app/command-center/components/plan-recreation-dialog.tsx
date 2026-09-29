import { RotateCcw } from 'lucide-react';
import { TrackerDialog } from './tracker-dialog';
import type { usePlanRecreation } from '../hooks/use-plan-recreation';
import styles from '../../command-center.module.css';

export function PlanRecreationDialog({ repair }: { repair: ReturnType<typeof usePlanRecreation> }) {
  return <TrackerDialog title="Repair ClickUp link" closeLabel="Close ClickUp repair" busy={repair.busy} error={repair.error} onClose={repair.close}>
    <form className={`${styles.trackerForm} ${styles.planDeleteForm}`} onSubmit={(e) => { e.preventDefault(); void repair.save(); }}>
      <h3>{repair.target!.title}</h3>
      <p>Linked task: <strong>{repair.target!.taskId}</strong></p>
      <p>Restore the verified task link, or create a replacement in the QA test list only if the original is confirmed missing and no ambiguous match exists.</p>
      <p>The local creative, brief, assignments, and Matrix placement are preserved.</p>
      <footer><button type="button" disabled={repair.busy} onClick={repair.close}>Cancel</button>
        <button type="submit" disabled={repair.busy}><RotateCcw size={16} />{repair.busy ? 'Checking and repairing...' : 'Repair or recreate'}</button></footer>
    </form>
  </TrackerDialog>;
}
