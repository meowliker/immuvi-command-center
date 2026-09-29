'use client';
import { useState } from 'react';
import type { ActionRecord } from '../types';
import { TrackerDialog } from './tracker-dialog';
import styles from '../../command-center.module.css';

export function ProductionDueEditor({ action, busy, error, onClose, onSave }: {
  action: ActionRecord; busy: boolean; error: string; onClose: () => void; onSave: (value: string) => Promise<unknown>;
}) {
  const [value, setValue] = useState(action.display.dueDate || '');
  return <TrackerDialog title={`Due date: ${action.display.title}`} busy={busy} error={error} onClose={onClose}>
    <form className={styles.trackerForm} onSubmit={(event) => { event.preventDefault(); void onSave(value); }}>
      <label><span>Due date</span><input type="date" value={value} disabled={busy} onChange={(event) => setValue(event.target.value)} /></label>
      <div className={styles.actionLinks}>
        <button type="submit" disabled={busy}>Save due date</button>
        <button type="button" disabled={busy} onClick={() => setValue('')}>Clear date</button>
        <button type="button" disabled={busy} onClick={onClose}>Cancel</button>
      </div>
    </form>
  </TrackerDialog>;
}
