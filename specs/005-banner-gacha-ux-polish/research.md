# Research: Banner & Gacha UX Polish

All five feature areas were resolved against the existing codebase. No external research was required — decisions are based on reading `backend/db.js`, `backend/services/gachaService.js`, `backend/routes/cardGame.js`, `frontend/src/card-game/components/BannerCard.jsx`, and `frontend/src/card-game/pages/ShowResultPage.jsx`.

---

## Decision 1 — Subtitle field vs. reusing `description` (FR-006)

**Decision**: Add `subtitle TEXT NULL` column to `banners`. Display it as the banner's description text in the UI.

**Rationale**: The `description` column is already semantically loaded as a type discriminator: the value `'daily'` identifies the permanent daily banner in `getDailyBanner()` (db.js:560), `claimDailyPull()` (gachaService.js:57), and `BannersPage.jsx:78`. Repurposing `description` for display text would require a new discriminator mechanism touching all three of those callers. A nullable `subtitle` column is zero-risk and keeps existing detection queries unchanged.

**Alternatives considered**:
- Add `is_daily BOOLEAN` column — more schema churn for the same outcome; rejected.
- Repurpose `description` and use a separate `banner_type` enum — rejected; migrating the seeded daily-banner rows and all detection queries adds risk with no benefit.

---

## Decision 2 — Row-level locking for free pull claims (FR-004)

**Decision**: Inside the existing `BEGIN`/`COMMIT` transaction in `pull()` (gachaService.js:202–215), move the free-pull balance read to `SELECT free_pulls_remaining FROM banner_free_pulls WHERE user_id=$1 AND banner_id=$2 FOR UPDATE` using the already-open `client`. Replace the separate `getBannerFreePulls()` pre-transaction read with this locked in-transaction read.

**Rationale**: `pull()` already acquires a `pool.connect()` client and calls `BEGIN`. `consumeBannerFreePulls()` already accepts a `client` parameter and runs inside that transaction. The only gap is that `getBannerFreePulls()` (the balance read) currently runs outside the transaction without a row lock, creating a TOCTOU window. Moving it inside with `FOR UPDATE` closes that window with minimal code change — no new infrastructure needed.

**Alternatives considered**:
- Advisory locks (`pg_try_advisory_xact_lock`) — works, but unnecessary complexity when row-level locking is simpler and the lock target is already a specific row.
- Optimistic lock with version counter + retry — more complex; still requires a transactional re-read; rejected.

---

## Decision 3 — Soloist banner rate-up skip (FR-009/FR-010/FR-011)

**Decision**: No implementation required. Existing code already satisfies all three FRs. Scope is **verify-only**.

**Rationale**:
- `BannerCard.jsx:25–27` computes `isSoloist = idolOptions.length === 1` and pre-sets `selectedIdolId` to the single idol's ID.
- `BannerCard.jsx:49–63` hides the Rate Up `<select>` when `isSoloist`.
- `gachaService.js:131` in `resolvePool()`: `if (!rateUpIdolId || rarityMembers.length === 1)` falls back to random-from-single, which is equivalent to rate-up on the only member.
- The frontend auto-passes `rateUpIdolId` for soloists, so the backend receives a valid idol ID and applies elevated drop weight.

**Verification required**: Create a single-member banner and confirm (a) Rate Up selector is absent, (b) pulls complete without error, (c) multi-member banners still show the selector (no regression).

---

## Decision 4 — Live countdown (FR-007/FR-008)

**Decision**: Replace the static `endsInLabel()` helper in `BannerCard.jsx` with a `useEffect` + `setInterval` (60 000 ms interval) pattern. On each tick, recompute the countdown string from `banner.endsAt`. Permanent banners (`endsAt == null`) render no countdown text. Cleanup via `clearInterval` on unmount.

**Rationale**: `ends_at` is already returned by `getActiveBanners()` as `endsAt`. Component-local interval keeps the logic co-located with the display and cleans up correctly on unmount. No additional server calls. 60-second precision matches the spec requirement.

**Alternatives considered**:
- Page-level interval in `BannersPage.jsx` with prop drilling — rejected; adds coupling for no benefit.
- Server-Sent Events for live banner state — rejected; massive overkill for a minute-granularity countdown.

---

## Decision 5 — Auto-entry status card (FR-012/FR-013/FR-014)

**Decision**: Extend `GET /leaderboard/:showId` to include `autoEntryStatus: { isRegistered: boolean }`. Backend queries `lineups` for a row matching `user_id = req.user.userId`, `gender_category = show.genderCategory`, `is_valid = TRUE`. Frontend renders a status card when `isRegistered` is `true`.

**Rationale**: `ShowResultPage.jsx` already fetches `GET /leaderboard/:showId` (`getLeaderboard(showId)`) on mount — no second network call needed. `show.genderCategory` is already in the response, providing the correct gender scope. `is_valid` on `lineups` is the exact same flag the auto-entry gate in `showService.js:109` uses, satisfying FR-013's "same validity check" requirement. FR-014 (forward-looking) is satisfied by checking today's lineup regardless of which show is being viewed.

**Alternatives considered**:
- Separate `/auto-entry-status` endpoint — rejected; requires a second fetch on page load.
- Include auto-entry status in `/me` — rejected; `ShowResultPage` doesn't call `/me`, would require plumbing or a new call.

---

## Decision 6 — Daily banner card pool (FR-015/FR-016/FR-017)

**Decision**: Update `claimDailyPull()` to query `banner_cards` for the daily banner's configured pool via a new `getDailyBannerCards(bannerId)` function. For both Rare and SR draws, sample from this pool. If the pool is empty, throw an operator-actionable error (no currency or pull consumed). Operators populate the pool via direct `INSERT INTO banner_cards` (consistent with existing operator DB patterns from Features 001–004).

**Rationale**: `banner_cards` already stores per-banner pools; the daily banner already has a `banners` row (`description = 'daily'`). The daily banner's `id` is available from `getDailyBanner()`. No schema changes required — just a new db helper and an update to `claimDailyPull()`. Pool updates take effect immediately (no cache, no restart).

**Note on SR fallback removal**: Currently `claimDailyPull()` falls back to active event-banner SR pools and then the global SR pool (gachaService.js:70–78). FR-017 requires pulls draw exclusively from the daily banner pool. The fallback chain is removed; an empty daily pool is an operator configuration error surfaced via a log message.

**Alternatives considered**:
- New `daily_banner_cards` table — redundant with existing `banner_cards`; rejected.
- Store daily pool in `gacha_config` as a JSON array of card IDs — untyped, bypasses FK constraints, harder for operators to manage; rejected.
