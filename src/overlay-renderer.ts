// Browser-side overlay renderer. Loaded by overlay.html via a plain <script> tag,
// so NO import/export (that would emit a CommonJS `exports` wrapper that throws in
// a browser). Types are local; the preload bridge is read off `window`.
//
// Flow: each score arrives as a thin COLLAPSED line that auto-dismisses after 5s.
// Clicking it EXPANDS the full breakdown, which stays until the ✕ is clicked.

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
  dataVersion: string;
}

const bridge = (window as any).poe as {
  onScore: (cb: (p: ScorePayloadLike) => void) => void;
  resize: (height: number) => void;
  dismiss: () => void;
  debug: boolean;
};

const AUTO_MS = 5000;
const root = document.getElementById('app') as HTMLDivElement;
let current: ScorePayloadLike | null = null;
let timer = 0;

function gradeColor(pct: number): string {
  return `hsl(${Math.round(pct * 120)} 80% 55%)`; // red → amber → green
}
function esc(str: string): string {
  return str.replace(
    /[&<>"]/g,
    (c) => (({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }) as Record<string, string>)[c],
  );
}
function titleOf(p: ScorePayloadLike): string {
  return p.name || p.baseType || p.score.itemClass || 'Item';
}

function clearTimer(): void {
  if (timer) {
    clearTimeout(timer);
    timer = 0;
  }
}

// Re-measure rendered content and ask main to size the window to it.
function fit(): void {
  requestAnimationFrame(() => {
    const el = root.firstElementChild as HTMLElement | null;
    bridge.resize(el ? Math.ceil(el.getBoundingClientRect().height) : 42);
  });
}

function renderCollapsed(p: ScorePayloadLike): void {
  const s = p.score;
  const pct = s.y > 0 ? s.x / s.y : 0;
  const c = gradeColor(pct);
  root.innerHTML = `
    <div class="collapsed" id="collapsed" style="border-left:3px solid ${c}">
      <span class="cx" style="color:${c}">${s.x}/${s.y}</span>
      <span class="cpct">${Math.round(pct * 100)}%</span>
      <span class="ctitle">${esc(titleOf(p))}</span>
      <span class="chint">▸</span>
    </div>`;
  (document.getElementById('collapsed') as HTMLElement).onclick = expand;
  fit();
}

function affixRow(a: AffixScoreLike): string {
  if (!a.matched) {
    return `<div class="affix unmatched"><div class="atext">${esc(a.text)}</div>
      <div class="ameta">unmatched${a.note ? ' · ' + esc(a.note) : ''}</div></div>`;
  }
  const c = gradeColor(a.pct);
  return `<div class="affix">
    <div class="arow"><span class="apts" style="color:${c}">${a.points}</span>
      <span class="atext">${esc(a.text)}</span></div>
    <div class="bar"><div class="fill" style="width:${Math.round(a.pct * 100)}%;background:${c}"></div></div>
    <div class="ameta">roll ${a.actual} / max ${a.ceiling}</div>
  </div>`;
}

function expand(): void {
  if (!current) return;
  clearTimer();
  const p = current;
  const s = p.score;
  const pct = s.y > 0 ? s.x / s.y : 0;
  const c = gradeColor(pct);
  const warn = !p.advancedMode
    ? `<div class="warn">Enable "Advanced Mod Descriptions" in PoE2 for tier data</div>`
    : '';
  root.innerHTML = `
    <div class="card">
      <div class="x" id="dismiss" title="dismiss">✕</div>
      <div class="hdr">
        <div class="name">${esc(titleOf(p))}</div>
        <div class="sub">${esc(p.baseType || '')} · ilvl ${s.itemLevel ?? '?'}</div>
      </div>
      <div class="score" style="color:${c}">
        <span class="sx">${s.x}</span><span class="slash">/</span><span class="sy">${s.y}</span>
        <span class="pctbig">${Math.round(pct * 100)}%</span>
      </div>
      ${warn}
      <div class="affixes">${s.affixes.map(affixRow).join('')}</div>
      <div class="foot">data ${esc(p.dataVersion)}</div>
    </div>`;
  (document.getElementById('dismiss') as HTMLElement).onclick = () => bridge.dismiss();
  fit();
}

bridge.onScore((p) => {
  current = p;
  renderCollapsed(p);
  clearTimer();
  if (!bridge.debug) timer = window.setTimeout(() => bridge.dismiss(), AUTO_MS);
});
