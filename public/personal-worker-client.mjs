import {isPersonalWorkerChoice,personalWorkerChoiceKey,readPersonalWorkerChoice,savePersonalWorkerChoice} from './personal-worker-preference.mjs';
let devices=[], identityKey='', fetchedAt=0, inFlight=null, assignmentIdentity='';
const choices=new Map(),pickerIdentities=new WeakMap();
async function choice(identity=currentIdentity()){
  if(!identity)return '';
  if(choices.has(identity))return choices.get(identity);
  try{return readPersonalWorkerChoice(await personalWorkerChoiceKey(identity));}catch{return '';}
}
async function remember(value,identity=currentIdentity()){
  if(!identity||identity!==currentIdentity()||value&&!isPersonalWorkerChoice(value))return false;
  choices.set(identity,value);
  try{const key=await personalWorkerChoiceKey(identity);if(identity!==currentIdentity())return false;savePersonalWorkerChoice(key,value);}catch{}
  return identity===currentIdentity();
}
function currentKey(){return typeof CFG!=='undefined'?String(CFG.key||'').trim():'';}
function currentIdentity(){const user=typeof AUTH!=='undefined'&&AUTH.user?.id,key=currentKey();return user&&key?user+'|'+key:'';}
function syncIdentity(){
  const key=currentIdentity();
  if(identityKey!==key){identityKey=key;devices=[];fetchedAt=0;assignmentIdentity='';
    if(isPersonalWorkerChoice(window._insRunOnAssignment))window._insRunOnAssignment='auto';}
  return key;
}
export async function personalWorkerRequest(op,extra={}) {
  if(typeof SB==='undefined'||!SB) throw new Error('Sign in first');
  const identity=currentIdentity(),clickup=currentKey();
  const session=await SB.auth.getSession(),token=session.data?.session?.access_token;
  if(currentIdentity()!==identity)throw new Error('Account or ClickUp key changed. Refresh My Mac.');
  if(!token||!clickup) throw new Error('Sign in and enter your own ClickUp key first');
  const response=await fetch('/api/personal-worker',{method:'POST',
    headers:{Authorization:'Bearer '+token,'x-clickup-key':clickup,'Content-Type':'application/json'},
    body:JSON.stringify({op,...extra}),signal:AbortSignal.timeout(25000)});
  const data=await response.json();
  if(currentIdentity()!==identity) throw new Error('Account or ClickUp key changed. Refresh My Mac.');
  if(!response.ok) throw new Error(data.error||'Personal worker request failed. Retry.');
  return data;
}
async function refresh(force=false) {
  const key=syncIdentity();
  if(!force&&Date.now()-fetchedAt<60000) return devices;
  if(inFlight?.identity===key) return inFlight.promise;
  const pending={identity:key};
  pending.promise=personalWorkerRequest('list').then(data=>{
    if(identityKey!==key||currentIdentity()!==key)return [];
    devices=data.devices||[];fetchedAt=Date.now();return devices;
  }).finally(()=>{if(inFlight===pending)inFlight=null;});
  inFlight=pending;
  return pending.promise;
}
window._personalWorkerEnqueue=async function(productId,items,assignment){
  try{
    if(!isPersonalWorkerChoice(assignment)||assignment!==window._insRunOnAssignment||assignmentIdentity!==currentIdentity())throw new Error('Account or ClickUp key changed. Select your Mac again.');
    return await personalWorkerRequest('enqueue',{deviceId:assignment.slice(9),productId,
    items:items.map(item=>({id:item.id||item.ins_id,url:item.url,no_brief:item.noBrief===true}))});}
  catch(error){if(typeof showInsStatus==='function')showInsStatus('error',error.message);throw error;}
};
window._personalWorkerCancel=(productId,insId)=>personalWorkerRequest('cancel',{productId,insId});
window._appendPersonalWorkerOptions=async function(select){
  const identity=syncIdentity(),samePicker=pickerIdentities.get(select)===identity;
  const visibleChoice=samePicker&&isPersonalWorkerChoice(select.value)?select.value:'';
  pickerIdentities.set(select,identity);
  for(const option of [...select.options])if(option.value.startsWith('personal:'))option.remove();
  if(!samePicker&&isPersonalWorkerChoice(window._insRunOnAssignment))window._insRunOnAssignment='auto';
  const previous=visibleChoice||await choice(identity);
  if(currentIdentity()!==identity||pickerIdentities.get(select)!==identity)return;
  if(previous||devices.length){try{await refresh();}catch{/* No automatic shared fallback. */}}
  if(currentIdentity()!==identity||pickerIdentities.get(select)!==identity)return;
  for(const device of devices.filter(d=>d.paired&&!d.revoked)) {
    const option=document.createElement('option');option.value='personal:'+device.id;
    const live=device.lastSeen&&Date.now()-Date.parse(device.lastSeen)<150000;
    option.textContent=device.name+' (personal'+(live?'':', offline')+')';select.appendChild(option);
  }
  if(previous){
    if(![...select.options].some(option=>option.value===previous)){
      const missing=document.createElement('option');missing.value=previous;missing.textContent='Personal Mac unavailable';missing.disabled=true;select.appendChild(missing);
    }
    select.value=previous;window._insRunOnAssignment=previous;assignmentIdentity=identity;
  }else{
    if(!select.value)select.value='auto';
    window._insRunOnAssignment=select.value||'auto';assignmentIdentity=identity;
  }
  if(!select.dataset.personalBound){select.dataset.personalBound='1';select.addEventListener('change',()=>{
    const identity=currentIdentity();
    if(pickerIdentities.get(select)!==identity){select.value='auto';window._insRunOnAssignment='auto';window._insRefreshRunOnPicker?.();return;}
    window._insRunOnAssignment=select.value;assignmentIdentity=identity;void remember(isPersonalWorkerChoice(select.value)?select.value:'',identity);
  });}
};
function button(text,action){const b=document.createElement('button');b.type='button';b.className='btn-ghost';b.textContent=text;b.addEventListener('click',action);return b;}
function setupPrompt(dialog,status){
  const section=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Mac setup';
  Object.assign(section.style,{margin:'16px 0',padding:'12px 0',borderTop:'1px solid #e5e7eb',borderBottom:'1px solid #e5e7eb'});
  summary.style.cursor='pointer';section.appendChild(summary);
  const toolbar=document.createElement('div');Object.assign(toolbar.style,{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap',margin:'12px 0 8px'});
  const label=document.createElement('label');label.htmlFor='personalWorkerSetupPrompt';label.textContent='Codex setup prompt';label.style.flex='1';
  const prompt=document.createElement('textarea');prompt.id=label.htmlFor;prompt.readOnly=true;prompt.rows=12;prompt.spellcheck=false;
  Object.assign(prompt.style,{boxSizing:'border-box',width:'100%',resize:'vertical',padding:'10px',fontFamily:'ui-monospace, monospace',fontSize:'12px',lineHeight:'1.5',color:'#182131',background:'#f8fafc',border:'1px solid #d1d5db',borderRadius:'6px',margin:'0'});
  prompt.value=`Set up or repair this Mac as my private Immuvi classification-only worker.

Official installer:
https://immuvi-command-center.vercel.app/personal-worker/install.sh

First inspect any existing installation under:
$HOME/Library/Application Support/Immuvi Personal Worker

Complete setup on this Mac, using the official installer and its manifest checks. Do not clone the Immuvi repository or install the shared/team worker.

If setup previously failed, diagnose the actual local error. For incomplete Torch or Playwright downloads, inspect the download path and pip configuration without exposing credentials. Do not assume Wi-Fi is faulty or repeatedly rerun the same failing command. Use bounded retries; report the exact sanitized blocker if it cannot be resolved safely.

Reuse working dependencies and preserve existing login/model state. If the personal service is installed, use the official installer's --repair mode: it verifies staged assets, requests graceful shutdown, waits for active analyses without force-killing them, updates only the private installation and restarts the same service. It preserves pairing, pending-result.json and the entire slots directory. Never revoke the device or delete retained work to update it. If initial pairing already succeeded but the service did not start, use --resume-pairing instead of consuming another code. Run the private worker's diagnose command and report only its sanitized diagnostic codes; never print stored credentials or source material.

Do not disable HTTPS verification, use untrusted mirrors, force Homebrew overwrites, skip audio/evidence verification, or change app code. Do not manually modify Supabase records, ClickUp tasks, or other services. Use only the official setup, pairing and heartbeat paths for this device. Request approval before changes outside this personal worker's setup scope.

Do not read or print stored credentials, dump Keychain, copy AI credential files, or put secrets in plaintext files or logs. Let the official worker manage its credentials in macOS Keychain. Never ask me to paste keys or pairing codes into this chat. At pairing, pause and let me enter a fresh pairing code and my personal ClickUp key directly into hidden prompts in my own Terminal. Let me complete any required AI sign-in or macOS approvals myself.

After setup, verify the personal worker service com.immuvi.personal-classifier is running and guide me to confirm its live heartbeat and two or three slots in Immuvi > Inspiration > My Mac. Updated Macs use two analysis slots below 16 GB RAM and three at or above 16 GB. Do not claim success before verifying. Do not queue or reclassify inspirations without my explicit instruction. If blocked, report the exact sanitized error and what remains.`;
  const copy=button('⧉',async()=>{
    try{await navigator.clipboard.writeText(prompt.value);status.textContent='Codex setup prompt copied.';}
    catch{prompt.focus();prompt.select();status.textContent='Copy unavailable. The Codex setup prompt is selected.';}
  });copy.title='Copy Codex setup prompt';copy.setAttribute('aria-label','Copy Codex setup prompt');
  toolbar.append(label,copy);section.append(toolbar,prompt);dialog.appendChild(section);return section;
}
window._openPersonalWorkerDialog=async function(){
  if(document.getElementById('personalWorkerDialog'))return;
  const dialog=document.createElement('dialog');dialog.id='personalWorkerDialog';
  Object.assign(dialog.style,{boxSizing:'border-box',margin:'auto',width:'min(620px, calc(100vw - 32px))',maxHeight:'85vh',overflow:'auto',padding:'24px',border:'1px solid #d1d5db',borderRadius:'8px',color:'#182131',background:'#fff'});
  dialog.setAttribute('aria-label','My personal Mac workers');
  const header=document.createElement('div');Object.assign(header.style,{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'16px'});
  const title=document.createElement('h2');title.textContent='My Mac';title.style.fontSize='20px';
  const close=button('×',()=>dialog.close());close.title='Close';close.setAttribute('aria-label','Close');header.append(title,close);dialog.appendChild(header);
  const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Loading your paired Macs...';dialog.appendChild(status);
  const list=document.createElement('div');dialog.appendChild(list);
  const dialogIdentity=currentIdentity();
  function assertIdentity(){if(currentIdentity()!==dialogIdentity){list.replaceChildren();code.value='';code.hidden=true;throw new Error('Account or ClickUp key changed. Close and reopen My Mac.');}}
  const retry=button('Refresh',()=>load(true));dialog.appendChild(retry);
  const setup=setupPrompt(dialog,status);
  const label=document.createElement('label');label.textContent='Mac name';
  const name=document.createElement('input');name.maxLength=80;name.value='My Mac';name.style.width='100%';name.style.boxSizing='border-box';label.appendChild(name);dialog.appendChild(label);
  const code=document.createElement('textarea');code.readOnly=true;code.rows=3;code.hidden=true;code.style.width='100%';code.style.boxSizing='border-box';code.setAttribute('aria-label','One-time pairing code');dialog.appendChild(code);
  label.style.display='block';label.style.marginTop='12px';
  for(const field of [name,code])Object.assign(field.style,{padding:'8px',margin:'6px 0',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'14px',color:'#182131',background:'#fff'});
  const pair=button('Create pairing code',async()=>{
    pair.disabled=true;status.textContent='Creating a one-time code...';
    try{assertIdentity();const result=await personalWorkerRequest('create',{name:name.value});code.value=result.pairingCode;code.hidden=false;status.textContent='Pairing code expires in 10 minutes. Existing jobs are unchanged.';code.focus();code.select();}
    catch(error){status.textContent=error.message;}finally{pair.disabled=false;}
  });dialog.appendChild(pair);
  async function load(force){
    retry.disabled=true;
    try{assertIdentity();const rows=await refresh(force);assertIdentity();list.replaceChildren();const selected=await choice(dialogIdentity);assertIdentity();
      if(!rows.some(device=>device.paired))setup.open=true;
      for(const device of rows){
        const row=document.createElement('div');Object.assign(row.style,{display:'flex',alignItems:'center',gap:'12px',padding:'12px 0',borderBottom:'1px solid #e5e7eb',flexWrap:'wrap'});
        const text=document.createElement('span');text.textContent=device.name+' · '+(!device.paired?'Awaiting pairing':device.lastSeen&&Date.now()-Date.parse(device.lastSeen)<150000?device.runtime?.ready===false?'Needs repair':'Online'+(device.capacity>1?' · '+device.capacity+' slots':''):'Offline');text.style.flex='1';row.appendChild(text);
        if(device.runtime?.ready===false){
          const diagnosis=document.createElement('span');diagnosis.textContent=(device.runtime.codes||[]).join(', ');row.appendChild(diagnosis);
          row.appendChild(button('Repair Mac',()=>{setup.open=true;setup.querySelector('textarea')?.focus();}));
        }
        if(device.paired){const using=selected==='personal:'+device.id;
          const use=button(using?'Using this Mac':'Use this Mac',async()=>{
            try{assertIdentity();if(!await remember('personal:'+device.id,dialogIdentity))throw new Error('Account changed. Reopen My Mac.');
              assignmentIdentity=dialogIdentity;window._insRunOnAssignment='personal:'+device.id;await window._insRefreshRunOnPicker?.();dialog.close();}
            catch(error){status.textContent=error.message;}
          });use.disabled=using;row.appendChild(use);
        }
        const revoke=button('×',async()=>{
          if(!confirm('Revoke '+device.name+'? Pending/running assignments stop. Existing creatives and briefs are preserved.'))return;
          revoke.disabled=true;
          try{assertIdentity();await personalWorkerRequest('revoke',{deviceId:device.id});
            if(await choice(dialogIdentity)==='personal:'+device.id){await remember('',dialogIdentity);window._insRunOnAssignment='auto';}
            await load(true);window._insRefreshRunOnPicker?.();}
          catch(error){status.textContent=error.message;revoke.disabled=false;}
        });revoke.title='Revoke personal worker';revoke.setAttribute('aria-label','Revoke '+device.name);row.appendChild(revoke);list.appendChild(row);
        for(const job of device.attention||[]){
          const issue=document.createElement('div');issue.style.padding='8px 0';
          const description=document.createElement('span');description.textContent=job.insId+' · '+(job.state==='review'?'Brief publishing needs review':job.diagnostic||job.code||'Blocked')+' ';
          issue.appendChild(description);
          if(job.code==='LOCAL_TOOL_UNAVAILABLE')issue.appendChild(button('Repair Mac',()=>{setup.open=true;setup.querySelector('textarea')?.focus();}));
          if(job.state==='review')issue.appendChild(button('Verify existing brief',async()=>{
            try{assertIdentity();status.textContent='Verifying the saved brief. No new page will be created...';
              await personalWorkerRequest('verify',{deviceId:device.id,jobId:job.id});status.textContent='Existing brief verified and classification saved.';await load(true);}
            catch(error){status.textContent=error.message;}
          }));
          if(job.state==='blocked')issue.appendChild(button('Retry',async()=>{
            try{assertIdentity();await personalWorkerRequest('retry',{deviceId:device.id,jobId:job.id});status.textContent='Job queued on your Mac';await load(true);}
            catch(error){status.textContent=error.message;}
          }));
          list.appendChild(issue);
        }
      }
      status.textContent=rows.length?'Your personal Macs':'No personal Mac paired';await window._insRefreshRunOnPicker?.();
    }catch(error){status.textContent=error.message;}finally{retry.disabled=false;}
  }
  dialog.addEventListener('close',()=>{code.value='';dialog.remove();});document.body.appendChild(dialog);dialog.showModal();await load(true);
};
void window._insRefreshRunOnPicker?.();
