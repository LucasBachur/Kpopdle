# Feature Specification: Show Multipliers & Scoring Completeness

**Feature Branch**: `003-show-multipliers-scoring`

**Created**: 2026-06-22

**Status**: Draft

**Input**: User description: "Show multipliers & scoring completeness. The scoring engine in the card game (feature 001) calls getMultipliersByShow() at resolution time but show_multipliers rows are never inserted — every show resolves with implicit 1x multipliers, making card roles and company metadata meaningless. This feature closes that gap by: (1) providing an operator seed script that defines multipliers per show schedule (roles, company, group-homogeneity bonuses), (2) wiring multiplier creation into the show scheduler so each new show inherits its schedule's multipliers, (3) exposing multiplier category labels (not values) to players on the lineup page so they can make strategic card choices, and (4) fixing the tie-handling bug in rank assignment so identical scores share a rank. Backend only except for the player-facing multiplier label display on the lineup page."

**Scope extension (2026-06-23)**: Chemistry bonus system added — an always-on lineup scoring bonus that scales logarithmically with group representation in the lineup, distinct from per-show multipliers.

## Context

The card game's scoring system was designed to reward strategic lineup building: players who field cards matching a given show's bonus categories (e.g., a show that favors rappers, or JYP artists) should score higher. The infrastructure for this is fully built — the `show_multipliers` table exists, the scoring engine reads and applies it, and the leaderboard consumes final scores. However, no multiplier data is ever written to the table. Every show resolves with an empty multiplier set, which is mathematically equivalent to a flat 1× score. Card roles (`rapper`, `vocalist`, `dancer`) and company affiliation, which every idol carries, currently have no gameplay effect.

This feature makes show multipliers real: an operator seed script defines the multiplier template for each recurring show schedule, the scheduler copies those templates into each newly created show, and the scoring engine — already wired — does the rest. A one-line tie-handling fix and a player-facing label display complete the picture.

A chemistry system is also introduced as an always-on scoring layer: lineups that include multiple members of the same idol group earn a bonus that scales logarithmically with group representation, rewarding collection completeness and creating persistent strategic goals independent of any given show's multipliers.

## Clarifications

### Session 2026-06-23

- Q: How should the scoring engine evaluate a `same_group` multiplier — lineup-level homogeneity check, specific group name match, or both? → A: Both. Some show schedules use a lineup-level homogeneity bonus (all cards must share the same group); others name a specific target group (e.g., "TWICE") where only cards from that group earn the bonus regardless of lineup composition. The `applies_to_type` value `same_group` covers both sub-types, distinguished by `applies_to_value`: a named group string means "specific group match"; a sentinel value (e.g., `"any"`) means "full lineup homogeneity check".
- Q: What should the lineup page display after the deadline but before the show resolves? → A: Continue showing today's show multiplier labels until `resolution_status = 'resolved'`; only switch to the next show's labels after resolution is confirmed.
- Q: How many default multiplier categories should the seed script define per show, and who specifies the content? → A: One category per show; the planner selects sensible defaults (varied across the five shows). The operator can edit the script and re-run at any time to adjust values or add more categories.
- Q: Should the seed script insert multiplier templates for BG show schedules as well as GG? → A: GG only. No BG show schedules exist yet; BG seeding is deferred to feature 007.
- Q: Should chemistry be visible to players anywhere in the UI? → A: Live preview on the lineup page — shows current chemistry percentage per group, updating as the player builds their lineup (labels only, no formula or numeric bonus value exposed).

## User Scenarios & Testing

### User Story 1 — Operator seeds multiplier templates for recurring shows (Priority: P1)

An operator runs a one-time seed script that assigns bonus categories and values to each of the five recurring show schedules (Music Bank, Show Champion, M Countdown, Music Core, Inkigayo). From that point on, every new show created by the scheduler automatically inherits those templates. No show resolves with a flat score again.

**Why this priority**: This is the blocking gap. Without templates seeded, the scheduler cannot copy multipliers into shows and the scoring engine has nothing to apply. Every other story in this feature depends on multipliers existing.

**Independent Test**: Run the seed script against a database with seeded show schedules. Verify each schedule has at least one multiplier template associated with it. Trigger show creation (manually or by scheduler) and confirm the new show has multiplier rows.

**Acceptance Scenarios**:

1. **Given** show schedules are seeded but have no multiplier templates, **When** the operator runs the multiplier seed script, **Then** each recurring show schedule has one or more bonus categories defined (type, label, value).
2. **Given** the seed script has already been run, **When** the operator runs it again, **Then** no duplicate templates are created and the existing definitions are unchanged.
3. **Given** the seed script has been run, **When** the scheduler creates today's show from its matching schedule, **Then** the new show has multiplier rows copied from the schedule's template.
4. **Given** a show schedule with no template (e.g., a special event or a schedule added after initial seeding), **When** a show is created from it, **Then** the show is created with no multipliers and resolves normally with flat scoring — no error occurs.

---

### User Story 2 — Shows resolve with real multipliers, making card strategy meaningful (Priority: P1)

When a show resolves, the scoring engine applies the show's multipliers to each lineup. A player who fields cards matching the day's bonus categories — a lineup of rappers on a show that rewards "+Rapper", or an all-JYP team on a "++JYP" show — scores measurably higher than an equal-stat lineup with no matching cards. Card roles and company data, previously inert, now have gameplay consequence.

**Why this priority**: This is the core value of the feature. The seeding work in US1 is meaningless without resolution actually applying the multipliers.

**Independent Test**: Seed multipliers. Create two lineups with identical total stats but different card compositions (one matching the day's bonus categories, one not). Resolve the show and compare final scores — the matching lineup must score higher.

**Acceptance Scenarios**:

1. **Given** a show with a "+Rapper" multiplier, **When** the show resolves, **Then** each card in a lineup whose idol has the `rapper` role contributes more to the final score than an equal-stat card without that role.
2. **Given** a show with a company bonus (e.g., "++JYP"), **When** the show resolves, **Then** cards from the matching company score higher than equal-stat cards from other companies.
3. **Given** a show with a same-group homogeneity bonus (`applies_to_value = "any"`), **When** the show resolves, **Then** a lineup where all cards belong to the same group receives the bonus; a mixed-group lineup does not. **Given** a show with a specific-group bonus (e.g., `applies_to_value = "TWICE"`), **Then** cards from that group earn the bonus regardless of other cards in the lineup.
4. **Given** a show with multipliers and a lineup whose cards match none of the bonus categories, **When** the show resolves, **Then** that lineup scores at its base level (no penalty, no bonus) — the multipliers do not reduce scores.
5. **Given** a show whose show_multipliers set is empty (created before the seed ran, or from an unseeded schedule), **When** the show resolves, **Then** it resolves successfully with flat scoring — no error occurs.

---

### User Story 3 — Players see multiplier labels on the lineup page before the deadline (Priority: P2)

Before the daily deadline, a player building or reviewing their lineup can see the bonus category labels for that day's show (e.g., "+Rapper", "++JYP Enterprise") displayed on the lineup page. Exact multiplier values are hidden — only the category names are visible. This lets players make an informed card choice without revealing the tuning numbers.

**Why this priority**: Strategic information without numeric exposure is a core design principle from feature 001 (FR-021). It improves player experience but does not affect show resolution or scoring.

**Independent Test**: Create a show with seeded multipliers. Open the lineup page before the deadline. Confirm category labels are displayed and no numeric values are visible. After the deadline, confirm resolution is unaffected.

**Acceptance Scenarios**:

1. **Given** today's show has bonus categories defined, **When** a player opens the lineup page before the deadline, **Then** they see the label for each bonus category (e.g., "+Rapper", "++JYP").
2. **Given** today's show has bonus categories defined, **When** a player views the lineup page, **Then** numeric multiplier values are not displayed anywhere on the page.
3. **Given** today's show has no bonus categories (unseeded schedule or special event with no multipliers), **When** a player opens the lineup page, **Then** no bonus category section is shown — the page does not show an empty list or an error.
4. **Given** the show deadline has passed but the show is not yet resolved, **When** the lineup page loads, **Then** today's multiplier labels continue to be shown (not the next day's). **Given** the show has resolved (`resolution_status = 'resolved'`), **Then** the lineup page switches to displaying the next scheduled show's labels.

---

### User Story 4 — Tied scores share a rank on the leaderboard (Priority: P2)

When two or more players finish a show with identical final scores, they receive the same rank number. A player who ties for 3rd place is shown as rank 3 — not ranked 4th because someone else happened to be processed first. Reward distribution follows the shared rank, not sequential position.

**Why this priority**: This is a correctness fix. The current implementation uses sequential position as the rank, which means tied players receive different rewards based on arbitrary processing order — an unfair outcome that becomes more likely as the player base grows.

**Independent Test**: Create two show entries with identical final scores. Resolve the show. Confirm both entries have the same rank value on the leaderboard. Confirm both receive the same reward tier.

**Acceptance Scenarios**:

1. **Given** two players finish a show with identical final scores, **When** ranks are assigned, **Then** both players have the same rank number.
2. **Given** players A, B, C finish with scores 1000, 1000, 800 respectively, **When** ranks are assigned, **Then** A and B are both rank 1, and C is rank 3 (not rank 2).
3. **Given** two players share rank 1 in a 20-player show, **When** rewards are distributed, **Then** both receive the UR reward (top 10% threshold applies to their shared rank, not their array index).
4. **Given** a show where all players tie, **When** ranks are assigned, **Then** all players share rank 1 and all receive UR rewards.

---

### User Story 5 — Chemistry bonus rewards lineup group cohesion (Priority: P2)

When a show resolves, the scoring engine automatically applies a chemistry bonus to each lineup based on group representation. A player who fields two or more members of the same idol group earns a bonus that grows with each additional groupmate — but with diminishing returns, so the jump from 1 to 2 groupmates is larger than the jump from 7 to 8. Including a full group in the lineup achieves the maximum chemistry bonus for that group. This mechanic is always active, independent of that show's configured multipliers, and rewards players who collect and play complete group sets.

**Why this priority**: Chemistry enriches the collection goal (completing a group set) and adds a persistent strategic layer that applies to every show. It does not block the P1 multiplier work and can be implemented alongside it in the same scoring pass.

**Independent Test**: Build two identical-stat lineups: one with two or more cards from the same group, one with all cards from different groups. Resolve a show. The group-cohesion lineup must score higher. Build a third lineup with the full group represented and confirm it scores at the maximum chemistry bonus level.

**Acceptance Scenarios**:

1. **Given** a lineup with two cards from the same group and one card from a different group, **When** the show resolves, **Then** the lineup receives a chemistry bonus greater than a lineup with all cards from different groups.
2. **Given** a lineup with all members of a group fully represented, **When** the show resolves, **Then** the lineup receives the maximum possible chemistry bonus for that group.
3. **Given** a lineup with cards from two different groups (e.g., 2 aespa + 2 TWICE), **When** the show resolves, **Then** chemistry is computed per group and the higher of the two group bonuses is applied to the lineup score.
4. **Given** a lineup where no group has more than one card represented, **When** the show resolves, **Then** no chemistry bonus is applied — the lineup scores without any chemistry modifier.
5. **Given** a small group (e.g., 4 members) and a large group (e.g., 9 members), each fully represented in separate lineups, **When** the show resolves, **Then** both lineups receive the maximum chemistry bonus — group size does not penalise small groups or reward large ones at full representation.
6. **Given** a player is building their lineup, **When** they add or swap a card, **Then** the lineup page updates a chemistry display showing the current chemistry percentage for each group represented by two or more cards. No numeric bonus value is shown — only the group name and percentage.
7. **Given** no group has more than one card in the lineup, **When** the player views the lineup page, **Then** no chemistry display is shown (not an empty list or zero-percent display — the section is absent).

---

### Edge Cases

- **Show created before seed runs**: has no multipliers; resolves with flat scoring. This is acceptable behavior for shows already in flight. Historical show entries are not retroactively recomputed or re-ranked.
- **Special event show (no recurring schedule)**: the scheduler has no template to copy from. Multipliers must be inserted directly by the operator before the show resolves. The feature does not provide a script for this; it is out of scope.
- **Multiplier applies to a category absent from any card in the pool**: the bonus has no effect on any lineup. No error; scoring proceeds normally.
- **Seed script run after shows already created**: existing shows do not gain multipliers retroactively. Only shows created after the seed runs inherit templates.
- **Tie at the reward boundary** (e.g., 10% threshold): if players at rank K straddle the boundary, all who share that rank receive the higher tier. Rewards are never downgraded due to a tie.
- **Chemistry with a dissolved or renamed group**: if idol group metadata changes after a player's collection is built, chemistry is computed against current group data. Historical consistency is not guaranteed; this is acceptable for the current player base size.
- **Chemistry and show same_group multiplier stacking**: a lineup may earn both the per-show same_group multiplier and the chemistry bonus simultaneously. These are independent scoring layers and both apply.

## Requirements

### Functional Requirements

**Multiplier templates**

- **FR-001**: The system MUST provide an operator-runnable seed script that associates bonus category definitions with each recurring show schedule: bonus type (`role`, `company`, `same_group`), a player-visible label, and a numeric multiplier value.
- **FR-002**: The multiplier seed script MUST be idempotent — re-running it MUST NOT create duplicate template entries for schedules that already have definitions.
- **FR-003**: Multiplier numeric values MUST be defined in the seed script (operator-editable without code deployment); they MUST NOT be hardcoded constants in application logic.

**Show creation**

- **FR-004**: When the scheduler creates a show from a recurring schedule, it MUST copy that schedule's multiplier templates into the new show's multiplier set at creation time.
- **FR-005**: If a schedule has no multiplier templates, the show MUST be created without multipliers and the scheduler MUST NOT error.
- **FR-006**: Special event shows (not tied to a recurring schedule) are out of scope for automatic multiplier inheritance; their multipliers remain operator-managed via direct data entry.

**Score calculation**

- **FR-007**: When a show resolves, the scoring engine MUST apply each of the show's multipliers to lineup cards that match the bonus category (`role`, `company`, or `same_group`). For `same_group` multipliers, two sub-types exist: (a) **specific group match** — `applies_to_value` is a group name (e.g., `"TWICE"`); cards from that group earn the bonus regardless of other cards in the lineup; (b) **lineup homogeneity** — `applies_to_value` is the sentinel `"any"`; the bonus applies to every card in the lineup only if ALL cards share the same group. A mixed-group lineup earns no homogeneity bonus.
- **FR-008**: Multipliers MUST NOT reduce any card's contribution below its base stat — they are additive bonuses only; a card that does not match any category is scored at 1× (no penalty). See also FR-021 for the equivalent no-penalty guarantee on the chemistry layer.
- **FR-009**: A show with no multipliers MUST resolve successfully with flat scoring — the absence of multiplier data MUST NOT cause an error or skip resolution.

**Player-facing label display**

- **FR-010**: The lineup page MUST display the label for each of the current day's show multiplier categories. Labels remain visible after the deadline until the show's `resolution_status` changes to `'resolved'`; once resolved, the page switches to displaying the next scheduled show's labels.
- **FR-011**: Multiplier numeric values MUST NOT be exposed in any player-facing response or UI element.
- **FR-012**: When a show has no multiplier categories, the lineup page MUST display no bonus category section rather than an empty list or an error state.

**Chemistry bonus**

- **FR-016**: The scoring engine MUST compute a chemistry bonus for every lineup at show resolution time, applied after show-specific multipliers are calculated.
- **FR-017**: The chemistry bonus MUST follow these rules: (a) a lineup with exactly one card from a group receives zero chemistry from that group; (b) having two cards from the same group (first pairing) always contributes exactly 50% of the maximum chemistry bonus, regardless of group size; (c) having all members of a group always contributes 100%; (d) values between the first pairing and full representation scale logarithmically with diminishing returns, weighted by group size — so each additional card beyond the first pairing is worth more in a small group than in a large one.
- **FR-018**: When the lineup reaches full group representation (all members of a group present), it MUST receive 100% of the maximum chemistry bonus for that group, regardless of group size.
- **FR-019**: When a lineup contains cards from multiple groups, the chemistry bonus MUST be computed independently per group; only the highest per-group chemistry result is applied to the lineup's total score.
- **FR-020**: The maximum chemistry bonus value MUST be a configurable tuning parameter (stored alongside other scoring parameters), not hardcoded in application logic.
- **FR-021**: Chemistry bonus MUST be applied as a lineup-level multiplier to the total score. It MUST NOT reduce any lineup's score below its pre-chemistry total (zero bonus = neutral, 1× multiplier). See also FR-008 for the equivalent no-penalty guarantee on the show multiplier layer.
- **FR-022**: The lineup page MUST display a live chemistry preview that updates as the player adds or swaps cards. For each group with two or more cards in the current lineup, the preview MUST show the group name and current chemistry percentage. The numeric bonus value MUST NOT be shown. When no group meets the two-card threshold, the chemistry section MUST be absent (not empty).

**Rank and reward assignment**

- **FR-013**: Rank assignment MUST give players with identical final scores the same rank number (shared rank, not sequential position).
- **FR-014**: The rank following a group of tied players MUST skip by the size of the group (e.g., two players tied at rank 1 means the next distinct rank is 3).
- **FR-015**: Reward tier MUST be determined by the shared rank's percentile position, not by the player's array index during processing. Tied players at the same rank MUST receive the same reward tier.

### Key Entities

- **Multiplier template**: A bonus category associated with a recurring show schedule. Attributes: bonus type (`role` / `company` / `same_group`), player-visible label, numeric value (system-only), and `applies_to_value` (a role name, company name, group name, or `"any"` for lineup homogeneity check). Copied to a show instance when the show is created from its schedule.
- **Show multiplier**: An instance of a multiplier template attached to a specific show. Applied during score calculation. Preserves the label and value from the template at the moment the show was created.
- **Shared rank**: The rank assigned to a group of players with identical final scores. All members of the group receive the same integer rank. The next rank after the group skips accordingly.
- **Chemistry bonus**: A lineup-level scoring modifier computed at resolution time from the lineup's group representation. Ranges from 0 (no group has more than one card) to the configured maximum (at least one group is fully represented). Applied after show multipliers. Determined by the highest per-group chemistry value among all groups represented in the lineup.

## Success Criteria

### Measurable Outcomes

- **SC-001**: After the seed script runs, 100% of recurring show schedules have at least one multiplier template defined.
- **SC-002**: 100% of shows created after the seed script runs have at least one multiplier row — no show resolves with an empty multiplier set (when the schedule has been seeded).
- **SC-003**: A lineup whose cards fully match the day's bonus categories scores at least 10% higher than an identical-stat lineup with no matching cards (assuming at least one multiplier with a value ≥ 1.1×).
- **SC-004**: Players can see the current day's bonus category labels on the lineup page before the deadline, with no numeric values visible anywhere on the page.
- **SC-005**: Two players with identical final scores in the same show always receive the same rank number and the same reward tier, regardless of the order in which their entries were processed.
- **SC-006**: Re-running the multiplier seed script against a fully seeded database produces no new rows and no errors.
- **SC-007**: A lineup with full group representation scores measurably higher than an identical-stat lineup with no group cohesion, with the difference equal to the configured maximum chemistry bonus value.
- **SC-008**: A lineup with zero group cohesion (all cards from different groups) scores identically whether or not the chemistry system is active — the bonus is strictly additive with no penalty.
- **SC-009**: The lineup page chemistry preview updates immediately when a card is added or swapped, reflects the correct percentage for each qualifying group, and disappears entirely when no group has two or more cards — without requiring a page reload.

## Assumptions

- No changes to existing tables. One new table is needed to store multiplier templates per schedule (the existing `show_multipliers` table links to individual show instances, not to schedules). This new table is an additive schema change.
- The seed script ships with exactly one default bonus category per show (five total), with categories varied across the five recurring show schedules so each show has a distinct strategic identity. The planner selects sensible defaults. The operator can modify labels, values, or add more categories by editing the script and re-running (idempotent).
- Multiplier values in the seed script are not routed through `gacha_config` — they are content data specific to each show schedule, not global tuning parameters.
- The tie-handling fix applies to all shows resolved after this feature ships. Historical show entries (already resolved) are not retroactively re-ranked or re-rewarded.
- Special event shows (no recurring schedule) are out of scope; their multipliers remain a direct database insert responsibility.
- The seed script targets GG show schedules only. No BG show schedules exist in the DB yet; BG multiplier seeding is deferred to feature 007 (Boy Group Launch).
- The scoring engine's multiplier application logic is already implemented and correct; this feature provides the data it was designed to consume, not a rewrite of the logic.
- Show multiplier labels displayed to players match exactly the `label` column of the show's multiplier rows — no transformation or translation is applied.
- Chemistry bonus is a lineup-level multiplier applied once to the total lineup score, not a per-card bonus.
- When a lineup contains cards from multiple groups, the highest per-group chemistry is used. Group chemistry values do not stack or combine.
- A lineup with exactly one card from a group (no groupmates) receives zero chemistry bonus from that group. Chemistry only activates when two or more members of the same group appear together.
- The precise logarithmic formula (curve shape, intermediate values per groupmate count) is an implementation decision for the planning phase. The spec defines the behavioral constraints: diminishing returns, full group = 100% of max, zero groupmates = 0%.
- The maximum chemistry bonus value is stored in the same scoring configuration as other tuning parameters (e.g., `gacha_config`). Default value is an implementation decision for the planning phase.
