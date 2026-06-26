# Phase 0 Research: Card Game Hardening & GG-Only Launch Mode

All Technical Context items were resolved against the existing codebase. No external/library research was required (no new dependencies).

## Decision 1: Where the GG-only flag lives

- **Decision**: Store the flag as a single row in the existing `gacha_config` table: key `gg_only_mode`, value `'1'` (enabled, default) or `'0'` (disabled). Read it via a dedicated `getGgOnlyMode()` helper in `db.js`.
- **Rationale**: Spec assumptions require the flag to live alongside existing game config and be hot-swappable without a code change (consistent with Feature 001 Scenario 8). `getGachaConfig()` already `parseFloat`s every row, so `'1'`/`'0'` round-trip cleanly as truthy/falsy numbers. Seeding it in `seed-gacha-config.js` keeps it with the other tunables.
- **Alternatives considered**: An env var in `config.js` — rejected because env vars are not hot-swappable at runtime and contradict the config-hotswap assumption. A dedicated `feature_flags` table — rejected as unnecessary structure for a single boolean.

## Decision 2: How BG requests are refused (the 403 guard)

- **Decision**: Add a small middleware factory `middleware/ggOnlyGuard.js` that resolves the request's gender category from (in order) `req.params.genderCategory`, `req.body.genderCategory`, then `req.query.genderCategory`, normalizes it, and — when it resolves to `bg` AND `gg_only_mode` is enabled — responds `403 { error: 'Boy Group content is not available.' }` before the handler runs. Apply it to the BG-capable routes: `POST /daily-pull/claim`, `GET /songs/weekly`, `GET/PUT /lineup/:genderCategory`, `GET /leaderboard/history`.
- **Rationale**: A single shared guard is the authoritative trust boundary (FR-002) and avoids scattering identical checks. Routes that are already hardcoded to `gg` (`GET /banners`, `GET /shows/today`) cannot leak BG data; the guard is still harmless if applied, but is primarily needed where the route accepts a `bg` value. The guard reads the flag per request via `getGgOnlyMode()`, so toggling config takes effect immediately (edge case: a mode toggle mid-session refuses the next BG request).
- **Alternatives considered**: Inline `if (bg && mode) 403` in each handler — rejected for duplication and drift risk. A global app-level middleware — rejected because gender lives in different request locations per route and most non-card-game routes have no gender at all.

## Decision 3: Hardening the existing write validation

- **Decision**: Keep the validation already present in `routes/cardGame.js` (banner `count` 1–10, gender-category enum on every gender-bearing route, duplicate `slotPosition` rejection, slot-count-vs-`memberCount` match, lineup card ownership via `player_cards`). Close one concrete gap: in `PUT /lineup`, validate that every slot has an integer `playerCardId` and integer `slotPosition` **before** the `ANY($2::int[])` query, so malformed/missing IDs return a clean `400` instead of a Postgres cast error surfacing as `500`.
- **Rationale**: Most of US2/US3 is already implemented (the file is already modified on this branch). The only correctness gap is that a `null`/non-integer `playerCardId` reaches the int-array cast and throws, violating FR-010 ("return a clear, actionable error … MUST NOT alter any player state") by yielding a 500. Pre-validating the slot shape converts that to a 400.
- **Alternatives considered**: Introducing a validation library (zod/joi) — rejected (no new dependencies; validation surface is small and already inline). Per-card existence query separate from ownership — rejected: the existing ownership query already excludes non-existent cards (they won't appear in `player_cards`), satisfying FR-009 acceptance scenario 2 once slot shape is validated.

## Decision 4: Annual UR grant — trigger, configuration, idempotency

- **Decision**:
  - **Configuration**: a new table `ur_grant_dates(month SMALLINT, day SMALLINT)` seeded with `(12, 31)`. Operators add/remove rows to change grant dates — no code change (FR-013).
  - **Idempotency marker**: a new table `ur_grant_log(grant_date DATE PRIMARY KEY, granted_at TIMESTAMPTZ DEFAULT now())`. Granting for a date attempts `INSERT ... ON CONFLICT DO NOTHING`; the grant body runs only when a row was inserted, giving at-most-once-per-calendar-date semantics regardless of restarts/repeat runs (FR-012, edge case: process runs twice on the date).
  - **Grant action**: when today's ART `MM-DD` matches a configured grant date, `UPDATE users SET ur_tickets = ur_tickets + 1` for all rows (every registered account; deleted accounts are simply absent — FR-014). Counts accumulate, no cap.
  - **Trigger**: a new `processAnnualUrGrant()` invoked from the existing daily cron (`0 3 * * *` in `scheduler.js`) and on startup catch-up, alongside `createTodayShows()`.
- **Rationale**: The clarifications supersede the original "365 days after use" wording with fixed configured calendar dates and a once-per-date-per-year guard. A dedicated `ur_grant_log` keyed by the full `YYYY-MM-DD` gives global idempotency in one atomic insert — simpler and safer than per-user timestamps. `gacha_config` is numeric-only (`parseFloat`), so a list of dates cannot live there; a small dedicated table is the right home and keeps dates operator-editable. Running inside the existing scheduler satisfies the "no new always-on service" assumption.
- **Edge cases handled**: Feb-29 in a non-leap year simply never matches today's `MM-DD`, so no grant occurs that year (spec edge case). Multiple configured dates each grant independently because each has its own `ur_grant_log` row.
- **Alternatives considered**: Per-user `ur_ticket_refreshed_at` rolling clock — rejected by clarification (date-driven, not per-player). Storing dates as JSON in `gacha_config` — rejected (numeric parsing corrupts it). A `ur_grant_log` keyed only by year — rejected because it can't distinguish multiple configured dates within the same year.

## Decision 5: Frontend defense-in-depth

- **Decision**: Surface `ggOnlyMode` (boolean) in the `GET /me` response. The frontend reads it from the already-fetched `me` object and hides/disables any Boy-Group entry point. In the current codebase the card-game UI already hardcodes `'gg'` for every action (lineup, songs, banners, shows, leaderboard), so the concrete work is: (a) add the field to `/me`, (b) audit pages for any latent BG selector/label/toggle and gate it on `!ggOnlyMode`, (c) confirm no BG action is reachable while enabled.
- **Rationale**: FR-004a / SC-001a require zero BG entry points in the UI while enabled, but explicitly keep the backend 403 as the trust boundary. Riding the flag on the existing `/me` response avoids a new endpoint and an extra round trip.
- **Alternatives considered**: A new `GET /config` endpoint — rejected as unnecessary; `/me` is already loaded on app start. Hardcoding the frontend to GG forever — rejected because the flag must allow re-enabling BG later (FR-004) without a frontend redeploy.

## Open Questions

None. All NEEDS CLARIFICATION items were resolved in the spec's Session 2026-06-25 clarifications and by direct inspection of the existing implementation.
</content>
