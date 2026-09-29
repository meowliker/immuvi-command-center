'use client';

import { Folder, Link2, List } from 'lucide-react';
import { QA_CLICKUP_LIST_ID } from '../../../lib/domain/clickup-sync.js';
import { productClickUpListId } from '../../../lib/domain/product-config.js';
import type { Product, Profile } from '../types';
import { useClickUpControls } from './clickup-provider';
import { TrackerDialog } from './tracker-dialog';
import { ClickUpErrorNotice } from './clickup-error-notice';
import styles from '../../command-center.module.css';

export function ClickUpConnection({ product, profile }: { product: Product; profile: Profile }) {
  const state = useClickUpControls();
  if (!state) return null;
  const linked = productClickUpListId(product) === QA_CLICKUP_LIST_ID;
  const busy = !!state.busy;
  const schema = state.schema;
  const link = async (listId?: string) => {
    if (await state.run('link', listId)) state.closeSettings();
  };
  return <>
    <details ref={state.detailsRef} className={styles.clickupConnection}>
      <summary>ClickUp <span>{state.busy ? 'Working...' : state.error ? 'Needs attention' : linked ? 'QA test list' : 'Not connected'}</span></summary>
      <div className={styles.clickupButtons}>
        {profile.role === 'admin' ? <button type="button" disabled={busy} onClick={state.openSettings}><Link2 size={14}/>{linked ? 'Change ClickUp list' : 'Link ClickUp list'}</button> : <span>An administrator must link the ClickUp list.</span>}
        <button type="button" disabled={busy || !state.token} onClick={state.forget}>Forget key</button>
      </div>
    </details>
    {state.settingsOpen ? <TrackerDialog title="Link ClickUp List" className={styles.legacyProductDialog} busy={busy} onClose={state.closeSettings} closeLabel="Close ClickUp connection">
      <ClickUpErrorNotice message={state.error || state.identityError} onDismiss={state.dismissError} />
      {!state.token.trim() ? <p>ClickUp API key required.</p> : profile.role !== 'admin' ? <p>Only an administrator can link a list.</p> : <>
        <p>Select a list for <strong>{product.name}</strong>, or enter its ID manually.</p>
        <section className={styles.clickupListPicker} aria-label="Available QA lists">
          {state.busy === 'inspect' ? <p role="status">Loading lists...</p> : schema ? <>
            {schema.list.spaceName && <p><Folder size={14}/> <strong>{schema.list.spaceName}</strong></p>}
            {schema.list.folderName && <p className={styles.clickupFolder}><Folder size={13}/>{schema.list.folderName}</p>}
            <div className={styles.clickupListChoice}>
              <List size={14}/><span><strong>{schema.list.name}</strong><small>{schema.list.id}</small></span><button type="button" className={styles.productSyncButton} disabled={busy} onClick={() => void link(schema.list.id)}>{busy ? 'Connecting...' : 'Select'}</button>
            </div>
          </> : <p>No list loaded.</p>}
        </section>
        <details className={styles.clickupManual}>
          <summary>Manual entry (fallback)</summary>
          <form onSubmit={event => { event.preventDefault(); void link(); }}>
            <label>List ID<input placeholder="List ID or URL" required value={state.listInput} disabled={busy} onChange={event => state.setListInput(event.target.value)}/></label>
            <button className={styles.productSyncButton} type="submit" disabled={busy}>{busy ? 'Connecting...' : 'Save'}</button>
          </form>
        </details>
      </>}
      <footer><button type="button" disabled={busy} onClick={state.closeSettings}>Cancel</button></footer>
    </TrackerDialog> : null}
  </>;
}
