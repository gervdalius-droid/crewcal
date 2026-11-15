-- Run ONLY after everyone has moved to CrewCal v2.
-- The v1 app kept everything in one key/value table `squadcal` that any visitor could read.
-- This keeps the data (for reference/export) but makes it unreachable from the browser.
alter table if exists public.squadcal enable row level security;
do $$ declare p record; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'squadcal' loop
    execute format('drop policy %I on public.squadcal', p.policyname);
  end loop;
end $$;
revoke all on table public.squadcal from anon, authenticated;
-- Also delete the old open `gemini` function: anyone holding the public anon key can call it
-- and spend your Gemini quota.   supabase functions delete gemini
