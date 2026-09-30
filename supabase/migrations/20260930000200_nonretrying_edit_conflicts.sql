-- A stale user edit cannot succeed by retrying the same transaction. 40001
-- makes affected PostgREST versions retry indefinitely; PT409 returns a conflict.
-- Preserve both functions and all authorization/identity checks verbatim.
do $$
declare signature text; definition text;
begin
  foreach signature in array array[
    'public.guard_inspiration_identity()',
    'public.save_variation_notes(text,text,text,text)'
  ] loop
    if to_regprocedure(signature) is null then
      raise exception 'Required function is missing: %', signature;
    end if;
    definition := pg_get_functiondef(to_regprocedure(signature));
    if position('''40001''' in definition) > 0 then
      execute replace(definition, '''40001''', '''PT409''');
    elsif position('''PT409''' in definition) = 0 then
      raise exception 'Unexpected conflict handler: %', signature;
    end if;
  end loop;
end $$;
notify pgrst, 'reload schema';
