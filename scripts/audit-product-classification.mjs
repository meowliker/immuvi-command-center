import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {targetEnv} from './strategist-env.mjs';

const [productId, output] = process.argv.slice(2);
assert.ok(productId && output, 'Usage: audit-product-classification.mjs PRODUCT_ID PRIVATE_OUTPUT');
const {default: postgres} = await import(process.env.POSTGRES_MODULE || 'postgres');
const sql = postgres(targetEnv().STRATEGIST_DATABASE_URL, {max:1, prepare:false, connect_timeout:10});
const tables = ['products','angles','personas','ads','manual_actions','matrix_cells','inspirations','inspiration_results','inspiration_queue','taxonomy_review_jobs'];
mkdirSync(output, {recursive:true, mode:0o700});
const save = (name, data) => writeFileSync(`${output}/${name}.json`, JSON.stringify(data, null, 2), {mode:0o600, flag:'wx'});
try {
  await sql.begin('isolation level repeatable read read only', async tx => {
    await tx`set local statement_timeout='30s'`;
    const [product] = await tx`select id,name from public.products where id=${productId}`;
    assert.ok(product, 'Product does not exist');
    const counts = {}, protectedRows = {};
    for (const table of tables) {
      const owner = table === 'products' ? 'id' : 'product_id';
      const rows = await tx.unsafe(`select * from public.${table} where ${owner}=$1 order by id`, [productId]);
      save(table, rows);
      counts[table] = rows.length;
      [protectedRows[table]] = await tx.unsafe(`select count(*)::int as count,md5(string_agg(md5(to_jsonb(t)::text),'' order by id)) as digest from public.${table} t where ${owner} is distinct from $1`, [productId]);
    }
    save('manifest', {at:new Date().toISOString(), product, counts, otherProductFingerprints:protectedRows});
    console.log(JSON.stringify({product, counts}));
  });
} finally {
  await sql.end();
}
