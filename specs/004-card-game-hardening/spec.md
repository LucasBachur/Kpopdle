# Feature Specification: Card Game Hardening & GG-Only Launch Mode

**Feature Branch**: `004-card-game-hardening`

**Created**: 2026-06-25

**Status**: Draft

**Input**: User description: "Feature 004. Scope: GG_ONLY_MODE flag in config + 403 guard on all BG routes; Input validation on all card-game write routes (count, genderCategory, slotPosition uniqueness); Card ownership validation on PUT /lineup — verify each card belongs to the requesting user; UR-ticket annual refresh: daily cron issues a new UR ticket 365 days after the original was used; Full Feature 001 quickstart validation pass (Scenarios 1–10)."

## Clarifications

### Session 2026-06-25

- Q: How should the annual UR-ticket grant be triggered and de-duplicated? → A: Fixed calendar grant date(s) configured in game config, **not** a per-player rolling 365-day clock. When the current date matches a configured grant date, the daily process grants +1 UR ticket to every registered player; tickets accumulate; the grant is guarded so it occurs at most once per configured date per calendar year. (This supersedes the original Input wording "365 days after the original was used".)
- Q: Should the grant date be configurable, and support multiple dates? → A: Yes — game config holds a list of annual grant dates (month + day) so operators can add more free-ticket days without a code change; the default configuration is a single date of **December 31**.
- Q: Who is eligible for the annual grant? → A: All registered player accounts, with no activity/login requirement (deleted/non-existent accounts excluded).
- Q: Is GG-only enforcement backend-only, or does it also cover the frontend UI? → A: Both — the backend 403 guard on BG routes is the authoritative gate, and while GG-only mode is enabled the frontend also hides/disables all Boy Group entry points (defense in depth), so players never reach dead BG actions that would only 403.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Girl-Group-Only Launch Enforcement (Priority: P1)

The card game launches with only Girl Group (GG) content ready for players. Boy Group (BG) data exists in the system but is incomplete and must never be reachable by players. A site-wide switch lets operators keep all Boy Group functionality fully sealed off until it is ready, while still allowing GG play to proceed normally.

**Why this priority**: Without this guarantee, players could reach half-built Boy Group content (banners, shows, lineups, packs), creating broken experiences, unfair rewards, or data corruption. It is the single most important safety boundary for launch.

**Independent Test**: Enable GG-only mode, then attempt every Boy-Group-targeted request as a logged-in player and confirm each is refused; confirm every equivalent Girl-Group request succeeds. Disable the mode and confirm Boy Group requests are permitted again.

**Acceptance Scenarios**:

1. **Given** GG-only mode is enabled, **When** a player requests any Boy-Group-scoped action (lineup, weekly songs, free pack, banner pull, leaderboard), **Then** the request is refused with a "forbidden" outcome and no Boy Group data is returned or modified.
2. **Given** GG-only mode is enabled, **When** a player performs the equivalent Girl Group action, **Then** the request succeeds normally.
3. **Given** GG-only mode is disabled, **When** a player performs a Boy Group action, **Then** the request is permitted and behaves like its Girl Group counterpart.
4. **Given** GG-only mode is enabled, **When** the operator inspects the configuration, **Then** the current mode value is readable and the source of truth for all gating decisions.
5. **Given** GG-only mode is enabled, **When** a player loads the card-game UI, **Then** no Boy Group entry points (tabs, buttons, navigation, or selectors) are shown or actionable, while the backend 403 guard remains the authoritative gate behind them.

---

### User Story 2 - Trustworthy Write Validation (Priority: P2)

Every action that changes a player's state — claiming packs, pulling banners, saving lineups — rejects malformed or out-of-range input cleanly instead of producing errors, corrupt records, or unintended rewards.

**Why this priority**: Unvalidated writes are the primary path to data corruption and reward exploits. This protects the integrity of every player's collection and the fairness of the economy.

**Independent Test**: For each write action, submit boundary and invalid values (e.g., a pull count of 0, 11, or non-numeric; an unrecognized gender category; a lineup with two cards in the same slot) and confirm each is rejected with a clear validation message and no state change.

**Acceptance Scenarios**:

1. **Given** a banner pull request, **When** the pull count is below 1, above 10, missing, or non-numeric, **Then** the request is rejected with a validation error and no cards are pulled and no currency is spent.
2. **Given** any write request that names a gender category, **When** the category is not a recognized value, **Then** the request is rejected with a validation error.
3. **Given** a lineup submission, **When** two or more slots reference the same slot position, **Then** the request is rejected with a validation error and the existing lineup is unchanged.
4. **Given** a lineup submission, **When** the number of filled slots does not match the chosen song's required member count, **Then** the request is rejected with a validation error.
5. **Given** a free-pack claim, **When** the gender category is invalid or missing, **Then** the request is rejected with a validation error.

---

### User Story 3 - Lineup Card Ownership Enforcement (Priority: P2)

When a player saves a lineup, the system confirms that every card placed in the lineup actually belongs to that player. A player cannot field cards they do not own, whether by mistake or by tampering with the request.

**Why this priority**: Fielding unowned cards would let players inflate scores with cards they never earned, directly undermining leaderboard fairness and reward distribution. It is as critical as input validation but scoped to a single high-value route.

**Independent Test**: Submit a lineup that includes a card ID owned by a different player (or a non-existent card), and confirm the save is refused; submit the same lineup using only the player's own cards and confirm it saves.

**Acceptance Scenarios**:

1. **Given** a lineup submission, **When** any referenced card exists but does not belong to the requesting player, **Then** the submission is rejected as a forbidden/ownership failure (`403`) and the existing lineup is unchanged.
2. **Given** a lineup submission, **When** any referenced card does not exist at all, **Then** the submission is rejected with a validation error (`400`) — distinct from the `403` returned for another player's card — and the existing lineup is unchanged.
3. **Given** a lineup submission, **When** every referenced card belongs to the requesting player, **Then** the lineup saves successfully.

---

### User Story 4 - Annual Ultra-Rare Ticket Grant (Priority: P3)

On each operator-configured annual grant date (default December 31), every registered player automatically receives one new Ultra Rare (UR) ticket. Players who already hold a UR ticket simply accumulate another. The grant happens on its own, without the player needing to take any action, and operators can configure one or more grant dates without a code change.

**Why this priority**: This is a retention and fairness reward layered on top of the existing ticket system. It is valuable but not a launch-blocking safety concern, so it ranks below the integrity guarantees.

**Independent Test**: Configure a grant date equal to today, run the daily process, and confirm every registered player's UR ticket count increased by exactly one; run the process again the same day and confirm no further increase; set the configured date to a value other than today and confirm no grant occurs.

**Acceptance Scenarios**:

1. **Given** the current date matches a configured grant date, **When** the daily process runs, **Then** every registered player receives exactly one additional UR ticket.
2. **Given** a player already holds an unredeemed UR ticket, **When** a configured grant date is processed, **Then** their UR ticket count increases by one (tickets accumulate; no cap is applied).
3. **Given** the daily process has already granted tickets for a configured date this calendar year, **When** the process runs again the same day, **Then** no additional tickets are granted for that date.
4. **Given** the current date does not match any configured grant date, **When** the daily process runs, **Then** no UR tickets are granted.
5. **Given** multiple grant dates are configured, **When** each configured date arrives, **Then** a grant occurs independently on each one.

---

### User Story 5 - End-to-End Launch Validation (Priority: P3)

Before considering the card game ready, the team runs the full Feature 001 quickstart validation (Scenarios 1–10) against the hardened system and confirms every scenario still passes, including the new gating, validation, ownership, and annual-grant behaviors.

**Why this priority**: This is the confidence gate that proves the hardening changes did not regress existing functionality. It depends on the other stories being complete, so it is sequenced last.

**Independent Test**: Execute Scenarios 1–10 from the Feature 001 quickstart end to end and record pass/fail for each, with particular attention to GG/BG separation (Scenario 10) now backed by the GG-only mode.

**Acceptance Scenarios**:

1. **Given** the hardened build, **When** Feature 001 quickstart Scenarios 1–10 are executed in order, **Then** all ten scenarios pass without error.
2. **Given** Scenario 10 (GG/BG separation), **When** executed with GG-only mode enabled, **Then** no Boy Group data is surfaced through any player-facing request.

---

### Edge Cases

- When GG-only mode is toggled while a player has an in-progress Boy Group session, the next Boy Group request is refused immediately; no partial Boy Group write is left committed.
- When a lineup submission mixes valid owned cards with one unowned or invalid card, the entire submission is rejected (all-or-nothing), not partially saved.
- When a banner pull count is the exact boundary value (1 or 10), it is accepted; values just outside (0 or 11) are rejected.
- When the daily process runs more than once on a configured grant date (e.g., after a restart), it does not issue duplicate UR tickets for that date/year.
- When a configured grant date does not occur in a given calendar year (e.g., Feb 29 in a non-leap year), no grant happens that year for that date.
- When a player account is deleted (no longer a registered account), the annual grant does not issue tickets to it.
- When two lineup slots reference different cards but identical slot positions, the duplicate-position rule rejects the submission even if both cards are owned.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST expose a single configurable "GG-only mode" flag that serves as the authoritative source of truth for whether Boy Group functionality is reachable by players.
- **FR-002**: While GG-only mode is enabled, the system MUST refuse every Boy-Group-scoped player request with a "forbidden" outcome, covering at minimum: saving/reading a Boy Group lineup, fetching Boy Group weekly songs, claiming a Boy Group free pack, pulling any Boy Group banner by id (`POST /banners/:bannerId/pull`, where the banner's own gender — not a request parameter — determines whether it is Boy-Group-scoped), and reading Boy Group leaderboards. (`GET /banners` and `GET /shows/today` are hardcoded to Girl Group and expose no gender parameter, so they are GG-only by construction rather than 403-gated.)
- **FR-003**: While GG-only mode is enabled, the system MUST allow all equivalent Girl Group requests to proceed unaffected.
- **FR-004**: While GG-only mode is disabled, the system MUST permit Boy Group requests to behave identically to their Girl Group counterparts.
- **FR-004a**: While GG-only mode is enabled, the player-facing frontend MUST hide or disable all Boy Group entry points (tabs, buttons, navigation, gender selectors) so players cannot initiate a Boy Group action that would only be refused; the backend 403 guard (FR-002) remains the authoritative gate and is not replaced by this frontend behavior.
- **FR-005**: The system MUST validate the banner pull count on every pull request, accepting only whole numbers from 1 through 10 inclusive and rejecting anything missing, non-numeric, or out of range without spending currency or granting cards.
- **FR-006**: The system MUST validate the gender category on every write request that accepts one, rejecting any value outside the recognized set.
- **FR-007**: The system MUST reject any lineup submission in which two or more slots reference the same slot position.
- **FR-008**: The system MUST reject any lineup submission whose number of filled slots does not match the required member count of the chosen song.
- **FR-009**: On lineup submission, the system MUST verify that every referenced card exists and belongs to the requesting player, rejecting the entire submission if any card fails this check and leaving the prior lineup unchanged. A referenced card id that does not exist at all MUST be rejected as a validation error (`400`); a card that exists but belongs to another player MUST be rejected as a forbidden/ownership failure (`403`).
- **FR-010**: All write-route validation failures MUST return a clear, actionable error indicating what was invalid, and MUST NOT alter any player state.
- **FR-011**: The system MUST run a daily automated process that, when the current date matches any operator-configured annual grant date, grants one additional Ultra Rare ticket to every registered player.
- **FR-012**: The daily process MUST guard the annual grant so that at most one grant per configured date occurs per calendar year, regardless of how many times the process runs that day.
- **FR-013**: The system MUST allow operators to configure one or more annual grant dates (month + day) via game configuration without a code change; the default configuration is a single date of December 31.
- **FR-014**: Granted UR tickets MUST accumulate with any tickets the player already holds (no cap applied by the grant); the grant MUST apply to all registered player accounts and MUST NOT apply to deleted/non-existent accounts.
- **FR-015**: The team MUST be able to execute Feature 001 quickstart Scenarios 1–10 against the hardened system and have all ten pass, confirming no regression in existing functionality.

### Key Entities *(include if data involved)*

- **GG-Only Mode Flag**: A single operator-controlled configuration value representing whether Boy Group functionality is sealed off. Read on every Boy-Group-scoped request to decide whether to allow or refuse it.
- **Player Card**: A card instance owned by a specific player; ownership is the attribute checked when the card is placed in a lineup.
- **Lineup Slot**: A position within a lineup, paired with the player card assigned to it; slot positions must be unique within one lineup and collectively match the song's member count.
- **UR Ticket**: A player-held entitlement to pick one Ultra Rare card, tracked as a count on the player; counts accumulate when new tickets are granted. The system records a marker of the last processed annual grant to prevent duplicate grants within the same calendar year.
- **Annual UR Grant Date(s)**: An operator-configured list of calendar dates (month + day) on which every registered player receives one additional UR ticket; defaults to a single date of December 31.
- **Pull Request Input**: The submitted parameters for a banner pull, including a count that must fall within the accepted range.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With GG-only mode enabled, 100% of Boy-Group-scoped player requests are refused and 0 Boy Group records are returned or written.
- **SC-001a**: With GG-only mode enabled, 0 Boy Group entry points (tabs, buttons, navigation, gender selectors) are visible or actionable in the player-facing UI.
- **SC-002**: With GG-only mode disabled, 100% of Boy Group requests succeed equivalently to their Girl Group counterparts.
- **SC-003**: 100% of write requests carrying invalid count, gender category, duplicate slot positions, or mismatched slot counts are rejected with no resulting state change.
- **SC-004**: 0 lineups can be saved that contain a card not owned by the submitting player.
- **SC-005**: On each configured annual grant date, 100% of registered player accounts receive exactly one additional UR ticket, with 0 duplicate grants across repeated daily runs for that date and year.
- **SC-006**: All 10 Feature 001 quickstart scenarios pass against the hardened build.

## Assumptions

- The default state of GG-only mode at launch is **enabled** (Boy Group sealed off), since Boy Group content is not launch-ready.
- The GG-only mode flag lives alongside the existing game configuration so operators can change it without a code change, consistent with the existing config-hotswap behavior validated in Feature 001 Scenario 8.
- A "forbidden" refusal for blocked Boy Group requests is the standard authorization-denied outcome (HTTP 403-equivalent) rather than a generic validation error, so clients can distinguish gating from bad input.
- The recognized gender categories are exactly Girl Group and Boy Group as already used throughout the card game; no third category is introduced.
- The annual UR grant is date-driven (fixed configured calendar dates), not anchored to any per-player redemption timestamp; a stored marker of the last processed grant date is sufficient to enforce once-per-date-per-year idempotency.
- The grant date configuration lives alongside the existing game configuration so operators can add/remove dates without a code change, consistent with the config-hotswap behavior validated in Feature 001 Scenario 8.
- The daily grant runs within the existing scheduler/cron infrastructure used for other daily card-game tasks; no new always-on service is required.
- The "current date" that drives annual-grant matching is evaluated in the project's canonical timezone (Argentina Time, via the existing `todayART()` helper), consistent with show scheduling. The daily cron fires at `0 3 * * *` UTC, which falls on the same ART calendar day, so a December 31 ART grant is evaluated exactly once on December 31 ART.
- Feature 001 quickstart validation is a manual acceptance pass executed by the team, not an automated regression suite, consistent with how that quickstart is written.
- All affected routes already require an authenticated player; this feature does not change authentication, only adds authorization gating and input/ownership validation on top of it.
- The frontend learns the GG-only mode value from the same game configuration (e.g., surfaced via an existing config/status response) and uses it solely to hide/disable Boy Group entry points for UX; the backend 403 guard, not the frontend, is the trust boundary.
