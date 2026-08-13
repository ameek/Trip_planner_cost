# UI & Data Flow

This document describes the routes, tabs, component tree, optimistic-write pipeline, and the
offline sync flow. All diagrams are [mermaid](https://mermaid.js.org/) and render in any
GitHub-flavoured markdown viewer.

## Routes

```mermaid
flowchart LR
    A["/"] -->|create trip| B["/t/:shortId"]
    A -->|any unknown path| A
    B --> C[TripPage]
```

- `/` — `Landing.tsx`. Create form: name + 4-digit code → `api.createTrip` → navigate to
  `/t/<shortId>` with `state.justCreated` (shows the share banner) and edit unlocked in
  `sessionStorage`.
- `/t/:shortId` — `TripPage.tsx` wraps content in `TripProvider` (keyed by `shortId` so a
  navigation switches data cleanly). `TripContent` renders the header, nav tabs, and the
  active tab.
- `*` — fallback to Landing.

```mermaid
flowchart TD
    RP[TripPage] --> TP[TripProvider<br/>useTripQuery · edit lock]
    TP --> TC[TripContent<br/>Tabs · sync pill · share banner]
    TC --> PL[PlanTab]
    TC --> LG[LedgerTab]
    TC --> MB[MembersTab]
    TC --> ST[SettleTab]
```

## Trip access & edit lock

```mermaid
stateDiagram-v2
    [*] --> Loading: mount TripProvider
    Loading --> Loaded: query resolves (data)
    Loading --> Error: query rejects
    Loaded --> NotFound: no row for shortId
    Loaded --> Editing: verify_trip_code ok<br/>sessionStorage[shortId]=1
    Editing --> Editing: mutations enabled<br/>across all tabs
    Editing --> Loaded: "Lock" pressed
    Error --> [*]: Back to start
    NotFound --> [*]: Back to start
```

- Edit state is read once from `sessionStorage` (`trailmark:unlocked:<shortId>`).
- `unlock()` calls `verify_trip_code` RPC; wrong code sets `codeError` (inline, visible).

## Per-row sync status

Each ledger row derives its state from the active mutations for that trip via
`useLedgerRowStatus` — it looks up the most recent non-success mutation whose variables
(target a `clientId` or `id`) match the row.

```mermaid
stateDiagram-v2
    [*] --> ok
    ok --> syncing: mutation running
    ok --> failed: server error
    ok --> queued: offline (mutation paused)
    syncing --> ok: resolved
    queued --> ok: resumed & resolved
    queued --> failed: resume rejected
    failed --> syncing: retry tapped
```

## Ledger entry flow (form → server)

```mermaid
sequenceDiagram
    participant U as User
    participant F as EntryForm
    participant RQ as React Query (useCreateEntry)
    participant IDB as IndexedDB cache
    participant SB as Supabase REST

    U->>F: fills description, amount,<br/>payers, split
    F->>F: live validation<br/>(payers sum, shares sum)
    F->>RQ: mutate({ clientId, data })
    RQ->>RQ: onMutate → optimistic temp row<br/>inserted into query cache
    RQ-->>IDB: persist cache
    Note over RQ: networkMode offlineFirst
    alt online
        RQ->>SB: POST ledger_entries
        SB-->>RQ: ok
        RQ->>RQ: invalidate entries query (refetch with real id)
    else offline
        Note over RQ: mutation paused,<br/>stays in cache + queue
        RQ-->>U: row shows ● queued
        Note over RQ: navigator.onLine flips true
        RQ->>SB: resumed (in order)
        SB-->>RQ: ok
        RQ->>RQ: invalidate entries
    end
    RQ->>U: row status → confirmed
```

## Data flow overview (reads)

```mermaid
flowchart LR
    subgraph Server["Supabase"]
        direction TB
        PGRST[PostgREST]
        DB[(Postgres)]
    end
    subgraph Client["Browser"]
        direction TB
        HOOKS[Query hooks<br/>useTrip · members · days · stops · tags · entries · revisions]
        QCM["cacheMap: ['trip',s] ['members',id] ['days',id] ['stops',id]<br/>['tags',id] ['entries',id] ['revisions',entryId]"]
        IDB[(IndexedDB<br/>persisted cache)]
    end
    HOOKS --> QCM
    QCM <--> IDB
    QCM --> PGRST
    PGRST --> DB
```

- Queries are keyed by trip id; mutations share the same keys so invalidation refetches fresh
  data.
- `useRevisions(entryId, enabled)` fetches only when the "edited" badge is tapped.
- The service worker's network-first rule for `/rest/v1/*` keeps a stale-but-rendered cache
  fallback when offline.

## Online / pill state

```mermaid
stateDiagram-v2
    [*] --> PillCompute
    PillCompute --> Online: navigator.onLine && paused==0 && syncing==0
    PillCompute --> Queued: paused > 0
    PillCompute --> Syncing: syncing > 0 && paused == 0
    PillCompute --> Offline: !navigator.onLine && paused == 0
    Queued --> Online: all resumed
```