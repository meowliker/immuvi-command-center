# QA Supabase Project

QA project:

- URL: `https://entgcnlfsnysnwyadzzp.supabase.co`
- Ref: `entgcnlfsnysnwyadzzp`
- Name from Supabase CLI: `Immuvi Test`

The `qa` branch serves legacy HTML through Next.js route handlers. Those
handlers replace the production Supabase URL and anon key at request time when
these environment variables are set:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://entgcnlfsnysnwyadzzp.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<test anon key>
SUPABASE_URL=https://entgcnlfsnysnwyadzzp.supabase.co
```

If those variables are not set, the `qa` branch defaults the browser app to the
`Immuvi Test` project above. It intentionally avoids using production
Supabase browser env vars from `.env.local`.

Do not use production service-role credentials while running destructive QA
workflows. Admin APIs, installers, classifier workers, strategist runs, and
producer runs need separate QA secrets before they should be tested end to end.

The Next.js wrappers for destructive server-side routes require explicit QA
secret names:

```bash
QA_SUPABASE_SERVICE_ROLE_KEY=<test service role key>
QA_SUPABASE_DB_PASSWORD=<test database password>
QA_INSTALL_SKILL_SECRET=<test installer secret>
```

## Schema Setup

The Supabase CLI can see the project, but applying migrations with
`supabase link` / `supabase db push` requires the test database password.

Once the password is available:

```bash
supabase link --project-ref entgcnlfsnysnwyadzzp
supabase db push
```

Then bootstrap the first QA admin:

```bash
python3 tools/auth/bootstrap_admin.py you@example.com --full-name "Your Name"
```

The bootstrap script requires the QA `SUPABASE_URL` and QA
`SUPABASE_SERVICE_ROLE_KEY` in the local environment.
