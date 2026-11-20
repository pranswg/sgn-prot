-- Phase 6b: align attendance write permissions with the UI gate.
-- Migration 0018 created attendance_sheets but gated inserts on
-- export-documents only, while the "New Attendance Sheet" button is shown to
-- anyone on the Attendance tab. Creating / marking attendance is member
-- management, so allow edit-members (and keep export-documents accepted so the
-- Export menu path and the direct button stay in sync).
create table if not exists public.attendance_sheets (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.attendance_sheets enable row level security;

drop policy if exists "authenticated read attendance_sheets" on public.attendance_sheets;
create policy "authenticated read attendance_sheets"
  on public.attendance_sheets
  for select to authenticated
  using (true);

drop policy if exists "export-documents insert attendance_sheets" on public.attendance_sheets;
drop policy if exists "edit-members update attendance_sheets" on public.attendance_sheets;
drop policy if exists "edit-members delete attendance_sheets" on public.attendance_sheets;
drop policy if exists "service_role write attendance_sheets" on public.attendance_sheets;
drop policy if exists "attendance insert attendance_sheets" on public.attendance_sheets;
drop policy if exists "attendance update attendance_sheets" on public.attendance_sheets;
drop policy if exists "attendance delete attendance_sheets" on public.attendance_sheets;

create policy "attendance insert attendance_sheets"
  on public.attendance_sheets
  for insert to authenticated
  with check (
    public.has_permission('edit-members')
    or public.has_permission('export-documents')
  );
create policy "attendance update attendance_sheets"
  on public.attendance_sheets
  for update to authenticated
  using (public.has_permission('edit-members'))
  with check (public.has_permission('edit-members'));
create policy "attendance delete attendance_sheets"
  on public.attendance_sheets
  for delete to authenticated
  using (public.has_permission('edit-members'));

create policy "service_role write attendance_sheets"
  on public.attendance_sheets
  for all to service_role
  using (true)
  with check (true);

grant select on public.attendance_sheets to authenticated;
grant select, insert, update, delete on public.attendance_sheets to service_role;
