import { BATTLEFIELDS } from '../src/data/battlefields';
import { COMBOS } from '../src/data/combos';
import { ELEMENTS } from '../src/data/elements';
import { ENEMIES } from '../src/data/enemies';
import { HEROES } from '../src/data/hero';
import { LEVELS } from '../src/data/levels';
import { BUILD_ELEMENTS, BUILD_WEAPONS, towerName } from '../src/data/towers';
import { WEAPONS } from '../src/data/weapons';
import { PRIORITY_LABELS } from '../src/ui/InfoPanel';

/** Source of every `.ts` file in src (read through Vite, so no Node types are needed). */
const SOURCES = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const INDEX_HTML = (import.meta.glob('../index.html', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)['../index.html'];

/**
 * String literals in the first argument of every `t(...)` / `tr(...)` call (both branches of a
 * ternary count). Template literals aren't allowed as keys.
 */
export function codeKeys(src: string): string[] {
  const keys: string[] = [];
  const call = /(?<![\w.$])(?:t|tr)\(/g;
  for (let m = call.exec(src); m; m = call.exec(src)) {
    let i = m.index + m[0].length;
    let depth = 1;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (c === "'" || c === '"') {
        let j = i + 1;
        let text = '';
        while (src[j] !== c) {
          if (src[j] === '\\') {
            text += src[j + 1];
            j += 2;
          } else text += src[j++];
        }
        if (text) keys.push(text);
        i = j + 1;
        continue;
      }
      if (c === '`') {
        // Skip template literals (only allowed as params, not keys).
        let j = i + 1;
        while (src[j] !== '`') j += src[j] === '\\' ? 2 : 1;
        i = j + 1;
        continue;
      }
      if (c === '(' || c === '[' || c === '{') depth++;
      else if (c === ')' || c === ']' || c === '}') depth--;
      else if (c === ',' && depth === 1) break;
      i++;
    }
  }
  return keys;
}

/** Player-facing names and descriptions in the game data. */
export function dataKeys(): string[] {
  const keys: string[] = [];
  for (const e of Object.values(ELEMENTS)) keys.push(e.name, e.role);
  for (const w of Object.values(WEAPONS)) keys.push(w.name, w.role, w.strength, w.weakness);
  for (const weapon of BUILD_WEAPONS) for (const element of BUILD_ELEMENTS) keys.push(towerName({ weapon, element }));
  for (const e of Object.values(ENEMIES)) {
    keys.push(e.name, e.description);
    for (const p of e.phases ?? []) keys.push(p.name);
  }
  for (const c of Object.values(COMBOS)) keys.push(c.name, c.description);
  for (const b of Object.values(BATTLEFIELDS)) keys.push(b.name);
  for (const l of LEVELS) keys.push(l.name, l.description);
  for (const h of Object.values(HEROES)) {
    keys.push(h.role, h.pronouns, h.race, h.origin, h.bio);
    for (const a of h.abilities) keys.push(a.name, a.description);
    if (h.passive) keys.push(h.passive.name, h.passive.description);
  }
  keys.push(...Object.values(PRIORITY_LABELS));
  return keys;
}

/** `data-i18n`, `data-i18n-title`, and `data-i18n-aria` values in index.html. */
export function htmlKeys(html: string): string[] {
  return [...html.matchAll(/data-i18n(?:-title|-aria)?="([^"]+)"/g)].map((m) => m[1]);
}

/** Every key the game can ask for, deduplicated. */
export function allKeys(): string[] {
  const code = Object.values(SOURCES).flatMap(codeKeys);
  return [...new Set([...code, ...dataKeys(), ...htmlKeys(INDEX_HTML)])];
}
