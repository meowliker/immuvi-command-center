# Drive API Credentials Handoff — Winning-Variation Picker

The Winning-Variation Picker uses a single Google Drive API key (NOT OAuth, NOT service account). The endpoint at `/api/drive/list` reads `process.env.GOOGLE_DRIVE_API_KEY` and calls the public Drive REST API.

## Why an API key (not OAuth / service account)

- All ad Drive folders are shared with **"Anyone with the link"** — they are public content.
- Google's Drive API accepts API-key authentication for public files.
- No OAuth flow → no "connect your Google account" button.
- No service account → no per-folder share step.
- Single secret to rotate.

## Local development

The key already lives in `~/.classify-inspiration.env`:

```bash
GOOGLE_DRIVE_API_KEY=AIzaSy...
```

For the `tests/api/test_drive_endpoint.js` smoke test, source the env first:

```bash
set -a; source ~/.classify-inspiration.env; set +a
node tests/api/test_drive_endpoint.js
```

## Production (Vercel) wiring

When ready to deploy the picker to production, set the env var in Vercel and redeploy. Two ways:

**Option A — Vercel dashboard:**

1. Open the project at https://vercel.com → Settings → Environment Variables
2. Add a new variable:
   - Name: `GOOGLE_DRIVE_API_KEY`
   - Value: the actual `AIzaSy...` string
   - Environments: Production (and Preview, if desired)
3. Trigger a redeploy: push any commit to `main`, or click "Redeploy" on the latest deployment.

**Option B — Vercel CLI:**

```bash
vercel env add GOOGLE_DRIVE_API_KEY production
# Paste the key when prompted
vercel deploy --prod
```

## How the key was created (for reference)

1. Console: https://console.cloud.google.com/ → New Project → `immuvi-command-center`
2. Search bar → "Google Drive API" → Enable
3. APIs & Services → Credentials → **+ Create Credentials** → **API key**
4. **Restrict the key:**
   - Application restrictions: **None** (server-to-server calls have no HTTP referrer; setting one would break the endpoint)
   - API restrictions: **Restrict key** → check only **Google Drive API**
5. Save. Copy the resulting `AIzaSy...` string into the env var.

## Folder requirements

Every Drive folder that should be listable by the picker must be shared with **"Anyone with the link"** (Viewer is sufficient). Folders set to "Restricted" return 404 from the API even with a valid key.

Folder visibility check:
1. Right-click folder in Drive → Share
2. "General access" → must be **"Anyone with the link"**
3. Role: **Viewer**

## Quotas (free tier)

Google's default Drive API quota is generous for our use case:

- 1,000,000,000 queries / day per project
- 1,000 queries / 100s per user

The local dev hits ~1 query per "Browse folder" click. Even at 1000 active sessions per day, we'd use < 0.01% of the daily quota.

## Rotation

Rotate the key by generating a new one in Google Cloud Console and updating both:
- `~/.classify-inspiration.env` (local dev)
- Vercel env var `GOOGLE_DRIVE_API_KEY` (production)

The old key is invalidated as soon as the new one is saved. Restrict each new key the same way (Drive API only, no app restrictions).

## Why we did NOT use a service account

A service account would require:
- One-time JSON key file management
- Each Drive folder explicitly shared with the SA's email (or a parent folder shared once)
- More complex setup on Vercel (base64-encoding the JSON, parsing it server-side)

For "Anyone with the link" content, the API-key path is strictly simpler with no security downside (the key only reads public content; it can't access your account, send mail, or do anything besides Drive read-only).
