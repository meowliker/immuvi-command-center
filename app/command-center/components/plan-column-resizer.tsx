import { useRef } from 'react';
import styles from '../../command-center.module.css';

export function PlanColumnResizer({ label, width, min, disabled, preview, commit }: {
  label: string; width: number; min: number; disabled: boolean;
  preview: (width: number | null) => void; commit: (width: number) => void;
}) {
  const drag = useRef<{ id: number; x: number; width: number; next: number } | null>(null);
  const clamp = (value: number) => Math.round(Math.max(min, Math.min(600, value)));
  function cancel() {
    if (!drag.current) return;
    drag.current = null;
    preview(null);
  }
  return <span role="separator" aria-orientation="vertical" aria-label={`Resize ${label} column`}
    aria-valuemin={min} aria-valuemax={600} aria-valuenow={width} aria-disabled={disabled}
    tabIndex={disabled ? -1 : 0} title={`Drag to resize ${label}`}
    className={styles.planColumnResizer}
    onClick={(event) => event.stopPropagation()}
    onPointerDown={(event) => {
      if (disabled || event.button !== 0) return;
      event.preventDefault(); event.stopPropagation();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { id: event.pointerId, x: event.clientX, width, next: width };
    }}
    onPointerMove={(event) => {
      const start = drag.current;
      if (!start || start.id !== event.pointerId) return;
      start.next = clamp(start.width + event.clientX - start.x);
      preview(start.next);
    }}
    onPointerUp={(event) => {
      const start = drag.current;
      if (!start || start.id !== event.pointerId) return;
      drag.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
      if (start.next !== start.width) commit(start.next);
      else preview(null);
    }}
    onPointerCancel={cancel} onLostPointerCapture={cancel}
    onKeyDown={(event) => {
      if (event.key === 'Escape') { cancel(); return; }
      if (disabled || drag.current) return;
      const next = event.key === 'ArrowLeft' ? width - 10 : event.key === 'ArrowRight' ? width + 10
        : event.key === 'Home' ? min : event.key === 'End' ? 600 : null;
      if (next === null) return;
      event.preventDefault(); event.stopPropagation();
      if (clamp(next) !== width) commit(clamp(next));
    }} />;
}
