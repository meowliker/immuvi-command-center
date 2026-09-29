'use client';
import { useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, CircleMinus, Plus, Settings, Trash2 } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FIELD_CATALOG_LABELS, productAdminRequest, productFieldCatalog, productInitials } from '../../../lib/domain/product-administration.js';
import { previewProductDeletion } from '../../../lib/services/product-administration.js';
import { useProductAdministration } from '../hooks/use-product-administration';
import { TrackerDialog } from './tracker-dialog';
import { CommandHqOperations } from './command-hq-operations';
import type { Product, Profile } from '../types';
import styles from '../../command-center.module.css';
import { StaleAdCleanup } from './stale-ad-cleanup';

type Mode = 'create' | 'fields' | 'unlink' | 'delete';
export function ProductAdministration({ db, userId, product, profile, children }: { db: SupabaseClient; userId: string; product?: Product; profile: Profile; children: ReactNode }) {
  const [mode, setMode] = useState<Mode | null>(null);
  const write = useProductAdministration(db, userId);
  const [setupOpen, setSetupOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<Product | null>(null);
  function open(next: Mode) { setSnapshot(product ? structuredClone(product) : null); setMode(next); }
  const disabled = !write.ready || write.busy || Boolean(write.pending);
  const admin = profile.role === 'admin';
  return <div className={styles.productAdmin}>
    <header className={styles.productProfilesHeader}><h2>Product Profiles</h2>{admin && <button type="button" disabled={disabled} onClick={() => open('create')}><Plus size={13} />Add Product</button>}</header>
    {children}
    {product ? <CommandHqOperations product={product} profile={profile}
      unlink={admin && <button className={styles.productDangerButton} type="button" disabled={disabled} onClick={() => open('unlink')}><CircleMinus size={12} />Unlink</button>}
      setup={admin && <button type="button" onClick={() => setSetupOpen(true)}><Settings size={12} />Setup Fields</button>}
      cleanup={admin && <StaleAdCleanup key={`${userId}:${product.id}`} db={db} userId={userId} product={product} disabled={disabled} />}
      manage={admin && <button type="button" disabled={disabled} onClick={() => open('fields')}><Settings size={12} />Manage Fields</button>}
      remove={admin && <button className={`${styles.productDangerButton} ${styles.productDeleteButton}`} type="button" disabled={disabled} onClick={() => open('delete')}>Delete</button>}
    /> : <p>No products assigned</p>}
    {write.notice && <p role="status">{write.notice}</p>}
    {write.error && !mode && <p role="alert">{write.error}</p>}
    {write.pending && !mode && <p role="status">Pending product change: {write.pending.p_product_id}. <button disabled={write.busy} onClick={() => void write.submit(write.pending!)} type="button">Retry same request</button></p>}
    {mode && <ProductAdminDialog key={mode} mode={mode} product={snapshot} db={db} write={write} close={() => setMode(null)} />}
    {setupOpen && product && <TrackerDialog title="Setup ClickUp Fields" className={styles.legacyProductDialog} busy={false} onClose={() => setSetupOpen(false)}>
      <p>Create these three Dropdown fields once in your ClickUp list, then sync. The dashboard detects them automatically by name.</p>
      {Object.entries(FIELD_CATALOG_LABELS).map(([field, label], index) => <section key={field} className={styles.setupFieldBlock}><h3>{index + 1}. {label}<span>Dropdown</span></h3><p>{productFieldCatalog(product.config)[field].map(option => option.name).join(', ')}</p></section>)}
      <p>In ClickUp: open a task, select <strong>+ Add Custom Field</strong>, then choose Dropdown and add the options above.</p>
      <footer><button className={styles.productSyncButton} type="button" onClick={() => setSetupOpen(false)}>Got it</button></footer>
    </TrackerDialog>}
  </div>;
}

function ProductAdminDialog({ mode, product, db, write, close }: { mode: Mode; product: Product | null; db: SupabaseClient; write: ReturnType<typeof useProductAdministration>; close: () => void }) {
  const [name, setName] = useState(''), [color, setColor] = useState('#4f46e5'), [confirmName, setConfirmName] = useState('');
  const [catalog, setCatalog] = useState(() => productFieldCatalog(product?.config));
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewProductDeletion>> | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false), [error, setError] = useState('');
  const previewLock = useRef(false);
  const title = mode === 'create' ? 'Add Product' : mode === 'fields' ? 'Manage Fields' : mode === 'unlink' ? 'Unlink ClickUp List' : 'Delete Product';
  async function loadPreview() {
    if (previewLock.current || !product) return;
    previewLock.current = true; setPreviewBusy(true); setError('');
    try { setPreview(await previewProductDeletion(db, product.id)); }
    catch (cause) { setPreview(null); setError(cause instanceof Error ? cause.message : 'Preview failed.'); }
    finally { previewLock.current = false; setPreviewBusy(false); }
  }
  async function save() {
    setError('');
    try {
      const values = mode === 'create' ? { name: name.trim(), color } : mode === 'fields' ? { catalog }
        : mode === 'delete' ? { confirmName, revision: preview?.revision } : { confirmName };
      const request = write.pending || productAdminRequest(mode, mode === 'create' ? null : product, values);
      if (await write.submit(request)) close();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Invalid product change.'); }
  }
  function edit(field: string, index: number, key: string, value: string) {
    setCatalog((current) => ({ ...current, [field]: current[field].map((option, i) => i === index ? { ...option, [key]: value } : option) }));
  }
  function move(field: string, index: number, direction: number) {
    setCatalog((current) => { const options = [...current[field]]; [options[index], options[index + direction]] = [options[index + direction], options[index]]; return { ...current, [field]: options }; });
  }
  return <TrackerDialog title={title} className={styles.legacyProductDialog} busy={write.busy || previewBusy} error={error || write.error} onClose={close} closeLabel="Close product editor">
    <form className={styles.productAdminForm} onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={write.busy || previewBusy || Boolean(write.pending)}>
        {mode === 'create' ? <><label>Product name<input required maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></label><label>Color<input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label><p>Inspiration prefix: <output aria-label="Inspiration prefix">{productInitials(name)}</output></p></> : <p><strong>{product?.name}</strong></p>}
        {mode === 'fields' && Object.entries(FIELD_CATALOG_LABELS).map(([field, label]) => <details key={field} open={field === 'creativeStructure'}>
          <summary>{label}</summary><div className={styles.fieldCatalogRows}>{catalog[field].map((option, index) => <div key={index} className={styles.fieldCatalogRow}>
            <label>Name<input aria-label={`${label} option ${index + 1}`} maxLength={200} required value={option.name} onChange={(event) => edit(field, index, 'name', event.target.value)} /></label>
            <label>Description<input aria-label={`${label} description ${index + 1}`} maxLength={2000} value={option.desc} onChange={(event) => edit(field, index, 'desc', event.target.value)} /></label>
            <div><button type="button" title="Move option up" aria-label={`Move ${option.name || 'option'} up`} disabled={index === 0} onClick={() => move(field, index, -1)}><ArrowUp size={15} /></button>
              <button type="button" title="Move option down" aria-label={`Move ${option.name || 'option'} down`} disabled={index === catalog[field].length - 1} onClick={() => move(field, index, 1)}><ArrowDown size={15} /></button>
              <button type="button" title="Remove option" aria-label={`Remove ${option.name || 'option'}`} onClick={() => { if (window.confirm(`Remove "${option.name}" from ${product?.name}? Existing creative values will stay unchanged.`)) setCatalog((current) => ({ ...current, [field]: current[field].filter((_, i) => i !== index) })); }}><Trash2 size={15} /></button></div>
          </div>)}</div><button type="button" disabled={catalog[field].length >= 100} onClick={() => setCatalog((current) => ({ ...current, [field]: [...current[field], { name: '', desc: '' }] }))}><Plus size={15} />Add {label.toLowerCase()}</button>
        </details>)}
        {mode === 'unlink' && <p>Existing imported tasks will remain. This disconnects only the sync link.</p>}
        {mode === 'delete' && <><p>This permanently deletes this QA product and its dependent records. Remote ClickUp tasks will not be deleted.</p><button type="button" onClick={() => void loadPreview()}>{preview ? 'Refresh deletion preview' : 'Preview deletion'}</button>
          {preview && <><dl className={styles.productDeleteCounts}>{Object.entries(preview.counts).filter(([, count]) => Number(count) > 0).map(([table, count]) => <div key={table}><dt>{table}</dt><dd>{String(count)}</dd></div>)}</dl>{preview.blocked && <p role="alert">Queued or running work blocks deletion.</p>}</>}
        </>}
        {['unlink', 'delete'].includes(mode) && <label>Type product name<input autoComplete="off" required value={confirmName} onChange={(event) => setConfirmName(event.target.value)} /></label>}
      </fieldset>
      <footer><button type="button" disabled={write.busy || previewBusy} onClick={close}>Cancel</button><button type="submit" disabled={write.busy || previewBusy || (!write.pending && (['unlink', 'delete'].includes(mode) && confirmName !== product?.name || mode === 'delete' && (!preview || preview.blocked)))}>{write.busy ? 'Saving...' : write.pending ? 'Retry same request' : mode === 'delete' ? 'Delete product permanently' : 'Save product'}</button></footer>
    </form>
  </TrackerDialog>;
}
