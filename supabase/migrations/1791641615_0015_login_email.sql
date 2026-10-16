-- Sign-in accepts a username or an email, but Supabase Auth keys on an email.
-- The Create User form's Email field becomes the account's GoTrue identity, so
-- an admin-created account can carry a real address (`juan@example.com`) instead
-- of the synthetic `<username>@choir.local` the username login used to assume —
-- which made a username sign-in fail for exactly those accounts while their
-- email worked.
--
-- This function lets the sign-in screen turn a username into the address GoTrue
-- will actually accept. It reads `auth.users`, not `profiles.email`, because the
-- Administration screen can edit the profile's display email without touching
-- the GoTrue identity; only `auth.users.email` is guaranteed to be the address
-- `signInWithPassword` checks. NULL means "no such account", and the client falls
-- back to the synthetic form.
--
-- SECURITY DEFINER because `profiles` reads need a session and this runs before
-- one exists, so it is the one anon-readable surface over the accounts: it
-- returns a single address for an exact username, never a list, and NULL both
-- for an unknown username and for an account without an address. If that
-- exposure is ever unacceptable, put every account's identity onto the synthetic
-- address and drop this function.

create or replace function public.resolve_login_email(p_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select nullif(lower(trim(u.email)), '')
    from public.profiles p
    join auth.users u on u.id = p.id
   where lower(trim(p.username)) = lower(trim(p_username))
   limit 1;
$$;

revoke all on function public.resolve_login_email(text) from public;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
