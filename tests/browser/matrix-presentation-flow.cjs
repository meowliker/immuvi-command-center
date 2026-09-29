const assert = require('node:assert/strict');

module.exports = async function testMatrixPresentation({ page, data, tab, artifactDir, results }) {
  const longName = 'Indian women curious but skeptical about soulmate sketches and the uncertainty of what a future partner might look like. '.repeat(6);
  const stamp = new Date().toISOString();
  for (let i=2;i<=9;i++) data.personas.push({ ...data.personas[0], id:`PER-${i}`, name:i===3 ? longName : `Audience ${i}` });
  for (let i=2;i<=16;i++) data.angles.push({ ...data.angles[0], id:`ANG-${i}`, name:`Angle ${i}`, status:i%2 ? 'Testing' : 'Winner' });
  const base = data.ads[0]; base.status='Testing';
  for (const [id,status,persona] of [['W','Winner','Audience 2'],['L','Loser','Audience 4'],['P','In Production','Audience 5'],['N','Untested','Audience 6']]) {
    data.ads.push({ ...structuredClone(base), id, status, persona, format_name:`Creative ${id}`, created_at:stamp, meta:{ creativeHypothesis:'A compact matrix example' } });
  }
  await tab(page,'Creative Matrix');
  const grid=page.getByRole('region',{name:'Angle by persona matrix',exact:true});
  await page.getByRole('button',{name:'Energy x Busy people: 1 creatives',exact:true}).waitFor();
  assert.equal(await page.getByText('Filled cells in view',{exact:true}).count(),0);
  const controls=page.getByRole('region',{name:'Matrix controls',exact:true});
  const decisions=page.getByRole('region',{name:'Matrix opportunities',exact:true});
  assert.equal(await decisions.getByRole('button').count(),4);
  const longHeader=grid.getByRole('columnheader',{name:longName.trim(),exact:true});
  assert.ok((await longHeader.boundingBox()).height<=55);
  assert.equal(await longHeader.locator('span').getAttribute('title'),longName.trim());
  for (const density of ['compact','comfortable','detailed']) {
    await page.getByRole('button',{name:`${density} density`,exact:true}).click();
    const heights=await grid.locator('[data-matrix-cell]').evaluateAll((nodes)=>nodes.map((node)=>Math.round(node.getBoundingClientRect().height)));
    assert.equal(new Set(heights).size,1);
    assert.equal(heights[0],{compact:124,comfortable:180,detailed:240}[density]);
  }
  await page.getByRole('button',{name:'comfortable density',exact:true}).click();
  for (const width of [1440,768,390,320]) {
    await page.setViewportSize({width,height:1000});
    await page.evaluate(()=>window.scrollTo(0,0));
    await page.mouse.move(0,0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const before=await grid.locator('thead th').first().boundingBox();
    await grid.evaluate((node)=>{node.scrollLeft=450;node.scrollTop=300;});
    const after=await grid.locator('thead th').first().boundingBox();
    const horizontalScroll=await grid.evaluate(node=>node.scrollLeft);
    assert.ok(horizontalScroll>0 && Math.abs(before.x-after.x-horizontalScroll)<2,'Matrix should still scroll horizontally');
    assert.equal(await grid.evaluate(node=>node.scrollTop),0,'Matrix must not scroll vertically');
    assert.equal(await grid.evaluate(node=>node.scrollHeight<=node.clientHeight+1),true,'All matrix rows must fit its full-height container');
    await grid.evaluate((node)=>{node.scrollLeft=0;node.scrollTop=0;});
    assert.ok((await longHeader.boundingBox()).height<=55);
    assert.equal(await controls.locator('input,select,button,summary').evaluateAll((nodes)=>nodes.filter(node=>node.getClientRects().length).every(node=>{const r=node.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth+1;})),true,'Controls must stay within viewport');
    if(width===1440) {
      assert.ok((await controls.boundingBox()).height<135,'Desktop filters should not become stacked forms');
      assert.ok((await decisions.boundingBox()).y < (await controls.boundingBox()).y);
      assert.ok((await grid.boundingBox()).y<650,'Matrix should be visible in first desktop viewport');
    }
    await page.screenshot({path:`${artifactDir}/matrix-legacy-${width}.png`,fullPage:true});
    await grid.evaluate(node=>window.scrollTo(0,node.getBoundingClientRect().top+window.scrollY));
    const scrollBefore=await page.evaluate(()=>window.scrollY);
    await page.mouse.move(width/2,500);
    await page.mouse.wheel(0,600);
    await page.waitForFunction(before=>window.scrollY>before+300,scrollBefore);
    assert.equal(await grid.evaluate(node=>node.scrollTop),0,'Wheel over matrix must scroll the page');
    assert.ok((await grid.locator('thead').boundingBox()).y<0,'Matrix header must scroll away');
    assert.ok((await controls.boundingBox()).y+(await controls.boundingBox()).height<0,'Filters must scroll away');
    assert.ok(Math.abs((await page.getByRole('navigation',{name:'Command Center sections'}).boundingBox()).y)<2,'Only top tab navigation stays sticky');
    await page.screenshot({path:`${artifactDir}/matrix-page-scroll-${width}.png`});
    await page.evaluate(()=>window.scrollTo(0,0));
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.getByLabel('Search matrix',{exact:true}).fill('Creative W');
  assert.equal(await grid.locator('[data-angle-id]').count(),1);
  await page.getByRole('button',{name:'Clear matrix search',exact:true}).click();
  assert.equal(await grid.locator('[data-angle-id]').count(),16);
  await page.getByLabel('Matrix persona').selectOption('PER-2');
  assert.equal(await grid.locator('thead th').count(),2);
  await page.getByLabel('Matrix persona').selectOption('');
  await controls.locator('summary').click();
  await controls.getByRole('checkbox',{name:'Winner',exact:true}).check();
  await page.getByRole('button',{name:'Energy x Busy people: 0 creatives',exact:true}).waitFor();
  await controls.getByRole('checkbox',{name:'Winner',exact:true}).uncheck();
  await page.keyboard.press('Escape');
  assert.equal(await controls.locator('details').getAttribute('open'),null);
  await decisions.getByRole('button',{name:/Where's the money/}).click();
  assert.equal(await decisions.getByRole('button',{name:/Where's the money/}).getAttribute('aria-pressed'),'true');
  await page.getByRole('button',{name:'Reset Matrix filters',exact:true}).click();
  await page.getByRole('button',{name:'Energy x Busy people: 1 creatives',exact:true}).click();
  await page.getByRole('dialog').waitFor();
  await page.getByRole('button',{name:'Close inspector',exact:true}).click();
  results.push('Legacy matrix layout: 16x9 fixture with very long persona name, full-height matrix with page scrolling and only sticky top tabs, horizontal scrolling at 320-1440px, uniform density heights, compact filters, name search, persona/status filters, overlays, reset and inspector opening; no writes');
};
