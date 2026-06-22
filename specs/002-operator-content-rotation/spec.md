# Feature Specification: Weekly Song Pool & Rotation

**Feature Branch**: `002-operator-content-rotation`

**Created**: 2026-06-21

**Status**: Draft

**Input**: User description: "Operator content and weekly rotation for the Kpopdle card game. The card game core (feature 001, US1–US5) is built but cannot run end-to-end because the operator-managed content the daily loop depends on is never populated and never rotates. This feature delivers the content pipeline and the recurring jobs that keep it fresh."

## Context

The card game core (feature `001-idol-card-game`, user stories 1–5) is built. However, the daily play loop has a hard gap: the **weekly song pool** that players must choose from to build a lineup is never populated and never refreshed. A new player reaches the lineup screen and finds no songs to pick, so the game cannot be played end-to-end.

This feature closes that gap. It establishes the current week's playable song pool, rotates it automatically each week, and keeps players' saved lineups consistent across the rotation boundary. It also confirms that the idol **role tags** consumed by gameplay are populated.

The card catalog and pull banners are intentionally **out of scope** here: per the decisions recorded in Clarifications, those are operator-managed via direct database inserts during the test phase, with a dedicated admin tool planned as a separate, later feature. This feature does not create cards, assign stats, or wire up banners.

This is an operations/content feature. The primary actor is the **operator** (the person running the game, working directly against the database — no admin UI is in scope). The downstream beneficiary is the **player**, who must always find a playable, current song pool.

## Clarifications

### Session 2026-06-21

- Q: How broad should the initial seed roster be? → A: A fixed list of 3–5 Girl Group groups, no soloist, Girl Group only. (Applies to the operator's manual card content; informs which songs the operator curates as eligible.)
- Q: How should each week's 25-song pool be chosen from eligible songs? → A: Random selection with last-week avoidance; repeats from earlier weeks are allowed, and last-week songs may be reused when there aren't enough fresh eligible songs to fill the pool. Girl Group only.
- Q: How are card stats / cards created? → A: Out of scope for this feature. The operator inserts card definitions and their stats directly into the database during the test phase; a smoother admin page is a separate future feature. This feature neither creates cards nor computes stats.
- Q: Should this feature automate banner setup? → A: No. Banners are operator-managed for now (admin page later). This feature covers only the weekly song pool, its rotation, lineup invalidation, and idol-role confirmation.
- Q: What cards populate the always-on daily banner's pool? → A: Deferred to planning. The daily free pull does not read the daily banner's card pool (it draws Rare from the global active pool), so this is an implementation/display detail, not a spec-level decision.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Operator establishes a playable weekly pool (Priority: P1)

An operator brings the game to a playable state by populating the current week's song pool from the eligible song catalog, and by confirming the idol role tags gameplay relies on are present. After this, a freshly registered player can open the lineup screen, see a full pool of songs (each with the member count that determines how many slots to fill), and build and save a valid lineup.

**Why this priority**: This is the unblock. Without a current-week song pool, the lineup screen is empty and the daily loop cannot be entered. Nothing else in the game flow can be exercised until a pool exists.

**Independent Test**: Against a database that has idols, songs (with member counts), and an operator-inserted card catalog but no weekly pool, run the pool-establishment process, then register a new player and confirm they see a full weekly pool on the lineup screen and can build and save a complete, valid lineup — with no further operator action.

**Acceptance Scenarios**:

1. **Given** a database with eligible songs but no current-week pool, **When** the operator runs the pool-establishment process, **Then** a pool for the current week (Girl Group) is created at the configured size, drawn only from eligible songs.
2. **Given** the current-week pool exists, **When** a player opens the lineup screen, **Then** the pool shows the configured number of songs, each with its member count, and the player can fill every slot and save a valid lineup.
3. **Given** the process is run a second time for the same week, **When** it completes, **Then** it does not create a duplicate pool or alter the existing one (idempotent).
4. **Given** idols that gameplay references, **When** the operator runs the role-tag confirmation step, **Then** any idol missing role tags is reported so the operator can fill the gap; idols with tags are left unchanged.

---

### User Story 2 - Weekly song pool rotates automatically (Priority: P1)

At the start of each week, the song pool players choose from is refreshed automatically so the game stays varied without operator intervention. The new week's pool is drawn from the eligible song catalog — favoring songs not used the previous week, but allowing reuse when fresh songs are scarce — and becomes the pool every Girl Group player builds lineups against for that week.

**Why this priority**: A static pool makes the game stale and breaks the "shared weekly pool" promise of the core game. Rotation is what makes the weekly loop a loop. Without it the operator must manually reseed every week or the pool never changes.

**Independent Test**: With a current-week pool in place, advance to (or simulate) the start of a new week, run rotation, and confirm a fresh pool for the new week exists at the configured size, contains only eligible songs, prefers songs not in the prior week, and is what the lineup screen now offers — while the prior week's pool record is preserved.

**Acceptance Scenarios**:

1. **Given** the eligible catalog has more than the configured pool size of unused songs, **When** the new week begins and rotation runs, **Then** a new-week pool is created at the configured size containing no songs from the immediately previous week.
2. **Given** fewer fresh (not-last-week) eligible songs exist than the configured pool size, **When** rotation runs, **Then** the pool is filled to the configured size by reusing previous-week songs as needed.
3. **Given** a pool already exists for the new week, **When** rotation runs again, **Then** it does not create a second pool or alter the existing one (idempotent).
4. **Given** a new-week pool has been created, **When** a player opens the lineup screen, **Then** they see the new week's songs, not the previous week's.
5. **Given** the total eligible catalog is smaller than the configured pool size, **When** rotation runs, **Then** it forms a pool from all eligible songs and records the under-target condition rather than failing.

---

### User Story 3 - Stale lineups are flagged after rotation (Priority: P2)

When the weekly pool rotates and a player's saved song is no longer offered, that player's lineup is flagged as needing attention so they are prompted to re-confirm before the next show deadline, rather than silently competing with an out-of-pool song.

**Why this priority**: This protects the player experience across the rotation boundary. It is P2 because the core game already surfaces an invalid-lineup state to players; this feature ensures that state is set correctly when rotation happens.

**Independent Test**: Save a lineup using a song, run a rotation that excludes that song from the new pool, and confirm the lineup is now flagged invalid; then save a new lineup with an in-pool song and confirm the flag clears.

**Acceptance Scenarios**:

1. **Given** a player has a saved lineup whose song is not in the new week's pool, **When** rotation completes, **Then** that lineup is flagged invalid.
2. **Given** a player has a saved lineup whose song is still in the new week's pool, **When** rotation completes, **Then** that lineup remains valid.
3. **Given** a lineup was flagged invalid, **When** the player saves a new lineup with an in-pool song, **Then** the lineup is valid again.

---

### Edge Cases

- **No eligible songs at all**: rotation must not crash; it must record that no pool could be formed and leave any existing pool untouched, so the game degrades to "last good pool" rather than an empty screen.
- **Rotation runs late or twice** (server was down at the boundary, or restarts): running rotation for a given week must be safe to repeat and must catch up the current week if a scheduled run was missed.
- **Player has no saved lineup at rotation**: nothing to flag; rotation completes normally.
- **Idol missing role tags**: the confirmation step reports the gap rather than guessing tags; it never writes invented role data.
- **Boy Group songs present**: BG pools may be formed for schema completeness but no BG pool may surface in any player-facing list during the GG-only launch.

## Requirements *(mandatory)*

### Functional Requirements

**Weekly pool establishment**

- **FR-001**: The system MUST provide an operator-runnable process that creates the current week's song pool for Girl Group at the configured pool size, selecting only from eligible songs (songs that have a member count set).
- **FR-002**: The weekly pool establishment MUST be idempotent for a given week — if a pool for that week already exists, it MUST be left unchanged.
- **FR-003**: The system MUST provide an operator-runnable step that confirms idol role tags are present for the idols gameplay references, reporting any idol missing role tags without inventing or overwriting tag data.
- **FR-004**: The pool establishment process MUST report a clear summary of what was created, skipped, or flagged so an operator can verify the result.

**Weekly rotation**

- **FR-005**: The system MUST automatically create a fresh song pool for the current week at the start of each week (Monday, ART), drawn from eligible songs, at the configured pool size.
- **FR-006**: Rotation MUST prefer eligible songs that were not in the immediately previous week's pool; it MUST reuse previous-week songs only as needed to reach the configured size.
- **FR-007**: Rotation MUST be idempotent for a given week — if a pool for that week already exists, rotation MUST leave it unchanged.
- **FR-008**: If the eligible catalog is smaller than the configured pool size, rotation MUST form a pool from all eligible songs and record the under-target condition rather than failing.
- **FR-009**: If no eligible songs exist, rotation MUST complete without error and MUST NOT remove or empty any existing pool.
- **FR-010**: Rotation MUST be safe to run late or repeatedly, and MUST be able to catch up the current week's pool if a scheduled run was missed.

**Lineup invalidation**

- **FR-011**: After a rotation produces a new week's pool, the system MUST flag every saved lineup whose song is not in the new pool as invalid.
- **FR-012**: Rotation MUST NOT flag lineups whose song remains in the new pool.
- **FR-013**: The system MUST allow a flagged-invalid lineup to return to valid when the player saves a lineup using an in-pool song (this behavior already exists in the core and MUST be preserved).

**Scope guard**

- **FR-014**: No song pool created by this feature for the Boy Group category may appear in any player-facing list or response during the Girl-Group-only launch.

### Key Entities *(include if feature involves data)*

- **Weekly song pool**: The set of songs offered for lineup selection in a given week for a gender category, anchored to the start of the week. Created for the current week by the establishment process and for each new week by rotation.
- **Eligible song**: A song that has a member count set, making it usable in a lineup (the member count determines required lineup slots). Eligibility curation is an operator responsibility.
- **Idol role tags**: Player-visible role labels on an idol, consumed by gameplay. Confirmed (not generated) by this feature.
- **Lineup validity state**: A flag on a player's saved lineup indicating whether its song is still in the current pool. Updated by rotation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Starting from a database that has idols, eligible songs, and an operator-inserted card catalog, an operator can make the game playable for a new Girl Group player by running the documented pool-establishment process, with no further manual pool entry required.
- **SC-002**: A player registering after pool establishment sees a weekly song pool at the configured size and can build and save a valid lineup on their first session.
- **SC-003**: Re-running pool establishment for the same week produces no duplicate pool (pool row count for the week is unchanged on the second run).
- **SC-004**: At the start of a new week, the song pool changes automatically without any operator action, and players see the new pool.
- **SC-005**: When enough fresh eligible songs exist, the new week's pool shares zero songs with the immediately previous week's pool; when fresh songs are insufficient, the pool still reaches the configured size by reusing prior songs.
- **SC-006**: 100% of saved lineups whose song leaves the pool at rotation are flagged invalid; 0% of lineups whose song remains are incorrectly flagged.
- **SC-007**: Running rotation a second time for the same week leaves the pool and lineup flags unchanged.
- **SC-008**: No Boy Group song pool created by this feature is ever returned in a player-facing response during the GG-only launch.

## Assumptions

- The database schema from feature 001 (`migrate-card-game.js`) is already applied; this feature only populates and rotates pool data, it does not change the schema.
- The base idol and song catalog from the existing Kpopdle game is present; idols already carry company and group data, and the role-tag column exists. This feature confirms role tags rather than inventing the idol roster.
- The **card catalog and banners are operator-managed via direct database inserts** during the test phase; creating cards, assigning stats, and configuring banners are out of scope here and will be served by a future admin feature.
- The launch content focus is a fixed list of 3–5 Girl Group groups (no soloist); the operator curates which of those groups' songs are eligible (have member counts) so the weekly pool draws from coherent content.
- "Eligible song" means a song with a member count set; assigning member counts and choosing eligible songs is an operator responsibility.
- The configured weekly pool size is 25 songs per gender category (per core requirement FR-022), read from configuration rather than hardcoded where practical.
- The week is anchored to Monday in Argentina time (ART), consistent with the core game's existing weekly/daily time handling.
- Girl Group only is surfaced; Boy Group pools may be formed for schema completeness but stay hidden, consistent with the core launch constraint.
- Show multiplier content and the player-facing multiplier preview are out of scope (feature 003), as are the UR-ticket annual refresh (004), cosmetics (005), and Boy Group launch (006).
