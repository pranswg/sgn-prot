-- Allow `manage-koro` to be stored as a role permission.
--
-- `role_permissions.permission` has a CHECK constraint that enumerates every
-- valid permission. It was written before `manage-koro` existed, so granting the
-- new Koro Maker permission failed with
-- `new row ... violates check constraint "role_permissions_permission_check"`.
-- Drop and recreate the constraint with the full, current list.

alter table public.role_permissions
  drop constraint if exists role_permissions_permission_check;

alter table public.role_permissions
  add constraint role_permissions_permission_check check (
    permission in (
      'view-dashboard',
      'view-master-list',
      'add-members',
      'edit-members',
      'delete-members',
      'manage-trainees',
      'manage-membership-history',
      'view-suguan',
      'create-suguan',
      'edit-suguan',
      'assign-members',
      'delete-suguan',
      'export-documents',
      'manage-koro',
      'manage-users',
      'manage-roles',
      'view-audit-logs',
      'change-settings',
      'restore-data',
      'view-login-history',
      'manage-sessions'
    )
  );

-- Keep the Admin role's stored grants in step with the full permission set.
-- `has_permission()` short-circuits an Admin to true, but the row keeps the
-- table honest for anything that reads it directly.
insert into public.role_permissions (role_id, permission)
values ('admin', 'manage-koro')
on conflict do nothing;
