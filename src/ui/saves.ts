import { SNAPSHOT_VERSION, type GameSnapshot } from '../game/Game';

/**
 * Saved runs, one per slot: a map id for campaign runs, `daily` for the Daily Challenge.
 * Kept in the browser when storage is available; a blocked or full storage just means no save.
 */
const KEY = 'td-saves';
const DAILY_KEY = 'td-daily';
const BEST_KEY = 'td-best';

export type SaveSlot = string;
export const DAILY_SLOT: SaveSlot = 'daily';

export interface SavedRun {
  snapshot: GameSnapshot;
  /** Daily runs: the UTC day they belong to (a save from another day is dropped). */
  date?: string;
}

function readAll(): Record<SaveSlot, SavedRun> {
  try {
    const data = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<SaveSlot, SavedRun>;
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

function writeAll(all: Record<SaveSlot, SavedRun>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage blocked or full: the run just isn't saved.
  }
}

/** The run saved in `slot`, if it's still loadable (same save version, and today's for the daily). */
export function loadRun(slot: SaveSlot, today?: string): SavedRun | null {
  const run = readAll()[slot];
  if (!run || run.snapshot?.v !== SNAPSHOT_VERSION) return null;
  if (slot === DAILY_SLOT && run.date !== today) return null;
  return run;
}

export function saveRun(slot: SaveSlot, run: SavedRun): void {
  writeAll({ ...readAll(), [slot]: run });
}

export function clearRun(slot: SaveSlot): void {
  const all = readAll();
  if (!(slot in all)) return;
  delete all[slot];
  writeAll(all);
}

/** Best Daily Challenge score for `date` (0 if none yet). */
export function dailyBest(date: string): number {
  try {
    const data = JSON.parse(localStorage.getItem(DAILY_KEY) ?? '{}') as { date?: string; best?: number };
    return data.date === date && typeof data.best === 'number' ? data.best : 0;
  } catch {
    return 0;
  }
}

/** Records a finished daily score; returns the best for the day. */
export function recordDaily(date: string, score: number): number {
  const best = Math.max(dailyBest(date), score);
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify({ date, best }));
  } catch {
    // Storage blocked: the best score lasts for this visit only.
  }
  return best;
}

/** Best finished score on a map, with who got it (the hero, on hero maps) and how many lives were left. */
export interface MapBest {
  score: number;
  lives: number;
  /** Waves held: all of them for a win. */
  waves: number;
  won: boolean;
  hero?: string;
}

function readBests(): Record<string, MapBest> {
  try {
    const data = JSON.parse(localStorage.getItem(BEST_KEY) ?? '{}') as Record<string, MapBest>;
    return data && typeof data === 'object' ? data : {};
  } catch {
    return {};
  }
}

/** Best score recorded on `levelId` (campaign runs only), or null. */
export function mapBest(levelId: string): MapBest | null {
  const best = readBests()[levelId];
  return best && typeof best.score === 'number' ? best : null;
}

/** Records a finished run on a map; returns the previous best (null if none) and whether this beat it. */
export function recordMapBest(levelId: string, run: MapBest): { previous: MapBest | null; isNew: boolean } {
  const all = readBests();
  const previous = all[levelId] ?? null;
  const isNew = !previous || run.score > previous.score;
  if (isNew) {
    all[levelId] = run;
    try {
      localStorage.setItem(BEST_KEY, JSON.stringify(all));
    } catch {
      // Storage blocked: the best lasts for this visit only.
    }
  }
  return { previous, isNew };
}
