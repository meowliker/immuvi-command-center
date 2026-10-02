-- Snapshot omission is not deletion intent. Preserve rows from stale clients.
CREATE OR REPLACE FUNCTION public.guard_explicit_taxonomy_deletion()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE permitted boolean;
BEGIN
  -- Preserve the existing explicitly authorized whole-product cascade.
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id=OLD.product_id) THEN RETURN OLD; END IF;
  EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I WHERE id=$1 AND product_id=$2)', 'deleted_' || TG_TABLE_NAME)
    INTO permitted USING OLD.id, OLD.product_id;
  IF NOT permitted THEN RETURN NULL; END IF;
  RETURN OLD;
END;
$$;
CREATE TRIGGER trg_taxonomy_explicit_deletion BEFORE DELETE ON public.angles
FOR EACH ROW EXECUTE FUNCTION public.guard_explicit_taxonomy_deletion();
CREATE TRIGGER trg_taxonomy_explicit_deletion BEFORE DELETE ON public.personas
FOR EACH ROW EXECUTE FUNCTION public.guard_explicit_taxonomy_deletion();

CREATE OR REPLACE FUNCTION public.delete_product_taxonomy(p_product_id text,p_kind text,p_ids text[])
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE target text; removed integer;
BEGIN
  IF p_product_id IS NULL OR btrim(p_product_id)='' OR p_kind IS NULL OR p_kind NOT IN ('angle','persona') OR coalesce(cardinality(p_ids),0)=0 OR cardinality(p_ids)>100 THEN
    RAISE SQLSTATE 'PT400' USING MESSAGE='Invalid taxonomy deletion';
  END IF;
  target := CASE p_kind WHEN 'angle' THEN 'angles' ELSE 'personas' END;
  -- Both statements obey the caller's RLS and commit or roll back together.
  EXECUTE format('INSERT INTO public.%I(id,product_id,name) SELECT id,product_id,name FROM public.%I WHERE product_id=$1 AND id=ANY($2) ON CONFLICT(id) DO NOTHING', 'deleted_' || target,target)
    USING p_product_id,p_ids;
  EXECUTE format('DELETE FROM public.%I WHERE product_id=$1 AND id=ANY($2)',target)
    USING p_product_id,p_ids;
  GET DIAGNOSTICS removed=ROW_COUNT;
  RETURN removed;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_product_taxonomy(text,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_product_taxonomy(text,text,text[]) TO authenticated,service_role;
