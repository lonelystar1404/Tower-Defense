import type { MovementType } from './enemies';
import type { TargetPriority } from '../systems/targeting';

/**
 * Weapon types: what a tower *can hit*, and how.
 * Rule of thumb: the more a weapon can target, the less damage it does to each target.
 */

export type WeaponId = 'cannon' | 'flak' | 'multi' | 'mortar' | 'chain' | 'sniper';

/** How a shot is delivered. */
export type AttackDef =
  /** One homing projectile at one target. */
  | { kind: 'single' }
  /** One homing projectile at each of up to `maxTargets` different targets. */
  | { kind: 'multi'; maxTargets: number }
  /**
   * A shell that lands where the target is expected to be and hits everything within `radius`.
   * It leads its target assuming a speed of at most `leadSpeedCap`, so faster enemies can dodge.
   */
  | { kind: 'splash'; radius: number; leadSpeedCap: number }
  /** Instant hit that jumps to up to `jumps` more enemies within `jumpRange`, losing `falloff` each jump. */
  | { kind: 'chain'; jumps: number; jumpRange: number; falloff: number };

export interface WeaponDef {
  id: WeaponId;
  name: string;
  role: string;
  /** Which movement types this weapon can target. */
  targets: readonly MovementType[];
  attack: AttackDef;
  /** Base damage per hit, before element and armor. */
  damage: number;
  /** Damage multiplier against air units. */
  airBonus: number;
  /** Shots per second. */
  fireRate: number;
  /** Range in tiles, measured from the tower's center. */
  range: number;
  /** Projectile speed in tiles per second (unused by instant attacks). */
  projectileSpeed: number;
  cost: number;
  defaultPriority: TargetPriority;
  /** Player-facing one-liners for the info panel. */
  strength: string;
  weakness: string;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  cannon: {
    id: 'cannon', name: 'Cannon', role: 'Anti-Ground',
    targets: ['ground'], attack: { kind: 'single' },
    damage: 21, airBonus: 1, fireRate: 0.8, range: 2.8, projectileSpeed: 9,
    cost: 50, defaultPriority: 'first',
    strength: 'High damage per hit', weakness: "Can't hit air",
  },
  flak: {
    id: 'flak', name: 'Flak', role: 'Anti-Air',
    targets: ['air'], attack: { kind: 'single' },
    damage: 5, airBonus: 1.5, fireRate: 2, range: 3.2, projectileSpeed: 13,
    cost: 45, defaultPriority: 'first',
    strength: 'Bonus damage vs. air', weakness: "Can't hit ground",
  },
  multi: {
    id: 'multi', name: 'Multi-Shot', role: '3 targets',
    targets: ['ground', 'air'], attack: { kind: 'multi', maxTargets: 3 },
    damage: 3.1, airBonus: 1, fireRate: 0.85, range: 2.4, projectileSpeed: 11,
    cost: 70, defaultPriority: 'first',
    strength: 'Good against crowds', weakness: 'Low damage per target',
  },
  mortar: {
    id: 'mortar', name: 'Mortar', role: 'Splash',
    targets: ['ground'], attack: { kind: 'splash', radius: 1.1, leadSpeedCap: 2 },
    damage: 16, airBonus: 1, fireRate: 0.45, range: 3.4, projectileSpeed: 4.5,
    cost: 70, defaultPriority: 'first',
    strength: 'Great against tight groups', weakness: 'Slow, ground only; fast enemies can dodge',
  },
  chain: {
    id: 'chain', name: 'Chain', role: 'Chains',
    targets: ['ground', 'air'], attack: { kind: 'chain', jumps: 3, jumpRange: 1.6, falloff: 0.3 },
    damage: 12.5, airBonus: 1, fireRate: 0.6, range: 2.4, projectileSpeed: 0,
    cost: 75, defaultPriority: 'first',
    strength: 'Spreads element effects fast', weakness: 'Damage drops with each jump',
  },
  sniper: {
    id: 'sniper', name: 'Sniper', role: 'Long range',
    targets: ['ground', 'air'], attack: { kind: 'single' },
    damage: 34, airBonus: 1, fireRate: 0.3, range: 6, projectileSpeed: 32,
    cost: 100, defaultPriority: 'strongest',
    strength: 'Kills high-value targets from far away', weakness: 'Useless against swarms',
  },
};
