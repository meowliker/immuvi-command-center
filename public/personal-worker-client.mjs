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
function setupCommands(dialog,status){
  const section=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Mac setup';
  Object.assign(section.style,{margin:'16px 0',padding:'12px 0',borderTop:'1px solid #e5e7eb',borderBottom:'1px solid #e5e7eb'});
  summary.style.cursor='pointer';section.appendChild(summary);
  const toolbar=document.createElement('div');Object.assign(toolbar.style,{display:'flex',alignItems:'center',gap:'10px',flexWrap:'wrap',margin:'12px 0 8px'});
  const mode=document.createElement('select');mode.setAttribute('aria-label','Mac setup command');
  for(const [value,text] of [['install','First-time setup'],['resume','Resume interrupted pairing']]){const option=document.createElement('option');option.value=value;option.textContent=text;mode.appendChild(option);}
  Object.assign(mode.style,{maxWidth:'100%',padding:'6px',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'14px'});
  const command=document.createElement('textarea');command.readOnly=true;command.rows=8;command.spellcheck=false;command.setAttribute('aria-label','Terminal command');
  Object.assign(command.style,{boxSizing:'border-box',width:'100%',resize:'vertical',padding:'10px',fontFamily:'ui-monospace, monospace',fontSize:'12px',lineHeight:'1.5',color:'#182131',background:'#f8fafc',border:'1px solid #d1d5db',borderRadius:'6px',margin:'0'});
  const update=()=>{command.value="curl --fail --proto '=https' --tlsv1.2 https://immuvi-command-center.vercel.app/personal-worker/install.sh -o /tmp/immuvi-personal-worker-install.sh\nbash /tmp/immuvi-personal-worker-install.sh"+(mode.value==='resume'?' --resume-pairing':'');};
  mode.addEventListener('change',update);update();
  const copy=button('⧉',async()=>{
    try{await navigator.clipboard.writeText(command.value);status.textContent='Terminal command copied.';}
    catch{command.focus();command.select();status.textContent='Copy unavailable. The Terminal command is selected.';}
  });copy.title='Copy Terminal command';copy.setAttribute('aria-label','Copy Terminal command');
  const download=document.createElement('a');download.href='/personal-worker/install.sh';download.download='immuvi-personal-worker-install.sh';download.textContent='Download installer';
  toolbar.append(mode,copy,download);section.append(toolbar,command);dialog.appendChild(section);return section;
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
  const setup=setupCommands(dialog,status);
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
        const text=document.createElement('span');text.textContent=device.name+' · '+(!device.paired?'Awaiting pairing':device.lastSeen&&Date.now()-Date.parse(device.lastSeen)<150000?'Online':'Offline');text.style.flex='1';row.appendChild(text);
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
          const description=document.createElement('span');description.textContent=job.insId+' · '+(job.state==='review'?'Brief publishing needs review':job.code||'Blocked')+' ';
          issue.appendChild(description);
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
