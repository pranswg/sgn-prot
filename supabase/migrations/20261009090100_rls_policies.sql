-- Row-level security for accounts and roles.
--
-- All helpers are SECURITY DEFINER with a pinned search_path so they can read
-- `profiles` without recursing through the profiles RLS policy. They are owned
-- by the migration role (postgres), which bypasses RLS internally.

create or replace function public.is_active_user()
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
  );
$$;

create or replace function public.is_admin()
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
      and role_id = 'admin'
      and status = 'active'
  );
$$;

-- Admin-only permissions can never be granted through custom_permissions,
-- mirroring `ADMIN_ONLY_PERMISSIONS` in src/lib/rbac.ts.
create or replace function public.has_permission(perm text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  prof public.profiles;
begin
  select * into prof from public.profiles where id = auth.uid();

  if prof.id is null or prof.status <> 'active' then
    return false;
  end if;

  if prof.role_id = 'admin' then
    return true;
  end if;

  if perm in (
    'manage-users',
    'manage-roles',
    'view-audit-logs',
    'change-settings',
    'restore-data',
    'view-login-history',
    'manage-sessions',
    'manage-membership-history'
  ) then
    return false;
  end if;

  if prof.custom_permissions is not null then
    return perm = any (prof.custom_permissions);
  end if;

  return exists (
    select 1
    from public.role_permissions rp
    where rp.role_id = prof.role_id
      and rp.permission = perm
  );
end;
$$;

alter table public.roles enable row level security;

create policy "roles_select" on public.roles
  for select to authenticated
  using (public.is_active_user());

create policy "roles_insert" on public.roles
  for insert to authenticated
  with check (public.has_permission('manage-roles'));

create policy "roles_update" on public.roles
  for update to authenticated
  using (public.has_permission('manage-roles'))
  with check (public.has_permission('manage-roles'));

create policy "roles_delete" on public.roles
  for delete to authenticated
  using (public.has_permission('manage-roles') and not is_system);

alter table public.role_permissions enable row level security;

create policy "role_permissions_select" on public.role_permissions
  for select to authenticated
  using (public.is_active_user());

create policy "role_permissions_insert" on public.role_permissions
  for insert to authenticated
  with check (public.has_permission('manage-roles'));

create policy "role_permissions_update" on public.role_permissions
  for update to authenticated
  using (public.has_permission('manage-roles'))
  with check (public.has_permission('manage-roles'));

create policy "role_permissions_delete" on public.role_permissions
  for delete to authenticated
  using (public.has_permission('manage-roles'));

alter table public.profiles enable row level security;

-- A user always needs to read their own profile to resolve permissions.
create policy "profiles_select" on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.has_permission('manage-users'));

-- Profile rows are written only by Edge Functions (service role). The one
-- client-side exception is `complete_password_change()`, which is SECURITY
-- DEFINER and updates its own row.
create policy "profiles_update" on public.profiles
  for update to authenticated
  using (public.has_permission('manage-users'))
  with check (public.has_permission('manage-users'));

create policy "profiles_delete" on public.profiles
  for delete to authenticated
  using (public.has_permission('manage-users'));
