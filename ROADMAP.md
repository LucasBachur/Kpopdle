# Kpopdle Card Game — Feature Roadmap

**Last updated**: 2026-07-20

---

## ✅ Completed

### Feature 004 — Platform Hardening
**Spec**: `specs/004-card-game-hardening/`

Config-driven `gg_only_mode` flag enforced by a `403` guard on all BG-scoped routes via `ggOnlyGuard` middleware; flag surfaced to frontend via `GET /me`; UI hides all BG entry points while enabled. Tightened write validation (banner pull count, slot shape, `genderCategory`). Lineup ownership split into `400` (card not found) vs `403` (wrong owner). Annual UR ticket grant via new `ur_grant_dates` + `ur_grant_log` tables and idempotent daily cron. All quickstart scenarios A–E pass; zero regressions on Feature 001 1–10.

---

### Feature 001 — Idol Card Game Core
**Spec**: `specs/001-idol-card-game/`

Auth + onboarding, starter collection (30 random pulls), one-time tickets (Rare / SR / UR), card collection browsing, gacha (daily pull, banner pulls, pity system, rate-up), duplicate system (stat upgrades + overflow to inventory + currency conversion stub), weekly lineup build/save/invalidation, daily show scheduling + auto-resolution, scoring engine (card stats × multipliers × size bonus × ±10% random), leaderboard + percentile-based rewards.

**Deferred to later features**: show multiplier seeding, banner-specific free pull grants UX, UR-ticket annual refresh, GG_ONLY_MODE enforcement, cosmetic system, tie-handling fix, full quickstart validation.

---

### Feature 002 — Weekly Pool Rotation
**Spec**: `specs/002-operator-content-rotation/`

`weeklyPoolService` with Fisher-Yates fresh-then-reuse selection, `ensureWeeklyPool` (idempotent), `invalidateStaleLineups`, operator scripts (`establish-weekly-pool.js`, `confirm-idol-roles.js`), weekly cron (Monday 03:00 UTC) + startup catch-up.

---

### Feature 003 — Show Multipliers & Scoring Completeness
**Spec**: `specs/003-show-multipliers-scoring/`

Operator seed script assigning multiplier templates (role / company / same-group bonuses) to each recurring show schedule; show scheduler copies templates to newly created shows; `same_group` scoring fix (homogeneity vs. specific-group); lineup page "Today's Bonuses" label chips; tie-handling fix (1224 ranking); chemistry bonus (logarithmic group-cohesion multiplier) with live preview in the lineup builder.

---

---

### Feature 005 — Banner & Gacha UX Polish *(P2)*
**Spec**: `specs/005-banner-gacha-ux-polish/`

Atomic free-pull lock (`FOR UPDATE`) prevents double-spend under concurrency; free-pull UI exclusivity (paid buttons hidden while free pulls remain); banner subtitle field (DB + API + UI); live 60s countdown for time-limited banners; auto-entry status card on show result page when player has a valid lineup; daily banner draws from its own configured `banner_cards` pool with graceful empty-pool error.

---

### Feature 009 — UI Revamp & Animations *(P2 — pre-launch)*

Full re-skin of every card-game page plus the two game entry pages to the design handoff, on a shared token system (`card-game/tokens.css`): new collapsible `Sidebar`; Collection (client-side filter/sort/search); Lineup (View + bottom-dock Edit with `LineupCard` states); Banners (side-stack carousel + `SummonPanel` + cinematic `SummonSequence` — album/vinyl/pack-opening, card fly-out, rarity glows with UR pulse); Shows (Live/Archive with a cosmetic count-up score reveal); Kpopdle + Guess the Song (shared dark guess input, audio player, dark `StatsModal` on real stats, avg-guesses metric). Real card art wired into member/reveal cards; new `GET /pity` endpoint + `artPath` on pull results; banner key-art convention + fallback. Responsive pass across all pages. **Deferred**: banner group key-art assets (convention ready), UR-Nayeon art, a bespoke mobile drawer.

---

## 🔲 Planned

### Feature 006 — Cosmetic System *(P2)*

Completes the duplicate/overflow progression loop (FR-009 stub).

**Scope**:
- `cosmetics` table: card border/frame variants per rarity
- `player_cosmetics` table: cosmetics owned per player
- Convert overflow duplicate → cosmetic item (replaces the current stub)
- Equip a cosmetic on a specific card
- Display equipped cosmetic in `CollectionPage` and `CardTile`

---

### Feature 010 — AWS Infrastructure & Deployment *(P2 — pre-launch)*

Design and provision the production AWS environment for launch.

**Scope**:
- Network: VPC, subnets, security groups
- Compute: EC2 or ECS for the Express backend; static hosting (S3 + CloudFront) or SSR for the React frontend
- Database: RDS PostgreSQL (managed, with automated backups)
- Environment config: secrets management (SSM Parameter Store or Secrets Manager), env vars
- CI/CD pipeline: automated build + deploy on push to main
- Domain + TLS: Route 53 + ACM certificate

---

### Feature 007 — Boy Group Launch *(P3)*

Surface the BG category that has been present in the schema since Feature 001.

**Scope**:
- Remove (or flip) `GG_ONLY_MODE` guard
- Seed BG show schedules, multipliers, banners, songs, and card definitions
- Surface BG tab/toggle in the UI (lineup, banners, shows, leaderboard — already gender-scoped in the backend)
- BG daily pull + weekly pool rotation (scheduler and pool service already handle BG — needs content only)

---

### Feature 008 — Operator Admin UI *(P3)*

Replace direct database inserts with a web interface for content management.

**Scope**:
- Card definition management: create/edit idol cards and stats
- Banner management: create/edit banners, assign card pools, set rate-up
- Show multiplier editor: define multipliers per show schedule
- Song catalog management: set `member_count`, mark eligibility
- Protected by an operator-only auth role

---

## Priority Summary

| # | Feature | Priority | Pre-launch? |
|---|---------|----------|-------------|
| 005 | Banner & gacha UX polish | P2 | Yes |
| 009 | UI revamp & animations | P2 | Yes |
| 010 | AWS infrastructure & deployment | P2 | Yes |
| 006 | Cosmetic system | P2 | Deferred |
| 007 | Boy Group launch | P3 | No (v2) |
| 008 | Operator admin UI | P3 | No (v2) |

Features 005, 009, and 010 are required before launch. 006 deferred post-launch. 007 and 008 are v2.
