'use client';
import { useEffect, useRef } from 'react';

// Position explicitly: CSS anchor positioning is not available in every browser.
export function useAnchoredPopover(enabled = true) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const menu = panel.current;
    if (!enabled || !menu) return;
    const position = () => {
      if (!menu.matches(':popover-open') || !trigger.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const width = menu.offsetWidth, height = menu.offsetHeight, gap = 6, inset = 8;
      const below = rect.bottom + gap;
      const top = below + height <= window.innerHeight - inset ? below : rect.top - height - gap;
      menu.style.left = `${Math.max(inset, Math.min(rect.right - width, window.innerWidth - width - inset))}px`;
      menu.style.top = `${Math.max(inset, Math.min(top, window.innerHeight - height - inset))}px`;
    };
    menu.addEventListener('toggle', position);
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    const observer = new ResizeObserver(position);
    observer.observe(menu);
    return () => {
      menu.removeEventListener('toggle', position);
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
      observer.disconnect();
    };
  }, [enabled]);
  return { trigger, panel };
}
