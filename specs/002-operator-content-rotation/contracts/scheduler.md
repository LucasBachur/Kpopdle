# Contract: Weekly Rotation Job & Lineup Invalidation

**Phase**: 1 — Design | **Feature**: [../spec.md](../spec.md)

This feature adds a recurring job to the existing `backend/scheduler.js` (which already runs daily show creation and per-minute resolution). The job's "interface" is its scheduling, its effect on `weekly_song_pools` and `lineups`, and its safety guarantees.

---

## Job: weekly pool rotation

### Schedule

| Property | Value |
|----------|-------|
| Cron | `0 3 * * 1` |
| Timezone | `UTC` (03:00 UTC Monday = 00:00 ART Monday) |
| Startup catch-up | Yes — invoked once at server start, alongside the existing `createTodayShows()` startup call |

### Entry point

`rotateAllGenders()` registered in `scheduler.js`:

```
for gender in SURFACED_GENDERS (['gg'], optionally 'bg' hidden):
    result = ensureWeeklyPool(getMonday(), gender)   // current ART Monday
    invalidateStaleLineups(getMonday(), gender)
    log(result)
```

### `ensureWeeklyPool(weekStart, genderCategory)` — contract

| Guarantee | Detail | Maps to |
|-----------|--------|---------|
| Creates current-week pool | At `weekly_pool_size`, eligible songs only | FR-005 |
| Prefers fresh songs | Zero overlap with previous week when ≥ size fresh songs exist | FR-006, SC-005 |
| Fills by reuse | Reuses previous-week songs only to reach size when fresh are scarce | FR-006, SC-005 |
| Idempotent | Existing pool for the week left unchanged | FR-007, SC-007 |
| Under-target tolerant | `|eligible| < size` → pool of all eligible + recorded under-target, no failure | FR-008 |
| Empty-catalog safe | `|eligible| = 0` → no pool created, existing pool preserved, no error | FR-009 |
| Late/repeat safe | Always targets current ART Monday; safe to run late or twice; startup catches a missed boundary | FR-010 |

Returns the pool selection result structure (see [../data-model.md](../data-model.md)).

### `invalidateStaleLineups(weekStart, genderCategory)` — contract

| Guarantee | Detail | Maps to |
|-----------|--------|---------|
| Flags stale lineups | `is_valid = FALSE` for every lineup in this gender whose `song_id ∉` the week's pool | FR-011, SC-006 |
| Preserves valid lineups | Lineups whose song remains in the pool are not written | FR-012, SC-006 |
| No-op when nothing stale | If no lineup is out-of-pool (or none exist), no rows change | edge: "Player has no saved lineup" |
| Re-validation unchanged | Returning a flagged lineup to valid is handled by the existing `upsertLineup` on save, not here | FR-013 |

Implemented as a single bulk `UPDATE … WHERE gender_category = $1 AND song_id NOT IN (<pool song ids>)`. When the pool is empty (no-eligible-songs no-op), invalidation is **skipped** so an existing valid lineup is not flagged against an empty set.

### Scope guard

`SURFACED_GENDERS` drives both rotation and any player-facing read. `GET /songs/weekly` is gender-scoped and the GG-launch UI requests only `gg`, so a `'bg'` pool — even if formed — is never returned in a player-facing response (FR-014, SC-008).

---

## Logging

Each run logs, per gender: created vs. already-present, selected/fresh/reused counts, under-target flag, and number of lineups invalidated — consistent with the existing scheduler's `console.log` style, so operators can confirm rotation from server logs.

## Failure isolation

A failure for one gender is caught and logged without aborting the other gender or the rest of the scheduler (mirrors the existing `createTodayShows()` per-gender try/catch).
