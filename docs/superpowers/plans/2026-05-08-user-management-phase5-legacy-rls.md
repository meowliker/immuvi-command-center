# Phase 5 — Legacy Table RLS Lockdown (DEFERRED)
**Parent plan**: `2026-05-08-user-management.md`

## Context
Phase 1–4 of user management shipped: schema, bootstrap, login, admin tab, product gating, force-pw-change.

During smoke testing we discovered every legacy product-scoped table had RLS enabled with policies scoped to the **anon role only** (`<table>_anon_all` policies, `roles = {anon}`, `using (true)`). Once a user signs in their role flips to `authenticated`, and these policies stop applying — silent empty rows everywhere.

**Migration `20260508010000_extend_anon_policies_to_authed.sql`** worked around this by replacing the `_anon_all` policies with `_open_all` policies (no role restriction). Same security level as before (effectively none — `using (true)`). This restored existing functionality under authed sessions.

**The actual product gating is currently UI-level only**: the product switcher filters to assigned products and members can't navigate to others through the UI. But if a member manipulates JS to set `activeProductId` to a forbidden product, they'd get the data because the legacy tables don't enforce `has_product(product_id)` at the SQL layer.

This is the work Phase 5 finishes.

## Tables to lock down

| Table | Read paths | Write paths | Worker writes? |
|---|---|---|---|
| `products` | `DB.listProducts()` | admin "Add Product" flow, ClickUp sync | no |
| `ads` | `loadState`, `pollFullSync`, all Action Plan & Matrix queries | `_flushStateToSupabase`, sync, soft-delete | no |
| `manual_actions` | `loadState`, AP merge | `pollFullSync` (Pass 0), `importTasksFromClickUp`, manual edits | no |
| `angles` / `personas` | `loadState`, taxonomy reads | taxonomy edits, sync | no |
| `matrix_cells` | `loadState`, matrix render | matrix edits | no |
| `angle_personas` | `loadState` | taxonomy & matrix edits | no |
| `inspirations` | `loadInspirations` | classifier results, manual adds | classifier (service_role) |
| `inspiration_queue` | inspirations tab | manual queue | classifier (service_role) |
| `inspiration_results` | inspirations tab | classifier writes | classifier (service_role) |
| `deleted_ads` | tombstone reads | soft-delete | no |
| `activity_events` | activity log | activity stamping | no |
| `worker_registry` | health checks | worker heartbeats | classifier/strategist/producer (service_role) |

## Recipe per table

```sql
-- 1. Drop the open policy
drop policy if exists <T>_open_all on public.<T>;

-- 2. Add gated policy
create policy <T>_authed on public.<T> for all
  using (public.has_product(product_id))
  with check (public.has_product(product_id));
```

Workers continue to use `service_role` and bypass RLS — unchanged.

## Verification checklist (per table, do BEFORE flipping)
1. Sign in as **admin** — read+write should work because `is_admin()` short-circuits `has_product`.
2. Sign in as a **member assigned to product P** — read+write for P only.
3. Sign in as a **member NOT assigned to P** — direct query returns empty (silent), insert fails.
4. **Worker run** (classify_worker.py, strategist, producer) — confirm writes still land (they should, service_role bypasses).
5. **Realtime subscribe** to a channel for product P — admin always works; assigned member works; non-assigned member sees no events (correct).

## Rollout order (lowest blast radius first)

1. `worker_registry` — only worker heartbeats; non-product-scoped... wait, this table doesn't have `product_id`. SKIP, leave it open.
2. `activity_events` — read-only audit, low risk.
3. `deleted_ads` — already tombstone; admin/member RLS doesn't change behavior since deletes only happen for products you own.
4. `inspiration_queue`, `inspiration_results` — classifier worker uses service_role.
5. `inspirations` — UI feature.
6. `angles`, `personas` — taxonomy.
7. `matrix_cells`, `angle_personas` — matrix grid.
8. `manual_actions` — Action Plan core. Watch the additive-merge invariant.
9. `ads` — biggest table, most paths. Watch AD/MA delete invariants + MA→sourceAd repair + nextSerialId tombstone awareness.
10. `products` — gate last. Make sure admin "Add Product" still works.

## Known risk areas (memory invariants to re-verify post-lockdown)

- **AD/MA delete invariants** (5 checks): `_adToRow` no `deleted_at`, tombstone-aware `nextSerialId`, both flush filters check `deleted_ads`, awaited soft-delete, `deleted_ads_anon_all` RLS (now `_open_all`, becoming `_authed`), awaited tombstone reads in import paths.
- **Realtime budget**: subscribers must use authed JWT (`SB.realtime.setAuth(token)`) — already wired in `_onSession`. Re-verify.
- **MA→sourceAd repair**: `pollFullSync` Pass 0 + `importTasksFromClickUp` both must read under authed RLS without losing rows.
- **Action Plan additive merge**: stays additive-only.
- **Producer/strategist invariants** (10 total): unchanged, those tables are already on tight RLS.

## What to do FIRST in the next session

```bash
# Confirm policies are in the expected starting state
psql "$SUPABASE_DB_URL" -c "
  select c.relname, p.polname,
         array(select rolname from pg_roles r where r.oid = any(p.polroles)) as roles
    from pg_policy p join pg_class c on c.oid=p.polrelid
   where c.relnamespace='public'::regnamespace
     and p.polname like '%_open_all'
   order by c.relname;
"
```

Then proceed table-by-table per the rollout order above.
