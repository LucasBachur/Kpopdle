# Feature Specification: Kpopdle Card Game

**Feature Branch**: `001-idol-card-game`

**Created**: 2026-06-14

**Status**: Delivered (core build — US1–US5). Frozen 2026-06-21. Remaining work (US6 + polish) is tracked as new Spec Kit features (002+). See *As-Built Reconciliation* below.

**Input**: User description: "Add a Kpop idol card collecting and team-building game where players collect cards representing real idols, build lineups, and compete daily in auto-resolved music show performances."

## As-Built Reconciliation *(2026-06-21)*

This spec was written before implementation. The shipped code (uncommitted on `dev` as of 2026-06-21) diverged from the original design in the ways below. These notes are authoritative where they conflict with the requirements text; the requirements are retained for historical context.

- **Tickets are integer counts, not rows.** FR-003/004/005 describe per-ticket records. As built, `users` carries `rare_tickets`, `sr_tickets`, `ur_tickets` integer columns (default 1 each); redemption decrements the relevant counter. There is no `tickets` table (the migration explicitly `DROP TABLE IF EXISTS tickets`). The redeem endpoint is `POST /tickets/:rarity/redeem` (by rarity, not by ticket id).
- **"Free pack" became a "daily pull."** US3 / FR-011 describe a free Rare *pack*. As built, it is a single free **daily pull** on the always-on daily banner, gated by `users.last_daily_pull_gg` / `_bg`, drawing from the daily banner pool with a configurable SR chance (`daily_banner_sr_rate`). Endpoint: `POST /daily-pull/claim`.
- **Onboarding flag added.** `users.onboarding_completed` (boolean) and a `WelcomePage` / `LoginPage` front the first-run reveal flow; `POST /onboarding/complete` marks it done. Not in the original spec.
- **Idol attributes reused, not added.** `idols.group_type` and `idols.company` (and `songs.group_type`) already existed in the base Kpopdle schema; only `idols.roles` was added. Show multipliers consume all three.
- **`card_definitions.art_path` is nullable** as built (spec said NOT NULL) so cards can ship before art lands.

### Delivered vs. deferred

- **Delivered (US1–US5):** auth + onboarding, starter collection, collection/tickets, lineup build & save (with song-in-pool + ownership + deadline-notice validation), daily pull, banner pulls with pity/rate-up, overflow persistence + currency conversion, show scheduling/resolution/scoring, leaderboard + rewards.
- **Deferred (now in new features):** US6 show-multiplier preview + banner discovery polish; attaching multipliers to created shows; weekly song-pool rotation + lineup-invalidation cron; UR-ticket annual refresh; operator content seeding; `GG_ONLY_MODE` enforcement; real cosmetic system; tie-handling fix in rank assignment; quickstart validation pass.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - New Player Onboarding (Priority: P1)

A new player registers for an account and immediately receives a starter collection of Rare cards (one per idol in the roster) plus three one-time tickets — one per rarity — that can be redeemed at any time to claim a free card of their choice. The player can then browse their collection, pick a song from the current weekly pool, build their first lineup, and submit it before that day's deadline to start competing.

**Why this priority**: Without collection and lineup fundamentals, no other feature works. This is the zero-to-playing path every user must complete.

**Independent Test**: Can be fully tested by registering an account, redeeming a starter ticket, building a lineup with available cards, and submitting before a deadline — delivering a complete first-play experience.

**Acceptance Scenarios**:

1. **Given** a brand new account, **When** the player logs in for the first time, **Then** their collection contains cards from 30 configurable random starter pulls revealed card-by-card through the pull reveal UI, plus three unredeemed tickets (1x Rare, 1x Super Rare, 1x Ultra Rare).
2. **Given** an unredeemed ticket, **When** the player selects a card of the matching rarity and redeems the ticket, **Then** that card is added to their collection permanently.
3. **Given** a player with at least one card, **When** they select a song from the weekly pool and fill all required lineup slots, **Then** the lineup is saved and auto-submitted to every daily show until changed.
4. **Given** a player who submits a lineup after the daily deadline, **When** they receive a confirmation, **Then** the system clearly notifies them the lineup is registered for the **next** show, not the current one.

---

### User Story 2 - Daily Show Participation (Priority: P1)

A player with a saved lineup participates in that day's Kpop music show. The show applies category multipliers (visible to the player as bonus types, not exact numbers) and a small random factor to each lineup, auto-resolves all scores, and posts results to the global leaderboard. The player receives pull currency rewards based on their final ranking percentile.

**Why this priority**: The daily competition loop is the core engagement mechanic — it's why players log in every day and why collecting stronger cards has purpose.

**Independent Test**: Can be fully tested by confirming a lineup, waiting for show resolution, and verifying the leaderboard shows the player's score, song, and position alongside reward distribution.

**Acceptance Scenarios**:

1. **Given** a player with a confirmed lineup before the deadline, **When** the show resolves, **Then** their score is calculated as: sum of card stats × applicable show multipliers × size bonus × random factor (approximately ±10%).
2. **Given** the show has resolved, **When** the player views the leaderboard, **Then** they can see every participant's lineup, song performed, score, and position.
3. **Given** the show has resolved, **When** rewards are distributed, **Then** players in the top 10% receive a UR pull, top 11–50% receive an SR pull, and all others receive a Rare pull.
4. **Given** a player who did not submit a lineup and has no saved lineup, **When** the show resolves, **Then** they do not appear on the leaderboard and receive no reward.
5. **Given** a player who missed the deadline but had a previously saved lineup, **When** the show resolves, **Then** that saved lineup is auto-entered and they receive a ranking and reward normally.

---

### User Story 3 - Card Acquisition via Gacha (Priority: P2)

A player acquires new cards through three channels: a free daily pull on the always-present daily banner, banner-specific free pull grants (consumed before currency), and paid banner pulls using earned in-game currency (💎). Banners can be time-limited (group comebacks, milestones) or permanent (the daily banner). Every banner draws from a card pool that spans all three rarities — rarity per pull is determined by configurable gacha rates, not locked to the banner. The player selects a Rate Up idol before pulling from a multi-member banner; that idol has an elevated drop chance within the banner pool for the matched rarity tier. A pity system guarantees a high-rarity card after a configurable number of pulls.

**Why this priority**: Gacha is the primary card-acquisition path beyond the starter collection. It drives daily engagement and progression.

**Independent Test**: Can be fully tested by claiming the daily free pull on the daily banner, claiming banner-specific free pulls, spending currency on a banner with a chosen Rate Up idol, and confirming pity mechanics trigger after the configured threshold.

**Acceptance Scenarios**:

1. **Given** a player who has not yet used today's free pull on the daily banner, **When** they claim it, **Then** they receive one card drawn from the daily banner's pool and cannot claim another daily free pull until the next calendar day.
2. **Given** a player with banner-specific free pulls remaining, **When** they open the banner, **Then** the UI shows a single "Claim X Free Pulls" button (X capped at 10). Only when free pulls are exhausted does the UI show paid options: "Pull ×1" (1💎) and "Pull ×10" (9💎, one pull free).
3. **Given** a player opening a group banner, **When** they select a Rate Up idol and confirm a pull, **Then** the selected idol appears at an elevated rate versus other members of the group for the matched rarity tier.
4. **Given** a player who reaches the pity threshold without a high-rarity card, **When** they perform the next pull, **Then** they are guaranteed a card of the appropriate rarity (SR or UR).
5. **Given** a banner with only one member per rarity tier, **When** the player opens it, **Then** the Rate Up selection step is skipped and all pulls for that rarity feature that member.
6. **Given** a banner that has passed its end date, **When** a player attempts to access it, **Then** the banner is no longer available and any unspent currency is retained for future banners.

---

### User Story 4 - Card Upgrading via Duplicates (Priority: P2)

When a player receives a card they already own, the duplicate is consumed to upgrade the original card's stat by +1 point. Upgrades cannot push a card's stat above its rarity ceiling (Rare: 85, SR: 95, UR: 99). Once a card is at the ceiling, any further duplicates are converted into pull currency.

**Why this priority**: The duplicate system is the long-term progression mechanic that gives meaning to continued pulling even after a card is owned.

**Independent Test**: Can be fully tested by acquiring a duplicate of a maxed-stat card and verifying the upgrade cap is enforced and the duplicate converts to currency.

**Acceptance Scenarios**:

1. **Given** a player receives a duplicate of a card below its rarity ceiling, **When** the duplicate is consumed, **Then** the original card's stat increases by exactly 1 and the duplicate is removed from inventory.
2. **Given** a player owns a card already at its rarity ceiling, **When** they receive a duplicate, **Then** no stat increase occurs and the duplicate is stored as an overflow item in inventory awaiting the player's decision.
3. **Given** multiple duplicates received simultaneously (e.g., from a multi-pull), **When** processed, **Then** each duplicate is applied in sequence, stopping at the ceiling; any remaining duplicates beyond the cap are stored as overflow items.
4. **Given** a player has overflow duplicate items in inventory, **When** they choose to convert one, **Then** they can select either pull currency or a cosmetic item as the conversion target, or defer the decision and leave the item in inventory.

---

### User Story 5 - Weekly Lineup Management (Priority: P2)

A player reviews the current week's song pool (25 songs shared globally) and picks one song for their lineup. The song's member count determines how many lineup slots must be filled. The player can change their lineup at any time before the next show deadline; any saved changes take effect for that day's show.

**Why this priority**: Lineup strategy is the primary skill expression in the game — choosing the right song and cards for each day's show multipliers is what separates top players from casual ones.

**Independent Test**: Can be fully tested by changing a lineup mid-week, verifying the change is registered for the next day's show, and confirming the previous day's result is unaffected.

**Acceptance Scenarios**:

1. **Given** a weekly song pool of 25 songs, **When** a player selects a song, **Then** the required number of lineup slots matches that song's member count, and the player must fill every slot before the lineup can be saved.
2. **Given** a player who changes their lineup before the day's deadline, **When** the show resolves, **Then** the updated lineup is used for that day's show.
3. **Given** a player who tries to save a lineup with empty slots, **When** they attempt to confirm, **Then** the system prevents submission and indicates which slots need to be filled.
4. **Given** a new week begins, **When** the player views the song pool, **Then** a new set of 10 songs is available (potentially different from last week's pool), and any previously saved lineup persists until the player changes it.

---

### User Story 6 - Banner Discovery and Show Multiplier Preview (Priority: P3)

A player can browse currently active banners to see which groups and rarities are featured. They can also preview the current day's show multiplier categories (bonus types visible without exact values) before finalizing their lineup, allowing strategic team-building.

**Why this priority**: Discovery and strategy tools reduce friction and increase engagement without being blockers — the game functions without them but is significantly better with them.

**Independent Test**: Can be tested by viewing the banner list and verifying active/expired banners, then viewing the show multiplier categories for the day without seeing numeric values.

**Acceptance Scenarios**:

1. **Given** multiple banners are active, **When** a player views the banner list, **Then** they see each banner's group, featured rarity, end date, and available Rate Up options.
2. **Given** today's show has bonus categories (e.g., "+Maknae", "+Rapper"), **When** a player views the show preview, **Then** they see the bonus category names but not the numeric multiplier values.
3. **Given** a special event show, **When** a player views the show preview, **Then** the event-specific multipliers are shown with the same category-label-only format.

---

### Edge Cases

- What happens when a player's lineup song no longer matches their collection (e.g., a card was somehow removed)? The system should flag the lineup as incomplete before the next deadline.
- How does the show handle a tie in scores? Ranking is determined by the raw score; identical scores share a rank (e.g., two players both rank 5th).
- What happens if no players submit a lineup for a show? The show resolves with zero participants and no rewards are distributed.
- What happens when a UR ticket is used and then the one-year refresh period elapses? The player receives a new UR ticket automatically at the anniversary.
- What happens if a banner expires while a player is mid-pull session? Pulls in progress are completed; the banner then becomes unavailable.
- What happens to a saved lineup when the weekly song pool changes? The lineup song persists; if the song is no longer in the pool, the lineup is marked invalid and requires re-confirmation before the next deadline.
- What if a player attempts to use the same ticket twice? The system rejects the second redemption — tickets are single-use (UR refreshes annually, not stacks).

## Requirements *(mandatory)*

### Functional Requirements

**Account & Access**

- **FR-001**: System MUST require an authenticated account to access all card game features.
- **FR-002**: System MUST seed each new account's starter collection via a configurable number of random pulls (default: 30, stored in gacha_config as `starter_pull_count`) routed through the pull reveal UI on first login.
- **FR-003**: System MUST issue three one-time tickets at account creation: one Rare ticket, one Super Rare ticket, and one Ultra Rare ticket.
- **FR-004**: System MUST allow each ticket to be redeemed once for a player-chosen card of the matching rarity, at any time.
- **FR-005**: System MUST automatically issue a new UR ticket to each account once per calendar year after initial use.

**Cards & Collection**

- **FR-006**: System MUST represent each card with: idol name, group, rarity (Rare / Super Rare / Ultra Rare), a single integer stat, and art/border design.
- **FR-007**: System MUST enforce rarity stat ranges: Rare 70–85, Super Rare 86–95, Ultra Rare 96–99.
- **FR-008**: System MUST allow duplicate cards to be consumed to increase the original card's stat by +1.
- **FR-009**: System MUST cap upgrades at the rarity ceiling. Duplicates received beyond the cap MUST be held in inventory as overflow items. Players MUST be able to convert each overflow duplicate to pull currency or a cosmetic item at any time, or leave it in inventory indefinitely.
- **FR-010**: System MUST track each player's full card collection, including stat values after upgrades.

**Gacha & Banners**

- **FR-011**: System MUST provide one free pull per player per gender category per calendar day on the daily banner, resetting at midnight ART.
- **FR-012**: System MUST support both time-limited banners (configurable start and end date) and permanent banners (NULL ends_at). The daily banner is always-on and permanent; event banners are time-limited.
- **FR-013**: System MUST allow players to select one Rate Up idol per banner pull session, giving that idol an elevated drop rate within the matched rarity tier.
- **FR-014**: System MUST support single-member (soloist) banners without requiring a Rate Up selection step.
- **FR-015**: System MUST enforce a pity system that guarantees a high-rarity card after a configurable number of consecutive pulls without one.
- **FR-016**: System MUST store all gacha rates, pity thresholds, Rate Up percentages, pull costs, and reward amounts as configurable values in gacha_config, not hardcoded constants.
- **FR-017**: System MUST set the default single-pull cost to 1💎 and the 10-pull cost to 9💎 (one pull free), both stored in gacha_config.
- **FR-036**: System MUST track banner-specific free pull grants per player in a dedicated `banner_free_pulls` table. Free pulls are consumed before currency; paid pull buttons are only shown when free pulls are fully exhausted.
- **FR-037**: System MUST batch free pull claims at a maximum of 10 per interaction. If a player has more than 10 free pulls remaining on a banner, they claim 10 at a time until exhausted.
- **FR-038**: System MUST present a single "Claim X Free Pulls" button (X capped at 10) when a player has free pulls remaining on a banner, and "Pull ×1" (1💎) / "Pull ×10" (9💎) buttons only when free pulls are fully exhausted.
- **FR-039**: System MUST resolve each banner pull against cards in banner_cards filtered to the rolled rarity; rarity per pull is determined by gacha rates in gacha_config, not a banner-level rarity field.

**Daily Shows & Lineup**

- **FR-018**: System MUST run one show per day per gender category (Girl Group and Boy Group are fully independent).
- **FR-019**: System MUST support a weekly recurring show schedule where each day of the week corresponds to a fixed show, replaceable by a special event.
- **FR-020**: System MUST allow special event shows to replace a regular show for that day, using the same scoring mechanic with different/more specific multipliers.
- **FR-021**: System MUST expose weekly show multiplier categories to players without revealing exact numeric values.
- **FR-022**: System MUST provide a shared weekly song pool of 25 songs to all players within a gender category.
- **FR-023**: System MUST enforce that each song defines a required lineup size (member count), and players must fill every slot before a lineup can be submitted.
- **FR-024**: System MUST auto-submit a player's last saved lineup if they miss the daily deadline, and do nothing if no lineup exists.
- **FR-025**: System MUST notify players who submit a lineup after the deadline that their entry applies to the next show.
- **FR-026**: System MUST allow lineup changes at any time up to the daily deadline.
- **FR-027**: System MUST calculate show scores as: combined card stats × applicable show multipliers × size bonus × random factor.
- **FR-028**: System MUST apply a size bonus that favors larger lineups over smaller ones without hard-restricting solo entries.
- **FR-029**: System MUST apply a random factor of approximately ±10% to each lineup's score at resolution time.

**Leaderboard & Rewards**

- **FR-030**: System MUST publish a per-show, per-gender-category global leaderboard showing each entry's lineup, song, score, and rank.
- **FR-031**: System MUST reset the leaderboard after each show resolves.
- **FR-032**: System MUST distribute pull rewards after each show: top 10% receive a UR pull, top 11–50% receive an SR pull, all other participants receive a Rare pull.
- **FR-033**: System MUST award no rewards to players who did not participate in a given show.

**Gender Split**

- **FR-034**: System MUST maintain fully separate collections, lineups, banners, shows, and leaderboards for Girl Group and Boy Group categories.
- **FR-035**: System MUST launch with only the Girl Group category visible in the user interface; Boy Group data structures MUST be present in the system but not exposed to players.

### Key Entities

- **Player Account**: Authenticated user identity with collection, currency balance, tickets, lineup per gender category, daily participation history, and cumulative leaderboard history.
- **Card**: Represents one idol at one rarity level. Attributes: idol name, group, rarity, stat (integer), art/border variant. Upgraded copies track current stat separately from the base value.
- **Banner**: A pull opportunity for a specific group, optionally time-limited. Attributes: group, start date, optional end date (NULL = permanent), card pool spanning all three rarities (via banner_cards), Rate Up configuration, free pull grant count.
- **Show**: A daily competition event. Attributes: date, gender category, multiplier definitions, song pool, deadline, resolution status, leaderboard snapshot.
- **Lineup**: A player's submitted team for a gender category. Attributes: selected song, assigned cards per slot, submission timestamp, show it was entered into.
- **Song**: An entry in the weekly pool. Attributes: title, required member count, the week it belongs to.
- **Show Multiplier**: A category bonus applied at show resolution. Attributes: bonus type label (player-visible), numeric value (system-only), applicable show.
- **Pull Currency (💎)**: Earnable in-game resource used to buy banner pulls. Single pull costs 1💎; 10-pull costs 9💎 (one pull free). No real-money purchase path.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new player can complete onboarding (account creation → starter collection received → first lineup submitted) in under 5 minutes.
- **SC-002**: Show results and leaderboard rankings are visible to all participants within 5 minutes of the daily deadline.
- **SC-003**: Players can redeem the daily free pack in under 30 seconds from any screen.
- **SC-004**: 100% of submitted lineups with valid cards are entered into the correct day's show without manual intervention.
- **SC-005**: Pull rewards are distributed to all eligible players within 10 minutes of show resolution, with no manual steps required.
- **SC-006**: All configurable parameters (gacha rates, pity thresholds, multiplier values, reward amounts) can be updated by an operator without changes to application business logic.
- **SC-007**: A player who changes their lineup before the deadline sees their updated lineup reflected in that day's show result.
- **SC-008**: The leaderboard correctly reflects 100% of participants' scores and ranks with no missing or duplicate entries per show.

## Assumptions

- All gameplay currency is earned in-game only; no real-money purchases are in scope.
- The game launches with Girl Group only; Boy Group infrastructure is built but not surfaced in the UI.
- The weekly song pool is curated by an operator via direct database management (no admin UI in v1).
- Banner schedules and milestone event definitions are set by an operator via direct database management (no admin UI in v1).
- Show deadlines and timezones are configured globally per show; all players operate under the same show deadline regardless of local timezone.
- Rare card stats for new idols are calculated by an operator using the defined weighted model (YouTube views 40%, music show wins 40%, Spotify monthly listeners 20%, logarithm-compressed) before being entered into the system.
- Super Rare and Ultra Rare card stats are manually assigned by an operator at release time, always above the group's Rare ceiling.
- When a player receives a duplicate of a card already at its rarity stat ceiling, the duplicate is held in the player's inventory as an overflow item. The player may then choose to convert it to pull currency or cosmetic items (e.g., card borders/frames) at any time, or leave it in inventory indefinitely until they decide. No automatic conversion occurs without player action.
- The Boy Group category uses identical mechanics to Girl Group and requires no separate design decisions.
- All player data (collection, lineup, currency, tickets, history) is scoped to a single account and not transferable between accounts.
