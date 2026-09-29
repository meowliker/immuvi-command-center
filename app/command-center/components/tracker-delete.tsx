'use client';
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Creative } from '../types';
import styles from '../../command-center.module.css';
export function TrackerDelete({ creative, busy, remove }: { creative: Creative; busy: boolean; remove: (creative: Creative, remote: boolean) => Promise<unknown> }) {
  const [remote, setRemote] = useState(false);
  return <div><p>Delete {creative.formatName}? Its linked Action Plan entry and matrix assignments will be removed. Other creatives and variations will remain.</p>
    {creative.clickupTaskId ? <label className={styles.trackerCheck}><input type="checkbox" checked={remote} disabled={busy} onChange={(event) => setRemote(event.target.checked)} />Also delete the linked QA ClickUp task</label> : null}
    <footer><button type="button" disabled={busy} onClick={() => void remove(creative, remote)}><Trash2 size={16} />Delete creative</button></footer>
  </div>;
}
