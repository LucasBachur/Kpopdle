# Contract: GG-Only Mode Guard

**Component**: `middleware/ggOnlyGuard.js` + `GET /me` flag surfacing
**Requirements**: FR-001, FR-002, FR-003, FR-004, FR-004a; SC-001, SC-001a, SC-002

## Flag source of truth

- `getGgOnlyMode()` reads `gacha_config.gg_only_mode`. Returns `true` when the row is missing or `parseFloat(value) !== 0`; `false` only for explicit `'0'`.
- Default seeded value: `'1'` (enabled).

## Middleware behavior

`ggOnlyGuard` is applied to BG-capable card-game routes. For each request it:

1. Resolves gender from `req.params.genderCategory` → `req.body?.genderCategory` → `req.query?.genderCategory` (first defined wins); defaults to `gg` when none present.
2. If resolved gender is **not** `bg` → `next()` (GG and unknown-but-non-bg pass to the handler, which performs its own enum validation).
3. If resolved gender is `bg`:
   - `gg_only_mode` enabled → respond `403 { "error": "Boy Group content is not available." }`. No handler runs; no state read or written.
   - `gg_only_mode` disabled → `next()` (BG behaves like GG, FR-004).

## Routes guarded

| Method | Path                              | Gender source        |
|--------|-----------------------------------|----------------------|
| POST   | `/api/card-game/daily-pull/claim` | body                 |
| GET    | `/api/card-game/songs/weekly`     | query                |
| GET    | `/api/card-game/lineup/:genderCategory` | params         |
| PUT    | `/api/card-game/lineup/:genderCategory` | params         |
| GET    | `/api/card-game/leaderboard/history`    | query          |

> `GET /banners` and `GET /shows/today` are hardcoded to `gg` and return no BG data, so they require no guard; they remain GG-only by construction.

## Gender-from-resource route: banner pull

`POST /banners/:bannerId/pull` resolves gender from the **banner record**
(`getBannerWithMembers(bannerId).genderCategory`), not from the request. The
generic `ggOnlyGuard` cannot see it, so the handler MUST, after loading the
banner, return `403 { "error": "Boy Group content is not available." }` when the
banner's `genderCategory` is `bg` and `gg_only_mode` is enabled — **before** any
currency is spent. (Without this, a player could pull a BG banner by guessing its
id while GG-only mode is enabled.)

## Frontend contract

- `GET /me` response gains a top-level boolean field `ggOnlyMode`.
- Frontend reads `me.ggOnlyMode`; while `true`, no Boy-Group entry point (tab, button, nav item, gender selector, BG label that initiates a BG action) is rendered or actionable.
- Frontend hiding is UX-only; the 403 guard remains the authoritative gate.

## Acceptance checks

- Enabled + any BG-targeted request → `403`, zero BG records returned/written (SC-001).
- Enabled + equivalent GG request → succeeds normally (FR-003).
- Disabled + BG request → behaves identically to GG (SC-002).
- Enabled → `GET /me` returns `ggOnlyMode: true`; UI shows zero BG entry points (SC-001a).
- Toggling `gacha_config.gg_only_mode` takes effect on the next request with no restart.
</content>
