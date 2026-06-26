# Contract: Write-Route Input & Ownership Validation

**Component**: `routes/cardGame.js`
**Requirements**: FR-005…FR-010; SC-003, SC-004

All validation failures return a JSON error and make **no** state change. Gating (`403`) is distinct from bad input (`400`); ownership failure is `403`.

## Banner pull — `POST /banners/:bannerId/pull`

| Input        | Rule                                  | Failure |
|--------------|---------------------------------------|---------|
| `:bannerId`  | parseable integer                     | `400 Invalid bannerId` |
| `count`      | integer 1–10 inclusive                | `400 count must be 1–10` — no currency spent, no cards granted |

Status: **already implemented**; confirm via quickstart boundary checks (0, 1, 10, 11, non-numeric).

## Gender category — every gender-bearing route

| Rule                                | Failure |
|-------------------------------------|---------|
| `genderCategory ∈ {gg, bg}`         | `400` (e.g. `genderCategory must be "gg" or "bg"`) |

Applies to daily-pull claim (FR-006 free-pack case), songs/weekly, lineup GET/PUT, leaderboard/history. Status: **already implemented**.

## Lineup submission — `PUT /lineup/:genderCategory`

Validation order (first failure wins; all return `400` unless noted):

1. `songId` present and `slots` is a non-empty array. → `400`
2. Song is in this week's pool. → `409` (existing behavior, not a validation failure per se)
3. `slots.length === song.memberCount`. → `400` (FR-008)
4. **Slot shape** (NEW): every slot has integer `playerCardId` and integer `slotPosition`. → `400` (closes a 500→400 gap so malformed IDs never reach the int-array cast). (FR-010)
5. Slot positions unique. → `400 Duplicate slot positions` (FR-007)
6. Card existence: every `playerCardId` exists in `player_cards` (for any user). Any id absent entirely → `400 One or more cards do not exist` (FR-009).
7. Card ownership: every existing `playerCardId` belongs to the requesting user. Any card owned by another user → `403 One or more cards do not belong to this player` (FR-009).

On any failure the prior lineup is unchanged (writes happen only inside the final transaction). Status: rules 1–3, 5, 7 **already implemented**; rule 4 (slot shape) and rule 6 (non-existent-card `400`, split out from the former combined `403`) are the **new** hardening.

## Free-pack claim — `POST /daily-pull/claim`

| Input            | Rule                          | Failure |
|------------------|-------------------------------|---------|
| `genderCategory` | ∈ {gg, bg}, defaults `gg`     | `400` (FR-006). Also subject to the GG-only `403` guard for `bg`. |

## Acceptance checks (SC-003, SC-004)

- Pull count 0 / 11 / `"x"` / missing → `400`, balance unchanged.
- Unknown gender category on any write → `400`.
- Two slots with same `slotPosition` (even if both owned) → `400`, lineup unchanged.
- Filled-slot count ≠ song member count → `400`.
- Lineup with a card owned by another user → `403`; a non-existent card id → `400`; a missing/non-integer `playerCardId` → `400` — each rejected, lineup unchanged.
- Lineup using only the player's own cards with valid shape → saves.
</content>
