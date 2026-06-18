// Usage:
//   npm run score -- test/fixtures/crossbow.txt
//   pbpaste | npm run score          (score whatever is on the clipboard, macOS)
import * as fs from 'fs';
import { parseItem } from './parser';
import { scoreItem } from './scorer';
import { formatScore } from './format';

function readInput(): string {
  const arg = process.argv[2];
  if (arg && arg !== '-') return fs.readFileSync(arg, 'utf8');
  return fs.readFileSync(0, 'utf8'); // stdin
}

const text = readInput();
const item = parseItem(text);
if (!item.advancedMode) {
  console.warn(
    '⚠  No tier/range data found. Enable "Advanced Mod Descriptions" in PoE2 ' +
      'before copying the item.\n',
  );
}
const score = scoreItem(item);
console.log(formatScore(score));
