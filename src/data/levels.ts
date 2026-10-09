import type { ElementId } from './elements';
import { BLACKOUT_SECTOR } from './maps/blackoutSector';
import { CHROME_CANYON } from './maps/chromeCanyon';
import { CORE_NEXUS } from './maps/coreNexus';
import { HARBOR_GRID } from './maps/harborGrid';
import { NEON_DISTRICT } from './maps/neonDistrict';
import { ORBITAL_SPIRE } from './maps/orbitalSpire';
import { OVERLINK } from './maps/overlink';
import { GRIDLOCK } from './maps/gridlock';
import { ZERO_POINT } from './maps/zeroPoint';
import type { EnemyId } from './enemies';

export interface SpawnGroup {
  enemy: EnemyId;
  count: number;
  /** Seconds between spawns in this group. */
  interval: number;
  /** Seconds after the wave starts before this group's first spawn. */
  delay?: number;
  /** Multiplies the enemy's base HP. */
  hpMult?: number;
  /** Element for this group, overriding the enemy's default; null means no element. */
  element?: ElementId | null;
}

export interface WaveDef {
  groups: SpawnGroup[];
  /** Gold given when the wave is cleared. */
  bonus: number;
  /** Multiplies kill rewards in this wave (late waves pay less per kill so gold doesn't snowball). */
  rewardMult?: number;
}

/**
 * Blocked ground: no tower can be built on these tiles. Purely about building; enemies, the hero,
 * and shots pass over them. `kind` only changes the look.
 * - tower: a skyscraper block. - canal: a coolant canal. - wreck: rubble behind hazard barriers.
 */
export type ObstacleKind = 'tower' | 'canal' | 'wreck';

export interface ObstacleDef {
  kind: ObstacleKind;
  /** Top-left tile. */
  col: number;
  row: number;
  /** Size in tiles (default 1 × 1). */
  w?: number;
  h?: number;
}

/** Every tile covered by a list of obstacles, as [col, row]. */
export function obstacleTiles(obstacles: readonly ObstacleDef[] = []): [number, number][] {
  const tiles: [number, number][] = [];
  for (const o of obstacles) {
    for (let r = o.row; r < o.row + (o.h ?? 1); r++) for (let c = o.col; c < o.col + (o.w ?? 1); c++) tiles.push([c, r]);
  }
  return tiles;
}

/** Seconds to get ready between waves before the next one starts on its own. */
export const PREP_TIME = 30;

export interface LevelDef {
  id: string;
  name: string;
  /** One line for the map select screen. */
  description: string;
  cols: number;
  rows: number;
  /**
   * Ground path waypoints in tile coordinates (column, row). Segments must be horizontal or vertical.
   * The first point may be off the map (enemies walk in); the last point is the base.
   */
  path: [number, number][];
  /** Flight route for air units. Defaults to a straight line from the path's start to the base. */
  airPath?: [number, number][];
  startGold: number;
  lives: number;
  /** Share of tower combos locked each wave; defaults to LOCKDOWN.fraction. 0 turns lockdown off. */
  lockFraction?: number;
  /** Battlefield damage shift; defaults to BATTLEFIELD_BONUS. 0 turns battlefield effects off. */
  battlefieldBonus?: number;
  /** Seconds between waves; defaults to PREP_TIME. 0 means no timer (wait for Ready). */
  prepTime?: number;
  /** Tiles where towers can't be built (buildings, canals, wreckage). */
  obstacles?: ObstacleDef[];
  /** Multiplies every enemy's HP on this map (default 1): one knob to tune a whole map's difficulty. */
  hpScale?: number;
  /** Tile where the hero starts; maps without it have no hero. */
  heroStart?: [number, number];
  /**
   * How the hero is picked on a hero map: 'random' assigns one of the player's unlocked heroes
   * (no hero select; Reboot keeps it, a new run re-rolls); 'choose' (default) shows hero select.
   */
  heroMode?: 'random' | 'choose';
  /** Playable from the start, without clearing the map before it. */
  unlocked?: boolean;
  /**
   * Opens together with this map (by id) instead of after the map before it: the first
   * multiplayer map opens with Chrome Canyon (Map 3).
   */
  unlockedWith?: string;
  /**
   * A multiplayer map (Maps 8 and 9): played in Single mode (one hero) or Multiplayer (2–5 players,
   * one hero and their own gold each; see PARTY). Built to need a party.
   */
  multiplayer?: boolean;
  waves: WaveDef[];
}

/** All maps in play order. Beating a map unlocks the next one. */
export const LEVELS: LevelDef[] = [NEON_DISTRICT, HARBOR_GRID, CHROME_CANYON, ORBITAL_SPIRE, ZERO_POINT, BLACKOUT_SECTOR, CORE_NEXUS, OVERLINK, GRIDLOCK];
