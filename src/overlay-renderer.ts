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
  favorite: boolean;
  note?: string;
}
interface FavoriteHitLike {
  groupKey: string;
  name: string | null;
  text: string;
  points: number;
  pct: number;
}
interface ScoreLike {
  x: number;
  y: number;
  pct: number;
  affixes: AffixScoreLike[];
  itemLevel: number | null;
  itemClass: string | null;
  favoriteBest: FavoriteHitLike | null;
  keeper: boolean;
}
interface ScorePayloadLike {
  score: ScoreLike;
  advancedMode: boolean;
  name: string | null;
  baseType: string | null;
  rarity: string | null;
  dataVersion: string;
  expanded: boolean;
}

const bridge = (window as any).poe as {
  onScore: (cb: (p: ScorePayloadLike) => void) => void;
  resize: (height: number) => void;
  dismiss: () => void;
  toggleFavorite: (groupKey: string) => void;
  debug: boolean;
};

const GOLD = '#c8a04f'; // matches --gold in overlay.html (keeper/wishlist signal)

const AUTO_MS = 5000;
const root = document.getElementById('app') as HTMLDivElement;
let current: ScorePayloadLike | null = null;
let timer = 0;

function gradeColor(pct: number): string {
  return `hsl(${Math.round(pct * 120)} 80% 55%)`; // red → amber → green
}
// A one-word verdict for the headline %, so the gauge reads as a judgement
// rather than a bare bar.
function gradeWord(pct: number): string {
  if (pct >= 0.9) return 'exceptional';
  if (pct >= 0.75) return 'strong';
  if (pct >= 0.55) return 'fair';
  if (pct >= 0.35) return 'weak';
  return 'poor';
}
// PoE item rarity colors — the name is tinted the way the game tints it, so
// rarity reads instantly and the panel feels native to the tooltip.
function rarityColor(rarity: string | null): string {
  switch ((rarity || '').toLowerCase()) {
    case 'magic': return '#8aa0ff';
    case 'rare': return '#e5c768';
    case 'unique': return '#c06a2e';
    case 'currency': case 'gem': return '#d9b88a';
    default: return '#e8e0d0'; // normal / unknown
  }
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

// Compact descriptive label for the best favorite, e.g. "18% increased Attack
// Speed" — the stat text with its (range) annotations stripped. Falls back to
// the affix name only when there's no stat text.
function favLabel(fav: FavoriteHitLike): string {
  const stat = fav.text.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  return esc(stat || fav.name || '');
}

function renderCollapsed(p: ScorePayloadLike): void {
  const s = p.score;
  const pct = s.y > 0 ? s.x / s.y : 0;
  const c = gradeColor(pct);
  // A keeper gets a gold left-edge + a wishlist line so it reads in a glance.
  const accent = s.keeper ? GOLD : c;
  const keeperRow =
    s.keeper && s.favoriteBest
      ? `<div class="ckeeper">★ ${favLabel(s.favoriteBest)} · ${Math.round(s.favoriteBest.pct * 100)}%</div>`
      : '';
  root.innerHTML = `
    <div class="collapsed${s.keeper ? ' keeper' : ''}" id="collapsed" style="border-left-color:${accent}">
      <div class="cmain">
        <span class="cpct" style="color:${c}">${Math.round(pct * 100)}%</span>
        <span class="cx">${s.x}/${s.y}</span>
        <span class="ctitle" style="color:${rarityColor(p.rarity)}">${esc(titleOf(p))}</span>
        <span class="chint">▸</span>
      </div>
      ${keeperRow}
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
  // ★ toggles the favorite for this mod group; data-group wires the click in expand().
  const star = `<span class="star${a.favorite ? ' on' : ''}" data-group="${esc(a.groupKey || '')}"
    title="${a.favorite ? 'unfavorite' : 'favorite'} this affix">${a.favorite ? '★' : '☆'}</span>`;
  return `<div class="affix${a.favorite ? ' fav' : ''}">
    <div class="arow"><span class="apts" style="color:${c}">${a.points}</span>
      <span class="atext">${esc(a.text)}</span>${star}</div>
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
  const keeperBadge =
    s.keeper && s.favoriteBest
      ? `<div class="keeperbadge"><span class="kw">★ KEEPER</span>
          <span class="kd">${favLabel(s.favoriteBest)} · ${Math.round(s.favoriteBest.pct * 100)}%</span></div>`
      : '';
  root.innerHTML = `
    <div class="card${s.keeper ? ' keeper' : ''}">
      <div class="x" id="dismiss" title="dismiss">✕</div>
      <div class="hdr">
        <div class="name" style="color:${rarityColor(p.rarity)}">${esc(titleOf(p))}</div>
        <div class="sub">${esc(p.baseType || '')} · ilvl ${s.itemLevel ?? '?'}</div>
      </div>
      <div class="hero">
        <span class="pctbig" style="color:${c}">${Math.round(pct * 100)}%</span>
        <span class="frac"><span class="sx" style="color:${c}">${s.x}</span><span class="slash">/</span><span class="sy">${s.y}</span></span>
      </div>
      <div class="gauge"><div class="gfill" style="width:${Math.round(pct * 100)}%;background:${c}"></div></div>
      <div class="gaugecap"><span class="label">closeness to best roll</span><span class="label r" style="color:${c}">${gradeWord(pct)}</span></div>
      ${keeperBadge}
      ${warn}
      <div class="sep"></div>
      <div class="affixes">${s.affixes.map(affixRow).join('')}</div>
      <div class="foot"><span>RePoE ${esc(p.dataVersion)}</span><span>☆ click to favorite</span></div>
    </div>`;
  (document.getElementById('dismiss') as HTMLElement).onclick = () => bridge.dismiss();
  for (const el of Array.from(document.querySelectorAll('.star'))) {
    (el as HTMLElement).onclick = (ev) => {
      ev.stopPropagation();
      const group = (el as HTMLElement).dataset.group;
      if (group) bridge.toggleFavorite(group); // main re-scores and re-emits expanded
    };
  }
  fit();
}

bridge.onScore((p) => {
  current = p;
  clearTimer();
  if (p.expanded) {
    expand(); // re-render in place after a favorite toggle
    return;
  }
  renderCollapsed(p);
  // Keepers stay until dismissed so a good drop never slips past the 5s timer.
  if (!bridge.debug && !p.score.keeper) timer = window.setTimeout(() => bridge.dismiss(), AUTO_MS);
});
