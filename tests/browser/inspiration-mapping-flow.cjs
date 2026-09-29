const assert=require('node:assert/strict');
const inspirationOption=require('./inspiration-options.cjs');
module.exports=async function testMapping({page,context,data,control,emit,tab,artifactDir,results}) {
  const product='qa-fixture',stamp=new Date().toISOString(),ad=data.ads[0],angle=data.angles.find((item)=>item.product_id===product);
  angle.name='Energy tool';angle.updated_at=stamp;
  data.angles.push({...angle,id:'ARCHIVED-MAP',name:'Energy tools archived',archived_at:stamp},{...angle,id:'FOREIGN-MAP',name:'Foreign energy tools',product_id:'qa-second'});
  const source={id:'MAPPING',product_id:product,url:'https://example.test/mapping',title:'Mapping source',status:'Classified',created_at:stamp,updated_at:stamp,
    data:{formatName:'Mapping source',angle:'Energy tools',persona:'Local audience',_needsAngleReview:true,_needsPersonaReview:true,notes:'Preserve notes',_clickupDocPageUrl:'https://example.test/brief',_dupeType:'winner',_dupeDetail:'A similar winner',_dupeSimilar:[{id:ad.id,name:'Stale title',status:'Loser',matchType:'exact'},'DELETED-MAP','FOREIGN-AD','TOMBSTONE-MAP','MISSING-MAP']}};
  ad.format_name='Current related creative';ad.meta._fromInspoId='MAPPING';
  data.ads.push({...structuredClone(ad),id:'DELETED-MAP',deleted_at:stamp},{...structuredClone(ad),id:'FOREIGN-AD',product_id:'qa-second'}, {...structuredClone(ad),id:'TOMBSTONE-MAP',clickup_task_id:'TOMBSTONE-TASK'});
  data.deleted_ads.push({id:'TOMBSTONE-MAP',product_id:product,clickup_task_id:'TOMBSTONE-TASK'});
  data.inspirations=[source];data.inspiration_queue=[];
  const button=(name)=>page.getByRole('button',{name,exact:true});
  await tab(page,'Inspiration');await inspirationOption(page,'Expand inspiration columns');await button('Suggested angle Energy tool for MAPPING').click();
  let dialog=page.getByRole('dialog',{name:'Map Angle: Mapping source',exact:true});await dialog.waitFor();
  assert.equal(await dialog.getByRole('combobox',{name:'Existing Angle',exact:true}).inputValue(),angle.id);
  const choices=await dialog.getByRole('option').allTextContents();assert.equal(choices.some((name)=>name.includes('archived') || name.includes('Foreign')),false);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(control.inspirationCalls?.length || 0,0);
  await button('Suggested angle Energy tool for MAPPING').click();await dialog.getByRole('button',{name:'Confirm mapping',exact:true}).click();await dialog.waitFor({state:'hidden'});
  assert.equal(source.data.angle,angle.name);assert.equal(source.data._needsAngleReview,false);assert.equal(source.data.notes,'Preserve notes');assert.notEqual(ad.angle,source.data.angle);
  await button('Map persona for MAPPING').click();dialog=page.getByRole('dialog',{name:'Map Persona: Mapping source',exact:true});
  const personaCount=data.personas.length;await dialog.getByRole('textbox',{name:'Persona name',exact:true}).fill('Custom only');await dialog.getByRole('button',{name:'Confirm mapping',exact:true}).click();await dialog.waitFor({state:'hidden'});
  assert.equal(data.personas.length,personaCount);assert.equal(source.data._personaScope,'inspiration');
  await button('Map persona for MAPPING').click();await dialog.getByRole('radio',{name:'Add as new Persona',exact:true}).check();await dialog.getByRole('textbox',{name:'Persona name',exact:true}).fill('New QA persona');
  await dialog.getByRole('button',{name:'Confirm mapping',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Confirm adding'}).waitFor();assert.equal(data.personas.length,personaCount);
  await dialog.getByRole('checkbox').check();control.loseInspirationAck=true;await dialog.getByRole('button',{name:'Confirm mapping',exact:true}).click();await dialog.getByRole('button',{name:'Retry same mapping',exact:true}).waitFor();
  emit('inspirations','UPDATE',source);await dialog.getByRole('button',{name:'Retry same mapping',exact:true}).click();await dialog.waitFor({state:'hidden'});
  assert.equal(data.personas.length,personaCount+1);assert.deepEqual(control.inspirationCalls.at(-1),control.inspirationCalls.at(-2));
  await button('Map angle for MAPPING').click();dialog=page.getByRole('dialog',{name:'Map Angle: Mapping source',exact:true});await dialog.getByRole('radio',{name:'Map to existing',exact:true}).check();await dialog.getByRole('combobox').selectOption(angle.id);
  angle.archived_at=stamp;emit('angles','UPDATE',angle);control.expectedInspirationRejections=(control.expectedInspirationRejections || 0)+1;
  await dialog.getByRole('button',{name:'Confirm mapping',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Taxonomy entry changed'}).waitFor();assert.equal(await dialog.getByRole('combobox').inputValue(),angle.id);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();delete angle.archived_at;emit('angles','UPDATE',angle);
  await button('Map angle for MAPPING').click();dialog=page.getByRole('dialog',{name:'Map Angle: Mapping source',exact:true});
  for(const width of [320,390,768,1440]) {await page.setViewportSize({width,height:900});assert.equal(await dialog.evaluate((el)=>el.getBoundingClientRect().left>=0 && el.getBoundingClientRect().right<=innerWidth && el.scrollWidth<=el.clientWidth),true);await page.screenshot({path:`${artifactDir}/inspiration-mapping-${width}.png`});}
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  Object.assign(ad,{angle:source.data.angle,persona:source.data.persona});emit('ads','UPDATE',ad);
  await button('Duplicate review for MAPPING').click();
  const drawer=page.getByRole('dialog',{name:'Mapping source',exact:true});await drawer.getByRole('heading',{name:'Similar creatives',exact:true}).waitFor();
  assert.equal(await drawer.getByText('Stale title',{exact:true}).count(),0);
  for(const id of ['DELETED-MAP','FOREIGN-AD','TOMBSTONE-MAP','MISSING-MAP'])assert.equal(await drawer.getByRole('button',{name:`View related creative ${id}`,exact:true}).count(),0);
  for(const width of [320,1440]) {
    await page.setViewportSize({width,height:900});
    await drawer.locator('aside').evaluate(async(el)=>{await Promise.all(el.getAnimations().map((animation)=>animation.finished));});
    const related=drawer.locator('section').filter({has:page.getByRole('heading',{name:'Similar creatives',exact:true})});
    await related.scrollIntoViewIfNeeded();
    assert.equal(await related.evaluate((el)=>el.getBoundingClientRect().left>=0 && el.getBoundingClientRect().right<=innerWidth && el.scrollWidth<=el.clientWidth),true);
    await page.screenshot({path:`${artifactDir}/inspiration-duplicate-links-${width}.png`});
  }
  await drawer.getByRole('button',{name:`View related creative ${ad.id}`,exact:true}).click();await page.getByRole('dialog',{name:'Edit creative',exact:true}).waitFor();
  assert.equal(await page.getByRole('textbox',{name:'Creative name',exact:true}).inputValue(),'Current related creative');assert.equal(new URL(page.url()).pathname,'/');await page.keyboard.press('Escape');
  await tab(page,'Inspiration');await button('Duplicate review for MAPPING').click();
  let race=true;await context.route(/\/rest\/v1\/ads\?/,async(route)=>{if(race){race=false;ad.deleted_at=stamp;}await route.fallback();});
  await drawer.getByRole('button',{name:`View related creative ${ad.id}`,exact:true}).click();await page.getByRole('alert').filter({hasText:'related creative is missing'}).waitFor();assert.equal(await page.getByRole('dialog',{name:'Edit creative',exact:true}).count(),0);
  assert.equal(control.clickupCalls.length,0);
  results.push('Inspiration mapping: ranked scoped suggestions, cancel, existing/custom/confirmed-new choices, same-receipt promotion replay, archived-target conflict with draft preservation, 320/390/768/1440px dialogs; duplicate links resolve live same-product records, deny deleted/foreign/tombstoned targets, open Tracker at / and recheck deletion races; no external writes');
};
