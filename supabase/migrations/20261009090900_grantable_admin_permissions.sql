-- Custom roles may now hold any permission, including the ones previously
-- reserved for Admins (manage-users, manage-roles, view-audit-logs,
-- change-settings, restore-data, view-login-history, manage-sessions,
-- manage-membership-history). The role editor no longer hides them, so the
-- server must honour a grant instead of silently denying it.
--
-- `has_permission()` keeps its shape: an Admin short-circuits to true, an
-- explicit `custom_permissions` list (even an empty one) is authoritative, and
-- otherwise the role's `role_permissions` rows decide. The only change is that
-- the hardcoded admin-only deny-list is gone.

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
