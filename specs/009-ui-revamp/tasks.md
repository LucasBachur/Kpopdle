---
description: "Task list for UI Revamp & Animations"
---

# Tasks: UI Revamp & Animations

**Input**: Design handoff bundle + [spec.md](spec.md), [plan.md](plan.md)

**Tests**: Not requested — manual end-to-end validation per [quickstart.md](quickstart.md).

**Status legend**: `[X]` done · `[~]` done but deferred-detail remains · `[ ]` not started

**Note**: This feature was built directly from the design handoff (not the speckit
plan-first flow), so this file is a *record of work done* + the remaining backlog, rather than
a pre-implementation plan. All code is committed on `dev` (`a25c82f`).

---

## Phase 0: Foundation

- [X] T001 Shared token file `frontend/src/card-game/tokens.css` (vars + fonts), imported in `main.jsx`
- [X] T002 App shell: lilac gradient + 76px content offset in `App.css`

## Phase 1: Sidebar (shared)

- [X] T010 `Sidebar.jsx` / `.module.css` — 76px rail, hover-to-open, chevron pin, inline SVG icons
- [X] T011 Active (gold) + hover (white box) states; fixed stray blue `a:hover` bleed-through
- [X] T012 Wire into `App.jsx`; retire old inline sidebar; "Leaderboard" → "Shows" nav

## Phase 2: Collection

- [X] T020 Frosted header + toolbar (filter pills w/ correct SR/UR dots, sort, search)
- [X] T021 Client-side rarity/search(idol+group)/sort; active-pill click clears filter
- [X] T022 Rewrite `CardTile` (border-only rarity, stat badge, name-on-hover, 5/7)
- [X] T023 Light re-skin of the detail modal (duplicate conversion retained)

## Phase 3: Lineup

- [X] T030 `LineupCard` (empty/active/filled/picker/pickerDim)
- [X] T031 View state (saved lineup + today's boosts + Edit/Build)
- [X] T032 Edit state (bottom-dock builder); one-idol-per-lineup, submit-when-full
- [X] T033 Song-switch confirm dialog; chemistry preview retained; retire `LineupBuilder`

## Phase 4: Banners & summon

- [X] T040 `SummonPanel` (key art, rate-up member row, pity bar, ×1/×10); rates popup
- [X] T041 Header: Banners pill, daily-summon bar w/ reset countdown, lightstick currency
- [X] T042 Side-stack carousel; Feature 005 free-pull exclusivity preserved
- [X] T043 `SummonSequence` reveal grid (flip, Flip All, rarity glow, UR flash)
- [X] T044 Cinematic intro (album → vinyl → pack-opening); `cardsOut` card fly-out (WAAPI)
- [X] T045 Hover scale + rarity glow (both faces); UR-only pulsing glow; scroll/clip fixes
- [X] T046 `GET /pity` endpoint + live pity bar; refetch after each pull
- [X] T047 Card art: `artPath` on pull results + `CardPhoto`; `BannerKeyArt` + convention

## Phase 5: Shows

- [X] T050 Live/Archive tabs; pre-show (pending) vs winner+podium+ranking (resolved)
- [X] T051 Cosmetic score count-up reveal (lands on real scores; once-per-show + Replay)
- [X] T052 Archive list (real history) → detail (podium + top 10); right-rail "your card"
- [X] T053 `ShowResultPage` reskin (kept `LeaderboardTable`, re-themed)

## Phase 6: Entry pages (Kpopdle / Guess the Song)

- [X] T060 Shared dark `GuessInput` + rich suggestion dropdown (CSS Module, `renderSuggestion`)
- [X] T061 `ModeSelector` in page header, touch-friendly tap-to-expand
- [X] T062 Kpopdle guess grid (green/red, age arrows, All-mode Group Type column)
- [X] T063 Guess the Song audio player + guess-list; progressive `timeUnlocks` preserved
- [X] T064 Dark `StatsModal` on real `useStats`; win-rate → avg-guesses (`totalGuesses`)

## Phase 7: Cross-cutting

- [X] T070 Responsive pass (media queries all pages; touch mode selector)
- [X] T071 Commit on `dev`; ROADMAP Feature 009 → Completed
- [X] T072 SpecKit docs (`specs/009-ui-revamp/`)

---

## Remaining (tomorrow's finalization pass)

- [ ] T080 End-to-end playtest of the **under-examined** pages (Collection, Lineup, Shows,
      Kpopdle, Guess the Song) per [quickstart.md](quickstart.md); log issues
- [ ] T081 Fix any blocking issues found; batch micro-polish into the revisit
- [ ] T082 **Decision**: banner group key-art assets — source images or leave placeholder
- [ ] T083 **Decision**: UR-Nayeon (`card_def` 27) art — supply file or update `art_path`
- [ ] T084 **Decision**: bespoke mobile experience now vs. later (currently fluid desktop-first)
- [ ] T085 Mark Feature 009 **Done** in spec.md + ROADMAP once validation passes
