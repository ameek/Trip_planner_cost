# Master Prompt — Trip Planner + Ledger SPA (v3)

> Verbatim copy of the original build prompt. This is the source of truth for intent and
> requirements. Do not edit; if a requirement changes, add a note in `features.md`.

## Build me a trip planner + shared ledger web app.

Build a single-page app called **Trailmark** — a shared trip planner + expense ledger for small group trips, installable as a PWA and usable with no signal. Stack: **Vite + React + TypeScript + Tailwind CSS + Supabase (Postgres) + react-router-dom + @tanstack/react-query + @tanstack/query-persist-client-core + idb-keyval + vite-plugin-pwa + recharts**. Deploy target: **Vercel** (frontend) + **Supabase** (database/backend). No placeholders, no TODOs, no mock data — build a fully working app in one pass.

### Concept

- A trip is created with a **name** and a **4-digit edit code**, and gets a short shareable **trip ID** (6-char code) used in the URL: `/t/<tripId>`.
- Anyone with the link can **view** the plan and ledger (read-only).
- Entering the correct **4-digit code** unlocks **edit mode** for that browser session (sessionStorage), allowing edits to the plan, members, and ledger.
- **Contribution model, per member, not per trip:** each member either has a **fixed contribution** (a locked target amount) or is left unset, meaning they split whatever's left **evenly** with the other unset members. This lets a trip mix both — e.g. one member locked at a negotiated ৳4,020 while everyone else splits the remainder evenly. There is no trip-wide toggle; it's decided member by member.
- **Per-expense splitting:** every ledger entry is split either **evenly** among a chosen subset of members (default: everyone) or by **exact amounts** entered per member (must sum to the total). This is independent of the contribution model above — it determines each member's share of *that specific expense*, which then rolls up into their overall target if they don't have a fixed contribution.
- Entries can optionally be tagged to a **vehicle/tag** (e.g. "Bike A") for trips where some costs only apply to a subset of the group.
- **Multi-payer entries:** a single expense can be paid by more than one person (e.g. two people split the resort checkout at the counter) — record who paid how much of that one bill, rather than faking it as two separate entries.
- Edits to a ledger entry are kept in a lightweight **revision history** so nothing silently changes underneath the group.
- A **Settle Up** view shows each member's net balance and the minimum set of payments needed to settle the trip.
- **Works with no signal.** The app installs to the home screen, precaches on first load, and lets the group keep adding plan stops and ledger entries while fully offline — everything queues locally and syncs automatically the moment a connection reappears, with a visible indicator of what's still pending.

### Visual design — reuse this exact system

```
Palette (CSS variables):
--pine:  #1c2b21   (deep forest green — headings, primary)
--moss:  #4a5d42   (muted green — secondary text, trail line)
--sand:  #efe8d8   (page background)
--paper: #f7f3e8   (card / surface background)
--clay:  #b5652d   (rust/clay — accent, eyebrows, badges)
--dusk:  #2b3a54   (dusk blue — night/overnight markers)
--ink:   #1a1a16   (body text)
--line:  rgba(28,43,33,0.18)  (hairline borders)

Type:
- Display/headings: 'Fraunces', serif (weights 500/700/900), tight letter-spacing on large sizes, italic used for emphasis in a run of text.
- Body/UI: 'Work Sans', sans-serif.
- Data/labels/mono (amounts, dates, eyebrows, badges): 'JetBrains Mono', monospace.

Signature layout element — the "trail":
- The Plan view renders trip days as a vertical dashed line (repeating-linear-gradient, var(--moss)) running down the left edge, with a circular checkpoint dot per day (pine outline, dusk fill for overnight/travel days).
- Each day is a card: eyebrow date in JetBrains Mono + clay color, a Fraunces title, and stops rendered as small pill/chips — plain pill for a stop, solid pine-filled pill for an overnight stay.
- Ledger and settlement views use a monospace "ledger/ticket" table style: hairline dashed row dividers, right-aligned numeric columns with tabular-nums, a solid top border + bold row for totals.
- Keep corners sharp-ish (2–3px radius max), avoid heavy shadows, avoid rounded "bubbly" cards — this is a paper/field-notebook aesthetic, not a SaaS dashboard.
- Fully responsive down to a narrow mobile viewport (this will mostly be used on phones during the trip).
```

### Data model — Supabase SQL (run this exact migration)

```sql
create extension if not exists pgcrypto;

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
  fixed_contribution numeric,               -- null = splits evenly with other null members; set = locked target amount
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

create policy "public write" on trips for insert with check (true);
create policy "public write" on trips for update using (true);
create policy "public write" on members for all using (true) with check (true);
create policy "public write" on tags for all using (true) with check (true);
create policy "public write" on plan_days for all using (true) with check (true);
create policy "public write" on plan_stops for all using (true) with check (true);
create policy "public write" on ledger_entries for all using (true) with check (true);
create policy "public write" on expense_revisions for insert with check (true);

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
```

Generate the short_id (6 lowercase alphanumeric chars, collision-checked) client-side or in a Postgres function — either is fine, just make trip creation reliable.

### Routes

- `/` — Landing + "Create a trip" form: trip name, 4-digit edit code (numeric input, 4 digits). On submit, creates the trip and redirects to `/t/<shortId>` with edit mode already unlocked and a one-time banner: "Share this link and the code `••••` with your group."
- `/t/:shortId` — The trip. Tabs: **Plan / Ledger / Members / Settle**. Read-only by default; a small "Unlock editing" control (lock icon + 4-digit input) in the header calls `verify_trip_code`, and on success stores `{shortId: true}` in `sessionStorage` and reveals edit affordances across all tabs for the rest of the session.

### Plan tab

- Renders the trail view from `plan_days` + `plan_stops`, ordered by `sort_order`.
- Edit mode: add a day (date label + title + overnight toggle), add/remove stops within a day (label + "is a stay" toggle), reorder with simple up/down controls (no drag-and-drop library — keep this reliable, not fancy).

### Members tab

- List members with add/remove (name only).
- Each member has an optional **fixed contribution** field. Leave blank = "splits evenly," fill in = "locked target." Show this plainly, e.g. a toggle per member between "Even split" and "Fixed amount," revealing a numeric input only in the fixed case.
- Manage **tags/vehicles** here too: simple add/remove list of tag labels (e.g. "Bike A", "Bike B").

### Ledger tab

- Table of `ledger_entries`: description, amount, paid by (member name), category, tag (if set), and a compact indicator of the split (e.g. "Even · 4 people" or "Exact split").
- Add entry form: description, amount, category dropdown, optional tag dropdown, a **paid-by control**, and a split control:
  - **Paid by**: defaults to a single dropdown (one payer, full amount). A "split who paid" toggle reveals a row per selected member with a numeric input instead; live-validate that these sum to the total amount before allowing save. Same validation pattern as the exact-split control below, reused for consistency.
  - **Split evenly** (default): multi-select of members, defaulting to everyone currently on the trip.
  - **Split by exact amounts**: a row per member with a numeric input; live-validate that the entries sum to the total amount before allowing save.
- List rows show payer(s) compactly: a single name normally, or "Alice + Bob" with a tap-to-expand breakdown when there's more than one payer.
- Inline edit/delete on existing rows. On edit, show a small "edited" tag that expands to the revision history (pulled from `expense_revisions`) when tapped.
- Running total at the bottom, styled like the ticket-table total row.
- All ledger writes go through React Query mutations with **optimistic updates**: the new/edited row appears immediately in the UI, and a small sync-status indicator (e.g. a dot) shows pending vs. confirmed vs. failed, with a retry action on failure. When offline, the mutation queues instead of failing outright — see the Offline & PWA section below.

### Settle tab

- Compute each member's **owed share** by rolling up entry-level splits:

```
for each ledger_entry:
  if split_type == 'even':
    participants = split_details.length > 0 ? split_details : all_current_members
    share = amount / participants.length
    owedShare[member] += share   for each member in participants
  if split_type == 'exact':
    owedShare[member] += entry's listed share   for each { member_id, share } in split_details
```

- Then compute each member's **target**:

```
target[member] = member.fixed_contribution ?? owedShare[member]
```

- And each member's **balance**:

```
totalPaidBy[member] = sum, across all ledger_entries, of the amount attributed to `member`
                       inside that entry's paid_by array (0 if member isn't a payer on that entry)
balance[member] = totalPaidBy[member] - target[member]
```

- `balance > 0` → owed money by the group. `balance < 0` → owes the group.
- Render as a horizontal bar chart (recharts): pine bars for positive, clay bars for negative, zero-line in the middle.
- Below the chart, compute the **minimum settlement transactions** with a standard greedy debtor/creditor match (sort by magnitude, repeatedly settle the largest pair to zero) and list them in the ledger-mono style: `Alice → Bob   ৳1,250`.
- Add an optional filter by tag (e.g. "show only Bike A costs") purely as a read-side filter over the ledger — it does not change the settlement math above, which always runs on the full ledger.

### Offline & PWA

The trip happens where signal drops in and out, so this isn't optional polish — build it as follows:

- **Installable app shell:** use `vite-plugin-pwa` with `registerType: 'autoUpdate'`. Add a `manifest.json` (name "Trailmark", short_name "Trailmark", `theme_color` `#1c2b21`, `background_color` `#efe8d8`, `display: "standalone"`, a simple icon set). Precache the built static assets (JS/CSS/fonts) via Workbox so the app shell loads with zero connectivity after the first visit.
- **API caching:** configure a Workbox runtime caching rule for Supabase REST/RPC calls using a **network-first** strategy with a short timeout and cache fallback — so a trip that's already been viewed once still renders (possibly slightly stale) with no connection, instead of showing a blank screen.
- **Offline mutations:** configure React Query with `persistQueryClient` (using an IndexedDB persister via `idb-keyval`, not localStorage) to persist both the query cache and the mutation cache across reloads. Set mutations to `networkMode: 'offlineFirst'` so writes made while offline are automatically **paused**, held in the persisted mutation queue, and **resumed in order** the moment `navigator.onLine` flips back to true — the user doesn't have to do anything to trigger the sync.
- **Visible sync state:** a small persistent status pill in the header — "Online", "Offline — N changes queued", or "Syncing…" — driven off `navigator.onLine` plus the count of paused mutations in the queue. Each individual ledger row also carries its own pending/confirmed/failed dot as already specified above.
- **Conflict handling:** last-write-wins is acceptable given the revision history already preserves what got overwritten — don't build a merge UI, just make sure the "edited" indicator surfaces so the group can notice and re-reconcile if two people edited the same entry while both offline.

### Non-functional requirements

- TypeScript throughout, typed Supabase client matching the schema above.
- Data fetching and mutations go through React Query: cache trip/members/plan/ledger by trip id, use optimistic updates for all writes, and retry failed mutations with a visible status rather than failing silently.
- Loading and empty states for every tab, written in the app's plain, direct voice.
- Handle the "wrong code" case with a clear inline error, not a silent failure.
- Currency formatting driven by `trips.currency` (default `BDT`, format as `৳1,250`).
- Mobile-first responsive layout; this will be used one-handed on a phone in the hills with patchy signal.

### Deployment

1. Create a Supabase project, run the SQL migration above in the SQL editor.
2. Copy the project URL and anon public key into `.env` as `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Add a `vercel.json` with an SPA rewrite:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
4. Deploy to Vercel (`vercel --prod` or connect the repo), adding the same two env vars in the Vercel project settings.
5. Confirm end-to-end: create a trip → add members (mix of fixed and even) → add a plan day with stops → add a ledger entry with an exact split and two payers → check Settle Up math → reload in a private tab and confirm it's read-only until the code is entered.
6. Confirm offline behavior: load the trip once online, then use devtools to go offline, add a plan stop and a ledger entry, confirm they appear immediately with a "queued" indicator, go back online, and confirm they sync and the queued count drops to zero without a manual refresh.

Build the full app now — all files, fully wired, ready to `npm install && npm run dev` locally and deploy as-is.

---

## Deferred — not part of this build

These were considered and intentionally left out to keep the one-shot build reliable. Worth their own follow-up prompt later:

- **"Trip fund" / shared pot as a separate concept** — already covered by fixed contributions + settlement math; a dedicated pool-tracking layer would risk double-counting against it.
- **Receipt photo uploads** (Supabase Storage) — its own subsystem (bucket, upload policies, offline queueing); add once the core app is stable.
