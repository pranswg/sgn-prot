-- Data access requires a completed password change.
--
-- New accounts are provisioned with `must_change_password = true` and the client
-- shows the change-password screen first, but nothing server-side stopped such a
-- user from reading or writing the workspace through the API. `workspace_access()`
-- gates every workspace read/write on the password change being done.
--
-- It is deliberately separate from `is_active_user()` so the profiles policy
-- (which the change-password flow needs to read its own row) is unaffected.

create or replace function public.workspace_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and status = 'active'
      and must_change_password = false
  );
$$;

create or replace function public.can_read_collection(col text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.workspace_access() and case col
    when 'members' then
      public.has_permission('view-master-list')
    when 'trainees' then
      public.has_permission('manage-trainees')
      or public.has_permission('view-master-list')
    when 'suguan-records' then
      public.has_permission('view-suguan')
      or public.has_permission('create-suguan')
      or public.has_permission('edit-suguan')
    when 'organista-suguan-records' then
      public.has_permission('view-suguan')
      or public.has_permission('create-suguan')
    when 'koro-documents' then
      public.has_permission('edit-members')
    when 'assignment-presets' then
      public.has_permission('create-suguan')
      or public.has_permission('edit-suguan')
    else false
  end;
$$;

create or replace function public.can_write_collection(col text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.workspace_access() and case col
    when 'members' then
      public.has_permission('add-members')
      or public.has_permission('edit-members')
      or public.has_permission('delete-members')
    when 'trainees' then
      public.has_permission('manage-trainees')
    when 'suguan-records' then
      public.has_permission('create-suguan')
      or public.has_permission('edit-suguan')
      or public.has_permission('delete-suguan')
    when 'organista-suguan-records' then
      public.has_permission('create-suguan')
      or public.has_permission('edit-suguan')
      or public.has_permission('delete-suguan')
    when 'koro-documents' then
      public.has_permission('edit-members')
    when 'assignment-presets' then
      public.has_permission('create-suguan')
      or public.has_permission('edit-suguan')
    else false
  end;
$$;

drop policy if exists "workspace_settings_select" on public.workspace_settings;
create policy "workspace_settings_select" on public.workspace_settings
  for select to authenticated
  using (public.workspace_access());

drop policy if exists "workspace_settings_insert" on public.workspace_settings;
create policy "workspace_settings_insert" on public.workspace_settings
  for insert to authenticated
  with check (public.workspace_access() and public.has_permission('change-settings'));

drop policy if exists "workspace_settings_update" on public.workspace_settings;
create policy "workspace_settings_update" on public.workspace_settings
  for update to authenticated
  using (public.workspace_access() and public.has_permission('change-settings'))
  with check (public.workspace_access() and public.has_permission('change-settings'));

drop policy if exists "workspace_settings_delete" on public.workspace_settings;
create policy "workspace_settings_delete" on public.workspace_settings
  for delete to authenticated
  using (public.workspace_access() and public.has_permission('change-settings'));
