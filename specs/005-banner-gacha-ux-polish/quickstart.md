# Quickstart & Validation Guide: Banner & Gacha UX Polish

## Prerequisites

- App running locally: `node backend/server.js` + `cd frontend && npm run dev`
- A player account with JWT (login via `/card-game/login`)
- `psql` access to the local database
- At least one active GG banner (non-daily) with `banner_cards` populated and `members` available
- `gg_only_mode` enabled (default for GG testing)

---

## Scenario A — Banner Free Pull UI Exclusivity (FR-001 to FR-005)

### Setup

```sql
-- Grant 15 free pulls to player <player_id> on banner <banner_id>
INSERT INTO banner_free_pulls (user_id, banner_id, free_pulls_remaining)
VALUES (<player_id>, <banner_id>, 15)
ON CONFLICT (user_id, banner_id)
DO UPDATE SET free_pulls_remaining = 15;
```

### Validate

1. Open `/card-game/banners` in the browser as that player.
2. **Verify**: The banner shows **"Claim 10 Free Pulls"** only. No paid pull buttons visible.
3. **Verify**: The remaining count hint shows `(5 remaining)` next to the button.
4. Click "Claim 10 Free Pulls". After the modal closes:
   - **Verify**: Button now shows "Claim 5 Free Pulls". Still no paid buttons.
5. Click "Claim 5 Free Pulls". After the modal closes:
   - **Verify**: Free-pull button disappears. "Pull ×10 (9 💎)" and "Pull ×1 (1 💎)" appear.

### Concurrent claim lock (FR-004)

```sql
-- Manually set remaining to 10
UPDATE banner_free_pulls SET free_pulls_remaining = 10 WHERE user_id=<player_id> AND banner_id=<banner_id>;
```

Fire two simultaneous `POST /card-game/banners/<banner_id>/pull` requests from two browser tabs (count=10 each). After both complete:

```sql
SELECT free_pulls_remaining FROM banner_free_pulls WHERE user_id=<player_id> AND banner_id=<banner_id>;
```

**Expected**: `free_pulls_remaining = 0` (not negative). Only 10 total free cards dispensed.

---

## Scenario B — Banner Subtitle & Live Countdown (FR-006 to FR-008)

### Setup

```sql
-- Set subtitle on a time-limited banner
UPDATE banners SET subtitle = 'Summer Comeback Event' WHERE id = <banner_id>;
```

### Validate

1. Reload `/card-game/banners`.
2. **Verify**: The banner displays "Summer Comeback Event" as a subtitle below the banner title.
3. For a time-limited banner (with `ends_at` set):
   - **Verify**: A countdown label appears (e.g., "Ends in 2d 4h 37m").
   - Wait 60 seconds without reloading the page.
   - **Verify**: The countdown label updates (decrements by ~1 minute).
4. For the daily banner:
   - **Verify**: No countdown or expiry indicator is shown (`endsAt` is null).
5. Set `subtitle = NULL` on the banner:
   ```sql
   UPDATE banners SET subtitle = NULL WHERE id = <banner_id>;
   ```
   Reload page. **Verify**: No subtitle appears for that banner.

---

## Scenario C — Soloist Banner Rate-Up Skip (FR-009 to FR-011) — Verify Only

### Setup

Create a banner with exactly one idol across all rarity tiers. This may require creating a test banner and adding only one idol's cards to `banner_cards`. If a test banner is unavailable, confirm the existing `BannerCard.jsx` behavior by inspecting a banner that has a single idol.

### Validate

1. Open `/card-game/banners`. Navigate to a single-idol banner.
2. **Verify**: No "Rate Up" dropdown is visible.
3. Click "Pull ×1" (or "Claim X Free Pulls" if applicable) without selecting a Rate Up idol.
4. **Verify**: The pull completes successfully and the modal shows the pulled card.
5. Switch to a multi-idol banner.
6. **Verify**: "Rate Up" dropdown is present and a pull with no selection selected is disabled (existing behavior, no regression).

---

## Scenario D — Show Result Auto-Entry Status Card (FR-012 to FR-014)

### Setup

```sql
-- Ensure player has a valid lineup for 'gg'
-- (This should exist if the player has used the Lineup page)
SELECT id, is_valid FROM lineups WHERE user_id = <player_id> AND gender_category = 'gg';
-- If is_valid = FALSE, set it back for testing:
UPDATE lineups SET is_valid = TRUE WHERE user_id = <player_id> AND gender_category = 'gg';
```

### Validate

1. Navigate to any show result page (e.g., `/card-game/show-result/<show_id>`).
2. **Verify (valid lineup)**: A status card reads "Your lineup is registered for today's show" (or equivalent). It is present regardless of which historical show is being viewed (forward-looking).
3. Invalidate the lineup:
   ```sql
   UPDATE lineups SET is_valid = FALSE WHERE user_id = <player_id> AND gender_category = 'gg';
   ```
   Reload the page.
4. **Verify (invalid lineup)**: The status card is absent.
5. Delete the lineup entirely:
   ```sql
   DELETE FROM lineups WHERE user_id = <player_id> AND gender_category = 'gg';
   ```
   Reload.
6. **Verify (no lineup)**: The status card is absent.

---

## Scenario E — Daily Banner Card Pool (FR-015 to FR-017)

### Setup

```sql
-- Find the GG daily banner id
SELECT id FROM banners WHERE gender_category = 'gg' AND description = 'daily';
-- Result: <daily_banner_id>

-- Add 2–3 specific cards to the daily banner pool
INSERT INTO banner_cards (banner_id, card_def_id) VALUES
  (<daily_banner_id>, <card_def_id_1>),
  (<daily_banner_id>, <card_def_id_2>);
```

Make note of `<card_def_id_1>` and `<card_def_id_2>`.

### Validate

1. As a player whose `last_daily_pull_gg` is not today, click the daily pull button on `/card-game/banners`.
2. **Verify**: The modal appears and a card is pulled.
3. Check the player's most recently added card:
   ```sql
   SELECT pc.card_def_id FROM player_cards pc WHERE pc.user_id = <player_id> ORDER BY pc.acquired_at DESC LIMIT 1;
   ```
   **Verify**: The returned `card_def_id` is one of `<card_def_id_1>` or `<card_def_id_2>`.
4. Add a new card to the pool without restarting the server:
   ```sql
   INSERT INTO banner_cards (banner_id, card_def_id) VALUES (<daily_banner_id>, <card_def_id_3>);
   ```
   Reset the daily pull cooldown:
   ```sql
   UPDATE users SET last_daily_pull_gg = NULL WHERE id = <player_id>;
   ```
   Claim again. **Verify**: The pulled card is from `{card_def_id_1, card_def_id_2, card_def_id_3}` (pool updated without restart).
5. Remove all cards from the daily banner pool:
   ```sql
   DELETE FROM banner_cards WHERE banner_id = <daily_banner_id>;
   ```
   Reset cooldown and attempt a daily pull. **Verify**: The pull fails gracefully with an error response; no card is added to the player's collection, and the daily pull entitlement is not consumed (player can retry after pool is reconfigured).

---

## Cross-contamination check (FR-003 / FR-017)

After Scenario E, pull on a time-limited event banner.
- **Verify**: Cards received are from the event banner's own pool, not the daily banner's pool.
