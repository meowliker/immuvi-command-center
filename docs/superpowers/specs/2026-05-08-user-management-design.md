# User Management System — Design Spec
**Date**: 2026-05-08
**Status**: Implementing

## Goal
Add username+password login to Immuvi Command Center with admin-controlled user management and per-user product gating. Admins create users and assign which products each user can see/work on.

## Requirements (from user)
1. Username + password login per user
2. Admin role with elevated capabilities
3. Admin creates users (or invites them) and shares credentials
4. Admin restricts each user to a specific subset of products
5. Each user only sees / can work on assigned products
6. Admin can assign and unassign products at any time

## Auth choice
**Supabase Auth, email + password.** JWT integrates with RLS via `auth.uid()`, supports admin user creation via service_role, and works alongside existing anon Supabase client patterns. Username can be a display field; login uses email under the hood (with optional username→email pre-resolution lookup for UX).

Rejected: custom auth (security risk, reinvent the wheel), magic-link-only (user explicitly wants creds-shared model).

## Roles
Two-tier MVP:
- **`admin`** — full access to all products + user management
- **`member`** — only products in `user_products` for them

Stored in `profiles.role`. Read on session start, gated by RLS via `is_admin()` helper.

## Schema

| Table | Purpose |
|---|---|
| `profiles` | 1:1 with `auth.users`. Holds `role`, `is_active`, `must_change_password`, `username`, `full_name`, `last_login_at`. |
| `user_products` | `(user_id, product_id)` join. Admins are NOT in this table (they bypass via `is_admin()`). |
| `admin_audit_log` | Append-only log of admin actions. |

Helpers:
- `public.is_admin() → boolean` — true if `auth.uid()` has role=admin AND is_active.
- `public.has_product(text) → boolean` — true if admin OR has assignment.

Trigger:
- `on_auth_user_created` — auto-creates `profiles` row when `auth.users` is inserted (whether via signup or admin API).

## RLS strategy
- **User-mgmt tables** (`profiles`, `user_products`, `admin_audit_log`): RLS enabled, policies in migration. Users see own profile, admins see all. Only admins write to `user_products` and `admin_audit_log`.
- **New product-scoped tables** (`producer_runs`, `strategist_memory`, `strategist_runs`, `strategist_processed`): RLS enabled. Single `for all using (has_product(product_id))` policy.
- **Legacy product-scoped tables** (`ads`, `manual_actions`, `angles`, `personas`, `matrix_cells`, `angle_personas`, `inspirations`, `inspiration_queue`, `inspiration_results`, `deleted_ads`, `activity_events`): policies READY (in plan doc) but RLS NOT enabled in this migration. Rolled out per-table after verification — see Plan Phase 5.
- **Workers**: continue using `service_role` key — bypasses RLS, no behavior change.
- **Realtime**: post-login, `SB.realtime.setAuth(token)` is called so postgres_changes subscriptions enforce RLS. Members subscribed to a non-assigned product simply see no events.

## User creation flow
The browser cannot safely hold the `service_role` key. Therefore admin user-creation requires a server-side path. Three paths considered:

| Path | Pros | Cons |
|---|---|---|
| Supabase Edge Function | Clean, hosted, scales | Requires `supabase functions deploy` (deploy step) |
| Vercel API route | Already deployed | User said no Vercel deploys this session |
| Local admin helper (Python HTTP server) | No deploy needed; pattern matches existing local stack (`http.server`, `classify_worker.py`) | Admin must run `tools/auth/admin_server.py` alongside other procs |

**Decision**: ship the local admin helper in this session (works immediately, no deploy). Edge function code is also written and lives in `supabase/functions/admin-create-user/` for future deploy when user OKs it.

## Frontend changes

1. **Login overlay** — full-screen modal, gates the app at boot. Reads existing session from `localStorage.supabase.auth.token` first; if absent, shows login form. Submits to `SB.auth.signInWithPassword`.
2. **Force-password-change modal** — fires immediately after sign-in if `profiles.must_change_password = true`. Calls `SB.auth.updateUser({password})` then clears the flag in profiles.
3. **Header pill** — replaces nothing, adds `[username · role badge · ↪ logout]` to the right side of `.hdr-right`.
4. **Admin tab** — new tab `panel-admin` visible only when `role==='admin'`. Contains:
   - "Invite user" form: email, username, full name, temp password (auto-gen button), product checkboxes
   - User table: rows of profiles_with_products
   - Per-row actions: assign/unassign products (drawer), deactivate, reactivate, reset password
5. **Product switcher filter** — `loadProducts()` calls a new helper `currentUserAccessibleProducts()` that filters `PRODUCTS` by the user's `user_products` (admins get all). Local persistence (`immuvi_active_product`) is validated against the filtered list on boot.
6. **Realtime auth wiring** — after `signInWithPassword` resolves, call `SB.realtime.setAuth(session.access_token)`.

## Bootstrap flow
1. Run migration → tables + helpers + trigger exist.
2. Run `tools/auth/bootstrap_admin.py` → creates `gauravpataila.llc@gmail.com` via service_role admin API with a temp password, then promotes to admin and assigns all products.
3. Admin logs in via the new login screen, hits force-pw-change modal, sets real password.
4. Admin uses Admin tab to create team users.

## Non-goals (this session)
- Legacy-table RLS rollout (separate verified pass)
- Edge function deploy
- Email-based password reset (admin-driven reset only for now)
- Audit log UI (table+inserts ready, viewer added in next session)
- 2FA / SSO

## Risk register
- **Realtime channel reuse invariant** still holds; tested under authed JWT.
- **AD/MA delete invariants** unchanged because legacy tables remain on anon RLS until Phase 5.
- **MA→sourceAd repair paths** unchanged (legacy tables not RLS'd yet).
- **Worker writes** keep using service_role; verified via memory invariants.
- **First admin bootstrap** is a chicken/egg solved by the bootstrap script using service_role.
- **Service role exposure**: only in `tools/auth/admin_server.py` and `tools/auth/bootstrap_admin.py`; both read from `.env`, never sent to browser.
