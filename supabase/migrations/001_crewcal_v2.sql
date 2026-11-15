-- CrewCal v2 schema
-- Replaces the old open key/value table `squadcal` with real tables guarded by
-- row-level security. Every rule is enforced in Postgres; the browser is never trusted.
--
-- Run once in the Supabase SQL editor (or `supabase db push`). Safe to re-run.

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 40),
  color       text not null default '#8b7cff' check (color ~ '^#[0-9a-fA-F]{6}$'),
  plan        text not null default 'free' check (plan in ('free','pro')),
  created_at  timestamptz not null default now()
);

create table if not exists public.groups (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 1 and 50),
  emoji            text not null default '🪩' check (char_length(emoji) <= 8),
  invite_code      text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),
  require_approval boolean not null default true,
  created_by       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at       timestamptz not null default now()
);

create table if not exists public.members (
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       text not null default 'member' check (role in ('admin','member')),
  status     text not null default 'pending' check (status in ('pending','active')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists members_user_idx on public.members(user_id);

-- Availability is personal: one calendar, visible to every crew you share.
create table if not exists public.busy_days (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day     date not null,
  source  text not null default 'manual' check (source in ('manual','import')),
  primary key (user_id, day)
);

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status     text not null default 'planned' check (status in ('planned','idea')),
  title      text not null check (char_length(title) between 1 and 120),
  category   text not null default 'Hangout',
  starts_on  date not null,
  ends_on    date not null,
  start_time time,
  end_time   time,
  location   text not null default '',
  note       text not null default '' check (char_length(note) <= 2000),
  url        text not null default '',
  price_min  numeric(10,2),
  price_max  numeric(10,2),
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists events_group_idx on public.events(group_id, starts_on);

create table if not exists public.rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status   text not null check (status in ('going','maybe','no')),
  primary key (event_id, user_id)
);

create table if not exists public.day_notes (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day        date not null,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists day_notes_group_idx on public.day_notes(group_id, day);

create table if not exists public.messages (
  id         bigint generated always as identity primary key,
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_group_idx on public.messages(group_id, id);

create table if not exists public.expenses (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  event_id   uuid references public.events(id) on delete set null,
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 120),
  amount     numeric(12,2) not null check (amount > 0),
  currency   text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  paid_by    uuid not null references auth.users(id) on delete cascade,
  split_with uuid[] not null check (cardinality(split_with) >= 1),
  created_at timestamptz not null default now()
);
create index if not exists expenses_group_idx on public.expenses(group_id);

-- A settlement is a payment from one member to another that cancels debt.
create table if not exists public.settlements (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups(id) on delete cascade,
  from_user  uuid not null references auth.users(id) on delete cascade,
  to_user    uuid not null references auth.users(id) on delete cascade,
  amount     numeric(12,2) not null check (amount > 0),
  currency   text not null default 'EUR',
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Pro early-access list. Users can add/update their own row but never read the list.
create table if not exists public.waitlist (
  user_id    uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  email      text not null check (char_length(email) <= 200),
  period     text not null default 'year' check (period in ('month','year')),
  created_at timestamptz not null default now()
);

-- Written only by the `ai` edge function (service role).
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month   text not null,
  count   int  not null default 0,
  primary key (user_id, month)
);

-- ─────────────────────────────────────────────────────────────
-- Helpers used by policies (SECURITY DEFINER so they can read
-- members without recursing into members' own RLS).
-- ─────────────────────────────────────────────────────────────

create or replace function public.is_member(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from members where group_id = g and user_id = auth.uid() and status = 'active');
$$;

create or replace function public.is_admin(g uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from members where group_id = g and user_id = auth.uid() and status = 'active' and role = 'admin');
$$;

-- True when `other` and the caller are active in at least one common crew.
create or replace function public.shares_group(other uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select other = auth.uid() or exists(
    select 1 from members a join members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and a.status = 'active'
      and b.user_id = other)
$$;

-- ─────────────────────────────────────────────────────────────
-- RPCs: the only way to create or join a crew.
-- ─────────────────────────────────────────────────────────────

create or replace function public.create_group(p_name text, p_emoji text default '🪩')
returns public.groups language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  insert into groups(name, emoji, created_by) values (trim(p_name), coalesce(nullif(p_emoji,''),'🪩'), auth.uid()) returning * into g;
  insert into members(group_id, user_id, role, status) values (g.id, auth.uid(), 'admin', 'active');
  return g;
end $$;

-- Returns {group_id, name, emoji, status}. Joining twice is harmless.
create or replace function public.join_group(p_code text)
returns json language plpgsql security definer set search_path = public as $$
declare g public.groups; st text;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  select * into g from groups where invite_code = upper(trim(p_code));
  if not found then raise exception 'No crew with that code'; end if;
  insert into members(group_id, user_id, role, status)
    values (g.id, auth.uid(), 'member', case when g.require_approval then 'pending' else 'active' end)
    on conflict (group_id, user_id) do nothing;
  select status into st from members where group_id = g.id and user_id = auth.uid();
  return json_build_object('group_id', g.id, 'name', g.name, 'emoji', g.emoji, 'status', st);
end $$;

-- Lets an invite link show "Join <crew> (5 members)" before joining.
create or replace function public.preview_group(p_code text)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('name', g.name, 'emoji', g.emoji,
    'members', (select count(*) from members m where m.group_id = g.id and m.status = 'active'))
  from groups g where g.invite_code = upper(trim(p_code));
$$;

-- Admins rotate the code when an invite link leaks.
create or replace function public.rotate_invite(g uuid)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if not is_admin(g) then raise exception 'admins only'; end if;
  update groups set invite_code = upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)) where id = g returning invite_code into c;
  return c;
end $$;

-- New SECURITY DEFINER functions are executable by anon by default: close that.
revoke all on function public.is_member(uuid), public.is_admin(uuid), public.shares_group(uuid),
  public.create_group(text,text), public.join_group(text), public.preview_group(text),
  public.rotate_invite(uuid) from public, anon;
grant execute on function public.is_member(uuid), public.is_admin(uuid), public.shares_group(uuid),
  public.create_group(text,text), public.join_group(text), public.preview_group(text),
  public.rotate_invite(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Row-level security
-- ─────────────────────────────────────────────────────────────

alter table public.profiles    enable row level security;
alter table public.groups      enable row level security;
alter table public.members     enable row level security;
alter table public.busy_days   enable row level security;
alter table public.events      enable row level security;
alter table public.rsvps       enable row level security;
alter table public.day_notes   enable row level security;
alter table public.messages    enable row level security;
alter table public.expenses    enable row level security;
alter table public.settlements enable row level security;
alter table public.ai_usage    enable row level security;
alter table public.waitlist    enable row level security;

-- Nothing is visible to signed-out visitors.
revoke all on all tables in schema public from anon;

do $$ declare t text; begin
  foreach t in array array['profiles','groups','members','busy_days','events','rsvps','day_notes','messages','expenses','settlements','ai_usage','waitlist'] loop
    execute format('drop policy if exists sel on public.%I', t);
    execute format('drop policy if exists ins on public.%I', t);
    execute format('drop policy if exists upd on public.%I', t);
    execute format('drop policy if exists del on public.%I', t);
  end loop;
end $$;

-- profiles: see yourself and your crewmates; edit only your own name/colour (never `plan`).
create policy sel on public.profiles for select to authenticated using (shares_group(id));
create policy ins on public.profiles for insert to authenticated with check (id = auth.uid() and plan = 'free');
create policy upd on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (name, color) on public.profiles to authenticated;

-- groups: members read; admins edit/delete. Creation goes through create_group().
-- (pending members may read the name of the crew they asked to join)
create policy sel on public.groups for select to authenticated
  using (exists(select 1 from public.members m where m.group_id = groups.id and m.user_id = auth.uid()));
create policy upd on public.groups for update to authenticated using (is_admin(id)) with check (is_admin(id));
create policy del on public.groups for delete to authenticated using (is_admin(id));
revoke update on public.groups from authenticated;
grant update (name, emoji, require_approval) on public.groups to authenticated;

-- members: see your crews' rosters and your own pending rows; admins approve/promote/remove; anyone may leave.
create policy sel on public.members for select to authenticated using (user_id = auth.uid() or is_member(group_id));
create policy upd on public.members for update to authenticated using (is_admin(group_id)) with check (is_admin(group_id));
create policy del on public.members for delete to authenticated using (user_id = auth.uid() or is_admin(group_id));
revoke update on public.members from authenticated;
grant update (role, status) on public.members to authenticated;

-- busy_days: yours to edit, crewmates may read.
create policy sel on public.busy_days for select to authenticated using (shares_group(user_id));
create policy ins on public.busy_days for insert to authenticated with check (user_id = auth.uid());
create policy upd on public.busy_days for update to authenticated using (user_id = auth.uid());
create policy del on public.busy_days for delete to authenticated using (user_id = auth.uid());

-- events: any member reads/creates; creator or admin edits/deletes.
create policy sel on public.events for select to authenticated using (is_member(group_id));
create policy ins on public.events for insert to authenticated with check (is_member(group_id) and created_by = auth.uid());
create policy upd on public.events for update to authenticated using (created_by = auth.uid() or is_admin(group_id)) with check (is_member(group_id));
create policy del on public.events for delete to authenticated using (created_by = auth.uid() or is_admin(group_id));

-- rsvps: members read; you answer only for yourself.
create policy sel on public.rsvps for select to authenticated
  using (exists(select 1 from events e where e.id = event_id and is_member(e.group_id)));
create policy ins on public.rsvps for insert to authenticated
  with check (user_id = auth.uid() and exists(select 1 from events e where e.id = event_id and is_member(e.group_id)));
create policy upd on public.rsvps for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy del on public.rsvps for delete to authenticated using (user_id = auth.uid());

-- day_notes / messages: members read and write as themselves.
create policy sel on public.day_notes for select to authenticated using (is_member(group_id));
create policy ins on public.day_notes for insert to authenticated with check (is_member(group_id) and user_id = auth.uid());
create policy del on public.day_notes for delete to authenticated using (user_id = auth.uid() or is_admin(group_id));

create policy sel on public.messages for select to authenticated using (is_member(group_id));
create policy ins on public.messages for insert to authenticated with check (is_member(group_id) and user_id = auth.uid());
create policy del on public.messages for delete to authenticated using (user_id = auth.uid() or is_admin(group_id));

-- expenses / settlements: members read and add; the author or an admin deletes.
create policy sel on public.expenses for select to authenticated using (is_member(group_id));
create policy ins on public.expenses for insert to authenticated with check (is_member(group_id) and created_by = auth.uid());
create policy del on public.expenses for delete to authenticated using (created_by = auth.uid() or is_admin(group_id));

create policy sel on public.settlements for select to authenticated using (is_member(group_id));
create policy ins on public.settlements for insert to authenticated with check (is_member(group_id) and created_by = auth.uid());
create policy del on public.settlements for delete to authenticated using (created_by = auth.uid() or is_admin(group_id));

-- waitlist: write-only for the signed-in user (upsert needs select on own row).
create policy sel on public.waitlist for select to authenticated using (user_id = auth.uid());
create policy ins on public.waitlist for insert to authenticated with check (user_id = auth.uid());
create policy upd on public.waitlist for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ai_usage: read your own counter; only the edge function (service role) writes.
create policy sel on public.ai_usage for select to authenticated using (user_id = auth.uid());

-- Live chat
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_object then null; end $$;
