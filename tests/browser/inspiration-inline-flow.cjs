const inspirationOption=require('./inspiration-options.cjs');
const assert=require('node:assert/strict');
module.exports=async function testInline({page,data,control,emit,tab,artifactDir,results}) {
  const stamp=new Date().toISOString(),product='qa-fixture';
  const source={id:'INLINE',product_id:product,url:'https://example.test/inline',title:'Original name',status:'Classified',created_at:stamp,updated_at:stamp,
    data:{formatName:'Original name',creativeUSP:'Original name \u2014 Original detail',angle:'Energy',persona:'Busy people',adType:'Video',notes:'Original notes',_dupeType:'winner',_dupeDetail:'Similar winner',_clickupDocPageUrl:'https://example.test/brief',_classificationBrief:{why_it_works:'Preserved brief'}}};
  data.inspirations=[source,{...structuredClone(source),id:'BLOCKED',status:'Blocked',data:{formatName:'Blocked source'}}];data.inspiration_queue=[];
  data.ads[0].meta._fromInspoId='INLINE';
  Object.assign(data.ads[0],{angle:source.data.angle,persona:source.data.persona});
  await tab(page,'Inspiration');const button=(name)=>page.getByRole('button',{name,exact:true});
  await button('Open inspiration INLINE').waitFor();
  assert.equal(await page.getByRole('columnheader',{name:'Notes',exact:true}).count(),0);
  const compact=await page.getByRole('columnheader').allTextContents();assert.ok(compact.indexOf('Source')<compact.findIndex((label)=>label.startsWith('Status')));
  await button('Duplicate review for INLINE').click();await page.getByRole('dialog').getByText(/This angle x persona combo/).waitFor();await page.keyboard.press('Escape');
  await button('Edit Format Name for INLINE').click();let form=page.getByRole('form',{name:'Edit Format Name for INLINE',exact:true});
  await form.getByRole('textbox').fill('Cancelled');await page.keyboard.press('Escape');assert.equal(control.inspirationCalls?.length || 0,0);
  await button('Edit Format Name for INLINE').click();form=page.getByRole('form',{name:'Edit Format Name for INLINE',exact:true});
  await form.getByRole('textbox').fill('Renamed inline');await form.getByRole('textbox').press('Enter');await form.waitFor({state:'hidden'});
  assert.equal(source.data.formatName,'Renamed inline');assert.equal(data.ads[0].format_name,'Renamed inline');assert.equal(source.data.creativeUSP,'Renamed inline \u2014 Original detail');
  for(const [label,value,key] of [['Angle','Custom local angle','angle'],['Persona','Custom local persona','persona']]) {
    await page.getByRole('combobox',{name:`${label} for INLINE`,exact:true}).selectOption('__custom__');form=page.getByRole('form',{name:`Edit ${label} for INLINE`,exact:true});await form.getByRole('textbox').fill(value);await form.getByRole('button',{name:'Save field',exact:true}).click();await form.waitFor({state:'hidden'});assert.equal(source.data[key],value);
  }
  for(const [label,value,key] of [['Structure','Testimonial','creativeStructure'],['Hook','Fear','hookType'],['Production','Animation / Motion','productionStyle'],['Funnel','MOF','funnelStage'],['Type','UGC','adType']]) {
    await page.getByRole('combobox',{name:`${label} for INLINE`,exact:true}).selectOption(value);form=page.getByRole('form',{name:`Edit ${label} for INLINE`,exact:true});await form.getByRole('button',{name:'Save field',exact:true}).click();await form.waitFor({state:'hidden'});assert.equal(source.data[key],value);
  }
  await inspirationOption(page,'Expand inspiration columns');
  await button('Edit Format detail for INLINE').click();form=page.getByRole('form',{name:'Edit Format detail for INLINE',exact:true});await form.getByRole('textbox').fill('New detail \u2014 retained suffix');
  control.loseInspirationAck=true;await form.getByRole('button',{name:'Save field',exact:true}).click();await form.getByRole('button',{name:'Retry same inline save',exact:true}).waitFor();
  emit('inspirations','UPDATE',source);assert.equal(await form.getByRole('textbox').inputValue(),'New detail \u2014 retained suffix');
  await form.getByRole('button',{name:'Retry same inline save',exact:true}).click();await form.waitFor({state:'hidden'});
  assert.deepEqual(control.inspirationCalls.at(-1),control.inspirationCalls.at(-2));assert.equal(source.data.creativeUSP,'Renamed inline \u2014 New detail \u2014 retained suffix');
  await button('Edit Notes for INLINE').click();form=page.getByRole('form',{name:'Edit Notes for INLINE',exact:true});await form.getByRole('textbox').fill('Draft retained');
  source.data.notes='Changed remotely';source.updated_at=new Date(Date.now()+10000).toISOString();emit('inspirations','UPDATE',source);
  await inspirationOption(page,'Refresh inspirations');assert.equal(await form.getByRole('textbox').inputValue(),'Draft retained');
  control.expectedInspirationRejections=(control.expectedInspirationRejections || 0)+1;await form.getByRole('button',{name:'Save field',exact:true}).click();await form.getByRole('alert').filter({hasText:'Inspiration changed'}).waitFor();
  assert.equal(source.data.notes,'Changed remotely');assert.equal(await form.getByRole('textbox').inputValue(),'Draft retained');await form.getByRole('button',{name:'Cancel inline edit',exact:true}).click();
  for(const [label,value,key] of [['Notes','','notes'],['Hypothesis','New hypothesis','creativeHypothesis'],['Added By','QA reviewer','addedBy']]) {
    await button(`Edit ${label} for INLINE`).click();form=page.getByRole('form',{name:`Edit ${label} for INLINE`,exact:true});await form.getByRole('textbox').fill(value);await form.getByRole('button',{name:'Save field',exact:true}).click();await form.waitFor({state:'hidden'});assert.equal(source.data[key],value);
  }
  assert.equal(source.data._clickupDocPageUrl,'https://example.test/brief');assert.equal(source.data._classificationBrief.why_it_works,'Preserved brief');
  await button('Edit Format detail for INLINE').click();form=page.getByRole('form',{name:'Edit Format detail for INLINE',exact:true});await form.getByRole('textbox').fill('');await form.getByRole('button',{name:'Save field',exact:true}).click();await form.waitFor({state:'hidden'});assert.equal(source.data.creativeUSP,'Renamed inline');
  await inspirationOption(page,'Expand inspiration columns');
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`${artifactDir}/inspiration-inline-${width}.png`});await page.getByRole('region',{name:'Inspiration library table',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:`${artifactDir}/inspiration-inline-table-${width}.png`});}
  await button('Edit Format Name for INLINE').click();form=page.getByRole('form',{name:'Edit Format Name for INLINE',exact:true});await form.getByRole('textbox').fill('Still editing');
  data.inspirations=data.inspirations.filter((item)=>item!==source);emit('inspirations','DELETE',{id:source.id});await page.getByRole('status').filter({hasText:'draft is retained'}).waitFor();assert.equal(await form.getByRole('textbox').inputValue(),'Still editing');await form.getByRole('button',{name:'Cancel inline edit',exact:true}).click();await button('Open inspiration INLINE').waitFor({state:'hidden'});
  assert.equal(await button('Use format BLOCKED').isDisabled(),true);assert.equal(await page.getByRole('combobox',{name:'Angle for BLOCKED',exact:true}).count(),0);
  assert.equal(control.clickupCalls.length,0);assert.equal(new URL(page.url()).pathname,'/');
  results.push('Inspiration inline: compact legacy columns, duplicate/queue/usage signals, all inline fields and custom local taxonomy, cancel, rename cascade, detail clear/preservation, same-receipt retry, live draft/stale conflict/deletion retention, 320/390/768/1440px table bounds; no real external writes');
};
