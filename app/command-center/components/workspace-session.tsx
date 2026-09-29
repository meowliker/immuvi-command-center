'use client';
import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Bell, LogOut, MonitorUp, X } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Profile } from '../types';
import { useLiveQuery } from '../hooks/use-live-query';
import { useModalDialog } from '../hooks/use-modal-dialog';
import { getLiveSync } from '../../../lib/services/live-sync.js';
import { notificationText, reloadState } from '../../../lib/domain/workspace-header.js';
import { TrackerDialog } from './tracker-dialog';
import { useWorkspacePresence, type OnlineMember } from '../hooks/use-workspace-presence';
import { useAnchoredPopover } from '../hooks/use-anchored-popover';
import { WorkspaceToasts } from './workspace-toasts';
import shared from '../../command-center.module.css';
import styles from '../workspace-header.module.css';

type Notice={id:number;text:string;kind:string;at:number};
type SessionState={profile:Profile;members:OnlineMember[];presenceStatus:string;setClickUpUserId:(value:string|null)=>void;notices:Notice[];unread:number;open:boolean;setOpen:(value:boolean)=>void;clear:()=>void;requestReload:()=>Promise<void>;busy:boolean;reloadError:string;reloadAvailable:boolean};
const SessionContext=createContext<SessionState|null>(null);

export function WorkspaceSessionProvider({db,profile,children}:{db:SupabaseClient;profile:Profile;children:ReactNode}) {
  const [clickUpUserId,setClickUpUserId]=useState<string|null>(null);
  const presence=useWorkspacePresence(db,profile.id,clickUpUserId);
  const [notices,setNotices]=useState<Notice[]>([]),[unread,setUnread]=useState(0),[open,setOpenState]=useState(false);
  const isOpen=useRef(false),sequence=useRef(0);
  const banner=useRef<HTMLDivElement>(null);
  const [forced,setForced]=useState<{id:string;by:string}|null>(null),[seconds,setSeconds]=useState(5);
  const [versionChanged,setVersionChanged]=useState(false),[snoozedUntil,setSnoozedUntil]=useState(0);
  const [busy,setBusy]=useState(false),[reloadError,setReloadError]=useState(''),[reloadAvailable,setReloadAvailable]=useState(false);
  const cutoff=useRef<string|null>(null),seen=useRef(new Set<string>()),requestId=useRef<string|null>(null),lock=useRef(false),alive=useRef(true);
  function setOpen(value:boolean) {
    isOpen.current=value;setOpenState(value);if(value)setUnread(0);
  }
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const record = useCallback((text:string,kind:string) => {
    const clean=notificationText(text);if(!clean)return;
    const notice={id:++sequence.current,text:clean,kind,at:Date.now()};
    setNotices(old=>[notice,...old].slice(0,200));
    if(!isOpen.current)setUnread(n=>Math.min(200,n+1));
  }, []);
  function receive(row:{id:string;triggered_by:string}) {
    if(seen.current.has(row.id))return;
    seen.current.add(row.id);setForced({id:row.id,by:row.triggered_by});setSeconds(5);
    record(`Team reload requested by ${row.triggered_by}.`,'warn');
  }
  const reload=useLiveQuery({supabase:db,productId:'',scopeKey:profile.id,tables:['qa_force_reloads'],load:async(signal)=>{
    const result=await db.rpc('qa_reload_state').abortSignal(signal);
    if(result.error)throw new Error('Team reload service unavailable.');
    const value=reloadState(result.data);
    return ()=>{
      setReloadAvailable(true);
      if(cutoff.current===null){cutoff.current=value.serverNow;return;}
      if(value.latest && Date.parse(value.latest.triggered_at)>Date.parse(cutoff.current))receive(value.latest);
    };
  }});
  useEffect(()=>{
    const root=document.querySelector('[data-workspace]');if(!root)return;
    const prior=new WeakMap<Element,string>();
    const collect=()=>{
      root.querySelectorAll('[role="alert"],[role="status"],[class*="_notice_"],[class*="_error_"]').forEach(node=>{
        if(node.closest('[data-notification-ignore],[data-hq-sync-notice]') || !(node instanceof HTMLElement) || !node.getClientRects().length)return;
        const text=node.innerText.trim();
        if(!text || /^(loading|checking|saving|working)\b/i.test(text) || prior.get(node)===text)return;
        prior.set(node,text);record(text,node.getAttribute('role')==='alert' || node.className.includes('_error_')?'error':'info');
      });
    };
    const observer=new MutationObserver(collect);observer.observe(root,{subtree:true,childList:true,characterData:true});collect();
    return ()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(!forced)return;
    const timer=window.setInterval(()=>setSeconds(n=>Math.max(0,n-1)),1000);
    return ()=>window.clearInterval(timer);
  },[forced]);
  useEffect(()=>{
    if(!forced || seconds>0)return;
    const attempt=()=>{if(!getLiveSync(db).isWriting(''))window.location.reload();};
    attempt();const timer=window.setInterval(attempt,1000);return()=>window.clearInterval(timer);
  },[forced,seconds,db]);
  useEffect(()=>{
    let baseline:string|null=null,disposed=false;const request=new AbortController();
    const check=async()=>{try{const response=await fetch('/api/app-version',{cache:'no-store',signal:request.signal});if(!response.ok)return;const {version}=await response.json();if(disposed || typeof version!=='string' || !version)return;if(baseline && baseline!==version)setVersionChanged(true);else baseline=version;}catch{/* Retry on the next version poll. */}};
    void check();const timer=window.setInterval(()=>void check(),300_000);
    return()=>{disposed=true;request.abort();window.clearInterval(timer);};
  },[]);
  useEffect(()=>{if(!snoozedUntil)return;const timer=window.setTimeout(()=>setSnoozedUntil(0),Math.max(0,snoozedUntil-Date.now()));return()=>clearTimeout(timer);},[snoozedUntil]);
  useEffect(()=>{const node=banner.current;if(node)node.showPopover();return()=>{if(node?.isConnected)node.hidePopover();};},[forced,versionChanged,snoozedUntil]);
  async function requestReload() {
    if(lock.current)return;lock.current=true;setBusy(true);setReloadError('');
    try {
      requestId.current ||= crypto.randomUUID();
      const result=await db.rpc('qa_request_reload',{p_request_id:requestId.current});
      if(result.error)throw new Error(result.error.message);
      const row=result.data;
      if(!row || row.id!==requestId.current || row.actor_id!==profile.id || typeof row.triggered_by!=='string')throw new Error('Reload request acknowledgement could not be verified. Retry the same request.');
      if(alive.current)receive(row);
      requestId.current=null;
    }catch(cause){if(alive.current)setReloadError(cause instanceof Error?cause.message:'Team reload failed.');}
    finally{lock.current=false;if(alive.current)setBusy(false);}
  }
  return <SessionContext.Provider value={{profile,members:presence.members,presenceStatus:presence.status,setClickUpUserId,notices,unread,open,setOpen,clear:()=>{setNotices([]);setUnread(0);},requestReload,busy,reloadError:reloadError || reload.error,reloadAvailable:reloadAvailable && !reload.error}}>
    <WorkspaceToasts onRecord={record}>
    {children}
    {forced || versionChanged && !snoozedUntil?<div ref={banner} popover="manual" className={styles.reloadBanner} role="alert" data-notification-ignore>
      {forced?<span>Team reload requested by {forced.by}. {seconds?`Reloading in ${seconds}s.`:'Waiting for active saves before reloading.'}</span>:<><span>A new app version is available.</span><button type="button" onClick={()=>window.location.reload()}>Reload now</button><button type="button" onClick={()=>setSnoozedUntil(Date.now()+900_000)}>Later</button></>}
    </div>:null}
    </WorkspaceToasts>
  </SessionContext.Provider>;
}

export function useClickUpPresenceIdentity(clickUpUserId: string | null) {
  const setIdentity = useContext(SessionContext)?.setClickUpUserId;
  useEffect(() => {
    setIdentity?.(clickUpUserId);
    return () => setIdentity?.(null);
  }, [setIdentity, clickUpUserId]);
}

function Notifications({state}:{state:SessionState}) {
  const ref=useModalDialog({onClose:()=>state.setOpen(false),panelSelector:'[data-modal-panel]'});
  const notices = state.notices.filter(notice => notificationText(notice.text));
  return <dialog ref={ref} className={shared.planDrawer} aria-label="Notifications" data-notification-ignore onCancel={event=>{event.preventDefault();state.setOpen(false);}}><aside data-modal-panel className={`${shared.planDrawerPanel} ${styles.notificationPanel}`}>
    <header><h2>Notifications</h2><button type="button" onClick={state.clear}>Clear</button><button type="button" aria-label="Close notifications" title="Close" onClick={()=>state.setOpen(false)}><X size={16}/></button></header>
    <div className={styles.notificationBody}>{notices.length?notices.map(notice=><article key={notice.id} data-kind={notice.kind}><p>{notice.text}</p><time>{new Date(notice.at).toLocaleString()}</time></article>):<p>No recent activity</p>}</div>
  </aside></dialog>;
}
export function ForceReloadControl() {
  const state=useContext(SessionContext);const [confirm,setConfirm]=useState(false);
  if(!state)return null;
  return <>
    <button type="button" className={styles.reloadButton} title={state.profile.role!=='admin'?'Force reload all devices (admin only)':state.reloadError || 'Force reload all devices'} aria-label="Force reload everyone" disabled={state.profile.role!=='admin' || !state.reloadAvailable} onClick={()=>setConfirm(true)}><MonitorUp size={13}/>Force Reload</button>
    {confirm?<TrackerDialog className={styles.reloadConfirm} title="Force reload all devices?" closeLabel="Cancel team reload" busy={state.busy} error={state.reloadError} onClose={()=>setConfirm(false)}><p>All open QA sessions will reload after a five-second warning. Unsaved edits may be lost.</p><p>Production users will not be affected.</p><footer className={styles.dialogActions}><button type="button" disabled={state.busy} onClick={()=>setConfirm(false)}>Cancel</button><button type="button" disabled={state.busy} onClick={()=>void state.requestReload()}>Yes</button></footer></TrackerDialog>:null}
  </>;
}

export function SessionHeaderControls({signOut}:{signOut:()=>void}) {
  const state=useContext(SessionContext);const [account,setAccount]=useState(false),[people,setPeople]=useState(false);
  const online = useAnchoredPopover(), onlineId = useId();
  if(!state)return null;
  const {profile}=state,label=profile.username || profile.full_name || profile.email;
  return <div className={styles.sessionControls}>
    <button type="button" className={styles.notificationButton} aria-label={`Notifications (${state.unread} unread)`} title="Notifications" onClick={()=>state.setOpen(true)}><Bell size={16}/>{state.unread?<span>{state.unread>99?'99+':state.unread}</span>:null}</button>
    <div className={styles.accountPill}><button type="button" title="Login and user details" aria-label="Login and user details" onClick={()=>setAccount(true)}>{label}<strong>{profile.role}</strong></button></div>
    <button ref={online.trigger} popoverTarget={onlineId} type="button" className={styles.presenceButton} aria-label="Online users" title="Online users" aria-expanded={people}>
      <span className={styles.avatars}>{state.members.slice(0,3).map(member=><span key={member.id} className={styles.avatar} title={member.name}>{initials(member.name)}</span>)}</span>
      {state.presenceStatus==='online'?<><i className={styles.onlineDot}/><span>{state.members.length} online</span></>:<span>{state.presenceStatus==='connecting'?'Connecting...':'Presence unavailable'}</span>}
    </button>
    {state.open?<Notifications state={state}/>:null}
    {account?<TrackerDialog title="Login and user details" closeLabel="Close account details" busy={false} onClose={()=>setAccount(false)}><dl className={styles.accountDetails}><dt>Name</dt><dd>{label}</dd><dt>Email</dt><dd>{profile.email}</dd><dt>App role</dt><dd>{profile.role}</dd></dl><footer className={styles.dialogActions}><button type="button" onClick={signOut}><LogOut size={15}/>Sign out</button></footer></TrackerDialog>:null}
    <div ref={online.panel} id={onlineId} popover="auto" role="dialog" aria-label="Online users" className={styles.peoplePopover} onToggle={event=>setPeople(event.newState==='open')}>
      <header><strong>Online users</strong><button type="button" title="Close online users" aria-label="Close online users" onClick={()=>online.panel.current?.hidePopover()}><X size={14}/></button></header>
      {state.presenceStatus==='online'?<ul className={styles.people}>{state.members.map(member=><li key={member.id}><span className={styles.avatar}>{initials(member.name)}</span><span>{member.name}{member.id===profile.id?' (you)':''}</span></li>)}</ul>:<p>{state.presenceStatus==='connecting'?'Connecting...':'Online presence is temporarily unavailable.'}</p>}
    </div>
  </div>;
}

function initials(name:string) { return name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('').toUpperCase(); }
