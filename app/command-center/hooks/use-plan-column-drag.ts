import { useEffect, useRef, useState, type PointerEvent } from 'react';

type Drop = { key: string; edge: 'before' | 'after' };
type Drag = { key: string; id: number; startY: number; x: number; y: number; moved: boolean; drop: Drop | null };

export function usePlanColumnDrag(move: (key: string, target: string, edge: Drop['edge']) => void) {
  const list = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const frame = useRef(0);
  const [source, setSource] = useState('');
  const [drop, setDrop] = useState<Drop | null>(null);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  function cancel() {
    cancelAnimationFrame(frame.current);
    drag.current = null; setSource(''); setDrop(null);
  }
  function locate() {
    const current = drag.current, root = list.current, dialog = root?.closest('dialog');
    if (!current || !root || !dialog) return;
    const bounds = root.getBoundingClientRect(), viewport = dialog.getBoundingClientRect();
    let target: Drop | null = null;
    if (current.moved && current.x >= bounds.left && current.x <= bounds.right
      && current.y >= Math.max(viewport.top, bounds.top) && current.y <= Math.min(viewport.bottom, bounds.bottom)) {
      const rows = Array.from(root.querySelectorAll<HTMLElement>('[data-column-option]')).filter(row => row.dataset.columnOption !== current.key);
      const next = rows.find(row => current.y < row.getBoundingClientRect().bottom);
      const row = next || rows.at(-1);
      if (row) {
        const bounds = row.getBoundingClientRect();
        target = { key: row.dataset.columnOption!, edge: current.y < bounds.top + bounds.height / 2 ? 'before' : 'after' };
      }
    }
    current.drop = target;
    setDrop(previous => previous?.key === target?.key && previous?.edge === target?.edge ? previous : target);
  }
  function scroll() {
    const current = drag.current, root = list.current, dialog = root?.closest('dialog');
    if (!current || !root || !dialog) return;
    const viewport = dialog.getBoundingClientRect(), bounds = root.getBoundingClientRect();
    if (current.moved && current.x >= bounds.left && current.x <= bounds.right && current.y >= viewport.top && current.y <= viewport.bottom) {
      const distance = current.y < viewport.top + 60 ? current.y - viewport.top - 60
        : current.y > viewport.bottom - 60 ? current.y - viewport.bottom + 60 : 0;
      if (distance) { dialog.scrollTop += Math.sign(distance) * Math.min(14, Math.abs(distance) / 4); locate(); }
    }
    frame.current = requestAnimationFrame(scroll);
  }
  function start(event: PointerEvent<HTMLButtonElement>, key: string) {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { key, id: event.pointerId, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false, drop: null };
    setSource(key);
    frame.current = requestAnimationFrame(scroll);
  }
  function update(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || event.pointerId !== current.id) return;
    current.x = event.clientX; current.y = event.clientY;
    current.moved ||= Math.abs(event.clientY - current.startY) > 4;
    locate();
  }
  function end(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current;
    if (!current || event.pointerId !== current.id) return;
    update(event);
    const target = current.drop;
    if (target && current.moved) move(current.key, target.key, target.edge);
    cancel();
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
  return { list, source, drop, start, update, end, cancel };
}
