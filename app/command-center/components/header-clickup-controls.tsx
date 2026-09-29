'use client';
import { useEffect, useState } from 'react';
import { KeyRound, RefreshCw } from 'lucide-react';
import type { Product } from '../types';
import { useClickUpControls } from './clickup-provider';
import { ForceReloadControl } from './workspace-session';
import { ClickUpErrorNotice } from './clickup-error-notice';
import { productClickUpListId } from '../../../lib/domain/product-config.js';
import { QA_CLICKUP_LIST_ID } from '../../../lib/domain/clickup-sync.js';
import { syncAge } from '../../../lib/domain/workspace-header.js';
import styles from '../workspace-header.module.css';

export function HeaderClickUpControls({product}:{product:Product}) {
  const state=useClickUpControls();const [now,setNow]=useState(Date.now());
  useEffect(()=>{const timer=window.setInterval(()=>setNow(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  if(!state)return null;
  const linked=productClickUpListId(product)===QA_CLICKUP_LIST_ID;
  const disabled=!!state.busy || !state.token.trim() || !linked;
  const lastSync=state.lastSyncedAt || Number(product.config?.last_synced_at_ms || 0);
  return <div className={styles.clickupControls}>
    <div className={styles.keyField}><label><KeyRound size={14}/><input type="text" name="clickup-api-token" className={styles.apiTokenInput} aria-label="QA session API key" placeholder="ClickUp API key" title="ClickUp API key" autoComplete="off" autoCapitalize="none" data-1p-ignore data-lpignore="true" data-bwignore="true" spellCheck={false} value={state.token} disabled={!!state.busy} onChange={event=>state.setToken(event.target.value)}/></label>
      <small title={state.identity?.email || ''}>{state.verifying?'Verifying key...':state.identity?`ClickUp: ${state.identity.name}`:'ClickUp account not verified'}</small>
    </div>
    <button type="button" className={`${styles.syncButton} ${styles.iconButton}`} aria-label="Sync ClickUp" aria-busy={state.busy==='sync'} disabled={disabled} title={!linked?'Sync ClickUp: configure the QA list first':state.busy==='sync'?'Syncing ClickUp...':'Sync ClickUp now'} onClick={()=>void state.run('sync')}><RefreshCw size={15} className={state.busy==='sync'?styles.spinning:undefined}/></button>
    <label className={styles.liveSync} title={!linked?'An administrator must connect a QA ClickUp list':!state.token.trim()?'Enter your ClickUp API key':'60 seconds in foreground; 5 minutes in background'}><input type="checkbox" aria-label="Live sync" checked={state.autoSync} onChange={event=>state.setAutoSync(event.target.checked)}/><i data-live={state.autoSync && linked && !!state.identity}/><span>Live sync {state.autoSync?'on':'off'}</span><small>{!linked?'No linked list':!state.token.trim()?'Key required':!state.identity?'Verify key':syncAge(lastSync,now)}</small></label>
    <ForceReloadControl/>
    {!state.settingsOpen && <ClickUpErrorNotice message={state.error || state.identityError} onDismiss={state.dismissError} />}
    {state.notice?<span role="status" data-notification-ignore className={styles.syncNotice}>{state.notice}</span>:null}
  </div>;
}
