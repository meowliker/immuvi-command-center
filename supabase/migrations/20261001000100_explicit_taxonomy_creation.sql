-- Existing curated rows remain approved; legacy clients' new rows are archived.
ALTER TABLE public.angles ADD COLUMN IF NOT EXISTS creation_approved boolean NOT NULL DEFAULT true;
ALTER TABLE public.personas ADD COLUMN IF NOT EXISTS creation_approved boolean NOT NULL DEFAULT true;
ALTER TABLE public.angles ALTER COLUMN creation_approved SET DEFAULT false;
ALTER TABLE public.personas ALTER COLUMN creation_approved SET DEFAULT false;

CREATE OR REPLACE FUNCTION public.guard_explicit_taxonomy_creation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE existing record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- BEFORE INSERT also runs for UPSERT: preserve the server's approval/archive.
    EXECUTE format('SELECT product_id, creation_approved, archived_at FROM public.%I WHERE id = $1', TG_TABLE_NAME)
      INTO existing USING NEW.id;
    IF existing.product_id IS NOT NULL THEN
      IF existing.product_id IS DISTINCT FROM NEW.product_id THEN
        RAISE SQLSTATE 'PT409' USING MESSAGE = 'Taxonomy cannot move between products';
      END IF;
      NEW.creation_approved := existing.creation_approved;
      NEW.archived_at := existing.archived_at;
    END IF;
  ELSE
    IF OLD.product_id IS DISTINCT FROM NEW.product_id THEN
      RAISE SQLSTATE 'PT409' USING MESSAGE = 'Taxonomy cannot move between products';
    END IF;
    -- A normal snapshot cannot revoke approval. Explicit Restore uses UPDATE.
    NEW.creation_approved := OLD.creation_approved OR NEW.creation_approved;
  END IF;
  IF NOT NEW.creation_approved THEN
    NEW.archived_at := coalesce(NEW.archived_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_taxonomy_explicit_creation ON public.angles;
CREATE TRIGGER trg_taxonomy_explicit_creation BEFORE INSERT OR UPDATE ON public.angles
FOR EACH ROW EXECUTE FUNCTION public.guard_explicit_taxonomy_creation();
DROP TRIGGER IF EXISTS trg_taxonomy_explicit_creation ON public.personas;
CREATE TRIGGER trg_taxonomy_explicit_creation BEFORE INSERT OR UPDATE ON public.personas
FOR EACH ROW EXECUTE FUNCTION public.guard_explicit_taxonomy_creation();
