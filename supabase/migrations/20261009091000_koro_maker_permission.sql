-- Give Koro Maker its own grantable permission.
--
-- Koro documents were gated behind the generic `edit-members` permission, so a
-- role could not be given Koro access without also letting it edit the Master
-- List. `manage-koro` is now a first-class permission the role editor exposes;
-- `edit-members` stays accepted so roles created before this change keep the
-- access they already had.

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
      or public.has_permission('edit-members')
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
      or public.has_permission('edit-members')
    when 'assignment-presets' then
      public.has_permission('create-suguan')
      or public.has_permission('edit-suguan')
    else false
  end;
$$;
