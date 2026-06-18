// Refreshes the bundled affix database from the RePoE-fork PoE2 export.
// Run after a PoE2 patch: `npm run update-data`.
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'https://repoe-fork.github.io/poe2';
const FILES = ['mods.min.json', 'mods_by_base.min.json', 'base_items.min.json'];
const OUT = path.join(__dirname, '..', 'data');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of FILES) {
    const url = `${BASE}/${f}`;
    process.stdout.write(`fetching ${f} ... `);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url} -> ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(path.join(OUT, f), buf);
    console.log(`${(buf.length / 1024 / 1024).toFixed(1)} MB`);
  }
  console.log('done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
