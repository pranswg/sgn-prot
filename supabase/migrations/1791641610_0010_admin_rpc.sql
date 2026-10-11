-- Phase 5a: admin write path via SECURITY DEFINER RPCs. Reads stay open (0002);
-- these RPCs are the only authenticated write path for roles, role_permissions,
-- and profile metadata. roles/role_permissions keep their service_role-only
-- table policies, so the RPCs (owned by the table owner) are the sole client
-- route. GoTrue-dependent writes (create user, reset password, ban) live in the
-- `admin` Edge Function.
--
-- The permission model below mirrors src/lib/rbac.ts and is pinned by
-- src/lib/rbacParity.test.ts (it parses the two marked array literals).

alter table public.profiles add column if not exists status_reason text;

-- @permissions-begin
create or replace function public.all_permissions()
returns text[]
language sql
immutable
as $$
  select array[
    'view-dashboard',
    'view-master-list',
    'add-members',
    'edit-members',
    'delete-members',
    'manage-trainees',
    'manage-membership-history',
    'view-suguan',
    'create-suguan',
    'edit-suguan',
    'assign-members',
    'delete-suguan',
    'export-documents',
    'manage-users',
    'manage-roles',
    'view-audit-logs',
    'change-settings',
    'restore-data',
    'view-login-history',
    'manage-sessions'
  ]::text[];
$$;
-- @permissions-end

-- @admin-only-begin
create or replace function public.admin_only_permissions()
returns text[]
language sql
immutable
as $$
  select array[
    'manage-users',
    'manage-roles',
    'view-audit-logs',
    'change-settings',
    'restore-data',
    'view-login-history',
    'manage-sessions',
    'manage-membership-history'
  ]::text[];
$$;
-- @admin-only-end

-- admin → every permission; otherwise custom_permissions when set, else the
-- role's granted permissions, always stripped of admin-only permissions.
create or replace function public.current_permissions()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_custom text[];
  v_perms text[];
begin
  select role, custom_permissions into v_role, v_custom
  from public.profiles where id = auth.uid();

  if v_role = 'admin' then
    return public.all_permissions();
  end if;

  if v_custom is not null then
    v_perms := v_custom;
  else
    select coalesce(array_agg(permission), '{}')
      into v_perms
      from public.role_permissions where role_id = v_role;
  end if;

  return array(
    select p from unnest(coalesce(v_perms, '{}')) p
    where p = any(public.all_permissions())
      and not (p = any(public.admin_only_permissions()))
  );
end;
$$;

create or replace function public.has_permission(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select perm = any(public.current_permissions());
$$;

revoke all on function public.all_permissions() from public;
revoke all on function public.admin_only_permissions() from public;
revoke all on function public.current_permissions() from public;
revoke all on function public.has_permission(text) from public;
grant execute on function public.has_permission(text) to authenticated;

-- Role CRUD ------------------------------------------------------------------

create or replace function public.admin_create_role(
  p_label text,
  p_description text,
  p_permissions text[]
)
returns public.roles
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id text := 'custom-' || encode(gen_random_bytes(6), 'hex');
  v_role public.roles;
begin
  if not public.has_permission('manage-roles') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if coalesce(trim(p_label), '') = '' then
    raise exception 'role label is required' using errcode = '22023';
  end if;

  insert into public.roles (id, label, description, builtin)
  values (v_id, trim(p_label), coalesce(p_description, ''), false)
  returning * into v_role;

  insert into public.role_permissions (role_id, permission)
  select v_id, p
  from unnest(coalesce(p_permissions, '{}')) p
  where p = any(public.all_permissions())
    and not (p = any(public.admin_only_permissions()))
  on conflict do nothing;

  return v_role;
end;
$$;

create or replace function public.admin_update_role(
  p_role_id text,
  p_label text,
  p_description text
)
returns public.roles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.roles;
begin
  if not public.has_permission('manage-roles') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_role_id = 'admin' then
    raise exception 'the builtin Admin role cannot be changed' using errcode = '42501';
  end if;
  if coalesce(trim(p_label), '') = '' then
    raise exception 'role label is required' using errcode = '22023';
  end if;

  update public.roles
    set label = trim(p_label), description = coalesce(p_description, '')
    where id = p_role_id and builtin = false
    returning * into v_role;

  if not found then
    raise exception 'role not found' using errcode = 'P0002';
  end if;
  return v_role;
end;
$$;

create or replace function public.admin_delete_role(p_role_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('manage-roles') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_role_id = 'admin' then
    raise exception 'the builtin Admin role cannot be deleted' using errcode = '42501';
  end if;
  if exists (select 1 from public.roles where id = p_role_id and builtin) then
    raise exception 'builtin roles cannot be deleted' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles where role = p_role_id) then
    raise exception 'role is assigned to one or more accounts' using errcode = '23503';
  end if;

  delete from public.roles where id = p_role_id and builtin = false;
  if not found then
    raise exception 'role not found' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.admin_set_role_permissions(
  p_role_id text,
  p_permissions text[]
)
returns text[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perms text[];
begin
  if not public.has_permission('manage-roles') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_role_id = 'admin' then
    raise exception 'the builtin Admin role always has every permission' using errcode = '42501';
  end if;
  if not exists (select 1 from public.roles r where r.id = p_role_id and r.builtin = false) then
    raise exception 'role not found' using errcode = 'P0002';
  end if;

  delete from public.role_permissions rp where rp.role_id = p_role_id;
  insert into public.role_permissions (role_id, permission)
  select p_role_id, p
  from unnest(coalesce(p_permissions, '{}')) p
  where p = any(public.all_permissions())
    and not (p = any(public.admin_only_permissions()))
  on conflict do nothing;

  select coalesce(array_agg(permission), '{}')
    into v_perms
    from public.role_permissions rp where rp.role_id = p_role_id;
  return v_perms;
end;
$$;

-- Account metadata + status ---------------------------------------------------

create or replace function public.admin_update_account_metadata(
  p_user_id uuid,
  p_full_name text,
  p_email text,
  p_role text,
  p_custom_permissions text[]
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_perms text[];
begin
  if not public.has_permission('manage-users') then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  if p_custom_permissions is not null then
    v_perms := array(
      select p from unnest(p_custom_permissions) p
      where p = any(public.all_permissions())
        and not (p = any(public.admin_only_permissions()))
    );
  else
    v_perms := null;
  end if;

  update public.profiles
    set full_name = coalesce(nullif(trim(p_full_name), ''), full_name),
        email = p_email,
        role = coalesce(nullif(trim(p_role), ''), role),
        custom_permissions = v_perms,
        updated_at = now()
    where id = p_user_id
    returning * into v_profile;

  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;

create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status text,
  p_status_reason text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if not public.has_permission('manage-users') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if p_status not in ('active', 'disabled', 'suspended', 'pending-activation') then
    raise exception 'invalid status' using errcode = '22023';
  end if;

  update public.profiles
    set status = p_status, status_reason = p_status_reason, updated_at = now()
    where id = p_user_id
    returning * into v_profile;

  if not found then
    raise exception 'account not found' using errcode = 'P0002';
  end if;
  return v_profile;
end;
$$;

revoke all on function public.admin_create_role(text, text, text[]) from public;
revoke all on function public.admin_update_role(text, text, text) from public;
revoke all on function public.admin_delete_role(text) from public;
revoke all on function public.admin_set_role_permissions(text, text[]) from public;
revoke all on function public.admin_update_account_metadata(uuid, text, text, text, text[]) from public;
revoke all on function public.admin_set_account_status(uuid, text, text) from public;

grant execute on function public.admin_create_role(text, text, text[]) to authenticated;
grant execute on function public.admin_update_role(text, text, text) to authenticated;
grant execute on function public.admin_delete_role(text) to authenticated;
grant execute on function public.admin_set_role_permissions(text, text[]) to authenticated;
grant execute on function public.admin_update_account_metadata(uuid, text, text, text, text[]) to authenticated;
grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated;
