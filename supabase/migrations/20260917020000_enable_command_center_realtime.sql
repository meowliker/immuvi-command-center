-- Publish the tables observed by the React command center. Event payloads are
-- invalidation signals; the client re-reads through RLS and product filters.
do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'products', 'profiles', 'user_products',
    'ads', 'angles', 'personas', 'matrix_cells', 'manual_actions',
    'activity_events', 'inspiration_queue', 'worker_registry',
    'competitor_brands', 'competitor_research_queue', 'competitor_creatives',
    'strategist_memory', 'strategist_runs', 'strategist_recommendations'
  ] loop
    if to_regclass(format('public.%I', target_table)) is not null
      and not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = target_table
      ) then
      execute format('alter publication supabase_realtime add table public.%I', target_table);
    end if;
  end loop;
end $$;
