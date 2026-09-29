import { readFileSync } from 'node:fs';

// Intentionally local-only: deployment belongs to the consolidated installation.
const {PGlite}=await import(process.env.QA_PGLITE_MODULE || '@electric-sql/pglite');
const db=new PGlite();
try {
  await db.exec(readFileSync('tests/database/shared-worker-base.sql','utf8'));
  const analysis=process.argv.includes('--analysis');
  const images=analysis || process.argv.includes('--images');
  if(images) {
    await db.exec(`drop function public.qa_generate_images(uuid,text,text,jsonb);
      drop table public.qa_image_runs,public.qa_image_worker;
      create table public.ads(id text primary key,product_id text,clickup_task_id text,meta jsonb default '{}',deleted_at timestamptz,status text,last_status_change_at bigint);
      create table public.deleted_ads(id text,product_id text,clickup_task_id text);
      create table public.strategist_memory(product_id text,json jsonb,markdown text);
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create function public.has_product(text) returns boolean language sql as $$select exists(select 1 from public.profiles p where p.id=auth.uid() and p.is_active and (p.role='admin' or exists(select 1 from public.user_products where user_id=p.id and product_id=$1)))$$;
      create function storage.foldername(text) returns text[] language sql as $$select string_to_array($1,'/')$$;`);
    await db.exec(readFileSync('supabase/migrations/20260928010000_qa_image_producer.sql','utf8'));
  }
  for(const name of ['20260928050000_qa_private_workers','20260928060000_qa_private_inspiration',
    '20260929070000_qa_private_brief_delivery_recovery','20260929090000_qa_inspiration_library',
    '20260929120000_qa_private_queue_controls','20260929150000_qa_shared_worker',
    '20260929160000_qa_shared_worker_visibility','20260929170000_qa_shared_queue_priority',
    '20260929200000_qa_shared_recovery']) {
    await db.exec(readFileSync(`supabase/migrations/${name}.sql`,'utf8'));
  }
  await db.exec(`begin;${readFileSync('tests/database/shared-worker.sql','utf8')}\n${readFileSync('tests/database/shared-recovery.sql','utf8')}\nrollback;`);
  if(images) {
    await db.exec(readFileSync('supabase/migrations/20260929210000_qa_shared_images.sql','utf8'));
    await db.exec(`begin;${readFileSync('tests/database/shared-worker.sql','utf8')}\n${readFileSync('tests/database/shared-images.sql','utf8')}\nrollback;`);
  }
  if(analysis) {
    await db.exec(`alter table public.ads add column parent_ad_id text,add column format_name text;
      drop table public.strategist_memory;`);
    // PGlite has no realtime replication. The actual table/function definitions
    // are executed; only publication membership is outside this local fixture.
    await db.exec(readFileSync('supabase/migrations/20260506200000_strategist_tables.sql','utf8').replace(/^alter publication .*;$/gm,''));
    await db.exec(readFileSync('supabase/migrations/20260522000000_add_winner_variation_tables.sql','utf8'));
    await db.exec(readFileSync('supabase/migrations/20260930010000_qa_shared_analysis.sql','utf8'));
    await db.exec(`begin;${readFileSync('tests/database/shared-worker.sql','utf8')}\n${readFileSync('tests/database/shared-analysis.sql','utf8')}\nrollback;`);
  }
  console.log('Local PostgreSQL: shared/private isolation and durable recovery fixtures passed. No remote database used.');
} catch(error) {
  console.error(error.message,error.where || '');process.exitCode=1;
} finally {await db.close();}
