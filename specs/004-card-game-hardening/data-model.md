# Phase 1 Data Model: Card Game Hardening & GG-Only Launch Mode

All changes are **additive**. No existing tables are altered, dropped, or renamed.

## Reused: `gacha_config` (existing)

The GG-only flag reuses the existing key/value config table.

| key            | value | meaning                                                      |
|----------------|-------|-------------------------------------------------------------|
| `gg_only_mode` | `'1'` | Boy Group sealed off (default). `'0'` = BG permitted.       |

- Read via `getGgOnlyMode()` → boolean (`parseFloat(value) !== 0`, defaulting to enabled if the row is absent).
- Seeded by `seed-gacha-config.js` with `'1'` (launch default: enabled). Idempotent `ON CONFLICT (key) DO NOTHING`.
- Hot-swappable: operators `UPDATE gacha_config SET value = '0' WHERE key = 'gg_only_mode'` with no redeploy.

## Reused: `users` (existing)

- `ur_tickets INTEGER` — incremented by the annual grant (`+1` per matched grant date). No cap. No schema change.

## New table: `ur_grant_dates`

Operator-editable list of annual grant dates (month + day). Configuration only.

| column | type       | constraints                          | notes                          |
|--------|------------|--------------------------------------|--------------------------------|
| month  | SMALLINT   | NOT NULL, CHECK (month BETWEEN 1 AND 12) | calendar month               |
| day    | SMALLINT   | NOT NULL, CHECK (day BETWEEN 1 AND 31)   | calendar day-of-month        |

- UNIQUE `(month, day)` to prevent duplicate configured dates.
- Seeded with one row `(12, 31)` by `seed-ur-grant-dates.js` (idempotent `ON CONFLICT DO NOTHING`).
- Operators add/remove rows to change grant dates — satisfies FR-013 (no code change).

## New table: `ur_grant_log`

Global idempotency marker — one row per calendar date actually granted.

| column     | type        | constraints              | notes                                   |
|------------|-------------|--------------------------|-----------------------------------------|
| grant_date | DATE        | PRIMARY KEY              | full `YYYY-MM-DD` of the processed grant |
| granted_at | TIMESTAMPTZ | NOT NULL DEFAULT now()   | when the grant ran                      |

- The grant attempts `INSERT INTO ur_grant_log (grant_date) VALUES ($today) ON CONFLICT DO NOTHING`.
- The `UPDATE users SET ur_tickets = ur_tickets + 1` runs **only if** the insert affected a row (`rowCount === 1`), giving at-most-once-per-date semantics across restarts and repeat daily runs (FR-012).
- Keyed by the full date (not just the year) so multiple configured dates in the same year each get an independent grant.

## Entity → Requirement mapping

| Entity / field                | Requirements                          |
|-------------------------------|---------------------------------------|
| `gacha_config.gg_only_mode`   | FR-001, FR-002, FR-003, FR-004        |
| `ur_grant_dates`              | FR-013 (configurable, default Dec 31) |
| `ur_grant_log`                | FR-012 (once-per-date idempotency)    |
| `users.ur_tickets`            | FR-011, FR-014 (accumulating grant)   |
| (validation, no storage)      | FR-005…FR-010 (request-level only)    |

## Validation rules (request-level, no schema)

These are enforced in `routes/cardGame.js` / `middleware/ggOnlyGuard.js`, not by the DB:

- **gender category** ∈ {`gg`, `bg`} on every gender-bearing route (existing). Invalid → `400`.
- **gg_only_mode guard**: gender resolves to `bg` while enabled → `403` (new).
- **banner pull gender guard**: the banner's own `genderCategory` is `bg` while `gg_only_mode` is enabled → `403`, no currency spent (new; gender comes from the banner record, not the request).
- **banner pull count**: integer 1–10 inclusive (existing). Else → `400`, no currency spent.
- **lineup slot positions**: unique within the submission (existing). Duplicate → `400`.
- **lineup slot count**: equals the chosen song's `memberCount` (existing). Mismatch → `400`.
- **lineup slot shape**: each slot has integer `playerCardId` and integer `slotPosition` (new — close 500→400 gap). Else → `400`.
- **lineup card existence**: every `playerCardId` exists in `player_cards` for some user (new — split out). Any id absent entirely → `400`, prior lineup unchanged.
- **lineup card ownership**: every existing `playerCardId` belongs to the requesting user (existing). A card owned by another user → `403`, prior lineup unchanged.
</content>
