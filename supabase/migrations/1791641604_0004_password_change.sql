-- Phase 2: self-service password change. Supabase Auth owns the actual password
-- (updated client-side via auth.updateUser), but a profile's
-- `must_change_password` flag has to be cleared server-side. RLS blocks direct
-- profile writes for authenticated users, so this narrow security-definer RPC
-- clears only that one flag, and only for the caller. Admin account/role writes
-- stay service_role-only until Phase 5.
create or replace function public.mark_password_changed()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles
     set must_change_password = false,
         updated_at = now()
   where id = auth.uid();
$$;

revoke all on function public.mark_password_changed() from public;
grant execute on function public.mark_password_changed() to authenticated;
