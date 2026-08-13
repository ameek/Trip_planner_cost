create extension if not exists pgcrypto;

drop table if exists expense_revisions cascade;
drop table if exists ledger_entries cascade;
drop table if exists plan_stops cascade;
drop table if exists plan_days cascade;
drop table if exists tags cascade;
drop table if exists members cascade;
drop table if exists trips cascade;

create table trips (
  id uuid primary key default gen_random_uuid(),
  short_id text unique not null,           -- 6-char url-safe code, e.g. 'x7k2qa'
  name text not null,
  edit_code text not null,                 -- 4-digit pin, plain text is fine for this use case
  currency text not null default 'BDT',
  created_at timestamptz not null default now()
);

create table members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  fixed_contribution numeric,               -- null = splits evenly with the other unset members; set = locked target amount
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  label text not null,                      -- e.g. "Bike A"
  sort_order int not null default 0
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
  paid_by jsonb not null default '[]',
  -- array of { "member_id": "...", "amount": 123.45 } — one or more payers, amounts must sum to `amount`.
  -- the common case (one payer) is just a single-element array; the UI should default to that and only
  -- reveal the "split who paid" control when the user taps "multiple people paid this."
  category text,                            -- 'accommodation' | 'food' | 'transport' | 'other'
  tag_id uuid references tags(id) on delete set null,
  split_type text not null default 'even' check (split_type in ('even','exact')),
  split_details jsonb not null default '[]',
  -- split_type = 'even': split_details is an array of member_id strings sharing the cost equally; [] = everyone.
  -- split_type = 'exact': split_details is an array of { "member_id": "...", "share": 123.45 }; shares must sum to `amount`.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table expense_revisions (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references ledger_entries(id) on delete cascade,
  snapshot jsonb not null,                  -- full row state before the edit
  edited_at timestamptz not null default now()
);

create or replace function log_ledger_revision()
returns trigger
language plpgsql
as $$
begin
  insert into expense_revisions (entry_id, snapshot) values (old.id, to_jsonb(old));
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ledger_entry_revision on ledger_entries;
create trigger ledger_entry_revision
before update on ledger_entries
for each row execute function log_ledger_revision();

-- RLS: reads open, writes open, gated at the app layer by the 4-digit edit code.
-- The trip's short_id is the shareable secret. This is a lightweight, friends-trip
-- level of security, not bank-grade — accepted tradeoff for a quick personal tool.
alter table trips enable row level security;
alter table members enable row level security;
alter table tags enable row level security;
alter table plan_days enable row level security;
alter table plan_stops enable row level security;
alter table ledger_entries enable row level security;
alter table expense_revisions enable row level security;

create policy "public read" on trips for select using (true);
create policy "public read" on members for select using (true);
create policy "public read" on tags for select using (true);
create policy "public read" on plan_days for select using (true);
create policy "public read" on plan_stops for select using (true);
create policy "public read" on ledger_entries for select using (true);
create policy "public read" on expense_revisions for select using (true);

create policy "trip write-create" on trips for insert with check (true);
create policy "trip write-update" on trips for update using (true);
create policy "members write" on members for all using (true) with check (true);
create policy "tags write" on tags for all using (true) with check (true);
create policy "plan_days write" on plan_days for all using (true) with check (true);
create policy "plan_stops write" on plan_stops for all using (true) with check (true);
create policy "ledger write" on ledger_entries for all using (true) with check (true);
create policy "revisions write" on expense_revisions for insert with check (true);

-- Never SELECT edit_code directly from the client.
create or replace function verify_trip_code(p_short_id text, p_code text)
returns boolean
language sql
security definer
as $$
  select exists (select 1 from trips where short_id = p_short_id and edit_code = p_code);
$$;

create or replace function get_trip_public(p_short_id text)
returns table (id uuid, short_id text, name text, currency text, created_at timestamptz)
language sql
security definer
as $$
  select id, short_id, name, currency, created_at from trips where short_id = p_short_id;
$$;