-- Phase 5e: replace the interim "any authenticated user may write" policies
-- from 0006-0009 with permission-based RLS. Authorization runs through the
-- SECURITY DEFINER `public.has_permission()` from 0010, which reads the caller's
-- profile + role permissions and is already granted to `authenticated`.
--
-- The client write path upserts members/trainees/suguans/koro/organista rows,
-- and Postgres evaluates BOTH the INSERT and UPDATE policies on an upsert, so
-- the create and edit permissions are unioned on insert and update (a role that
-- can edit may also upsert a new row). Deletes take their own permission.
-- Reads are unchanged: still open to any authenticated user.
--
-- profiles/roles/role_permissions keep no direct authenticated write policy;
-- those writes stay on the 0010 RPCs and the `admin` Edge Function.

drop policy if exists "authenticated write settings" on public.settings;
drop policy if exists "authenticated write members" on public.members;
drop policy if exists "authenticated write trainees" on public.trainees;
drop policy if exists "authenticated write suguans" on public.suguans;
drop policy if exists "authenticated write koro_documents" on public.koro_documents;
drop policy if exists "authenticated write organista_suguans" on public.organista_suguans;

-- members: add/edit either way, delete on its own permission.
create policy "member insert" on public.members
  for insert to authenticated
  with check (
    public.has_permission('add-members') or public.has_permission('edit-members')
  );
create policy "member update" on public.members
  for update to authenticated
  using (
    public.has_permission('edit-members') or public.has_permission('add-members')
  )
  with check (
    public.has_permission('edit-members') or public.has_permission('add-members')
  );
create policy "member delete" on public.members
  for delete to authenticated
  using (public.has_permission('delete-members'));

-- trainees: one permission covers every command.
create policy "trainee insert" on public.trainees
  for insert to authenticated
  with check (public.has_permission('manage-trainees'));
create policy "trainee update" on public.trainees
  for update to authenticated
  using (public.has_permission('manage-trainees'))
  with check (public.has_permission('manage-trainees'));
create policy "trainee delete" on public.trainees
  for delete to authenticated
  using (public.has_permission('manage-trainees'));

-- suguans: create/edit either way, delete on its own permission.
create policy "suguan insert" on public.suguans
  for insert to authenticated
  with check (
    public.has_permission('create-suguan') or public.has_permission('edit-suguan')
  );
create policy "suguan update" on public.suguans
  for update to authenticated
  using (
    public.has_permission('edit-suguan') or public.has_permission('create-suguan')
  )
  with check (
    public.has_permission('edit-suguan') or public.has_permission('create-suguan')
  );
create policy "suguan delete" on public.suguans
  for delete to authenticated
  using (public.has_permission('delete-suguan'));

-- organista_suguans: the Organist Suguan maker is gated by create-suguan, so it
-- shares the Suguan permission set.
create policy "organista suguan insert" on public.organista_suguans
  for insert to authenticated
  with check (
    public.has_permission('create-suguan') or public.has_permission('edit-suguan')
  );
create policy "organista suguan update" on public.organista_suguans
  for update to authenticated
  using (
    public.has_permission('edit-suguan') or public.has_permission('create-suguan')
  )
  with check (
    public.has_permission('edit-suguan') or public.has_permission('create-suguan')
  );
create policy "organista suguan delete" on public.organista_suguans
  for delete to authenticated
  using (public.has_permission('delete-suguan'));

-- koro_documents: the Koro maker is gated by edit-members.
create policy "koro insert" on public.koro_documents
  for insert to authenticated
  with check (public.has_permission('edit-members'));
create policy "koro update" on public.koro_documents
  for update to authenticated
  using (public.has_permission('edit-members'))
  with check (public.has_permission('edit-members'));
create policy "koro delete" on public.koro_documents
  for delete to authenticated
  using (public.has_permission('edit-members'));

-- settings: change-settings only.
create policy "settings insert" on public.settings
  for insert to authenticated
  with check (public.has_permission('change-settings'));
create policy "settings update" on public.settings
  for update to authenticated
  using (public.has_permission('change-settings'))
  with check (public.has_permission('change-settings'));
create policy "settings delete" on public.settings
  for delete to authenticated
  using (public.has_permission('change-settings'));
