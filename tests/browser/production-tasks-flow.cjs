const assert=require('node:assert/strict');
module.exports=async function testProductionTasks({page,context,data,control,emit,tab,artifactDir,results}) {
  const button=(name)=>page.getByRole('button',{name,exact:true});
  const dialog=(name)=>page.getByRole('dialog',{name,exact:true});
  await tab(page,'Production');await button('Add production task').click();
  const create=dialog('Add production task');
  await create.getByLabel('Task name',{exact:true}).fill('Production task');
  await create.getByLabel('Format',{exact:true}).selectOption('Teacher Angle');
  await create.getByLabel('Angle',{exact:true}).selectOption('Energy');
  await create.getByLabel('Persona',{exact:true}).selectOption('Busy people');
  await create.getByLabel('Due date',{exact:true}).fill('2026-12-15');
  await create.getByLabel('Notes',{exact:true}).fill('Keep this production brief');
  await create.getByLabel('Inspiration link',{exact:true}).fill('https://example.test/source');
  const count=data.ads.length;control.loseProductionAck=true;
  await create.getByRole('button',{name:'Create task',exact:true}).click();
  await create.getByRole('alert').filter({hasText:'could not be verified'}).waitFor();
  assert.equal(await create.getByLabel('Task name',{exact:true}).isDisabled(),true);
  assert.equal(data.ads.length,count+1);assert.equal(control.clickupCalls.length,0);
  await create.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.reload({waitUntil:'networkidle'});await tab(page,'Production');await button('Add production task').click();
  await create.getByRole('button',{name:'Recover same creation',exact:true}).click();await create.waitFor({state:'hidden'});
  assert.deepEqual(control.productionCalls[0],control.productionCalls[1]);assert.equal(data.ads.length,count+1);
  const ad=data.ads.find((row)=>row.format_name==='Production task');
  const action=data.manual_actions.find((row)=>row.payload.sourceAdId===ad.id);
  assert.ok(action);assert.equal(ad.meta.dueDate,'2026-12-15');assert.equal(action.payload.format,'Teacher Angle');assert.equal(ad.ad_type,'Video');
  assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).some((key)=>key.startsWith('immuvi:qa:production:'))),false);
  await page.evaluate(()=>sessionStorage.setItem('immuvi:qa:entgcnlfsnysnwyadzzp:clickup:11111111-1111-4111-8111-111111111111','synthetic-clickup-key'));
  await button('Task controls for Production task').click();
  control.creationFailure=true;await button('Push to ClickUp: Production task').click();
  await button('Recover ClickUp link for Production task').waitFor();
  assert.equal(await button('Edit details for Production task').isDisabled(),true);
  assert.equal(control.creationPosts,1);control.creationFailure=false;
  await button('Recover ClickUp link for Production task').click();
  await page.getByRole('status').filter({hasText:'Linked to ClickUp task'}).waitFor();assert.equal(control.creationPosts,1);

  await button('Edit details for Production task').click();
  let detail=dialog('Creative details: Production task');
  await detail.getByLabel('Creative name',{exact:true}).fill('Edited production');
  await detail.getByLabel('Notes',{exact:true}).fill('Retained new brief');
  control.clickupFailure=true;
  await detail.getByRole('button',{name:'Save creative',exact:true}).click();await detail.waitFor({state:'hidden'});
  await page.getByRole('status').filter({hasText:'ClickUp changes remain pending'}).waitFor();
  assert.equal(ad.format_name,'Edited production');assert.equal(ad.meta.notes,'Retained new brief');
  control.clickupFailure=false;await button('Sync ClickUp for Edited production').click();
  await page.getByRole('status').filter({hasText:'sent to ClickUp'}).waitFor();

  control.schema={fields:[{id:'__task_assignees',name:'Task assignees',type:'users'},{id:'review',name:'Reviewer',type:'users'},{id:'score',name:'Score',type:'number'}],members:[{id:11,username:'QA Editor'},{id:22,username:'QA Reviewer'}],mappings:{}};
  await button('Assignments for Edited production').click();const fields=dialog('Assignments and fields: Edited production');
  await fields.getByLabel('Task assignees custom field',{exact:true}).selectOption(['11']);
  await fields.getByLabel('Reviewer custom field',{exact:true}).selectOption(['22']);
  await fields.getByLabel('Score custom field',{exact:true}).fill('0');
  await fields.getByLabel('Update linked ClickUp task',{exact:true}).uncheck();
  const pushes=control.clickupCalls.filter((call)=>call.operation==='push-creative').length;
  await fields.getByRole('button',{name:'Save assignments and fields',exact:true}).click();await fields.waitFor({state:'hidden'});
  assert.deepEqual(ad.meta.assignees,[{id:11}]);assert.deepEqual(ad.meta._customFieldsRaw.reviewer,[22]);assert.equal(ad.meta._customFieldsRaw.score,0);
  assert.equal(control.clickupCalls.filter((call)=>call.operation==='push-creative').length,pushes);

  await button('Edit details for Edited production').click();detail=dialog('Creative details: Edited production');
  await detail.getByLabel('Notes',{exact:true}).fill('Draft survives conflict');control.failNextCreative=true;control.expectedAdoptionRejections=(control.expectedAdoptionRejections || 0)+1;
  await detail.getByRole('button',{name:'Save creative',exact:true}).click();
  await detail.getByRole('alert').filter({hasText:'Synthetic edit conflict'}).waitFor();
  assert.equal(await detail.getByLabel('Notes',{exact:true}).inputValue(),'Draft survives conflict');
  await detail.getByRole('button',{name:'Close Action Plan creative',exact:true}).click();
  // A valid-looking row with wrong fields must not close the editor or send a remote update.
  const badAck=async(route)=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ad,action})});
  await context.route(/\/rest\/v1\/rpc\/qa_plan_creative$/,badAck);
  await button('Edit details for Edited production').click();await detail.getByLabel('Notes',{exact:true}).fill('Unacknowledged note');
  await detail.getByRole('button',{name:'Save creative',exact:true}).click();
  await detail.getByRole('alert').filter({hasText:'Saved fields could not be verified'}).waitFor();
  assert.equal(control.clickupCalls.filter((call)=>call.operation==='push-creative').length,pushes);
  await context.unroute(/\/rest\/v1\/rpc\/qa_plan_creative$/,badAck);
  await detail.getByRole('button',{name:'Close Action Plan creative',exact:true}).click();

  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`${artifactDir}/production-tasks-${width}.png`});
    await button('Assignments for Edited production').click();await fields.getByLabel('Task assignees custom field',{exact:true}).waitFor();
    assert.equal(await fields.evaluate((el)=>el.scrollWidth<=el.clientWidth && el.getBoundingClientRect().right<=innerWidth),true);
    await page.screenshot({path:`${artifactDir}/production-assignments-${width}.png`});
    await fields.getByRole('button',{name:'Close Action Plan fields',exact:true}).click();
  }
  await button('Repair ClickUp link for Edited production').click();const repair=dialog('Repair ClickUp link');
  await repair.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(control.clickupCalls.filter((call)=>call.operation==='repair-plan-task').length,0);
  await button('Repair ClickUp link for Edited production').click();
  const refreshed=page.waitForResponse((response)=>response.url().includes('/rest/v1/ads?') && response.request().method()==='GET');
  await repair.getByRole('button',{name:'Repair or recreate',exact:true}).click();await repair.waitFor({state:'hidden'});
  assert.equal(control.repairPosts || 0,0);
  await (await refreshed).finished();
  await page.evaluate(()=>new Promise((resolve)=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));

  await button('Remove Edited production from Production').click();const remove=dialog('Remove production task');
  await remove.getByRole('button',{name:'Cancel',exact:true}).click();assert.ok(data.manual_actions.includes(action));
  // Delete is a different operation: local deletion followed by retryable remote deletion.
  await button('Delete creative for Edited production').click();const deletion=dialog('Delete creative');
  await deletion.getByRole('checkbox').check();control.clickupFailure=true;
  await deletion.getByRole('button',{name:'Delete creative',exact:true}).click();
  const remote=dialog('Delete linked ClickUp task');
  await remote.getByRole('alert').filter({hasText:'ClickUp deletion is not confirmed'}).waitFor();assert.ok(ad.deleted_at);
  await remote.getByRole('button',{name:'Close creative deletion',exact:true}).click();control.clickupFailure=false;
  await page.reload({waitUntil:'networkidle'});await tab(page,'Production');
  await page.getByText('Deleted creatives (1)',{exact:true}).click();
  await button('Delete linked ClickUp task for Edited production').click();await remote.getByRole('button',{name:'Delete ClickUp task',exact:true}).click();await remote.waitFor({state:'hidden'});
  assert.equal(control.deleteCalls.length,1);

  await button('Task controls for QA creative').click();
  await button('Remove QA creative from Production').click();await remove.getByRole('button',{name:'Remove task',exact:true}).click();await remove.waitFor({state:'hidden'});
  assert.equal(data.manual_actions.some((row)=>row.id==='ACTION-1'),false);assert.equal(data.ads[0].deleted_at,undefined);
  assert.ok(data.matrix_cells[0].creative_assignments.includes('AD-1'));
  const stamp=new Date().toISOString();data.manual_actions.push({id:'STANDALONE-PROD',product_id:'qa-fixture',live_status:'Untested',updated_at:stamp,payload:{title:'Standalone production'}});emit('manual_actions','INSERT',data.manual_actions.at(-1));
  await button('Task controls for Standalone production').click();
  await button('Rename Standalone production').click();await page.getByLabel('Task name',{exact:true}).fill('Renamed standalone');await button('Save task name').click();
  await button('Rename Renamed standalone').waitFor();
  assert.equal(data.manual_actions.at(-1).payload.title,'Renamed standalone');
  assert.equal(new URL(page.url()).pathname,'/');
  results.push('Production task management: atomic-create receipt recovery across reload, no automatic ClickUp creation, uncertain external creation recovery without duplicate POST, detail/assignment saves and pending sync retry, stale/unverified draft preservation, confirmed remove versus delete, remote deletion recovery, link repair, standalone rename and responsive controls');
};
