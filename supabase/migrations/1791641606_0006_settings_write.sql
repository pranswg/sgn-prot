-- Phase 4a: the first client write path. `settingsStore` and
-- `worshipScheduleStore` share one `settings` row, so opening writes on that
-- single table is all the Settings write-through needs.
--
-- Interim policy: any authenticated user may write. Phase 5 replaces this with
-- the 20-permission RLS; the other data tables stay service_role-only until
-- their own write-through sub-phases (4b-4d) add the same policy to them.
create policy "authenticated write settings" on public.settings
  for all to authenticated using (true) with check (true);

grant insert, update, delete on public.settings to authenticated;
