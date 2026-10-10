-- Koro documents are gated on `manage-koro` alone.
--
-- The previous migration accepted `edit-members` as a fallback so roles created
-- before the dedicated permission kept their access, but that made the Koro
-- Maker permission impossible to revoke: a role that also edited the Master
-- List still saw Koro. The Koro Maker checkbox is now the only switch.

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
      public.has_permission('manage-koro')
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
      public.has_permission('manage-koro')
    when 'assignment-presets' then
      public.has_permission('create-suguan')
      or public.has_permission('edit-suguan')
    else false
  end;
$$;
