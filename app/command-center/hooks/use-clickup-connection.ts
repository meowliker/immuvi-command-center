'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '../types';
import { parseClickUpListId } from '../../../lib/domain/clickup.js';
import { productClickUpListId } from '../../../lib/domain/product-config.js';
import { assertQaClickUpList, inferClickUpMappings, QA_CLICKUP_LIST_ID } from '../../../lib/domain/clickup-sync.js';
import { verifyClickUpSyncSummary, verifyClickUpConnection } from '../../../lib/domain/command-hq-health.js';
import { getLiveSync } from '../../../lib/services/live-sync.js';
import { qaClickUpToken, qaLiveSyncPreference, requestQaClickUp, storeQaClickUpToken, storeQaLiveSyncPreference } from '../services/qa-clickup';

type Field = { id: string; name: string; type: string; type_config?: { options?: { name?: string; label?: string }[] } };
type Schema = { list: { id: string; name: string; spaceName?: string; folderName?: string }; fields: Field[]; mappings: Record<string, string>; productUpdatedAt: string };

export function useClickUpConnection(supabase: SupabaseClient, product: Product, userId: string, isAdmin: boolean) {
  const [token, setTokenValue] = useState('');
  const [listInput, setListInput] = useState(productClickUpListId(product) || QA_CLICKUP_LIST_ID);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [syncPreference, setSyncPreference] = useState<{ userId: string; enabled: boolean } | null>(null);
  const preferenceReady = syncPreference?.userId === userId;
  const autoSync = preferenceReady ? syncPreference.enabled : true;
  const [lastSyncedAt,setLastSyncedAt]=useState(0);
  const [identity,setIdentity]=useState<{id:string;name:string;email:string}|null>(null);
  const [identityError,setIdentityError]=useState('');
  const [verifying,setVerifying]=useState(false);
  const identityRequest=useRef<AbortController|null>(null);
  const active = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const linkedList = productClickUpListId(product);
  const previousList = useRef(linkedList);
  const savedList = useRef('');

  useEffect(() => {
    active.current = true;
    setTokenValue(qaClickUpToken(userId));
    setSyncPreference({ userId, enabled: qaLiveSyncPreference(userId) });
    return () => { active.current = false; controller.current?.abort(); identityRequest.current?.abort(); };
  }, [userId]);
  useLayoutEffect(() => {
    if (previousList.current === linkedList) return;
    previousList.current = linkedList;
    const ownLink = savedList.current === linkedList;
    savedList.current = '';
    if (ownLink) return;
    controller.current?.abort();
    setLastSyncedAt(0); setSchema(null); setListInput(linkedList || QA_CLICKUP_LIST_ID); setNotice(''); setError('');
  }, [linkedList]);

  function setToken(value: string) {
    identityRequest.current?.abort();identityRequest.current=null;setIdentity(null);setIdentityError('');setVerifying(false);
    try { storeQaClickUpToken(userId,''); } catch { setIdentityError('Browser session storage is unavailable.'); }
    setTokenValue(value); setSchema(null); setNotice(''); setError('');
  }

  function setAutoSync(enabled: boolean) {
    setSyncPreference({ userId, enabled });
    storeQaLiveSyncPreference(userId, enabled);
  }

  async function verifyKey() {
    identityRequest.current?.abort();
    if (!token.trim()) return;
    const request=new AbortController();identityRequest.current=request;setVerifying(true);setIdentityError('');
    try {
      storeQaClickUpToken(userId,token);
      const result=await requestQaClickUp(supabase,product.id,{operation:'identity'},request.signal);
      if (request.signal.aborted || !active.current) return;
      if (!result.user?.id || typeof result.user.name!=='string') throw new Error('ClickUp user identity could not be verified.');
      setIdentity(result.user);
    } catch(cause) {
      if (!request.signal.aborted && active.current) { setIdentity(null);setIdentityError(cause instanceof Error?cause.message:'Could not verify ClickUp key.'); }
    } finally { if(identityRequest.current===request) {identityRequest.current=null;if(active.current)setVerifying(false);} }
  }
  useEffect(()=>{
    if (!token.trim()) return;
    const timer=window.setTimeout(()=>void verifyKey(),700);
    return ()=>{window.clearTimeout(timer);identityRequest.current?.abort();};
  },[token]);

  async function run(operation: 'inspect' | 'link' | 'sync', selectedList?: string, background = false) {
    if (controller.current) return false;
    const sync = getLiveSync(supabase);
    let finish = operation === 'sync' ? null : sync.beginWrite(product.id);
    if (operation !== 'sync' && !finish) { if (!background) setError('A product change is still being saved. Try again shortly.'); return false; }
    const request = new AbortController();
    controller.current = request;
    setBusy(operation); setError(''); setNotice('');
    if (operation === 'inspect') setSchema(null);
    let linkSaved = false;
    try {
      if (operation !== 'sync' && !isAdmin) throw new Error('Only an administrator can configure the ClickUp list.');
      const listId = operation === 'sync' ? productClickUpListId(product) : parseClickUpListId(selectedList ?? listInput);
      assertQaClickUpList(listId);
      storeQaClickUpToken(userId, token);
      let result = await requestQaClickUp(supabase, product.id, {
        operation, listId, ...(operation === 'sync' ? { prepareOnly: true } : {}), ...(operation === 'link' ? { expectedUpdatedAt: schema?.productUpdatedAt || product.updated_at } : {}),
      }, request.signal);
      if (!active.current || request.signal.aborted) return false;
      if (operation === 'sync') {
        if (result.productId !== product.id || result.listId !== listId || !result.productUpdatedAt || !Array.isArray(result.plan?.ads) || !Array.isArray(result.plan?.actions)) throw new Error('ClickUp sync snapshot could not be verified.');
        // Network reads do not block edits. Give user writes priority at commit time.
        finish = sync.beginWrite(product.id);
        if (!finish) return false;
        const committed = await supabase.rpc('apply_qa_clickup_sync', {
          p_product_id: product.id, p_list_id: listId, p_expected_updated_at: result.productUpdatedAt, p_plan: result.plan,
        }).abortSignal(request.signal);
        if (committed.error) {
          if (background && /changed during sync|settings changed during sync/i.test(committed.error.message)) return false;
          throw new Error(committed.error.message);
        }
        if (!active.current || request.signal.aborted) return false;
        result = committed.data;
        setNotice(verifyClickUpSyncSummary(result));
        setLastSyncedAt(Date.now());
      } else {
        verifyClickUpConnection(result, listId, operation === 'link' ? inferClickUpMappings(result.fields) : null);
        setSchema(result);
        if (operation === 'link') {
          linkSaved = true;
          savedList.current = listId;
          setListInput(listId);
          setNotice(`${result.list.name} linked. Importing tasks...`);
          setBusy('sync');
          // The server rereads the saved product; do not wait for a realtime prop update.
          const synced = await requestQaClickUp(supabase, product.id, { operation: 'sync' }, request.signal);
          if (!active.current || request.signal.aborted) return false;
          setNotice(`${result.list.name} linked. ${verifyClickUpSyncSummary(synced)}`);
          setLastSyncedAt(Date.now());
        }
      }
      return true;
    } catch (cause) {
      if (active.current && !request.signal.aborted) {
        const message = cause instanceof Error ? cause.message : 'ClickUp operation failed.';
        setError(linkSaved ? `List linked, but initial sync failed: ${message} Retry with the sync button.` : message);
        if (linkSaved) setNotice('ClickUp list linked.');
      }
      return linkSaved;
    } finally {
      controller.current = null;
      if (active.current) setBusy('');
      finish?.();
    }
  }

  const runRef = useRef(run);
  useEffect(() => { runRef.current = run; });
  useEffect(() => {
    if (!preferenceReady || !autoSync || !identity || !token.trim() || linkedList !== QA_CLICKUP_LIST_ID) return;
    let timer:number;
    let lastKick=0;
    const kick=()=>{if(navigator.onLine && Date.now()-lastKick>=5000){lastKick=Date.now();void runRef.current('sync', undefined, true);}};
    const schedule=()=>{window.clearInterval(timer);timer=window.setInterval(kick,document.hidden?300_000:60_000);};
    const visible=()=>{schedule();if(!document.hidden)kick();};
    schedule();kick();document.addEventListener('visibilitychange',visible);window.addEventListener('focus',kick);window.addEventListener('online',kick);
    return ()=>{window.clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('focus',kick);window.removeEventListener('online',kick);};
  }, [autoSync, preferenceReady, identity, token, linkedList]);

  function forget() {
    if (controller.current) return;
    try {
      storeQaClickUpToken(userId, ''); setToken(''); setError(''); setNotice('QA session key removed.');
    } catch { setError('Could not remove the session key. Check browser storage access.'); }
  }

  function dismissError() { setError(''); setIdentityError(''); }

  return { token, setToken, identity,identityError,verifying,lastSyncedAt, listInput, setListInput, schema, busy, error, notice, autoSync, setAutoSync, run, forget, dismissError };
}
