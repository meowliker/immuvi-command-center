const productNames = new Set(['product','product name','product profile','product profile name']);
// Existing workspace Product field. Protect older open clients without new headers.
const workspaceProductFields = new Set(['51737473-cd76-4337-b919-9e49b7d0fb60']);
export const normalizeProductName = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');

export function productOption(field, product) {
  const options=field?.type_config?.options || field?.options || [];
  if (!Array.isArray(options)) throw ownershipError('Product options are unavailable.');
  if (product.optionId) {
    const found=options.find(o=>o.id===product.optionId);
    if (!found || (product.productName && normalizeProductName(found.name)!==normalizeProductName(product.productName))) {
      throw ownershipError('The saved Product option changed. Review the product mapping.');
    }
    return found;
  }
  const names=[product.productName,product.name,product.productionName,product.listName].filter(Boolean).map(normalizeProductName);
  const matches=options.filter(o=>o.id && names.includes(normalizeProductName(o.name)));
  if(matches.length!==1) throw ownershipError('Choose an unambiguous ClickUp Product mapping for this product.');
  return matches[0];
}

export function selectedProductOption(field) {
  const options=field?.type_config?.options || [];
  const id=options.find(o=>String(o.id)===String(field.value));
  if(id)return id;
  if(typeof field.value==='number'||/^\d+$/.test(String(field.value))) {
    return options.find(o=>Number(o.orderindex)===Number(field.value)) || null;
  }
  return null;
}

function ownershipError(message,status=409,code='PRODUCT_OWNER_CONFLICT') {
  return Object.assign(new Error(message),{status,code});
}

export function createClickUpProductGuard({fetchImpl=(...args)=>fetch(...args),env=process.env,now=Date.now}={}) {
  let catalog=null,expires=0,loading=null;
  async function products() {
    if(catalog&&now()<expires)return catalog;
    if(loading)return loading;
    loading=(async()=>{
      const base=env.SUPABASE_URL,key=env.SUPABASE_SERVICE_ROLE_KEY;
      if(!base||!key)throw ownershipError('Product verification is not configured.',503,'PRODUCT_VERIFY_UNAVAILABLE');
      const select='id,name,listId:config->>clickup_list_id,listName:config->>clickup_list_name,optionId:config->>clickup_product_option_id,fieldId:config->>clickup_product_field_id,productName:config->>clickup_product_name,productionName:config->production->>product_name';
      const r=await fetchImpl(base+'/rest/v1/products?'+new URLSearchParams({select}),{headers:{apikey:key,Authorization:'Bearer '+key},signal:AbortSignal.timeout(12000)});
      if(!r.ok)throw ownershipError('Product verification is temporarily unavailable.',503,'PRODUCT_VERIFY_UNAVAILABLE');
      const rows=await r.json();if(!Array.isArray(rows))throw ownershipError('Product verification returned invalid data.',503,'PRODUCT_VERIFY_UNAVAILABLE');
      catalog=rows;expires=now()+60000;return rows;
    })();
    try{return await loading;}finally{loading=null;}
  }
  async function read(path,authorization) {
    const r=await fetchImpl('https://api.clickup.com/api/v2'+path,{headers:{Authorization:authorization,Accept:'application/json'},signal:AbortSignal.timeout(20000)});
    if(!r.ok) {
      const error=ownershipError('ClickUp could not verify this task before setting Product.',r.status,'PRODUCT_VERIFY_FAILED');
      error.retryAfter=r.headers.get('retry-after');
      error.rateLimitReset=r.headers.get('x-ratelimit-reset');
      throw error;
    }
    return r.json();
  }
  function owner(rows,listId,hint) {
    const matches=rows.filter(p=>String(p.listId||'')===String(listId));
    if(hint){const p=matches.find(p=>p.id===hint);if(!p)throw ownershipError('This task belongs to a different product.');return p;}
    if(matches.length!==1)throw ownershipError('The owning product is ambiguous. Refresh and try again.');
    return matches[0];
  }
  return async function guard({path,method,body,authorization,productId,productFieldId}) {
    const create=method==='POST'&&/^\/list\/([\w-]+)\/task$/.exec(path);
    const update=['POST','DELETE'].includes(method)&&/^\/task\/([\w-]+)\/field\/([\w-]+)$/.exec(path);
    if(!create&&!update)return body;
    if(update&&!workspaceProductFields.has(update[2])&&productFieldId!==update[2]&&
      !catalog?.some(p=>p.fieldId===update[2]))return body;
    const rows=await products();
    if(create){
      const listId=create[1],matches=rows.filter(p=>String(p.listId||'')===listId);
      if(!matches.length&&!productId)return body;
      const p=owner(rows,listId,productId);
      let field={id:p.fieldId,type:'drop_down',type_config:{options:p.optionId?[{id:p.optionId,name:p.productName}]:[]}};
      if(!p.fieldId||!p.optionId){
        const response=await read('/list/'+listId+'/field',authorization);
        const fields=(response.fields||[]).filter(f=>productNames.has(String(f.name||'').toLowerCase().trim()));
        field=fields.find(f=>String(f.name).toLowerCase().trim()==='product')||(fields.length===1?fields[0]:null);
      }
      if(!field?.id||field.type!=='drop_down')throw ownershipError('This list needs a Product dropdown mapping.');
      const option=productOption(field,p);
      return {...body,custom_fields:[...(body?.custom_fields||[]).filter(f=>f.id!==field.id),{id:field.id,value:option.id}]};
    }
    const fieldId=update[2];
    if(!workspaceProductFields.has(fieldId)&&!rows.some(p=>p.fieldId===fieldId)&&productFieldId!==fieldId)return body;
    const task=await read('/task/'+update[1],authorization);
    const p=owner(rows,task.list?.id,productId);
    const field=(task.custom_fields||[]).find(f=>f.id===fieldId&&productNames.has(String(f.name||'').toLowerCase().trim()));
    if(!field||field.type!=='drop_down')throw ownershipError('This task has no matching Product dropdown.');
    if(method==='DELETE')throw ownershipError('Product follows the owning product and cannot be cleared here.');
    const option=productOption(field,p);
    return {...body,value:option.id};
  };
}
