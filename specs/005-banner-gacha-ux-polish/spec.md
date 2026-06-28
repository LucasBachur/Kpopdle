# Feature Specification: Banner & Gacha UX Polish

**Feature Branch**: `005-banner-gacha-ux-polish`

**Created**: 2026-06-26

**Status**: Draft

**Input**: User description: "Feature 005"

**Context**: Completes gacha specification items (FR-036–039 from Feature 001) and UX details deferred from Feature 001. All five scope items are defined in ROADMAP.md under Feature 005.

## Clarifications

### Session 2026-06-26

- Q: How should concurrent/rapid free pull claims be handled? → A: DB transaction + row-level lock on the grant record (one claim processes at a time per player-banner pair).
- Q: What update interval should the banner countdown timer use? → A: Every 60 seconds (minute-level precision).
- Q: What constitutes a "valid lineup" for the auto-entry status card? → A: Use the same validity check as the existing auto-entry gate — if the system would auto-enter the lineup, the card shows.
- Q: Should the pull UI show any indicator of the auto-selected Rate Up idol on a soloist banner? → A: No. The banner itself already communicates which idol is featured. Rate Up (SR idol becomes UR-eligible, elevated drop weight) is silently auto-applied; no additional pull-UI indicator is needed.
- Q: Why does the Banner Free Pull Grant record carry a gender category if banners are already gender-scoped? → A: Denormalized convenience field — derived from the banner's gender scope, stored redundantly to simplify queries (e.g., fetch all GG grants for a player without joining banners).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Banner Free Pull Flow (Priority: P1)

A player opening a banner that has free pulls available sees only a "Claim X Free Pulls" button — no paid pull options are visible until every free pull is exhausted. They claim up to 10 at a time. Once all free pulls are gone, only the standard paid pull buttons appear.

**Why this priority**: Free pull grants are the primary mechanism operators use to incentivize banner engagement and reward players. Showing paid options alongside free pulls undermines the intended player experience and could be perceived as predatory. This closes an open gap in the shipped gacha system (FR-036–038).

**Independent Test**: Can be fully tested by granting a player banner-specific free pulls via an operator action, opening that banner, verifying only the "Claim X Free Pulls" button (X ≤ 10) is visible, claiming, repeating until exhausted, and then verifying paid pull buttons appear.

**Acceptance Scenarios**:

1. **Given** a player has 15 free pulls remaining on a banner, **When** they open that banner, **Then** the UI shows "Claim 10 Free Pulls" and no paid pull buttons are visible.
2. **Given** a player has 3 free pulls remaining on a banner, **When** they open that banner, **Then** the UI shows "Claim 3 Free Pulls" and no paid pull buttons are visible.
3. **Given** a player has 0 free pulls remaining on a banner, **When** they open that banner, **Then** the UI shows "Pull ×1" (1💎) and "Pull ×10" (9💎) and no free-pull button is visible.
4. **Given** a player claims 10 free pulls (batch) and has more remaining, **When** the claim completes, **Then** the remaining count is decremented by 10 and the "Claim X Free Pulls" button updates to reflect the new count.
5. **Given** a player claims their last free pulls (e.g., 3 remaining), **When** the claim completes, **Then** the free-pull button disappears and the paid pull buttons appear in its place.

---

### User Story 2 - Banner Discovery (Priority: P2)

A player browsing the Banners page sees, for each banner: a description subtitle (e.g., event name or featured group context) and, for time-limited banners, a live countdown to the banner's end date. Permanent banners (the daily banner) show neither countdown nor expiry text.

**Why this priority**: Players currently cannot tell how long a banner lasts or what event it belongs to without clicking through. Countdown and description improve discovery and urgency without requiring a new feature surface.

**Independent Test**: Can be tested by verifying that a time-limited banner shows a countdown updating in real time, a description subtitle matches the value set by the operator, and a permanent banner shows neither countdown nor expiry text.

**Acceptance Scenarios**:

1. **Given** a time-limited banner with an end date 2 days away, **When** a player views the Banners page, **Then** they see a countdown (e.g., "Ends in 2d 4h 37m") adjacent to that banner's entry.
2. **Given** a banner has a description set by the operator, **When** a player views the Banners page, **Then** the description subtitle appears below the banner's title.
3. **Given** a permanent banner (the daily banner), **When** a player views the Banners page, **Then** no countdown or expiry indicator is shown for that banner.
4. **Given** a banner's end date has passed, **When** a player views the Banners page, **Then** the expired banner is no longer listed (or is clearly marked unavailable — consistent with existing behavior for expired banners).

---

### User Story 3 - Soloist Banner Rate-Up Skip (Priority: P2)

When a player opens a banner that features exactly one idol per rarity tier (a soloist banner), the Rate Up selection step is not shown. That idol automatically receives the elevated drop rate, and the player proceeds directly to the pull UI.

**Why this priority**: Asking a player to "select a Rate Up" when there is only one option is unnecessary friction. This gap was identified in Feature 001 (FR-014) and deferred. Fixing it makes soloist banners feel complete.

**Independent Test**: Can be tested by creating a single-member banner (one idol per rarity), opening it as a player, and verifying the Rate Up selection screen is absent and pulls proceed with the correct elevated rate applied.

**Acceptance Scenarios**:

1. **Given** a banner with a single idol across all rarity tiers, **When** a player opens it, **Then** the Rate Up selection step is skipped and the pull UI is shown directly.
2. **Given** a soloist banner, **When** the player performs a pull, **Then** the single idol receives the same elevated drop rate that a player-selected Rate Up would produce on a multi-member banner.
3. **Given** a multi-member banner with multiple rate-up options, **When** a player opens it, **Then** the Rate Up selection step is shown as normal (no regression).

---

### User Story 4 - Show Result Auto-Entry Confirmation (Priority: P2)

After the daily show resolves, a player who has a saved valid lineup for the current day sees a clear status card on the show result page confirming "Your lineup will auto-enter today's show." This tells players they are already entered and need no further action.

**Why this priority**: Players frequently wonder whether their lineup is registered for the day. A visible confirmation on the result page eliminates that uncertainty and reduces the support burden, while encouraging continued passive participation.

**Independent Test**: Can be tested by saving a valid lineup, viewing the show result page, and verifying the auto-entry status card is present; then clearing the lineup and verifying the status card does not appear.

**Acceptance Scenarios**:

1. **Given** a player has a saved valid lineup for the current gender category, **When** they view today's show result page, **Then** a status card is shown: "Your lineup is registered for today's show" (or equivalent confirming auto-entry).
2. **Given** a player has no saved lineup, **When** they view today's show result page, **Then** no auto-entry status card is shown (they see the standard prompts to build a lineup).
3. **Given** a player has a saved lineup that is invalid (e.g., a card in the lineup is no longer in their collection), **When** they view today's show result page, **Then** the status card is not shown, and instead they see a prompt to fix their lineup.
4. **Given** a player views yesterday's show result, **When** they look at the page, **Then** the auto-entry status refers to the current day, not the result's date (the card is forward-looking).

---

### User Story 5 - Daily Banner Card Pool Configuration (Priority: P3)

An operator can explicitly define which cards the always-on daily banner can pull from. Players pulling on the daily banner receive cards from this defined pool. The pool can be updated without restarting the application.

**Why this priority**: Currently the daily banner lacks a formal defined card pool. Without it, the pull source is undefined. This is a configuration task that enables operators to curate what daily pulls return, tying it directly into the existing `banner_cards` linkage.

**Independent Test**: Can be tested by an operator populating the daily banner's card pool with a specific subset of cards, a player claiming a daily pull, and verifying the received card is from within that pool.

**Acceptance Scenarios**:

1. **Given** the daily banner has an explicit card pool configured, **When** a player claims a daily free pull, **Then** the pulled card belongs to one of the cards in the configured pool.
2. **Given** the daily banner's card pool is updated by an operator, **When** the next daily pull occurs, **Then** it draws from the updated pool without any application restart.
3. **Given** a player pulls on a time-limited banner, **When** the card is resolved, **Then** it draws from that banner's own card pool, not the daily banner pool (no cross-contamination).

---

### Edge Cases

- What happens when a player has free pulls remaining on a banner that expires? Any unspent free pulls are voided when the banner expires; the player cannot claim them after expiry.
- What if a banner's card pool is empty (no cards configured)? The system should prevent pulls from completing and log an operator-actionable error; no currency or free pulls are consumed.
- What if a player simultaneously has free pulls on multiple banners? Each banner tracks its own free pull count independently; the "Claim X Free Pulls" button is per-banner.
- What happens when the Rate Up idol on a soloist banner is out of stock (no cards defined for that idol)? The system should fall back to non-rate-up behavior and not error; operators should be notified.
- What if the show result page is viewed before today's show has resolved? The auto-entry status card should still be shown if the player has a valid lineup, regardless of whether today's show has resolved.

## Requirements *(mandatory)*

### Functional Requirements

**Banner Free Pulls**

- **FR-001**: System MUST track banner-specific free pull grants per player per banner in a dedicated record store. The grant count is set by the operator at banner creation or via an update.
- **FR-002**: When a player has one or more free pulls remaining on a banner, the banner pull UI MUST display only a "Claim X Free Pulls" button, where X equals the lesser of the player's remaining free pull count and 10. Paid pull buttons MUST NOT be visible.
- **FR-003**: When a player has zero free pulls remaining on a banner, the banner pull UI MUST display only the paid pull buttons: single pull (1💎) and ten-pull (9💎, one pull free). The free-pull button MUST NOT be visible.
- **FR-004**: A free pull claim MUST deduct exactly min(remaining, 10) pulls from the player's grant for that banner and return that many cards resolved against the banner's card pool. The deduction MUST execute within a database transaction with a row-level lock on the grant record, ensuring only one claim can process at a time per player-banner pair.
- **FR-005**: Free pull grants are banner-scoped and gender-category-scoped. Grants on one banner have no effect on another banner's grant count.

**Banner Discovery**

- **FR-006**: The Banners page MUST display a description subtitle for each banner, sourced from an operator-configurable field on the banner record. The field MAY be empty, in which case no subtitle is shown.
- **FR-007**: For time-limited banners (those with an explicit end date), the Banners page MUST display a countdown timer showing how much time remains until the banner expires, refreshed every 60 seconds without a page reload.
- **FR-008**: For permanent banners (those with no end date), the Banners page MUST NOT display any countdown or expiry indicator.

**Soloist Banner UX**

- **FR-009**: System MUST detect when a banner has exactly one Rate Up candidate per rarity tier across its entire card pool.
- **FR-010**: For a soloist banner (as defined in FR-009), the Rate Up selection screen MUST be skipped entirely. The system MUST automatically treat that single idol as the selected Rate Up when resolving pulls (SR idol becomes UR-eligible; elevated drop weight applied). No additional indicator is shown on the pull UI — the banner itself communicates which idol is featured.
- **FR-011**: For multi-member banners, the Rate Up selection flow MUST remain unchanged.

**Show Result Auto-Entry Confirmation**

- **FR-012**: The show result page MUST display a status card when the viewing player has a saved valid lineup for the current day's show in the same gender category. The status card MUST communicate that their lineup is registered for today's show.
- **FR-013**: The status card MUST NOT appear when the player has no saved lineup or when their saved lineup is invalid. A lineup is considered valid for this purpose if and only if it passes the same validity check used by the existing auto-entry gate (i.e., the system would auto-enter it).
- **FR-014**: The status card is forward-looking: it reflects whether the player is currently set for today's show, regardless of which past show result is being viewed.

**Daily Banner Card Pool**

- **FR-015**: The always-on daily banner MUST draw its pulls from an explicitly configured card pool stored in the same banner card pool mechanism used by time-limited banners.
- **FR-016**: The daily banner's card pool MUST be configurable by an operator without application code changes or restarts.
- **FR-017**: Pulls from the daily banner MUST only resolve against cards in the daily banner's configured pool, not against all cards in the system.

### Key Entities

- **Banner Free Pull Grant**: A player-scoped, banner-scoped record of how many free pulls the player has remaining on a specific banner. Attributes: player, banner, gender category (denormalized from the banner's own gender scope for query convenience — no join to banners needed to filter by gender), remaining pull count.
- **Banner**: Extended with an optional description/subtitle field. The end-date field already exists; the countdown is derived from it at display time.
- **Banner Card Pool**: The set of cards a banner can pull from. Already exists (`banner_cards`); this feature ensures the daily banner has a populated pool like any other banner.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player with banner-specific free pulls can claim all of them without ever seeing a paid pull button until the free pulls are fully exhausted.
- **SC-002**: Operators can grant banner-specific free pulls to players (or player segments) and update the daily banner's card pool without touching application code.
- **SC-003**: A player opening a soloist banner reaches the pull UI in one fewer step than a multi-member banner (Rate Up selection is absent).
- **SC-004**: The banner countdown on a time-limited banner updates without requiring a page refresh, and remains absent on permanent banners.
- **SC-005**: A player who has a valid saved lineup and visits the show result page sees the auto-entry confirmation status card 100% of the time; a player without a valid lineup never sees it.
- **SC-006**: Daily pulls return cards from within the configured daily banner card pool 100% of the time.

## Assumptions

- The `banner_free_pulls` tracking is new. Existing players who have never had free pull grants on a banner start with zero; no retroactive grant logic is required.
- Banner description/subtitle is a nullable text field added to the existing banner record. An empty or null description means no subtitle is shown; no fallback text is generated.
- The countdown timer on the Banners page is rendered client-side using the banner's existing `ends_at` timestamp. Server-side countdown computation is not required.
- "Soloist banner" means exactly one Rate Up candidate per rarity tier in the banner's card pool. If a banner has one member for SR but multiple for UR, it is not considered a soloist banner for any tier.
- The auto-entry status card is read-only informational UI; it does not replace any existing lineup management flow. Players can still navigate to the lineup page to make changes.
- The daily banner already exists in the database as a permanent banner record. This feature adds cards to its `banner_cards` pool; no new banner record is created.
- Operator tooling for granting free pulls and managing the daily banner card pool is via the existing direct database management approach (no admin UI, consistent with Features 001–004).
- Boy Group daily banner pool and BG-scoped free pull grants follow identical mechanics but remain inactive while `gg_only_mode` is enabled (Feature 004).
