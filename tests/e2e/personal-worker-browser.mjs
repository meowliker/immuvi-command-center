import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.IMMUVI_PLAYWRIGHT_MODULE||'playwright');
const source=readFileSync(new URL('../../immuvi-command-center.html',import.meta.url),'utf8');
const css=[...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const module=readFileSync(new URL('../../public/personal-worker-client.mjs',import.meta.url));
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',requests=[];
const server=createServer(async(req,res)=>{
  if(req.url==='/personal-worker-client.mjs'){res.setHeader('Content-Type','text/javascript');return res.end(module);}
  if(req.url==='/api/personal-worker'){
    let text='';for await(const chunk of req)text+=chunk;const body=JSON.parse(text);requests.push(body);
    res.setHeader('Content-Type','application/json');
    if(body.op==='list')return res.end(JSON.stringify({devices:[{id:req.headers['x-clickup-key']==='owner-a'?a:b,
      name:req.headers['x-clickup-key']==='owner-a'?'Owner A private Mac':'Owner B private Mac',paired:true,lastSeen:new Date().toISOString(),attention:[]}]}));
    if(body.op==='create')return res.end(JSON.stringify({pairingCode:a+'.'+'x'.repeat(43)}));
    return res.end(JSON.stringify({ok:true,count:body.items?.length||0}));
  }
  res.setHeader('Content-Type','text/html');res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>
  <button id="open" onclick="_openPersonalWorkerDialog()">My Mac</button><select id="insRunOnSelect"><option value="auto">Auto</option></select>
  <script>window.CFG={key:'owner-a'};window.AUTH={user:{id:'shared-account'}};window.SB={auth:{getSession:async()=>({data:{session:{access_token:'app-session'}}})}};
  window._insRefreshRunOnPicker=async()=>{var s=document.getElementById('insRunOnSelect');s.innerHTML='<option value="auto">Auto</option>';await _appendPersonalWorkerOptions(s);};</script>
  <script type="module" src="/personal-worker-client.mjs"></script></body></html>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.IMMUVI_CHROMIUM?{executablePath:process.env.IMMUVI_CHROMIUM}:{})});
try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof _openPersonalWorkerDialog==='function');
  await page.click('#open');await page.locator('dialog').getByText('Owner A private Mac',{exact:false}).waitFor();
  assert.equal(await page.getByText('Owner B private Mac',{exact:false}).count(),0);
  await page.getByRole('button',{name:'Create pairing code'}).click();assert.match(await page.getByRole('textbox',{name:'One-time pairing code'}).inputValue(),/^11111111/);
  await page.screenshot({path:'/private/tmp/immuvi-personal-worker-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  const bounds=await page.locator('dialog').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
  await page.screenshot({path:'/private/tmp/immuvi-personal-worker-mobile.png'});
  await page.getByRole('button',{name:'Use this Mac'}).click();await page.waitForFunction(()=>document.getElementById('insRunOnSelect').value.startsWith('personal:'));
  await page.evaluate(()=>_personalWorkerEnqueue('product-a',[{id:'TEST-INS-1',url:'https://example.test/one',noBrief:true}],window._insRunOnAssignment));
  const assignment=requests.find(r=>r.op==='enqueue');assert.equal(assignment.deviceId,a);assert.equal(assignment.items.length,1);assert.equal(assignment.items[0].no_brief,true);
  await page.evaluate(()=>{CFG.key='owner-b';});await page.click('#open');await page.locator('dialog').getByText('Owner B private Mac',{exact:false}).waitFor();
  assert.equal(await page.getByText('Owner A private Mac',{exact:false}).count(),0);
  await page.getByRole('button',{name:'Close',exact:true}).click();
  await page.waitForSelector('dialog',{state:'detached'});
  assert.equal(await page.locator('dialog').count(),0);assert.deepEqual(errors,[]);
  console.log('Passed desktop/mobile modal layout, private key-scoped listing, pairing UI, explicit device assignment, No Brief forwarding and identity-switch cache isolation.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
