import { useState } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import type { ActionRecord } from '../types';
import { canEditPlanTitle, planTitleValues } from '../../../lib/domain/action-plan-editing.js';
import styles from '../../command-center.module.css';

export function PlanTitleEditor({ action, busy, save }: { action: ActionRecord; busy: boolean;
  save: (action: ActionRecord, values: Record<string, unknown>, push: boolean) => Promise<boolean> }) {
  const [draft, setDraft] = useState<{ action: ActionRecord; title: string } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  busy = busy || saving;
  if (!draft) return <button type="button" className={styles.planFieldsButton} title="Rename task" aria-label={`Rename ${action.display.title}`} disabled={busy || !canEditPlanTitle(action)}
    onClick={() => { setError(''); setDraft({ action, title: action.display.title }); }}><Pencil size={14} /></button>;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setError('');
    try { if (await save(draft!.action, planTitleValues(draft!.title), true)) setDraft(null); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not rename task.'); }
    finally { setSaving(false); }
  }
  return <form className={styles.planTitleEdit} onSubmit={submit}>
    <input autoFocus aria-label="Task name" maxLength={500} value={draft.title} disabled={busy} onChange={(e) => setDraft({ ...draft, title: e.target.value })}
      onKeyDown={(e) => { if (e.key === 'Escape' && !busy) { e.preventDefault(); setDraft(null); } }} />
    <button type="submit" className={styles.planFieldsButton} title="Save task name" aria-label="Save task name" disabled={busy}><Check size={14} /></button>
    <button type="button" className={styles.planFieldsButton} title="Cancel rename" aria-label="Cancel rename" disabled={busy} onClick={() => setDraft(null)}><X size={14} /></button>
    {error ? <span role="alert">{error}</span> : null}
  </form>;
}
