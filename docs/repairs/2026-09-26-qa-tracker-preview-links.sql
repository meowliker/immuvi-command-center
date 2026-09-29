-- QA project entgcnlfsnysnwyadzzp only. Navigation previews, not task/file creation.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '15s';
do $$
declare affected integer;
begin
  update public.ads
  set drive_link = 'https://drive.google.com/drive/u/0/my-drive',
      meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
        '_clickupUrl', 'https://app.clickup.com/9016762494/v/li/901616718146',
        '_qaNavigationPreview', true)
  where id = 'qa-sample-e2fd9960-252e-4d77-8aee-a92a96e6c19d'
    and product_id = 'qa-sample-astrorekha'
    and format_name = 'AR-174-INS-035'
    and updated_at = '2026-09-26 08:50:58.996787+00'::timestamptz
    and clickup_task_id is null and drive_link is null
    and ad_link = 'https://example.com/'
    and not (coalesce(meta, '{}'::jsonb) ?| array['_clickupId', 'clickupTaskId', '_clickupUrl']);
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'QA preview precondition changed; no links updated'; end if;
end $$;
select id, format_name, ad_link, drive_link, clickup_task_id, meta->>'_clickupUrl' as clickup_preview
from public.ads where id = 'qa-sample-e2fd9960-252e-4d77-8aee-a92a96e6c19d' and product_id = 'qa-sample-astrorekha';
commit;
