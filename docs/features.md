# Feature Checklist

Status legend: ✅ implemented · 🕓 not yet (see "Deferred" at the end for scope exclusions).

## Trip lifecycle & access control

| # | Feature | Status |
| --- | --- | --- |
| 1 | Create trip with name + 4-digit edit code | ✅ |
| 2 | 6-char alphanumeric `short_id`, collision-checked on insert | ✅ |
| 3 | URL format `/t/<shortId>` | ✅ |
| 4 | Read-only access for anyone with the link | ✅ |
| 5 | Unlock editing via `verify_trip_code` RPC; state held in `sessionStorage` | ✅ |
| 6 | Lock button to re-read-only within the session | ✅ |
| 7 | "Share this link and the code" one-time banner after creation | ✅ |
| 8 | Clear inline error on wrong code | ✅ |
| 9 | Currency from `trips.currency` (default BDT, formatted `৳1,250`) | ✅ |

## Plan tab

| # | Feature | Status |
| --- | --- | --- |
| 10 | Trail view: days as cards on a dashed vertical line with checkpoint dots | ✅ |
| 11 | Add day: date label + title + overnight toggle | ✅ |
| 12 | Add/remove stops per day ("is a stay" toggle) | ✅ |
| 13 | Reorder days and stops with up/down controls | ✅ |
| 14 | Loading + empty state copy | ✅ |

## Members tab

| # | Feature | Status |
| --- | --- | --- |
| 15 | Add / remove members (name only) | ✅ |
| 16 | Per-member Even-split vs Fixed-contribution toggle | ✅ |
| 17 | Numeric input revealed only for fixed amount; saves on blur/Enter | ✅ |
| 18 | Explanation of how even/fixed mix works | ✅ |
| 19 | Tags/vehicles add/remove list | ✅ |

## Ledger tab

| # | Feature | Status |
| --- | --- | --- |
| 20 | Table: description, amount, paid by, category, tag, split indicator | ✅ |
| 21 | Add entry form (description, amount, category, tag) | ✅ |
| 22 | Paid-by defaults to single payer + full amount | ✅ |
| 23 | "Multiple people paid" adds payer rows with per-person amounts | ✅ |
| 24 | Live validation: payer amounts sum to entry amount | ✅ |
| 25 | Split evenly: multi-select members, defaults to everyone | ✅ |
| 26 | Split exact: per-member share inputs, must sum to amount | ✅ |
| 27 | Compact payer rendering: single name, or "A + B" with tap-to-expand breakdown | ✅ |
| 28 | Inline edit / delete on rows | ✅ |
| 29 | "edited" badge → expandable revision history (`expense_revisions`) | ✅ |
| 30 | Running total row in ticket-table style | ✅ |
| 31 | Per-row sync dot: pending / syncing / queued / failed + retry | ✅ |
| 32 | Optimistic updates on all ledger writes | ✅ |

## Settle tab

| # | Feature | Status |
| --- | --- | --- |
| 33 | Roll up owed share per member (even []/subset, or exact shares) | ✅ |
| 34 | Target = `fixed_contribution ?? owedShare` | ✅ |
| 35 | Balance = totalPaid − target (positive = group owes member) | ✅ |
| 36 | Horizontal bar chart: pine = positive, clay = negative, zero reference line | ✅ |
| 37 | Minimum settlements via greedy debtor/creditor match | ✅ |
| 38 | Settlement list in ledger-mono style (`Alice → Bob  ৳1,250`) | ✅ |
| 39 | Tag filter on chart + balances only; settlements always full ledger | ✅ |
| 40 | Per-member target shown on Balances | ✅ |

## Offline & PWA

| # | Feature | Status |
| --- | --- | --- |
| 41 | `vite-plugin-pwa`, `registerType: autoUpdate`, manifest + icons | ✅ |
| 42 | Workbox precache of built assets (shell loads with zero connectivity) | ✅ |
| 43 | Runtime caching: Supabase REST/RPC network-first with timeout fallback | ✅ |
| 44 | `persistQueryClient` with IndexedDB persister (`idb-keyval`) | ✅ |
| 45 | Mutations `networkMode: offlineFirst` — pause while offline, resume in order on reconnect | ✅ |
| 46 | Header status pill: Online / Offline — N queued / Syncing… | ✅ |
| 47 | Last-write-wins conflicts surfaced via "edited" indicator | ✅ |
| 48 | Query cache `buster` to invalidate across schema versions | ✅ |

## Non-functional

| # | Feature | Status |
| --- | --- | --- |
| 49 | TypeScript strict throughout, typed Supabase client | ✅ |
| 50 | All fetch/mutation through React Query, keyed by trip id | ✅ |
| 51 | Loading + empty states on every tab | ✅ |
| 52 | Mobile-first responsive layout | ✅ |
| 53 | Visual system: palette, Fraunces/Work Sans/JetBrains Mono, trail motif | ✅ |
| 54 | `npm run build` (tsc + vite + PWA) passes clean | ✅ |

## Deferred (explicitly out of scope)

- Trip fund / shared pot as a separate concept (covered by fixed contributions + math).
- Receipt photo uploads (Supabase Storage) — its own subsystem, future work.