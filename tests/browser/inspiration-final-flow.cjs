const assert=require('node:assert/strict');
module.exports=async function testFinalInspiration({page,context,data,control,emit,tab,artifactDir,results}) {
  const product='qa-fixture',stamp=new Date().toISOString();
  const source={id:'FINAL',product_id:product,url:'https://example.test/final',title:'Final source',status:'Classified',created_at:stamp,updated_at:stamp,
    data:{formatName:'Final source',angle:'Energy',persona:'Busy people',notes:'Preserved notes',_sourceProductId:'qa-second',_sourceInsId:'ORIGINAL'}};
  const original={id:'ORIGINAL',product_id:'qa-second',data:{_clickupDocPageUrl:'https://example.test/inherited',_classificationBrief:{why_it_works:'Inherited evidence'}}};
  data.inspirations=[source,original];data.inspiration_queue=[];
  data.user_products.push({...data.user_products[0],product_id:'qa-second'});
  Object.assign(data.ads[0],{format_name:'Final source',clickup_task_id:'QA-LINKED',meta:{_fromInspoId:'FINAL'}});
  let contextReads=0;
  await context.route(/\/rest\/v1\/inspirations\?/,async(route)=>{
    const url=new URL(route.request().url());
    if(url.searchParams.get('product_id')==='eq.qa-second'){contextReads++;assert.equal(url.searchParams.get('select'),'*');}
    await route.fallback();
  });
  await page.reload({waitUntil:'networkidle'});await tab(page,'Inspiration');
  const button=(name)=>page.getByRole('button',{name,exact:true});
  await button('Open inspiration FINAL').click();const drawer=page.getByRole('dialog',{name:'Final source',exact:true});
  await drawer.getByRole('link',{name:'Brief',exact:true}).waitFor();
  assert.equal(await drawer.getByRole('link',{name:'Brief',exact:true}).getAttribute('href'),'https://example.test/inherited');
  await drawer.getByText('why it works',{exact:true}).click();await drawer.getByText('Inherited evidence',{exact:true}).waitFor();
  data.inspirations=data.inspirations.filter((row)=>row!==original);emit('inspirations','DELETE',{id:'ORIGINAL'});
  await drawer.getByRole('link',{name:'Brief',exact:true}).waitFor({state:'hidden'});
  await drawer.getByRole('heading',{name:'Stored classification brief',exact:true}).waitFor({state:'hidden'});
  assert.ok(contextReads>0);assert.equal(control.inspirationCalls?.length || 0,0);
  await page.evaluate(()=>sessionStorage.setItem('immuvi:qa:entgcnlfsnysnwyadzzp:clickup:11111111-1111-4111-8111-111111111111','synthetic-clickup-key'));
  await button('Edit').click();let editor=page.getByRole('dialog',{name:'Edit inspiration: Final source',exact:true});
  await editor.getByRole('textbox',{name:'Format name',exact:true}).fill('Verified rename');control.corruptInspirationFieldAck='formatName';
  await editor.getByRole('button',{name:'Save inspiration',exact:true}).click();
  await editor.getByRole('alert').filter({hasText:'Saved fields could not be verified'}).waitFor();
  assert.equal(source.data.formatName,'Verified rename');assert.equal(control.clickupCalls.length,0,'An inconsistent save receipt must not push linked tasks');
  assert.equal(await editor.getByRole('textbox',{name:'Format name',exact:true}).isDisabled(),true);
  for(const width of [320,1440]) {
    await page.setViewportSize({width,height:900});
    assert.equal(await editor.evaluate((el)=>el.scrollWidth<=el.clientWidth && el.getBoundingClientRect().right<=innerWidth),true);
    await editor.getByRole('alert').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${artifactDir}/inspiration-final-uncertain-${width}.png`});
    const retry=editor.getByRole('button',{name:'Retry same save',exact:true});
    await retry.scrollIntoViewIfNeeded();
    assert.equal(await retry.evaluate((el)=>{const r=el.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight;}),true);
    await page.screenshot({path:`${artifactDir}/inspiration-final-retry-${width}.png`});
  }
  await editor.getByRole('button',{name:'Retry same save',exact:true}).click();await editor.waitFor({state:'hidden'});
  assert.deepEqual(control.inspirationCalls[0],control.inspirationCalls[1]);assert.equal(control.clickupCalls.filter((call)=>call.operation==='push-creative').length,1);
  assert.equal(source.data.notes,'Preserved notes');
  await page.keyboard.press('Escape');await page.reload({waitUntil:'networkidle'});await tab(page,'Inspiration');
  await button('Open inspiration FINAL').click();await page.getByRole('dialog',{name:'Verified rename',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Brief',exact:true}).count(),0);
  assert.equal(new URL(page.url()).pathname,'/');
  results.push('Final Inspiration acceptance: inherited brief disappears when its source is deleted, complete source snapshot read contract, inconsistent ordinary-save receipt preserves draft/retry and blocks remote push, exact-request recovery pushes only after verified acknowledgement, reload persistence and 320/1440px uncertain editor bounds');
};
