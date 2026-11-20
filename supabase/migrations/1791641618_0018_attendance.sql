-- Phase 6 write-through: attendance sheets (Master List attendance records)
-- live one-per-row as JSONB docs, like the other stores. A sheet stores the
-- export options it was created from plus who was marked present per date.
create table if not exists public.attendance_sheets (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.attendance_sheets enable row level security;

-- Reads: any signed-in user can see the attendance history of their choir.
drop policy if exists "authenticated read attendance_sheets" on public.attendance_sheets;
create policy "authenticated read attendance_sheets"
  on public.attendance_sheets
  for select to authenticated
  using (true);

-- Writes are permission gated: creating a sheet / marking present manages
-- member attendance, so it requires edit-members (the same gate the "mark
-- present" action uses). export-documents is also accepted so the Export menu
-- path and the direct "New Attendance Sheet" button stay in sync.
drop policy if exists "attendance insert attendance_sheets" on public.attendance_sheets;
create policy "attendance insert attendance_sheets"
  on public.attendance_sheets
  for insert to authenticated
  with check (
    public.has_permission('edit-members')
    or public.has_permission('export-documents')
  );
drop policy if exists "attendance update attendance_sheets" on public.attendance_sheets;
create policy "attendance update attendance_sheets"
  on public.attendance_sheets
  for update to authenticated
  using (public.has_permission('edit-members'))
  with check (public.has_permission('edit-members'));
drop policy if exists "attendance delete attendance_sheets" on public.attendance_sheets;
create policy "attendance delete attendance_sheets"
  on public.attendance_sheets
  for delete to authenticated
  using (public.has_permission('edit-members'));

-- Service role owns every write path (Phase 2-style imports, future admin API).
drop policy if exists "service_role write attendance_sheets" on public.attendance_sheets;
create policy "service_role write attendance_sheets"
  on public.attendance_sheets
  for all to service_role
  using (true)
  with check (true);

grant select on public.attendance_sheets to authenticated;
grant select, insert, update, delete on public.attendance_sheets to service_role;
