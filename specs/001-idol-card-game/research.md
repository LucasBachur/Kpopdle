# Research: Kpopdle Card Game

**Phase**: 0 — Pre-Design Research
**Date**: 2026-06-14
**Feature**: [spec.md](spec.md)

---

## Decision 1: Authentication Strategy

**Decision**: JWT-based stateless authentication (access token + refresh token pair).

**Rationale**: The existing server is a stateless Express app with no session infrastructure. JWT fits naturally: no server-side session store is needed, tokens are verified per-request via middleware, and the React SPA can store the access token in memory (short-lived, ~15 min) with a refresh token in an HttpOnly cookie for security. `jsonwebtoken` and `bcrypt` are the only new backend dependencies.

**Alternatives considered**:
- Session-based (express-session + PostgreSQL session store): adds a session table and requires sticky sessions in multi-process deployments. Unnecessary complexity for MVP.
- Third-party OAuth (Google, Discord): eliminates password management but adds external dependency and complicates the "just play" onboarding flow. Deferred to a future enhancement.

---

## Decision 2: Scheduled Job Runner

**Decision**: `node-cron` running inside the existing Node.js process.

**Rationale**: Two recurring jobs are needed: (1) show resolution at the daily deadline, (2) daily free pack availability reset at midnight. `node-cron` is lightweight, zero-infrastructure, and sufficient for a single-server MVP. Show resolution is the most critical job — it must run once per day per gender category at the configured deadline time.

**Alternatives considered**:
- OS cron + separate script: works but requires deployment-level configuration outside the app; harder to manage.
- PostgreSQL-based job queue (pg-boss): more resilient for multi-server setups; overkill for MVP but easy to migrate to later since all state is already in PostgreSQL.

**Failure handling**: If the scheduler process crashes mid-resolution, shows in `resolving` status are detected on restart and re-resolved. The `shows` table tracks `resolution_status` (`pending → resolving → resolved`) to make resolution idempotent.

---

## Decision 3: Card Art Storage

**Decision**: Static image files stored at `backend/public/cards/{rarity}/{idol_id}_{version}.webp`, served via `express.static`. The URL path is stored as the `art_path` field on `card_definitions`.

**Rationale**: Simplest possible solution — no external dependencies, no CDN cost, works immediately. The existing Express server already serves the React build; adding a `/cards/` static path is trivial. Art files are small and infrequently updated.

**Alternatives considered**:
- Object storage (S3/R2): correct long-term solution for scale; easy to migrate to by updating `art_path` values and adding a CDN prefix. The `art_path` abstraction makes this migration transparent to the frontend.
- Base64 in DB: rejected — blows up response sizes and makes image caching impossible.

---

## Decision 4: Score Calculation Formula

**Decision**: Scores are computed at show resolution time using integer arithmetic with one floating-point random factor rounded at the end.

```
base_score        = SUM(card.current_stat for each card in lineup)
multiplied_score  = base_score × PRODUCT(multiplier.value for each applicable multiplier)
size_bonus        = 1.0 + (lineup_size / MAX_LINEUP_SIZE) × SIZE_BONUS_FACTOR
final_score       = ROUND(multiplied_score × size_bonus × random_factor)

random_factor     ∈ [1 - RANDOM_RANGE, 1 + RANDOM_RANGE]
                  (default RANDOM_RANGE = 0.10, i.e., ±10%)
```

All caps constants (`MAX_LINEUP_SIZE`, `SIZE_BONUS_FACTOR`, `RANDOM_RANGE`, default multiplier values) are stored in `gacha_config` and read at resolution time — never hardcoded.

**Tie handling**: Players with identical `final_score` share the same rank. Percentile thresholds for rewards use the shared rank (e.g., if two players tie for rank 1 out of 100, both are in the top 10%).

---

## Decision 5: Gacha Rate Configuration

**Decision**: All pull rates, pity thresholds, and reward amounts live in a `gacha_config` table as key-value pairs (key TEXT, value JSONB). The application reads from this table at runtime — no restart required to change rates.

**Rationale**: The spec explicitly requires all rates to be tunable without code changes. A config table is simpler than environment variables (which require restarts) and more flexible than a config file (which requires file access on the server).

**Config keys defined** (values TBD during testing):
- `rare_base_rate` — base probability of Rare per pull
- `sr_base_rate` — base probability of SR per pull
- `ur_base_rate` — base probability of UR per pull
- `sr_pity_threshold` — pulls before SR guaranteed
- `ur_pity_threshold` — pulls before UR guaranteed
- `rate_up_percentage` — chance the Rate Up idol is selected when a matching rarity drops
- `free_pack_rare_count` — number of Rare cards per free daily pack
- `random_score_range` — the ±% random factor (default 0.10)
- `size_bonus_factor` — flat multiplier weight for lineup size (default TBD)
- `reward_ur_percentile` — top X% gets UR pull (default 0.10)
- `reward_sr_percentile` — top X% gets SR pull (default 0.50)

---

## Decision 6: Multiplier Type System

**Decision**: Show multipliers reference an `applies_to_type` (enum: `role`, `company`, `gender_category`, `same_group`, `soloist_only`) and an optional `applies_to_value` (e.g., `"rapper"`, `"JYP"`). At resolution time, each card in a lineup is checked against the applicable multipliers. Matching cards contribute their multiplier; non-matching cards contribute 1.0 (neutral).

**Idol role attribute**: The existing `idols` table must be extended with a `roles` text array column (e.g., `['rapper', 'maknae']`). Roles are operator-managed data, not computed at runtime. "Maknae" is stored explicitly — not derived from birth date — because it only applies to the youngest member *in the group context*, which requires group-relative knowledge.

**`same_group` bonus**: Applied if all cards in the lineup belong to the same group. Computed at resolution time by checking lineup card groups.

**`soloist_only` restriction**: If a show's multiplier has type `soloist_only`, only lineups with exactly 1 card (from a soloist) are scored; others receive a score of 0.

---

## Decision 7: Weekly Song Pool & Lineup Persistence

**Decision**: The weekly song pool is a set of `weekly_song_pool` records keyed by `(week_start_date, gender_category)`. Songs need a `member_count` field (added to the existing `songs` table) so the lineup slot count can be derived.

**Lineup persistence**: A player has at most one active lineup per gender category at any time. When a show resolves, the engine reads the player's current active lineup — it does not snapshot the lineup at submission time. This means changes before the deadline affect that day's show. If the song is no longer in the current week's pool (week rollover), the lineup is marked `invalid` and the player must re-confirm before the next deadline.

**Rationale**: Snapshotting lineups per show adds significant storage complexity for minimal benefit. The window between a song leaving the pool and a show resolving is a full week — players have ample time to update.
