import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCreationPayload,creationMarker,matchesCreation,creationStatus } from '../../lib/domain/clickup-creation.js';
import { buildClickUpImport,taskToCreativePatch,inferClickUpMappings } from '../../lib/domain/clickup-sync.js';
const listId='1301130000002447',jobId='00000000-0000-4000-8000-000000000001';
function fixture() {
  return { jobId,product:{ id:'qa',name:'QA Product',config:{} },
    ad:{ id:'ad',product_id:'qa',format_name:'QA-001',angle:'Current angle',persona:'Current persona',status:'Untested',ad_type:'Video',funnel_stage:'TOF',drive_link:'',ad_link:'https://example.test/inspiration',
      meta:{ creativeHypothesis:'Own hypothesis',notes:'Own notes',dueDate:'2026-10-01',sourceFormatId:'parent',_sourceFormatDriveLink:'https://example.test/reference',
        _sourceWinnerFileUrl:'https://example.test/winner',_sourceClickupId:'parent-task',assignees:[{id:10}],
        _customFieldsRaw:{'angle tag':'STALE source angle',reviewer:[{id:11}],score:0,flag:false,choice:0,labels:['label-a'],'approved date':''} } },
    action:{ product_id:'qa',payload:{sourceAdId:'ad',description:'Full user brief'} },
    schema:{list:{id:listId,statuses:[{status:'to do',type:'open'}]},fields:[
      {id:'angle',name:'Angle Tag',type:'short_text'}, {id:'persona',name:'Persona Tag',type:'short_text'},
      {id:'notes',name:'Notes',type:'text'}, {id:'drive',name:'Drive Link',type:'url'}, {id:'reviewer',name:'Reviewer',type:'users'},
      {id:'score',name:'Score',type:'number'}, {id:'flag',name:'Flag',type:'checkbox'},
      {id:'choice',name:'Choice',type:'drop_down',type_config:{options:[{id:'zero',name:'Zero',orderindex:0}]}},
      {id:'labels',name:'Labels',type:'labels',type_config:{options:[{id:'label-a',label:'First'}]}},
    ]} };
}
test('creation carries current cell, brief, provenance, date, native users, raw zero/false and mapped fields',() => {
  const payload=buildCreationPayload(fixture()),fields=Object.fromEntries(payload.custom_fields.map((f) => [f.id,f.value]));
  assert.equal(payload.status,'to do'); assert.deepEqual(payload.assignees,[10]);
  assert.equal(payload.due_date,Date.parse('2026-10-01T12:00:00Z')); assert.equal(payload.due_date_time,false);
  assert.deepEqual(fields,{angle:'Current angle',persona:'Current persona',notes:'Own notes',reviewer:{add:[11],rem:[]},score:0,flag:false,choice:'zero',labels:['label-a']});
  for (const text of ['Current angle','Current persona','Own hypothesis','Own notes','Full user brief','Inspiration Drive: https://example.test/reference','Winning File: https://example.test/winner',creationMarker(jobId)]) assert.ok(payload.description.includes(text),text);
  assert.equal(payload.description.includes('Output Drive:'),false); assert.equal(payload.description.includes('STALE'),false);
  assert.deepEqual(payload.tags,['production','app-created']); assert.equal(payload.check_required_custom_fields,true);
});
test('empty saved mappings do not suppress detected fields; invalid ownership, values and scope fail safely',() => {
  const f=fixture();f.product.config.clickup_sync={list_id:listId,mappings:{angle:''}};
  assert.equal(buildCreationPayload(f).custom_fields.some((field) => field.id==='angle'),true);
  f.product.config.clickup_sync.mappings={angle:'deleted-field',persona:'stale-persona'};
  assert.equal(buildCreationPayload(f).custom_fields.find((field) => field.id==='persona').value,'Current persona');
  f.action.payload.sourceAdId='foreign';assert.throws(() => buildCreationPayload(f),/identity/);f.action.payload.sourceAdId='ad';
  f.ad.meta.dueDate='2026-02-31';assert.throws(() => buildCreationPayload(f),/due date/);f.ad.meta.dueDate='';
  f.ad.meta._customFieldsRaw.choice='not-an-option';assert.throws(() => buildCreationPayload(f),/matching option/);
  f.ad.meta._customFieldsRaw.choice=0;f.schema.fields[2].applied_objects=[{object_type:19,object_id:55}];
  assert.throws(() => buildCreationPayload(f),/standard tasks/);
  f.schema.fields[2].applied_objects=[{object_type:19,object_id:0}];assert.doesNotThrow(() => buildCreationPayload(f));
});
test('list-native status mapping retains legacy aliases and omits unconfirmed status',() => {
  assert.equal(creationStatus('Testing',[{status:'review'}]),'review');
  assert.equal(creationStatus('In Production',[{status:'in progress'}]),'in progress');
  assert.equal(creationStatus('Loser',[{status:'complete'}]),'complete');
  const f=fixture();f.schema.list.statuses=[];assert.equal(Object.hasOwn(buildCreationPayload(f),'status'),false);
});
test('Product field uses the configured canonical name instead of a QA profile label or copied source field',()=>{
  const f=fixture();
  f.product.name='AstroRekha - QA Sample';
  f.product.config.production={product_name:' Astro Rekha '};
  f.ad.meta._customFieldsRaw.product='different-product';
  f.schema.fields.push({id:'product',name:'Product',type:'drop_down',type_config:{options:[
    {id:'astro',name:'Astro Rekha',orderindex:25},{id:'different-product',name:'Canva',orderindex:5},
  ]}});
  const payload=buildCreationPayload(f);
  assert.equal(payload.custom_fields.find(field=>field.id==='product').value,'astro');
  assert.match(payload.description,/Product: AstroRekha - QA Sample/);
  f.product.config.production={productName:'Astro Rekha'};
  assert.equal(buildCreationPayload(f).custom_fields.find(field=>field.id==='product').value,'astro');
  f.product.config.production={product_name:'Unconfigured product'};
  assert.throws(()=>buildCreationPayload(f),/No matching option for Product/);
  f.product.config.production={product_name:'  '};f.product.name=' astro rekha ';
  assert.equal(buildCreationPayload(f).custom_fields.find(field=>field.id==='product').value,'astro');
});

test('creation seeds matching taxonomy dropdowns but unmatched optional dropdowns do not block text tags', () => {
  const f = fixture();
  const dropdown = { id: 'angle-dd', name: 'Angle', type: 'drop_down', type_config: { options: [{ id: 'current', name: 'Current angle' }] } };
  f.schema.fields.push(dropdown, { id: 'empty-dd', name: 'Angle', type: 'drop_down', type_config: { options: [] } });
  assert.equal(buildCreationPayload(f).custom_fields.find((field) => field.id === 'angle-dd').value, 'current');
  assert.equal(buildCreationPayload(f).custom_fields.some((field) => field.id === 'empty-dd'), false);
  dropdown.type_config.options = [{ id: 'old', name: 'Old angle' }];
  const payload = buildCreationPayload(f);
  assert.equal(payload.custom_fields.some((field) => field.id === 'angle-dd'), false);
  assert.equal(payload.custom_fields.find((field) => field.id === 'angle').value, 'Current angle');
  f.schema.fields = [dropdown];
  assert.throws(() => buildCreationPayload(f), /matching option/);
});
test('recovery requires exact marker line and list, never fuzzy title matching',() => {
  const job={id:jobId,list_id:listId},task={list:{id:listId},description:`Brief\n${creationMarker(jobId)}\n`};
  assert.equal(matchesCreation(task,job),true);
  assert.equal(matchesCreation({...task,description:`Reference to ${creationMarker(jobId)}`},job),false);
  assert.equal(matchesCreation({...task,list:{id:'production'}},job),false);
});
test('coarse Photo/Video fields use verified media while retaining the detailed creative type on sync',()=>{
  const f=fixture();f.ad.ad_type='AI Style';f.mediaKind='video';
  const field={id:'medium',name:'Photo/Video',type:'drop_down',type_config:{options:[{id:'video',name:'Video',orderindex:1},{id:'photo',name:'Photo',orderindex:0}]}};
  f.schema.fields.push(field);
  const payload=buildCreationPayload(f);
  assert.equal(payload.custom_fields.find(f=>f.id==='medium').value,'video');
  assert.match(payload.description,/Ad Type: AI Style\nClickUp Media Type: Video/);
  const task={id:'remote',list:{id:listId},name:payload.name,description:payload.description,custom_fields:[{...field,value:'video'}]};
  const mappings=inferClickUpMappings([field]);
  assert.equal(taskToCreativePatch(task,mappings,listId).ad_type,'AI Style');
  task.custom_fields[0].value='photo';assert.equal(taskToCreativePatch(task,mappings,listId).ad_type,'Photo');
  task.custom_fields[0].value=null;assert.equal(taskToCreativePatch(task,mappings,listId).ad_type,'');
  f.mediaKind='';assert.throws(()=>buildCreationPayload(f),/Photo\/Video/);
  f.mediaKind='image';assert.equal(buildCreationPayload(f).custom_fields.find(f=>f.id==='medium').value,'photo');
  field.type_config.options.push({id:'ai',name:'AI Style'});
  assert.equal(buildCreationPayload(f).custom_fields.find(f=>f.id==='medium').value,'ai');
  assert.doesNotMatch(buildCreationPayload(f).description,/ClickUp Media Type/);
});
test('sync defers unlinked marked tasks instead of importing duplicate creatives during finalize',() => {
  const task={id:'remote',list:{id:listId},name:'QA-001',description:creationMarker(jobId),status:{status:'to do'}};
  const args={productId:'qa',listId,tasks:[task],ads:[],actions:[],tombstones:[],mappings:{}};
  const skipped=buildClickUpImport(args);assert.equal(skipped.ads.length,0);assert.equal(skipped.skipped,1);
  args.ads=[{id:'ad',product_id:'qa',clickup_task_id:'remote',meta:{}}];
  assert.equal(buildClickUpImport(args).ads[0].id,'ad');
});
