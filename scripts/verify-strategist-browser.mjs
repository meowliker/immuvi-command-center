import {readFile,mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const modulePath=process.argv.find(a=>a.startsWith('--playwright='))?.slice(13)||'playwright';
const {chromium}=await import(modulePath);
const base='http://127.0.0.1:8099';
const directory='backups/strategist-verification';
const fixture=async name=>JSON.parse(await readFile(`${directory}/${name}.json`,'utf8'));
const session=await fixture('session');
const detail=await fixture('detail');
const browser=await chromium.launch({channel:'chrome',headless:true});
const failures=[];
const report=[];
try{
  const context=await browser.newContext();
  await context.addInitScript(()=>localStorage.setItem('immuvi-auth',JSON.stringify({access_token:'local-ui-verification',refresh_token:'unused',token_type:'bearer',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'00000000-0000-4000-8000-000000000001',aud:'authenticated'}})));
  let queued=[];
  await context.route('**/api/strategist?**',async route=>{
    const request=route.request(),url=new URL(request.url()),op=url.searchParams.get('op'),product=url.searchParams.get('product')||'all';
    let data,status=200;
    if(op==='config')data={url:'https://local-verification.supabase.co',anonKey:'public-test-key'};
    else if(op==='session')data=session;
    else if(op==='snapshot')data=await fixture(`snapshot-${product}`);
    else if(op==='creative')data={...detail,id:url.searchParams.get('id')};
    else if(op==='research')data=await fixture(`research-${product==='all'?'ad':product}`);
    else if(op==='hooks')data=await fixture(`hooks-${product==='all'?'ad':product}`);
    else if(op==='jobs'&&request.method()==='POST'){
      const body=request.postDataJSON();assert.ok(body.requestId);assert.ok(body.kind);queued.push({id:body.requestId,kind:body.kind,product_key:body.product,status:'queued',log:[],created_at:new Date().toISOString(),error:null,cancel_requested:false});data=queued.at(-1);
    }else if(op==='jobs')data={jobs:queued,pending:{toWatch:0,toEnrich:0}};
    else if(op==='cancel'){queued=queued.map(j=>({...j,status:'cancelled'}));data={requested:true};}
    else{status=404;data={error:'Unknown fixture'};}
    await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  });
  // The imported media URLs are verified separately; the UI check does not depend on a Drive login.
  await context.route('https://drive.google.com/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><html><body style="margin:0;background:#edf1f5;display:grid;place-content:center;height:100vh;font:14px system-ui">Drive media preview</body></html>'}));
  const page=await context.newPage();
  page.on('pageerror',e=>failures.push(e.message));
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(`${base}/strategist.html`);
  await page.getByRole('heading',{name:'Creative intelligence'}).waitFor();
  await page.getByText('Product coverage',{exact:true}).waitFor();
  await page.screenshot({path:`${directory}/desktop-overview.png`,fullPage:true});
  for(const p of ['hh','ad','ca','ig','km','kl']){
    await page.getByRole('combobox',{name:'Product',exact:true}).selectOption(p);
    await page.getByText('Product coverage',{exact:true}).waitFor();
    await page.waitForFunction(()=>!document.querySelector('.loading-state'));
    const rows=await page.locator('.coverage-row:not(.coverage-labels)').count();
    assert.equal(rows,1,`Product coverage ${p}`);
  }
  await page.getByRole('combobox',{name:'Product',exact:true}).selectOption('ad');
  for(const view of ['Creatives','Formats','Keywords','Verification','Research','Hooks']){
    await page.getByRole('navigation').getByRole('button',{name:view,exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.loading-state'));
    assert.ok(await page.locator('.view-content').innerText(),`${view} is empty`);
    assert.equal(await page.locator('.error-banner').count(),0,`${view} error`);
    if(view==='Research'){
      const contrasts=await page.locator('.sy-top-l,.sy-top-v').evaluateAll(nodes=>{
        const rgb=value=>(value.match(/[\d.]+/g)||[]).map(Number);
        const luminance=channels=>channels.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
        return nodes.map(node=>{
          let ancestor=node,background;
          while(ancestor){background=rgb(getComputedStyle(ancestor).backgroundColor);if(background.length===3||background[3]===1)break;ancestor=ancestor.parentElement;}
          const foreground=luminance(rgb(getComputedStyle(node).color)),back=luminance(background||[255,255,255]);
          return (Math.max(foreground,back)+.05)/(Math.min(foreground,back)+.05);
        });
      });
      assert.ok(contrasts.length>0&&contrasts.every(value=>value>=4.5),'Research summary must have readable contrast');
    }
    await page.screenshot({path:`${directory}/desktop-${view.toLowerCase()}.png`,fullPage:false});
    report.push(`Desktop ${view} renders`);
  }
  await page.getByRole('navigation').getByRole('button',{name:'Creatives',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.loading-state'));
  await page.locator('.t-row[role=button]').first().click();
  await page.locator('.mdl-ttl').filter({hasText:detail.filename}).waitFor();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#modal .mdl')).opacity==='1');
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await page.getByRole('button',{name:'Transcript',exact:true}).click();
  await page.locator('.mdl-tab.on').filter({hasText:'Transcript'}).waitFor();
  await page.screenshot({path:`${directory}/desktop-detail.png`});
  const scroller=page.locator('.mdl-body');
  await scroller.evaluate(node=>{node.scrollTop=node.scrollHeight});
  const dimensions=await scroller.evaluate(node=>({height:node.clientHeight,scroll:node.scrollHeight,top:node.scrollTop}));
  if(dimensions.scroll>dimensions.height)assert.ok(dimensions.top>0,'Modal must scroll');
  await page.keyboard.press('Escape');
  assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
  await page.getByRole('button',{name:'Sync ClickUp',exact:true}).click();
  await page.getByText('queued',{exact:true}).waitFor();
  assert.equal(queued[0].product_key,'ad');
  await page.getByRole('button',{name:'Cancel job',exact:true}).click();
  await page.getByText('cancelled',{exact:true}).waitFor();
  report.push('Product selection, creative detail, transcript, modal scroll, Escape, queue and cancel interactions pass');
  await page.setViewportSize({width:390,height:844});
  for(const view of ['Overview','Creatives','Formats','Keywords','Verification','Research','Hooks']){
    await page.getByRole('navigation').getByRole('button',{name:view,exact:true}).click();
    await page.waitForFunction(()=>!document.querySelector('.loading-state'));
    const width=await page.evaluate(()=>({doc:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(width.doc<=width.viewport+1,`Mobile overflow in ${view}: ${JSON.stringify(width)}`);
    await page.screenshot({path:`${directory}/mobile-${view.toLowerCase()}.png`,fullPage:false});
  }
  report.push('All seven views fit a 390px mobile viewport');
  await page.getByRole('navigation').getByRole('button',{name:'Creatives',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.loading-state'));
  await page.locator('.t-row[role=button]').first().click();
  await page.locator('.mdl-ttl').filter({hasText:detail.filename}).waitFor();
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#modal .mdl')).opacity==='1');
  const modalBounds=await page.locator('.mdl').boundingBox();
  assert.ok(modalBounds.x>=0&&modalBounds.y>=0&&modalBounds.x+modalBounds.width<=390&&modalBounds.y+modalBounds.height<=844,'Mobile dialog must fit the viewport');
  await page.screenshot({path:`${directory}/mobile-detail.png`});
  assert.equal(failures.length,0,failures.join('\n'));
  report.push('No browser runtime errors');
  await writeFile(`${directory}/browser-report.json`,JSON.stringify({basis:'API fixtures captured from live, permission-checked imported data; queue actions mocked',checks:report},null,2));
  console.log(report.join('\n'));
}finally{await browser.close();}
