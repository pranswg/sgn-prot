-- Fix the factory reset under pg-safeupdate.
--
-- Supabase preloads `safeupdate`, which raises "DELETE requires a WHERE clause"
-- on any DELETE without a predicate — even inside a SECURITY DEFINER function
-- running as the (non-superuser) `postgres` role. The bare deletes in
-- `reset_workspace()` therefore failed before wiping anything, so the reset
-- silently did nothing. An always-true predicate is the documented full-table
-- form (`WHERE 1=1`), so no rows are actually spared.

create or replace function public.reset_workspace()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_service_role() or public.has_permission('restore-data')) then
    raise exception 'not authorised';
  end if;

  delete from public.workspace_records where true;
  delete from public.workspace_settings where true;
  delete from public.audit_logs where true;
  delete from public.login_events where true;

  insert into public.workspace_meta (id, initialized, reset_at)
  values (1, true, now())
  on conflict (id) do update set initialized = true, reset_at = now();
end;
$$;
