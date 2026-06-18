import type { ScorePayload } from './preload';
import type { AffixScore } from './types';

declare global {
  interface Window {
    poe: {
      onScore: (cb: (p: ScorePayload) => void) => void;
      setClickThrough: (ignore: boolean) => void;
    };
  }
}

const root = document.getElementById('app') as HTMLDivElement;

function gradeColor(pct: number): string {
  // red → amber → green across 0..1
  const hue = Math.round(pct * 120);
  return `hsl(${hue} 80% 55%)`;
}

function affixRow(a: AffixScore): string {
  if (!a.matched) {
    return `<div class="affix unmatched"><div class="atext">${escape(a.text)}</div>
      <div class="ameta">unmatched</div></div>`;
  }
  const c = gradeColor(a.pct);
  const w = Math.round(a.pct * 100);
  return `<div class="affix">
    <div class="arow">
      <span class="apts" style="color:${c}">${a.points}</span>
      <span class="atext">${escape(a.text)}</span>
    </div>
    <div class="bar"><div class="fill" style="width:${w}%;background:${c}"></div></div>
    <div class="ameta">roll ${a.actual} / max ${a.ceiling}</div>
  </div>`;
}

function render(p: ScorePayload) {
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
        <div class="name">${escape(title)}</div>
        <div class="sub">${escape(p.baseType || '')} · ilvl ${s.itemLevel ?? '?'}</div>
      </div>
      <div class="score" style="color:${c}">
        <span class="x">${s.x}</span><span class="slash">/</span><span class="y">${s.y}</span>
        <span class="pctbig">${Math.round(pct * 100)}%</span>
      </div>
      ${warn}
      <div class="affixes">${s.affixes.map(affixRow).join('')}</div>
    </div>`;
}

function escape(str: string): string {
  return str.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

window.poe.onScore(render);
