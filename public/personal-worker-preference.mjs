const prefix='immuvi.personalWorker.choice.v2.';
export const isPersonalWorkerChoice=value=>typeof value==='string'&&/^personal:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function personalWorkerChoiceKey(identity){
  if(!identity)return '';
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('personal-worker-choice-v2|'+identity));
  return prefix+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}
function scoped(key){return typeof key==='string'&&key.startsWith(prefix)&&/^[0-9a-f]{64}$/.test(key.slice(prefix.length));}
export function readPersonalWorkerChoice(key){
  if(!scoped(key))return '';
  for(const name of ['localStorage','sessionStorage']){
    try{const value=globalThis[name]?.getItem(key);if(isPersonalWorkerChoice(value))return value;}catch{}
  }
  return '';
}
export function savePersonalWorkerChoice(key,value){
  if(!scoped(key)||value&&!isPersonalWorkerChoice(value))return false;
  let persistent=false;
  for(const name of ['localStorage','sessionStorage']){
    try{
      const storage=globalThis[name];if(!storage)continue;
      if(value)storage.setItem(key,value);else storage.removeItem(key);
      if(name==='localStorage')persistent=true;
    }catch{}
  }
  return persistent;
}
