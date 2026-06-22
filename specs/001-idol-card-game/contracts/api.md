# API Contracts: Kpopdle Card Game

**Phase**: 1 — Design
**Date**: 2026-06-14
**Feature**: [spec.md](../spec.md) | [data-model.md](../data-model.md)

---

## Conventions

- Base path: `/api/card-game/`
- All requests and responses use `Content-Type: application/json`
- Authenticated endpoints require `Authorization: Bearer <access_token>` header
- Timestamps: ISO 8601 UTC strings
- Currency amounts: integers (pull counts, not money)
- Rarity values: `"rare"` | `"super_rare"` | `"ultra_rare"`
- Gender category values: `"gg"` | `"bg"`
- HTTP error responses: `{ "error": "<message>" }`

---

## Auth

### `POST /api/auth/register`
Create a new account.

**Request**:
```json
{
  "username": "string",
  "email": "string",
  "password": "string"
}
```

**Response 201**:
```json
{
  "userId": 42,
  "username": "string",
  "accessToken": "string",
  "refreshToken": "string"
}
```

**Side effects**: Creates starter collection (one Rare per idol), issues 3 tickets (Rare, SR, UR).

---

### `POST /api/auth/login`
Authenticate and receive tokens.

**Request**:
```json
{
  "email": "string",
  "password": "string"
}
```

**Response 200**:
```json
{
  "userId": 42,
  "username": "string",
  "accessToken": "string",
  "refreshToken": "string"
}
```

---

### `POST /api/auth/refresh`
Exchange a valid refresh token for a new access token.

**Request**:
```json
{ "refreshToken": "string" }
```

**Response 200**:
```json
{ "accessToken": "string" }
```

---

## Player Account

### `GET /api/card-game/me` *(auth required)*
Return the current player's account summary.

**Response 200**:
```json
{
  "userId": 42,
  "username": "string",
  "ggCurrency": 15,
  "bgCurrency": 0,
  "tickets": [
    { "id": 1, "rarity": "rare", "redeemed": false },
    { "id": 2, "rarity": "super_rare", "redeemed": false },
    { "id": 3, "rarity": "ultra_rare", "redeemed": false }
  ],
  "freePackAvailable": {
    "gg": true,
    "bg": false
  }
}
```

---

## Collection

### `GET /api/card-game/collection` *(auth required)*
Return all cards owned by the player.

**Query params**: `?gender=gg` (optional filter), `?rarity=super_rare` (optional filter)

**Response 200**:
```json
{
  "cards": [
    {
      "playerCardId": 101,
      "cardDefId": 55,
      "idolName": "Sana",
      "group": "TWICE",
      "rarity": "super_rare",
      "baseStat": 91,
      "currentStat": 93,
      "artPath": "/cards/super_rare/55_comeback.webp",
      "borderStyle": "silver-glow",
      "acquiredAt": "2026-06-01T10:00:00Z"
    }
  ],
  "overflowDuplicates": [
    {
      "id": 7,
      "cardDefId": 55,
      "idolName": "Sana",
      "group": "TWICE",
      "rarity": "super_rare",
      "receivedAt": "2026-06-10T14:22:00Z"
    }
  ]
}
```

---

### `POST /api/card-game/overflow/:duplicateId/convert` *(auth required)*
Convert one overflow duplicate to currency or a cosmetic item.

**Request**:
```json
{ "convertTo": "currency" }
```
or
```json
{ "convertTo": "cosmetic", "cosmeticType": "border", "cosmeticVariant": "gold-foil" }
```

**Response 200**:
```json
{
  "converted": true,
  "currencyAwarded": 1,
  "cosmeticAwarded": null
}
```

---

## Tickets

### `GET /api/card-game/tickets` *(auth required)*
List all tickets with redemption status.

**Response 200**:
```json
{
  "tickets": [
    {
      "id": 3,
      "rarity": "ultra_rare",
      "redeemed": false,
      "nextRefreshAt": null
    }
  ]
}
```

---

### `GET /api/card-game/tickets/:rarity/eligible-cards` *(auth required)*
Return all card definitions eligible for redemption with a ticket of the given rarity.

**Response 200**:
```json
{
  "cards": [
    {
      "cardDefId": 88,
      "idolName": "Wonyoung",
      "group": "IVE",
      "rarity": "ultra_rare",
      "baseStat": 97,
      "artPath": "/cards/ultra_rare/88_milestone.webp"
    }
  ]
}
```

---

### `POST /api/card-game/tickets/:ticketId/redeem` *(auth required)*
Redeem a ticket for a specific card.

**Request**:
```json
{ "cardDefId": 88 }
```

**Response 200**:
```json
{
  "redeemed": true,
  "card": {
    "playerCardId": 210,
    "cardDefId": 88,
    "idolName": "Wonyoung",
    "currentStat": 97
  }
}
```

---

## Gacha & Banners

### `GET /api/card-game/banners` *(auth required)*
List all currently active banners for the player's available gender categories.

**Response 200**:
```json
{
  "banners": [
    {
      "id": 12,
      "groupName": "TWICE",
      "rarity": "super_rare",
      "genderCategory": "gg",
      "startsAt": "2026-06-10T00:00:00Z",
      "endsAt": "2026-06-24T23:59:59Z",
      "members": [
        { "cardDefId": 55, "idolName": "Sana", "artPath": "/cards/super_rare/55_comeback.webp" },
        { "cardDefId": 56, "idolName": "Nayeon", "artPath": "/cards/super_rare/56_comeback.webp" }
      ],
      "isSoloist": false
    }
  ]
}
```

---

### `POST /api/card-game/banners/:bannerId/pull` *(auth required)*
Perform one or more pulls on a banner.

**Request**:
```json
{
  "count": 1,
  "rateUpCardDefId": 55,
  "genderCategory": "gg"
}
```
`rateUpCardDefId` is omitted for soloist banners.

**Response 200**:
```json
{
  "pulls": [
    {
      "cardDefId": 55,
      "idolName": "Sana",
      "group": "TWICE",
      "rarity": "super_rare",
      "isNew": false,
      "wasUpgrade": true,
      "newStat": 92,
      "wasOverflow": false
    }
  ],
  "currencyRemaining": 12,
  "pityCounters": {
    "super_rare": 1,
    "ultra_rare": 14
  }
}
```

`isNew`: true if the player didn't own this card before this pull.
`wasUpgrade`: true if the card already existed and its stat increased.
`wasOverflow`: true if the card was at ceiling and became an overflow duplicate.

---

### `POST /api/card-game/free-pack/claim` *(auth required)*
Claim the daily free pack of Rare cards.

**Request**:
```json
{ "genderCategory": "gg" }
```

**Response 200**:
```json
{
  "cards": [
    {
      "cardDefId": 10,
      "idolName": "Jihyo",
      "group": "TWICE",
      "rarity": "rare",
      "isNew": false,
      "wasUpgrade": true,
      "newStat": 78,
      "wasOverflow": false
    }
  ],
  "nextClaimAvailableAt": "2026-06-15T00:00:00Z"
}
```

---

## Shows & Lineup

### `GET /api/card-game/shows/today` *(auth required)*
Return today's shows with multiplier previews and submission status.

**Response 200**:
```json
{
  "shows": [
    {
      "showId": 301,
      "showName": "Music Bank",
      "date": "2026-06-14",
      "genderCategory": "gg",
      "deadline": "2026-06-14T18:45:00Z",
      "resolutionStatus": "pending",
      "multipliers": [
        { "label": "+Rapper", "appliesToType": "role" },
        { "label": "++JYP", "appliesToType": "company" }
      ],
      "playerEntry": null
    }
  ]
}
```

`playerEntry` is null if not yet entered, or a summary object if the player has a lineup that will auto-enter.

---

### `GET /api/card-game/lineup/:genderCategory` *(auth required)*
Return the player's current active lineup for a gender category.

**Response 200**:
```json
{
  "lineup": {
    "id": 50,
    "genderCategory": "gg",
    "song": {
      "songId": 7,
      "title": "I Can't Stop Me",
      "group": "TWICE",
      "memberCount": 9
    },
    "isValid": true,
    "slots": [
      {
        "slotPosition": 1,
        "playerCardId": 101,
        "idolName": "Sana",
        "cardDefId": 55,
        "currentStat": 93,
        "rarity": "super_rare",
        "artPath": "/cards/super_rare/55_comeback.webp"
      }
    ],
    "updatedAt": "2026-06-13T22:00:00Z"
  }
}
```

---

### `PUT /api/card-game/lineup/:genderCategory` *(auth required)*
Save or update the player's lineup. Replaces all slots atomically.

**Request**:
```json
{
  "songId": 7,
  "slots": [
    { "slotPosition": 1, "playerCardId": 101 },
    { "slotPosition": 2, "playerCardId": 204 }
  ]
}
```

All slots defined by `songs.member_count` must be present and non-null.

**Response 200**:
```json
{
  "saved": true,
  "appliesTo": "today",
  "deadline": "2026-06-14T18:45:00Z",
  "notice": null
}
```

If submitted after the deadline:
```json
{
  "saved": true,
  "appliesTo": "next_show",
  "deadline": "2026-06-15T18:45:00Z",
  "notice": "Your lineup will enter tomorrow's show, not today's."
}
```

---

### `GET /api/card-game/songs/weekly` *(auth required)*
Return the current week's song pool for a gender category.

**Query param**: `?genderCategory=gg`

**Response 200**:
```json
{
  "weekStartDate": "2026-06-09",
  "songs": [
    {
      "songId": 7,
      "title": "I Can't Stop Me",
      "group": "TWICE",
      "memberCount": 9
    }
  ]
}
```

---

## Leaderboard

### `GET /api/card-game/leaderboard/:showId` *(public — no auth required)*
Return the full leaderboard for a resolved show.

**Response 200**:
```json
{
  "showId": 301,
  "showName": "Music Bank",
  "date": "2026-06-14",
  "genderCategory": "gg",
  "resolvedAt": "2026-06-14T19:05:00Z",
  "entries": [
    {
      "rank": 1,
      "userId": 42,
      "username": "lucasbachur",
      "songTitle": "I Can't Stop Me",
      "finalScore": 8472,
      "cards": [
        { "idolName": "Sana", "rarity": "super_rare", "stat": 93 }
      ],
      "rewardRarity": "ultra_rare"
    }
  ],
  "playerEntry": {
    "rank": 1,
    "finalScore": 8472,
    "rewardRarity": "ultra_rare"
  }
}
```

`playerEntry` is null for unauthenticated requests or if the player didn't participate.

---

### `GET /api/card-game/leaderboard/history` *(auth required)*
Return the player's past show results.

**Query params**: `?genderCategory=gg&limit=20&offset=0`

**Response 200**:
```json
{
  "history": [
    {
      "showId": 301,
      "showName": "Music Bank",
      "date": "2026-06-14",
      "rank": 1,
      "finalScore": 8472,
      "rewardRarity": "ultra_rare"
    }
  ],
  "total": 47
}
```
