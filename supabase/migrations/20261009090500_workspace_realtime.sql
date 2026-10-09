-- Publish the workspace tables so signed-in clients receive live changes from
-- other devices. The client only needs the change notification; it re-reads the
-- affected collections, so the default replica identity (primary key) is enough.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workspace_records'
  ) then
    alter publication supabase_realtime add table public.workspace_records;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workspace_settings'
  ) then
    alter publication supabase_realtime add table public.workspace_settings;
  end if;
end $$;
