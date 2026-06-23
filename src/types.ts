// ---- RePoE-fork data shapes (subset we use) ----

export interface ModStat {
  id: string;
  min: number;
  max: number;
}

export interface Mod {
  name: string;
  required_level: number;
  domain: string;
  generation_type: string; // "prefix" | "suffix" | ...
  groups: string[];
  type: string;
  stats: ModStat[];
  text: string;
  spawn_weights: { tag: string; weight: number }[];
}

export type ModsFile = Record<string, Mod>;

// mods_by_base: itemClass -> baseSignature -> { bases, mods: { prefix|suffix -> group -> { modKey: requiredLevel } } }
export interface BaseSignature {
  bases: string[];
  mods: {
    prefix?: Record<string, Record<string, number>>;
    suffix?: Record<string, Record<string, number>>;
  };
}
export type ModsByBaseFile = Record<string, Record<string, BaseSignature>>;

// ---- Parser output ----

export type AffixKind = 'Prefix' | 'Suffix' | 'Implicit';

export interface StatValue {
  rolled: number;
  rangeMin: number | null;
  rangeMax: number | null;
}

export interface StatLine {
  text: string;
  values: StatValue[];
  hasRanges: boolean;
}

export interface ParsedAffix {
  kind: AffixKind;
  name: string | null;
  inGameTier: number | null;
  tags: string[];
  statLines: StatLine[];
}

export interface ParsedItem {
  itemClass: string | null;
  rarity: string | null;
  name: string | null;
  baseType: string | null;
  itemLevel: number | null;
  corrupted: boolean;
  affixes: ParsedAffix[];
  implicits: ParsedAffix[];
  advancedMode: boolean;
  raw: string;
}

// ---- Scorer output ----

export interface AffixScore {
  kind: AffixKind;
  name: string | null;
  text: string;
  matched: boolean;
  groupKey: string | null;
  actual: number; // rolled magnitude in raw stat units
  ceiling: number; // best-tier max at this ilvl, raw stat units
  currentTierMax: number | null; // max of the tier it actually rolled
  pct: number; // actual / ceiling, clamped 0..1
  points: number; // pct * 100, rounded — this affix's contribution to X
  favorite: boolean; // groupKey is on your wishlist (favorites.json)
  note?: string;
}

// The best-rolled favorited affix present on an item (the "best hit").
export interface FavoriteHit {
  groupKey: string;
  name: string | null;
  text: string;
  points: number;
  pct: number;
}

export interface ItemScore {
  x: number; // sum of per-affix points (each affix worth up to 100)
  y: number; // matched affix count * 100
  pct: number; // x / y
  meanAffixPct: number; // x / y, same thing expressed 0..1
  affixes: AffixScore[];
  unmatched: number;
  itemClass: string | null;
  itemLevel: number | null;
  // Wishlist axis — orthogonal to [X/Y]. favoriteBest is the best-rolled favorite
  // present (null if none); keeper is true when it clears KEEPER_PCT of its ceiling.
  favoriteBest: FavoriteHit | null;
  keeper: boolean;
}
