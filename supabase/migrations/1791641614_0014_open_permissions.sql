-- Phase 5f: every permission is grantable, and the Koro Maker page gets its own
-- permission.
--
-- The administrator decides which role holds which permission, so the
-- `admin_only_permissions()` list is emptied: the RPCs and `current_permissions()`
-- still call it, so leaving the function in place (returning nothing) keeps the
-- filter intact as the single place to re-restrict a permission later.
--
-- This mirrors src/lib/rbac.ts and is pinned by src/lib/rbacParity.test.ts,
-- which reads the last `@permissions`/`@admin-only` block across the migrations.

-- @permissions-begin
create or replace function public.all_permissions()
returns text[]
language sql
immutable
as $$
  select array[
    'view-dashboard',
    'view-master-list',
    'add-members',
    'edit-members',
    'delete-members',
    'manage-trainees',
    'manage-membership-history',
    'koro-maker',
    'view-suguan',
    'create-suguan',
    'edit-suguan',
    'assign-members',
    'delete-suguan',
    'export-documents',
    'manage-users',
    'manage-roles',
    'view-audit-logs',
    'change-settings',
    'restore-data',
    'view-login-history',
    'manage-sessions'
  ]::text[];
$$;
-- @permissions-end

-- @admin-only-begin
create or replace function public.admin_only_permissions()
returns text[]
language sql
immutable
as $$
  select array[]::text[];
$$;
-- @admin-only-end

-- The builtin Admin row: keep the stored permission set complete so the role
-- matrix and the Admin card count agree with `all_permissions()`.
insert into public.role_permissions (role_id, permission)
values ('admin', 'koro-maker')
on conflict do nothing;

-- The Koro Maker page has its own permission now; its document writes accept it
-- alongside the original `edit-members`, so a role can be granted the Koro Maker
-- on its own. (Phase 5e's policies on koro_documents were `edit-members` only.)
drop policy if exists "koro insert" on public.koro_documents;
drop policy if exists "koro update" on public.koro_documents;
drop policy if exists "koro delete" on public.koro_documents;

create policy "koro insert" on public.koro_documents
  for insert to authenticated
  with check (
    public.has_permission('edit-members') or public.has_permission('koro-maker')
  );
create policy "koro update" on public.koro_documents
  for update to authenticated
  using (
    public.has_permission('edit-members') or public.has_permission('koro-maker')
  )
  with check (
    public.has_permission('edit-members') or public.has_permission('koro-maker')
  );
create policy "koro delete" on public.koro_documents
  for delete to authenticated
  using (
    public.has_permission('edit-members') or public.has_permission('koro-maker')
  );
