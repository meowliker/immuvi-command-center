'use client';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import styles from '../workspace-header.module.css';

type Message = { message: string; title: string; kind: 'error' | 'success'; onDismiss?: () => void };
type Toast = Message & { id: number; duration: number };
const ToastContext = createContext<((source: string, message: Message) => void) | null>(null);

export function WorkspaceToasts({ children, onRecord }: { children: ReactNode; onRecord: (text: string, kind: string) => void }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const sequence = useRef(0), seen = useRef(new Map<string, string>());
  const stack = useRef<HTMLDivElement>(null);
  const emit = useCallback((source: string, value: Message) => {
    if (!value.message) { seen.current.delete(source); return; }
    const signature = JSON.stringify([value.title, value.kind, value.message]);
    if (seen.current.get(source) === signature) return;
    seen.current.set(source, signature);
    const toast = { ...value, id: ++sequence.current, duration: value.kind === 'error' ? 4000 : 2500 };
    setToasts(current => [toast, ...current]);
    onRecord(`${value.title}: ${value.message}`, value.kind);
  }, [onRecord]);
  const dismiss = useCallback((id: number) => setToasts(current => current.filter(toast => toast.id !== id)), []);
  const newestId = toasts[0]?.id;
  useEffect(() => {
    const node = stack.current;
    if (!node) return;
    if (newestId) { if (!node.matches(':popover-open')) node.showPopover(); }
    else node.hidePopover();
  }, [newestId]);
  return <ToastContext.Provider value={emit}>
    {children}
    <div ref={stack} popover="manual" className={styles.toastStack} aria-label="Recent notifications" data-notification-ignore>
      {toasts.map(toast => <WorkspaceToast key={toast.id} toast={toast} dismiss={dismiss} />)}
    </div>
  </ToastContext.Provider>;
}

export function useWorkspaceNotice(value: Message) {
  const emit = useContext(ToastContext), source = useId();
  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    emit?.(source, { message: value.message, title: value.title, kind: value.kind, onDismiss: () => {
      if (latest.current.message === value.message) latest.current.onDismiss?.();
    } });
  }, [emit, source, value.message, value.title, value.kind]);
}

export function WorkspaceToast({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => dismiss(toast.id), toast.duration);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);
  const Icon = toast.kind === 'error' ? CircleAlert : CircleCheck;
  return <article className={styles.toast} data-kind={toast.kind} role={toast.kind === 'error' ? 'alert' : 'status'} aria-atomic="true">
    <Icon size={18} aria-hidden="true" />
    <div><strong>{toast.title}</strong><p>{toast.message}</p></div>
    <button type="button" title="Dismiss notification" aria-label={`Dismiss ${toast.title} notification`} onClick={() => { dismiss(toast.id); toast.onDismiss?.(); }}><X size={15} /></button>
    <span aria-hidden="true" className={styles.toastProgress} style={{ '--toast-duration': `${toast.duration}ms` } as CSSProperties} onAnimationEnd={() => dismiss(toast.id)} />
  </article>;
}
