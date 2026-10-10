# Backend implementation notes (machine-local, gitignored)

This file records how the Supabase backend was wired up so a future session can
pick the work back up. It is intentionally **not committed** (`BACKEND-NOTES.md`
is ignored) because it names the specific hosted project and one-off details.

## Hosted project

- Project ref: `rqhfmbwsfxkyedczitni` (name "choirmanager v3", region Singapore).
- URL: `https://rqhfmbwsfxkyedczitni.supabase.co`
- Client config lives in `.env.local` (gitignored via `*.local`):
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY` (public anon key — safe in the bundle)
- The **service_role key** was read from the dashboard only to verify tables over
  REST during Phase 1. It is deliberately **not stored anywhere** and must never
  be committed or shipped to the browser. Do not add it to `.env.local`.

## What was accessed

- `supabase` CLI v2.117.0 (linked to the project with `supabase link`).
- The hosted Postgres database (`supabase db push` applied every migration).
- Supabase Auth (email/password provider) for the auth swap.
- The Data API (REST) with the service_role key, for one-off verification only.

No Docker is installed on this machine, so `supabase db dump` / `db inspect` are
unavailable; verify schema/data through the dashboard or the REST API instead.

## Phase log

1. **Phase 1 — scaffold (done).** `supabase/migrations/`:
   - `0001_schema.sql` — one table per store (JSONB `data`), normalized
     `profiles`/`roles`/`role_permissions`/`audit_logs`/`login_history`.
   - `0002_rls.sql` — authenticated read, `service_role` write, explicit grants.
   - `0003_seed.sql` — new-user profile trigger, builtin `admin` role (20
     permissions), seeded Admin `admin` / `admin1234` → `admin@choir.local`.
2. **Phase 2 — auth swap (done).**
   - Added `@supabase/supabase-js`, `src/lib/supabase.ts` (lazy client),
     `src/lib/authIdentity.ts` (username↔email + profile→Account mapping).
   - `authStore` now signs in/out through Supabase Auth, restores the session on
     load, caches `public.profiles` into `accounts`, and supports
     change-own-password.
   - `0004_password_change.sql` — `public.mark_password_changed()` RPC, because
     RLS blocks client profile writes but the `must_change_password` flag must be
     cleared after a self-service change.
   - `AuthPage` is sign-in only (public registration removed);
     `AdministrationPage` is read-only (`READ_ONLY` flag).

## How to run

```bash
npm run db:push     # apply migrations to the linked project
npm run db:lint     # lint the migrations
npm run verify      # typecheck + tests + lint (the gate)
```

`npm run db:push` needs the CLI linked (`supabase link --project-ref <ref>`);
it cannot run on an unlinked machine. The app itself needs `.env.local` present.

## Deferred / next

- Admin account + role CRUD needs the service-role Admin API (edge function) and
  the Phase 5 write policies; until then the store methods return a
  "temporarily unavailable" problem and the Administration UI is read-only.
- Read-only data pages, write-through stores, RBAC enforcement, offline, then
  backup import (last). See `backend-plan.md` on the Desktop.
- Cleanup: `credentials.ts` hashing (`hashPassword`/`verifyPassword`/`sha256Hex`)
  is unused by the app but still pinned by `credentials.test.ts`.
