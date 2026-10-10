-- Phase 2 repair: the raw `auth.users` insert in 0003 left GoTrue's token
-- columns NULL and created no `auth.identities` row, so every password grant
-- failed and the app reported it as a wrong password. GoTrue scans those
-- columns into non-nullable Go strings ("converting NULL to string is
-- unsupported") and resolves email/password sign-in through `auth.identities`.
--
-- 0003 has already been recorded in every environment that pushed it, so
-- editing it cannot retroactively fix a provisioned database. This migration
-- heals the existing Admin row and is idempotent, so it is safe to re-run. The
-- corrected 0003 handles fresh environments.

do $$
declare
  v_uid uuid;
begin
  -- Authoritative lookup by email, then by profile username.
  select id into v_uid from auth.users where email = 'admin@choir.local';
  if v_uid is null then
    select id into v_uid from public.profiles where username = 'admin';
  end if;

  if v_uid is null then
    -- Create the auth user with every token column as an empty string.
    v_uid := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, confirmation_sent_at,
      confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current,
      email_change_confirm_status,
      phone_change, phone_change_token, reauthentication_token,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
      'admin@choir.local',
      extensions.crypt('admin1234', extensions.gen_salt('bf')),
      now(), now(),
      '', '', '', '', '', 0, '', '', '',
      '{"provider": "email", "providers": ["email"]}', '{}', now(), now()
    );
  else
    -- Repair the existing row: reset the published backstop password and fill
    -- every NULL token column. `coalesce` leaves already-correct values alone.
    update auth.users
       set encrypted_password          = extensions.crypt('admin1234', extensions.gen_salt('bf')),
           email_confirmed_at          = coalesce(email_confirmed_at, now()),
           confirmation_token          = coalesce(confirmation_token, ''),
           recovery_token              = coalesce(recovery_token, ''),
           email_change                = coalesce(email_change, ''),
           email_change_token_new      = coalesce(email_change_token_new, ''),
           email_change_token_current  = coalesce(email_change_token_current, ''),
           email_change_confirm_status = coalesce(email_change_confirm_status, 0),
           phone_change                = coalesce(phone_change, ''),
           phone_change_token          = coalesce(phone_change_token, ''),
           reauthentication_token      = coalesce(reauthentication_token, ''),
           updated_at                  = now()
     where id = v_uid;
  end if;

  -- Free the 'admin' username if a stray profile row under a different id owns
  -- it, so the profile upsert below cannot hit the unique constraint.
  update public.profiles
     set username = username || '_' || substr(id::text, 1, 8)
   where username = 'admin' and id <> v_uid;

  -- Companion email identity, required for email/password sign-in. `provider_id`
  -- is NOT NULL since GoTrue 20231117164230 and is the user's id as text.
  insert into auth.identities (
    id, user_id, provider, provider_id, identity_data,
    last_sign_in_at, created_at, updated_at
  )
  select gen_random_uuid(), v_uid, 'email', v_uid::text,
         jsonb_build_object('sub', v_uid::text, 'email', 'admin@choir.local'),
         now(), now(), now()
  where not exists (
    select 1 from auth.identities where user_id = v_uid and provider = 'email'
  );

  -- Ensure the matching profile exists and is an active Admin.
  insert into public.profiles (id, username, full_name, email, role, status)
  values (v_uid, 'admin', 'Choir Administrator', 'admin@choir.local', 'admin', 'active')
  on conflict (id) do update
    set role = 'admin', status = 'active', updated_at = now();
end $$;
