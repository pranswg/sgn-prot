-- Keep the contact email separate from the login key.
--
-- A Supabase Auth user's email is the login key, and sign-in maps a username to
-- `<username>@choir.internal`. `handle_new_user` previously copied the Auth
-- email straight onto `profiles.email`; once `admin-create-user` started using
-- the synthetic address for Auth, that column would have shown the internal
-- address instead of the real contact email. Prefer an explicit `email` in the
-- user metadata (the real contact address) and fall back to the Auth email only
-- when none is provided (e.g. the seeded admin).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_username text := lower(coalesce(meta ->> 'username', split_part(new.email, '@', 1)));
  v_email text := coalesce(nullif(meta ->> 'email', ''), new.email);
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
    v_email,
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
