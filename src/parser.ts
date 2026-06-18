// Parses the text PoE2 puts on the clipboard when you hover an item and press
// Ctrl+C. REQUIRES the in-game "Advanced Mod Descriptions" setting to be ON —
// that is what wraps each affix in `{ Prefix Modifier "Name" (Tier: N) — tags }`
// and prints the rolled value alongside its current-tier range, e.g. `18(17-19)%`.

import type { ParsedItem, ParsedAffix, StatValue, AffixKind } from './types';

const SECTION_RE = /^-{3,}$/;

// Matches a rolled value that carries its tier range, e.g. "18(17-19)" or
// "7.59(7-7.9)". Group 1 = rolled value, 2 = range min, 3 = range max.
const RANGED_VALUE_RE = /(-?\d+(?:\.\d+)?)\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/g;
// A bare number with no range (fixed-value lines, or advanced mode off).
const BARE_NUMBER_RE = /-?\d+(?:\.\d+)?/g;

const AFFIX_HEADER_RE =
  /^\{\s*(Prefix|Suffix|Implicit)\s+Modifier(?:\s+"([^"]*)")?\s*(?:\(Tier:\s*(\d+)\))?\s*(?:—\s*(.*?))?\s*\}$/;

function splitSections(text: string): string[][] {
  const sections: string[][] = [];
  let current: string[] = [];
  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trimEnd();
    if (SECTION_RE.test(line.trim())) {
      sections.push(current);
      current = [];
    } else {
      current.push(line);
    }
  }
  sections.push(current);
  return sections
    .map((lines) => lines.filter((l) => l.length > 0))
    .filter((s) => s.length > 0);
}

// Extract value tokens from a stat line. Prefers ranged tokens; falls back to
// bare numbers so the parser still degrades gracefully without advanced mode.
function parseStatValues(statText: string): { values: StatValue[]; hasRanges: boolean } {
  const ranged: StatValue[] = [];
  let m: RegExpExecArray | null;
  RANGED_VALUE_RE.lastIndex = 0;
  while ((m = RANGED_VALUE_RE.exec(statText)) !== null) {
    ranged.push({ rolled: Number(m[1]), rangeMin: Number(m[2]), rangeMax: Number(m[3]) });
  }
  if (ranged.length) return { values: ranged, hasRanges: true };

  const bare: StatValue[] = (statText.match(BARE_NUMBER_RE) || []).map((n) => ({
    rolled: Number(n),
    rangeMin: null,
    rangeMax: null,
  }));
  return { values: bare, hasRanges: false };
}

function parseItem(text: string): ParsedItem {
  const sections = splitSections(text);
  const item: ParsedItem = {
    itemClass: null,
    rarity: null,
    name: null,
    baseType: null,
    itemLevel: null,
    corrupted: false,
    affixes: [],
    implicits: [],
    advancedMode: false,
    raw: text,
  };

  for (const section of sections) {
    for (const line of section) {
      const cls = line.match(/^Item Class:\s*(.+)$/);
      if (cls) item.itemClass = cls[1].trim();
      const rar = line.match(/^Rarity:\s*(.+)$/);
      if (rar) item.rarity = rar[1].trim();
      const ilvl = line.match(/^Item Level:\s*(\d+)$/);
      if (ilvl) item.itemLevel = Number(ilvl[1]);
      if (/^Corrupted$/.test(line)) item.corrupted = true;
    }
  }

  // Name + base type live in the first section after the Class/Rarity lines.
  if (sections.length) {
    const header = sections[0].filter((l) => !/^(Item Class|Rarity):/.test(l));
    if (header.length === 1) item.baseType = header[0];
    else if (header.length >= 2) {
      item.name = header[0];
      item.baseType = header[1];
    }
  }

  // Affix sections: any section whose first line is an affix header.
  for (const section of sections) {
    if (!AFFIX_HEADER_RE.test(section[0] || '')) continue;
    let pending: ParsedAffix | null = null;
    const flush = () => {
      if (!pending) return;
      const target = pending.kind === 'Implicit' ? item.implicits : item.affixes;
      target.push(pending);
      if (pending.statLines.some((s) => s.hasRanges)) item.advancedMode = true;
      pending = null;
    };
    for (const line of section) {
      const h = line.match(AFFIX_HEADER_RE);
      if (h) {
        flush();
        pending = {
          kind: h[1] as AffixKind,
          name: h[2] || null,
          inGameTier: h[3] ? Number(h[3]) : null,
          tags: h[4] ? h[4].split(',').map((t) => t.trim()) : [],
          statLines: [],
        };
      } else if (pending) {
        const parsed = parseStatValues(line);
        pending.statLines.push({ text: line, ...parsed });
      }
    }
    flush();
  }

  return item;
}

export { parseItem, parseStatValues, splitSections };
