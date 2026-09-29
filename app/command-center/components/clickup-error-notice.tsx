import { useWorkspaceNotice } from './workspace-toasts';

export function ClickUpErrorNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useWorkspaceNotice({ message, title: 'ClickUp', kind: 'error', onDismiss });
  return null;
}
