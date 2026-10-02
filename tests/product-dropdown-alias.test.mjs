import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for (const file of ['immuvi-command-center.html','public/immuvi-command-center.html']) {
  test(file+': temporary AR alias changes only the exact product header and dropdown labels',()=>{
    const html=readFileSync(new URL('../'+file,import.meta.url),'utf8');
    const source=html.slice(html.indexOf('function updateHeaderProductName()'),html.indexOf('function _bindHdrProdDropdownScroll('));
    const products=Object.freeze([
      Object.freeze({id:'prod-1778009469915',name:'Astro Rekha IND',clickupListId:'list'}),
      Object.freeze({id:'another-product',name:'Astro Rekha IND'}),
      Object.freeze({id:'quilting',name:'Quilting'})
    ]);
    const dropdown={innerHTML:'',classList:{contains:()=>false}};
    const name={textContent:''},dot={style:{}};
    let active=products[0];
    const context=vm.createContext({
      PRODUCTS:products,activeProductId:products[0].id,window:{},
      document:{getElementById:id=>({hdrProdDd:dropdown,hdrProdName:name,hdrProdDot:dot})[id]},
      getActiveProduct:()=>active,esc:String,escAttr:String,_bindHdrProdDropdownScroll(){}
    });
    vm.runInContext(source,context);
    context.renderHdrProdDropdown();
    assert.deepEqual([...dropdown.innerHTML.matchAll(/class="hdr-prod-dd-name">([^<]*)</g)].map(m=>m[1]),['AR','Astro Rekha IND','Quilting']);
    assert.ok(dropdown.innerHTML.includes("hdrSwitchProduct('prod-1778009469915')"));
    context.updateHeaderProductName();
    assert.equal(name.textContent,'AR');
    assert.equal(products[0].name,'Astro Rekha IND');
    for (const product of [products[1],products[2],null]) {
      active=product;
      context.updateHeaderProductName();
      assert.equal(name.textContent,product ? product.name : 'No Product');
    }
  });
}
