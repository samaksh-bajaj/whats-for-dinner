-- What's for Dinner — initial schema.
--
-- The shape of the app: a household keeps a repertoire of dishes; each evening
-- gets one `dinner` row; members propose a shortlist of `dinner_options` and
-- cast exactly one vote each. A dinner ends up `decided_dish_id` set.
--
-- Every table is scoped to a household, and every policy asks the same
-- question: is the caller a member of that household?

-- -------------------------------------------------------------- tables --

-- --------------------------------------------------------------- profiles --

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Display names for auth users, readable by the people they cook with.';

-- ------------------------------------------------------------- households --

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members (user_id);

create table public.dishes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  note text check (char_length(note) <= 280),
  -- 1 = throw together, 2 = a real cook, 3 = a weekend project.
  effort smallint not null default 2 check (effort between 1 and 3),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

-- One "Rajma chawal" per household, however it was capitalised on the night.
create unique index dishes_household_name_idx
  on public.dishes (household_id, lower(trim(name)));

create table public.dinners (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  date date not null,
  decided_dish_id uuid references public.dishes (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, date)
);

create table public.dinner_options (
  id uuid primary key default gen_random_uuid(),
  dinner_id uuid not null references public.dinners (id) on delete cascade,
  dish_id uuid not null references public.dishes (id) on delete cascade,
  proposed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (dinner_id, dish_id),
  -- Referenced by the composite foreign key on votes below.
  unique (dinner_id, id)
);

create index dinner_options_dinner_id_idx on public.dinner_options (dinner_id);

create table public.votes (
  dinner_id uuid not null references public.dinners (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  option_id uuid not null,
  created_at timestamptz not null default now(),
  -- One vote a night, per person: the primary key is the whole rule.
  primary key (dinner_id, user_id),
  -- And it must be an option on *this* dinner, not some other night's.
  foreign key (dinner_id, option_id)
    references public.dinner_options (dinner_id, id) on delete cascade
);

create index votes_option_id_idx on public.votes (option_id);

-- ---------------------------------------------------------------- helpers --

-- SECURITY DEFINER so membership checks do not re-enter the RLS policies that
-- call them — a plain subquery against household_members would recurse.
create or replace function public.is_household_member(hid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = hid
      and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.shares_household_with(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members mine
    join public.household_members theirs
      on theirs.household_id = mine.household_id
    where mine.user_id = (select auth.uid())
      and theirs.user_id = uid
  );
$$;

-- Crockford-ish alphabet: no I, L, O, 0 or 1, because these get read aloud
-- across a kitchen and typed on a phone.
create or replace function public.new_invite_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', floor(random() * 31)::int + 1, 1),
    ''
  )
  from generate_series(1, 6);
$$;

-- ------------------------------------------------------------ triggers --

-- Magic-link sign-up gives us an email and nothing else; the local part is a
-- serviceable first guess at a name, and Household lets people fix it.
create or replace function public.handle_new_user()
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
      initcap(split_part(new.email, '@', 1))
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Retry rather than let a 1-in-887-million collision surface as an insert
-- error the caller has to interpret.
create or replace function public.assign_invite_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  candidate text;
begin
  if new.invite_code is not null then
    return new;
  end if;

  loop
    candidate := public.new_invite_code();
    exit when not exists (
      select 1 from public.households h where h.invite_code = candidate
    );
  end loop;

  new.invite_code := candidate;
  return new;
end;
$$;

create trigger households_assign_invite_code
  before insert on public.households
  for each row execute function public.assign_invite_code();

-- ------------------------------------------------------------------ RLS --

alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.dishes enable row level security;
alter table public.dinners enable row level security;
alter table public.dinner_options enable row level security;
alter table public.votes enable row level security;

-- profiles
create policy "Read own profile and housemates'"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or public.shares_household_with(id));

create policy "Insert own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- households. There is no join-by-select policy on purpose: joining goes
-- through join_household_with_code(), so an invite code cannot be used to read
-- a household you have not actually joined.
create policy "Read households you belong to"
  on public.households for select to authenticated
  using (public.is_household_member(id));

create policy "Create a household"
  on public.households for insert to authenticated
  with check ((select auth.uid()) = created_by);

create policy "Members rename their household"
  on public.households for update to authenticated
  using (public.is_household_member(id))
  with check (public.is_household_member(id));

-- household_members
create policy "Read the roster of your households"
  on public.household_members for select to authenticated
  using (
    (select auth.uid()) = user_id or public.is_household_member(household_id)
  );

create policy "Add yourself to a household"
  on public.household_members for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Leave a household"
  on public.household_members for delete to authenticated
  using ((select auth.uid()) = user_id);

-- dishes
create policy "Members read the repertoire"
  on public.dishes for select to authenticated
  using (public.is_household_member(household_id));

create policy "Members add dishes"
  on public.dishes for insert to authenticated
  with check (public.is_household_member(household_id));

create policy "Members edit dishes"
  on public.dishes for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "Members delete dishes"
  on public.dishes for delete to authenticated
  using (public.is_household_member(household_id));

-- dinners
create policy "Members read dinners"
  on public.dinners for select to authenticated
  using (public.is_household_member(household_id));

create policy "Members open a dinner"
  on public.dinners for insert to authenticated
  with check (public.is_household_member(household_id));

create policy "Members settle a dinner"
  on public.dinners for update to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

-- dinner_options
create policy "Members read the shortlist"
  on public.dinner_options for select to authenticated
  using (
    exists (
      select 1 from public.dinners d
      where d.id = dinner_id and public.is_household_member(d.household_id)
    )
  );

create policy "Members propose a dish"
  on public.dinner_options for insert to authenticated
  with check (
    (select auth.uid()) = proposed_by
    and exists (
      select 1 from public.dinners d
      where d.id = dinner_id and public.is_household_member(d.household_id)
    )
  );

-- Anyone in the house can clear a stale shortlist entry, including one they
-- did not add — this is a kitchen, not a permissions matrix.
create policy "Members withdraw a proposal"
  on public.dinner_options for delete to authenticated
  using (
    exists (
      select 1 from public.dinners d
      where d.id = dinner_id and public.is_household_member(d.household_id)
    )
  );

-- votes
create policy "Members read the tally"
  on public.votes for select to authenticated
  using (
    exists (
      select 1 from public.dinners d
      where d.id = dinner_id and public.is_household_member(d.household_id)
    )
  );

create policy "Cast your own vote"
  on public.votes for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.dinners d
      where d.id = dinner_id and public.is_household_member(d.household_id)
    )
  );

create policy "Change your own vote"
  on public.votes for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Take back your own vote"
  on public.votes for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ------------------------------------------------------------------ RPC --

-- Joining is a definer function because the caller cannot see the household
-- row until they are a member of it, which is the point.
create or replace function public.join_household_with_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid;
  caller uuid := (select auth.uid());
begin
  if caller is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  select h.id into target
  from public.households h
  where h.invite_code = upper(trim(p_code));

  if target is null then
    raise exception 'No household with that code' using errcode = 'P0002';
  end if;

  insert into public.household_members (household_id, user_id)
  values (target, caller)
  on conflict do nothing;

  return target;
end;
$$;

revoke all on function public.join_household_with_code(text) from public;
grant execute on function public.join_household_with_code(text) to authenticated;
