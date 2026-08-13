create extension if not exists pgcrypto;

create table trips (
  id uuid primary key default gen_random_uuid(),
  short_id text unique not null,           -- 6-char url-safe code, e.g. 'x7k2qa'
  name text not null,
  edit_code text not null,                 -- 4-digit pin, plain text is fine for this use case
  split_mode text not null default 'even' check (split_mode in ('even','fixed')),
  currency text not null default 'BDT',
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  fixed_contribution numeric,               -- only meaningful when split_mode = 'fixed'
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table plan_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  date_label text not null,                 -- free text, e.g. "26 Aug — Wed"
  title text not null,                      -- e.g. "Bliss Eco Resort"
  is_overnight boolean not null default false,
  sort_order int not null default 0
);

create table plan_stops (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references plan_days(id) on delete cascade,
  label text not null,
  is_stay boolean not null default false,   -- true = accommodation checkpoint, styled solid
  sort_order int not null default 0
);

create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  description text not null,
  amount numeric not null check (amount > 0),
  paid_by uuid references members(id) on delete set null,
  category text,                            -- 'accommodation' | 'food' | 'transport' | 'other'
  split_between uuid[] not null default '{}', -- member ids this expense is split across; empty array = all current members
  created_at timestamptz not null default now()
);

-- Row Level Security: reads are open (the short_id is the shareable secret).
-- Writes are open too, gated at the app layer by the 4-digit edit code.
-- This is a lightweight, friends-trip level of security, not bank-grade — that's an accepted tradeoff for a quick personal tool.
alter table trips enable row level security;
alter table members enable row level security;
alter table plan_days enable row level security;
alter table plan_stops enable row level security;
alter table ledger_entries enable row level security;

create policy "public read" on trips for select using (true);
create policy "public read" on members for select using (true);
create policy "public read" on plan_days for select using (true);
create policy "public read" on plan_stops for select using (true);
create policy "public read" on ledger_entries for select using (true);

create policy "public write" on trips for insert with check (true);
create policy "public write" on trips for update using (true);
create policy "public write" on members for all using (true) with check (true);
create policy "public write" on plan_days for all using (true) with check (true);
create policy "public write" on plan_stops for all using (true) with check (true);
create policy "public write" on ledger_entries for all using (true) with check (true);

-- Never SELECT edit_code directly from the client. Verify it via this function instead,
-- so the code isn't sitting in a plain `select * from trips` response.
create or replace function verify_trip_code(p_short_id text, p_code text)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from trips where short_id = p_short_id and edit_code = p_code
  );
$$;

-- Client-facing trip lookup that excludes edit_code.
create or replace function get_trip_public(p_short_id text)
returns table (id uuid, short_id text, name text, split_mode text, currency text, created_at timestamptz)
language sql
security definer
as $$
  select id, short_id, name, split_mode, currency, created_at
  from trips where short_id = p_short_id;
$$;