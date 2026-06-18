import * as fs from 'fs';
import * as path from 'path';
import type { ModsFile, ModsByBaseFile, Mod } from './types';

const DATA_DIR = path.join(__dirname, '..', 'data');

const mods: ModsFile = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'mods.min.json'), 'utf8'),
);
const modsByBase: ModsByBaseFile = JSON.parse(
  fs.readFileSync(path.join(DATA_DIR, 'mods_by_base.min.json'), 'utf8'),
);

// RePoE-fork export version this data was pulled from (see scripts/update-data.ts).
let dataVersion = 'unknown';
try {
  dataVersion = fs.readFileSync(path.join(DATA_DIR, 'VERSION.txt'), 'utf8').trim();
} catch {
  /* no version stamped */
}

// Clipboard "Item Class" values don't always equal the mods_by_base keys.
// Most do (Crossbows, Bows, Wands, Rings, Amulets, Belts...). Add aliases here
// as you hit mismatches while testing on real items.
const CLASS_ALIASES: Record<string, string> = {};

export interface GenGroups {
  // group -> { modKey: requiredLevel }
  [group: string]: Record<string, number>;
}
export interface BasePool {
  key: string;
  pool: { prefix: GenGroups; suffix: GenGroups };
}
export interface CeilingResult {
  modKey: string;
  req: number;
  mod: Mod;
  magnitudeMax: number;
  magnitudeMin: number;
}

function resolveBaseKey(itemClass: string | null): string | null {
  if (!itemClass) return null;
  if (modsByBase[itemClass]) return itemClass;
  const alias = CLASS_ALIASES[itemClass];
  if (alias && modsByBase[alias]) return alias;
  const keys = Object.keys(modsByBase);
  const ci = keys.find((k) => k.toLowerCase() === itemClass.toLowerCase());
  return ci || null;
}

// Merge every base-signature under an item class into one pool. Different
// signatures (sub-bases) can gate different tiers; merging keeps the highest
// reachable tier per group, which is what a "best possible" ceiling wants.
function basePool(itemClass: string | null): BasePool | null {
  const key = resolveBaseKey(itemClass);
  if (!key) return null;
  const pool: { prefix: GenGroups; suffix: GenGroups } = { prefix: {}, suffix: {} };
  for (const sig of Object.values(modsByBase[key])) {
    for (const gen of ['prefix', 'suffix'] as const) {
      const groups = sig.mods?.[gen] || {};
      for (const [group, tiers] of Object.entries(groups)) {
        pool[gen][group] = pool[gen][group] || {};
        for (const [modKey, req] of Object.entries(tiers)) {
          pool[gen][group][modKey] = req;
        }
      }
    }
  }
  return { key, pool };
}

function getMod(key: string): Mod | null {
  return mods[key] || null;
}

// Scalar "stat budget" of a mod: we sum stat maxes/mins, so a two-stat mod
// (Adds A–B damage) and a one-stat mod are handled uniformly.
function sumMax(mod: Mod): number {
  return (mod.stats || []).reduce((a, s) => a + (s.max ?? 0), 0);
}
function sumMin(mod: Mod): number {
  return (mod.stats || []).reduce((a, s) => a + (s.min ?? 0), 0);
}

// Within a group, the best tier rollable at this ilvl, and its max roll.
function ceilingForGroup(
  genGroups: GenGroups,
  groupKey: string,
  ilvl: number | null,
): CeilingResult | null {
  const tiers = genGroups[groupKey];
  if (!tiers) return null;
  let best: CeilingResult | null = null;
  for (const [modKey, req] of Object.entries(tiers)) {
    if (ilvl != null && req > ilvl) continue;
    const mod = getMod(modKey);
    if (!mod) continue;
    const mag = sumMax(mod);
    if (!best || req > best.req || (req === best.req && mag > best.magnitudeMax)) {
      best = { modKey, req, mod, magnitudeMax: mag, magnitudeMin: sumMin(mod) };
    }
  }
  return best;
}

// All tiers of a group, sorted low→high, for display/debugging.
function groupTiers(genGroups: GenGroups, groupKey: string) {
  const tiers = genGroups[groupKey];
  if (!tiers) return [];
  return Object.entries(tiers)
    .map(([modKey, req]) => {
      const mod = getMod(modKey);
      return mod && { modKey, req, name: mod.name, stats: mod.stats, text: mod.text };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
    .sort((a, b) => a.req - b.req);
}

export {
  mods,
  modsByBase,
  dataVersion,
  basePool,
  resolveBaseKey,
  getMod,
  ceilingForGroup,
  groupTiers,
  sumMax,
  sumMin,
};
