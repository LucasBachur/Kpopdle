# Feature Specification: UI Revamp & Animations

**Feature Branch**: `009-ui-revamp`

**Created**: 2026-07-20

**Status**: Done — quickstart validation pass complete (2026-07-20). Scenarios A–G pass with real data; deferred items (banner key-art assets, UR-Nayeon art, bespoke mobile drawer) are content/later-pass, not blocking bugs.

**Input**: Design handoff bundle `Kpopdle collection redesign/design_handoff_kpopdle/`
(HANDOFF.md + `designs/*.dc.html` interaction prototypes). This feature re-skins the
existing (already data-wired) pages to that spec rather than rebuilding data/routing.

**Context**: ROADMAP.md Feature 009 (P2, pre-launch). A full visual redesign of the web
interface, responsive layout, and gacha pull animations, delivered as a first pass over
every page with a planned second polish pass.

## Clarifications

### Session 2026-07-19 / 2026-07-20

- Q: SR/UR filter-pill dot colors in the prototype are swapped vs. the card borders — which
  is canonical? → A: The card mapping is canonical: **SR = gold `#eaa31c`, UR = purple
  `#9b5de5`**; the pill dots were fixed to match.
- Q: The "live voting" on the Shows page — is that a real mechanic? → A: No. It is a
  **cosmetic reveal** of the already-calculated final scores (numbers tick up unevenly to
  look live, but land exactly on the resolved scores). No live voting exists in the backend.
- Q: The stats "Win Rate" tile — how is it computed? → A: It can't be — the minigames have
  **no loss condition** (you guess until you hit), so win-rate is always 100%. Replaced with
  **Average Guesses** (derived from a new `totalGuesses` accumulator in `useStats`).
- Q: Pity threshold shown in the design (90) — real value? → A: Placeholder. Real values live
  in `gacha_config`: **SR 50 / UR 100**. The design's bar is the UR pity.
- Q: Banner "group key art" assets? → A: None exist yet. A path convention was established
  (`/banner-art/<bannerId>.webp`) with a placeholder fallback; real assets added later.

## User Scenarios & Testing

### User Story 1 — Shared shell & sidebar (Priority: P1)

Every page renders inside a lilac app shell with a fixed collapsible left **Sidebar** (76px
rail, hover-to-open, chevron pin), with the current route highlighted (gold active, white
hover box) and a footer account/log-out.

### User Story 2 — Collection (P1)

Frosted "My Collection" header; **All / Rare / Super Rare / Ultra Rare** filter pills (click
an active pill to clear it), a stat sort toggle, and an idol/group search — all instant,
client-side over the loaded collection. Cards convey rarity by border only, stat badge
bottom-left, name on hover; the existing detail modal (duplicate conversion) is retained.

### User Story 3 — Lineup (P1)

Two states: **View** (saved lineup summary + today's boosts + Edit) and **Edit** (bottom-dock
builder — collection grid + sticky loadout dock). Enforces one-idol-per-lineup (dimmed when
used), song-switch confirm (clears lineup), and submit-only-when-full. Chemistry preview
(Feature 003) retained.

### User Story 4 — Banners & summon (P1)

Side-stack carousel with a centered `SummonPanel` (key art, rate-up member row, real pity bar,
×1/×10). Pulling plays a cinematic `SummonSequence` (album → vinyl → pack-opening → card
fly-out → flip grid) with rarity glows (UR pulses). Rates popup, lightstick currency, daily
free-pull bar with reset countdown. Feature 005 free-pull exclusivity preserved.

### User Story 5 — Shows & result (P2)

Live/Archive tabs. Live: pre-show (deadline countdown + boosts + lineup-locked) when pending;
winner + podium + ranking when resolved, with a **cosmetic score count-up reveal** (once per
show, Replay). Archive: real history → detail (podium + top 10). `ShowResultPage` reskinned.

### User Story 6 — Entry pages (P2)

Kpopdle & Guess the Song re-skinned to the shell: header mode selector (touch-friendly), dark
guess input + rich suggestion dropdown, guess grid / audio player, and a dark `StatsModal`
bound to real `useStats` (Played / Avg Guesses / Current / Max) with next-reset countdown.

## Requirements

- **FR-001** All card-game + entry pages use the shared token system (`card-game/tokens.css`)
  and CSS Modules; no legacy global page CSS remains.
- **FR-002** Rarity is conveyed by card border only; canonical colors R silver / SR gold /
  UR purple.
- **FR-003** Collection filter/sort/search are client-side and instant.
- **FR-004** Lineup enforces one-idol-per-lineup, song-switch confirm, submit-when-full.
- **FR-005** Comeback banners require a rate-up selection to pull; Special banners do not.
- **FR-006** The pity bar reflects the player's real UR pity counter/threshold, refreshed
  after each pull (`GET /api/card-game/pity`).
- **FR-007** Pull-result cards carry `artPath`; member + reveal + collection cards show real
  art with a PHOTO placeholder fallback.
- **FR-008** The Shows resolved view animates a cosmetic count-up that lands exactly on the
  real resolved scores; auto-plays once per show (localStorage-gated) with Replay.
- **FR-009** Stats reflect real `useStats` data; "win rate" replaced with average guesses.
- **FR-010** Every page avoids horizontal page overflow at narrow widths (responsive pass).

## Out of Scope / Deferred

- Banner **group key-art assets** (convention + fallback shipped; images pending).
- **UR-Nayeon** card art (`art_path` points at a missing `placeholder.jpg`).
- A **bespoke mobile experience** (drawer sidebar, etc.) — current pass is a fluid desktop-first
  responsive layer.
- Second **polish pass** micro-details (the planned revisit).

## Success Criteria

- All six user stories usable end-to-end with real data; no console/build errors.
- `npm run build` (frontend) succeeds; backend `node --check` clean.
- Deferred items are content/assets or an explicit later pass — not blocking bugs.
