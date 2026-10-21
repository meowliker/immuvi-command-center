import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.IMMUVI_PLAYWRIGHT_MODULE||'playwright');
const source=readFileSync(new URL('../../immuvi-command-center.html',import.meta.url),'utf8');
const css=[...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const module=readFileSync(new URL('../../public/personal-worker-client.mjs',import.meta.url));
const preferences=readFileSync(new URL('../../public/personal-worker-preference.mjs',import.meta.url));
const picker=source.slice(source.indexOf('  var _insRunOnPickerGeneration = 0;'),source.indexOf('  // Hook addToInsQueue to apply the worker_assignment'));
const wrapper=source.slice(source.indexOf('  // Hook addToInsQueue to apply the worker_assignment'),source.indexOf('  setTimeout(_insInjectRunOnPicker, 800);'));
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',requests=[];
let offline=false,unavailable=false,reviewPending=true;
const revoked=new Set();
const server=createServer(async(req,res)=>{
  if(req.url==='/personal-worker-client.mjs'){res.setHeader('Content-Type','text/javascript');return res.end(module);}
  if(req.url==='/personal-worker-preference.mjs'){res.setHeader('Content-Type','text/javascript');return res.end(preferences);}
  if(req.url==='/api/personal-worker'){
    let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text);requests.push(body);
    res.setHeader('Content-Type','application/json');
    if(body.op==='list'){
      if(unavailable){res.statusCode=503;return res.end(JSON.stringify({error:'Fixture service unavailable'}));}
      const id=req.headers['x-clickup-key']==='owner-a'?a:b;
      return res.end(JSON.stringify({devices:revoked.has(id)?[]:[{id,
        name:req.headers['x-clickup-key']==='owner-a'?'Owner A private Mac':'Owner B private Mac',paired:true,
        lastSeen:new Date(Date.now()-(offline?600000:0)).toISOString(),
        capacity:3,runtime:{version:'personal-runtime-v1',ready:id===b,codes:id===a?['FFMPEG_UNAVAILABLE']:[]},
        attention:[...(reviewPending?[{id:a,insId:'TEST-INS-REVIEW',state:'review',code:'BRIEF_READBACK_MISMATCH'}]:[]),
          {id:b,insId:'TEST-INS-LOCAL',state:'blocked',code:'LOCAL_TOOL_UNAVAILABLE',diagnostic:'FFPROBE_UNAVAILABLE'}]}]}));
    }
    if(body.op==='create')return res.end(JSON.stringify({pairingCode:a+'.'+'x'.repeat(43)}));
    if(body.op==='revoke')revoked.add(body.deviceId);
    if(body.op==='verify')reviewPending=false;
    return res.end(JSON.stringify({ok:true,count:body.items?.length||0}));
  }
  res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>
  <button id="open" onclick="_openPersonalWorkerDialog()">My Mac</button><select id="insRunOnSelect"><option value="auto">Auto</option></select><button id="add" onclick="addToInsQueue()">Add</button>
  <script>window.CFG={key:new URLSearchParams(location.search).get('owner')||'owner-a'};window.AUTH={user:{id:new URLSearchParams(location.search).get('account')||'shared-account'}};
  if(new URLSearchParams(location.search).has('late')){CFG.key='';AUTH.user=null;}
  window.registryReads=0;
  window.SB={auth:{getSession:async()=>({data:{session:{access_token:'app-session'}}})},from:()=>({select:async()=>{
    window.registryReads++;
    if(window.holdRegistry)await new Promise(resolve=>{window.releaseRegistry=resolve;});
    if(window.registryError)throw new Error('Fixture registry failure');return {data:[]};}})};
  window.addCalls=0;window.addToInsQueue=()=>{window.addCalls++;};window.toast=message=>{window.lastToast=message;};
  window._withCloudTimeout=promise=>promise;
  ${picker}\n${wrapper}</script>
  <script type="module" src="/personal-worker-client.mjs"></script></body></html>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.IMMUVI_CHROMIUM?{executablePath:process.env.IMMUVI_CHROMIUM}:{})});
try{
  const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const origin='http://127.0.0.1:'+server.address().port;
  const ready=async(page,value)=>{await page.waitForFunction(value=>!document.getElementById('insRunOnSelect').disabled&&document.getElementById('insRunOnSelect').value===value,value);};
  await page.goto(origin);await page.waitForFunction(()=>typeof _openPersonalWorkerDialog==='function');await ready(page,'auto');
  await page.click('#open');await page.locator('dialog').getByText('Owner A private Mac',{exact:false}).waitFor();
  assert.equal(await page.getByText('Owner B private Mac',{exact:false}).count(),0);
  await page.getByRole('button',{name:'Verify existing brief',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('dialog')?.textContent.includes('TEST-INS-REVIEW'));
  assert.equal(requests.filter(request=>request.op==='verify').length,1);
  assert.match(await page.locator('dialog').textContent(),/Needs repair/);
  assert.match(await page.locator('dialog').textContent(),/FFPROBE_UNAVAILABLE/);
  const beforeRepair=requests.length;
  await page.getByRole('button',{name:'Repair Mac',exact:true}).first().click();
  await page.getByRole('textbox',{name:'Codex setup prompt',exact:true}).waitFor({state:'visible'});
  assert.equal(requests.length,beforeRepair);
  await page.getByText('Mac setup',{exact:true}).click();
  await page.getByRole('button',{name:'Create pairing code'}).click();assert.match(await page.getByRole('textbox',{name:'One-time pairing code'}).inputValue(),/^11111111/);
  await page.getByText('Mac setup',{exact:true}).click();
  const prompt=page.getByRole('textbox',{name:'Codex setup prompt',exact:true});
  const promptText=await prompt.inputValue();
  assert.match(promptText,/^Set up or repair this Mac as my private Immuvi classification-only worker\./);
  assert.match(promptText,/https:\/\/immuvi-command-center\.vercel\.app\/personal-worker\/install\.sh/);
  assert.match(promptText,/--resume-pairing/);assert.match(promptText,/Never ask me to paste keys or pairing codes into this chat/);
  assert.match(promptText,/--repair/);assert.match(promptText,/pending-result\.json/);
  assert.doesNotMatch(promptText,/owner-a|app-session|11111111-1111-4111-8111-111111111111|^curl --fail/m);
  assert.equal(await page.getByRole('link',{name:/Download installer/i}).count(),0);
  assert.equal(await page.getByRole('textbox',{name:'Terminal command',exact:true}).count(),0);
  assert.equal(await page.getByRole('combobox',{name:'Mac setup command'}).count(),0);
  await page.getByRole('button',{name:'Copy Codex setup prompt',exact:true}).click();
  assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),promptText);
  assert.equal(await page.getByRole('status').textContent(),'Codex setup prompt copied.');
  await page.screenshot({path:'/private/tmp/immuvi-personal-worker-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  const bounds=await page.locator('dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
  const promptBounds=await prompt.boundingBox();assert.ok(promptBounds.x>=bounds.x&&promptBounds.x+promptBounds.width<=bounds.x+bounds.width);
  assert.equal(await page.locator('dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.screenshot({path:'/private/tmp/immuvi-personal-worker-mobile.png'});
  await page.getByRole('button',{name:'Use this Mac'}).click();await page.waitForFunction(()=>document.getElementById('insRunOnSelect').value.startsWith('personal:'));
  await page.evaluate(()=>_personalWorkerEnqueue('product-a',[{id:'TEST-INS-1',url:'https://example.test/one',noBrief:true}],window._insRunOnAssignment));
  const assignment=requests.find(r=>r.op==='enqueue');assert.equal(assignment.deviceId,a);assert.equal(assignment.items.length,1);assert.equal(assignment.items[0].no_brief,true);
  const stored=await page.evaluate(()=>Object.entries(localStorage));assert.equal(stored.length,1);assert.match(stored[0][0],/^immuvi\.personalWorker\.choice\.v2\.[a-f0-9]{64}$/);assert.equal(stored[0][1],'personal:'+a);
  const beforeReload=requests.length;await page.reload();await ready(page,'personal:'+a);
  assert.equal(requests.slice(beforeReload).filter(r=>r.op==='list').length,1);
  assert.equal(requests.slice(beforeReload).filter(r=>r.op!=='list').length,0);
  const second=await context.newPage();await second.goto(origin);await ready(second,'personal:'+a);await second.close();
  const beforeLate=requests.length;await page.goto(origin+'/?late=1');await ready(page,'auto');
  assert.equal(await page.evaluate(()=>window.registryReads),0);assert.equal(requests.length,beforeLate);
  await page.evaluate(async()=>{AUTH.user={id:'shared-account'};CFG.key='owner-a';await _insRefreshRunOnPicker();});await ready(page,'personal:'+a);
  await page.goto(origin);await ready(page,'personal:'+a);
  offline=true;await page.reload();await ready(page,'personal:'+a);assert.match(await page.locator('#insRunOnSelect option:checked').textContent(),/offline/);offline=false;
  unavailable=true;await page.reload();await ready(page,'personal:'+a);
  assert.equal(await page.locator('#insRunOnSelect option:checked').textContent(),'Personal Mac unavailable');unavailable=false;
  await page.evaluate(()=>{window.registryError=true;});await page.evaluate(()=>_insRefreshRunOnPicker());await ready(page,'personal:'+a);await page.evaluate(()=>{window.registryError=false;});
  await page.evaluate(()=>{window.holdRegistry=true;void _insRefreshRunOnPicker();});await page.waitForFunction(()=>typeof window.releaseRegistry==='function');
  await page.click('#add');assert.equal(await page.evaluate(()=>window.addCalls),0);assert.match(await page.evaluate(()=>window.lastToast),/selection is loading/);
  await page.evaluate(()=>{window.holdRegistry=false;window.releaseRegistry();});await ready(page,'personal:'+a);
  await page.evaluate(async()=>{CFG.key='owner-b';await _insRefreshRunOnPicker();});await ready(page,'auto');
  const oldAssignment=await page.evaluate(async(a)=>{try{await _personalWorkerEnqueue('product-a',[],'personal:'+a);return 'allowed';}catch(error){return error.message;}},a);
  assert.match(oldAssignment,/Select your Mac again/);
  await page.click('#open');await page.locator('dialog').getByText('Owner B private Mac',{exact:false}).waitFor();
  assert.match(await page.locator('dialog').textContent(),/3 slots/);
  assert.equal(await page.getByText('Owner A private Mac',{exact:false}).count(),0);
  await page.getByRole('button',{name:'Use this Mac',exact:true}).click();await ready(page,'personal:'+b);
  await page.goto(origin+'/?owner=owner-b');await ready(page,'personal:'+b);
  await page.goto(origin+'/?owner=owner-b&account=other-account');await ready(page,'auto');
  await page.goto(origin+'/?owner=owner-b');await ready(page,'personal:'+b);
  await page.selectOption('#insRunOnSelect','auto');await page.waitForFunction(()=>Object.values(localStorage).length===1);
  await page.reload();await ready(page,'auto');
  await page.goto(origin);await ready(page,'personal:'+a);
  const race=await context.newPage();let releaseHeld,markHeld;const held=new Promise(resolve=>{markHeld=resolve;});
  await race.route('**/api/personal-worker',async route=>{
    if(route.request().postDataJSON().op==='list'&&route.request().headers()['x-clickup-key']==='owner-a'){
      await new Promise(resolve=>{releaseHeld=resolve;markHeld();});
    }
    await route.continue();
  });
  await race.goto(origin);await held;
  await race.evaluate(()=>{CFG.key='owner-b';void _insRefreshRunOnPicker();});await race.click('#open');
  await race.locator('dialog').getByText('Owner B private Mac',{exact:false}).waitFor();releaseHeld();
  await race.getByRole('button',{name:'Refresh',exact:true}).click();
  assert.equal(await race.getByText('Owner A private Mac',{exact:false}).count(),0);await race.close();
  await page.click('#open');page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Revoke Owner A private Mac'}).click();
  await page.waitForFunction(()=>Object.keys(localStorage).length===0);await ready(page,'auto');
  await page.getByRole('button',{name:'Close',exact:true}).click();await page.waitForSelector('dialog',{state:'detached'});
  assert.deepEqual(errors,[]);
  console.log('Passed desktop/mobile Codex prompt and copy, removal of command/download UI, scoped reload/new-tab persistence, Auto/revocation clearing, offline/unavailable no-fallback, blocked early submission, private identity/race isolation and No Brief forwarding.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
