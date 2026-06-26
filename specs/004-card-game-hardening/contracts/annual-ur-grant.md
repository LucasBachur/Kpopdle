# Contract: Annual Ultra-Rare Ticket Grant

**Component**: `scheduler.js` (`processAnnualUrGrant`) + `db.js` queries + new tables
**Requirements**: FR-011…FR-014; SC-005

## Configuration

- `ur_grant_dates(month, day)` holds the operator-configured grant dates. Default seed: `(12, 31)`.
- Operators add/remove rows to change grant dates with no code change (FR-013).

## Trigger

`processAnnualUrGrant()` runs:

- Inside the existing daily cron `0 3 * * *` (UTC) in `scheduler.js`, alongside `createTodayShows()`.
- On server startup (catch-up), so a restart on a grant date still grants exactly once.

## Algorithm (idempotent)

1. Compute today's date in ART (Argentina Time, via the project's canonical `todayART()` helper) → `todayStr` (`YYYY-MM-DD`) and its `(month, day)`. The daily cron fires at `0 3 * * *` UTC, which is the same ART calendar day.
2. If `(month, day)` is **not** in `ur_grant_dates` → no-op (FR draft edge: non-matching date, FR — no grant).
3. Else attempt the marker insert:
   `INSERT INTO ur_grant_log (grant_date) VALUES ($todayStr) ON CONFLICT DO NOTHING`.
4. If the insert affected **0** rows → already granted today → no-op (FR-012; restart/repeat-run safe).
5. If it affected **1** row → run the grant:
   `UPDATE users SET ur_tickets = ur_tickets + 1` (all registered accounts; deleted accounts absent → not granted, FR-014). Tickets accumulate, no cap.

Steps 3–5 run in a single transaction so the marker and the grant commit together.

## Behavior table

| Condition                                      | Result                                   |
|-----------------------------------------------|------------------------------------------|
| today ∈ configured dates, first run           | every user `ur_tickets += 1`             |
| today ∈ configured dates, subsequent run      | no change (marker present)               |
| today ∉ configured dates                      | no change                                |
| multiple dates configured                     | each date grants independently           |
| Feb-29 configured, non-leap year              | never matches today → no grant that year |

## Acceptance checks (SC-005)

- Configure a grant date = today, run process → every registered player's `ur_tickets` increased by exactly 1.
- Run again same day → no further increase.
- Set configured date ≠ today → running grants nothing.
- 0 duplicate grants across repeated daily runs for the same date/year.
</content>
