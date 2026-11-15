-- Whossup security self-test. Paste into the SQL editor AFTER 001_crewcal_v2.sql.
-- Creates three throwaway users inside a transaction, tries every attack as them,
-- and ROLLS BACK — nothing is left behind. Success = "Whossup RLS: all checks passed".
begin;

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-00000000000a', 'alice@verify.local', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000b', 'bob@verify.local',   'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-00000000000c', 'eve@verify.local',   'authenticated', 'authenticated');

create temp table v_ctx (k text primary key, v text);
grant all on v_ctx to authenticated, anon;

create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
$$;

set local role authenticated;

-- Alice: profile + crew
select pg_temp.as_user('00000000-0000-4000-8000-00000000000a');
insert into profiles (id, name) values (auth.uid(), 'Alice');
insert into v_ctx select 'g', (create_group('Verify crew')).id::text;
insert into v_ctx select 'code', invite_code from groups where id = (select v::uuid from v_ctx where k = 'g');
insert into busy_days (day) values ('2030-01-01');
do $$ declare e uuid; begin
  insert into events (group_id, title, starts_on, ends_on) values ((select v::uuid from v_ctx where k = 'g'), 'Secret plan', '2030-01-05', '2030-01-05') returning id into e;
  insert into v_ctx values ('ev', e::text);
  insert into messages (group_id, body) values ((select v::uuid from v_ctx where k = 'g'), 'hello crew');
end $$;

-- Bob: joins with the code → pending
select pg_temp.as_user('00000000-0000-4000-8000-00000000000b');
insert into profiles (id, name) values (auth.uid(), 'Bob');
do $$ declare r json; n int; begin
  r := join_group((select v from v_ctx where k = 'code'));
  if r->>'status' <> 'pending' then raise exception 'FAIL: join should be pending, got %', r; end if;
  select count(*) into n from events; if n <> 0 then raise exception 'FAIL: pending member can read events'; end if;
  select count(*) into n from messages; if n <> 0 then raise exception 'FAIL: pending member can read chat'; end if;
  update members set status = 'active' where user_id = auth.uid();
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL: member approved themselves'; end if;
  select count(*) into n from groups; if n <> 1 then raise exception 'FAIL: pending member should see the crew name (got % rows)', n; end if;
end $$;

-- Eve: an outsider with an account
select pg_temp.as_user('00000000-0000-4000-8000-00000000000c');
insert into profiles (id, name) values (auth.uid(), 'Eve');
do $$ declare n int; begin
  select count(*) into n from groups;    if n <> 0 then raise exception 'FAIL: outsider sees crews'; end if;
  select count(*) into n from members;   if n <> 0 then raise exception 'FAIL: outsider sees members'; end if;
  select count(*) into n from busy_days; if n <> 0 then raise exception 'FAIL: outsider sees busy days'; end if;
  select count(*) into n from profiles;  if n <> 1 then raise exception 'FAIL: outsider sees other profiles'; end if;
  begin
    insert into members (group_id, user_id, role, status) values ((select v::uuid from v_ctx where k = 'g'), auth.uid(), 'admin', 'active');
    raise exception 'FAIL: outsider inserted themselves as admin';
  exception when insufficient_privilege then null; end;
  begin
    insert into events (group_id, title, starts_on, ends_on) values ((select v::uuid from v_ctx where k = 'g'), 'spam', '2030-01-01', '2030-01-01');
    raise exception 'FAIL: outsider created an event';
  exception when insufficient_privilege then null; end;
  begin
    perform rotate_invite((select v::uuid from v_ctx where k = 'g'));
    raise exception 'FAIL: outsider rotated the invite';
  exception when raise_exception then if sqlerrm like 'FAIL%' then raise; end if; end;
  update profiles set plan = 'pro' where id = auth.uid();
  raise exception 'FAIL: user upgraded own plan';
exception when insufficient_privilege then null;
end $$;

-- Alice approves Bob; Bob can now read, but cannot delete Alice's plan or promote himself
select pg_temp.as_user('00000000-0000-4000-8000-00000000000a');
update members set status = 'active' where user_id = '00000000-0000-4000-8000-00000000000b';
select pg_temp.as_user('00000000-0000-4000-8000-00000000000b');
do $$ declare n int; begin
  select count(*) into n from events;    if n <> 1 then raise exception 'FAIL: approved member cannot read events'; end if;
  select count(*) into n from busy_days; if n <> 1 then raise exception 'FAIL: approved member cannot see crewmate busy days'; end if;
  delete from events where id = (select v::uuid from v_ctx where k = 'ev');
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL: member deleted someone else''s plan'; end if;
  update members set role = 'admin' where user_id = auth.uid();
  get diagnostics n = row_count; if n <> 0 then raise exception 'FAIL: member promoted themselves'; end if;
  insert into rsvps (event_id, status) values ((select v::uuid from v_ctx where k = 'ev'), 'going');
  begin
    insert into rsvps (event_id, user_id, status) values ((select v::uuid from v_ctx where k = 'ev'), '00000000-0000-4000-8000-00000000000a', 'no');
    raise exception 'FAIL: RSVP''d on behalf of someone else';
  exception when insufficient_privilege then null; end;
end $$;

-- Signed-out visitor
reset role;
set local role anon;
do $$ begin
  perform 1 from public.groups limit 1;
  raise exception 'FAIL: anon can read groups';
exception when insufficient_privilege then null; end $$;
do $$ begin
  perform join_group('XXXX');
  raise exception 'FAIL: anon can call join_group';
exception when insufficient_privilege then null; end $$;

reset role;
do $$ begin raise notice 'Whossup RLS: all checks passed'; end $$;
select 'Whossup RLS: all checks passed' as result;
rollback;
