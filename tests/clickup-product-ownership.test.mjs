import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import {createClickUpProductGuard,productOption,selectedProductOption} from '../tools/clickup-product-ownership.mjs';

const fieldId='51737473-cd76-4337-b919-9e49b7d0fb60';
const options=[{id:'kids-uuid',name:'Kids Mental Health',orderindex:5},{id:'canva-uuid',name:'Canva',orderindex:6}];
const products=[{id:'kids',name:'Kids Mental Health',listId:'kids-list',fieldId,optionId:'kids-uuid',productName:'Kids Mental Health'},
  {id:'canva',name:'Canva',listId:'canva-list',fieldId,optionId:'canva-uuid',productName:'Canva'}];
function setup({rows=products,taskList='kids-list',fieldOptions=options,status=200}={}) {
  const calls=[];
  const guard=createClickUpProductGuard({env:{SUPABASE_URL:'https://database.test',SUPABASE_SERVICE_ROLE_KEY:'server-only'},fetchImpl:async(url,opts)=>{
    calls.push({url,opts});
    if(url.startsWith('https://database.test/'))return Response.json(rows);
    assert.equal(opts.headers.Authorization,'user-token');
    assert.ok(!JSON.stringify(opts).includes('server-only'));
    if(status!==200)return new Response('{}',{status,headers:{'retry-after':'60'}});
    return Response.json({id:'task',list:{id:taskList},custom_fields:[{id:fieldId,name:'Product',type:'drop_down',value:6,type_config:{options:fieldOptions}}]});
  }});
  return {guard,calls};
}
const update={path:'/task/task/field/'+fieldId,method:'POST',authorization:'user-token'};
test('old-client numeric Product writes use actual task owner and stable UUID',async()=>{
  for(const [taskList,expected] of [['kids-list','kids-uuid'],['canva-list','canva-uuid']]){
    const {guard,calls}=setup({taskList});
    assert.deepEqual(await guard({...update,body:{value:6,other:'preserved'}}),{value:expected,other:'preserved'});
    assert.equal(calls.length,2);assert.ok(calls.every(c=>!c.opts.method||c.opts.method==='GET'));
  }
});
test('create preserves all fields, content, statuses and assignees except canonical Product',async()=>{
  const {guard}=setup();
  const body={name:'keep',description:'keep',status:'in production',assignees:[1],custom_fields:[{id:fieldId,value:6},{id:'notes',value:'keep'}]};
  const snapshot=structuredClone(body);
  const result=await guard({path:'/list/kids-list/task',method:'POST',body,authorization:'user-token',productId:'kids'});
  assert.deepEqual(result,{...body,custom_fields:[{id:'notes',value:'keep'},{id:fieldId,value:'kids-uuid'}]});
  assert.deepEqual(body,snapshot);
});
test('wrong product hint, shared list, missing option and cleared Product fail closed',async()=>{
  await assert.rejects(setup().guard({...update,body:{value:5},productId:'canva'}),{code:'PRODUCT_OWNER_CONFLICT'});
  await assert.rejects(setup({rows:[...products,{...products[0],id:'duplicate'}]}).guard({...update,body:{value:5}}),{code:'PRODUCT_OWNER_CONFLICT'});
  await assert.rejects(setup({fieldOptions:[options[1]]}).guard({...update,body:{value:5}}),{code:'PRODUCT_OWNER_CONFLICT'});
  await assert.rejects(setup().guard({...update,method:'DELETE'}),{code:'PRODUCT_OWNER_CONFLICT'});
});
test('arbitrary product option mapping is exact and never fuzzy',()=>{
  assert.equal(productOption({options:[{id:'x',name:'New Product'}]},{name:'New Product'}).id,'x');
  assert.throws(()=>productOption({options:[{id:'x',name:'New Product Course'}]},{name:'New Product'}));
  assert.throws(()=>productOption({options:[{id:'x',name:'Renamed'}]},{optionId:'x',productName:'Old'}));
  assert.equal(selectedProductOption({value:'canva-uuid',type_config:{options}}).name,'Canva');
});
test('unrelated fields, GETs, statuses and notes never require catalog or extra API requests',async()=>{
  const guard=createClickUpProductGuard({env:{},fetchImpl:()=>{throw Error('must not fetch');}});
  for(const request of [{...update,path:'/task/task/field/notes'},
    {...update,method:'GET'}, {...update,path:'/task/task',method:'PUT'}]){
    const body={value:'keep'};assert.equal(await guard({...request,body}),body);
  }
  await assert.rejects(guard({...update,body:{value:6}}),{code:'PRODUCT_VERIFY_UNAVAILABLE'});
});
test('catalog cache coalesces requests and rate-limit errors are not retried',async()=>{
  const {guard,calls}=setup();
  await Promise.all([guard({...update,body:{value:6}}),guard({...update,body:{value:5}})]);
  assert.equal(calls.filter(c=>c.url.startsWith('https://database.test')).length,1);
  for(const status of [401,403,429,503]){
    const s=setup({status});
    await assert.rejects(s.guard({...update,body:{value:6}}),e=>e.status===status&&e.retryAfter==='60');
    assert.equal(s.calls.length,2);
  }
});

for(const file of ['immuvi-command-center.html','public/immuvi-command-center.html']){
  const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
  function context(){
    const owner={id:'kids',name:'Kids Mental Health',config:{clickup_product_name:'Kids Mental Health',clickup_product_option_id:'kids-uuid'}};
    const c=vm.createContext({CFG:{key:'original-key'},getActiveProduct:()=>owner,getActiveFieldMap:()=>({productName:{fieldId,fieldType:'drop_down',options}}),JSON,console,Promise});
    vm.runInContext(html.slice(html.indexOf('function _clickUpProductNameForTask('),html.indexOf('function validateOneScaleLaunchTasks(')),c);
    return c;
  }
  test(file+': Product name ignores stale task/OneScale names and snapshots owner/key/schema',()=>{
    const c=context(),snapshot=c._clickUpProductWriteContext();
    assert.equal(c._clickUpProductNameForTask({productName:'Canva',oneScaleProductName:'Canva'}),'Kids Mental Health');
    c.CFG.key='changed';c.getActiveProduct=()=>({id:'canva',name:'Canva'});
    assert.equal(snapshot.apiKey,'original-key');assert.equal(snapshot.productId,'kids');
    assert.equal(c._clickUpProductOptionForOwner(snapshot.fieldMap.productName,snapshot).id,'kids-uuid');
  });
  test(file+': delayed Product push uses captured UUID, owner and key, not changed globals',async()=>{
    const c=context(),snapshot=c._clickUpProductWriteContext();
    vm.runInContext(html.slice(html.indexOf('function pushFieldToClickUp('),html.indexOf('// After a ClickUp sync refreshes the field map')),c);
    c.CFG.key='changed';c.getActiveProduct=()=>({id:'canva',name:'Canva'});
    let sent;c._setTaskField=async(...args)=>{sent=args;};
    await c.pushFieldToClickUp({_clickupId:'task',id:'ad'},'productName','Canva',snapshot);
    assert.equal(sent[1],fieldId);assert.equal(sent[2].value,'kids-uuid');
    assert.equal(sent[4].productId,'kids');assert.equal(sent[4].apiKey,'original-key');assert.equal(sent[5],true);
  });
  test(file+': loaded and realtime products retain the stable binding without exposing unrelated config',()=>{
    const c=context();
    vm.runInContext(html.slice(html.indexOf('function _convertProductRow('),html.indexOf('// Quick diff:',html.indexOf('function _convertProductRow('))),c);
    const product=c._convertProductRow({id:'kids',name:'Kids Mental Health',config:{clickup_product_name:'Kids Mental Health',clickup_product_option_id:'kids-uuid',clickup_product_field_id:fieldId,unrelated:'do not copy'}});
    assert.equal(product.clickupProductOptionId,'kids-uuid');assert.equal(product.clickupProductFieldId,fieldId);assert.equal(product.unrelated,undefined);
    assert.equal(c._clickUpProductOptionForOwner({options}, {product}).id,'kids-uuid');
  });
  test(file+': late field schema is cached only for its captured product, never installed on the current product',async()=>{
    const c=context();let resolve;let installed=0,flushed=0;
    c.activeProductId='kids';c.PRODUCT_FIELD_MAPS={};c.saveFieldMaps=()=>{};
    c.apiFetch=()=>new Promise(r=>{resolve=r;});c._installClickUpFieldSchemaFromList=()=>{installed++;};c.setTimeout=()=>{flushed++;};
    vm.runInContext(html.slice(html.indexOf('function fetchAndStoreFieldMap('),html.indexOf('async function syncClickUp(')),c);
    const pending=c.fetchAndStoreFieldMap('kids-list');c.activeProductId='canva';
    resolve({fields:[{id:fieldId,name:'Product',type:'drop_down',type_config:{options}}]});
    await pending;assert.equal(installed,0);assert.equal(flushed,0);assert.ok(c.PRODUCT_FIELD_MAPS.kids);assert.equal(c.PRODUCT_FIELD_MAPS.canva,undefined);
  });
  test(file+': UUID dropdown display wins over numeric prefix and Product editor cannot relabel owner',()=>{
    const c=context();
    vm.runInContext(html.slice(html.indexOf('function _formatCuFieldValue('),html.indexOf('function _formatCuFieldValue(')+5000).split('\nfunction ')[0],c);
    assert.equal(c._formatCuFieldValue({type:'drop_down',value:'123-uuid',type_config:{options:[{id:'123-uuid',name:'Correct',orderindex:5},{id:'other',name:'Wrong',orderindex:123}]}}),'Correct');
    c.ADS=[{id:'ad',_clickupId:'task'}];c.CLICKUP_FIELD_META={product:{fieldId,type:'drop_down',options}};
    c.toast=()=>{};
    vm.runInContext(html.slice(html.indexOf('function saveAdFieldUnified('),html.indexOf('function saveAdFieldUnified(')+14000).split('\nfunction ')[0],c);
    c.saveAdFieldUnified('ad','custom','product',6);assert.equal(c.ADS[0]._customFields,undefined);
  });
}
