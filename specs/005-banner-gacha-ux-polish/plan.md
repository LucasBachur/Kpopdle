# Implementation Plan: Banner & Gacha UX Polish

**Branch**: `005-banner-gacha-ux-polish` | **Date**: 2026-06-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-banner-gacha-ux-polish/spec.md`

## Summary

Five UX polish items for the banner/gacha system: enforce free pull exclusivity with atomic DB locking; add a per-banner subtitle field and live 60-second countdown on the Banners page; confirm the soloist banner rate-up skip (already implemented — verify only); add an auto-entry status card to the show result page; and wire the daily banner to draw from its own configured `banner_cards` pool instead of the global card pool.

## Technical Context

**Language/Version**: Node.js 18+ (backend), React 19 (frontend)

**Primary Dependencies**: Express 5.1.0, `pg` (PostgreSQL client), React Router 7, Vite 8

**Storage**: PostgreSQL — direct SQL queries via `pg` pool; no ORM

**Testing**: No test framework — manual end-to-end validation per `quickstart.md`

**Target Platform**: Web application (Linux server + browser)

**Project Type**: Full-stack web application (monorepo: `backend/` + `frontend/`)

**Performance Goals**: 60-second countdown timer must not cause perceptible re-render jank; pull endpoint P95 unchanged

**Constraints**: ART timezone (`America/Argentina/Buenos_Aires`, UTC-3, no DST) governs all daily-reset logic; `gg_only_mode` suppresses BG paths throughout

**Scale/Scope**: Single-tenant operator deployment; player count O(hundreds)

## Constitution Check

Constitution file is a blank template — no project-level gates are defined. No violations to track.

## Project Structure

### Documentation (this feature)

```text
specs/005-banner-gacha-ux-polish/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0 output (/speckit-plan)
├── data-model.md        # Phase 1 output (/speckit-plan)
├── quickstart.md        # Phase 1 output (/speckit-plan)
├── contracts/           # Phase 1 output (/speckit-plan)
└── tasks.md             # Phase 2 output (/speckit-tasks — not yet created)
```

### Source Code (repository root)

```text
backend/
├── db.js                          # Add subtitle to banner queries; getDailyBannerCards();
│                                  # atomic free-pull lock helper; getLineupForAutoEntry()
├── migrate-card-game.js           # ADD COLUMN subtitle TEXT NULL TO banners
├── services/
│   └── gachaService.js            # pull(): move free-pull balance read inside transaction
│                                  # with FOR UPDATE; claimDailyPull(): use banner_cards pool
└── routes/
    └── cardGame.js                # GET /leaderboard/:showId: add autoEntryStatus to response

frontend/
└── src/card-game/
    ├── pages/
    │   └── ShowResultPage.jsx     # Render auto-entry status card from autoEntryStatus
    └── components/
        ├── BannerCard.jsx         # Live 60s countdown via setInterval; show banner.subtitle
        └── BannerCard.module.css  # Styles for subtitle and live countdown
```

**Structure Decision**: Web application (Option 2 — separate `backend/` and `frontend/`). All changes are in existing files; no new source files are required.

## Complexity Tracking

No complexity violations.
