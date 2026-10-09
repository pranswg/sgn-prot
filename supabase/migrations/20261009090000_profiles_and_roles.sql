-- Accounts, roles, and permission grants for the shared choir workspace.
--
-- Replaces the local `choir-auth` localStorage store. Passwords now live in
-- Supabase Auth (`auth.users`); this schema holds only the profile data the app
-- needs (role, status, must-change-password) plus the role -> permission map.

-- Roles. `admin` is a fixed system role and is never deletable.
create table public.roles (
  id text primary key,
  label text not null,
  description text not null default '',
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

insert into public.roles (id, label, description, is_system)
values ('admin', 'Admin', 'Super Admin with full system access.', true);

-- Permission grants per role. Mirrors `Permission` in src/core/types/auth.ts.
create table public.role_permissions (
  role_id text not null references public.roles (id) on delete cascade,
  permission text not null check (
    permission in (
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
    )
  ),
  primary key (role_id, permission)
);

insert into public.role_permissions (role_id, permission)
select 'admin', permission
from unnest(
  array[
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
  ]
) as permission;

-- One profile per auth user. The id is the auth.users id.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username = lower(username)),
  full_name text not null,
  first_name text not null default '',
  last_name text not null default '',
  email text not null default '',
  role_id text not null references public.roles (id),
  status text not null default 'active' check (
    status in ('active', 'disabled', 'suspended', 'pending-activation')
  ),
  status_reason text,
  custom_permissions text[],
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create index profiles_role_id_idx on public.profiles (role_id);

-- Accounts are created only by the admin Edge Functions (service role) or by
-- the seed function. They pass the profile fields through `user_metadata`; this
-- trigger materialises the row. Public signup is disabled, so the metadata is
-- always server-controlled.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := lower(coalesce(meta ->> 'username', split_part(new.email, '@', 1)));
  v_role text := coalesce(meta ->> 'role_id', '');
begin
  if v_role = '' then
    raise exception 'profiles.role_id must be provided in user metadata';
  end if;

  insert into public.profiles (
    id,
    username,
    full_name,
    first_name,
    last_name,
    email,
    role_id,
    status,
    custom_permissions,
    must_change_password
  )
  values (
    new.id,
    v_username,
    coalesce(meta ->> 'full_name', v_username),
    coalesce(meta ->> 'first_name', ''),
    coalesce(meta ->> 'last_name', ''),
    coalesce(new.email, ''),
    v_role,
    coalesce(meta ->> 'status', 'active'),
    case
      when meta ? 'custom_permissions'
        and jsonb_typeof(meta -> 'custom_permissions') = 'array'
      then array(select jsonb_array_elements_text(meta -> 'custom_permissions'))
      else null
    end,
    coalesce((meta ->> 'must_change_password')::boolean, false)
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- A user may clear their own forced-change flag after updating their password
-- through `supabase.auth.updateUser`. They cannot touch any other column.
create or replace function public.complete_password_change()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
  set must_change_password = false
  where id = auth.uid();
$$;
