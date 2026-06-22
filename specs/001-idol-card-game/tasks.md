# Tasks: Kpopdle Card Game

**Input**: Design documents from `specs/001-idol-card-game/`

**Prerequisites**: plan.md ✓ | spec.md ✓ | research.md ✓ | data-model.md ✓ | contracts/api.md ✓ | quickstart.md ✓

**Tests**: No test tasks generated — no test framework is in place. Validation is via `quickstart.md` scenarios (Phase 9, T082).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete sibling tasks)
- **[Story]**: Which user story this task belongs to (US1–US6, maps to spec.md)
- All file paths are relative to the repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create the directory skeleton before any implementation begins.

- [ ] T001 Install new backend npm dependencies (jsonwebtoken, bcrypt, node-cron) by running `npm install jsonwebtoken bcrypt node-cron` inside `backend/`
- [ ] T002 [P] Create backend subdirectories `backend/middleware/`, `backend/routes/`, `backend/services/` (add a `.gitkeep` in each if empty)
- [ ] T003 [P] Create card art static directories `backend/public/cards/rare/`, `backend/public/cards/super_rare/`, `backend/public/cards/ultra_rare/` (add placeholder README noting webp files go here)
- [ ] T004 [P] Add `express.static(path.join(__dirname, 'public'))` middleware to `backend/server.js` so card art is served at `/public/cards/…`
- [ ] T005 [P] Create frontend card game directory structure: `frontend/src/card-game/pages/`, `frontend/src/card-game/components/`, `frontend/src/card-game/services/`

**Checkpoint**: All directories exist; backend installs without errors; `/public/` static route is mounted.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, authentication infrastructure, and the base API client — everything all user stories depend on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T006 Write `backend/migrate-card-game.js`: a standalone migration script (mirroring `backend/migrate.js` style) that runs the following SQL in order: (1) `ALTER TABLE idols ADD COLUMN IF NOT EXISTS roles TEXT[] NOT NULL DEFAULT '{}'`, (2) `ALTER TABLE songs ADD COLUMN IF NOT EXISTS member_count INTEGER NOT NULL DEFAULT 1`, then CREATE TABLE IF NOT EXISTS for all 16 new tables from `data-model.md` (`users`, `card_definitions`, `player_cards`, `overflow_duplicates`, `tickets`, `gacha_config`, `banners`, `banner_cards`, `pity_counters`, `show_schedules`, `shows`, `show_multipliers`, `weekly_song_pools`, `lineups`, `lineup_slots`, `show_entries`) with all constraints, unique keys, and foreign keys exactly as specified in `data-model.md`
- [ ] T007 Run `node backend/migrate-card-game.js` against the local PostgreSQL database and verify all 16 tables are created and column extensions are applied with `\d` in psql
- [ ] T008 [P] Add `JWT_SECRET` to `backend/config.js`: read from `process.env.JWT_SECRET`, throw a startup error if absent; document the variable in `.env.example` alongside existing vars
- [ ] T009 [P] Implement `backend/middleware/auth.js`: export a middleware function that reads the `Authorization: Bearer <token>` header, verifies it with `jsonwebtoken`, attaches `req.user = { userId, username }` on success, and returns `401` on missing or invalid token
- [ ] T010 Implement `backend/routes/auth.js` with three routes: `POST /api/auth/register` (validate username/email/password, hash password with bcrypt, insert into `users`, call `createStarterCollection` stub returning a TODO comment for now, issue JWT pair, return 201), `POST /api/auth/login` (lookup by email, compare hash, issue JWT pair), `POST /api/auth/refresh` (verify refresh token, issue new access token); export as Express router
- [ ] T011 Mount `backend/routes/auth.js` at `/api/auth` and create `backend/routes/cardGame.js` as an empty Express router stub; mount it at `/api/card-game` with the `auth` middleware applied to all routes; import and start both from `backend/server.js`
- [ ] T012 Implement `frontend/src/card-game/services/cardGameApi.js`: export a base `apiFetch(path, options)` helper that (1) reads the access token from module-level state, (2) attaches `Authorization: Bearer` header, (3) on 401 calls `POST /api/auth/refresh` with the stored refresh token, updates the access token, and retries once; also export `login(email, password)` and `register(username, email, password)` functions that store both tokens on success

**Checkpoint**: `POST /api/auth/register` returns 201 with tokens; `POST /api/auth/login` returns 200; `GET /api/card-game/` (stub) returns 200 with auth header, 401 without.

---

## Phase 3: User Story 1 — New Player Onboarding (Priority: P1) 🎯 MVP

**Goal**: A new player can register, receive a starter collection of Rare cards and 3 tickets, redeem the UR ticket for a chosen card, pick a song, fill a lineup, and save it — all in under 5 minutes.

**Independent Test**: Register → check `/api/card-game/me` for 3 tickets → GET `/api/card-game/tickets/ultra_rare/eligible-cards` → POST `/api/card-game/tickets/:id/redeem` with a valid UR card → GET `/api/card-game/songs/weekly?genderCategory=gg` → PUT `/api/card-game/lineup/gg` with all slots filled → GET `/api/card-game/lineup/gg` confirms saved lineup. (Quickstart Scenario 1 + 2.)

### DB layer

- [ ] T013 [P] [US1] Add card definition DB functions to `backend/db.js`: `getAllCardDefs()` (all rows from `card_definitions` joined with idol name/group), `getCardDefsByRarity(rarity)`, `getCardDefById(id)`
- [ ] T014 [P] [US1] Add player card DB functions to `backend/db.js`: `getPlayerCards(userId)` (joins `card_definitions` + `idols`), `insertPlayerCard(userId, cardDefId, baseStat)`, `getPlayerCard(userId, cardDefId)`, `incrementPlayerCardStat(playerCardId)`
- [ ] T015 [P] [US1] Add ticket DB functions to `backend/db.js`: `getTicketsByUser(userId)`, `getTicket(ticketId)`, `markTicketRedeemed(ticketId, cardDefId)`
- [ ] T016 [P] [US1] Add weekly song pool DB functions to `backend/db.js`: `getCurrentWeekSongs(genderCategory)` returning songs with `member_count` for the current ISO week (Monday-anchored `week_start_date`)
- [ ] T017 [P] [US1] Add lineup DB functions to `backend/db.js`: `getLineup(userId, genderCategory)` (with slot details joined to `player_cards` + `card_definitions` + `idols`), `upsertLineup(userId, genderCategory, songId)` returning the lineup id, `replaceLineupSlots(lineupId, slots[{slotPosition, playerCardId}])` (delete existing then insert all in a transaction)

### Services

- [ ] T018 [US1] Implement `backend/services/collectionService.js` with two exported functions: (1) `createStarterCollection(userId, pgClient)` — inserts one Rare `player_card` per idol in the `idols` table (all with `base_stat` from their matching `card_definitions` where rarity = `'rare'` and `is_active = true`), then inserts 3 `tickets` rows (one each for `'rare'`, `'super_rare'`, `'ultra_rare'`); (2) `addCardToCollection(userId, cardDefId)` — if the player does not own the card, insert into `player_cards` using `card_definitions.base_stat`; if the player owns it and `current_stat` < rarity ceiling (85/95/99), call `incrementPlayerCardStat`; if already at ceiling, return `{ wasOverflow: true }` without inserting (overflow persistence is added in US4 Phase 6)
- [ ] T019 [US1] Wire `createStarterCollection` into `POST /api/auth/register` in `backend/routes/auth.js`: call it after inserting the user row, pass the new user's id and the pg pool client; wrap user insert + starter collection in a single DB transaction

### Routes

- [ ] T020 [US1] Implement `GET /api/card-game/me` in `backend/routes/cardGame.js`: return `userId`, `username`, `gg_currency`, `bg_currency`, `tickets[]` (with `redeemed` boolean), and `freePackAvailable: { gg: bool, bg: bool }` (compare `last_free_pack_claimed_gg` to today's date in ART timezone)
- [ ] T021 [US1] Implement `GET /api/card-game/collection` in `backend/routes/cardGame.js`: return `cards[]` from `getPlayerCards` (with `baseStat`, `currentStat`, `artPath`, `borderStyle`, `acquiredAt`) and `overflowDuplicates: []` (empty for now; populated in US4); support optional `?rarity=` and `?gender=` query filters
- [ ] T022 [US1] Implement ticket routes in `backend/routes/cardGame.js`: `GET /tickets` (calls `getTicketsByUser`), `GET /tickets/:rarity/eligible-cards` (calls `getCardDefsByRarity`, returns only `is_active = true` cards), `POST /tickets/:ticketId/redeem` (validates ticket belongs to user + is unredeemed + rarity matches the chosen card, calls `addCardToCollection`, calls `markTicketRedeemed`, returns the resulting player card)
- [ ] T023 [US1] Implement `GET /api/card-game/songs/weekly` in `backend/routes/cardGame.js`: validate `?genderCategory=` query param is present, call `getCurrentWeekSongs`, return `{ weekStartDate, songs[] }` where each song includes `songId`, `title`, `group`, `memberCount`
- [ ] T024 [US1] Implement `GET /api/card-game/lineup/:genderCategory` and `PUT /api/card-game/lineup/:genderCategory` in `backend/routes/cardGame.js`: GET calls `getLineup` and returns the full lineup shape from `contracts/api.md`; PUT validates all `member_count` slots are present and filled, calls `upsertLineup` + `replaceLineupSlots` in a transaction, compares submission time to today's show deadline, returns `appliesTo: "today"` or `"next_show"` with the appropriate notice message

### Frontend

- [ ] T025 [P] [US1] Add functions to `frontend/src/card-game/services/cardGameApi.js`: `getMe()`, `getCollection(filters)`, `getTickets()`, `getEligibleCards(rarity)`, `redeemTicket(ticketId, cardDefId)`, `getWeeklySongs(genderCategory)`, `getLineup(genderCategory)`, `saveLineup(genderCategory, songId, slots)`
- [ ] T026 [P] [US1] Build `frontend/src/card-game/components/CardTile.jsx`: props are `{ idolName, group, rarity, currentStat, artPath, borderStyle }`; render the card art (or a placeholder div if artPath missing), rarity-colored border, idol name, group, and stat; export as default
- [ ] T027 [US1] Build `frontend/src/card-game/pages/CollectionPage.jsx`: fetch collection on mount via `getCollection()`; render owned cards as a grid of `CardTile` components; include a Tickets section listing each ticket's rarity and redemption status, with a "Redeem" button that opens a card-picker modal (list of eligible cards → confirm selection → call `redeemTicket` → refresh collection)
- [ ] T028 [US1] Build `frontend/src/card-game/components/LineupBuilder.jsx`: props are `{ weeklySongs, ownedCards, initialLineup, onSave }`; render a song `<select>` populated from `weeklySongs`; on song selection, render N slot pickers where N = `song.memberCount`; each slot shows current assignment or an "empty" state with a card search/select dropdown filtered to `ownedCards`; "Save Lineup" button calls `onSave` only when all slots are filled
- [ ] T029 [US1] Build `frontend/src/card-game/pages/LineupPage.jsx`: fetch `getWeeklySongs('gg')` and `getLineup('gg')` on mount; render `LineupBuilder` with fetched data; on save call `saveLineup` and display a success toast or the post-deadline notice from the response
- [ ] T030 [US1] Add card game routes to `frontend/src/App.jsx`: import `CollectionPage`, `LineupPage` and the existing auth state; wrap card-game routes in a `<RequireAuth>` component that redirects to login if no access token is stored; add routes `/card-game/collection` and `/card-game/lineup`

**Checkpoint**: New player can register, see starter collection, redeem UR ticket, pick a song, fill lineup, and save. All acceptance scenarios for US1 pass.

---

## Phase 4: User Story 2 — Daily Show Participation (Priority: P1)

**Goal**: A show resolves automatically at the daily deadline, scoring every submitted lineup and posting a global leaderboard; players receive pull currency rewards by rank percentile.

**Independent Test**: Seed 3 players with lineups → trigger show resolution → GET `/api/card-game/leaderboard/:showId` shows all 3 with correct scores/ranks → GET `/api/card-game/me` for each confirms currency increased per reward tier. (Quickstart Scenario 4.)

### DB layer

- [ ] T031 [P] [US2] Add show DB functions to `backend/db.js`: `getTodayShows(genderCategory)` (where `date = CURRENT_DATE` in ART timezone), `getShowById(showId)`, `createShow({ scheduleId, date, genderCategory, showName, isSpecialEvent, deadline })`, `updateShowStatus(showId, status)`
- [ ] T032 [P] [US2] Add show entry DB functions to `backend/db.js`: `insertShowEntry({ showId, userId, songId, cardSnapshot, baseScore, finalScore })`, `updateShowEntryRankAndReward(entryId, rank, rewardRarity)`, `getShowLeaderboard(showId)` (all entries ordered by `final_score` desc, joined with `username`), `getPlayerShowHistory(userId, genderCategory, limit, offset)`
- [ ] T033 [P] [US2] Add show multipliers DB function to `backend/db.js`: `getMultipliersByShow(showId)` returning all rows with `label`, `multiplier_value`, `applies_to_type`, `applies_to_value`

### Services

- [ ] T034 [US2] Implement `backend/services/showService.js` — `calculateScore(lineupCards, multipliers, idolAttrs, config)`: (1) sum `current_stat` of all cards as `baseScore`; (2) for each multiplier, check each card's idol attrs (`roles`, `company`, or group homogeneity) per `applies_to_type` and `applies_to_value`; accumulate per-card multiplier products; apply to individual card scores; (3) apply `sizeBonus = 1.0 + (lineupSize / config.max_lineup_size) * config.size_bonus_factor`; (4) apply `randomFactor = 1 + (Math.random() * 2 - 1) * config.random_score_range`; return `{ baseScore, finalScore: Math.round(multiplied * sizeBonus * randomFactor) }`
- [ ] T035 [US2] Implement `soloist_only` show restriction in `showService.calculateScore`: if any multiplier has `applies_to_type = 'soloist_only'` and the lineup has more than 1 card, return `{ baseScore: 0, finalScore: 0, disqualified: true }`
- [ ] T036 [US2] Implement `showService.resolveShow(showId, pgPool)` in `backend/services/showService.js`: (1) set `resolution_status = 'resolving'`; (2) fetch all active lineups for the show's `gender_category` where `is_valid = true`; (3) for each lineup, fetch its cards (with idol roles + company), fetch show multipliers, fetch gacha_config, call `calculateScore`; (4) build `cardSnapshot` JSONB (array of `{ idolName, rarity, stat }`); (5) insert a `show_entries` row per lineup; (6) set `resolution_status = 'resolved'` and `resolved_at = NOW()`
- [ ] T037 [US2] Implement `backend/services/rewardService.js` — `assignRanksAndDistributeRewards(showId, pgPool)`: (1) fetch all `show_entries` for the show ordered by `final_score DESC`; (2) assign shared ranks (entries with equal score get the same rank); (3) compute percentile per entry; (4) determine `reward_rarity` based on `gacha_config` percentile thresholds; (5) update each entry's `rank` and `reward_rarity`; (6) credit `gg_currency` (or `bg_currency`) to each user by `UPDATE users SET gg_currency = gg_currency + 1 WHERE id = ?` (each pull = 1 currency unit); (7) set `reward_issued_at`
- [ ] T038 [US2] Implement idempotency guard at the top of `showService.resolveShow`: fetch the show's current `resolution_status`; if not `'pending'`, log a warning and return early without modifying data
- [ ] T039 [US2] Implement `backend/scheduler.js` with two cron jobs using `node-cron`: (1) **Nightly show creator** — runs at `00:01` ART daily; queries `show_schedules` for the day-of-week that is tomorrow (in ART); for each matching schedule, computes the show `deadline` TIMESTAMPTZ by combining tomorrow's date + `deadline_time` + `timezone` using a timezone-aware calculation (`new Date(Intl.DateTimeFormat...).getTime()`); calls `createShow` if a show for that date + gender doesn't already exist. (2) **Resolution trigger** — runs every minute; queries `shows` where `deadline <= NOW()` and `resolution_status = 'pending'`; for each, calls `showService.resolveShow` then `rewardService.assignRanksAndDistributeRewards`; import and call `startScheduler()` from `backend/server.js`

### Routes

- [ ] T040 [US2] Implement show and leaderboard routes in `backend/routes/cardGame.js`: `GET /shows/today` (calls `getTodayShows`, includes multiplier labels from `getMultipliersByShow` per show, includes `playerEntry: null` stub), `GET /leaderboard/:showId` (calls `getShowLeaderboard`, includes `playerEntry` for authenticated user if they participated), `GET /leaderboard/history` (calls `getPlayerShowHistory` with `?genderCategory`, `?limit`, `?offset` params)

### Frontend

- [ ] T041 [P] [US2] Add functions to `frontend/src/card-game/services/cardGameApi.js`: `getTodayShows()`, `getLeaderboard(showId)`, `getLeaderboardHistory(genderCategory, limit, offset)`
- [ ] T042 [US2] Build `frontend/src/card-game/components/LeaderboardTable.jsx`: props are `{ entries, highlightUserId }`; render a table with columns Rank, Player, Song, Cards (small CardTile thumbnails), Score, Reward (rarity icon); highlight the row where `userId === highlightUserId`
- [ ] T043 [US2] Build `frontend/src/card-game/pages/LeaderboardPage.jsx`: read `showId` from route params; fetch `getLeaderboard(showId)` on mount; render show name, date, and `LeaderboardTable`; show a "Show not yet resolved" message if `resolutionStatus !== 'resolved'`
- [ ] T044 [US2] Build `frontend/src/card-game/pages/ShowResultPage.jsx`: fetch `getTodayShows()` on mount; for each GG show, display show name, deadline, resolution status; link to `LeaderboardPage` once resolved; add the page to `App.jsx` at `/card-game/shows`

**Checkpoint**: Show resolves automatically; leaderboard shows all participants; rewards credited. Quickstart Scenarios 4 and 9 pass.

---

## Phase 5: User Story 3 — Card Acquisition via Gacha (Priority: P2)

**Goal**: Players can claim a free daily Rare pack and spend currency on time-limited group banners with a chosen Rate Up idol and a configurable pity guarantee.

**Independent Test**: Claim free pack → verify Rare cards awarded + cooldown set; pull on a TWICE SR banner with Sana as Rate Up → verify pity counter increments; force pity threshold and pull again → verify SR card guaranteed. (Quickstart Scenarios 5 + 6.)

### DB layer

- [ ] T045 [P] [US3] Add banner DB functions to `backend/db.js`: `getActiveBanners(genderCategory)` (joins `banner_cards` → `card_definitions` → `idols` to build member list per banner), `getBannerWithMembers(bannerId)` (same join for a single banner)
- [ ] T046 [P] [US3] Add pity counter DB functions to `backend/db.js`: `getPityCounter(userId, genderCategory, targetRarity)`, `incrementPityCounter(userId, genderCategory, targetRarity)`, `resetPityCounter(userId, genderCategory, targetRarity)` (upsert pattern for all three)
- [ ] T047 [P] [US3] Add gacha config DB function to `backend/db.js`: `getGachaConfig()` — returns all rows from `gacha_config` as a plain JS object `{ key: parsedValue }` by iterating rows and setting `obj[row.key] = JSON.parse(row.value)` (or `row.value` if JSONB auto-parsed by pg)

### Services

- [ ] T048 [US3] Implement `gachaService.resolvePool(bannerMembers, rateUpCardDefId, config)` in `backend/services/gachaService.js`: build a weighted array from `bannerMembers` where the Rate Up idol gets `config.rate_up_percentage` share and remaining probability is split evenly among other members; use `Math.random()` to select one card def id; return the selected `cardDefId`
- [ ] T049 [US3] Implement `gachaService.pull(userId, bannerId, count, rateUpCardDefId, genderCategory, pgPool)` in `backend/services/gachaService.js`: (1) fetch config via `getGachaConfig()`; (2) check user has sufficient currency (`gg_currency >= count * 1`); (3) deduct currency; (4) for each pull: check SR pity counter against `config.sr_pity_threshold` and UR pity counter against `config.ur_pity_threshold` — if threshold reached, force that rarity; otherwise use base rates to randomly determine rarity; (5) call `resolvePool` for the winning rarity's banner pool; (6) call `collectionService.addCardToCollection(userId, cardDefId)` and capture result; (7) increment or reset pity counters appropriately; (8) return array of pull result objects matching the `contracts/api.md` response shape
- [ ] T050 [US3] Implement `gachaService.claimFreePack(userId, genderCategory, pgPool)` in `backend/services/gachaService.js`: (1) fetch config; (2) check `last_free_pack_claimed_gg` (or `bg`) against today's date in ART timezone — reject with 409 if already claimed; (3) fetch all active Rare card_definitions for the gender category; (4) randomly select `config.free_pack_rare_count` card defs (with replacement allowed); (5) call `addCardToCollection` for each; (6) update `users.last_free_pack_claimed_gg` to `NOW()`; (7) return pack results + `nextClaimAvailableAt`
- [ ] T051 [US3] Add free pack midnight reset scheduler job to `backend/scheduler.js`: a nightly cron at `00:00` ART that does nothing (the free pack availability is computed on-the-fly from `last_free_pack_claimed` vs. today's ART date in `getMe` and `claimFreePack` — no DB reset needed); add a comment explaining this

### Routes

- [ ] T052 [US3] Implement banner and gacha routes in `backend/routes/cardGame.js`: `GET /banners` (calls `getActiveBanners('gg')`, returns banners with member list), `POST /banners/:bannerId/pull` (validates bannerId, count ≥ 1, rateUpCardDefId belongs to the banner unless soloist, calls `gachaService.pull`), `POST /free-pack/claim` (calls `gachaService.claimFreePack`)

### Frontend

- [ ] T053 [P] [US3] Add functions to `frontend/src/card-game/services/cardGameApi.js`: `getBanners()`, `pullBanner(bannerId, rateUpCardDefId, count)`, `claimFreePack(genderCategory)`
- [ ] T054 [US3] Build `frontend/src/card-game/components/BannerCard.jsx`: props are `{ banner, onPull }`; display group name, rarity badge (SR/UR colored), `ends_at` date, member card art previews; render a Rate Up idol `<select>` populated from `banner.members` (omit selector if `isSoloist`); "Pull ×1" button calls `onPull(banner.id, selectedRateUpId, 1)`
- [ ] T055 [US3] Build `frontend/src/card-game/components/GachaModal.jsx`: props are `{ results, onClose }`; display each pull result as a card reveal (idol name, rarity, stat, `isNew` / `wasUpgrade` badge); show "New!" badge for `isNew`, "+1 stat" badge for `wasUpgrade`, "Inventory" badge for `wasOverflow` (updated in US4)
- [ ] T056 [US3] Build `frontend/src/card-game/pages/BannersPage.jsx`: fetch `getBanners()` on mount; render each banner via `BannerCard`; on pull, open `GachaModal` with results; include a "Free Pack" section showing free pack availability from `getMe()` with a "Claim" button that calls `claimFreePack('gg')` and opens `GachaModal` with results; add `/card-game/banners` route to `App.jsx`

**Checkpoint**: Free pack claimable once per day; banner pulls spend currency; pity triggers at threshold; Rate Up idol appears more frequently. Quickstart Scenarios 5 + 6 pass.

---

## Phase 6: User Story 4 — Card Upgrading via Duplicates (Priority: P2)

**Goal**: Duplicate cards beyond the rarity ceiling are stored in inventory as overflow items; players can convert them to pull currency or cosmetics at any time.

**Independent Test**: Own a Rare card at stat 85 → pull that card again → verify `wasOverflow: true`, overflow item appears in `/collection` → convert to currency → verify currency incremented and overflow item removed. (Quickstart Scenario 7.)

### DB layer

- [ ] T057 [P] [US4] Add overflow duplicate DB functions to `backend/db.js`: `insertOverflowDuplicate(userId, cardDefId)`, `getOverflowDuplicatesByUser(userId)` (joined with `card_definitions` + `idols` for display), `getOverflowDuplicateById(duplicateId)`, `deleteOverflowDuplicate(duplicateId)`

### Services

- [ ] T058 [US4] Update `collectionService.addCardToCollection(userId, cardDefId)` in `backend/services/collectionService.js`: replace the current no-op for the at-ceiling case with `insertOverflowDuplicate(userId, cardDefId)`; return `{ wasOverflow: true, overflowId: <id> }` so callers can include it in pull results

### Routes

- [ ] T059 [US4] Implement `POST /api/card-game/overflow/:duplicateId/convert` in `backend/routes/cardGame.js`: fetch the overflow duplicate by id, verify it belongs to `req.user.userId` (403 if not); if `convertTo === 'currency'`, delete the row and increment `gg_currency` by 1; if `convertTo === 'cosmetic'`, delete the row and note the cosmetic award (cosmetic system is a stub — log and return `cosmeticAwarded: { type: cosmeticType, variant: cosmeticVariant }`); return the conversion result

### Frontend

- [ ] T060 [P] [US4] Add `convertOverflow(duplicateId, convertTo, cosmeticOptions)` to `frontend/src/card-game/services/cardGameApi.js`
- [ ] T061 [US4] Update `frontend/src/card-game/pages/CollectionPage.jsx`: fetch `overflowDuplicates` from the collection response; render a separate "Overflow Inventory" section below the main card grid; for each overflow item, show the card identity (idol, rarity, ceiling stat) and two buttons "Convert → Currency" and "Convert → Cosmetic"; on confirm, call `convertOverflow` and refresh the collection
- [ ] T062 [US4] Update `frontend/src/card-game/components/GachaModal.jsx`: for result cards where `wasOverflow: true`, render an "Inventory" badge instead of "New!" or "+1 stat"; add a small tooltip "Stored in overflow — manage in Collection"

**Checkpoint**: Overflow items appear in `/collection`; both conversion paths work; no duplicate is silently dropped. Quickstart Scenario 7 passes.

---

## Phase 7: User Story 5 — Weekly Lineup Management (Priority: P2)

**Goal**: Players can update their lineup any time before the deadline; when the weekly song pool rolls over, any lineup whose song is no longer in the pool is marked invalid and the player is prompted to re-confirm.

**Independent Test**: Save a lineup → change it before the deadline and verify the show uses the updated version → advance the week so the song leaves the pool → GET `/lineup/gg` returns `isValid: false` → save a new lineup with a valid song → `isValid` returns to `true`. (Quickstart Scenario 2 + edge case from spec.)

### Backend

- [ ] T063 [US5] Add lineup validity guard to `PUT /api/card-game/lineup/:genderCategory` in `backend/routes/cardGame.js`: after parsing the request body, call `getCurrentWeekSongs(genderCategory)` and verify `songId` is in the returned list; if not, return 409 `{ error: "Song is not in this week's pool" }`
- [ ] T064 [US5] Add weekly lineup invalidation cron job to `backend/scheduler.js`: runs every Monday at `00:02` ART; calls `getCurrentWeekSongs` for the new week; then `UPDATE lineups SET is_valid = false WHERE song_id NOT IN (<new pool ids>) AND gender_category = 'gg'`
- [ ] T065 [US5] Update `GET /api/card-game/lineup/:genderCategory` in `backend/routes/cardGame.js`: include `isValid` in the response and add a `validationMessage` field (`"Song no longer in this week's pool — please update your lineup before the next deadline"`) when `is_valid = false`

### Frontend

- [ ] T066 [US5] Update `frontend/src/card-game/pages/LineupPage.jsx`: check `lineup.isValid` from the GET response; if false, display a dismissible warning banner above the LineupBuilder with the `validationMessage` text and instructions to pick a new song
- [ ] T067 [US5] Update `frontend/src/card-game/components/LineupBuilder.jsx`: render a `memberCount` badge (e.g., "9 members") next to each song option in the song `<select>` dropdown; disable the Save button and show inline validation errors for any slot that is empty
- [ ] T068 [US5] Update `frontend/src/card-game/pages/LineupPage.jsx`: add a deadline countdown label showing time remaining until today's show deadline (derived from `getTodayShows()` response); after saving, if the response `appliesTo === 'next_show'`, display a modal or toast with the `notice` text from the API

**Checkpoint**: Late saves show the next-show notice; lineup invalidated on pool rollover; member counts visible in song selector. Quickstart Scenario 3 passes.

---

## Phase 8: User Story 6 — Banner Discovery and Show Multiplier Preview (Priority: P3)

**Goal**: Players can see which groups are currently on banner and preview today's show multiplier categories (label only, no values) before finalising their lineup.

**Independent Test**: View `/card-game/shows` before the deadline → confirm multiplier labels are displayed (no numbers) → view `/card-game/banners` → confirm each banner shows group, rarity, end date, and Rate Up options. (Quickstart Scenario 10, US6 acceptance scenarios.)

- [ ] T069 [US6] Update `GET /shows/today` in `backend/routes/cardGame.js`: add `playerEntry` field — if user has an active valid lineup, set `playerEntry: { songTitle, cardCount, autoEnterStatus: 'will_auto_enter' }`; if no lineup, set `playerEntry: null`
- [ ] T070 [US6] Update `frontend/src/card-game/pages/LineupPage.jsx`: fetch `getTodayShows()` alongside the lineup; display a sidebar or top banner listing today's GG show multiplier labels (e.g., "+Rapper", "++JYP") with a note that exact values are hidden; do not display numbers
- [ ] T071 [US6] Update `frontend/src/card-game/pages/ShowResultPage.jsx`: when `playerEntry` is not null, display a summary card showing the player's saved song title and card count with the message "This lineup will auto-enter today's show"
- [ ] T072 [US6] Update `frontend/src/card-game/components/BannerCard.jsx`: if `banner.members.length === 1` (soloist), skip the Rate Up selector and render a single "Pull" button with the soloist's name; otherwise render the member selector as designed in US3
- [ ] T073 [US6] Update `frontend/src/card-game/pages/BannersPage.jsx`: add a countdown to banner end date (e.g., "Ends in 4 days") next to each BannerCard; display the `description` field (comeback name or milestone) if non-null as a subtitle

**Checkpoint**: Multiplier type labels visible in LineupPage; banners show end-date countdown; soloist banners skip rate-up step. All US6 acceptance scenarios pass.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Production hardening, seed data, GG enforcement, and final validation.

- [ ] T074 [P] Enforce GG-only filter across all `backend/routes/cardGame.js` routes: all queries that accept `genderCategory` must reject `'bg'` requests with 403 during the GG-only launch period; add a `GG_ONLY_MODE=true` flag to `backend/config.js` that controls this guard so it can be disabled when BG launches
- [ ] T075 [P] Add UR ticket annual refresh job to `backend/scheduler.js`: runs daily at `01:00` ART; queries `users` where `ur_ticket_refreshed_at <= NOW() - INTERVAL '365 days'` and the UR ticket is already redeemed (`tickets.redeemed_at IS NOT NULL`); inserts a new UR ticket row for each such user and updates `ur_ticket_refreshed_at`
- [ ] T076 Write `backend/seed-shows.js`: inserts show_schedules rows for GG with real Korean show data — Music Bank (KBS, `day_of_week = 5` Friday, `deadline_time = '17:45:00'`, `show_time = '18:00:00'`), Show Champion (MBC Music, Wednesday `3`, `12:45:00` / `13:00:00`), M Countdown (Mnet, Thursday `4`, `17:45:00` / `18:00:00`), Music Core (KBS, Saturday `6`, `13:45:00` / `14:00:00`), Inkigayo (SBS, Sunday `0`, `11:45:00` / `12:00:00`); all with `timezone = 'America/Argentina/Buenos_Aires'`; use `ON CONFLICT DO NOTHING`
- [ ] T077 [P] Write `backend/seed-gacha-config.js`: inserts default `gacha_config` rows with placeholder values: `rare_base_rate: 0.85`, `sr_base_rate: 0.13`, `ur_base_rate: 0.02`, `sr_pity_threshold: 50`, `ur_pity_threshold: 100`, `rate_up_percentage: 0.75`, `free_pack_rare_count: 3`, `random_score_range: 0.10`, `size_bonus_factor: 0.05`, `max_lineup_size: 9`, `reward_ur_percentile: 0.10`, `reward_sr_percentile: 0.50`; use `ON CONFLICT DO NOTHING` so re-running is safe
- [ ] T078 Add input validation to all card game write routes in `backend/routes/cardGame.js`: check required fields are present and typed correctly (e.g., `count` is a positive integer ≤ 10, `genderCategory` is `'gg'` or `'bg'`, `slotPosition` values are unique and within `member_count`); return 400 with a descriptive error for each violation
- [ ] T079 Add currency insufficiency guard to `gachaService.pull` in `backend/services/gachaService.js`: before deducting, verify `user.gg_currency >= count`; return a structured error `{ error: 'INSUFFICIENT_CURRENCY', have: N, need: count }` with HTTP 402 if not; also add the guard to the pull route in `backend/routes/cardGame.js`
- [ ] T080 Add card ownership validation to `PUT /api/card-game/lineup/:genderCategory` in `backend/routes/cardGame.js`: for each `playerCardId` in `slots`, verify it exists in `player_cards` with `user_id = req.user.userId`; return 403 if any slot references a card the player doesn't own
- [ ] T081 Add card game navigation links to `frontend/src/App.jsx`: in the existing header/nav component, add links to `/card-game/collection`, `/card-game/lineup`, `/card-game/banners`, and `/card-game/shows` visible only when the user is authenticated (has a stored access token)
- [ ] T082 Run all 10 validation scenarios from `specs/001-idol-card-game/quickstart.md` manually against the running application; document any failures; all scenarios must pass before this task is marked complete

**Checkpoint**: All quickstart scenarios pass end-to-end; BG data is in the DB but never returned to clients; config can be changed in `gacha_config` without restarting the server.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Requires Phase 1 completion — **BLOCKS all user stories**
- **Phase 3 (US1, P1)**: Requires Phase 2; no dependency on other user stories
- **Phase 4 (US2, P1)**: Requires Phase 2; reads lineups table (created in Phase 2 schema); can start in parallel with Phase 3
- **Phase 5 (US3, P2)**: Requires Phase 2; integrates with `collectionService` from Phase 3 — start after T018
- **Phase 6 (US4, P2)**: Requires T048–T050 from Phase 5 (gacha pull path) to replace the placeholder drop
- **Phase 7 (US5, P2)**: Requires T016–T017 and T023–T024 from Phase 3 (lineup routes); can start after T024
- **Phase 8 (US6, P3)**: Requires Phase 4 (show multipliers) and Phase 5 (banners); start after both complete
- **Phase 9 (Polish)**: Requires all desired user stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US2 (P1)**: Can start after Phase 2 — reads the `lineups` table but doesn't depend on the lineup routes being built
- **US3 (P2)**: Can start after T018 (collectionService stub exists) — calls `addCardToCollection`
- **US4 (P2)**: Depends on T050 (gacha pull path exists) — replaces placeholder overflow behavior
- **US5 (P2)**: Depends on T016, T017, T023, T024 (lineup DB + routes) — adds validity and deadline features
- **US6 (P3)**: Depends on US4 completed shows (T039) and US3 banners (T045, T052)

### Within Each Phase

- DB layer tasks marked [P] can run simultaneously (different functions in `db.js`)
- Service tasks must follow their DB dependencies
- Route tasks follow service tasks
- Frontend tasks marked [P] can run alongside backend route tasks

---

## Parallel Opportunities Per User Story

### US1 — run simultaneously after T017 completes:

```
T013 getAllCardDefs() DB functions
T014 player_cards DB functions
T015 tickets DB functions
T016 weekly_song_pools DB functions
T017 lineups DB functions
```

### US2 — run simultaneously after Phase 2 completes:

```
T031 show DB functions
T032 show_entries DB functions
T033 show_multipliers DB function
```

Then after T033:

```
T034 calculateScore service (pure function, no DB)
T035 soloist_only restriction (extends T034)
```

### US3 — run simultaneously after Phase 2 completes:

```
T045 banner DB functions
T046 pity counter DB functions
T047 gacha_config DB function
```

---

## Implementation Strategy

### MVP: User Stories 1 + 2 Only (P1)

1. Complete Phase 1 + Phase 2 — foundation ready
2. Complete Phase 3 (US1) — players can register, collect, and submit lineups
3. Complete Phase 4 (US2) — shows resolve; leaderboard visible; rewards distributed
4. **STOP and VALIDATE**: Run Quickstart Scenarios 1–4 (US1 + US2)
5. Deploy or demo — this is a functional daily competition game

### Full Feature (All Stories)

Continue from MVP:

6. Phase 5 (US3): Gacha and banners → Scenarios 5–6
7. Phase 6 (US4): Overflow duplicates → Scenario 7
8. Phase 7 (US5): Lineup management polish → Scenario 3 refinements
9. Phase 8 (US6): Discovery and preview → Scenario 10
10. Phase 9 (Polish): Seed data, guards, nav, full validation → Scenario 8

### Parallel Team Strategy

With two developers after Phase 2 completes:

- **Dev A**: US1 (Phase 3) → US5 (Phase 7)
- **Dev B**: US2 (Phase 4) → US3 (Phase 5) → US4 (Phase 6) → US6 (Phase 8)

US4 depends on US3's `collectionService` being in place, so Dev B must complete T050 before starting Phase 6.

---

## Notes

- `[P]` tasks touch different files or independent functions — safe to parallelize
- `[US#]` labels map to user stories in `specs/001-idol-card-game/spec.md`
- All show times are in `America/Argentina/Buenos_Aires` (ART, UTC-3); store as UTC TIMESTAMPTZ
- Gacha rates, pity thresholds, and reward percentiles are all in `gacha_config` — change them without code edits
- Do not hardcode any numeric tuning values; always read from `getGachaConfig()`
- BG data structures must exist in the DB from T006 onward; BG is suppressed in the API by the `GG_ONLY_MODE` flag until explicitly launched
- Commit after each completed task or logical group; do not commit T007 (migration run) separately — bundle it with T006
