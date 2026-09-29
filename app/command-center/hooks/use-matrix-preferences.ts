'use client';
import { useEffect, useState } from 'react';
import { MATRIX_DEFAULTS, MATRIX_SORTS } from '../../../lib/domain/creative-matrix.js';
export type MatrixPreferences = Omit<typeof MATRIX_DEFAULTS, 'statuses' | 'manualOrder'> & { statuses: string[]; manualOrder: string[] };
export function useMatrixPreferences(productId: string) {
  const [preferences, setPreferences] = useState<MatrixPreferences>({ ...MATRIX_DEFAULTS });
  const [ready, setReady] = useState('');
  const key = `immuvi:qa:matrix:v1:${productId}`;
  useEffect(() => {
    let saved: Partial<MatrixPreferences> = {};
    try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch {}
    const next = { ...MATRIX_DEFAULTS } as MatrixPreferences;
    if (saved && typeof saved === 'object') for (const name of Object.keys(next) as (keyof MatrixPreferences)[]) {
      if (typeof saved[name] === typeof next[name]) Object.assign(next, { [name]: saved[name] });
    }
    next.statuses = Array.isArray(saved?.statuses) ? saved.statuses.filter((s) => ['winner','testing','prelaunch','loser','untested'].includes(s)) : [];
    next.manualOrder = Array.isArray(saved?.manualOrder) ? saved.manualOrder.filter((id) => typeof id === 'string') : [];
    if (!Object.hasOwn(MATRIX_SORTS,next.sort)) next.sort='manual';
    if (!['compact','comfortable','detailed'].includes(next.density)) next.density='comfortable';
    if (!['scope','highlight'].includes(next.filterMode)) next.filterMode='scope';
    setPreferences(next); setReady(key);
  }, [key]);
  useEffect(() => { if (ready === key) try { localStorage.setItem(key,JSON.stringify(preferences)); } catch {} }, [key,ready,preferences]);
  const change = <K extends keyof MatrixPreferences>(name: K, value: MatrixPreferences[K]) => setPreferences((current) => ({ ...current,[name]:value }));
  return { preferences, change, reset: () => setPreferences((current) => ({ ...MATRIX_DEFAULTS, manualOrder: current.manualOrder, density: current.density, sort: current.sort })) };
}
