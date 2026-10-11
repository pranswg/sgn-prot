-- Phase 4d: client write path for Koro documents, Organist Suguan records, and
-- assignment presets. Each is one JSONB doc per row, so write-through upserts or
-- deletes a single row.
--
-- Interim policy: any authenticated user may write the shared tables (koro,
-- organist suguan) and a user may write only their own presets. Phase 5 replaces
-- this with the 20-permission RLS.
create policy "authenticated write koro_documents" on public.koro_documents
  for all to authenticated using (true) with check (true);
create policy "authenticated write organista_suguans" on public.organista_suguans
  for all to authenticated using (true) with check (true);
create policy "owner write assignment_presets" on public.assignment_presets
  for all to authenticated
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

grant insert, update, delete on public.koro_documents to authenticated;
grant insert, update, delete on public.organista_suguans to authenticated;
grant insert, update, delete on public.assignment_presets to authenticated;
