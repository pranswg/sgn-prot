-- Phase 5d: server-back the admin audit trail. Audit logs and login history
-- were local-only; they now persist to the normalized tables from 0001 and read
-- back under the matching permission. Writes are RPC-only so the actor is always
-- derived from auth.uid(), never trusted from the client. Failed sign-ins have
-- no session, so (for now) they stay client-local.
--
-- Reads on these two security tables ARE permission-gated (unlike the data
-- tables, whose reads stay open): both permissions are admin-only.

drop policy if exists "authenticated read audit_logs" on public.audit_logs;
drop policy if exists "authenticated read login_history" on public.login_history;

create policy "audit log read" on public.audit_logs
  for select to authenticated
  using (public.has_permission('view-audit-logs'));
create policy "login history read" on public.login_history
  for select to authenticated
  using (public.has_permission('view-login-history'));

-- log_audit: records one admin/system action, actor from the session.
create or replace function public.log_audit(
  p_action text,
  p_module text default '',
  p_affected_user_id uuid default null,
  p_affected_user_name text default null,
  p_details text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_name text;
  v_username text;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select full_name, username into v_name, v_username
    from public.profiles where id = v_actor;
  insert into public.audit_logs (
    actor_id, actor_name, actor_username, action, module,
    affected_user_id, affected_user_name, details
  ) values (
    v_actor, coalesce(v_name, ''), coalesce(v_username, ''),
    p_action, coalesce(p_module, ''),
    p_affected_user_id, p_affected_user_name, p_details
  );
end;
$$;

-- log_login: records a successful sign-in, user from the session.
create or replace function public.log_login(
  p_status text,
  p_device text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_name text;
  v_username text;
begin
  if v_actor is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_status not in ('successful', 'failed') then
    raise exception 'invalid login status' using errcode = '22023';
  end if;
  select full_name, username into v_name, v_username
    from public.profiles where id = v_actor;
  insert into public.login_history (
    user_id, user_name, username, device, status
  ) values (
    v_actor, coalesce(v_name, ''), coalesce(v_username, ''),
    coalesce(p_device, ''), p_status
  );
end;
$$;

revoke all on function public.log_audit(text, text, uuid, text, text) from public;
revoke all on function public.log_login(text, text) from public;
grant execute on function public.log_audit(text, text, uuid, text, text) to authenticated;
grant execute on function public.log_login(text, text) to authenticated;
