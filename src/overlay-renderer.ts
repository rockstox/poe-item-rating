// Browser-side overlay renderer. This file is loaded by overlay.html via a plain
// <script> tag, so it must NOT use import/export (that would make tsc emit a
// CommonJS `exports` wrapper, which throws "exports is not defined" in a browser).
// Types are declared locally and the preload bridge is read off `window`.

interface AffixScoreLike {
  kind: string;
  name: string | null;
  text: string;
  matched: boolean;
  groupKey: string | null;
  actual: number;
  ceiling: number;
  currentTierMax: number | null;
  pct: number;
  points: number;
  note?: string;
}
interface ScoreLike {
  x: number;
  y: number;
  pct: number;
  affixes: AffixScoreLike[];
  itemLevel: number | null;
  itemClass: string | null;
}
interface ScorePayloadLike {
  score: ScoreLike;
  advancedMode: boolean;
  name: string | null;
  baseType: string | null;
  rarity: string | null;
}

// NB: don't name this `poe` — contextBridge already defined a non-configurable
// global `poe`, and a top-level `const poe` would clash ("already declared").
const bridge = (window as any).poe as {
  onScore: (cb: (p: ScorePayloadLike) => void) => void;
  setClickThrough: (ignore: boolean) => void;
};

const root = document.getElementById('app') as HTMLDivElement;

function gradeColor(pct: number): string {
  const hue = Math.round(pct * 120); // red → amber → green
  return `hsl(${hue} 80% 55%)`;
}

function esc(str: string): string {
  return str.replace(
    /[&<>"]/g,
    (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }) as Record<string, string>)[c],
  );
}

function affixRow(a: AffixScoreLike): string {
  if (!a.matched) {
    return `<div class="affix unmatched"><div class="atext">${esc(a.text)}</div>
      <div class="ameta">unmatched${a.note ? ' · ' + esc(a.note) : ''}</div></div>`;
  }
  const c = gradeColor(a.pct);
  const w = Math.round(a.pct * 100);
  return `<div class="affix">
    <div class="arow">
      <span class="apts" style="color:${c}">${a.points}</span>
      <span class="atext">${esc(a.text)}</span>
    </div>
    <div class="bar"><div class="fill" style="width:${w}%;background:${c}"></div></div>
    <div class="ameta">roll ${a.actual} / max ${a.ceiling}</div>
  </div>`;
}

function render(p: ScorePayloadLike): void {
  const s = p.score;
  const pct = s.y > 0 ? s.x / s.y : 0;
  const c = gradeColor(pct);
  const title = p.name || p.baseType || s.itemClass || 'Item';
  const warn = !p.advancedMode
    ? `<div class="warn">Enable "Advanced Mod Descriptions" in PoE2 for tier data</div>`
    : '';

  root.innerHTML = `
    <div class="card">
      <div class="hdr">
        <div class="name">${esc(title)}</div>
        <div class="sub">${esc(p.baseType || '')} · ilvl ${s.itemLevel ?? '?'}</div>
      </div>
      <div class="score" style="color:${c}">
        <span class="x">${s.x}</span><span class="slash">/</span><span class="y">${s.y}</span>
        <span class="pctbig">${Math.round(pct * 100)}%</span>
      </div>
      ${warn}
      <div class="affixes">${s.affixes.map(affixRow).join('')}</div>
    </div>`;
}

bridge.onScore(render);
