# Data Model

Postgres schema for the app, managed by `supabase/schema.sql`. Migration is idempotent
(drops existing objects first) and was applied to the Supabase cloud project.

## Entity-relationship diagram

```mermaid
erDiagram
    TRIPS ||--o{ MEMBERS : has
    TRIPS ||--o{ TAGS : has
    TRIPS ||--o{ PLAN_DAYS : has
    TRIPS ||--o{ LEDGER_ENTRIES : has
    PLAN_DAYS ||--o{ PLAN_STOPS : contains
    LEDGER_ENTRIES ||--o{ EXPENSE_REVISIONS : snapshots
    TAGS ||--o{ LEDGER_ENTRIES : "tag_id (set null on delete)"

    TRIPS {
        uuid id PK
        text short_id UK
        text name
        text edit_code
        text currency
        timestamptz created_at
    }
    MEMBERS {
        uuid id PK
        uuid trip_id FK
        text name
        numeric fixed_contribution
        int sort_order
        timestamptz created_at
    }
    TAGS {
        uuid id PK
        uuid trip_id FK
        text label
        int sort_order
    }
    PLAN_DAYS {
        uuid id PK
        uuid trip_id FK
        text date_label
        text title
        boolean is_overnight
        int sort_order
    }
    PLAN_STOPS {
        uuid id PK
        uuid day_id FK
        text label
        boolean is_stay
        int sort_order
    }
    LEDGER_ENTRIES {
        uuid id PK
        uuid trip_id FK
        text description
        numeric amount
        jsonb paid_by
        text category
        uuid tag_id FK
        text split_type
        jsonb split_details
        timestamptz created_at
        timestamptz updated_at
    }
    EXPENSE_REVISIONS {
        uuid id PK
        uuid entry_id FK
        jsonb snapshot
        timestamptz edited_at
    }
```

## Column semantics

### `trips`

| Column | Notes |
| --- | --- |
| `short_id` | 6-char lowercase alphanumeric share code; unique; generated client-side, collision-checked on insert |
| `edit_code` | 4-digit pin, plaintext (accepted tradeoff for a friends-trip tool). Never selected client-side — only checked via the `verify_trip_code` RPC |
| `currency` | default `BDT`; drives all formatting |

### `members`

| Column | Notes |
| --- | --- |
| `fixed_contribution` | `null` = even split with other unset members; set = locked target amount |

### `plan_days` / `plan_stops`

Ordered by `sort_order`. `plan_days.is_overnight` and `plan_stops.is_stay` only affect
styling (dusk-filled dot / solid chip).

### `ledger_entries`

| Column | Notes |
| --- | --- |
| `amount` | `check (amount > 0)` |
| `paid_by` | JSON array `[{ member_id, amount }]`; amounts must sum to `amount` (validated in UI) |
| `category` | one of `accommodation ∣ food ∣ transport ∣ other` (nullable) |
| `tag_id` | FK → `tags`, `on delete set null` |
| `split_type` | `even ∣ exact` (check constraint) |
| `split_details` | `even`: array of `member_id` strings (`[]` = everyone); `exact`: array of `{ member_id, share }` summing to `amount` |
| `updated_at` | bumped by the revision trigger on every update |

### `expense_revisions`

Full row snapshot (`to_jsonb(old)`) taken by the `log_ledger_revision` trigger before each
`UPDATE` on `ledger_entries`. Query keys run newest-first.

## Trigger

```mermaid
flowchart LR
    UPDATE["UPDATE ledger_entries"] --> TRIG["ledger_entry_revision (BEFORE UPDATE)"]
    TRIG --> LOG["log_ledger_revision()"]
    LOG --> INS["INSERT expense_revisions<br/>(snapshot = to_jsonb(OLD))"]
    LOG --> BUMP["NEW.updated_at = now()"]
```

## RLS

Reads open to everyone; writes are `using (true) with check (true)` (all commands) —
gated at the app layer by the 4-digit code check. Row-level policies per table:

```mermaid
flowchart LR
    PGRST[PostgREST anon] --> RLS
    RLS -->|select: public read| DB[(Postgres)]
    RLS -->|insert/update/delete: write policies| DB
    PGRST -->|RPC only| RPC[verify_trip_code · get_trip_public]
```

| Table | Policies |
| --- | --- |
| `trips` | `public read` (select) · `trip write-create` (insert) · `trip write-update` (update) |
| `members`, `tags`, `plan_days`, `plan_stops`, `ledger_entries` | `public read` (select) + `{table} write` (all) |
| `expense_revisions` | `public read` (select) + `revisions write` (insert) |

> Only `verify_trip_code` is capable of reading `edit_code`, via a `security definer` RPC.

## RPCs

| RPC | Returns | Purpose |
| --- | --- | --- |
| `verify_trip_code(p_short_id, p_code)` | `boolean` | Checks the pin without exposing it; used by the Unlock flow |
| `get_trip_public(p_short_id)` | `id, short_id, name, currency, created_at` | Tiered view of a trip for the trip page header |

## Settlement math

Non-DB: computed client-side in `src/lib/settle.ts` from `ledger_entries` + `members`.

```mermaid
flowchart TD
    E["per ledger_entry"] --> SPLIT{split_type?}
    SPLIT -->|even| EVEN["participants = split_details.length > 0 ? split_details : all members<br/>share = amount / count @ each"]
    SPLIT -->|exact| EXACT["owedShare[member] += listed share"]
    PAID["totalPaidBy[member] = Σ amounts in paid_by"] --> BAL
    TARGET["target = fixed_contribution ?? owedShare"] --> BAL
    BAL["balance = totalPaidBy − target"] --> CHART["bar chart<br/>pine + / clay −"]
    BAL --> MIN["minimum settlements (greedy)"]
```