-- Phase 1 RLS posture: any signed-in user may read, writes go through the
-- service_role only (the Phase 2 backup import uses it). Per-table permission
-- policies (the 20 permissions from src/lib/rbac.ts) land in Phase 5/6 when the
-- write path ships.

alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.trainees enable row level security;
alter table public.suguans enable row level security;
alter table public.koro_documents enable row level security;
alter table public.organista_suguans enable row level security;
alter table public.assignment_presets enable row level security;
alter table public.settings enable row level security;
alter table public.roles enable row level security;
alter table public.role_permissions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.login_history enable row level security;

-- Reads: any authenticated user can read shared (non-per-user) tables.
create policy "authenticated read profiles" on public.profiles
  for select to authenticated using (true);
create policy "authenticated read members" on public.members
  for select to authenticated using (true);
create policy "authenticated read trainees" on public.trainees
  for select to authenticated using (true);
create policy "authenticated read suguans" on public.suguans
  for select to authenticated using (true);
create policy "authenticated read koro_documents" on public.koro_documents
  for select to authenticated using (true);
create policy "authenticated read organista_suguans" on public.organista_suguans
  for select to authenticated using (true);
create policy "authenticated read settings" on public.settings
  for select to authenticated using (true);
create policy "authenticated read roles" on public.roles
  for select to authenticated using (true);
create policy "authenticated read role_permissions" on public.role_permissions
  for select to authenticated using (true);
create policy "authenticated read audit_logs" on public.audit_logs
  for select to authenticated using (true);
create policy "authenticated read login_history" on public.login_history
  for select to authenticated using (true);

-- Per-user presets: a signed-in user reads only their own presets.
create policy "owner read assignment_presets" on public.assignment_presets
  for select to authenticated using (auth.uid() = owner_id);

-- Writes: service_role only until Phase 5 turns them on per table. No
-- authenticated write policies are created here, so anything through the anon
-- key is rejected by default.
create policy "service_role write profiles" on public.profiles
  for all to service_role using (true) with check (true);
create policy "service_role write members" on public.members
  for all to service_role using (true) with check (true);
create policy "service_role write trainees" on public.trainees
  for all to service_role using (true) with check (true);
create policy "service_role write suguans" on public.suguans
  for all to service_role using (true) with check (true);
create policy "service_role write koro_documents" on public.koro_documents
  for all to service_role using (true) with check (true);
create policy "service_role write organista_suguans" on public.organista_suguans
  for all to service_role using (true) with check (true);
create policy "service_role write assignment_presets" on public.assignment_presets
  for all to service_role using (true) with check (true);
create policy "service_role write settings" on public.settings
  for all to service_role using (true) with check (true);
create policy "service_role write roles" on public.roles
  for all to service_role using (true) with check (true);
create policy "service_role write role_permissions" on public.role_permissions
  for all to service_role using (true) with check (true);
create policy "service_role write audit_logs" on public.audit_logs
  for all to service_role using (true) with check (true);
create policy "service_role write login_history" on public.login_history
  for all to service_role using (true) with check (true);