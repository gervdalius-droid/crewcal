-- Whossup: frictionless joining.
-- 1) New crews let anyone with the invite link straight in (admins can still turn approval on per crew).
-- 2) Guest (anonymous) accounts are normal "authenticated" users, so every existing RLS rule already applies.
--    Turn them on in Dashboard → Authentication → Sign In / Providers → "Allow anonymous sign-ins".
alter table public.groups alter column require_approval set default false;
