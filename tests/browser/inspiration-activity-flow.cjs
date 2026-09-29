const assert=require('node:assert/strict');
module.exports=async function({page,context,data,emit,tab,artifactDir,results}) {
  const now=new Date(2026,8,23,12).getTime(),stamp=new Date(now).toISOString(),product='qa-fixture';
  await page.clock.install({time:now});
  data.inspirations=[{id:'INS-A',product_id:product,title:'Active inspiration',status:'Classifying',created_at:stamp,updated_at:stamp,data:{}},
    {id:'INS-OLD',product_id:product,title:'Previous week',status:'Classified',created_at:new Date(now-7*86400000).toISOString(),data:{}}];
  data.worker_registry=[{worker_id:'qa-classifier',hostname:'QA Mini',status:'busy',enabled:true,control_revision:'9018b072-bc0a-4f8f-a2e5-afc01cfca35c',last_heartbeat:stamp,capabilities:{codex:true,worker_contract:'inspiration-brief-8-section-page-verified'}}];
  data.qa_image_worker=[{id:'local-native',heartbeat_at:stamp,generation_available:true}];
  data.inspiration_queue=[{id:'Q',ins_id:'INS-A',product_id:product,status:'classifying',claimed_by:'qa-classifier',claimed_at:new Date(now-30000).toISOString(),queued_at:stamp},
    {id:'WAIT',ins_id:'INS-WAIT',product_id:product,status:'pending',queued_at:stamp},
    {id:'BLOCK',ins_id:'INS-BLOCK',product_id:product,status:'pending',worker_assignment:'blocked:qa-isolation',queued_at:stamp}];
  const ad=data.ads[0];
  data.variation_brief_queue=[{id:'BRIEF',parent_ad_id:ad.id,target_ad_id:ad.id,status:'classifying',created_at:stamp,claimed_at:stamp,claimed_by:'qa-classifier'},
    {id:'FOREIGN',parent_ad_id:'foreign',target_ad_id:ad.id,status:'pending',created_at:stamp}];
  data.qa_image_runs=[{id:'IMG',product_id:product,ad_id:ad.id,status:'running',created_at:stamp,started_at:stamp}];
  await tab(page,'Inspiration');
  const button=name=>page.getByRole('button',{name,exact:true});
  await button('Open task activity').filter({hasText:'3 running · 1 queued · 1 blocked'}).waitFor();
  const tile=page.locator('[data-inspiration-pulse="period:classified"]');
  const delta=tile.locator('small[data-negative]');await delta.waitFor();
  const d=await delta.boundingBox(),metric=await tile.locator('[data-inspiration-count]').boundingBox();assert.ok(d.x>metric.x+metric.width,'Delta must sit to the right of the count');
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    const dots=button('Inspiration table options');await dots.scrollIntoViewIfNeeded();await dots.click();
    const menu=page.locator('[popover]:popover-open');await menu.waitFor();
    await page.waitForFunction(()=>{const b=document.querySelector('button[aria-label="Inspiration table options"]').getBoundingClientRect(),m=document.querySelector('[popover]:popover-open').getBoundingClientRect();return Math.min(Math.abs(m.top-b.bottom),Math.abs(m.bottom-b.top))<10;});
    const bounds=await menu.boundingBox();assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width);
    await page.screenshot({path:`${artifactDir}/inspiration-menu-${width}.png`});await page.keyboard.press('Escape');
    await button('Queue and worker health').click();const panel=page.getByRole('dialog',{name:'Workers and activity',exact:true});await panel.waitFor();
    await panel.getByRole('article',{name:'Native image worker',exact:true}).waitFor();
    await panel.getByText('qa-classifier',{exact:true}).waitFor();
    assert.equal(await panel.getByRole('alert').count(),0);
    const aside=panel.locator('aside[data-modal-panel]');await aside.evaluate(async el=>Promise.all(el.getAnimations().map(a=>a.finished)));
    const box=await aside.boundingBox();assert.ok(Math.abs(box.x+box.width-width)<2);assert.ok(width===390 || box.x>width/2);
    await page.screenshot({path:`${artifactDir}/inspiration-workers-${width}.png`});
    if(width===1440)await page.mouse.click(5,400);else await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});
  }
  await button('Open task activity').click();const panel=page.getByRole('dialog',{name:'Workers and activity',exact:true});
  await panel.locator('[data-activity-id="brief:BRIEF"]').getByText('Generating variation brief',{exact:true}).waitFor();
  assert.equal(await panel.locator('[data-activity-id="brief:FOREIGN"]').count(),0);
  await panel.locator('[data-activity-id="inspiration:Q"]').getByText('~1 min',{exact:true}).waitFor();
  await panel.locator('[data-activity-id="brief:BRIEF"]').getByText('Unavailable',{exact:true}).waitFor();
  await panel.locator('[data-activity-id="inspiration:BLOCK"]').getByText('Dispatch blocked',{exact:true}).waitFor();
  data.variation_brief_queue[0].status='done';data.variation_brief_queue[0].processed_at=stamp;emit('variation_brief_queue','UPDATE',data.variation_brief_queue[0]);
  await panel.locator('[data-activity-id="brief:BRIEF"]').waitFor({state:'detached'});
  assert.equal(await panel.getByRole('option',{name:'Completed',exact:true}).count(),0);
  assert.equal(await panel.getByRole('option',{name:'Failed',exact:true}).count(),0);
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:`${artifactDir}/inspiration-activity-${width}.png`});}
  let fail=true;await context.route(/\/rest\/v1\/qa_image_runs\?/,route=>fail?route.fulfill({status:200,contentType:'application/json',body:'null'}):route.fallback());
  await panel.getByRole('button',{name:'Refresh worker activity',exact:true}).click();await panel.getByRole('alert').filter({hasText:'Image tasks unavailable'}).waitFor();assert.equal(await panel.locator('[data-activity-id="image:IMG"]').count(),1);
  fail=false;data.inspiration_queue=[];data.variation_brief_queue=[];data.qa_image_runs=[];
  await panel.getByRole('button',{name:'Refresh worker activity',exact:true}).click();await panel.getByText('No ongoing or queued tasks.',{exact:true}).waitFor();
  await page.keyboard.press('Escape');await button('Open task activity').filter({hasText:'Activity · idle'}).waitFor();
  results.push('Inspiration activity: right-side deltas, anchored menus at 1440/390px, right worker drawer/outside dismissal, live classifier/brief/image stages, scoped brief jobs, honest ETA/blocked states, retained tasks on read failure, idle button and no writes');
};
