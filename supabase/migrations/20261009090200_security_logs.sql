-- Audit log, login history, and active-session management.
--
-- Audit and login rows are written by Edge Functions (service role) and by the
-- SECURITY DEFINER helpers below. Active sessions are read from `auth.sessions`
-- rather than mirrored into a custom table.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_name text not null default 'System',
  actor_username text not null default 'system',
  action text not null,
  module text not null,
  affected_user_id uuid,
  affected_user_name text,
  details text,
  created_at timestamptz not null default now()
);

create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;

create policy "audit_logs_select" on public.audit_logs
  for select to authenticated
  using (public.has_permission('view-audit-logs'));

-- Log an action performed by the current user. Kept as a definer function so
-- the actor is always the authenticated caller, never a client-supplied id.
create or replace function public.log_audit(
  p_action text,
  p_module text,
  p_details text default null,
  p_affected_user_id uuid default null,
  p_affected_user_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prof public.profiles;
begin
  if auth.uid() is null then
    return;
  end if;

  select * into prof from public.profiles where id = auth.uid();

  insert into public.audit_logs (
    actor_id,
    actor_name,
    actor_username,
    action,
    module,
    details,
    affected_user_id,
    affected_user_name
  )
  values (
    auth.uid(),
    coalesce(prof.full_name, 'Unknown'),
    coalesce(prof.username, 'unknown'),
    p_action,
    p_module,
    p_details,
    p_affected_user_id,
    p_affected_user_name
  );
end;
$$;

create table public.login_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  username text not null default '',
  full_name text not null default '',
  device text not null default 'Unknown device',
  status text not null check (status in ('success', 'failed')),
  created_at timestamptz not null default now()
);

create index login_events_created_at_idx on public.login_events (created_at desc);

alter table public.login_events enable row level security;

create policy "login_events_select" on public.login_events
  for select to authenticated
  using (public.has_permission('view-login-history'));

-- Called after a successful `signInWithPassword`.
create or replace function public.record_login(p_device text default 'Unknown device')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  prof public.profiles;
begin
  if auth.uid() is null then
    return;
  end if;

  select * into prof from public.profiles where id = auth.uid();

  insert into public.login_events (user_id, username, full_name, device, status)
  values (
    auth.uid(),
    coalesce(prof.username, ''),
    coalesce(prof.full_name, ''),
    coalesce(p_device, 'Unknown device'),
    'success'
  );

  update public.profiles set last_login_at = now() where id = auth.uid();
end;
$$;

-- Called after a failed sign-in attempt. No session exists yet, so it accepts
-- the identifiers the user typed. Service role also writes these on lockout.
create or replace function public.record_login_failed(
  p_username text,
  p_device text default 'Unknown device'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.login_events (user_id, username, full_name, device, status)
  values (null, coalesce(p_username, ''), '', coalesce(p_device, 'Unknown device'), 'failed');
end;
$$;

-- Active sessions, joined to profile names for the Administration screen.
create or replace function public.admin_list_sessions()
returns table (
  id uuid,
  user_id uuid,
  username text,
  full_name text,
  role_id text,
  created_at timestamptz,
  updated_at timestamptz,
  user_agent text,
  ip text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.has_permission('manage-sessions') then
    raise exception 'not authorised';
  end if;

  return query
  select
    s.id,
    s.user_id,
    p.username,
    p.full_name,
    p.role_id,
    s.created_at,
    s.updated_at,
    s.user_agent,
    s.ip
  from auth.sessions s
  left join public.profiles p on p.id = s.user_id;
end;
$$;

create or replace function public.admin_terminate_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_permission('manage-sessions') then
    raise exception 'not authorised';
  end if;

  delete from auth.sessions where id = p_session_id;
end;
$$;

-- True when the request is made with the service-role key (Edge Functions).
create or replace function public.is_service_role()
returns boolean
language sql
stable
as $$
  select auth.role() = 'service_role';
$$;

-- Revoke every session for a user. Called by the admin Edge Functions when an
-- account is disabled, deleted, or has its password reset.
create or replace function public.admin_terminate_user_sessions(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (public.is_service_role() or public.has_permission('manage-sessions')) then
    raise exception 'not authorised';
  end if;

  delete from auth.sessions where user_id = p_user_id;
end;
$$;
