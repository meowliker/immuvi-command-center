import { useWorkspaceNotice } from './workspace-toasts';

export function PlanSyncNotice({ message, error = false }: { message: string; error?: boolean }) {
  const warning = error || /remain pending|fields pending|not.*sent|could not|failed/i.test(message);
  useWorkspaceNotice({ message, title: 'Action Plan', kind: warning ? 'error' : 'success' });
  return null;
}
