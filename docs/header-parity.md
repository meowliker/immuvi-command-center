# Header parity

Compared the local legacy HTML and the public legacy app source on 2026-09-28.

## Behavior

- Product selection remains scoped to the authenticated app user's access.
- The masked ClickUp key is stored in browser session storage, scoped by app user. Its text input uses CSS masking and password-manager ignore hints, not a password input that Chrome might confuse with login credentials. A debounced, authenticated QA API request reads ClickUp `/user` and displays its name. Changing the key clears the previous identity. ClickUp identity never grants app permissions.
- The header has one manual ClickUp sync command. List configuration remains in connection settings. Existing QA list guards are unchanged.
- Live sync defaults on once the key is verified and the approved QA list is linked. The checkbox choice is saved per app user in browser local storage across refreshes and product changes. Manual sync, key replacement, and transient failures do not override an explicit opt-out. Polling runs every 60 seconds in the foreground and every five minutes in the background, with throttled focus/online catch-up. Requests cannot overlap; missing credentials and unapproved lists prevent polling without changing the preference.
- The notification bell opens a right panel with unread counts, read-on-open, clear, and outside dismissal. Like legacy, this is an in-memory activity log, capped at 200 entries, not a persistent inbox. Known credential patterns are redacted.
- ClickUp, Action Plan, and column-layout notices share a newest-first top-right toast stack. Each toast has a severity-colored countdown (2.5 seconds for success, 4 for errors); expiration or dismissal removes only the toast, not its notification-history entry. Adding a toast does not reset older timers. Routine sync summaries remain excluded.
- Online users open in a compact anchored popover with outside-click/Escape dismissal. Force reload uses a compact amber Force Reload button and a confirmation with Cancel and Yes together at the right; only Yes sends a request.
- Sync prepares its remote snapshot without the edit lock, then commits through the existing version-checked QA RPC. Imports yield to active user writes, and stale automatic imports are discarded for the next poll. Shared foreground edits queue through short commit windows instead of being rejected as busy; queued edits are cancelled on unmount. Genuine version/identity conflicts still fail safely rather than overwriting concurrent changes.
- Account details show the app login and role, with sign-out inside the details dialog rather than the header.
- The product selector sits beneath the heading. Immediately to its right on desktop: key, compact sync icon, live sync, force-reload icon. Notifications and the user name align at the far right, with online users below. Smaller screens wrap these groups without changing the control order. The redundant settings icon is removed; list configuration remains in the ClickUp section.
- Online users are read from the authenticated QA presence service. Sessions heartbeat every 30 seconds, expire after 90 seconds without a heartbeat, and deduplicate by app user. Names use the current verified ClickUp key owner, falling back to the app profile when no key is verified. Only the QA server can store ClickUp-verified names; clients cannot write names or borrow another app account's identity. No email or key is stored in presence data. Login names and roles remain unchanged. Click the avatars/count to open the user list. Connection errors show unavailable rather than a misleading zero.
- The Force Reload icon has an accessible name and tooltip. Members see a disabled icon with an admin-only tooltip; server authorization still rejects member reload requests. Admins must press Yes in the all-devices confirmation; No, Escape, and outside dismissal send nothing.
- Active admins can confirm a QA-wide reload. A durable, audited Supabase marker reaches open sessions through realtime, with polling/focus catch-up. Each session warns for five seconds and waits for tracked active saves before reloading. New sessions ignore historical markers. Request IDs make retry idempotent, and the server enforces a 30-second cooldown.
- Published build changes are checked every five minutes. The notice offers reload now or a 15-minute snooze. Local development does not invent a build version.

## Isolation and verification

`20260928020000_qa_header_reload.sql` installs only the QA reload service. Installation sends no reload event. Production legacy users, tasks, and databases are unaffected.

- `node scripts/check-qa-header.mjs`: rollback-only database checks for admin authorization, member reads, blocked member/inactive/anonymous writes, idempotence, and cooldown.
- `node scripts/check-qa-header.mjs --presence`: rollback-only checks for tab deduplication, verified names, stale-session expiry, session ownership, and blocked anonymous/inactive/direct-table access. Add `--apply` to install only the validated QA presence migration.
- `HEADER_ONLY=1 node tests/browser/command-center-live.cjs`: mocked ClickUp/Supabase browser checks, including identity, polling, notifications, desktop/mobile layout, deployment notices, and two-tab reload/no historical loop. No real external mutations or team reload broadcasts.
- Domain/service tests cover response validation, credential redaction, readonly ClickUp identity, QA list restrictions, sync integrity, and shared subscriptions.
- `node scripts/check-qa-header.mjs --clickup-presence`: before applying its migration, rollback-only checks for verified names across users, key replacement/removal, legacy tabs, session ownership, expiry and restricted writes. Add `--apply` to install the tested migration. Requires server-only `QA_SUPABASE_SERVICE_ROLE_KEY`; never expose this key to the browser.
- `node --test tests/components/clickup-live-sync.test.cjs tests/services/clickup-presence.test.js`: default-on scheduling, persisted opt-out, in-flight disable, failure recovery, safe gating, and identity persistence checks.

Production enablement requires its own reviewed configuration and migration; QA safeguards must not be bypassed to connect a production list.
