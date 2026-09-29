import { readFileSync } from 'node:fs';

export const QA_REF = 'entgcnlfsnysnwyadzzp';
export const MIGRATIONS = [
  '20260929200000_qa_shared_recovery',
  '20260929210000_qa_shared_images',
  '20260930010000_qa_shared_analysis',
];
const quote = value => "'" + value.replaceAll("'", "''") + "'";

export function assertRolloutTarget(ref, branch, args) {
  if (ref !== QA_REF || branch !== 'qa') throw new Error('Only the linked QA project on branch qa is allowed.');
  if (args.some(arg => !['--apply', '--installed'].includes(arg)) || args.length > 1) {
    throw new Error('Use no option for rollback rehearsal, --apply, or --installed.');
  }
}

export function pendingMigrations(read = readFileSync) {
  return MIGRATIONS.map(file => {
    const version = file.slice(0, 14), name = file.slice(15);
    const sql = read(`supabase/migrations/${file}.sql`, 'utf8');
    return `do $install$ begin
      if exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then
        if not exists(select 1 from supabase_migrations.schema_migrations where version='${version}' and name='${name}' and statements=array[${quote(sql)}]) then
          raise exception 'Installed migration differs from reviewed source: ${version}';
        end if;
      else
        execute ${quote(sql)};
        insert into supabase_migrations.schema_migrations(version,statements,name) values('${version}',array[${quote(sql)}],'${name}');
      end if;
    end $install$;`;
  }).join('\n');
}

export function rolloutGuard(apply = false) {
  return `set local statement_timeout='90s'; set local lock_timeout='5s';
    select pg_advisory_xact_lock(hashtext('qa-shared-consolidated-rollout'));
    lock table public.qa_private_workers in share row exclusive mode;
    do $guard$ begin
      if not exists(select 1 from public.products where id='qa-sample-astrorekha'
        and config->>'clickup_list_id'='1301130000002447'
        and config->>'qa_brief_doc_id'='8cq1r3y-44896'
        and config->>'qa_brief_tracker_page_id'='8cq1r3y-118036'
        and config->>'qa_brief_visibility'='PUBLIC') then
        raise exception 'QA destination does not match approved configuration';
      end if;
      if exists(select 1 from public.qa_private_inspiration_jobs where status='running')
        or exists(select 1 from public.qa_image_runs where status='running') then
        raise exception 'Active QA work must drain before rehearsal or installation';
      end if;
      if to_regclass('public.qa_shared_analysis_jobs') is not null then
        if exists(select 1 from public.qa_shared_analysis_jobs where status='running') then
          raise exception 'Active analysis must drain first';
        end if;
      end if;
      ${apply ? `if not exists(select 1 from public.qa_private_workers where id='7d23bf50-d0b6-4611-8b05-ecb6a9ab3b77' and scope='shared' and product_id='qa-sample-astrorekha' and not enabled)
        or exists(select 1 from public.qa_private_workers where scope='shared' and enabled) then
        raise exception 'Pause shared QA claims and drain before installing';
      end if;` : ''}
    end $guard$;`;
}

export function rollbackSuite(fixture, {installed = false, read = readFileSync} = {}) {
  if (!['shared-recovery', 'shared-images', 'shared-analysis'].includes(fixture)) throw new Error('Unknown rollout fixture.');
  return `begin; ${rolloutGuard()} ${installed ? '' : pendingMigrations(read)}
    ${read('tests/database/shared-worker.sql', 'utf8')}
    ${read(`tests/database/${fixture}.sql`, 'utf8')}
    rollback;`;
}
