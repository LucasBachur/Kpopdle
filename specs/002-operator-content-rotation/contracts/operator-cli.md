# Contract: Operator CLI Scripts

**Phase**: 1 — Design | **Feature**: [../spec.md](../spec.md)

This feature exposes its interface to the **operator** as standalone Node scripts, matching the existing `seed-shows.js` / `seed-gacha-config.js` pattern (run with `node backend/<script>.js`, connect via `DATABASE_URL`, print a human-readable summary, exit non-zero on failure). There is no admin UI in scope.

---

## 1. `establish-weekly-pool.js`

Creates the **current** week's song pool (idempotently) and reports the result. This is the unblock step from User Story 1.

### Invocation

```bash
node backend/establish-weekly-pool.js [gg|bg]
```

- Argument optional; defaults to `gg`. (`bg` allowed for schema completeness; never surfaced to players.)

### Behavior

1. Resolve the current ART Monday via `getMonday()`.
2. Call `ensureWeeklyPool(weekStart, gender)`:
   - If a pool already exists for `(weekStart, gender)` → leave unchanged, report `created: false`.
   - Else select songs (research Decision 2) and insert.
3. Print a summary.

### Output (human-readable summary)

Must report, at minimum:
- Target pool size (from `weekly_pool_size`, with fallback noted if used).
- Whether a pool was **created** or **already present** (idempotent skip).
- Count selected, `freshCount`, `reusedCount`.
- An explicit **under-target** warning when `|eligible| < target` (with both numbers).
- An explicit notice when **no eligible songs exist** → no pool created, existing pool (if any) preserved.

### Exit codes

| Code | Condition |
|------|-----------|
| `0` | Pool present after run (created, already-present, or under-target) — including the no-eligible-songs no-op (it is not an error; FR-009). |
| `1` | Unexpected failure (DB connection, query error). |

### Maps to

FR-001, FR-002, FR-004, FR-008, FR-009; acceptance scenarios US1-1, US1-3.

---

## 2. `confirm-idol-roles.js`

Reports idols that gameplay references but that lack role tags. **Read-only** — it never writes `roles`.

### Invocation

```bash
node backend/confirm-idol-roles.js
```

### Behavior

1. Query idols where `roles = '{}'` (empty array).
2. Print the count and the `id` + `name` of each idol missing roles.
3. Print a clear "all idols have roles" message when none are missing.

### Output

- Total idol count and number missing roles.
- A list of `{ id, name }` for each idol with no roles, so the operator can fill the gap with direct DB inserts.
- **Never** invents or writes role data.

### Exit codes

| Code | Condition |
|------|-----------|
| `0` | Report produced successfully (whether or not gaps were found). |
| `1` | Unexpected failure. |

### Maps to

FR-003; acceptance scenario US1-4; edge case "Idol missing role tags."

---

## Notes

- Both scripts open their own `pg` Pool from `DATABASE_URL` and `await pool.end()` before exit, exactly like the existing seed scripts.
- Pool selection logic lives in `services/weeklyPoolService.js`; `establish-weekly-pool.js` is a thin entry point so the scheduler and the operator share one implementation.
- Running `establish-weekly-pool.js` also triggers lineup invalidation for the affected gender (see [scheduler.md](scheduler.md)), so an operator establishing a pool over an existing week keeps lineup flags consistent.
