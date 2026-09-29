const assert=require('node:assert/strict');
module.exports=async function({page,data,tab,artifactDir,results}) {
  let runs=[],submitted=[];
  await page.route('**/rest/v1/rpc/qa_analysis_workers',r=>r.fulfill({json:[{id:'shared-fixture',name:'Mac mini - QA',enabled:true,analysis_protocol:1,codex_active:false,classifier_available:false,heartbeat_at:new Date(Date.now()-60000).toISOString()}]}));
  await page.route('**/rest/v1/rpc/qa_analysis_status',r=>r.fulfill({json:runs}));
  await page.route('**/api/workers/analysis',r=>{
    const body=r.request().postDataJSON();submitted.push(body);
    assert.equal(r.request().headers()['x-clickup-token'],'fixture-analysis-key');
    runs=[{...body,worker_id:body.workerId,drive_file_id:body.fileId,status:'pending',error:'',can_resume:false}];return r.fulfill({json:{id:body.id,status:'pending'}});
  });
  await page.evaluate(()=>sessionStorage.setItem('immuvi:qa:entgcnlfsnysnwyadzzp:clickup:11111111-1111-4111-8111-111111111111','fixture-analysis-key'));
  await tab(page,'Strategist');
  const select=page.getByRole('combobox',{name:'Strategist worker'});
  await select.waitFor();
  assert.equal(await page.getByRole('button',{name:'Run Strategist',exact:true}).isDisabled(),true);
  await select.selectOption('shared-fixture');
  assert.equal(await page.getByRole('button',{name:'Run Strategist',exact:true}).isEnabled(),true);
  for(const width of [1440,390]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await select.evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}),true);
    await page.screenshot({path:`${artifactDir}/analysis-${width}.png`});
  }
  await page.getByRole('button',{name:'Run Strategist',exact:true}).click();
  await page.getByRole('button',{name:'Queued',exact:true}).waitFor();assert.equal(submitted.length,1);
  const id=submitted[0].id;runs[0]={...runs[0],status:'failed',error:'Saved output needs review.',can_resume:true};
  await page.getByRole('button',{name:'Resume saved run',exact:true}).waitFor({timeout:15000});
  await page.getByText('Needs attention',{exact:true}).click();await page.getByRole('alert').filter({hasText:'Saved output'}).waitFor();
  await page.getByRole('button',{name:'Resume saved run',exact:true}).click();
  await page.getByRole('button',{name:'Queued',exact:true}).waitFor();assert.equal(submitted.length,2);assert.equal(submitted[1].id,id);
  data.ads[0].status='Winner';
  const fileId='f'.repeat(30);
  data.task_video_winners=[{id:'fixture-file',ad_id:'AD-1',drive_file_id:fileId,file_name:'winner.mp4'}];
  await page.setViewportSize({width:1440,height:900});await tab(page,'Creative Tracker');
  await page.getByRole('button',{name:'Winning files for QA creative',exact:true}).click();
  const winnerSelect=page.getByRole('combobox',{name:'Winner brief worker'});await winnerSelect.waitFor();
  await winnerSelect.selectOption('shared-fixture');await page.getByRole('button',{name:'Generate winner brief',exact:true}).click();
  await page.getByRole('button',{name:'Queued',exact:true}).waitFor();assert.equal(submitted[2].kind,'variation');assert.equal(submitted[2].fileId,fileId);
  runs[0]={...runs[0],status:'done',url:'https://app.clickup.com/9016762494/docs/8cq1r3y-44896/qa-page'};
  const link=page.getByRole('link',{name:'Winner brief',exact:true});await link.waitFor({timeout:15000});assert.equal(await link.getAttribute('href'),runs[0].url);
  await page.screenshot({path:`${artifactDir}/winner-brief-complete.png`});
  results.push('Shared analysis: explicit offline worker, desktop/mobile layouts, queued state, same-run recovery; all services mocked.');
};
