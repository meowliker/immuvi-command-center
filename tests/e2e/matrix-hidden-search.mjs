import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
const {chromium}=await import(process.env.IMMUVI_PLAYWRIGHT_MODULE||'playwright');
const source=readFileSync(new URL('../../immuvi-command-center.html',import.meta.url),'utf8');
const css=[...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
const section=source.slice(source.indexOf('var _mxv4CreativeSearch ='),source.indexOf('function renderMxv4Filters()'));
const functions=['_mxv4AdSource','_mxv4AggregateAds','_mxv4ClassifyCell','_mxv4GetCellFilters','_mxv4ApplyCellFilters','openMxv4Modal'].map(name=>{
  const start=source.indexOf('function '+name+'(');assert.ok(start>=0);return source.slice(start,source.indexOf('\n}',start)+2);
}).join('\n');
const server=createServer((req,res)=>{
  res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head>
  <body><main style="padding:16px;max-width:1000px"><h1 style="font-size:20px">Matrix Search Regression Fixture</h1><div id="matrixGrid">
  <div class="mxv4-creative-search"><input id="mxCreativeSearch" aria-label="Search creatives in matrix" oninput="setMxv4CreativeSearch(this.value)">
  <span id="mxCreativeSearchCount" class="mxv4-search-count"></span><div id="mxCreativeSearchResults" class="mxv4-search-results" hidden></div></div>
  <div data-mx-search-key="Active angle||Active persona"></div></div><div id="mxv4ModalBd"></div><div id="mxv4Modal"></div></main>
  <script>
  var activeProductId='fixture-product',_productSwitchPending=false,matrixExpandedCell=null;
  var ANGLES=[{name:'Active angle'}],PERSONAS=[{name:'Archived persona',archivedAt:1}],saveCalls=0;
  var ADS=[{id:'fixture-winner',formatName:'TEST-354-INS-220',angle:'Active angle',persona:'Archived persona',status:'Winner',adType:'Photo',product_id:'fixture-product',createdAt:1}];
  var CELL_CREATIVE_ASSIGNMENTS={'Active angle||Archived persona':['fixture-winner']},MATRIX_CELL_META={};
  var _mxv4={cell:null,cellFilters:{},dateRange:'week',filterMode:'scope',statusFilter:['Testing']};
  function _adPassesProductBoundaryForTaxonomy(ad,pid){return !ad.quarantined&&(!ad.product_id||ad.product_id===pid);}
  function _mxv4ScopeActive(){return true;}function _mxv4StatusFilterActive(){return true;}
  function _mxv4AdMatchesDateFilter(){return false;}function _mxv4AdMatchesStatusFilter(){return false;}
  function _mxv4EnsureModal(){}function closeMxv4Modal(){_mxv4.cell=null;}
  function renderMatrix(){_mxv4BuildSearchIndex();_mxv4ApplyCreativeSearch();}
  function saveState(){saveCalls++;throw Error('Search must not save');}
  ${functions}\n${section}
  function renderMxv4Modal(){
    var parts=_mxv4.cell.split('||');var state=_mxv4ClassifyCell(parts[0],parts[1],{lifetime:_mxv4.searchResultCell===_mxv4.cell});
    var rows=_mxv4ApplyCellFilters(state.ads);var panel=document.getElementById('mxv4Modal');
    panel.replaceChildren();rows.forEach(function(row){var p=document.createElement('p');p.textContent=row.ad.formatName+' · '+row.status;panel.appendChild(p);});
  }
  _mxv4BuildSearchIndex();
  </script></body></html>`);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.env.IMMUVI_CHROMIUM?{executablePath:process.env.IMMUVI_CHROMIUM}:{})});
try{
 for(const viewport of [{width:1280,height:800},{width:390,height:844}]){
  const page=await browser.newPage({viewport});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.getByRole('textbox',{name:'Search creatives in matrix'}).fill('TEST-354-INS-220');
  assert.equal(await page.locator('#mxCreativeSearchCount').textContent(),'1 task outside visible matrix');
  const result=page.getByRole('button',{name:'Open existing cell for TEST-354-INS-220'});await result.waitFor();
  const bounds=await result.boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=viewport.width);
  await page.screenshot({path:'/private/tmp/immuvi-hidden-search-'+viewport.width+'.png'});
  await result.click();assert.match(await page.locator('#mxv4Modal').textContent(),/TEST-354-INS-220 · Winner/);
  const state=await page.evaluate(()=>({saveCalls,activePersonas:PERSONAS.filter(x=>!x.archivedAt).length,status:ADS[0].status,topDate:_mxv4.dateRange,topStatus:_mxv4.statusFilter}));
  assert.deepEqual(state,{saveCalls:0,activePersonas:0,status:'Winner',topDate:'week',topStatus:['Testing']});
  await page.getByRole('textbox',{name:'Search creatives in matrix'}).fill('');assert.equal(await page.locator('#mxCreativeSearchResults').isVisible(),false);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Passed desktop/mobile hidden-category search and exact Winner opening without taxonomy restoration, persistence, or top-level filter changes.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
