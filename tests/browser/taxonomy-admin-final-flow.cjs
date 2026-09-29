const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const postcss = require('postcss');
async function legacyReference(context, baseUrl, artifactDir) {
  const html = fs.readFileSync('immuvi-command-center.html','utf8');
  const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m)=>m[1]).find((s)=>s.includes('function renderAngles()'));
  const source = ts.createSourceFile('legacy.js',script,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
  const functions = ['renderAngles','renderPersonas','esc','escAttr','escJs'].map((name)=>source.statements.find((node)=>ts.isFunctionDeclaration(node)&&node.name?.text===name).getText(source)).join('\n');
  const nodes = Object.fromEntries(['anglesSummary','anglesBody','anglesGrid','personasSummary','personasBody','personasGrid'].map((id)=>[id,{style:{}}]));
  const sandbox = { document:{getElementById:(id)=>nodes[id]}, ADS:[{id:'AD-1',angle:'Energy',persona:'Busy people',status:'Untested'}],
    ANGLES:[{name:'Energy',sourceLink:'https://example.test/source',notes:'Legacy notes'}], PERSONAS:[{name:'Busy people',notes:'Legacy notes'}],
    _archInclude:{}, _isBoundaryQuarantinedAd:()=>false, _isBoundaryQuarantinedTaxonomy:()=>false,
    _renderTaxonomyMergeSuggestions:()=>'', deriveAngleStatus:()=> 'Untested',derivePersonaStatus:()=> 'Untested',classify:()=>({cls:'notstart'}) };
  vm.runInNewContext(`${functions}\nrenderAngles();renderPersonas();`,sandbox,{timeout:1000});
  const css = postcss.parse([...html.split('</head>')[0].matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m)=>m[1]).join('\n'));
  css.walkAtRules('import',(rule)=>rule.remove());
  const fonts = [...fs.readFileSync('app/globals.css','utf8').matchAll(/@font-face\s*\{[^}]+\}/g)].map((m)=>m[0]).join('\n');
  const reference = await context.newPage();
  await reference.setContent(`<base href="${baseUrl}/"><style>${css}\n${fonts}</style><section class="panel on">${nodes.anglesSummary.innerHTML}<div class="tracker-grid">${nodes.anglesGrid.innerHTML}</div></section>`);
  await reference.evaluate(()=>document.fonts.ready);
  const metrics = await reference.evaluate(()=>({
    nameSize:getComputedStyle(document.querySelector('.tr-name')).fontSize,
    headerSize:getComputedStyle(document.querySelector('.tracker-header')).fontSize,
    summary:[...document.querySelectorAll('.tracker-summary-stat')].map((el)=>el.textContent.replace(/\s+/g,' ').trim()),
    columns:[...document.querySelectorAll('.tracker-header > span')].map((el)=>el.textContent),
  }));
  await reference.screenshot({path:`${artifactDir}/taxonomy-legacy-reference.png`,fullPage:true});
  await reference.close(); return metrics;
}
module.exports = async function ({page,context,data,emit,control,tab,artifactDir,results}) {
  const reference=await legacyReference(context,new URL(page.url()).origin,artifactDir);
  data.angles[0].source_link='https://example.test/source'; data.angles[0].notes='Legacy notes';
  await tab(page,'Angles');
  const row=page.locator('[data-taxonomy-id="ANG-1"]'); await row.waitFor();
  const measured=await page.evaluate(()=>({
    nameSize:getComputedStyle(document.querySelector('[data-taxonomy-id] input')).fontSize,
    headerSize:getComputedStyle(document.querySelector('[data-taxonomy-columns]')).fontSize,
    summary:[...document.querySelectorAll('[aria-label="Angle summary"] > span')].map((el)=>el.textContent.replace(/\s+/g,' ').trim()),
    columns:[...document.querySelectorAll('[data-taxonomy-columns] > span')].map((el)=>el.textContent),
  }));
  assert.deepEqual(measured,reference);
  const actionColumn=await page.locator('[data-taxonomy-columns] > span').last().boundingBox();
  const saveButton=await row.getByRole('button',{name:'Save',exact:true}).boundingBox();
  assert.ok(saveButton.x>=actionColumn.x && saveButton.x<actionColumn.x+actionColumn.width,'Actions must remain in their column');
  assert.equal(await row.getByRole('link',{name:'Open source for Energy'}).getAttribute('href'),'https://example.test/source');
  await row.locator('textarea').fill('Unsaved notes remain');
  await row.getByRole('button',{name:'View creatives for Energy',exact:true}).focus(); await page.keyboard.press('Enter');
  await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(await row.locator('textarea').inputValue(),'Unsaved notes remain');
  await row.getByRole('button',{name:'Discard draft',exact:true}).click();
  data.angles[0].source_link='javascript:alert(1)'; data.angles[0].name='<img src=x onerror=alert(1)>'+'LongName'.repeat(30);
  data.ads[0].angle=data.angles[0].name; data.angles[0].notes='LongNotes'.repeat(100);
  emit('angles','UPDATE',data.angles[0]); emit('ads','UPDATE',data.ads[0]);
  await row.getByRole('link').waitFor({state:'hidden'});
  for(const name of ['Angles','Personas','Admin']) {
    await tab(page,name);
    if(name==='Admin') await page.getByRole('article',{name:data.profiles[0].email,exact:true}).waitFor();
    for(const width of [320,390,768,1100,1440,1920]) {
      await page.setViewportSize({width,height:1000});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${name} overflow at ${width}`);
      if(name!=='Admin') {
        assert.equal(await page.locator('[data-taxonomy-id] img,[data-taxonomy-id] script').count(),0);
        for(const item of await page.locator('[data-taxonomy-id]').all()) assert.equal(await item.evaluate((el)=>el.scrollWidth<=el.clientWidth),true,`Row overflow at ${width}`);
      } else {
        const form=await page.getByRole('form',{name:'New teammate'}).boundingBox();
        const users=await page.getByRole('heading',{name:'Users',exact:true}).boundingBox();
        assert.ok(users.y>=form.y+form.height,'User list must follow creation form');
      }
      if(width===320||width===1440) await page.screenshot({path:`${artifactDir}/admin-final-${name.toLowerCase()}-${width}.png`,fullPage:true});
    }
  }
  await tab(page,'Command HQ');
  await page.getByRole('button',{name:'Manage Fields',exact:true}).click();
  let dialog=page.getByRole('dialog');
  assert.equal(await dialog.getByLabel('Creative structure description 1',{exact:true}).inputValue(),'Real person, phone-shot, authentic feel');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Add Product',exact:true}).click();
  await dialog.getByLabel('Product name',{exact:true}).fill('Astro Rekha');
  assert.equal(await dialog.getByLabel('Inspiration prefix',{exact:true}).textContent(),'AR');
  await dialog.getByRole('button',{name:'Save product',exact:true}).click(); await dialog.waitFor({state:'hidden'});
  assert.equal(data.products.find((p)=>p.name==='Astro Rekha').config.ins_prefix,'AR');
  await tab(page,'Creative Tracker');
  await page.getByRole('button',{name:'Edit QA creative',exact:true}).click();
  dialog=page.getByRole('dialog'); await dialog.getByLabel('Creative structure',{exact:true}).fill('UGC');
  const descriptionId=await dialog.getByLabel('Creative structure',{exact:true}).getAttribute('aria-describedby'); assert.ok(descriptionId);
  assert.equal(await page.locator(`[id="${descriptionId}"]`).textContent(),'Real person, phone-shot, authentic feel');
  await dialog.getByRole('button',{name:'Close editor',exact:true}).click();
  await tab(page,'Inspiration'); await page.getByRole('button',{name:'+ Manual',exact:true}).click();
  dialog=page.getByRole('dialog'); await dialog.getByLabel('Hook type',{exact:true}).fill('Curiosity');
  assert.ok(await dialog.getByLabel('Hook type',{exact:true}).getAttribute('aria-describedby'));
  await page.keyboard.press('Escape');
  assert.equal(control.productAdminCalls.length,1); assert.equal(control.clickupCalls.length,0);
  results.push('Taxonomy/admin final parity: parsed legacy summaries, columns and font metrics; compact responsive trackers and stacked Admin form; safe source links, literal long text, keyboard/draft preservation; default field descriptions in both editors, initial-based product creation, no external calls');
};
