-- What's for Dinner — initial schema.
--
-- The shape of the app: a household keeps a repertoire of dishes; everyone
-- rates each dish once (a lasting baseline). Any evening, any member starts a
-- `round`: six dishes are sampled in TypeScript and frozen into `round_dishes`;
-- members cast a Yum/Meh/Yuck `vote` on each; any member ends the round, which
-- scores it, records `winner_dish_id`, and nudges everyone's `member_karma`.
--
-- Postgres does storage and RLS only. The scoring formula and the sampler live
-- in src/lib/scoring/ so they never exist in two languages.
--
-- Every table hangs off a household, and every policy asks the same question:
-- is this row in the one household the caller belongs to?

-- ---------------------------------------------------------------- schema --

-- Helpers that exist only to be called from RLS policies and triggers live
-- here. `private` is not in PostgREST's exposed schemas, so none of them turn
-- into a /rest/v1/rpc/ endpoint the way they would in `public`.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

-- ------------------------------------------------------------------ types --

create type public.round_status as enum ('open', 'closed');

-- Which sampling slot a dish filled. Kept for the record; the sampler decides.
create type public.slot_type as enum ('high_baseline', 'exploration', 'wildcard');

create type public.vote_choice as enum ('yum', 'meh', 'yuck');

-- ----------------------------------------------------------------- tables --

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 1 and 40),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Display names for auth users, readable by the people they cook with.';

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  -- Only ever used to decide which calendar day a round belongs to.
  timezone text not null default 'UTC',
  join_code text not null unique check (join_code ~ '^[A-Z2-9]{6}$'),
  -- bcrypt via pgcrypto; set and checked only inside the definer RPCs below.
  password_hash text not null,
  leader_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- One household per person: the unique constraint on user_id *is* that rule.
create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  note text check (char_length(note) <= 280),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index dishes_household_id_idx on public.dishes (household_id);

-- One "Rajma chawal" per household, however it was capitalised on the night.
-- Archived dishes step aside so the name can be used again.
create unique index dishes_household_name_idx
  on public.dishes (household_id, lower(trim(name)))
  where archived_at is null;

-- The lasting opinion, rated once: Angry -2 .. Laugh +2.
create table public.dish_ratings (
  dish_id uuid not null references public.dishes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  value smallint not null check (value between -2 and 2),
  updated_at timestamptz not null default now(),
  primary key (dish_id, user_id)
);

create index dish_ratings_user_id_idx on public.dish_ratings (user_id);

-- No `closes_at`, no timer, no cron: a round is opened and ended by people.
-- "pending" isn't a status — it's the absence of a row for today.
create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  round_date date not null,
  status public.round_status not null default 'open',
  started_by uuid references auth.users (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_by uuid references auth.users (id) on delete set null,
  ended_at timestamptz,
  winner_dish_id uuid references public.dishes (id) on delete set null,
  -- A closed round is the cooked-dishes log; there is no second table for it.
  unique (household_id, round_date),
  constraint rounds_closed_has_outcome check (
    (status = 'open' and ended_at is null and winner_dish_id is null)
    or (status = 'closed' and ended_at is not null)
  )
);

create index rounds_household_date_idx on public.rounds (household_id, round_date desc);

-- The six, frozen at round start.
create table public.round_dishes (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  slot public.slot_type not null,
  -- Written when the round is scored; null while it is open.
  final_score numeric(8, 4),
  created_at timestamptz not null default now(),
  unique (round_id, dish_id)
);

create index round_dishes_round_id_idx on public.round_dishes (round_id);

create table public.votes (
  round_id uuid not null references public.rounds (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  dish_id uuid not null,
  choice public.vote_choice not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One opinion per person per dish per night.
  primary key (round_id, user_id, dish_id),
  -- And only on a dish that was actually on tonight's shortlist.
  foreign key (round_id, dish_id)
    references public.round_dishes (round_id, dish_id) on delete cascade
);

create index votes_round_id_idx on public.votes (round_id);

-- Ground given to people who keep losing. One row per member, rewritten when a
-- round closes; `last_decay_on` is how the ~14-day half-life is applied lazily.
create table public.member_karma (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  value numeric(6, 4) not null default 0 check (value between -3 and 3),
  last_decay_on date not null default current_date,
  primary key (household_id, user_id)
);

-- ---------------------------------------------------------------- helpers --

-- SECURITY DEFINER so a membership check does not re-enter the very policies
-- that call it — a plain subquery against household_members would recurse.
create or replace function private.my_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.household_id
  from public.household_members m
  where m.user_id = (select auth.uid());
$$;

create or replace function private.is_household_leader()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.households h
    where h.id = private.my_household_id()
      and h.leader_id = (select auth.uid())
  );
$$;

create or replace function private.shares_my_household(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.user_id = p_user_id
      and m.household_id = private.my_household_id()
  );
$$;

create or replace function private.dish_household_id(p_dish_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select d.household_id from public.dishes d where d.id = p_dish_id;
$$;

create or replace function private.round_household_id(p_round_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.household_id from public.rounds r where r.id = p_round_id;
$$;

create or replace function private.round_is_open(p_round_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.rounds r
    where r.id = p_round_id and r.status = 'open'
  );
$$;

-- Crockford-ish alphabet: no I, L, O, 0 or 1, because these get read aloud
-- across a kitchen and typed on a phone.
create or replace function private.new_join_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 31)::int + 1, 1),
    ''
  )
  from pg_catalog.generate_series(1, 6);
$$;

-- --------------------------------------------------------------- triggers --

-- Magic-link sign-up gives us an email and nothing else; the local part is a
-- serviceable first guess at a name, and Household lets people fix it.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      initcap(split_part(new.email, '@', 1)),
      'Cook'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger dish_ratings_touch_updated_at
  before update on public.dish_ratings
  for each row execute function private.touch_updated_at();

create trigger votes_touch_updated_at
  before update on public.votes
  for each row execute function private.touch_updated_at();

-- ------------------------------------------------------------------- RLS --

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_ratings enable row level security;
alter table public.rounds enable row level security;
alter table public.round_dishes enable row level security;
alter table public.votes enable row level security;
alter table public.member_karma enable row level security;

-- profiles
create policy "Read own profile and housemates'"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or private.shares_my_household(id));

create policy "Update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- households. No insert or join-by-select policy on purpose: creating and
-- joining go through the definer RPCs below, so a join code alone can never be
-- used to read a household you have not actually joined.
create policy "Read the household you belong to"
  on public.households for select to authenticated
  using (id = private.my_household_id());

create policy "The leader renames the household"
  on public.households for update to authenticated
  using (id = private.my_household_id() and private.is_household_leader())
  with check (id = private.my_household_id() and private.is_household_leader());

-- household_members. Inserts go through join_household()/create_household().
create policy "Read the roster of your household"
  on public.household_members for select to authenticated
  using (household_id = private.my_household_id());

create policy "Leave your household"
  on public.household_members for delete to authenticated
  using ((select auth.uid()) = user_id);

-- dishes
create policy "Members read the repertoire"
  on public.dishes for select to authenticated
  using (household_id = private.my_household_id());

create policy "Any member adds a dish"
  on public.dishes for insert to authenticated
  with check (
    household_id = private.my_household_id()
    and (select auth.uid()) = created_by
  );

create policy "Creator or leader edits a dish"
  on public.dishes for update to authenticated
  using (
    household_id = private.my_household_id()
    and ((select auth.uid()) = created_by or private.is_household_leader())
  )
  with check (
    household_id = private.my_household_id()
    and ((select auth.uid()) = created_by or private.is_household_leader())
  );

create policy "Creator or leader deletes a dish"
  on public.dishes for delete to authenticated
  using (
    household_id = private.my_household_id()
    and ((select auth.uid()) = created_by or private.is_household_leader())
  );

-- dish_ratings. Everyone sees the household's ratings — the baseline mean is
-- what the sampler runs on — but only you can set yours.
create policy "Members read the household's ratings"
  on public.dish_ratings for select to authenticated
  using (private.dish_household_id(dish_id) = private.my_household_id());

create policy "Rate a dish as yourself"
  on public.dish_ratings for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and private.dish_household_id(dish_id) = private.my_household_id()
  );

create policy "Change your own rating"
  on public.dish_ratings for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and private.dish_household_id(dish_id) = private.my_household_id()
  );

create policy "Withdraw your own rating"
  on public.dish_ratings for delete to authenticated
  using ((select auth.uid()) = user_id);

-- rounds. Any member starts tonight's round; any member ends it.
create policy "Members read their rounds"
  on public.rounds for select to authenticated
  using (household_id = private.my_household_id());

create policy "Any member starts tonight's round"
  on public.rounds for insert to authenticated
  with check (
    household_id = private.my_household_id()
    and (select auth.uid()) = started_by
    and status = 'open'
  );

create policy "Any member ends the round"
  on public.rounds for update to authenticated
  using (household_id = private.my_household_id())
  with check (household_id = private.my_household_id());

-- round_dishes. Written by whoever starts the round, scored by whoever ends it.
create policy "Members read tonight's shortlist"
  on public.round_dishes for select to authenticated
  using (private.round_household_id(round_id) = private.my_household_id());

create policy "Freeze the sample at round start"
  on public.round_dishes for insert to authenticated
  with check (private.round_household_id(round_id) = private.my_household_id());

create policy "Record final scores at round end"
  on public.round_dishes for update to authenticated
  using (private.round_household_id(round_id) = private.my_household_id())
  with check (private.round_household_id(round_id) = private.my_household_id());

-- votes. Readable live by the household (that is the who-has-voted list), but
-- writable only by their owner, and only while the round is still open.
create policy "Members read tonight's tally"
  on public.votes for select to authenticated
  using (private.round_household_id(round_id) = private.my_household_id());

create policy "Cast your own vote while the round is open"
  on public.votes for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and private.round_household_id(round_id) = private.my_household_id()
    and private.round_is_open(round_id)
  );

create policy "Revise your own vote while the round is open"
  on public.votes for update to authenticated
  using ((select auth.uid()) = user_id and private.round_is_open(round_id))
  with check ((select auth.uid()) = user_id and private.round_is_open(round_id));

create policy "Take back your own vote while the round is open"
  on public.votes for delete to authenticated
  using ((select auth.uid()) = user_id and private.round_is_open(round_id));

-- member_karma. Whoever ends the round rewrites it for everyone, so the write
-- policies are household-wide rather than self-only.
create policy "Members read household karma"
  on public.member_karma for select to authenticated
  using (household_id = private.my_household_id());

create policy "Karma is seeded within the household"
  on public.member_karma for insert to authenticated
  with check (household_id = private.my_household_id());

create policy "Karma is updated at round end"
  on public.member_karma for update to authenticated
  using (household_id = private.my_household_id())
  with check (household_id = private.my_household_id());

-- ------------------------------------------------------------------- RPC --

-- Creating a household is a definer function so the password is hashed on the
-- server and the household, its leader's membership, and their karma row all
-- land in one transaction.
create or replace function public.create_household(
  p_name text,
  p_password text,
  p_timezone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  code text;
  new_id uuid;
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if private.my_household_id() is not null then
    raise exception 'You are already in a household' using errcode = 'P0001';
  end if;

  if char_length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Your household needs a name' using errcode = 'P0001';
  end if;

  if char_length(coalesce(p_password, '')) < 4 then
    raise exception 'The household password needs at least 4 characters'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from pg_catalog.pg_timezone_names t where t.name = p_timezone
  ) then
    raise exception 'Unknown timezone: %', p_timezone using errcode = 'P0001';
  end if;

  -- Retry rather than let a 1-in-887-million collision surface as an insert
  -- error the caller has to interpret.
  loop
    code := private.new_join_code();
    exit when not exists (
      select 1 from public.households h where h.join_code = code
    );
  end loop;

  insert into public.households (name, timezone, join_code, password_hash, leader_id)
  values (
    trim(p_name),
    p_timezone,
    code,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    caller
  )
  returning id into new_id;

  insert into public.household_members (household_id, user_id)
  values (new_id, caller);

  insert into public.member_karma (household_id, user_id) values (new_id, caller);

  return new_id;
end;
$$;

-- Joining is a definer function because the caller cannot see the household row
-- until they are a member of it, which is the point. The code and the password
-- fail with the same message so neither can be probed independently.
create or replace function public.join_household(p_code text, p_password text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target public.households%rowtype;
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  if private.my_household_id() is not null then
    raise exception 'You are already in a household' using errcode = 'P0001';
  end if;

  select * into target
  from public.households h
  where h.join_code = upper(trim(coalesce(p_code, '')));

  if target.id is null
     or target.password_hash <> extensions.crypt(coalesce(p_password, ''), target.password_hash)
  then
    raise exception 'That code and password do not match a household'
      using errcode = 'P0001';
  end if;

  insert into public.household_members (household_id, user_id)
  values (target.id, caller);

  insert into public.member_karma (household_id, user_id)
  values (target.id, caller)
  on conflict do nothing;

  return target.id;
end;
$$;

revoke all on function public.create_household(text, text, text) from public, anon;
revoke all on function public.join_household(text, text) from public, anon;
grant execute on function public.create_household(text, text, text) to authenticated;
grant execute on function public.join_household(text, text) to authenticated;

-- ------------------------------------------------------------- privileges --

-- This project grants no *data* privileges by default, so RLS policies alone
-- would still leave every query with "permission denied" — but it does hand
-- every new table TRUNCATE, TRIGGER and REFERENCES to `anon` and
-- `authenticated`, which nothing here wants. Clear the slate, then grant the
-- narrowest privilege each policy needs. `anon` keeps nothing: there is no
-- signed-out surface in this app.
revoke all on all tables in schema public from anon, authenticated;

grant select, update on public.profiles to authenticated;
-- Column-level on purpose: `password_hash` is never sent to a client, and the
-- only columns a leader can change are the two the settings screen edits.
grant select (id, name, timezone, join_code, leader_id, created_at)
  on public.households to authenticated;
grant update (name, timezone) on public.households to authenticated;
grant select, delete on public.household_members to authenticated;
grant select, insert, update, delete on public.dishes to authenticated;
grant select, insert, update, delete on public.dish_ratings to authenticated;
grant select, insert, update on public.rounds to authenticated;
grant select, insert, update on public.round_dishes to authenticated;
grant select, insert, update, delete on public.votes to authenticated;
grant select, insert, update on public.member_karma to authenticated;

grant all on all tables in schema public to service_role;

-- Policy expressions are evaluated as the querying user, so `authenticated`
-- needs EXECUTE on the helpers even though it can never reach them over HTTP.
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated, service_role;

-- The trigger on auth.users fires as the auth admin.
grant usage on schema private to supabase_auth_admin;
grant execute on function private.handle_new_user() to supabase_auth_admin;

-- ------------------------------------------------------------- realtime --

-- /tonight watches these two: a round appearing flips everyone from "start
-- tonight's vote" to the ballot, and votes landing drive the who-has-voted list.
alter publication supabase_realtime add table public.rounds;
alter publication supabase_realtime add table public.votes;
