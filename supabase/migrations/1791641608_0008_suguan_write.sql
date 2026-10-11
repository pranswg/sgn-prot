-- Phase 4c: client write path for saved Suguan records. A Suguan is one row in
-- `suguans` keyed by its id, so write-through upserts or deletes a single row.
--
-- Interim policy: any authenticated user may write. Phase 5 replaces this with
-- the 20-permission RLS; the remaining data tables stay service_role-only until
-- their own write-through sub-phases (4d) add the same policy.
create policy "authenticated write suguans" on public.suguans
  for all to authenticated using (true) with check (true);

grant insert, update, delete on public.suguans to authenticated;
