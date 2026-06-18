import * as fs from 'fs';
import * as path from 'path';
import { parseItem } from '../src/parser';
import { scoreItem } from '../src/scorer';
import { formatScore } from '../src/format';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  const mark = cond ? '✓' : '✗';
  if (!cond) failures++;
  console.log(`  ${mark} ${name}${detail ? '  — ' + detail : ''}`);
}

const fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'crossbow.txt'), 'utf8');
const item = parseItem(fixture);

console.log('PARSER');
check('item class', item.itemClass === 'Crossbows', String(item.itemClass));
check('rarity', item.rarity === 'Rare');
check('item level 80', item.itemLevel === 80, String(item.itemLevel));
check('advanced mode detected', item.advancedMode === true);
check('3 prefixes + 3 suffixes parsed', item.affixes.length === 6, `${item.affixes.length}`);
check('implicit captured separately', item.implicits.length === 1);

const accel = item.affixes.find((a) => a.name === 'of Acclaim');
check('attack speed rolled 18', !!accel && accel.statLines[0].values[0].rolled === 18);
check(
  'attack speed range 17-19',
  !!accel &&
    accel.statLines[0].values[0].rangeMin === 17 &&
    accel.statLines[0].values[0].rangeMax === 19,
);

const lightning = item.affixes.find((a) => a.name === 'Electrocuting');
check('added-lightning has 2 ranged values', !!lightning && lightning.statLines[0].values.length === 2);

console.log('\nSCORER');
const score = scoreItem(item);
check('produces X/Y', score.x > 0 && score.y > 0, `[${score.x}/${score.y}]`);
check('X <= Y', score.x <= score.y);
check('at least some affixes matched', score.affixes.some((a) => a.matched), `${6 - score.unmatched}/6 matched`);

console.log('\n--- report ---\n');
console.log(formatScore(score));

console.log(`\n${failures === 0 ? 'ALL PASS' : failures + ' FAILURE(S)'}`);
process.exit(failures === 0 ? 0 : 1);
