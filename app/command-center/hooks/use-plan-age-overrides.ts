'use client';
import { useEffect, useState } from 'react';

export function usePlanAgeOverrides(productId: string) {
  const [overrides, setOverrides] = useState<Record<string, unknown>>({});
  useEffect(() => {
    function read() {
      try {
        const value = JSON.parse(localStorage.getItem('ap.ageThresholds.overrides') || '{}')?.[productId];
        setOverrides(value && typeof value === 'object' && !Array.isArray(value) ? value : {});
      } catch { setOverrides({}); }
    }
    function changed(event: StorageEvent) { if (event.key === null || event.key === 'ap.ageThresholds.overrides') read(); }
    read();
    window.addEventListener('storage', changed);
    window.addEventListener('focus', read);
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('focus', read); };
  }, [productId]);
  return overrides;
}
