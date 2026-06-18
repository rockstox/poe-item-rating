import type { ParsedItem, ParsedAffix, AffixScore, ItemScore, StatValue } from './types';
import type { Mod } from './types';
import { basePool, ceilingForGroup, getMod, sumMax } from './data';
import type { GenGroups } from './data';

// All rolled value tokens across an affix's stat lines, in reading order.
function affixValues(affix: ParsedAffix): StatValue[] {
  const out: StatValue[] = [];
  for (const line of affix.statLines) for (const v of line.values) out.push(v);
  return out;
}

// The affix's actual roll expressed in the data's RAW stat units. The clipboard
// shows DISPLAY units (e.g. leech "7.59%") while RePoE stores raw (permyriad
// "759"). We map each value's position within its shown tier range onto the
// matched tier's raw range, which is unit-agnostic and lines up with the raw
// ceiling. Falls back to the displayed sum when ranges/counts don't line up.
function actualRawMagnitude(affix: ParsedAffix, tierMod: Mod): number {
  const vals = affixValues(affix);
  const stats = tierMod.stats || [];
  const allRanged = vals.length > 0 && vals.every((v) => v.rangeMin != null && v.rangeMax != null);
  if (!allRanged || vals.length !== stats.length) {
    return vals.reduce((s, v) => s + v.rolled, 0);
  }
  let sum = 0;
  for (let i = 0; i < vals.length; i++) {
    const v = vals[i];
    const span = (v.rangeMax as number) - (v.rangeMin as number);
    const pos = span === 0 ? 1 : (v.rolled - (v.rangeMin as number)) / span;
    sum += stats[i].min + pos * (stats[i].max - stats[i].min);
  }
  return sum;
}

// The (min,max) range pairs the clipboard showed for this affix's current tier.
function affixRangePairs(affix: ParsedAffix): [number, number][] {
  const pairs: [number, number][] = [];
  for (const line of affix.statLines)
    for (const v of line.values)
      if (v.rangeMin != null && v.rangeMax != null) pairs.push([v.rangeMin, v.rangeMax]);
  return pairs;
}

function rangesMatch(a: [number, number][], b: [number, number][]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  const used = new Array(b.length).fill(false);
  for (const [amin, amax] of a) {
    const i = b.findIndex(([bmin, bmax], idx) => !used[idx] && bmin === amin && bmax === amax);
    if (i === -1) return false;
    used[i] = true;
  }
  return true;
}

interface Match {
  groupKey: string;
  modKey: string;
  mod: Mod;
  currentTierMax: number;
}

// Find which mod group an affix belongs to, scoped to the base's rollable pool.
// Scoping to the base makes the otherwise-ambiguous affix name unique, and the
// current-tier range gives an independent confirmation / disambiguation.
function matchAffix(affix: ParsedAffix, genGroups: GenGroups): Match | null {
  const wantRanges = affixRangePairs(affix);
  let best: { m: Match; score: number } | null = null;

  for (const [groupKey, tiers] of Object.entries(genGroups)) {
    for (const modKey of Object.keys(tiers)) {
      const mod = getMod(modKey);
      if (!mod) continue;
      const nameMatch = !!affix.name && mod.name === affix.name;
      const modRanges = mod.stats.map((s) => [s.min, s.max] as [number, number]);
      const rangeMatch = rangesMatch(wantRanges, modRanges);
      if (!nameMatch && !rangeMatch) continue;
      const score = (nameMatch ? 2 : 0) + (rangeMatch ? 1 : 0);
      if (!best || score > best.score) {
        best = { m: { groupKey, modKey, mod, currentTierMax: sumMax(mod) }, score };
      }
    }
  }
  return best?.m ?? null;
}

function scoreItem(item: ParsedItem): ItemScore {
  const bp = basePool(item.itemClass);
  const affixScores: AffixScore[] = [];

  for (const affix of item.affixes) {
    const base: AffixScore = {
      kind: affix.kind,
      name: affix.name,
      text: affix.statLines.map((s) => s.text).join(' / '),
      matched: false,
      groupKey: null,
      actual: affixValues(affix).reduce((s, v) => s + v.rolled, 0),
      ceiling: 0,
      currentTierMax: null,
      pct: 0,
      points: 0,
    };

    if (!bp) {
      base.note = `Unknown item class "${item.itemClass}" — no base pool`;
      affixScores.push(base);
      continue;
    }

    const genGroups = affix.kind === 'Suffix' ? bp.pool.suffix : bp.pool.prefix;
    const match = matchAffix(affix, genGroups);
    if (!match) {
      base.note = 'No matching mod group in base pool';
      affixScores.push(base);
      continue;
    }

    const ceil = ceilingForGroup(genGroups, match.groupKey, item.itemLevel);
    base.matched = true;
    base.groupKey = match.groupKey;
    base.currentTierMax = round(match.currentTierMax);
    base.actual = round(actualRawMagnitude(affix, match.mod));
    base.ceiling = round(ceil ? ceil.magnitudeMax : match.currentTierMax);
    base.pct = base.ceiling > 0 ? Math.min(1, base.actual / base.ceiling) : 0;
    base.points = Math.round(base.pct * 100);
    affixScores.push(base);
  }

  // Headline: each matched affix is worth up to 100 points (how close its
  // roll+tier is to the best this base could hold at this ilvl), summed.
  const matched = affixScores.filter((a) => a.matched);
  const x = matched.reduce((s, a) => s + a.points, 0);
  const y = matched.length * 100;

  return {
    x,
    y,
    pct: y > 0 ? x / y : 0,
    meanAffixPct: y > 0 ? x / y : 0,
    affixes: affixScores,
    unmatched: affixScores.length - matched.length,
    itemClass: item.itemClass,
    itemLevel: item.itemLevel,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export { scoreItem };
