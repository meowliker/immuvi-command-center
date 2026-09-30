# Variation Notes Save Transport

The browser reported a network-level failure during direct Supabase PATCH,
without a database error code. Reads and rolled-back SQL updates worked; the
precise browser/network cause was not observable without browser access.
Existing notes storage in ads.meta was present. This was not an unapplied
column migration.

The replacement uses POST /api/variation-notes on the app origin. The server
forwards the user's JWT to save_variation_notes; it does not replace the JWT
with service-role authorization. The function checks active product access,
locks the existing live variation, checks the expected previous note, and
merges only notes/variationNotes. It neither creates nor deletes records.
The API reads the row after commit before confirming success. Retries of an
already-saved value are idempotent.

Migration 20260930000100 was applied before deployment. Backup of the previous
function state and affected creative: /private/tmp/immuvi-notes-before-20260930.
Verification script: scripts/verify-variation-notes-db.mjs. It tested the actual
reported creative with authenticated database privileges, asserted all other
fields remained unchanged, checked conflict and product-access rejection,
then rolled back and compared the original row. No user notes were changed.

Rollback: revert the frontend/API commit on main. The unused database function
can remain without affecting older clients. To remove it after code rollback:
DROP FUNCTION public.save_variation_notes(text,text,text,text);
Do not delete or reset any creative data when rolling back.
