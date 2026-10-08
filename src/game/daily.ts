import { HERO_IDS, type HeroId } from '../data/hero';
import { LEVELS, type LevelDef } from '../data/levels';
import { seededRng } from '../systems/rng';
import type { Game } from './Game';

/**
 * Daily Challenge: one map, one hero, and one set of battlefields and lockdowns per UTC day,
 * the same for everyone, so friends can compare scores. No DOM; the page stores best scores.
 */
export interface DailyChallenge {
  /** UTC day, YYYY-MM-DD. */
  date: string;
  /** Seeds the wave conditions (GameOptions.conditionsSeed). */
  seed: number;
  level: LevelDef;
  /** Used if the map has a hero. */
  hero: HeroId;
}

/** FNV-1a hash of a string, as an unsigned 32-bit seed. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

export function dailyChallenge(now = new Date()): DailyChallenge {
  const date = now.toISOString().slice(0, 10);
  const seed = hash(`neon-wardens:${date}`);
  const rng = seededRng(seed);
  const level = LEVELS[Math.floor(rng() * LEVELS.length)];
  const hero = HERO_IDS[Math.floor(rng() * HERO_IDS.length)];
  return { date, seed, level, hero };
}

/** Points per wave cleared, per life left, and for winning. */
export const DAILY_SCORE = { wave: 100, life: 50, win: 1000 } as const;

/** Waves held (all of them after a win) × 100, + lives left × 50, + 1000 for a win. */
export function dailyScore(game: Game): number {
  const won = game.phase === 'won';
  const cleared = won ? game.totalWaves : Math.max(0, game.wavesStarted - (game.phase === 'wave' || game.phase === 'lost' ? 1 : 0));
  return cleared * DAILY_SCORE.wave + game.lives * DAILY_SCORE.life + (won ? DAILY_SCORE.win : 0);
}
