-- Persist archive state for Angle and Persona rows.
-- The app has read/written archived_at since the matrix archive UI shipped;
-- this migration makes that contract explicit for fresh/restored databases.

alter table public.angles
  add column if not exists archived_at timestamptz;

alter table public.personas
  add column if not exists archived_at timestamptz;

create index if not exists idx_angles_product_archived
  on public.angles(product_id, archived_at);

create index if not exists idx_personas_product_archived
  on public.personas(product_id, archived_at);
