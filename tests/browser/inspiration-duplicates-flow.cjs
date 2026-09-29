const assert=require('node:assert/strict');
module.exports=async function testDuplicates({page,data,control,emit,tab,artifactDir,results}) {
  const product='qa-fixture',stamp=new Date().toISOString();
  const source={id:'AUTO-DUP',product_id:product,url:'https://example.test/duplicates',title:'Automatic duplicate source',status:'Classified',created_at:stamp,updated_at:stamp,
    data:{formatName:'Automatic duplicate source',angle:'Energy tools',persona:'Busy parents',funnelStage:'TOF',hookType:'Question',creativeStructure:'Testimonial',_dupeType:'old',_dupeDetail:'Obsolete warning',_dupeBannerDismissed:true}};
  const creative=(id,patch={})=>({id,product_id:product,format_name:`Creative ${id}`,status:'Testing',angle:'Energy tools',persona:'Busy parents',funnel_stage:'TOF',created_at:stamp,updated_at:stamp,meta:{hookType:'Question',creativeStructure:'Testimonial'},...patch});
  data.inspirations=[source];data.inspiration_queue=[];data.deleted_ads=[];
  data.angles=[{id:'CURRENT-AUTO',product_id:product,name:'Energy tools',created_at:stamp,updated_at:stamp},{id:'PREFERRED-AUTO',product_id:product,name:'Energy tool',created_at:stamp,updated_at:stamp}];
  data.ads=[creative('EXACT'),creative('COMBO',{angle:'Energy tool',status:'Winner',funnel_stage:'MOF'}),creative('FORMAT',{persona:'Other',funnel_stage:'BOF'}),creative('FOREIGN',{product_id:'qa-second'}),creative('DELETED',{deleted_at:stamp}),creative('QUARANTINED',{meta:{_productBoundaryQuarantined:true}})];
  const button=(name)=>page.getByRole('button',{name,exact:true});
  await tab(page,'Inspiration');await button('Suggested angle Energy tool for AUTO-DUP').click();
  let mapping=page.getByRole('dialog',{name:'Map Angle: Automatic duplicate source',exact:true});
  assert.equal(await mapping.getByRole('combobox',{name:'Existing Angle',exact:true}).inputValue(),'PREFERRED-AUTO');
  await mapping.getByRole('button',{name:'Cancel',exact:true}).click();
  data.ads[0].status='Winner';data.ads[1].status='Loser';emit('ads','UPDATE',data.ads[0]);emit('ads','UPDATE',data.ads[1]);
  await button('Suggested angle Energy tool for AUTO-DUP').waitFor({state:'hidden'});
  assert.equal(control.inspirationCalls?.length || 0,0);
  await button('Duplicate review for AUTO-DUP').click();
  const drawer=page.getByRole('dialog',{name:'Automatic duplicate source',exact:true});
  await drawer.getByText(/Exact match - same angle/).waitFor();
  assert.equal(await drawer.getByText('Obsolete warning',{exact:true}).count(),0);
  for(const id of ['EXACT','COMBO','FORMAT'])await drawer.getByRole('button',{name:`View related creative ${id}`,exact:true}).waitFor();
  for(const id of ['FOREIGN','DELETED','QUARANTINED'])assert.equal(await drawer.getByRole('button',{name:`View related creative ${id}`,exact:true}).count(),0);
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:900});await drawer.locator('aside').evaluate(async(el)=>{await Promise.all(el.getAnimations().map((animation)=>animation.finished));});
    const related=drawer.locator('section').filter({has:page.getByRole('heading',{name:'Similar creatives',exact:true})});await related.scrollIntoViewIfNeeded();
    assert.equal(await related.evaluate((el)=>el.getBoundingClientRect().right<=innerWidth && el.scrollWidth<=el.clientWidth),true);
    await page.screenshot({path:`${artifactDir}/inspiration-auto-duplicates-${width}.png`});
  }
  await button('Review duplicate').click();let review=page.getByRole('dialog',{name:'Mark duplicate reviewed',exact:true});await review.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(control.inspirationCalls?.length || 0,0);
  await button('Review duplicate').click();control.loseInspirationAck=true;await review.getByRole('button',{name:'Mark duplicate reviewed',exact:true}).click();await review.getByRole('button',{name:'Retry same request',exact:true}).click();await review.waitFor({state:'hidden'});await button('Reviewed').waitFor();
  assert.deepEqual(control.inspirationCalls[0],control.inspirationCalls[1]);assert.equal(source.data._dupeDetail,'Obsolete warning');
  await page.reload({waitUntil:'networkidle'});await tab(page,'Inspiration');await button('Open inspiration AUTO-DUP').click();await button('Reviewed').waitFor();
  data.ads[0].format_name='Renamed live creative';emit('ads','UPDATE',data.ads[0]);await drawer.getByText('Renamed live creative',{exact:true}).waitFor();await button('Review duplicate').waitFor();
  await button('Review duplicate').click();
  data.ads.push(creative('NEW'));emit('ads','INSERT',data.ads.at(-1));
  await drawer.getByRole('button',{name:'View related creative NEW',exact:true}).waitFor();
  await review.getByRole('button',{name:'Mark duplicate reviewed',exact:true}).click();await review.waitFor({state:'hidden'});
  assert.equal(await button('Review duplicate').isEnabled(),true,'A stale review must not hide new evidence');
  await button('Review duplicate').click();await review.getByRole('button',{name:'Mark duplicate reviewed',exact:true}).click();await review.waitFor({state:'hidden'});await button('Reviewed').waitFor();
  const writes=control.inspirationCalls.length;
  source.data.angle='';source.data.persona='';emit('inspirations','UPDATE',source);
  await drawer.getByRole('heading',{name:'Similar creatives',exact:true}).waitFor({state:'hidden'});assert.equal(await button('Review duplicate').isDisabled(),true);
  source.data.angle='Energy tools';source.data.persona='Busy parents';source.status='Blocked';emit('inspirations','UPDATE',source);
  await drawer.getByText('Blocked',{exact:true}).waitFor();assert.equal(await drawer.getByRole('heading',{name:'Similar creatives',exact:true}).count(),0);
  source.status='Classified';emit('inspirations','UPDATE',source);await drawer.getByRole('heading',{name:'Similar creatives',exact:true}).waitFor();
  for(const ad of data.ads.filter((ad)=>['EXACT','COMBO','FORMAT','NEW'].includes(ad.id))){data.deleted_ads.push({id:ad.id,product_id:product});emit('deleted_ads','INSERT',data.deleted_ads.at(-1));}
  await drawer.getByRole('heading',{name:'Similar creatives',exact:true}).waitFor({state:'hidden'});
  assert.equal(control.inspirationCalls.length,writes);assert.equal(control.clickupCalls.length,0);assert.equal(new URL(page.url()).pathname,'/');
  results.push('Automatic Inspiration duplicates and ranking: live preferred-target performance, exact/combo/format matches, lifecycle/product exclusions, 320/390/768/1440px bounds, review cancel/lost-ack replay/reload, new evidence during review stays unreviewed, field clearing/blocked queue/tombstone refresh without writes; no external calls');
};
