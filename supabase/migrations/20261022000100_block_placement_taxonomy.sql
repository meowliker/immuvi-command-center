-- Older tabs may still submit placement labels as explicitly approved rows.
-- Keep those new rows archived without changing existing rows or task data.
CREATE OR REPLACE FUNCTION public.guard_explicit_taxonomy_creation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE existing record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    EXECUTE format('SELECT product_id, creation_approved, archived_at FROM public.%I WHERE id = $1', TG_TABLE_NAME)
      INTO existing USING NEW.id;
    IF existing.product_id IS NOT NULL THEN
      IF existing.product_id IS DISTINCT FROM NEW.product_id THEN
        RAISE SQLSTATE 'PT409' USING MESSAGE = 'Taxonomy cannot move between products';
      END IF;
      NEW.creation_approved := existing.creation_approved;
      NEW.archived_at := existing.archived_at;
    ELSIF NEW.notes LIKE 'Added by placing inspiration % into the matrix' THEN
      NEW.creation_approved := false;
    END IF;
  ELSE
    IF OLD.product_id IS DISTINCT FROM NEW.product_id THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE = 'Taxonomy cannot move between products';
    END IF;
    NEW.creation_approved := OLD.creation_approved OR NEW.creation_approved;
  END IF;
  IF NOT NEW.creation_approved THEN
    NEW.archived_at := coalesce(NEW.archived_at, now());
  END IF;
  RETURN NEW;
END;
$$;
