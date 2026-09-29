'use client';
import { createContext, useContext, useId, useMemo, type ReactNode } from 'react';
import { productFieldCatalog } from '../../../lib/domain/product-administration.js';
import type { Product } from '../types';

const CatalogContext = createContext<ReturnType<typeof productFieldCatalog> | null>(null);
export function useProductFieldCatalog() {
  return useContext(CatalogContext) ?? productFieldCatalog();
}
export function ProductFieldCatalogProvider({ product, children }: { product?: Product; children: ReactNode }) {
  const catalog = useMemo(() => productFieldCatalog(product?.config), [product?.config]);
  return <CatalogContext.Provider value={catalog}>{children}</CatalogContext.Provider>;
}
export function ProductFieldInput({ field, value, onChange, label }: { field: string; value: string; onChange: (value: string) => void; label: string }) {
  const catalog = useContext(CatalogContext);
  const id = useId();
  const options = catalog?.[field] || [];
  const description = options.find((option) => option.name === value)?.desc;
  return <><input aria-label={label} aria-describedby={description ? `${id}-description` : undefined} list={options.length ? id : undefined} value={value} onChange={(event) => onChange(event.target.value)} />
    <datalist id={id}>{options.map((option) => <option key={option.name} value={option.name}>{option.desc}</option>)}</datalist>
    {description && <small id={`${id}-description`} style={{ overflowWrap: 'anywhere', fontWeight: 400 }}>{description}</small>}</>;
}
