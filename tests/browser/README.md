# Command Center Browser Checks

Start the QA Next.js server, then run:

```sh
node tests/browser/command-center-live.cjs
```

This requires Playwright and Google Chrome. `PLAYWRIGHT_MODULE` can point to an
existing Playwright installation; `BROWSER_CHANNEL` selects another installed
Playwright browser channel. `TEST_BASE_URL` defaults to `http://localhost:3000`.
`BROWSER_ARTIFACTS` sets the screenshot/report directory (default: a temporary
`immuvi-realtime-browser` directory).

The suite intercepts Supabase HTTP and WebSocket traffic and local admin API
requests. It uses synthetic accounts and product data. It does not write to
Supabase or ClickUp. Unexpected external requests fail the check.

Coverage includes all tabs, admin/member access, authentication flows, local
mutations, realtime bursts, irrelevant-product events, primary-key-only deletes,
preserved DOM/filter/draft/focus/inspector state, delayed product requests, and
updates across two browser tabs through BroadcastChannel.

ClickUp checks intercept `/api/clickup/qa` and use a synthetic session-only key.
They cover list URL parsing, field mappings, import counts, key removal, and
expanded controls at desktop/mobile sizes. They never call the ClickUp service.

These checks complement `npm run test:domain`, `npm run test:services`, and
`npm run typecheck`. Live end-user RLS and full worker workflows require the
later QA milestone.
