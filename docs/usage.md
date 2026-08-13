# Usage Guide

How to run, deploy, and verify the app — and how to actually use it on a trip.

## Prerequisites

- Node.js 18+ and npm
- A Supabase project (cloud) — or any PostgREST-compatible endpoint the Supabase client can target
- (Optional) Docker if using the local Supabase CLI stack

## First run (local dev)

```bash
npm install
```

Create `.env` from the example and fill in your Supabase project credentials:

```bash
cp .env.example .env
# VITE_SUPABASE_URL=https://<ref>.supabase.co
# VITE_SUPABASE_ANON_KEY=eyJ...
```

Apply the schema to the Supabase database:

1. Cloud: open **SQL Editor → New query**, paste `supabase/schema.sql`, run it. (Or, if you
   have the Supabase CLI logged in and the project linked: `supabase db push`.)
2. Local CLI stack: `supabase start` (mirrors the same schema; the app's client already
   targets `127.0.0.1:54321` by default).

Run the dev server:

```bash
npm run dev
```

Open http://localhost:5173.

> Note: the service worker (offline shell, API caching) only engages against the **built**
> app. To test offline in dev, run `npm run build && npm run preview`.

## Verify setup end-to-end

1. Create a trip (name + 4-digit code) → redirected to `/t/<shortId>` with edit unlocked and
   the share banner visible.
2. **Members tab**: add members; set one to Fixed with an amount, leave the rest Even.
   Add a tag like "Bike A".
3. **Plan tab**: add a day, add stops (one marked "overnight stay"), reorder.
4. **Ledger tab**: add an entry — single payer; then add one with two payers; then one with
   an exact split. Confirm the ledger won't save while payer/split sums don't match the
   amount.
5. **Settle tab**: check the chart, the `Alice → Bob ৳N` settlements, and the Balances row
   targets. Use the tag filter and confirm settlements are unchanged.
6. Edit an entry → row shows "edited"; tap it to see revision history.
7. In a private/incognito tab, open the same link → read-only. Enter the wrong code → inline
   error; enter the right code → editing unlocks.

## Verify offline behavior

1. Load the trip once online (so the cache + app shell are primed).
2. DevTools → Network → **Offline**.
3. Add a plan stop and a ledger entry. Both appear immediately with ● queued; the header
   pill shows "Offline — 2 queued".
4. Go back **Online**. Mutations resume in order, the rows confirm, and the queued count
   drops to zero — no manual refresh.

## Deploy to Vercel

1. Ensure `vercel.json` has the SPA rewrite:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the Vercel project settings
   (Environment Variables).
3. Deploy: `vercel --prod` (or connect the repo for auto-deploys). Build command
   `npm run build`, output directory `dist`.

## Using the app on a trip

### Roles

- **Viewer** — has the link. Reads the plan, ledger, and settlements.
- **Editor** — viewer who enters the 4-digit code. Can change anything; unlock lasts for the
  session (until the tab/session ends or they hit "Lock").

### Daily workflow

1. **Plan**: keep the day list accurate; add a day when plans firm up. Stops are light
   checkpoints ("Dhaka → Khulna"), with a filled dot for where you slept.
2. **Ledger**: log expenses as they happen, even with no signal. Keep it simple:
   - one person paid → just pick them;
   - two people split a bill at the counter → "Multiple people paid" and enter each amount;
   - one person paid but the cost is uneven (e.g. a single room) → pick Exact, set shares.
3. **Settle**: at the end, open Settle and pay each owed transfer listed. Fixed-contribution
   members stay locked to their target; everyone else's target is whatever their even/exact
   shares rolled up to.

### Policies & conventions

- Tags are labelling/filtering only — never settlement math.
- Conflicts are last-write-wins; the "edited" badge + revision history lets the group notice
  an overwrite and reconcile manually.
- The edit code is plaintext in the DB and RLS is open by design (friends-trip security).
  Don't put sensitive data in descriptions (e.g. names on receipts).

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Landing shows "Setup needed" | No env vars loaded | Add `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` to `.env`, restart |
| "Could not find the table" (404) | Schema not migrated | Run `supabase/schema.sql` in the SQL editor or `supabase db push` |
| Duplicate policy errors on migration | Old schema run with buggy policy names | Use the current idempotent `schema.sql` (it drops first) |
| Offline writes stay queued after reconnect | SW not engaged (dev mode) or no network change event | Run the built app (`npm run build && npm run preview`); ensure `navigator.onLine` flips |
| Hook-order warning in dev | Stale cached chunk during hot reload | Hard reload the tab; if it persists, it's a real issue — check console |