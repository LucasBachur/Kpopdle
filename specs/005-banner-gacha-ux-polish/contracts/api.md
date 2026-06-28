# API Contracts: Banner & Gacha UX Polish

All endpoints are under `/card-game` and require JWT `Authorization: Bearer <token>` unless noted.

---

## Modified Endpoints

### `GET /card-game/banners`

Returns active banners for the player's gender scope.

**Change**: Each banner object in the `banners` array gains a `subtitle` field.

**Response (changed fields only)**:

```jsonc
{
  "banners": [
    {
      "id": 7,
      "groupName": "aespa",
      "genderCategory": "gg",
      "startsAt": "2026-06-01T00:00:00.000Z",
      "endsAt": "2026-07-01T00:00:00.000Z",  // null for permanent banners
      "description": null,                    // UNCHANGED — type discriminator; never "daily" for non-daily banners shown here
      "subtitle": "Summer Comeback Event",    // NEW — operator-set display text; null → no subtitle shown
      "freePullsRemaining": 5,
      "members": [ /* ... unchanged ... */ ]
    }
  ]
}
```

**No change to**: `description`, `freePullsRemaining`, `members`, `startsAt`, `endsAt`.

---

### `GET /card-game/leaderboard/:showId`

Returns the show result and leaderboard for `showId`.

**Change**: Response gains an `autoEntryStatus` top-level field.

**Response (changed fields only)**:

```jsonc
{
  "show": { /* ... unchanged ... */ },
  "myEntry": { /* ... unchanged ... */ },
  "leaderboard": [ /* ... unchanged ... */ ],
  "autoEntryStatus": {           // NEW
    "isRegistered": true         // true = player has a valid lineup for today's show in this gender category
  }
}
```

**`autoEntryStatus.isRegistered` semantics**:
- `true`: player has a `lineups` row with `gender_category = show.genderCategory` and `is_valid = TRUE`. Their lineup will auto-enter today's show.
- `false`: no lineup exists, or `is_valid = FALSE` (lineup was invalidated — e.g., song removed from weekly pool).
- Always reflects **today's** lineup state, regardless of which historical `showId` is being viewed (FR-014).

---

## Unchanged Endpoints

### `POST /card-game/banners/:bannerId/pull`

No interface change. Internal behavior changes:
- Free pull balance read moved inside the `BEGIN` transaction with `SELECT ... FOR UPDATE` (FR-004).

### `POST /card-game/daily-pull/claim`

No interface change. Internal behavior changes:
- Card selection now draws from the daily banner's `banner_cards` pool instead of the global/event SR pool fallback chain (FR-015/FR-017).
- If the daily banner's `banner_cards` pool is empty, returns `500` with `{ "error": "Daily banner card pool is not configured" }` and does **not** consume the daily pull entitlement.

---

## Operator Flows (no API — direct DB)

These are documented for completeness; they use direct `psql` / SQL, consistent with existing operator patterns.

### Grant banner free pulls to a player

```sql
INSERT INTO banner_free_pulls (user_id, banner_id, free_pulls_remaining)
VALUES (<player_id>, <banner_id>, <count>)
ON CONFLICT (user_id, banner_id)
DO UPDATE SET free_pulls_remaining = <count>;
```

### Set banner subtitle

```sql
UPDATE banners SET subtitle = 'Summer Comeback Event' WHERE id = <banner_id>;
```

### Configure daily banner card pool

```sql
-- Step 1: find the daily banner id
SELECT id FROM banners WHERE description = 'daily' AND gender_category = 'gg';

-- Step 2: insert cards (idempotent via ON CONFLICT DO NOTHING if unique constraint exists)
INSERT INTO banner_cards (banner_id, card_def_id) VALUES (<daily_id>, <card_def_id>);

-- Step 3: verify
SELECT cd.id, i.name, cd.rarity FROM banner_cards bc
JOIN card_definitions cd ON cd.id = bc.card_def_id
JOIN idols i ON i.id = cd.idol_id
WHERE bc.banner_id = <daily_id>;
```
