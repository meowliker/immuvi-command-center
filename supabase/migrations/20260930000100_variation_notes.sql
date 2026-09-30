-- Atomic, product-authorized notes-only writes. No records are created or deleted.
create or replace function public.save_variation_notes(
  p_ad_id text, p_product_id text, p_original text, p_notes text
) returns jsonb
language plpgsql security invoker set search_path = public as $$
declare
  current_ad public.ads%rowtype;
  current_notes text;
  saved_notes text;
begin
  if auth.uid() is null or not public.has_product(p_product_id) then
    raise exception using errcode = '42501', message = 'Product access denied';
  end if;
  if p_original is null or p_notes is null or length(p_notes) > 20000 then
    raise exception using errcode = '22023', message = 'Invalid notes';
  end if;
  select * into current_ad from public.ads
    where id = p_ad_id and product_id = p_product_id and deleted_at is null
      and parent_ad_id is not null
    for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Variation not found';
  end if;
  current_notes := coalesce(current_ad.meta->>'notes', current_ad.meta->>'variationNotes', '');
  if current_notes is distinct from p_original and current_notes is distinct from p_notes then
    raise exception using errcode = '40001', message = 'Notes changed; reopen before editing';
  end if;
  if current_notes is distinct from p_notes then
    update public.ads set meta = coalesce(meta, '{}'::jsonb) ||
      jsonb_build_object('notes', p_notes, 'variationNotes', p_notes)
      where id = p_ad_id and product_id = p_product_id;
  end if;
  select coalesce(meta->>'notes', meta->>'variationNotes', '') into saved_notes
    from public.ads where id = p_ad_id and product_id = p_product_id;
  return jsonb_build_object('id', p_ad_id, 'productId', p_product_id, 'notes', saved_notes);
end;
$$;

revoke all on function public.save_variation_notes(text,text,text,text) from public, anon;
grant execute on function public.save_variation_notes(text,text,text,text) to authenticated;
notify pgrst, 'reload schema';
