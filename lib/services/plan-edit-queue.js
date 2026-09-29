import { planEditKey, applyPlanEdit } from '../domain/plan-edit-patches.js';

/** Accept UI edits immediately while the existing product write coordinator orders I/O. */
export function createPlanEditQueue({ changed, failed, completed }) {
  const heads = new Map();
  let pending = [], sequence = 0, active = true, hadError = false;
  const publish = () => { if (active) changed([...pending]); };
  return {
    start() { active = true; },
    dispose() { active = false; },
    async run(action, edit, execute, schedule) {
      const key = planEditKey(action), id = ++sequence;
      if (!pending.length) { heads.clear(); hadError = false; }
      // Keep the persisted baseline, never the optimistic projection shown in the controls.
      if (!heads.has(key)) heads.set(key, action);
      pending.push({ id, key, edit }); publish();
      let saved = false;
      try {
        await schedule(async () => {
          if (!active) return;
          try {
            await execute(heads.get(key), next => { heads.set(key, next); saved = true; });
          } catch (cause) {
            hadError = true;
            if (active) failed(cause instanceof Error ? cause.message : 'Could not update task.');
          }
        })();
      } finally {
        pending = pending.filter(item => item.id !== id); publish();
        if (!pending.length) {
          heads.clear();
          if (active && saved && !hadError) completed('Task successfully updated.');
        }
      }
      return saved;
    },
  };
}

export function projectPlanEdits(rows, pending) {
  return rows.map(row => pending.filter(item => item.key === planEditKey(row)).reduce((value, item) => applyPlanEdit(value, item.edit), row));
}
