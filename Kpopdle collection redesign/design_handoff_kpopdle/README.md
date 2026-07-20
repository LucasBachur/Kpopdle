# Handoff: Kpopdle Card-Game Redesign

## Overview

A visual + interaction redesign of six Kpopdle pages plus the shared sidebar. This covers
the **card-game** section (Collection, Lineup, Banners, Shows) and the two game entry pages
(Kpopdle, Guess the Song), all sharing one collapsible sidebar.

The goal is to **re-skin the existing pages** — which already fetch real data — to match
these designs, using the app's own React components and CSS Modules. Do **not** rebuild data
fetching or routing; only replace/adjust presentation and wire the marked bindings.

---

## About the design files

The files in `designs/` are **design references, not production code**. They are HTML
prototypes (a small custom runtime — `support.js` — renders them; ignore that runtime, it is
not part of your stack). Open any `.dc.html` in a browser to see the **live layout,
interactions, and animations** — this is the ground truth for motion the prose can't fully
capture.

**Your task:** recreate these designs in the existing codebase (React 19 + React Router 7,
Vite 8, plain **CSS Modules**), reusing established per-feature component patterns. All
content shown in the prototypes (idol names, stats, banners) is **placeholder** — bind every
marked piece to its real source, listed per screen below.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, and interactions. Recreate the UI
pixel-accurately. Where the prototype uses placeholder blocks (the `PHOTO` area on cards),
those mark where real images mount — keep the surrounding treatment (border, gradient, stat
badge) exactly.

## Target environment (confirmed)

- **Framework:** React 19, React Router 7, Vite 8.
- **Styling:** CSS Modules (`ComponentName.module.css` per component). **No** shared
  token/theme file, **no** CSS-variable system today. You may introduce a small shared
  tokens file (see Design Tokens) — recommended, since these values repeat across pages.
- **No component library.** No MUI/Chakra/Radix; no shared `Button`/`Modal`/`Card`/`Input`
  primitives. Presentation is ad hoc per feature (e.g. `CardTile.jsx`, `BannerCard.jsx` own
  their full markup + styles). Building 2–3 shared primitives while doing this work is
  encouraged but optional.
- **Icons:** none installed (no Lucide/Heroicons). All icons in the designs are **inline
  SVG** — copy them straight from the prototype markup. Keep them inline or wrap in a tiny
  `<Icon>` component; do not add an icon dependency just for these.
- **Data:** pages already load real data via the card-game API. Bind to those existing
  responses; shapes below.

---

## Global design language

- **Font:** `Plus Jakarta Sans` (all UI, headings, stat numbers), weights 400–800.
  `Space Mono` (400/700) **only** for the small monospace labels — sidebar section headers
  ("GAMES", "CARD GAME") and the `PHOTO` placeholder text. Both are Google Fonts.
- **App background:** `linear-gradient(165deg, oklch(0.87 0.058 300), oklch(0.85 0.058 300))`
  — a soft lilac. Applied to the page shell behind `<main>`.
- **Accent (gold):** `#f5c43d` (with `#eaa31c` as its darker partner for gradients).
- **Surfaces:** frosted white panels — `rgba(255,255,255,.55)` fill,
  `rgba(255,255,255,.85–.9)` border, radius 12–16px, soft lilac shadow
  `0 6px 20px rgba(40,20,70,.08)`.
- **Ink:** primary text `#2a2138`, secondary `#473d59` / `#6a5f7d`.

### Rarity → border color (canonical)

Rarity is conveyed **only** by the card border — there is **no rarity badge** on cards.

| Rarity (API value) | Design shorthand | Border color        |
|--------------------|------------------|---------------------|
| `rare`             | R                | `#b3b6c4` (silver)  |
| `super_rare`       | SR               | `#eaa31c` (gold)    |
| `ultra_rare`       | UR               | `#9b5de5` (purple)  |

Card border in the prototype is `2.5px solid <color>`.

> ⚠ **Known inconsistency to resolve:** the Collection filter-pill dots currently show
> *Super Rare = purple* and *Ultra Rare = gold*, which is **swapped** relative to the card
> border mapping above. The card mapping (SR gold, UR purple) is canonical — fix the pill
> dots to match it when implementing.

> ⚠ **Rarity value mapping:** designs use `R`/`SR`/`UR`; the API returns
> `rare`/`super_rare`/`ultra_rare`. Map through a small lookup. The card also carries
> `borderStyle` (e.g. `holo_silver`) — if that is meant to drive border treatment (holo vs.
> plain), prefer it over deriving from `rarity`; otherwise derive from `rarity`. Confirm
> which is intended before wiring.

---

## Real data shapes (bind to these)

**Card** (from `GET /collection`, used in `CardTile.jsx` / `CollectionPage.jsx`):

```json
{
  "playerCardId": 482, "cardDefId": 57,
  "idolName": "Karina", "group": "aespa",
  "rarity": "super_rare", "baseStat": 91, "currentStat": 94,
  "artPath": "super_rare/57.webp", "borderStyle": "holo_silver",
  "acquiredAt": "2026-06-14T18:22:31.000Z", "groupSize": 4
}
```

- **Image src:** there is **no** `imageUrl`. Build it: `` `/cards/${card.artPath}` `` (static
  path under `frontend/public/cards/`). This is the value that fills every `PHOTO` block.
- **Stat badge:** use `currentStat` (the boosted value), not `baseStat`, unless a screen
  specifically shows base.
- **Name:** `idolName`. **Group:** `group`.

**Banner** (from `GET /banners`, via `getActiveBanners`):

```json
{
  "id": 12, "groupName": "aespa", "genderCategory": "gg",
  "startsAt": "2026-07-10T00:00:00.000Z", "endsAt": "2026-07-24T00:00:00.000Z",
  "description": "Whiplash Comeback", "subtitle": "Featuring the Whiplash era lineup",
  "freePullsRemaining": 3,
  "members": [
    { "cardDefId": 57, "idolId": 12, "idolName": "Karina",
      "group": "aespa", "artPath": "super_rare/57.webp", "rarity": "super_rare" }
  ]
}
```

- **Comeback name:** `description` (e.g. "Whiplash Comeback"). **Display subtitle:**
  `subtitle`. **Ends-in timer:** derive from `endsAt`.
- **Member card art:** `` `/cards/${member.artPath}` ``; member rarity from `member.rarity`.

> ⚠ **Gotchas flagged for you:**
> - The **permanent daily banner** has `endsAt: null` and `description: "daily"` — that
>   `description` value is a **type discriminator, not display text**. Detect
>   `description === "daily"` to render the Daily free-pull treatment; use `subtitle` for any
>   visible text. Never render an "ends in" timer when `endsAt` is null.
> - `genderCategory` here is `"gg"`/`"bg"` shorthand, but the **idols/songs tables store the
>   same concept as `"Girl Group"`/`"Boy Group"`**. If any binding touches idol/song data
>   directly instead of the card-game API, normalize the two forms or it will mismatch.

---

## Screens / Views

The `active` prop each page passes to the sidebar is noted per screen. All pages share the
lilac background and left sidebar; `<main>` sits at `margin-left: 76px` (the collapsed rail
width) with padding `40px 48px 56px`.

### 1. Sidebar — `designs/Sidebar.dc.html` (shared, on every page)

- **Layout:** fixed left, full height, dark plum `#1b1622`, `z-index: 50`. Collapsed rail
  **76px**, expanded **250px**, `width` transitions `.22s ease`. Expanded gains shadow
  `8px 0 40px rgba(20,10,40,.35)`.
- **Behavior:** collapsed by default. **Opens on mouse-enter, closes on mouse-leave.** A
  chevron button **pins** open/closed (overrides hover). Labels fade (`opacity .18s`) and
  their width collapses to `0` when closed; icons stay centered.
- **Sections:** monospace header "GAMES" → *Kpopdle* (grid icon), *Guess the Song* (music).
  Header "CARD GAME" → *Collection* (cards), *Lineup* (people), *Banners* (image), *Shows*
  (trophy). Icons are inline SVG — copy from the prototype's `paintIcons()`.
- **Active item:** text `#fff`, weight 600, background `rgba(245,196,61,.15)`, and a 3px gold
  `#f5c43d` accent bar pinned to the left edge. Inactive: text `#9890a6`, weight 500.
- **Footer:** avatar circle (gold gradient `135deg, #f5c43d → #eaa31c`, dark initial),
  username, "Log out" (collapses to a ⏻ glyph when closed).
- **Bindings:** `active` = current route (`kpopdle|song|collection|lineup|banners|shows`);
  `username` → session display name (avatar shows first initial, uppercased); each nav item
  → a router link; "Log out" → existing logout action.

### 2. Collection — `designs/Kpopdle Collection.dc.html` (`active="collection"`)

- **Header:** centered frosted pill titled "My Collection" (30px/700, ink `#2a2138`).
- **Toolbar row:** filter pills **All / Rare / Super Rare / Ultra Rare** (All = solid gold
  active state; others frosted with a colored rarity dot) → filter grid by rarity. A **sort**
  button (up/down arrows SVG, behavior TBD). Right-aligned **search field** (frosted, 280px,
  magnifier icon) → filters by `idolName`.
- **Card grid:** `grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))`, gap 22px.
  Each card is `aspect-ratio: 5/7`, radius 13px, 2.5px rarity border, striped placeholder
  fill (replace with the `/cards/${artPath}` image covering the area).
  - **Stat badge:** bottom-left, 30px dark circle, gold number → `currentStat`.
  - **Name:** hidden; **fades in on hover** over a bottom gradient scrim → `idolName`.
  - **Hover:** card scales to **1.05**, `z-index` lifts, shadow grows
    (`0 16px 34px rgba(25,10,50,.32)`), transition `.18s ease`.
- **Click a card → detail window: out of scope for now.**
- **Bindings:** card list → `GET /collection`; per card image/stat/border/name as above.

### 3. Lineup — `designs/Kpopdle Lineup.dc.html` (`active="lineup"`)

Two states: **View** (calm summary of the saved lineup) and **Edit** (builder). Reuses
`LineupCard.dc.html` for the card/slot visual (states `empty | active | filled | picker |
pickerDim`) — same card language as Collection (rarity border only, stat bottom-left, name
on hover; `PHOTO` → `/cards/${artPath}`).

> **Layout decided:** the Edit state uses the **Bottom Dock** treatment (collection grid
> above, a sticky dark loadout dock pinned to the bottom holding the slots). The other two
> candidates and the switcher have already been removed — implement the Dock as shipped.

- **Song rotation:** global weekly list, shared across all players. Each song has a slot
  count (the "p" value) that sets the lineup size. Bind song `title`, `group`, `slots`.
- **Slot count:** typically 3–12, must also handle 1–2 and up to ~30. Slots and pickers are
  **wrapping grids** so any count reflows.
- **Today's boosts:** the daily show's non-numeric bonus tags (e.g. +JYP Idols, +Maknaes,
  +Rappers, Group Synergy) plus the show name (`todayShow`). Keep visible in **both** states.
  (A separate *group chemistry* mechanic is planned — leave room, don't build.)
- **Collection picker:** the player's owned cards (`name`, `stat`, `rarity`, image).
- **Saved lineup (View):** player's stored lineup for the current song.
- **Functional rules to enforce:**
  - One idol per lineup — an already-placed idol shows dimmed / "In lineup" and is not
    pickable.
  - Choosing a new song **clears** the current lineup — **confirm dialog** before discarding.
  - Submit enabled **only when every slot is filled**.
  - A submitted lineup persists for the week but stays editable per daily show.

### 4. Banners — `designs/Kpopdle Banners.dc.html` (`active="banners"`)

Gacha screen: a **Daily** free pull + a gallery of **Event banners**. Reuses
`SummonPanel.dc.html` (art, member rate-up, pity, pull buttons, % rates trigger).

> **Treatment decided:** the summon view uses the **Inline** layout — a large centered
> `SummonPanel` card flanked by side stacks (banner list / details), rendered in-page rather
> than as a modal or docked panel. The other candidates and the switcher are already removed.

- **Currency:** single earned-only currency (no buy / "+"). Icon is a **lightstick**
  (proposal — needs sourcing, see Assets). Number formatted with separators. Bind balance.
- **Daily:** 1 free pull/day (`freePullsRemaining`). Mostly `rare`, small chance of
  `super_rare`/`ultra_rare` **drawn from the currently active event banners' pools**. Verb
  "Free Pull". States: available + cooldown (`resets in …` timer). There's always ≥1 event
  banner live, so the pool always exists. Detect via `description === "daily"` /
  `endsAt === null`.
- **Event banners** (~4–8 live). Two types:
  - **Comeback** — members `super_rare` baseline; selecting a rate-up idol boosts odds
    **and unlocks their UR version** (separate card). **Cannot pull without selecting** a
    rate-up.
  - **Special** — members `ultra_rare` baseline; rate-up only boosts odds (no new rarity).
    Pulling allowed without a selection.
  - **Banner tile art = group/comeback key art** (a group shot — distinct from individual
    card art). Individual `artPath` art appears on member cards inside the summon view.
  - Bind: `groupName`, `description` (comeback name), type, `endsAt`, `members` +
    per-member `rarity`, rate-up selection.
- **Pity:** progress bar toward a guaranteed UR. Threshold/rules **TBD**; the `47/90` shown
  is placeholder.
- **Rates:** a "%" button on each banner opens a popup with per-rarity / per-card drop rates.
  Percentages shown are **placeholder** pending tuning.

### 5. Shows — `designs/Kpopdle Shows.dc.html` (`active="shows"`)

The daily-show / leaderboard screen (trophy nav item). Follow the prototype's layout and the
global language; bind show name, boosts, and standings to their existing sources. *(No extra
spec was written for this page beyond the prototype — treat the HTML as authoritative and
ask if a binding is ambiguous.)*

### 6. Kpopdle & Guess the Song — `designs/Kpopdle.dc.html`, `designs/Kpopdle Song.dc.html`

The two "GAMES" entry pages (`active="kpopdle"` / `active="song"`). Re-skin to the shared
shell + sidebar; keep existing game logic. Treat the prototypes as authoritative for layout.

### Supporting prototype: `designs/Card Pack.dc.html`

A card-pack/opening visual used for reference. Implement only if it maps to an existing
feature; otherwise keep as reference for the card-reveal treatment.

---

## Interactions & animations (summary)

| Element | Motion |
|---|---|
| Sidebar expand/collapse | `width` + `box-shadow` `.22s ease`; labels `opacity .18s`, chevron `transform .24s cubic-bezier(.4,0,.2,1)` |
| Collection card hover | `transform: scale(1.05)` + shadow + z-lift, `.18s ease`; name scrim fades in `.18s` |
| Filter / sort / search | Instant client-side filter/sort of the loaded grid |
| Lineup slot fill | Card drops into slot; used idols dim to "In lineup" |
| Song change | Confirm dialog → clears lineup |
| Summon | Pull button → reveal (see chosen summon treatment in prototype) |
| Pity bar | Progress fill toward threshold |

Open each `.dc.html` to see the exact timing live.

## State management

- **Sidebar:** `pinned` (chevron) + `hovered` (mouse) → derived `open` state. Local.
- **Collection:** active rarity filter, sort direction, search query, hovered card. Local UI
  state over the fetched card list.
- **Lineup:** current song (sets slot count), slots array (idol per slot), edit vs. view
  mode, picker open state, dirty/confirm-discard flag, submit-enabled (all slots filled).
- **Banners:** selected banner, rate-up selection (required for Comeback), summon view
  open/result, daily cooldown timer, pity progress, rates popup open.
- Data fetching already exists — do not duplicate it; layer UI state on top.

## Design tokens

Recommend a small shared module (these repeat across every page):

```
--bg:            linear-gradient(165deg, oklch(0.87 0.058 300), oklch(0.85 0.058 300))
--gold:          #f5c43d
--gold-deep:     #eaa31c
--plum:          #1b1622   /* sidebar */
--ink:           #2a2138
--ink-2:         #473d59
--ink-3:         #6a5f7d
--surface:       rgba(255,255,255,.55)
--surface-brd:   rgba(255,255,255,.85)
--surface-shadow:0 6px 20px rgba(40,20,70,.08)

rarity.rare:        #b3b6c4   (silver)
rarity.super_rare:  #eaa31c   (gold)
rarity.ultra_rare:  #9b5de5   (purple)

radius: pill 999px · card 13px · panel 16px · control 11–12px
type:   Plus Jakarta Sans (400–800) · Space Mono (400/700, mono labels only)
```

## Assets (need sourcing)

- **Card art:** `frontend/public/cards/<rarity>/<cardDefId>.webp` — served via
  `/cards/${artPath}`. (Existing pipeline — no action unless art is missing.)
- **Lightstick currency icon:** proposed, **not yet created**. Source or commission an SVG.
- **Banner key art:** group-shot images per banner, **distinct from individual card art** —
  needs a source/field (not present in the current banner payload; add one or map to existing
  group imagery).
- **All UI icons** (nav, sort, search, chevron): inline SVG already in the prototypes — copy
  directly, no dependency needed.

## Files

In `designs/` (open in a browser for live layout + motion):

- `Sidebar.dc.html` — shared sidebar
- `Kpopdle Collection.dc.html`
- `Kpopdle Lineup.dc.html` (+ `LineupCard.dc.html`)
- `Kpopdle Banners.dc.html` (+ `SummonPanel.dc.html`)
- `Kpopdle Shows.dc.html`
- `Kpopdle.dc.html`, `Kpopdle Song.dc.html`
- `Card Pack.dc.html` — reference
- `support.js` — prototype runtime (**not** part of your stack; do not port)

`HANDOFF.md` (repo root of this bundle) — the original design spec these notes expand on.

## Suggested implementation order

1. **Sidebar** (shared — unblocks every page; establishes tokens + nav).
2. **Collection** (self-contained; exercises card + rarity + filter patterns reused later).
3. **Lineup** (reuses card language; decide the Edit layout first).
4. **Banners** (most logic; decide the summon treatment first; needs lightstick + key art).
5. **Shows**, then **Kpopdle** / **Guess the Song** entry pages.
