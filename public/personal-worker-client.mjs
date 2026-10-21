let devices=[], identityKey='', fetchedAt=0, inFlight=null;
const choiceKey='immuvi.personalWorker.choice';
function choice(){try{return sessionStorage.getItem(choiceKey)||'';}catch{return '';}}
function remember(value){try{if(value)sessionStorage.setItem(choiceKey,value);else sessionStorage.removeItem(choiceKey);}catch{}}
function currentKey(){return typeof CFG!=='undefined'?String(CFG.key||'').trim():'';}
function currentIdentity(){return (typeof AUTH!=='undefined'&&AUTH.user?.id||'')+'|'+currentKey();}
export async function personalWorkerRequest(op,extra={}) {
  if(typeof SB==='undefined'||!SB) throw new Error('Sign in first');
  const session=await SB.auth.getSession(),token=session.data?.session?.access_token,clickup=currentKey();
  const identity=currentIdentity();
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
  const key=currentIdentity();
  if(identityKey!==key){identityKey=key;devices=[];fetchedAt=0;}
  if(!force&&Date.now()-fetchedAt<60000) return devices;
  if(inFlight) return inFlight;
  inFlight=personalWorkerRequest('list').then(data=>{
    if(identityKey!==key)return [];
    devices=data.devices||[];fetchedAt=Date.now();return devices;
  }).finally(()=>{inFlight=null;});
  return inFlight;
}
window._personalWorkerEnqueue=async function(productId,items,assignment){
  try{return await personalWorkerRequest('enqueue',{deviceId:assignment.slice(9),productId,
    items:items.map(item=>({id:item.id||item.ins_id,url:item.url,no_brief:item.noBrief===true}))});}
  catch(error){if(typeof showInsStatus==='function')showInsStatus('error',error.message);throw error;}
};
window._appendPersonalWorkerOptions=async function(select){
  const previous=select.value.startsWith('personal:')?select.value:choice();
  if(previous||devices.length){try{await refresh();}catch{/* No automatic shared fallback. */}}
  for(const device of devices.filter(d=>d.paired&&!d.revoked)) {
    const option=document.createElement('option');option.value='personal:'+device.id;
    const live=device.lastSeen&&Date.now()-Date.parse(device.lastSeen)<150000;
    option.textContent=device.name+' (personal'+(live?'':', offline')+')';select.appendChild(option);
  }
  if(previous){
    if(![...select.options].some(option=>option.value===previous)){
      const missing=document.createElement('option');missing.value=previous;missing.textContent='Personal Mac unavailable';missing.disabled=true;select.appendChild(missing);
    }
    select.value=previous;window._insRunOnAssignment=previous;
  }
  if(!select.dataset.personalBound){select.dataset.personalBound='1';select.addEventListener('change',()=>{
    window._insRunOnAssignment=select.value;remember(select.value.startsWith('personal:')?select.value:'');
  });}
};
function button(text,action){const b=document.createElement('button');b.type='button';b.className='btn-ghost';b.textContent=text;b.addEventListener('click',action);return b;}
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
  const retry=button('Refresh',()=>load(true));dialog.appendChild(retry);
  const installer=document.createElement('p'),link=document.createElement('a');link.href='/personal-worker/install.sh';link.download='immuvi-personal-worker-install.sh';link.textContent='Download Mac installer';installer.appendChild(link);dialog.appendChild(installer);
  const label=document.createElement('label');label.textContent='Mac name';
  const name=document.createElement('input');name.maxLength=80;name.value='My Mac';name.style.width='100%';name.style.boxSizing='border-box';label.appendChild(name);dialog.appendChild(label);
  const code=document.createElement('textarea');code.readOnly=true;code.rows=3;code.hidden=true;code.style.width='100%';code.style.boxSizing='border-box';code.setAttribute('aria-label','One-time pairing code');dialog.appendChild(code);
  label.style.display='block';label.style.marginTop='12px';
  for(const field of [name,code])Object.assign(field.style,{padding:'8px',margin:'6px 0',border:'1px solid #d1d5db',borderRadius:'6px',fontSize:'14px',color:'#182131',background:'#fff'});
  const pair=button('Create pairing code',async()=>{
    pair.disabled=true;status.textContent='Creating a one-time code...';
    try{const result=await personalWorkerRequest('create',{name:name.value});code.value=result.pairingCode;code.hidden=false;status.textContent='Pairing code expires in 10 minutes. Existing jobs are unchanged.';code.focus();code.select();}
    catch(error){status.textContent=error.message;}finally{pair.disabled=false;}
  });dialog.appendChild(pair);
  async function load(force){
    retry.disabled=true;
    try{const rows=await refresh(force);list.replaceChildren();
      for(const device of rows){
        const row=document.createElement('div');Object.assign(row.style,{display:'flex',alignItems:'center',gap:'12px',padding:'12px 0',borderBottom:'1px solid #e5e7eb',flexWrap:'wrap'});
        const text=document.createElement('span');text.textContent=device.name+' · '+(!device.paired?'Awaiting pairing':device.lastSeen&&Date.now()-Date.parse(device.lastSeen)<150000?'Online':'Offline');text.style.flex='1';row.appendChild(text);
        if(device.paired)row.appendChild(button('Use this Mac',()=>{remember('personal:'+device.id);window._insRunOnAssignment='personal:'+device.id;window._insRefreshRunOnPicker?.();dialog.close();}));
        const revoke=button('×',async()=>{
          if(!confirm('Revoke '+device.name+'? Pending/running assignments stop. Existing creatives and briefs are preserved.'))return;
          revoke.disabled=true;
          try{await personalWorkerRequest('revoke',{deviceId:device.id});await load(true);window._insRefreshRunOnPicker?.();}
          catch(error){status.textContent=error.message;revoke.disabled=false;}
        });revoke.title='Revoke personal worker';revoke.setAttribute('aria-label','Revoke '+device.name);row.appendChild(revoke);list.appendChild(row);
        for(const job of device.attention||[]){
          const issue=document.createElement('div');issue.style.padding='8px 0';
          const description=document.createElement('span');description.textContent=job.insId+' · '+(job.state==='review'?'Brief publishing needs review':job.code||'Blocked')+' ';
          issue.appendChild(description);
          if(job.state==='blocked')issue.appendChild(button('Retry',async()=>{
            try{await personalWorkerRequest('retry',{deviceId:device.id,jobId:job.id});status.textContent='Job queued on your Mac';await load(true);}
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
