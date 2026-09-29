import { useLayoutEffect, type RefObject } from 'react';

export function usePlanMenuPosition(open: boolean, trigger: RefObject<HTMLButtonElement | null>, menu: RefObject<HTMLDivElement | null>, dismiss: () => void, width = 250) {
  useLayoutEffect(() => {
    const panel = menu.current, button = trigger.current;
    if (!open || !panel || !button) return;
    let frame = 0;
    const place = () => {
      const viewport = window.visualViewport;
      const left = (viewport?.offsetLeft || 0) + 12, top = (viewport?.offsetTop || 0) + 12;
      const right = left + (viewport?.width || window.innerWidth) - 24;
      const bottom = top + (viewport?.height || window.innerHeight) - 24;
      const anchor = button.getBoundingClientRect();
      if (anchor.bottom <= top || anchor.top >= bottom || anchor.right <= left || anchor.left >= right) {
        dismiss(); return;
      }
      panel.style.width = `${Math.min(width, right - left)}px`;
      const options = panel.lastElementChild as HTMLElement;
      // Measure intrinsic options without expanding the scroller and losing its scroll position.
      const height = panel.getBoundingClientRect().height - options.getBoundingClientRect().height
        + Math.min(parseFloat(getComputedStyle(options).maxHeight) || Infinity, options.scrollHeight);
      const below = Math.max(0, bottom - anchor.bottom - 4), above = Math.max(0, anchor.top - top - 4);
      const upward = height > below && above > below;
      const available = upward ? above : below;
      const visibleHeight = Math.min(height, available);
      panel.style.maxHeight = `${available}px`;
      panel.style.left = `${Math.max(left, Math.min(anchor.left, right - panel.getBoundingClientRect().width))}px`;
      panel.style.top = `${upward ? anchor.top - 4 - visibleHeight : anchor.bottom + 4}px`;
      panel.dataset.placement = upward ? 'above' : 'below';
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    place();
    const observer = new ResizeObserver(schedule);
    observer.observe(button); observer.observe(panel);
    // Custom date fields can grow inside an already height-constrained scroller.
    if (panel.lastElementChild?.firstElementChild) observer.observe(panel.lastElementChild.firstElementChild);
    window.addEventListener('resize', schedule);
    document.addEventListener('scroll', schedule, true);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener('resize', schedule);
      document.removeEventListener('scroll', schedule, true);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
    };
  }, [open, trigger, menu, dismiss, width]);
}
