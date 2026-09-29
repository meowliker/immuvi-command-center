-- QA only. Legacy product settings read on 2026-09-28; no integration IDs copied.
-- Apply only against entgcnlfsnysnwyadzzp after checking the linked project ref.
begin;
do $$
begin
  if not exists (select 1 from public.products
    where id = 'qa-sample-astrorekha' and config ? 'qa_sample'
      and config->>'clickup_list_id' = '1301130000002447') then
    raise exception 'Expected QA sample and approved test list';
  end if;
end;
$$;
update public.products
set config = jsonb_set(config, '{production}',
  '{"product_name":"Astro Rekha","offer":"50% OFF","market":"","forbidden_aliases":""}'::jsonb)
where id = 'qa-sample-astrorekha'
  and (config->'production' is null or config->'production' in ('null'::jsonb, '{}'::jsonb));
select id, config->'production' as production from public.products
where id = 'qa-sample-astrorekha';
commit;
