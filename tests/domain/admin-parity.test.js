import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { productFieldCatalog, productInitials } from '../../lib/domain/product-administration.js';

const html = readFileSync('immuvi-command-center.html','utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).find((s) => s.includes('const CREATIVE_STRUCTURE_DESC'));
const source = ts.createSourceFile('legacy.js',script,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const declarations = source.statements.filter(ts.isVariableStatement).flatMap((s) => [...s.declarationList.declarations]);
test('all default field names and descriptions match the parsed legacy constants', () => {
  const fields = { creativeStructure: ['CREATIVE_STRUCTURES','CREATIVE_STRUCTURE_DESC'], hookType: ['HOOK_TYPES','HOOK_TYPE_DESC'], productionStyle: ['PRODUCTION_STYLES','PRODUCTION_STYLE_DESC'] };
  const catalog = productFieldCatalog();
  for (const [key,[names,descriptions]] of Object.entries(fields)) {
    const expression = (name) => declarations.find((d) => d.name.getText(source) === name).initializer.getText(source);
    const expected = vm.runInNewContext(`(${expression(names)}).map(name => ({name,desc:(${expression(descriptions)})[name] || ''}))`, {}, {timeout:1000});
    assert.deepEqual(catalog[key], JSON.parse(JSON.stringify(expected)));
  }
});
test('product initials preserve legacy word initials and do not mutate saved overrides', () => {
  for (const [name,expected] of [['Astro Rekha','AR'],['Immuvi','I'],['QA Test Product Four','QTP'],['  QA\t Test\nProduct  ','QTP'],['','INS']]) assert.equal(productInitials(name),expected);
  const saved = { field_options: { creativeStructure: [{name:'UGC',desc:''}], hookType:[], productionStyle:[{name:'Custom',desc:'My description'}] } };
  assert.deepEqual(productFieldCatalog(saved),saved.field_options);
  const fresh = productFieldCatalog(); fresh.creativeStructure[0].desc = 'Changed';
  assert.equal(productFieldCatalog().creativeStructure[0].desc,'Real person, phone-shot, authentic feel');
});
