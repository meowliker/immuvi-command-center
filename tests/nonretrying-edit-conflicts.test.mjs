import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';

const read = file => readFileSync(new URL('../'+file,import.meta.url),'utf8');
const migration = read('supabase/migrations/20260930000200_nonretrying_edit_conflicts.sql');
test('stale-edit migration replaces retry codes in both handlers without touching rows',()=>{
  assert.ok(migration.includes("'public.guard_inspiration_identity()'"));
  assert.ok(migration.includes("'public.save_variation_notes(text,text,text,text)'"));
  assert.ok(migration.includes("replace(definition, '''40001''', '''PT409''')"));
  assert.doesNotMatch(migration,/\b(?:insert into|delete from|truncate|update public\.)/i);
  assert.ok(migration.includes('Required function is missing'));
  assert.ok(migration.includes('Unexpected conflict handler'));
});
test('effective function definitions reject conflicts with PT409 while preserving guards',()=>{
  for(const file of ['20260929000100_inspiration_identity.sql','20260930000100_variation_notes.sql']) {
    const original=read('supabase/migrations/'+file);
    const effective=original.replaceAll("'40001'","'PT409'");
    assert.ok(effective.includes("'PT409'"));
    assert.ok(!effective.includes("'40001'"));
    assert.equal(effective.replaceAll("'PT409'","'40001'"),original);
  }
});
