import type { ElementId } from './elements';

export type MovementType = 'ground' | 'air';

export type EnemyId =
  | 'grunt' | 'runner' | 'brute' | 'swarm' | 'drone' | 'wyvern'
  // Introduced by later maps
  | 'shielder' | 'medic' | 'splitter' | 'shard' | 'ghost' | 'phaser' | 'carrier'
  | 'jammer' | 'mirror'
  | 'disruptor' | 'prism'
  | 'burrower' | 'warden'
  | 'surger'
  // Bosses (one in each map's final wave)
  | 'colossus' | 'bulwark' | 'chimera' | 'leviathan';

/**
 * Special abilities (rules in `Game.updateAbilities` and `systems/combat`):
 * - shield: a shield of `fraction` × max HP absorbs damage first; status effects don't land while it holds.
 * - heal: every `interval` s, heals other enemies within `radius` tiles by `fraction` of their max HP.
 * - split: on death, releases `count` enemies of type `into` at the same spot.
 * - stealth: towers can only target it if any tower is within `revealRange` tiles (splash still hits).
 * - blink: every `interval` s, jumps `distance` tiles ahead on its route (not while stopped).
 * - spawn: every `interval` s, launches one `child` enemy from its position.
 * - jam: while within `radius` tiles of the hero, the hero's ability cooldowns stop.
 * - mirror: immune to the hero's attacks and abilities (towers only).
 * - disrupt: every `interval` s, if any tower is within `radius` tiles, those towers stop working
 *   for `duration` s (waits until a tower is in reach).
 * - shift: every `interval` s, its element moves one step around the cycle
 *   (Water → Fire → Metal → Wood → Earth → Water).
 * - burrow: every `interval` s (counted while on the surface, and not while stopped), dives for
 *   `duration` s: it keeps moving but can't be targeted or damaged by anything.
 * - fortify: other enemies within `radius` tiles get +`armor` armor.
 */
export type AbilityDef =
  | { kind: 'shield'; fraction: number }
  | { kind: 'heal'; radius: number; fraction: number; interval: number }
  | { kind: 'split'; into: EnemyId; count: number }
  | { kind: 'stealth'; revealRange: number }
  | { kind: 'blink'; distance: number; interval: number }
  | { kind: 'spawn'; child: EnemyId; interval: number }
  | { kind: 'jam'; radius: number }
  | { kind: 'mirror' }
  | { kind: 'disrupt'; radius: number; duration: number; interval: number }
  | { kind: 'shift'; interval: number }
  | { kind: 'burrow'; interval: number; duration: number }
  | { kind: 'fortify'; radius: number; armor: number }
  /** Other enemies within `radius` move `speed`× as fast (recomputed every tick). */
  | { kind: 'surge'; radius: number; speed: number };

/**
 * What a boss does when its HP first drops to a phase threshold (rules in `Game.updateBoss`):
 * - summon: releases `count` enemies of type `enemy` (same HP multiplier as the boss).
 * - shield: a fresh shield of `fraction` × max HP (blocks status effects while it holds).
 * - enrage: moves `speed`× as fast from now on.
 * - shift: its element moves one step around the cycle.
 * - cleanse: shakes off burn, chill, freeze, root, poison, and stun (armor break stays).
 */
export type BossAction =
  | { kind: 'summon'; enemy: EnemyId; count: number }
  | { kind: 'shield'; fraction: number }
  | { kind: 'enrage'; speed: number }
  | { kind: 'shift' }
  | { kind: 'cleanse' };

export interface BossPhase {
  /** Triggers the first time HP falls to this fraction of max HP. */
  at: number;
  /** Shown on the map when the phase starts, e.g. "OVERDRIVE". */
  name: string;
  actions: BossAction[];
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  /** Tiles per second. */
  speed: number;
  armor: number;
  /** Ground units follow the path; air units fly straight from spawn to base. */
  movement: MovementType;
  /** Default element (weakness cycle and battlefields). A wave group can override it. */
  element?: ElementId;
  /** Gold given on kill. */
  reward: number;
  /** Lives lost when this enemy reaches the base. */
  livesCost: number;
  /** Draw radius in tiles. */
  radius: number;
  /** Neon trim and visor color. */
  color: string;
  ability?: AbilityDef;
  /** Bosses: phases in order of falling HP. Shown with a big HP bar at the top of the map. */
  phases?: BossPhase[];
  /** Player-facing one-liner (map select, wave preview tooltips). */
  description: string;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  grunt: {
    id: 'grunt', name: 'Grunt',
    hp: 30, speed: 1.4, armor: 1, movement: 'ground',
    reward: 6, livesCost: 1, radius: 0.24, color: '#ff3864',
    description: 'Basic, balanced',
  },
  runner: {
    id: 'runner', name: 'Runner',
    hp: 18, speed: 2.6, armor: 0, movement: 'ground', element: 'water',
    reward: 5, livesCost: 1, radius: 0.19, color: '#ffe600',
    description: 'Fast, low HP',
  },
  brute: {
    id: 'brute', name: 'Brute',
    hp: 130, speed: 0.85, armor: 6, movement: 'ground', element: 'metal',
    reward: 16, livesCost: 2, radius: 0.34, color: '#b967ff',
    description: 'Slow and heavily armored',
  },
  swarm: {
    id: 'swarm', name: 'Swarm',
    hp: 7, speed: 1.8, armor: 0, movement: 'ground', element: 'wood',
    reward: 1, livesCost: 1, radius: 0.12, color: '#ff9f1c',
    description: 'Tiny units in big groups',
  },
  drone: {
    id: 'drone', name: 'Drone',
    hp: 22, speed: 1.6, armor: 0, movement: 'air', element: 'earth',
    reward: 6, livesCost: 1, radius: 0.22, color: '#ff2bd6',
    description: 'Flies straight at the core',
  },
  wyvern: {
    id: 'wyvern', name: 'Wyvern',
    hp: 110, speed: 1.05, armor: 4, movement: 'air', element: 'fire',
    reward: 16, livesCost: 2, radius: 0.34, color: '#00ffc8',
    description: 'Armored flyer',
  },

  // Harbor Grid
  shielder: {
    id: 'shielder', name: 'Shielder',
    hp: 45, speed: 1.2, armor: 2, movement: 'ground', element: 'metal',
    reward: 9, livesCost: 1, radius: 0.27, color: '#4dd2ff',
    ability: { kind: 'shield', fraction: 0.8 },
    description: 'Energy shield absorbs damage and blocks status effects until it breaks',
  },
  medic: {
    id: 'medic', name: 'Medic',
    hp: 40, speed: 1.1, armor: 1, movement: 'ground', element: 'wood',
    reward: 10, livesCost: 1, radius: 0.25, color: '#7dffb0',
    ability: { kind: 'heal', radius: 1.6, fraction: 0.12, interval: 2 },
    description: 'Heals nearby enemies every 2s; kill it first',
  },

  // Chrome Canyon
  splitter: {
    id: 'splitter', name: 'Splitter',
    hp: 50, speed: 1.1, armor: 1, movement: 'ground', element: 'earth',
    reward: 6, livesCost: 1, radius: 0.29, color: '#ff8a3d',
    ability: { kind: 'split', into: 'shard', count: 3 },
    description: 'Breaks into 3 Shards when destroyed',
  },
  shard: {
    id: 'shard', name: 'Shard',
    hp: 12, speed: 1.9, armor: 0, movement: 'ground', element: 'earth',
    reward: 1, livesCost: 1, radius: 0.13, color: '#ffb27a',
    description: 'Fast fragment of a Splitter',
  },
  ghost: {
    id: 'ghost', name: 'Ghost',
    hp: 38, speed: 1.5, armor: 0, movement: 'ground', element: 'water',
    reward: 8, livesCost: 1, radius: 0.23, color: '#c9b8ff',
    ability: { kind: 'stealth', revealRange: 2 },
    description: 'Invisible to towers unless one is within 2 tiles; splash still hits it',
  },

  // Orbital Spire
  phaser: {
    id: 'phaser', name: 'Phaser',
    hp: 42, speed: 1.2, armor: 1, movement: 'ground', element: 'fire',
    reward: 8, livesCost: 1, radius: 0.24, color: '#ff5af0',
    ability: { kind: 'blink', distance: 2.5, interval: 3 },
    description: 'Teleports 2.5 tiles ahead every 3s (not while stunned, frozen, or rooted)',
  },
  carrier: {
    id: 'carrier', name: 'Carrier',
    hp: 160, speed: 0.6, armor: 3, movement: 'air', element: 'water',
    reward: 20, livesCost: 3, radius: 0.4, color: '#5affd8',
    ability: { kind: 'spawn', child: 'drone', interval: 3.5 },
    description: 'Slow flying ship that launches a Drone every 3.5s',
  },

  // Zero Point (the hero map)
  jammer: {
    id: 'jammer', name: 'Jammer',
    hp: 55, speed: 1.15, armor: 2, movement: 'ground', element: 'metal',
    reward: 10, livesCost: 1, radius: 0.27, color: '#ffd23f',
    ability: { kind: 'jam', radius: 2.5 },
    description: "Freezes the hero's ability cooldowns while it's within 2.5 tiles of the hero",
  },
  mirror: {
    id: 'mirror', name: 'Mirror',
    hp: 60, speed: 1.0, armor: 3, movement: 'ground', element: 'water',
    reward: 10, livesCost: 1, radius: 0.28, color: '#e6f0ff',
    ability: { kind: 'mirror' },
    description: "Immune to the hero's attacks and abilities; only towers can hurt it",
  },

  // Blackout Sector
  disruptor: {
    id: 'disruptor', name: 'Disruptor',
    hp: 60, speed: 1.1, armor: 2, movement: 'ground', element: 'fire',
    reward: 11, livesCost: 1, radius: 0.27, color: '#8fb4ff',
    ability: { kind: 'disrupt', radius: 1.6, duration: 2.5, interval: 4 },
    description: 'Every 4s knocks out towers within 1.6 tiles for 2.5s; outrange it',
  },
  prism: {
    id: 'prism', name: 'Prism',
    hp: 55, speed: 1.3, armor: 1, movement: 'ground', element: 'water',
    reward: 9, livesCost: 1, radius: 0.25, color: '#f6a8ff',
    ability: { kind: 'shift', interval: 2.5 },
    description: 'Changes element every 2.5s; no single tower element stays strong against it',
  },

  // Core Nexus
  burrower: {
    id: 'burrower', name: 'Burrower',
    hp: 75, speed: 1.25, armor: 3, movement: 'ground', element: 'earth',
    reward: 11, livesCost: 1, radius: 0.27, color: '#e0a060',
    ability: { kind: 'burrow', interval: 4, duration: 1.8 },
    description: 'Dives underground for 1.8s every 4s: untouchable while below; stuns delay it',
  },
  warden: {
    id: 'warden', name: 'Warden',
    hp: 120, speed: 0.9, armor: 5, movement: 'ground', element: 'wood',
    reward: 18, livesCost: 2, radius: 0.33, color: '#c0ff3d',
    ability: { kind: 'fortify', radius: 1.8, armor: 5 },
    description: 'Gives other enemies within 1.8 tiles +5 armor; Metal pierce and Earth break it',
  },
  surger: {
    id: 'surger', name: 'Surger',
    hp: 80, speed: 1.15, armor: 2, movement: 'ground', element: 'fire',
    reward: 14, livesCost: 1, radius: 0.3, color: '#ff8a3d',
    ability: { kind: 'surge', radius: 1.8, speed: 1.35 },
    description: 'Other enemies within 1.8 tiles move 35% faster; kill it first, or slow the whole group',
  },

  // Bosses: huge HP pools with phases. Wave groups set their HP multiplier and element per map.
  colossus: {
    id: 'colossus', name: 'Siege Colossus',
    hp: 1000, speed: 0.5, armor: 8, movement: 'ground', element: 'metal',
    reward: 120, livesCost: 10, radius: 0.5, color: '#ff3864',
    phases: [
      { at: 0.66, name: 'Escorts', actions: [{ kind: 'summon', enemy: 'brute', count: 2 }, { kind: 'summon', enemy: 'grunt', count: 6 }] },
      { at: 0.33, name: 'Overdrive', actions: [{ kind: 'cleanse' }, { kind: 'enrage', speed: 1.6 }] },
    ],
    description: 'Calls escorts at 66% HP; at 33% shakes off effects and speeds up',
  },
  bulwark: {
    id: 'bulwark', name: 'Bulwark',
    hp: 700, speed: 0.6, armor: 4, movement: 'ground', element: 'water',
    reward: 100, livesCost: 8, radius: 0.48, color: '#4dd2ff',
    ability: { kind: 'shield', fraction: 0.5 },
    phases: [
      { at: 0.6, name: 'Shield Wall', actions: [{ kind: 'shield', fraction: 0.4 }, { kind: 'summon', enemy: 'shielder', count: 3 }] },
      { at: 0.25, name: 'Last Stand', actions: [{ kind: 'shield', fraction: 0.3 }, { kind: 'enrage', speed: 1.4 }] },
    ],
    description: 'Starts shielded and raises new shields at 60% and 25% HP',
  },
  chimera: {
    id: 'chimera', name: 'Chimera',
    hp: 900, speed: 0.6, armor: 3, movement: 'ground', element: 'fire',
    reward: 100, livesCost: 8, radius: 0.48, color: '#f6a8ff',
    phases: [
      { at: 0.75, name: 'Mutation', actions: [{ kind: 'shift' }, { kind: 'summon', enemy: 'splitter', count: 2 }] },
      { at: 0.5, name: 'Mutation', actions: [{ kind: 'shift' }, { kind: 'cleanse' }, { kind: 'summon', enemy: 'splitter', count: 2 }] },
      { at: 0.25, name: 'Mutation', actions: [{ kind: 'shift' }, { kind: 'summon', enemy: 'splitter', count: 2 }, { kind: 'enrage', speed: 1.3 }] },
    ],
    description: 'Changes element at 75%, 50%, and 25% HP and sheds Splitters',
  },
  leviathan: {
    id: 'leviathan', name: 'Sky Leviathan',
    hp: 1000, speed: 0.42, armor: 5, movement: 'air', element: 'water',
    reward: 120, livesCost: 8, radius: 0.6, color: '#5affd8',
    ability: { kind: 'spawn', child: 'drone', interval: 7 },
    phases: [
      { at: 0.66, name: 'Deflector', actions: [{ kind: 'shield', fraction: 0.25 }] },
      { at: 0.33, name: 'Launch Bay', actions: [{ kind: 'summon', enemy: 'drone', count: 4 }, { kind: 'summon', enemy: 'wyvern', count: 1 }, { kind: 'enrage', speed: 1.15 }] },
    ],
    description: 'Flying fortress that launches Drones; shields at 66%, empties its hangar at 33%',
  },
};

/** Whether this enemy type is a boss. */
export function isBoss(def: EnemyDef): boolean {
  return def.phases !== undefined;
}
