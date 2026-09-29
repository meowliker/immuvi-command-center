const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const postcss=require('postcss');

async function reference(context,baseUrl,artifactDir) {
  const html=fs.readFileSync('immuvi-command-center.html','utf8');
  const script=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m)=>m[1]).find((s)=>s.includes('function renderProduction()'));
  const source=ts.createSourceFile('legacy.js',script,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const names=['renderProduction','_productionItemFromManualAction'];
  const functions=names.map((name)=>source.statements.find((s)=>ts.isFunctionDeclaration(s) && s.name?.text===name).getText(source)).join('\n');
  const formats=source.statements.filter(ts.isVariableStatement).flatMap((s)=>[...s.declarationList.declarations]).find((d)=>d.name.getText(source)==='SD_FORMATS').initializer.getText(source);
  const nodes=Object.fromEntries(['prodQueueBody','prodProgressBody','prodDoneBody','prodQueueCount','prodProgressCount','prodDoneCount'].map((id)=>[id,{}]));
  const action={id:'reference',title:'QA creative',angle:'Energy',persona:'Busy people',format:'Teacher Angle',funnelStage:'TOF',dueDate:'2026-12-15',tag:'ai-recommended'};
  // Run only these audited render functions, with inert DOM and no legacy startup or service code.
  const sandbox={document:{getElementById:(id)=>nodes[id]},MANUAL_ACTIONS:[action],apResolveCard:()=>({display:action}),rebuildProdFromManual:()=>{},esc:String,escAttr:String};
  vm.runInNewContext(`${functions}\nrenderProduction();formats=${formats};`,sandbox,{timeout:1000});
  const css=postcss.parse([...html.split('</head>')[0].matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m)=>m[1]).join('\n'));
  css.walkAtRules('import',(rule)=>rule.remove());
  const fonts=[...fs.readFileSync('app/globals.css','utf8').matchAll(/@font-face\s*\{[^}]+\}/g)].map((m)=>m[0]).join('\n');
  const ref=await context.newPage();
  await ref.setContent(`<base href="${baseUrl}/"><style>${css}\n${fonts}</style><section class="panel on"><div class="prod-kanban">${['Queue','Progress','Done'].map((key)=>`<div class="prod-col"><div class="prod-col-hdr"><span class="prod-col-title">${key}</span><span class="prod-col-count">${nodes[`prod${key}Count`].textContent}</span></div><div class="prod-col-body">${nodes[`prod${key}Body`].innerHTML}</div></div>`).join('')}</div></section>`);
  await ref.evaluate(()=>document.fonts.ready);
  const metrics=await ref.evaluate(()=>{
    const style=(selector)=>getComputedStyle(document.querySelector(selector));
    return {gap:style('.prod-kanban').gap,padding:style('.prod-card').padding,titleFont:style('.prod-card-name').fontSize,titleWeight:style('.prod-card-name').fontWeight,
      cardBackground:style('.prod-card').backgroundColor,columnBackground:style('.prod-col').backgroundColor,borderLeft:style('.prod-card').borderLeftWidth,headerFont:style('.prod-col-title').fontSize};
  });
  await ref.screenshot({path:`${artifactDir}/production-legacy-reference.png`});await ref.close();return {metrics,formats:JSON.parse(JSON.stringify(sandbox.formats))};
}

module.exports=async function testProductionFinal({page,context,data,control,emit,tab,artifactDir,results}) {
  const legacy=await reference(context,new URL(page.url()).origin,artifactDir);
  const ad=data.ads[0],action=data.manual_actions[0];
  action.payload.format='Teacher Angle';action.payload.tag='ai-recommended';ad.meta.dueDate='2026-12-15';
  const stamp=action.updated_at;
  data.manual_actions.push({id:'FINAL-OTHER',product_id:'qa-second',live_status:'Untested',payload:{title:'Other product task'},updated_at:stamp});
  const button=(name)=>page.getByRole('button',{name,exact:true});
  const card=page.locator('[data-production-task="ACTION-1"]');
  await tab(page,'Production');await card.waitFor();
  await page.evaluate(()=>document.fonts.ready);
  const metrics=await card.evaluate((el)=>{
    const style=(node)=>getComputedStyle(node),column=el.closest('[data-production-column]');
    return {gap:style(column.parentElement).gap,padding:style(el).padding,titleFont:style(el.querySelector('strong')).fontSize,titleWeight:style(el.querySelector('strong')).fontWeight,
      cardBackground:style(el).backgroundColor,columnBackground:style(column).backgroundColor,borderLeft:style(el).borderLeftWidth,headerFont:style(column.querySelector('header strong')).fontSize};
  });
  assert.deepEqual(metrics,legacy.metrics);
  await card.locator('span').filter({hasText:/^Teacher Angle$/}).waitFor();await card.getByText('TOF',{exact:true}).waitFor();await card.getByText('AI Rec',{exact:true}).waitFor();
  assert.ok((await card.boundingBox()).height<180,'Idle cards should remain compact');
  assert.equal(await card.getByLabel('Status for QA creative').isVisible(),false);
  await button('Task controls for QA creative').focus();await page.keyboard.press('Enter');
  assert.equal(await button('Task controls for QA creative').getAttribute('aria-expanded'),'true');
  await button('Edit due date for QA creative').click();
  const due=page.getByRole('dialog',{name:'Due date: QA creative',exact:true});
  for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.equal(await due.evaluate((el)=>el.contains(document.activeElement)),true);}
  await due.getByRole('button',{name:'Close editor',exact:true}).focus();await page.keyboard.press('Shift+Tab');
  assert.equal(await due.getByRole('button',{name:'Cancel',exact:true}).evaluate((el)=>el===document.activeElement),true);
  await page.keyboard.press('Escape');await due.waitFor({state:'hidden'});
  assert.equal(await button('Edit due date for QA creative').evaluate((el)=>el===document.activeElement),true);

  await page.getByLabel('Format for QA creative',{exact:true}).selectOption('UGC Format');
  await page.getByRole('status').filter({hasText:'Task saved in QA.'}).waitFor();assert.equal(action.payload.format,'UGC Format');assert.equal(ad.ad_type,'Video');
  assert.equal(control.clickupCalls.length,0);
  await page.reload({waitUntil:'networkidle'});await tab(page,'Production');await card.locator('span').filter({hasText:/^UGC Format$/}).waitFor();
  await button('Task controls for QA creative').click();
  let calls=0;
  const reject=async(route)=>{calls++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({action:{...action,payload:{...action.payload,format:'wrong'}},ad})});};
  await context.route(/\/rest\/v1\/rpc\/qa_production_format$/,reject);
  await page.getByLabel('Format for QA creative',{exact:true}).selectOption('AI Style');
  await page.getByRole('alert').filter({hasText:'Saved fields could not be verified'}).waitFor();assert.equal(action.payload.format,'UGC Format');
  assert.equal(await page.getByLabel('Format for QA creative',{exact:true}).inputValue(),'UGC Format');assert.equal(calls,1);
  await context.unroute(/\/rest\/v1\/rpc\/qa_production_format$/,reject);
  await page.getByLabel('Format for QA creative',{exact:true}).selectOption('');
  await card.getByText('Video',{exact:true}).waitFor();assert.equal(action.payload.format,'');

  let fail=true;
  const failForm=async(route)=>fail?route.fulfill({status:200,contentType:'application/json',body:'null'}):route.fallback();
  await context.route(/\/rest\/v1\/angles\?/,failForm);await button('Add production task').click();
  const create=page.getByRole('dialog',{name:'Add production task',exact:true});
  await create.getByRole('alert').filter({hasText:'Incomplete angles response'}).waitFor();
  assert.equal(await create.getByRole('button',{name:'Create task',exact:true}).isDisabled(),true);
  fail=false;await create.getByRole('button',{name:'Retry loading form',exact:true}).click();await create.getByLabel('Task name',{exact:true}).fill('Keyboard cancel');
  assert.deepEqual((await create.getByLabel('Format',{exact:true}).locator('option').allTextContents()).slice(1),legacy.formats);
  await page.keyboard.press('Escape');await create.waitFor({state:'hidden'});assert.equal(control.productionCalls?.length || 0,0);
  await context.unroute(/\/rest\/v1\/angles\?/,failForm);

  action.payload.format='Teacher Angle';ad.format_name='A very long production task title '.repeat(8).trim();ad.updated_at=new Date().toISOString();emit('ads','UPDATE',ad);emit('manual_actions','UPDATE',action);
  await card.getByText(ad.format_name.trim(),{exact:true}).waitFor();
  const toggle=card.getByRole('button',{name:`Task controls for ${ad.format_name}`,exact:true});
  if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
  for(const width of [320,390,768,1440,1920]) {
    await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.equal(await card.evaluate((el)=>el.scrollWidth<=el.clientWidth),true);
    await page.screenshot({path:`${artifactDir}/production-final-${width}.png`});
    await toggle.click();assert.equal(await card.evaluate((el)=>el.scrollWidth<=el.clientWidth),true);
    const boxes=await card.locator('button,select,a').evaluateAll((nodes)=>nodes.filter((el)=>el.getClientRects().length).map((el)=>el.getBoundingClientRect().toJSON()));
    for(const b of boxes)assert.ok(b.left>=0 && b.right<=width,'Control outside viewport');
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const a=boxes[i],b=boxes[j];assert.ok(Math.min(a.right,b.right)-Math.max(a.left,b.left)<1 || Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)<1,'Controls overlap');
    }
    await page.screenshot({path:`${artifactDir}/production-final-controls-${width}.png`});await toggle.click();
  }
  await toggle.click();
  let release,held;
  const waiting=new Promise((resolve)=>held=resolve);
  const hold=async(route)=>{held();await new Promise((resolve)=>release=resolve);await route.fallback();};
  await context.route(/\/rest\/v1\/rpc\/qa_production_format$/,hold);
  await card.getByRole('combobox',{name:`Format for ${ad.format_name}`,exact:true}).selectOption('AI Style');await waiting;
  assert.equal(await card.getByRole('combobox',{name:`Status for ${ad.format_name}`,exact:true}).isDisabled(),true);
  await page.locator('main > section').first().locator('select').selectOption('qa-second');
  await page.locator('[data-production-task="FINAL-OTHER"]').waitFor();release();
  await page.waitForResponse((response)=>response.url().includes('/rpc/qa_production_format'));
  assert.equal(await card.count(),0);assert.equal(await page.locator('[data-production-task="FINAL-OTHER"]').count(),1);
  assert.equal(new URL(page.url()).pathname,'/');
  results.push('Final Production acceptance: audited legacy CSS metrics, restored format/funnel/AI tags, compact cards and responsive controls, keyboard disclosure/modal focus, persisted format versus ad type, unverified receipt rejection, failed-form retry, cancel without writes, long titles, busy guards and late-save product isolation');
};
