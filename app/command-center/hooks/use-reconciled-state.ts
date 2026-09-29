'use client';

import { useCallback, useState, type SetStateAction } from 'react';
import { reconcileRows, sameData } from '../../../lib/domain/live-data.js';

export function useReconciledState<T>(initial: T, key?: (row: T extends Array<infer Row> ? Row : never) => unknown) {
  const [value, setValue] = useState(initial);
  const setReconciled = useCallback((next: SetStateAction<T>) => {
    setValue((previous) => {
      const incoming = typeof next === 'function' ? (next as (value: T) => T)(previous) : next;
      if (Array.isArray(previous) && Array.isArray(incoming)) return reconcileRows(previous, incoming, key) as T;
      return sameData(previous, incoming) ? previous : incoming;
    });
  }, [key]);
  return [value, setReconciled] as const;
}
