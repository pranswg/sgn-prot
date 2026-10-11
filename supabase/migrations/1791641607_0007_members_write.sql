-- Phase 4b: client write path for the Master List. Members and trainees are one
-- row each (the Phase 1 `id` + JSONB `data` shape), so write-through upserts and
-- deletes a single row per action.
--
-- Interim policy: any authenticated user may write. Phase 5 replaces this with
-- the 20-permission RLS; the remaining data tables stay service_role-only until
-- their own write-through sub-phases (4c-4d) add the same policy.
create policy "authenticated write members" on public.members
  for all to authenticated using (true) with check (true);
create policy "authenticated write trainees" on public.trainees
  for all to authenticated using (true) with check (true);

grant insert, update, delete on public.members to authenticated;
grant insert, update, delete on public.trainees to authenticated;
