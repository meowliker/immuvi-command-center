import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

export async function testPlacementTaxonomyGuard(tx) {
  const products=await tx`select id from products order by id limit 2`;
  assert.equal(products.length,2);
  await tx.unsafe('SAVEPOINT placement_taxonomy_fixtures');
  try {
    for(const table of ['angles','personas']) {
      const id='placement-fixture-'+randomUUID(),manual='manual-fixture-'+randomUUID();
      const product=products[0].id,other=products[1].id;
      const get=async key=>(await tx.unsafe(`select * from public.${table} where id=$1`,[key]))[0];
      await tx.unsafe(`insert into public.${table}(id,product_id,name,status,notes,creation_approved)
        values($1,$2,$1,'Untested','Added by placing inspiration TEST-INS-1 into the matrix',true)`,[id,product]);
      let row=await get(id);assert.equal(row.creation_approved,false);assert.ok(row.archived_at);
      const archived=row.archived_at.toISOString();
      await tx.unsafe(`insert into public.${table}(id,product_id,name,status,creation_approved,archived_at)
        values($1,$2,$1,'Untested',true,null) on conflict(id) do update set creation_approved=excluded.creation_approved,archived_at=excluded.archived_at`,[id,product]);
      row=await get(id);assert.equal(row.creation_approved,false);assert.equal(row.archived_at.toISOString(),archived);
      await tx.unsafe(`insert into public.${table}(id,product_id,name,status,notes,creation_approved)
        values($1,$2,$1,'Untested','Manually added from inspiration',true)`,[manual,product]);
      row=await get(manual);assert.equal(row.creation_approved,true);assert.equal(row.archived_at,null);
      await tx.unsafe(`update public.${table} set archived_at=null,creation_approved=true where id=$1`,[id]);
      row=await get(id);assert.equal(row.creation_approved,true);assert.equal(row.archived_at,null);
      await assert.rejects(tx.savepoint(inner=>inner.unsafe(`update public.${table} set product_id=$2 where id=$1`,[id,other])),{code:'PT409'});
    }
  } finally {
    await tx.unsafe('ROLLBACK TO SAVEPOINT placement_taxonomy_fixtures');
    await tx.unsafe('RELEASE SAVEPOINT placement_taxonomy_fixtures');
  }
}
