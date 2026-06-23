# PoE2 Item Scorer

A transparent overlay that scores a Path of Exile 2 item `[ X / Y ]` by how close
its affixes are to the **best possible** they could be on that base at that item
level.

- **Y** = sum of each affix's ceiling — its best rollable tier at this item's ilvl,
  at max roll. Every matched affix is worth up to **100 points**.
- **X** = the reality — each affix's actual tier + roll, as a fraction of that
  ceiling.

So a 6-affix item where every affix is maxed scores `[600/600]`; the example
crossbow (one weak Tier-3 phys roll on an ilvl-80 base) scores `[512/600] · 85%`.

## How it reads items (no OCR, no memory reading)

You press **Ctrl+C** on an item in-game (PoE2's built-in copy). The app watches the
clipboard, parses the copied text, and scores it. It simulates no input and makes
no network calls — it stays within GGG's "one action per keypress, don't touch the
game client" guidance.

## Setup (Windows gaming PC)

Two **required** in-game settings:

1. **Options → Game → "Windowed Fullscreen" (Borderless).** Exclusive fullscreen
   hides all overlays on Windows.
2. **Options → UI → "Advanced Mod Descriptions" ON.** This is what makes Ctrl+C
   include each affix's tier and roll range — the data the score is built from.
   Without it you'll see a warning and no score.

## Run

```bash
npm install
npm start        # builds TypeScript -> dist, then launches the overlay
```

The overlay sits top-right. Score an item: hover it in-game, press **Ctrl+C** —
a thin line pops up (auto-hides after 5s). Click it to expand the full breakdown.
The window is clickable so you can expand, dismiss, and favorite affixes; clicking
it briefly takes focus from the game.

- **Ctrl+Shift+S** — show / hide the overlay
- **Ctrl+Shift+Q** — quit

### Launch options (env vars)

| Variable | Effect |
| --- | --- |
| `POE_DEBUG=1` | Movable window, shows in taskbar, opens DevTools. Use to troubleshoot. |
| `POE_TRANSPARENT=1` | See-through background. **Leave off on cloud PCs (Shadow, VMs)** — virtual GPUs render transparent windows invisible. |
| `POE_CLICKTHROUGH=1` | Make the window click-through (clicks pass to the game). Disables the favorite/expand clicks. |

PowerShell example: `$env:POE_DEBUG="1"; npm start`

## Favorites (your wishlist)

Some affixes you always want — life, movement speed, a resistance. Click the **☆**
next to any affix in the expanded card to favorite its mod group; it fills gold and
sticks across items. Favorites are a second axis, orthogonal to `[X/Y]`:

- A favorited affix rolled at **≥80%** of its ceiling flags the item as a **★ KEEPER** —
  shown in gold, and the overlay **won't auto-dismiss** so a good drop never slips past.
- The collapsed line surfaces the best wishlist hit (e.g. `★ 18% increased Attack Speed · 95%`).

Favorites live in a gitignored `favorites.json` (a list of mod-group keys) at the repo
root, shared by the overlay and the CLI. The score number itself is never reweighted —
quality and desirability stay separate.

## Scoring from the command line (no game needed)

```bash
npm run score -- test/fixtures/crossbow.txt   # score a saved item dump
pbpaste | npm run score                        # score the clipboard (macOS)
npm test                                       # parser + scorer tests
```

## Updating the affix database

The affix tiers / ranges / ilvl gates come from the
[RePoE-fork](https://repoe-fork.github.io/poe2/) PoE2 export, bundled under `data/`.
After a PoE2 patch:

```bash
npm run update-data
```

## Layout

```
src/parser.ts   clipboard text -> structured item
src/data.ts     RePoE index: base pool, group tiers, ceiling lookup
src/scorer.ts   affix -> group match, per-affix points, [X/Y], keeper flag
src/favorites.ts  wishlist (mod-group keys) load/save/toggle -> favorites.json
src/main.ts     Electron: clipboard watcher + overlay window + favorite toggles
src/overlay-renderer.ts  the overlay UI
data/           bundled RePoE-fork JSON (affix database)
```

## Known limitations

- Needs Advanced Mod Descriptions on (above).
- Affix → group matching is scoped to the item's base, which disambiguates most
  mods; add aliases in `CLASS_ALIASES` (`src/data.ts`) if an item class name from
  the clipboard doesn't match the database key.
- Spawn weights in the source data can lag live behavior; roll ranges and ilvl
  gates (all the score needs) are authoritative.
- "Best tier at ilvl" assumes the affix can roll at full tier on the base; it does
  not yet model influence/essence-only exclusivity.
```
