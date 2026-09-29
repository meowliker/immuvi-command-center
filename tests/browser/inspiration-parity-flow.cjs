const inspirationOption=require('./inspiration-options.cjs');
const assert=require('node:assert/strict');
module.exports=async function testParity({page,context,data,control,emit,tab,artifactDir,results}){
  const product='qa-fixture',stamp=new Date().toISOString(),url='https://app.clickup.com/123/v/dc/doc/page';
  const source={id:'PARITY',product_id:product,url:'https://example.test/source',title:'Parity source',status:'Classified',created_at:stamp,updated_at:stamp,
    data:{formatName:'Parity source',duration_seconds:15,creativeUSP:'Parity source \u2014 Original detail',importTags:['Imported','From: Test'],
      creativeHypothesis:'Test hypothesis',notes:'Test notes',bodyCopy:'Visible copy<br>Second line',voiceOver:'Audio present; exact transcript not verified',
      _sourceClickupId:'QA-SOURCE',_classificationBrief:{why_it_works:'<img src=x onerror=alert(1)> is literal',frame_by_frame:[{time:'0:00-0:03',label:'Hook',caption_voice_over:'Visible caption',what_happens:'Demonstration'}],
        next_ad_scripts:[{variation:'Reference variation',source_format_match:'Original rhythm',voice_over_script:'No voice over',script_breakdown:[{time:'0:00-0:03',caption_voice_over:'Our caption',visual_beat:'Our visual'}]}]}}};
  data.inspirations=[source,{id:'COPY',product_id:'qa-second',data:{_sourceProductId:product,_sourceInsId:'PARITY'}}];data.inspiration_queue=[];
  data.ads[0].meta._fromInspoId='PARITY';
  await tab(page,'Inspiration');await inspirationOption(page,'Expand inspiration columns');await page.getByRole('button',{name:'Reuse for PARITY',exact:true}).filter({hasText:'1 products'}).waitFor();
  data.user_products.push({...data.user_products[0],product_id:'qa-second'});
  await page.reload();await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();await tab(page,'Inspiration');
  await inspirationOption(page,'Expand inspiration columns');
  await page.getByRole('button',{name:'Reuse for PARITY',exact:true}).filter({hasText:'2 products'}).waitFor();
  for(const heading of ['Hypothesis','Notes','Ad Copy','Duration','Tags','Reuse','Actions'])await page.getByRole('columnheader',{name:heading,exact:true}).waitFor();
  const row=page.locator('[data-inspiration-id="PARITY"]');assert.equal(await row.getByText('15s',{exact:true}).count(),1);
  assert.equal(await row.getByRole('button',{name:'Edit inspiration PARITY',exact:true}).count(),0);
  const sourceLink=row.getByRole('link',{name:'Source for PARITY',exact:true});
  assert.equal(await sourceLink.evaluate(el=>getComputedStyle(el).color),'rgb(107, 114, 128)');
  assert.equal(await sourceLink.getAttribute('href'),source.url);
  await page.getByRole('button',{name:'Open inspiration PARITY',exact:true}).click();const drawer=page.getByRole('dialog',{name:'Parity source',exact:true});
  await drawer.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('dialog',{name:'Edit inspiration: Parity source',exact:true}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await drawer.getByText('2 products / 1 local creatives',{exact:true}).waitFor();assert.equal(await drawer.getByRole('heading',{name:'Voice Over',exact:true}).count(),0);
  await drawer.getByRole('heading',{name:'Stored classification brief',exact:true}).waitFor();await drawer.getByText('why it works',{exact:true}).click();
  await drawer.getByText('<img src=x onerror=alert(1)> is literal',{exact:true}).waitFor();assert.equal(await drawer.locator('img').count(),0);
  await drawer.getByText('Reference variation',{exact:true}).click();await drawer.getByText('Original rhythm',{exact:true}).waitFor();
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});await drawer.locator('aside').evaluate(async(el)=>{await Promise.all(el.getAnimations().map((a)=>a.finished));});assert.equal(await drawer.locator('aside').evaluate((el)=>el.getBoundingClientRect().left>=0 && el.getBoundingClientRect().right<=innerWidth && el.scrollWidth<=el.clientWidth),true);assert.equal(await drawer.locator('section').evaluateAll((sections)=>sections.every((el)=>el.getBoundingClientRect().right<=innerWidth && el.scrollWidth<=el.clientWidth)),true,'Drawer sections must fit; only breakdown tables may scroll horizontally');await page.screenshot({path:`${artifactDir}/inspiration-parity-${width}.png`});}
  data.inspirations=data.inspirations.filter((item)=>item.id!=='COPY');emit('inspirations','DELETE',{id:'COPY'});await drawer.getByText('1 products / 1 local creatives',{exact:true}).waitFor();
  await drawer.getByRole('button',{name:'Fetch and save brief',exact:true}).click();await drawer.getByRole('alert').filter({hasText:'Enter a ClickUp key'}).waitFor();assert.equal(control.clickupCalls.length,0);
  await page.evaluate(()=>sessionStorage.setItem('immuvi:qa:entgcnlfsnysnwyadzzp:clickup:11111111-1111-4111-8111-111111111111','synthetic-clickup-key'));
  control.briefUrl='https://evil.test/not-a-brief';await drawer.getByRole('button',{name:'Fetch and save brief',exact:true}).click();await drawer.getByRole('alert').filter({hasText:'could not be verified'}).waitFor();assert.equal(control.briefCalls?.length||0,0);
  control.briefUrl=url;control.loseBriefAck=true;await drawer.getByRole('button',{name:'Fetch and save brief',exact:true}).click();await drawer.getByRole('button',{name:'Retry same brief save',exact:true}).waitFor();
  await drawer.getByRole('button',{name:'Retry same brief save',exact:true}).click();await drawer.getByRole('heading',{name:'Remote brief',exact:true}).waitFor({state:'hidden'});
  assert.deepEqual(control.briefCalls[0],control.briefCalls[1]);assert.equal(source.data._clickupDocPageUrl,url);assert.equal(source.data.notes,'Test notes');await drawer.getByRole('link',{name:'Brief',exact:true}).waitFor();
  assert.equal(await drawer.getByRole('link',{name:'Brief',exact:true}).getAttribute('href'),url);
  await page.keyboard.press('Escape');await page.reload();await page.getByRole('button',{name:'Sign out',exact:true}).waitFor();await tab(page,'Inspiration');await page.getByRole('link',{name:'Brief for PARITY',exact:true}).waitFor();
  assert.equal(control.clickupCalls.length,2);assert.equal(new URL(page.url()).pathname,'/');
  results.push('Inspiration parity: restored fields/tags/duration, direct edit entry, distinct accessible-product reuse with deletion refresh, literal stored brief and script tables, audio-placeholder suppression, 320/390/768/1440px drawer bounds, missing-key/unsafe-link denial, lost-ack same-receipt brief save and reload persistence; no real external calls');
};
