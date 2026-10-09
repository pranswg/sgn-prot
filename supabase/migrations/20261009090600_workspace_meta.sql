-- Workspace initialisation marker and the factory reset.
--
-- The client's first-run rule used to be "seed the browser's rows up whenever a
-- collection is empty on the server". That rule resurrects data after a wipe:
-- any device still holding a cached copy would push it back. `workspace_meta`
-- records whether the workspace has ever been initialised, and the client seeds
-- only while that is false. A factory reset keeps it true, so a stale device can
-- never re-upload an emptied workspace.
--
-- `reset_workspace()` is the data half of the factory reset; the account half
-- (deleting every auth user and recreating the default admin) lives in the
-- `admin-reset-workspace` Edge Function, which calls this with the service role.

create table if not exists public.workspace_meta (
  id int primary key default 1,
  initialized boolean not null default false,
  reset_at timestamptz,
  constraint workspace_meta_singleton check (id = 1)
);

-- A workspace that already holds data predates this marker, so it counts as
-- initialised. This closes the re-seed window on the deploy that adds the table.
insert into public.workspace_meta (id, initialized)
values (
  1,
  exists (select 1 from public.workspace_records)
    or exists (select 1 from public.workspace_settings)
)
on conflict (id) do nothing;

alter table public.workspace_meta enable row level security;

drop policy if exists "workspace_meta_select" on public.workspace_meta;
create policy "workspace_meta_select" on public.workspace_meta
  for select to authenticated
  using (public.workspace_access());

grant select on public.workspace_meta to authenticated;
revoke all on public.workspace_meta from anon;

-- Flip the marker once the first device has seeded. Low risk, so any active user
-- may call it; nothing else about the marker is client-writable.
create or replace function public.mark_workspace_initialized()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_active_user() then
    raise exception 'not authorised';
  end if;

  update public.workspace_meta set initialized = true where id = 1;
end;
$$;

-- Wipe every user-authored row and the security trail, then mark the workspace
-- initialised so no browser seeds it back. Callable by the service role (the
-- Edge Function) or an admin with `restore-data`.
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

  delete from public.workspace_records;
  delete from public.workspace_settings;
  delete from public.audit_logs;
  delete from public.login_events;

  insert into public.workspace_meta (id, initialized, reset_at)
  values (1, true, now())
  on conflict (id) do update
    set initialized = true, reset_at = now();
end;
$$;
