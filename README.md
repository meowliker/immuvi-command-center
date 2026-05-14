# Immuvi Command Center

Single-page dashboard for managing paid-ad creative pipelines — angles, personas, ad matrix, inspiration classification — all synced to ClickUp.

**Status:** migrating from local-only to cloud (Supabase + Vercel), with a Next.js test migration on the `anay` branch. See [`MIGRATION_PLAN.md`](MIGRATION_PLAN.md).

---

## What it does

- Manage angles × personas matrix per product
- Track creatives through lifecycle: Untested → Ready to Launch → Testing → Winner/Loser
- Push production-ready creatives to a ClickUp list as tasks
- Queue competitor ad URLs and classify them with AI (Claude Code, local)
- Generate a 7-section creative brief per classified inspiration, saved as a ClickUp doc page

---

## Live URL

Deployed to Vercel from the `main` branch — auto-deploy on push.

**Production:** https://immuvi-command-center.vercel.app

---

## Local development

### Next.js test app

The `anay` branch runs the existing dashboard through a Next.js App Router shell so the UI and behavior can be tested without touching `main` production.
Typed migration modules live under `lib/command-center`, `lib/supabase`, `hooks/command-center`, and `components/command-center`.

```bash
npm install
npm run dev
# → open http://localhost:3000
```

Build check:

```bash
npm run build
```

### Legacy static preview

The original static HTML files are still present for comparison:

```bash
python3 -m http.server 8098 --bind 127.0.0.1
# → open http://localhost:8098/immuvi-command-center.html
```

### Environment

Copy `.env.example` → `.env.local` and fill in:
- `SUPABASE_URL` — your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — only needed by the `classify-inspiration` skill on Gaurav's Mac
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — used by the Next.js React app as screens migrate off the static HTML

The anon key is embedded in the HTML (public by design, protected by RLS).

---

## Deploy

Every push to `main` auto-deploys the current production app to Vercel. Keep the Next.js migration on a non-main branch until it has been tested and approved.

```bash
git add .
git commit -m "your change"
git push origin main
# → Vercel builds + deploys in ~30 seconds
```

Rollback: `git revert <commit> && git push` → Vercel redeploys previous version.

---

## Team onboarding

1. Open the Vercel URL
2. Paste your ClickUp API key on first load (stays in your browser only)
3. You'll see the shared products, angles, personas, matrix, ads

No install, no account creation (for v1). Auth can be added later without schema changes.

---

## Inspiration classifier (runs on Gaurav's Mac only)

The classifier (`/classify-inspiration` Claude skill) requires ffmpeg + yt-dlp + Playwright + Claude Code. It reads the queue from Supabase, classifies URLs locally, and writes results back to Supabase — team sees results in the dashboard in real time.

Non-classifier work (editing matrix, pushing to ClickUp, etc.) works from any browser.
