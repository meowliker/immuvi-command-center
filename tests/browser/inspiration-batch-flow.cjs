const inspirationOption=require('./inspiration-options.cjs');
const assert=require('node:assert/strict');
module.exports=async function testBatch({page,data,control,emit,tab,artifactDir,results}){
  const product='qa-fixture',stamp='2026-09-23T01:00:00.000Z';
  const filled=(keys)=>Object.fromEntries(keys.split(' ').map((key)=>[key,'Complete']));
  const source=(id)=>({id,product_id:product,title:id,url:`https://example.test/${id}`,status:'Saved',created_at:stamp,updated_at:stamp,data:{formatName:id,adType:'Video'}});
  data.inspirations=['BATCH-A','BATCH-B','BATCH-C','BATCH-D','BATCH-E','BATCH-F'].map(source);data.inspiration_queue=[];
  data.inspiration_results=data.inspirations.map((row)=>({id:`RESULT-${row.id}`,ins_id:row.id,product_id:product,source_url:row.url,classified_at:'2026-09-23T02:00:00.000Z',
    classification:{...filled('hook_type creative_structure production_style funnel_type persona angle creative_hypothesis'),creative_usp:`Imported ${row.id}`},
    brief:{...filled('why_it_works replication_brief what_to_test competitor_intel our_next_ad inspiration_script_skeleton'),frame_by_frame:[{}],next_ad_scripts:Array.from({length:3},()=>({...filled('variation intent hook_text source_format_match voice_over_script cta what_to_change why_it_should_work'),script_breakdown:[{}]}))}}));
  data.inspiration_results[3].brief={};
  data.inspirations[4].data._qaImportedResultAt=data.inspiration_results[4].classified_at;
  data.inspiration_queue=[{id:'Q-F',ins_id:'BATCH-F',product_id:product,status:'processing',queued_at:stamp}];
  await tab(page,'Inspiration');const button=(name)=>page.getByRole('button',{name,exact:true});
  const dialog=page.getByRole('dialog',{name:'Import classification results',exact:true});
  await button('Import Results').click();await dialog.getByRole('checkbox',{name:'Import BATCH-A',exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(control.inspirationCalls?.length||0,0);
  await button('Import Results').click();await dialog.getByText(/3 eligible results/).waitFor();
  for(const id of ['BATCH-D','BATCH-E','BATCH-F'])assert.equal(await dialog.getByRole('checkbox',{name:`Import ${id}`,exact:true}).isDisabled(),true);
  await dialog.getByRole('button',{name:'Select up to 50',exact:true}).click();
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await dialog.evaluate((el)=>el.scrollWidth<=el.clientWidth && el.getBoundingClientRect().left>=0 && el.getBoundingClientRect().right<=innerWidth),true);await page.screenshot({path:`${artifactDir}/inspiration-batch-${width}.png`});}
  // A stale third source fails independently after the lost response on B is recovered.
  data.inspirations[2].updated_at='2026-09-23T03:00:00.000Z';control.loseInspirationId='BATCH-B';
  await dialog.getByRole('button',{name:'Import selected (3)',exact:true}).click();
  await dialog.getByRole('button',{name:'Retry same batch',exact:true}).waitFor();
  assert.deepEqual(control.inspirationCalls.map((r)=>r.p_id),['BATCH-A','BATCH-B']);
  control.expectedInspirationRejections=1;await dialog.getByRole('button',{name:'Retry same batch',exact:true}).click();
  await dialog.getByText('2 imported; 1 failed; 0 remaining.',{exact:true}).waitFor();
  assert.deepEqual(control.inspirationCalls.map((r)=>r.p_id),['BATCH-A','BATCH-B','BATCH-B','BATCH-C']);assert.deepEqual(control.inspirationCalls[1],control.inspirationCalls[2]);
  assert.equal(control.inspirationReceipts.size,2);assert.equal(data.inspirations[2].title,'BATCH-C');
  await dialog.getByRole('button',{name:'Close',exact:true}).click();await button('Import Results').click();await dialog.getByText(/1 eligible results/).waitFor();
  await dialog.getByRole('checkbox',{name:'Import BATCH-C',exact:true}).check();await dialog.getByRole('button',{name:'Import selected (1)',exact:true}).click();await dialog.getByText('1 imported; 0 failed; 0 remaining.',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Close',exact:true}).click();
  assert.equal(control.clickupCalls.length,0);
  // A local save remains successful even without a ClickUp session key; explicit sync can recover it.
  const linked=data.inspirations[0];linked.data._sourceClickupId='SOURCE-QA';emit('inspirations','UPDATE',linked);
  await inspirationOption(page,'Refresh inspirations');await button('Open inspiration BATCH-A').click();await button('Edit').click();
  await page.getByLabel('Ad type',{exact:true}).selectOption('Photo');await button('Save inspiration').click();
  await page.getByText(/Source-task ad type is not confirmed in ClickUp/).waitFor();assert.equal(linked.data.adType,'Photo');assert.equal(control.clickupCalls.length,0);
  await button('Sync source ad type').click();const sync=page.getByRole('dialog',{name:'Sync source ad type',exact:true});await sync.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(control.clickupCalls.length,0);
  await page.evaluate(()=>sessionStorage.setItem('immuvi:qa:entgcnlfsnysnwyadzzp:clickup:11111111-1111-4111-8111-111111111111','synthetic-clickup-key'));
  await button('Sync source ad type').click();control.sourceSyncUnverified=true;await sync.getByRole('button',{name:'Sync ad type',exact:true}).click();await sync.getByRole('alert').filter({hasText:'could not be confirmed'}).waitFor();
  control.sourceSyncUnverified=false;await sync.getByRole('button',{name:'Sync ad type',exact:true}).click();await sync.waitFor({state:'hidden'});await page.getByText('Source ad type verified in the QA ClickUp task.',{exact:true}).waitFor();
  await button('Edit').click();await page.getByLabel('Ad type',{exact:true}).selectOption('Carousel');await button('Save inspiration').click();await page.getByText('Inspiration saved. Source ad type verified in the QA ClickUp task.',{exact:true}).waitFor();assert.equal(linked.data.adType,'Carousel');
  assert.deepEqual(control.clickupCalls.map((call)=>call.operation),['sync-inspiration-type','sync-inspiration-type','sync-inspiration-type']);
  assert.equal(new URL(page.url()).pathname,'/');
  results.push('Batch/source sync: complete scoped result selection, incomplete/imported/active exclusions, cancel, partial success, lost-ack exact replay, stale conflict and refreshed retry, 320/390/768/1440px dialog bounds; local ad-type save without token, source-sync cancel, unverified acknowledgement retry and automatic verified sync with a token; no classifier or real external requests');
};
