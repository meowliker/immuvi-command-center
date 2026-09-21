import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { displayProductText, readProductDisplayInput } = require('../product-display.cjs');

test('temporary alias covers product-name variants without changing other names', () => {
  for (const name of ['Astro Rekha', 'Astro Rekha IND', 'AstroRekha', 'ASTRO REKHA INDIA']) {
    assert.equal(displayProductText(name), 'AR');
  }
  assert.equal(displayProductText('From: Astro Rekha IND'), 'From: AR');
  assert.equal(displayProductText('Astro Rekha - Scripts'), 'AR - Scripts');
  assert.equal(displayProductText('Quilting'), 'Quilting');
  assert.equal(displayProductText('Astrology'), 'Astrology');
  assert.equal(displayProductText('CA-259-INS-085'), 'CA-259-INS-085');
  assert.equal(displayProductText(null), '');
});

test('unchanged aliased settings retain the backend name; intentional edits are preserved', () => {
  const input = { value: 'AR', getAttribute: () => 'Astro Rekha IND' };
  assert.equal(readProductDisplayInput(input), 'Astro Rekha IND');
  assert.equal(input.value, 'AR');
  input.value = 'My edited name';
  assert.equal(readProductDisplayInput(input), 'My edited name');
  assert.equal(readProductDisplayInput(null), '');
});

test('root and deployed alias assets are identical', () => {
  assert.equal(readFileSync('product-display.js','utf8'), readFileSync('public/product-display.js','utf8'));
  assert.equal(readFileSync('product-display.cjs','utf8'), readFileSync('public/product-display.js','utf8'));
});

for (const file of ['immuvi-command-center.html','public/immuvi-command-center.html']) {
  test(file + ': header, selector and profile show AR while data remains canonical', () => {
    const html = readFileSync(file, 'utf8');
    const product = Object.freeze({id:'prod-ar',name:'Astro Rekha IND',clickupListId:'901',clickupListName:'AstroRekha - Scripts',color:'#123456'});
    const header = { textContent:'' }, dropdown = { innerHTML:'',classList:{contains:()=>false} };
    const profile = { innerHTML:'' };
    const c = vm.createContext({
      PRODUCTS: [product], activeProductId: product.id, displayProductText,
      getActiveProduct: () => product,
      document: {getElementById: id => ({hdrProdName:header,hdrProdDd:dropdown,productProfileSection:profile})[id] || null},
      window:{}, _bindHdrProdDropdownScroll() {},
      esc:s=>String(s),escAttr:s=>String(s),
      DB:{upsertProduct(){throw Error('Display must not write');}}
    });
    function load(start, end) {
      const a=html.indexOf('function '+start+'('), b=html.indexOf('function '+end+'(',a);
      assert.ok(a>0 && b>a);
      vm.runInContext(html.slice(a,b), c);
    }
    load('updateHeaderProductName','renderHdrProdDropdown');
    load('renderHdrProdDropdown','_bindHdrProdDropdownScroll');
    load('renderProductProfile','getActiveProduct');
    c.updateHeaderProductName();
    c.renderHdrProdDropdown();
    c.renderProductProfile();
    assert.equal(header.textContent,'AR');
    assert.doesNotMatch(dropdown.innerHTML,/Astro/i);
    assert.match(dropdown.innerHTML,/prod-ar/);
    assert.doesNotMatch(profile.innerHTML,/Astro/i);
    assert.equal(product.name,'Astro Rekha IND');
    assert.equal(product.clickupListName,'AstroRekha - Scripts');
    assert.match(html, /name: p\.name, config: config/);
    assert.match(html, /brand:\s+row\.productName/);
  });
  test(file + ': inline scripts parse and alias loads before application code', () => {
    const html=readFileSync(file,'utf8');
    assert.ok(html.indexOf('src="/product-display.js"') < html.indexOf('function updateHeaderProductName'));
    for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)){
      if (/\bsrc\s*=|type\s*=\s*["'](?:module|application\/ld\+json)/i.test(match[1])) continue;
      new vm.Script(match[2]);
    }
  });
}

test('Strategist presentation changes compile as TSX', () => {
  const ts = require('typescript');
  for (const file of ['browser/App.tsx','components/CreativeModal.tsx','views/Keywords.tsx','views/Research.tsx']) {
    const source=readFileSync('strategist/src/'+file,'utf8');
    const result=ts.transpileModule(source,{
      fileName:file,reportDiagnostics:true,
      compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}
    });
    assert.equal(result.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,file);
    assert.match(source,/displayProductText/);
  }
});
