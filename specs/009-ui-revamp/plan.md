# Implementation Plan: UI Revamp & Animations

**Branch**: `009-ui-revamp` | **Date**: 2026-07-20 | **Spec**: [spec.md](spec.md)

**Input**: Design handoff bundle `Kpopdle collection redesign/design_handoff_kpopdle/`

## Summary

Re-skin every card-game page plus the two game entry pages to the design handoff, on a shared
CSS-variable token system, using CSS Modules and existing per-feature component patterns. Data
fetching/routing is unchanged; presentation is replaced and marked bindings are wired to real
sources. Two small backend additions surface data the new UI needs (pity, card art on pulls).

## Technical Context

**Language/Version**: React 19 (frontend), Node.js 18+ (backend)
**Primary Dependencies**: React Router 7, Vite 8, Express 5, `pg`, `react-confetti`
**Styling**: CSS Modules + one shared token file (`frontend/src/card-game/tokens.css`); no
component library; all icons inline SVG copied from the prototypes.
**Storage**: PostgreSQL (no schema change this feature).
**Testing**: No framework — manual end-to-end validation per `quickstart.md`.
**Constraints**: ART timezone governs daily-reset countdowns; `gg_only_mode` in effect
(hardcoded `gg`). `overflow-clip-margin` (summon reveal) needs a modern browser.

## Design tokens

`frontend/src/card-game/tokens.css` (`:root` vars, imported in `main.jsx`): lilac bg, gold
`#f5c43d` / deep `#eaa31c`, plum `#1b1622`, ink scale, surface/frost, rarity→border colors
(R `#b3b6c4` / SR `#eaa31c` / UR `#9b5de5`), radii, and the Plus Jakarta Sans / Space Mono
font imports.

## Source Code changes

### Frontend — new

```text
frontend/src/card-game/
├── tokens.css                       # shared design tokens + fonts
├── components/
│   ├── Sidebar.jsx / .module.css        # shared collapsible sidebar
│   ├── LineupCard.jsx / .module.css     # 5-state lineup card/slot
│   ├── SummonPanel.jsx / .module.css    # centered summon UI (art, rate-up, pity, pulls)
│   ├── SummonSequence.jsx / .module.css # cinematic intro + flip reveal grid
│   ├── CardPhoto.jsx / .module.css      # card art w/ PHOTO fallback (member + reveal cards)
│   └── BannerKeyArt.jsx / .module.css   # group key art w/ placeholder fallback
frontend/src/components/
│   ├── GuessInput.module.css, Kpopdle.module.css, SongGuess.module.css,
│   └── ModeSelector.module.css, StatsModal.module.css   # CSS Modules for re-skinned games
frontend/public/banner-art/README.md    # key-art path convention (see below)
```

### Frontend — rewritten / re-skinned

`App.jsx` (+ `App.css`), `CardTile`, `CollectionPage`, `LineupPage`, `BannersPage`,
`LeaderboardPage` (Shows), `ShowResultPage`, `LeaderboardTable` (light theme), `cardGameApi.js`
(`getPity`); entry-game components `Kpopdle`, `SongGuess`, `GuessInput`, `ModeSelector`,
`StatsModal`, `utils.js` (`useStats.totalGuesses`).

### Frontend — retired

`BannerCard`, `DailyBannerCard`, `GachaModal`, `LineupBuilder` (+ their CSS), and legacy global
`Kpopdle.css` / `SongGuess.css` / `ModeSelector.css`.

### Backend

- `routes/cardGame.js` — `GET /api/card-game/pity` (real SR/UR counts + `gacha_config`
  thresholds).
- `services/gachaService.js` — `artPath` added to daily + banner pull-result cards.

## Key decisions

- **Card art path**: `/cards/<artPath>` where `artPath` defaults to `<rarity>/<cardDefId>.webp`
  (backend COALESCE). **Banner key art**: `/banner-art/<bannerId>.webp`, placeholder fallback,
  documented in `frontend/public/banner-art/README.md`.
- **Summon reveal**: three stages (`intro → cardsOut → grid`). `cardsOut` flies cards out of
  the pack via the Web Animations API reading live positions; container uses
  `overflow: clip` + `overflow-clip-margin` so glows paint beyond without spawning scrollbars;
  cards are height-capped (`min(12vw,22vh)`) so tall pulls fit without scroll.
- **Shows reveal**: rAF count-up with per-entry wobble that lands exactly on real scores;
  once-per-show via `localStorage` (`cg_show_revealed_<showId>`) + Replay.
- Retained: Collection detail modal (duplicate conversion), Lineup chemistry preview.

## Complexity Tracking

No schema change. Deferred items are content/assets, not code. Second polish pass planned.
