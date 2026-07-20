# Banner group key art

Group-shot / comeback **key art** for gacha banners — the wide image shown on each
banner tile and behind the summon-panel hero on the Banners page. This is **distinct
from individual card art** (which lives under `frontend/public/cards/<rarity>/<cardDefId>.webp`).

## Path convention

```
frontend/public/banner-art/<bannerId>.webp   →  served at  /banner-art/<bannerId>.webp
```

- `<bannerId>` is the banner row's database `id` (the `id` field in the `GET /api/card-game/banners`
  response). Each banner row is one comeback/event, so keying by `id` gives a unique,
  collision-free filename.
- **Format:** `.webp`. Recommended source ratio ~16:9 (landscape group shot); it is rendered
  with `object-fit: cover` in both the tile (206×116) and the hero (full-width × 172).
- The daily banner does **not** need key art (it renders as the header "Daily Summon" bar,
  not a tile/hero).

## Fallback

If the file is absent, the UI shows a striped **"GROUP KEY ART"** placeholder gradient
(the accent color is derived deterministically from the group name). No error is thrown —
drop a correctly-named `.webp` here and it appears automatically, no code change needed.

The lookup + fallback lives in `frontend/src/card-game/components/BannerKeyArt.jsx`; the
path is built in `bannerVM()` in `frontend/src/card-game/pages/BannersPage.jsx`.

## Status

No assets yet — every banner currently shows the placeholder. This folder + convention
exist so real art can be added later (e.g. via the planned operator admin UI, Feature 008).
