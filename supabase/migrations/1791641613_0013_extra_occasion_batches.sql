-- Multiple Extra Occasion (planning sessions). A batch is a thin session
-- registry: its `data` doc holds `{ id, name, createdAt, updatedAt }`. Which
-- occasions belong to it is derived from `suguans.data->>'extraOccasionBatchId'`
-- rather than a stored list, so membership cannot drift.
--
-- Posture mirrors the other shared data tables (0001/0002/0011): reads are open
-- to any authenticated user; writes are permission-gated per command through
-- `public.has_permission()`. The client upserts, so create/edit are unioned on
-- insert+update; delete takes its own permission.

create table if not exists public.extra_occasion_batches (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.extra_occasion_batches enable row level security;

create policy "authenticated read extra_occasion_batches"
  on public.extra_occasion_batches
  for select to authenticated using (true);

create policy "extra occasion batch insert" on public.extra_occasion_batches
  for insert to authenticated
  with check (
    public.has_permission('create-suguan') or public.has_permission('edit-suguan')
  );
create policy "extra occasion batch update" on public.extra_occasion_batches
  for update to authenticated
  using (
    public.has_permission('edit-suguan') or public.has_permission('create-suguan')
  )
  with check (
    public.has_permission('edit-suguan') or public.has_permission('create-suguan')
  );
create policy "extra occasion batch delete" on public.extra_occasion_batches
  for delete to authenticated
  using (public.has_permission('delete-suguan'));

create policy "service_role write extra_occasion_batches"
  on public.extra_occasion_batches
  for all to service_role using (true) with check (true);

grant select on public.extra_occasion_batches to authenticated;
grant select, insert, update, delete on public.extra_occasion_batches to service_role;
