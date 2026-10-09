import type { HeroDef } from '../data/hero';
import type { LevelDef } from '../data/levels';

/** Which maps the player has cleared, saved in the browser when storage is available. */
const KEY = 'td-progress';

export interface Progress {
  cleared: string[];
}

export function loadProgress(): Progress {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Progress>;
    return { cleared: Array.isArray(data.cleared) ? data.cleared.filter((x) => typeof x === 'string') : [] };
  } catch {
    return { cleared: [] };
  }
}

export function markCleared(progress: Progress, levelId: string): Progress {
  if (progress.cleared.includes(levelId)) return progress;
  const next = { cleared: [...progress.cleared, levelId] };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: progress lasts for this visit only.
  }
  return next;
}

/**
 * The first map is always open; every other map opens once the one before it is cleared,
 * unless the map is marked `unlocked` or opens together with another map (`unlockedWith`).
 */
export function isUnlocked(levels: readonly LevelDef[], index: number, progress: Progress): boolean {
  const level = levels[index];
  if (level.unlocked === true) return true;
  if (level.unlockedWith) return isUnlocked(levels, levels.findIndex((l) => l.id === level.unlockedWith), progress);
  return index === 0 || progress.cleared.includes(levels[index - 1].id);
}

/** The map to clear to open map `index` (null if it opens without one). */
export function unlockedByClearing(levels: readonly LevelDef[], index: number): LevelDef | null {
  const level = levels[index];
  if (level.unlocked === true) return null;
  if (level.unlockedWith) return unlockedByClearing(levels, levels.findIndex((l) => l.id === level.unlockedWith));
  return index === 0 ? null : levels[index - 1];
}

/** Heroes with `unlockedBy` can be picked once that map is cleared; the rest always can. */
export function isHeroUnlocked(def: HeroDef, progress: Progress): boolean {
  return !def.unlockedBy || progress.cleared.includes(def.unlockedBy);
}
