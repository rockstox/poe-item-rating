// Refreshes the bundled affix database from the RePoE-fork PoE2 export.
// Run after a PoE2 patch: `npm run update-data`.
//
// IMPORTANT: we pull from the repo's raw `master` (data/*.json), NOT the
// GitHub Pages site (repoe-fork.github.io/poe2/). Pages lags master by a few
// builds, so master is the freshest published data. The pretty *.json on master
// is saved under our *.min.json names — JSON.parse doesn't care about minifying.
import * as fs from 'fs';
import * as path from 'path';

const BASE = 'https://raw.githubusercontent.com/repoe-fork/poe2/master';
const FILES: [string, string][] = [
  ['data/mods.json', 'mods.min.json'],
  ['data/mods_by_base.json', 'mods_by_base.min.json'],
  ['data/base_items.json', 'base_items.min.json'],
];
const OUT = path.join(__dirname, '..', 'data');

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.text();
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });

  const oldVersion = readLocalVersion();
  const version = (await fetchText(`${BASE}/version.txt`)).trim();
  console.log(`RePoE-fork version: ${oldVersion ?? '(none)'} -> ${version}`);

  for (const [remote, local] of FILES) {
    process.stdout.write(`fetching ${local} ... `);
    const body = await fetchText(`${BASE}/${remote}`);
    fs.writeFileSync(path.join(OUT, local), body);
    console.log(`${(body.length / 1024 / 1024).toFixed(1)} MB`);
  }
  fs.writeFileSync(path.join(OUT, 'VERSION.txt'), version);
  console.log(`done. data version ${version}`);
}

function readLocalVersion(): string | null {
  try {
    return fs.readFileSync(path.join(OUT, 'VERSION.txt'), 'utf8').trim();
  } catch {
    return null;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
