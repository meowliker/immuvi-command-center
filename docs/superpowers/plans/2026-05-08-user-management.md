# User Management — Implementation Plan
**Date**: 2026-05-08
**Spec**: `docs/superpowers/specs/2026-05-08-user-management-design.md`

## Phase 1 — Schema (live Supabase)
- [x] Write `supabase/migrations/20260508000000_user_management.sql`
- [ ] Apply via psql against `SUPABASE_DB_URL`
- [ ] Verify tables, helpers, trigger, view, RLS policies exist

## Phase 2 — Bootstrap admin
- [ ] Write `tools/auth/bootstrap_admin.py` (uses service_role admin API)
- [ ] Run for `gauravpataila.llc@gmail.com` with temp password (printed once)
- [ ] Verify `is_admin()` returns true under that JWT

## Phase 3 — Local admin helper server
- [ ] Write `tools/auth/admin_server.py` — stdlib HTTP server, port 8103
  - `POST /admin/create-user` — verifies caller JWT is admin, creates auth.users, inserts user_products
  - `POST /admin/reset-password` — admin-only, sets new temp pw + must_change_password=true
  - `POST /admin/deactivate` / `POST /admin/reactivate`
  - CORS for `http://localhost:8102`
  - Loads service_role from `.env`
- [ ] Add startup instructions to README

## Phase 4 — Frontend
- [ ] **Login overlay** at app boot
  - Renders BEFORE existing init runs
  - On success: `SB.realtime.setAuth(token)`, set `last_login_at`, then continue normal init
  - Persists session via Supabase Auth's built-in `localStorage` adapter
- [ ] **Force-password-change modal**
  - Fires when `profiles.must_change_password = true`
  - On submit: `SB.auth.updateUser({password})` + clear flag
- [ ] **Header pill**: `username · role badge · logout`
- [ ] **Product filter**: `loadProducts()` joins `user_products`; admins bypass
- [ ] **Admin tab**: new `panel-admin` rendered only when admin
  - Create user form
  - User table (from `profiles_with_products`)
  - Per-row: assign products, deactivate, reset pw
- [ ] **Logout**: `SB.auth.signOut()` then reload

## Phase 5 — Legacy table RLS rollout (DEFERRED, separate session)
For each of: `ads`, `manual_actions`, `angles`, `personas`, `matrix_cells`, `angle_personas`, `inspirations`, `inspiration_queue`, `inspiration_results`, `deleted_ads`, `activity_events`:

1. Verify all read paths in HTML use authed `SB` client (post-login, this is automatic)
2. Verify all write paths can write under `has_product` (admin and assigned member)
3. Verify worker writes via service_role still pass (they bypass RLS)
4. Apply: `alter table public.<T> enable row level security;` + `create policy <T>_authed ...`
5. Smoke test in app under both admin and member sessions

## Phase 6 — Smoke testing
- [ ] Login as admin, see all products
- [ ] Create test user, assign 1 product
- [ ] Logout, login as test user, see only that product
- [ ] Verify existing flows still work for admin: matrix, action plan, producer 🎨, strategist tab, inspirations
- [ ] Verify realtime sync still fires under authed session
- [ ] Verify worker (classify_worker.py) still processes queues

## Phase 7 — Commit
- [ ] Local commit (no push) of HTML, migration, tools/auth/, docs/, supabase/

## Files touched
- `supabase/migrations/20260508000000_user_management.sql` *(new)*
- `tools/auth/bootstrap_admin.py` *(new)*
- `tools/auth/admin_server.py` *(new)*
- `tools/auth/README.md` *(new)*
- `immuvi-command-center.html` *(major)*
- `docs/superpowers/specs/2026-05-08-user-management-design.md` *(new)*
- `docs/superpowers/plans/2026-05-08-user-management.md` *(this file)*
