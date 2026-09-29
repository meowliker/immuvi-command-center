import { useEffect, useRef } from 'react';
import { useModalScrollLock } from './use-modal-scroll-lock';

export function useModalDialog({ onClose, busy = false, panelSelector }: { onClose: () => void; busy?: boolean; panelSelector?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const options = useRef({ onClose, busy, panelSelector });
  options.current = { onClose, busy, panelSelector };
  useModalScrollLock();
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog?.showModal();
    let pointer: number | null = null, releasedOutside = false;
    const outside = (event: MouseEvent) => {
      if (!dialog?.open || event.target !== dialog) return false;
      const panel = options.current.panelSelector ? dialog.querySelector(options.current.panelSelector) : dialog;
      if (!panel) return false;
      const bounds = panel.getBoundingClientRect();
      return event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    };
    const resetPointer = () => { pointer = null; releasedOutside = false; };
    const pointerDown = (event: PointerEvent) => {
      resetPointer();
      if (event.isPrimary && event.button === 0 && outside(event)) pointer = event.pointerId;
    };
    const pointerUp = (event: PointerEvent) => {
      releasedOutside = pointer === event.pointerId && outside(event);
    };
    const backdropClick = (event: MouseEvent) => {
      const dismiss = pointer !== null && releasedOutside && outside(event);
      resetPointer();
      if (dismiss && !options.current.busy) options.current.onClose();
    };
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || event.defaultPrevented || !dialog?.open || (event.target as Element)?.closest('dialog') !== dialog) return;
      const controls = [...dialog.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]')]
        .filter((element) => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first.focus();
      }
    };
    dialog?.addEventListener('keydown', trapFocus);
    dialog?.addEventListener('pointerdown', pointerDown);
    dialog?.addEventListener('pointerup', pointerUp);
    dialog?.addEventListener('pointercancel', resetPointer);
    dialog?.addEventListener('click', backdropClick);
    return () => {
      dialog?.removeEventListener('keydown', trapFocus);
      dialog?.removeEventListener('pointerdown', pointerDown);
      dialog?.removeEventListener('pointerup', pointerUp);
      dialog?.removeEventListener('pointercancel', resetPointer);
      dialog?.removeEventListener('click', backdropClick);
      dialog?.close();
      const remaining = [...document.querySelectorAll('dialog[open]')].filter((element) => element !== dialog).at(-1);
      if (opener?.isConnected && (!remaining || remaining.contains(opener))) opener.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}
