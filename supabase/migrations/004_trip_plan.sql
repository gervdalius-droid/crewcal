-- Whossup: keep the AI trip plan (travel, stays, things to do) with the event so the whole crew sees it.
alter table public.events add column if not exists trip_plan jsonb;
