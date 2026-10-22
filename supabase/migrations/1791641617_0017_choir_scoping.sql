-- Phase 8: give the PNK split a server-side dimension.
--
-- The two choirs (AWS, PNK) were split in the client at store version 8: one
-- member store and one trainee store, each record carrying `choir`, with
-- `choirOf()` reading a missing value as AWS. The database was already carrying
-- those records correctly, because every domain row is a whole JSONB document
-- (`id` + `data`) — so a PNK member upserts and reads back exactly like an AWS
-- one, and no client write path changes here.
--
-- What was missing is a choir the server can address: without one, every report,
-- export and future policy has to parse `data->>'choir'` and remember the AWS
-- default itself. This migration exposes that value as a generated column and
-- indexes it.
--
-- The column is GENERATED from `data`, never written by the client, so the row
-- and its choir cannot drift. The expression mirrors `choirOf()` exactly: only
-- the literal `pnk` is PNK, and a blank, absent or unexpected value is AWS —
-- which is what every row written before store version 8 looks like. Mirroring
-- that (instead of validating the stored value) matters: a hand-edited or
-- half-migrated row the app would read as AWS must not fail the whole upsert.
--
-- Permissions deliberately stay shared. `0011` already scopes members to
-- add/edit/delete-members and trainees to manage-trainees, and those rights cover
-- both lists; the administrator decides who holds them. Nothing here narrows a
-- policy — per-choir permission is a separate decision that would need a new
-- permission, not a silent policy change.

alter table public.members
  add column if not exists choir text
  generated always as (
    case when data ->> 'choir' = 'pnk' then 'pnk' else 'aws' end
  ) stored;

alter table public.trainees
  add column if not exists choir text
  generated always as (
    case when data ->> 'choir' = 'pnk' then 'pnk' else 'aws' end
  ) stored;

-- The Master List, Members History and Dashboard all read one choir at a time.
create index if not exists members_choir_idx on public.members (choir);
create index if not exists trainees_choir_idx on public.trainees (choir);

comment on column public.members.choir is
  'AWS or PNK, derived from data->>''choir''; anything but ''pnk'' is AWS (mirrors choirOf()).';
comment on column public.trainees.choir is
  'AWS or PNK, derived from data->>''choir''; anything but ''pnk'' is AWS (mirrors choirOf()).';
