const assert=require('node:assert/strict');
module.exports=async function testAddInsights({page,context,data,control,tab,artifactDir,results}) {
  const stamp=new Date().toISOString();
  const base=data.ads[0];base.status='Testing';base.created_at=stamp;base.drive_link='https://drive.google.com/drive/u/0/my-drive';
  data.ads.push({...structuredClone(base),id:'READY',format_name:'Ready creative',status:'Ready to Launch',funnel_stage:'MOF',meta:{_fromInspoId:'INS-20'}},
    {...structuredClone(base),id:'WIN',format_name:'Winning creative',status:'Winner',funnel_stage:'BOF',created_at:new Date(Date.now()-4*86400000).toISOString(),updated_at:stamp});
  data.angles.push({...data.angles[0],id:'EMPTY',name:'Empty angle'});
  data.inspirations=[{id:'INS-20',product_id:'qa-fixture',title:'Used inspiration',status:'Classified',url:'https://example.test/inspo',created_at:stamp,updated_at:stamp,data:{adType:'Video',funnelStage:'MOF',angle:'Energy',notes:'Source notes'}},
    {id:'INS-10',product_id:'qa-fixture',title:'Available inspiration',status:'Classified',url:'https://example.test/available',created_at:stamp,updated_at:stamp,data:{adType:'Photo',funnelStage:'TOF',angle:'Energy',driveLink:'https://drive.google.com/drive/u/0/my-drive',notes:'Read this note'}},
    {id:'INS-9',product_id:'qa-fixture',title:'Queued inspiration',status:'Queued',created_at:stamp,updated_at:stamp,data:{adType:'Video'}}];
  await tab(page,'Creative Matrix');
  await page.getByRole('button',{name:'Energy x Busy people: 3 creatives',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('tab',{name:'Insights',exact:true}).click();
  const insights=dialog.getByRole('tabpanel',{name:'Insights'});
  for(const title of ['Status mix','Funnel coverage','Source mix','Test cadence','Time to result']) await insights.getByRole('region',{name:title,exact:true}).waitFor();
  assert.equal(await insights.getByRole('meter',{name:'Ready',exact:true}).getAttribute('aria-valuenow'),'1');
  assert.equal(await insights.getByRole('meter',{name:'In Prod',exact:true}).count(),0);
  assert.equal(await insights.getByRole('img').count(),12);
  assert.equal(await insights.getByRole('region',{name:'Time to result'}).getByText('4d',{exact:true}).count(),1);
  assert.equal(await insights.getByText('Solid pocket.',{exact:true}).count(),1);
  for(const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    assert.equal(await insights.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    await page.screenshot({path:`${artifactDir}/matrix-insights-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:900});
  await dialog.getByRole('tab',{name:'+ Add Creative',exact:true}).click();
  const add=dialog.getByRole('tabpanel',{name:'+ Add Creative'});
  const tracker=add.getByRole('region',{name:'Tracker source table'});
  assert.deepEqual(await tracker.locator('th').allTextContents(),['','Task Name','Status','Type','Funnel','Angle','Created','Drive']);
  await add.getByLabel('Source status filter',{exact:true}).click();
  await add.getByRole('checkbox',{name:'Testing',exact:true}).check();
  await page.keyboard.press('Escape');assert.equal(await tracker.locator('tbody tr').count(),1);
  await add.getByRole('button',{name:'Reset',exact:true}).click();
  await tracker.getByLabel(`Select ${base.format_name}`,{exact:true}).check();
  await add.getByLabel('Search matrix sources').fill('absent');
  assert.equal(await add.getByRole('button',{name:'Add 1 selected',exact:true}).isEnabled(),true,'Selection should survive filtering');
  await add.getByRole('button',{name:'Reset',exact:true}).click();
  await page.screenshot({path:`${artifactDir}/matrix-source-tracker.png`});
  await add.getByRole('button',{name:'From Inspiration',exact:true}).click();
  const inspiration=add.getByRole('region',{name:'Inspiration source table'});
  assert.deepEqual(await inspiration.locator('th').allTextContents(),['','INS #','Task Name','Status','Type','Funnel','Angle','Added','Drive','Notes']);
  assert.equal(await inspiration.getByLabel('Select Queued inspiration').isDisabled(),true);
  assert.equal(await inspiration.getByLabel('Select Used inspiration').isDisabled(),true);
  assert.equal(await inspiration.getByRole('link',{name:'INS-10',exact:true}).getAttribute('href'),'https://example.test/available');
  await add.getByLabel('Source type filter',{exact:true}).click();
  await add.getByRole('checkbox',{name:'Photo',exact:true}).check();
  await page.keyboard.press('Escape');assert.equal(await inspiration.locator('tbody tr').count(),1);
  await add.getByRole('button',{name:'Reset',exact:true}).click();
  await inspiration.getByRole('button',{name:'INS #',exact:true}).click();
  assert.equal(await inspiration.getByRole('columnheader',{name:'INS #',exact:true}).getAttribute('aria-sort'),'ascending');
  await page.screenshot({path:`${artifactDir}/matrix-source-inspiration.png`});
  await add.getByRole('button',{name:'Blank Brief',exact:true}).click();
  assert.equal(await add.getByLabel('Brief ad type').inputValue(),'');
  assert.equal(await add.getByLabel('Push to Action Plan now').isChecked(),true);
  assert.equal(await add.getByRole('button',{name:'Create brief'}).isDisabled(),true);
  for(const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    assert.equal(await add.locator('form').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    await page.screenshot({path:`${artifactDir}/matrix-blank-brief-${width}.png`});
  }
  await page.setViewportSize({width:1440,height:900});
  await add.getByLabel('Brief name').fill('No plan brief');
  assert.equal(await add.getByRole('button',{name:'Create brief'}).evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(214, 255, 75)');
  await page.screenshot({path:`${artifactDir}/matrix-blank-ready.png`});
  await add.getByLabel('Push to Action Plan now').uncheck();
  const beforePlans=data.manual_actions.length;
  await add.getByRole('button',{name:'Create brief'}).click();
  await dialog.getByLabel('Task name for No plan brief',{exact:true}).waitFor();
  assert.equal(data.manual_actions.length,beforePlans);
  await dialog.getByRole('tab',{name:'+ Add Creative',exact:true}).click();
  await add.getByLabel('Brief name').fill('Plan brief');
  await add.getByLabel('Push to Action Plan now').check();
  await add.getByRole('button',{name:'Create brief'}).click();
  await dialog.getByText('1 creatives available in this cell. 1 added to Action Plan.',{exact:true}).waitFor();
  const created=data.ads.find(ad=>ad.format_name==='Plan brief');
  assert.equal(data.manual_actions.filter(action=>action.payload.sourceAdId===created.id).length,1);
  assert.equal(control.clickupCalls.length,0);
  // A plan failure must not erase successful creation or invite duplicate creation.
  control.expectedAdoptionRejections=1;
  await context.route(/\/rest\/v1\/rpc\/qa_plan_stage$/,route=>route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({message:'Synthetic plan rejection'})}));
  await dialog.getByRole('tab',{name:'+ Add Creative',exact:true}).click();
  await add.getByLabel('Brief name').fill('Partial plan brief');
  await add.getByRole('button',{name:'Create brief'}).click();
  await dialog.getByRole('alert').filter({hasText:'Creatives were created, but only 0/1'}).waitFor();
  await dialog.getByLabel('Task name for Partial plan brief',{exact:true}).waitFor();
  assert.equal(data.ads.filter(ad=>ad.format_name==='Partial plan brief').length,1);
  await dialog.getByRole('button',{name:'Close inspector'}).click();
  await page.getByRole('button',{name:'Empty angle x Busy people: 0 creatives',exact:true}).click();
  await dialog.getByRole('tab',{name:'Insights',exact:true}).click();
  await dialog.getByRole('heading',{name:'No data yet',exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Close inspector'}).click();
  results.push('Legacy Add Creative/Insights: exact source columns, search/multiselect filters/sort, blocked and used inspirations, selection retained through filters, responsive blank brief and charts at 320-1440px, separate Ready counts, 12-week cadence, estimated result time, empty state, optional QA plan staging and partial-failure preservation; no ClickUp calls');
};
