# Auth helpers

## Bootstrap the first admin

One-shot, run once per fresh install:

```bash
python3 tools/auth/bootstrap_admin.py YOUR_EMAIL --full-name "Your Name"
```

Prints a temp password — save it. Sign in once, you'll be forced to change it.

## Run the admin helper server

The dashboard's Admin tab calls this server for create-user / reset / etc. It holds `service_role` from `.env` and verifies the caller's JWT belongs to an active admin before doing anything.

```bash
python3 tools/auth/admin_server.py > /tmp/immuvi-admin.log 2>&1 &
disown
```

Listens on `http://127.0.0.1:8103` with CORS for `http://localhost:8102`.

If this server isn't running, the Admin tab shows a banner with the start command — admin operations gracefully fail until it's up.

## Full local stack

```bash
cd "/Users/gauravpataila/Documents/Claude/Clickup "
python3 -m http.server 8102                     > /tmp/immuvi-preview.log 2>&1 &
python3 tools/classify_worker.py                > /tmp/immuvi-worker.log  2>&1 &
python3 tools/auth/admin_server.py              > /tmp/immuvi-admin.log   2>&1 &
disown
# open http://localhost:8102/immuvi-command-center.html
```
