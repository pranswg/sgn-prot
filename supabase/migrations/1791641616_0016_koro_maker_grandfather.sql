-- Koro Maker is now gated on its own permission alone.
--
-- `canAccessPage('koro-maker', …)` used to accept `edit-members` as a fallback,
-- because the dedicated `koro-maker` permission (0014) was added after the page
-- already existed and a role granted before it would otherwise have lost the
-- page. The side effect was that the permission could not be revoked: an
-- account that still held Edit Members saw the Koro Maker no matter what the
-- administrator unchecked. The client now requires `koro-maker` by itself.
--
-- This migration grandfathers every grant that could lose access as a result:
-- each role and each per-user permission set that already holds `edit-members`
-- also receives `koro-maker`. Nothing needs re-granting by hand, and an
-- administrator can still revoke the Koro Maker afterwards.
--
-- It intentionally carries no `@permissions`/`@admin-only` markers, so
-- `rbacParity.test.ts` keeps reading the arrays from 0014.

-- Roles: any role holding `edit-members` also gets `koro-maker`.
insert into public.role_permissions (role_id, permission)
select distinct rp.role_id, 'koro-maker'
  from public.role_permissions rp
 where rp.permission = 'edit-members'
on conflict do nothing;

-- Per-user grants override the role, so a profile whose explicit permission set
-- contains `edit-members` needs `koro-maker` added to that same array.
update public.profiles
   set custom_permissions = array_append(custom_permissions, 'koro-maker')
 where custom_permissions is not null
   and 'edit-members' = any (custom_permissions)
   and not ('koro-maker' = any (custom_permissions));
