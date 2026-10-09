-- Workspace data.
--
-- Every user-authored record (members, trainees, saved Suguans, Koro documents,
-- assignment presets) plus the singleton settings documents now live in
-- Postgres, so the workspace is shared across devices and survives a cleared
-- browser. Each row keeps the client's own record as a `jsonb` document: the
-- printable shapes are deeply nested and defined in the client, so this schema
-- owns identity, timestamps, and access, not the document shape. The client
-- validates and normalises a document on the way in and out.
--
-- Records live in one table keyed by `collection` rather than one table per
-- kind, because every collection is read whole and written by id; the
-- collection -> permission mapping lives in one place below.

create table if not exists public.workspace_records (
  id text primary key,
  collection text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_records_collection_idx
  on public.workspace_records (collection);

-- The singleton documents (reference lists, worship schedules). One row per
-- named document; `key` is a client constant such as `settings`.
create table if not exists public.workspace_settings (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workspace_records_touch on public.workspace_records;
create trigger workspace_records_touch
  before update on public.workspace_records
  for each row execute function public.touch_updated_at();

drop trigger if exists workspace_settings_touch on public.workspace_settings;
create trigger workspace_settings_touch
  before update on public.workspace_settings
  for each row execute function public.touch_updated_at();

-- Collection -> permission. SECURITY DEFINER so it can call has_permission()
-- without recursing through profiles RLS. Unknown collections fail closed.
create or replace function public.can_read_collection(col text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_active_user() and case col
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
  select case col
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

alter table public.workspace_records enable row level security;
alter table public.workspace_settings enable row level security;

drop policy if exists "workspace_records_select" on public.workspace_records;
create policy "workspace_records_select" on public.workspace_records
  for select to authenticated
  using (public.can_read_collection(collection));

drop policy if exists "workspace_records_insert" on public.workspace_records;
create policy "workspace_records_insert" on public.workspace_records
  for insert to authenticated
  with check (public.can_write_collection(collection));

drop policy if exists "workspace_records_update" on public.workspace_records;
create policy "workspace_records_update" on public.workspace_records
  for update to authenticated
  using (public.can_write_collection(collection))
  with check (public.can_write_collection(collection));

drop policy if exists "workspace_records_delete" on public.workspace_records;
create policy "workspace_records_delete" on public.workspace_records
  for delete to authenticated
  using (public.can_write_collection(collection));

drop policy if exists "workspace_settings_select" on public.workspace_settings;
create policy "workspace_settings_select" on public.workspace_settings
  for select to authenticated
  using (public.is_active_user());

drop policy if exists "workspace_settings_insert" on public.workspace_settings;
create policy "workspace_settings_insert" on public.workspace_settings
  for insert to authenticated
  with check (public.has_permission('change-settings'));

drop policy if exists "workspace_settings_update" on public.workspace_settings;
create policy "workspace_settings_update" on public.workspace_settings
  for update to authenticated
  using (public.has_permission('change-settings'))
  with check (public.has_permission('change-settings'));

drop policy if exists "workspace_settings_delete" on public.workspace_settings;
create policy "workspace_settings_delete" on public.workspace_settings
  for delete to authenticated
  using (public.has_permission('change-settings'));

grant select, insert, update, delete on public.workspace_records to authenticated;
grant select, insert, update, delete on public.workspace_settings to authenticated;
revoke all on public.workspace_records from anon;
revoke all on public.workspace_settings from anon;
