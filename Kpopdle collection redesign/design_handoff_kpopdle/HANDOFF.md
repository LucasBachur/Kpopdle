# Kpopdle — Design Handoff Notes

These designs are a **visual + interaction spec**. All content shown is **placeholder** —
do **not** hardcode it. When implementing, re-skin the existing pages (which already fetch
real data) rather than rebuilding from scratch, and bind the marked pieces to their real
sources. Keep all layout, colors, spacing, typography, and interaction behavior as designed.

---

## Global

- **Font:** Plus Jakarta Sans (UI, headings, stat numbers). Space Mono only for the small
  monospace labels ("GAMES", "CARD GAME") and the `PHOTO` placeholder text.
- **Background:** `linear-gradient(165deg, oklch(0.87 0.058 300), oklch(0.85 0.058 300))`
- **Accent (gold):** `#f5c43d`
- **Rarity → border color:** R → `#b3b6c4` (silver) · SR → `#eaa31c` (gold) · UR → `#9b5de5` (purple).
  Rarity is conveyed **only** by the card border. No rarity badge on cards.

## Sidebar (`Sidebar.dc.html` — shared, used on every page)

- Reused on all pages. Each page mounts it with an `active` prop = its own route
  (`kpopdle` | `song` | `collection` | `lineup` | `banners` | `leaderboard`).
- Collapses to an icon rail by default; opens on hover (mouse-enter) and closes on
  mouse-leave; chevron button pins open/closed.
- **Bindings:**
  - `username` → session user's display name (avatar circle shows first initial).
  - avatar → session user avatar (currently the initial letter on a gold circle).
  - nav item active state → current route.
  - "Log out" → existing logout action.

## Collection page (`Kpopdle Collection.dc.html`)

- **Card grid** — `PHOTO` block is where the real card image goes. Bindings per card:
  - image → `idol.imageUrl` (fills the `PHOTO` area).
  - stat circle (bottom-left) → `idol.stat`.
  - border color → derived from `idol.rarity` (see rarity map above).
  - name (revealed on hover) → `idol.name`.
  - hover grows the card ~5%; clicking a card opens a detail window (**out of scope for now**).
- **Filter pills** (All / Rare / Super Rare / Ultra Rare) → filter the grid by rarity.
- **Sort button** (up/down arrows) → sort control (behavior TBD).
- **Search field** → filters the grid by idol name.
- Card list, names, stats, rarities shown are all placeholder data.

---

## Lineup page (`Kpopdle Lineup.dc.html`)

Two states: **View** (calm summary of the saved lineup) and **Edit** (builder).
**Decided:** the Edit state uses the **Bottom Dock** layout (collection grid with a sticky
dark loadout dock holding the slots). The other candidates and the switcher have been
removed — this file ships the final layout.

Reusable card/slot visual: **`LineupCard.dc.html`** (states: `empty`, `active`, `filled`,
`picker`, `pickerDim`) — same card language as Collection (rarity border only, stat
bottom-left, name on hover). `PHOTO` block → `idol.imageUrl`.

- **Song rotation** → global weekly list (shared across all players). Each song has a
  slot count (the "p" value); selecting a song sets the lineup size.
  Binding: song `title`, `group`, `slots`.
- **Slot count** ranges ~3–12 (must also function for 1–2 and up to ~30). Slots/pickers
  are wrapping grids so any count reflows.
- **Today's boosts** → the daily show's non-numeric bonus tags (e.g. +JYP Idols, +Maknaes,
  +Rappers, Group Synergy) + the show name (`todayShow`). These change per daily show and
  are the reason a lineup is re-edited; keep them visible in both states. (A separate
  *group chemistry* mechanic is planned — leave room, don't build.)
- **Collection picker** → the player's owned cards; bind `name`, `stat`, `rarity`, image.
- **Saved lineup** (View state) → the player's stored lineup for the current song.

Functional rules to enforce in implementation (represented lightly in the design):
  - One idol per lineup — an idol already placed is shown dimmed/"In lineup" and not pickable.
  - Choosing a new song **clears** the current lineup (confirm dialog before discarding).
  - Submit is enabled only when every slot is filled.
  - A submitted lineup persists for the week but stays editable per daily show.

## Banners page (`Kpopdle Banners.dc.html`)

Gacha screen: a **Daily** free pull + a gallery of **Event banners**. **Decided:** the
summon view uses the **Inline** treatment (a large centered `SummonPanel` card flanked by
side stacks, in-page). The other candidates and the switcher have been removed.

Reusable **`SummonPanel.dc.html`** renders the summon UI (art, members rate-up, pity,
pull buttons, % rates trigger) — shared by all three treatments.

- **Currency** → single earned-only currency (no buy/"+"). Icon is a **lightstick**
  (proposal); number formatted with separators. Bind balance.
- **Daily** → 1 free pull/day. Mostly R, small chance of SR/UR **drawn from the currently
  active event banners' pools** (not a general pool). Verb "Free Pull". Has available +
  cooldown states (`resets in …` timer). There's always ≥1 event banner live so the pool
  always exists.
- **Event banners** (always ~4–8 live: weekly new + prior week + rerun + daily + occasional
  idol-birthday one-day banner). Two types:
  - **Comeback** — members are **SR** baseline; selecting a rate-up idol boosts their odds
    **and unlocks their UR version** (a separate card in DB + collection). **Cannot pull
    without selecting** a rate-up.
  - **Special** — members are **UR** baseline; rate-up only boosts odds (no new rarity).
    Pulling allowed without a selection.
  - Banner tile art = **group/comeback key art** (a group shot, distinct from individual
    card art). Individual card art appears on the member cards inside the summon view.
  - Bind: `group`, `comeback` (the comeback's name — "Next Level" etc.), type, `endsIn`,
    member list + per-member rarity, rate-up selection.
- **Pity** → progress bar toward a guaranteed UR. Threshold/rules **TBD** — numbers shown
  (47/90) are placeholder.
- **Rates** → "%" button on each banner opens a popup with per-rarity / per-card drop
  rates. Percentages shown are placeholder pending final tuning.

_Add a new section here for each page as it's designed._
