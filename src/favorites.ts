// Your personal wishlist: a set of mod *group keys* (e.g. "IncreasedLife",
// "MovementVelocity") you care about. A favorite is keyed on the group, not a
// specific tier, so any life roll counts as your "life" favorite regardless of
// base. The scorer flags favorited affixes and derives a "keeper" signal from
// them; the headline [X/Y] is untouched.
//
// Stored as repo-root favorites.json (gitignored, per-machine). Both the overlay
// and the CLI read the same file, so you can curate it on either box.
import * as fs from 'fs';
import * as path from 'path';

const FILE = path.join(__dirname, '..', 'favorites.json');

export function loadFavorites(): Set<string> {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    const groups: unknown = Array.isArray(raw) ? raw : raw?.groups;
    if (Array.isArray(groups)) return new Set(groups.filter((g): g is string => typeof g === 'string'));
  } catch {
    /* no file yet, or unreadable — start empty */
  }
  return new Set();
}

export function saveFavorites(set: Set<string>): void {
  const out = { groups: [...set].sort() };
  fs.writeFileSync(FILE, JSON.stringify(out, null, 2) + '\n');
}

// Flip one group's favorite state, persist, and report whether it's now a
// favorite. Returns null for an empty/invalid key.
export function toggleFavorite(set: Set<string>, groupKey: string | null): boolean | null {
  if (!groupKey) return null;
  const nowFavorite = !set.has(groupKey);
  if (nowFavorite) set.add(groupKey);
  else set.delete(groupKey);
  saveFavorites(set);
  return nowFavorite;
}
