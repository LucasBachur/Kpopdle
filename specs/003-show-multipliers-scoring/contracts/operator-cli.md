# Contract: Operator CLI Scripts

**Phase**: 1 — Design | **Feature**: [../spec.md](../spec.md)

This feature exposes its operator interface as two standalone Node scripts matching the existing `seed-shows.js` / `seed-gacha-config.js` pattern: run with `node backend/<script>.js`, connect via `DATABASE_URL`, print a human-readable summary, exit non-zero on unexpected failure.

---

## 1. `backend/migrate-show-multipliers.js`

**Purpose**: Additive schema migration — creates the `show_schedule_multipliers` table.

**Run**: `node backend/migrate-show-multipliers.js`

**Prerequisites**: `DATABASE_URL` set; `migrate-card-game.js` already run (`show_schedules` must exist).

**Behaviour**:
- Opens its own `pg.Pool`
- Runs `CREATE TABLE IF NOT EXISTS show_schedule_multipliers (...)` inside a transaction
- Idempotent — safe to re-run; does nothing if the table already exists
- Prints: `Migration complete — show_schedule_multipliers ready.`
- Exits `0` on success, `1` on failure

**Must run before**: `seed-multiplier-templates.js`

---

## 2. `backend/seed-multiplier-templates.js`

**Purpose**: Seeds one multiplier template per GG show schedule. Idempotent — re-running produces no new rows.

**Run**: `node backend/seed-multiplier-templates.js`

**Prerequisites**: `DATABASE_URL` set; `migrate-show-multipliers.js` already run; `seed-shows.js` already run (GG `show_schedules` rows must exist).

**Default templates seeded** (operator-editable by modifying the script):

| Show | Type | applies_to_value | Label | Value |
|------|------|-----------------|-------|-------|
| Show Champion | role | vocalist | +Vocalist | 1.15 |
| M Countdown | role | rapper | +Rapper | 1.15 |
| Music Bank | role | dancer | +Dancer | 1.15 |
| Music Core | company | SM Entertainment | +SM Ent | 1.20 |
| Inkigayo | same_group | any | +Group Synergy | 1.25 |

**Behaviour**:
- Opens its own `pg.Pool`
- For each template: `INSERT INTO show_schedule_multipliers (...) ON CONFLICT (...) DO NOTHING`
- Prints one line per template: `  + Show Champion: +Vocalist` or `  = already present`
- Prints summary: `Done — N inserted, M already present.`
- Exits `0` on success (including fully-seeded no-op), `1` on unexpected failure

**Idempotency guarantee**: The unique constraint `(schedule_id, applies_to_type, COALESCE(applies_to_value, ''))` prevents duplicates. Re-running after editing the script to change a label or value will NOT update existing rows — operator must manually `UPDATE` to change an existing template after the initial seed.

**To add more categories**: Add rows to the `TEMPLATES` array and re-run. Existing rows are untouched.

---

## 3. `backend/seed-gacha-config.js` (modified)

**Addition**: New row `['chemistry_max_bonus', '0.15']` using the existing `ON CONFLICT (key) DO NOTHING` pattern. This sets the maximum fractional chemistry bonus (15% at 100% group chemistry).

**Operator note**: To change the chemistry bonus ceiling, either edit the script and run `node backend/seed-gacha-config.js` (only effective on a fresh DB), or directly: `UPDATE gacha_config SET value = '0.20' WHERE key = 'chemistry_max_bonus';`

---

## Recommended run order (first-time setup)

```bash
node backend/migrate-card-game.js          # existing — creates base schema
node backend/migrate-show-multipliers.js   # new — adds show_schedule_multipliers
node backend/seed-shows.js                 # existing — seeds GG show schedules
node backend/seed-gacha-config.js          # existing (+ chemistry_max_bonus now)
node backend/seed-multiplier-templates.js  # new — seeds per-schedule templates
```
