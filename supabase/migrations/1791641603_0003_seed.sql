-- Phase 1 seed: auto-create a profile for every new Supabase Auth user, and
-- seed the known-backstop Admin login (admin / admin1234) plus the builtin
-- Admin role with every permission from src/lib/rbac.ts. The password is a
-- published default, not a secret; the user should change it after first
-- sign-in (Phase 3 surfaces that flow).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, email)
  values (
    new.id,
    coalesce(nullif(split_part(new.email, '@', 1), ''), 'user'),
    coalesce(new.raw_user_meta_data->>'full_name', new.email, 'User'),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.roles (id, label, description, builtin)
values ('admin', 'Admin', 'Super Admin with full system access.', true)
on conflict (id) do nothing;

insert into public.role_permissions (role_id, permission)
select 'admin', permission
from (values
  ('view-dashboard'),
  ('view-master-list'),
  ('add-members'),
  ('edit-members'),
  ('delete-members'),
  ('manage-trainees'),
  ('manage-membership-history'),
  ('view-suguan'),
  ('create-suguan'),
  ('edit-suguan'),
  ('assign-members'),
  ('delete-suguan'),
  ('export-documents'),
  ('manage-users'),
  ('manage-roles'),
  ('view-audit-logs'),
  ('change-settings'),
  ('restore-data'),
  ('view-login-history'),
  ('manage-sessions')
) as perms (permission)
on conflict do nothing;

do $$
declare
  v_uid uuid;
begin
  select id into v_uid from public.profiles where username = 'admin';
  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_sent_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_uid,
      'authenticated',
      'authenticated',
      'admin@choir.local',
      crypt('admin1234', gen_salt('bf')),
      now(),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      now(),
      now()
    )
    on conflict (email) do nothing;
    insert into public.profiles (id, username, full_name, email, role)
    values (v_uid, 'admin', 'Choir Administrator', 'admin@choir.local', 'admin')
    on conflict (id) do update
      set role = 'admin', status = 'active';
  end if;
end $$;