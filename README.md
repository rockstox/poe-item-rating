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

The overlay sits in the top-right, click-through (clicks pass to the game).

- **Ctrl+Shift+S** — show / hide the overlay
- **Ctrl+Shift+Q** — quit

Score an item: hover it in-game, press **Ctrl+C**. The overlay updates.

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
src/scorer.ts   affix -> group match, per-affix points, [X/Y]
src/main.ts     Electron: clipboard watcher + transparent overlay window
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
