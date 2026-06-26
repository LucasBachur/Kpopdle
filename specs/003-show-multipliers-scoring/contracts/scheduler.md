# Contract: Scheduler & Scoring Engine Changes

**Phase**: 1 — Design | **Feature**: [../spec.md](../spec.md)

---

## 1. `createTodayShows()` in `backend/scheduler.js` — multiplier copy-on-create

**Current behaviour**: Calls `getOrCreateTodayShow(today, gender, scheduleId, showName, deadline)` and logs the result. Does not touch `show_multipliers`.

**`getOrCreateTodayShow` return shape change**: Add `(xmax = 0) AS "created"` to the RETURNING clause. The returned object gains a `created: boolean` field — `true` when the row was freshly inserted, `false` when the conflict path fired (show already existed). The fallback SELECT path (resolved show) sets `created: false` explicitly.

**New behaviour**: After `getOrCreateTodayShow` returns a show, check `if (show.created)` — if true, call `copyScheduleMultipliers(show.id, scheduleId)`.

**`copyScheduleMultipliers(showId, scheduleId)` — new `db.js` function**:
- Inserts from `show_schedule_multipliers WHERE schedule_id = scheduleId` into `show_multipliers` for `showId`
- Uses `ON CONFLICT (show_id, applies_to_type, COALESCE(applies_to_value,'')) DO NOTHING` — requires the unique index added by T001 migration (`show_multipliers_uniq`); prevents double-copy if called more than once for the same show
- Returns the count of rows inserted
- Logs: `[scheduler] Copied N multiplier templates to show ${showId} from schedule ${scheduleId}`
- If `scheduleId` is null (special event show), skips silently — no error

**Safety**: `getOrCreateTodayShow` is already idempotent (returns existing show if one exists for that date+gender). The copy only runs on the first creation, so re-running `createTodayShows()` at startup does not re-copy into an already-populated show.

---

## 2. `calculateScore()` in `backend/services/showService.js` — chemistry bonus

**Signature change**: `calculateScore(lineupSlots, multipliers, config, groupSizeMap)`

- `groupSizeMap`: `Map<string, number>` of `{ groupName → totalIdolCount }`, built once per show resolution from `SELECT "group", COUNT(*)::int AS cnt FROM idols GROUP BY "group"`.

**New computation step** (applied after show multipliers, before random factor):

```
For each group G in lineupSlots:
  n = count of slots where slot.group === G
  G_size = groupSizeMap.get(G) ?? n   // fallback: treat n as full if unknown
  chemistry_ratio = n >= G_size ? 1.0 : (n <= 1 ? 0 : 1 - Math.pow(0.5, n - 1))

chemistry_ratio_final = max(chemistry_ratio across all groups)
chemistry_max_bonus   = config.chemistry_max_bonus ?? 0.15
chemistry_multiplier  = 1 + chemistry_ratio_final × chemistry_max_bonus

finalScore = Math.round(score_after_show_multipliers × sizeBonus × randomFactor × chemistry_multiplier)
```

**Invariant**: `chemistry_multiplier >= 1.0` always. No lineup can score lower due to chemistry.

---

## 3. `isMultiplierApplicable()` in `backend/services/showService.js` — same_group fix

**Current `same_group` branch**:
```js
case 'same_group': {
  const groups = new Set(lineupSlots.map(s => s.group));
  return groups.size === 1;
}
```

**Fixed branch** (distinguishes homogeneity vs. specific group):
```js
case 'same_group': {
  if (!val || val === 'any') {
    // Homogeneity: all cards must share one group
    const groups = new Set(lineupSlots.map(s => s.group?.toLowerCase()));
    return groups.size === 1;
  }
  // Specific group: at least one card from the named group
  return lineupSlots.some(s => s.group?.toLowerCase() === val);
}
```

(`val` is already `multiplier.appliesToValue?.toLowerCase()` from the outer scope.)

---

## 4. `assignRanksAndRewards()` in `backend/services/showService.js` — tie-handling fix

**Current code** (`rank = i + 1` — sequential position):
```js
for (let i = 0; i < entries.length; i++) {
  const rank = i + 1;
  ...
}
```

**Fixed code** (standard competition ranking — 1224 style):
```js
let currentRank = 1;
for (let i = 0; i < entries.length; i++) {
  if (i > 0 && entries[i].finalScore < entries[i - 1].finalScore) {
    currentRank = i + 1; // skip ranks for tied group above
  }
  const percentile = currentRank / total;
  ...
}
```

Entries are already `ORDER BY final_score DESC`. The fix is two lines: declare `currentRank` before the loop, add the conditional update inside the loop.

---

## 5. `GET /api/card-game/shows/today` in `backend/routes/cardGame.js` — multiplier labels

**New field in show response**:
```json
{
  "showId": 42,
  "showName": "M Countdown",
  "deadline": "2026-06-26T20:45:00Z",
  "resolutionStatus": "pending",
  "multiplierLabels": ["+Rapper"]
}
```

- `multiplierLabels`: array of label strings only — no `multiplier_value`, no `applies_to_type`.
- Populated by `SELECT label FROM show_multipliers WHERE show_id = $1`.
- Empty array `[]` when the show has no multipliers (no error, no omission).

**Label display logic** (which show's labels to surface on lineup page):
- Query: the most recent show with `resolution_status = 'pending'` for `gender_category = 'gg'`, ordered by `deadline ASC`, limit 1.
- If no pending show exists: return `multiplierLabels: []`.
- This naturally handles: pre-deadline (today's show, pending), post-deadline/pre-resolution (today's show, still pending), and post-resolution (tomorrow's show, pending).

---

## 6. `getPlayerCards()` in `backend/db.js` — groupSize addition

**New column in query**:
```sql
(SELECT COUNT(*)::int FROM idols i2 WHERE i2."group" = i."group") AS "groupSize"
```

Added to the existing `getPlayerCards(userId)` SELECT. Returned as `groupSize: number` in each card object. Used by `LineupBuilder.jsx` for client-side chemistry preview computation.

---

## 7. Frontend: `LineupPage.jsx` — multiplier labels panel

**New behaviour**:
- On mount, fetch `GET /api/card-game/shows/today` (already called or can share with existing fetch).
- If `multiplierLabels.length > 0`, render a "Today's Bonuses" chip row above `LineupBuilder`: one chip per label (e.g., `+Rapper`, `+SM Ent`).
- If empty, render nothing (no empty section, per FR-012).

---

## 8. Frontend: `LineupBuilder.jsx` — live chemistry preview

**New behaviour**: As the player fills or changes slots, compute and display chemistry.

**Computation** (client-side, no API call):
```
For each group G among currently-filled slots:
  n = count of filled slots whose card.group === G
  G_size = any card in ownedCards where card.group === G → card.groupSize
  chemistry_ratio = n >= G_size ? 1.0 : (n <= 1 ? 0 : 1 - 0.5^(n-1))

Display: for each group where chemistry_ratio > 0:
  "<group_name>: <Math.round(chemistry_ratio * 100)>% Chemistry"

If no group has chemistry_ratio > 0: render nothing.
```

**Data requirement**: `ownedCards` already includes `group`; `groupSize` is the new field added in Decision 6 above. No new API call needed.
