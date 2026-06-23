import type { ItemScore } from './types';

// Renders a score as a compact text report (used by the CLI and handy for logs).
export function formatScore(score: ItemScore): string {
  const lines: string[] = [];
  const headline = `[ ${score.x} / ${score.y} ]`;
  const pct = (score.pct * 100).toFixed(0);
  const keeper = score.keeper && score.favoriteBest
    ? `   ★ KEEPER (${score.favoriteBest.name ?? score.favoriteBest.text} ${(score.favoriteBest.pct * 100).toFixed(0)}%)`
    : '';
  lines.push(
    `${headline}   ${pct}%   (ilvl ${score.itemLevel ?? '?'}, ${score.itemClass ?? '?'})${keeper}`,
  );
  lines.push('');
  for (const a of score.affixes) {
    const tag = a.kind === 'Suffix' ? 'S' : a.kind === 'Prefix' ? 'P' : 'I';
    const star = a.favorite ? ' ★' : '';
    if (!a.matched) {
      lines.push(`  [${tag}] ${a.text}  —  unmatched (${a.note ?? ''})`);
      continue;
    }
    const apct = (a.pct * 100).toFixed(0);
    lines.push(`  [${tag}]${star} ${String(a.points).padStart(3)} pts (${apct}%)  ${a.text}`);
    lines.push(`        roll ${a.actual} / max ${a.ceiling} at ilvl ${score.itemLevel ?? '?'}`);
  }
  if (score.unmatched) lines.push(`\n  ${score.unmatched} affix(es) unmatched.`);
  return lines.join('\n');
}
