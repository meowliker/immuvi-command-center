# Authentication Startup Ordering

The cloud failure overlay could appear over sign-in because window.load began
loadState independently of DOMContentLoaded authentication. The overlay then
made every existing body child inert, including the login form. Profile lookup
errors also signed the user out even when caused by temporary network failure.

Startup now awaits one authentication promise before loading any product data.
Product permissions are installed before the first product read, and an old
cached product outside the user's assignments cannot be speculatively fetched.
Profile/access lookups have a bounded timeout. Network failures preserve the
session instead of calling signOut. Cloud errors cannot overlay the login or
password-change gate; showing login removes any stale cloud error overlay.

Live checks during this repair: auth health responded HTTP 200, while multiple
small REST data reads timed out after 8-10 seconds. Direct database reads worked.
The official Supabase status page reported an ongoing Eastern-US client latency
incident; this may contribute, but does not establish this project's root cause.
No database writes, restarts, migrations, connection termination, or data resets
were performed for this repair. QA was not modified.

Verification: tests/auth-startup.test.mjs plus existing regression tests, 143
tests passed. Revert this code commit on main to roll back; no data rollback
is necessary. A production browser login was not exercised because browser
access was not authorized.
