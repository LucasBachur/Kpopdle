# Quickstart & Validation Guide: UI Revamp & Animations

Use this for tomorrow's finalization pass. Emphasis is on the pages that got **less** live
scrutiny during build (Collection, Lineup, Shows, entry games) — the Banners/summon flow was
already heavily iterated.

## Prerequisites

- Backend running with the latest code: `node backend/server.js` (⚠ plain node has no
  auto-reload — a **restart is required** for the `artPath` + `/pity` changes).
- Frontend: `cd frontend && npm run dev`.
- A logged-in player (`/card-game/login`) with some collection, a saved lineup, currency,
  and ideally ≥1 resolved show in history.
- A modern browser (summon reveal uses `overflow-clip-margin`).

---

## Scenario A — Sidebar & shell (all pages)

1. Collapsed 76px rail; hover expands to 250px; chevron pins open/closed.
2. Current route shows gold active state; hovering another item shows a **white box** (no blue
   text). Avatar initial + username + Log out in the footer.
3. `<main>` content is offset by the rail on every page; lilac background throughout.

## Scenario B — Collection

1. Filter pills filter instantly; clicking the **active** pill clears back to All.
2. Search matches **idol name OR group** (e.g. "aespa"); sort toggles by stat.
3. Cards: rarity **border only** (SR gold / UR purple), stat badge, name on hover, hover grow.
4. Click a card → detail modal; duplicate conversion (+1 / → Currency / → Cosmetic) still works.

## Scenario C — Lineup

1. **View**: saved lineup as ranked cards; today's boosts + show name; Edit button.
   (No lineup yet → empty state + Build.)
2. **Edit**: song dropdown (weekly rotation); tap collection cards to fill slots; a used idol
   dims to "In lineup". Switching song with progress → **confirm dialog** clears the lineup.
3. Submit enabled only when every slot is filled; save returns to View with the saved lineup.

## Scenario D — Banners & summon (spot-check)

1. Daily bar: reset countdown + Free Pull (disabled once claimed). Currency lightstick shows.
2. Select a banner from a side stack → center panel updates; member cards show **real art**.
3. Comeback requires a rate-up to pull; Special does not. Pity bar shows real `count/threshold`
   and moves after a pull.
4. Pull (×1/×10): cinematic plays → cards **fly out of the pack** → settle → flip. Rare/SR have
   a static glow, **UR pulses**; hover scales + glows. **No horizontal or flickering scrollbar.**
   Reveal-card fronts show **real art** (rares/SR/UR; UR-Nayeon is a known PHOTO placeholder).

## Scenario E — Shows

1. **Live / pending**: pre-show hero — show name, deadline countdown, tonight's boosts,
   "lineup locked in" (or "not entered"). Right rail shows your lineup mini-cards.
2. **Live / resolved**: winner + podium + full ranking. On first view the scores **count up
   unevenly and land on the real final scores** ("TALLYING LIVE"), then a **Replay** button.
   Revisiting shows finals instantly.
3. **Archive**: past-show rows (real history) → detail with podium + top 10 + your row.
4. `/card-game/show-result/:showId` (auto-entry result page) renders in the new theme.

## Scenario F — Kpopdle & Guess the Song

1. Header: centered title + mode selector top-right; **on touch, first tap expands** the mode
   cards, second selects. On narrow widths the header stacks (no overlap).
2. Guess input is dark with a rich suggestion dropdown (avatar/icon, name, group, GG/BG tag).
3. **Kpopdle**: green/red guess grid; age cell shows ▲/▼; "All" mode adds a Group Type column;
   win banner on solve.
4. **Guess the Song**: audio player (play/pause, seek, time, volume); each wrong guess reveals
   more of the clip; correct/incorrect rows.
5. Stats modal (📊 / bar icon): **Played · Avg Guesses · Current · Max**, real distribution,
   next-reset countdown. (No "win rate" — the games have no loss.)

## Scenario G — Responsive spot-check

- Narrow the window (~600px): no horizontal page scrollbar anywhere; grids reflow; Lineup
  view stacks to one column and the edit dock wraps; game headers stack.

---

## Sign-off

- [ ] Scenarios A–G pass with real data; no console/build errors.
- [ ] Deferred items (key art, UR-Nayeon art, mobile drawer) confirmed as content/later-pass,
      not blocking bugs.
- [ ] Update `spec.md` **Status** and ROADMAP Feature 009 to **Done**.
