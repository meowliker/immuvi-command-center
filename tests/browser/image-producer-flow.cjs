const assert=require('node:assert/strict');
const sharp=require('sharp');
module.exports=async function({page,data,control,tab,artifactDir,results}){
  let online=true,runs=[],submissions=[],sharedSubmissions=[];
  const fixture=await sharp({create:{width:256,height:256,channels:3,background:'#29a09a'}}).png().toBuffer();
  await page.route('**/storage/v1/**',route=>route.request().method()==='POST'
    ?route.fulfill({json:{signedURL:'/object/sign/qa-producer-images/fixture/1.png?token=fixture'}})
    :route.fulfill({contentType:'image/png',body:fixture}));
  await page.route('**/rest/v1/qa_image_runs*',route=>route.fulfill({json:runs}));
  await page.route('**/rest/v1/rpc/qa_private_workers_list',route=>route.fulfill({json:[{id:'private-fixture',name:'My Mac',enabled:true,generation_available:online,heartbeat_at:new Date().toISOString()}]}));
  await page.route('**/rest/v1/rpc/qa_image_workers_list',route=>route.fulfill({json:[
    {id:'private-fixture',name:'My Mac',scope:'private',enabled:true,generation_available:online,heartbeat_at:new Date().toISOString()},
    {id:'shared-fixture',name:'Mac mini - QA',scope:'shared',enabled:true,image_protocol:1,generation_available:false,heartbeat_at:new Date(Date.now()-60000).toISOString()}
  ]}));
  await page.route('**/api/workers/images',route=>{
    const body=route.request().postDataJSON();sharedSubmissions.push(body);
    assert.equal(body.workerId,'shared-fixture');assert.equal(route.request().headers()['x-clickup-token'],'fixture-producer-token');
    runs=[{id:body.recoveryId||body.requestId,ad_id:body.adId,private_worker_id:'shared-fixture',status:'pending',outputs:[],error:null,created_at:new Date().toISOString()}];
    return route.fulfill({json:{id:runs[0].id,status:'pending'}});
  });
  await page.route('**/rest/v1/rpc/qa_generate_images',route=>{
    const body=route.request().postDataJSON();submissions.push(body);
    runs=[{id:body.p_request_id,ad_id:body.p_ad_id,status:'pending',outputs:[],error:null,created_at:new Date().toISOString()}];
    return route.fulfill({json:runs[0]});
  });
  data.ads[0].created_at='2026-06-01T12:00:00Z';data.ads[0].last_status_change_at='2026-06-02T12:00:00Z';
  await tab(page,'Action Plan');
  await page.getByRole('button',{name:'View all-time totals (1)',exact:true}).waitFor();
  await page.getByRole('button',{name:'Generate images for QA creative',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Generate Ad Images',exact:true});await dialog.waitFor();
  await page.getByText('Worker online',{exact:true}).waitFor();
  assert.equal(await dialog.getByLabel('Images',{exact:true}).inputValue(),'5');
  assert.equal(await dialog.getByLabel('Canonical product name',{exact:true}).inputValue(),'QA Fixture');
  for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:844});
    assert.equal(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}),true);
    assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    const layout=await dialog.evaluate(el=>{
      const rect=el.getBoundingClientRect(),brief=el.querySelector('[data-producer-column="brief"]').getBoundingClientRect(),settings=el.querySelector('[data-producer-column="settings"]').getBoundingClientRect();
      return {width:rect.width,height:rect.height,sideBySide:settings.left>=brief.right,stacked:settings.top>=brief.bottom};
    });
    if(width>=768)assert.equal(layout.sideBySide,true,`Desktop columns at ${width}`);
    else assert.equal(layout.stacked,true,`Mobile stack at ${width}`);
    if(width===1440){assert.ok(layout.width>=1000);assert.ok(layout.width>layout.height);assert.ok(layout.height<650);}
    await page.screenshot({path:`${artifactDir}/producer-dialog-${width}.png`});
  }
  await dialog.getByLabel('Instruction',{exact:true}).fill('Preserve canonical product and CTA.');
  await dialog.getByLabel('Images',{exact:true}).fill('1');
  await dialog.getByRole('button',{name:'Generate',exact:true}).click();
  await dialog.getByText('Queued...',{exact:true}).waitFor();
  assert.equal(submissions.length,1);assert.equal(submissions[0].p_options.count,1);
  assert.equal(submissions[0].p_product_id,'qa-fixture');
  assert.equal(await dialog.getByRole('button',{name:'Generate',exact:true}).isDisabled(),true);
  runs[0]={...runs[0],status:'failed',error:'Reference URL is not a downloadable image.'};
  await dialog.getByRole('alert').filter({hasText:'Reference URL'}).waitFor();
  assert.equal(await dialog.getByRole('button',{name:'Generate',exact:true}).isEnabled(),true);
  await dialog.getByRole('button',{name:'Generate',exact:true}).click();
  await dialog.getByText('Queued...',{exact:true}).waitFor();
  assert.equal(submissions.length,2);assert.notEqual(submissions[0].p_request_id,submissions[1].p_request_id);
  runs[0]={...runs[0],status:'done',outputs:[{path:'fixture/1.png',filename:'1.png',width:256,height:256,prompt:'Test fixture',quality_checks:['Fixture verified']}]};
  const preview=dialog.getByRole('img',{name:'QA creative - 1.png',exact:true});await preview.waitFor();
  await page.waitForFunction(()=>document.querySelector('dialog img')?.naturalWidth===256);
  assert.match(await dialog.getByRole('link',{name:'Open 1.png',exact:true}).getAttribute('href'),/qa-producer-images/);
  await page.screenshot({path:`${artifactDir}/producer-completed-preview.png`});
  online=false;await page.getByText('Worker unavailable',{exact:true}).waitFor();
  assert.equal(await dialog.getByRole('button',{name:'Generate',exact:true}).isDisabled(),true);
  await dialog.getByLabel('Run on worker',{exact:true}).selectOption('shared-fixture');
  await dialog.getByText('Waiting for worker',{exact:true}).waitFor();
  await page.evaluate(()=>sessionStorage.setItem('immuvi:qa:entgcnlfsnysnwyadzzp:clickup:11111111-1111-4111-8111-111111111111','fixture-producer-token'));
  assert.equal(await dialog.getByRole('button',{name:'Generate',exact:true}).isEnabled(),true);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:`${artifactDir}/producer-shared-selector-mobile.png`});
  await dialog.getByRole('button',{name:'Generate',exact:true}).click();
  await dialog.getByText('Queued...',{exact:true}).waitFor();
  assert.equal(sharedSubmissions.length,1);assert.equal(submissions.length,2);
  const sharedId=runs[0].id;
  runs[0]={...runs[0],status:'failed',error:'Saved image delivery needs renewed authorization.'};
  await dialog.getByRole('button',{name:'Resume saved run',exact:true}).click();
  await dialog.getByText('Queued...',{exact:true}).waitFor();
  assert.equal(sharedSubmissions.length,2);assert.equal(sharedSubmissions[1].recoveryId,sharedId);assert.equal(runs[0].id,sharedId);
  await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'View all-time totals (1)',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:'Pulse date range',exact:true}).innerText(),'All time');
  assert.equal(await page.getByRole('button',{name:'View all-time totals (1)',exact:true}).count(),0);
  assert.equal(await page.locator('[data-pulse-key="week:created"] [data-pulse-count]').innerText(),'1');
  assert.equal(await page.locator('[data-pulse-key="today:created"] [data-pulse-count]').innerText(),'0');
  await page.screenshot({path:`${artifactDir}/pulse-all-time.png`});
  assert.equal(control.clickupCalls.length,0);
  results.push('QA Producer private/shared selection, offline shared queue without private fallback, resume saved run retaining its ID, default fields, native readiness, scoped request, pending lock, failure feedback, signed preview, Escape, 320-1440px dialog. All generation/delivery mocked; zero ClickUp calls.');
};
