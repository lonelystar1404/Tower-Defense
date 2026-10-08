import { ELEMENTS, type ElementId } from './elements';
import type { MovementType } from './enemies';
import { WEAPONS, type AttackDef, type WeaponId } from './weapons';

/** A tower is an element on a weapon (build Option A: pick both, pay once). */
export interface TowerOption {
  weapon: WeaponId;
  element: ElementId;
}

/** Build menu order. Any weapon can carry any element. */
export const BUILD_WEAPONS: readonly WeaponId[] = ['cannon', 'flak', 'multi', 'mortar', 'chain', 'sniper'];
export const BUILD_ELEMENTS: readonly ElementId[] = ['fire', 'water', 'wood', 'earth', 'metal'];

/** Named combinations; anything not listed falls back to "<Element> <Weapon>". */
const TOWER_NAMES: Partial<Record<`${ElementId}-${WeaponId}`, string>> = {
  'fire-cannon': 'Blaze Cannon',
  'fire-flak': 'Flare Battery',
  'fire-multi': 'Ember Volley',
  'fire-mortar': 'Inferno Mortar',
  'fire-chain': 'Fire Whip',
  'fire-sniper': 'Sunlance',
  'water-cannon': 'Hailstone Cannon',
  'water-flak': 'Frost Flak',
  'water-multi': 'Sleet Volley',
  'water-mortar': 'Glacier Mortar',
  'water-chain': 'Frost Arc',
  'water-sniper': 'Icicle Lance',
  'wood-cannon': 'Thorn Cannon',
  'wood-flak': 'Bramble Flak',
  'wood-multi': 'Seed Volley',
  'wood-mortar': 'Spore Mortar',
  'wood-chain': 'Thornweb',
  'wood-sniper': 'Stinger',
  'earth-cannon': 'Quake Cannon',
  'earth-flak': 'Gravel Flak',
  'earth-multi': 'Rockslide',
  'earth-mortar': 'Boulder Mortar',
  'earth-chain': 'Fault Line',
  'earth-sniper': 'Obsidian Spike',
  'metal-cannon': 'Steel Cannon',
  'metal-flak': 'Flak Battery',
  'metal-multi': 'Steel Volley',
  'metal-mortar': 'Iron Mortar',
  'metal-chain': 'Tesla Coil',
  'metal-sniper': 'Railgun',
};

/**
 * Lockdown: each wave a random share of element × weapon combos can't be built. Towers already
 * built keep working and can still be upgraded. The minimums keep every weapon and every
 * element usable, so the build menu never loses a whole role (e.g. all anti-air).
 */
export const LOCKDOWN = {
  /** Share of all combos locked each wave (a level can override with `lockFraction`). */
  fraction: 0.7,
  minOpenPerWeapon: 1,
  minOpenPerElement: 1,
} as const;

/** Fraction of the gold spent on a tower that selling it gives back. */
export const SELL_REFUND = 0.7;

/** Upgrade levels. Index 0 is level 1 (as built). Multipliers apply to the level-1 stats. */
export const TOWER_LEVELS = [
  { costMult: 0, damageMult: 1, rangeMult: 1, fireRateMult: 1, effectPower: 1 },
  { costMult: 0.6, damageMult: 1.5, rangeMult: 1.1, fireRateMult: 1, effectPower: 1.25 },
  { costMult: 1, damageMult: 2.2, rangeMult: 1.25, fireRateMult: 1.15, effectPower: 1.5 },
] as const;

export const MAX_TOWER_LEVEL = TOWER_LEVELS.length;

export interface TowerStats {
  damage: number;
  fireRate: number;
  range: number;
  projectileSpeed: number;
  armorPierce: number;
  critChance: number;
  airBonus: number;
  targets: readonly MovementType[];
  attack: AttackDef;
  /** Strength of the element's status effect (1 at level 1; see systems/status). */
  effectPower: number;
}

export function towerName({ weapon, element }: TowerOption): string {
  return TOWER_NAMES[`${element}-${weapon}`] ?? `${ELEMENTS[element].name} ${WEAPONS[weapon].name}`;
}

export function towerCost({ weapon }: TowerOption): number {
  return WEAPONS[weapon].cost;
}

/** Gold to go from `level - 1` to `level`, rounded to 5. */
export function upgradeCost(option: TowerOption, level: number): number {
  return Math.round((towerCost(option) * TOWER_LEVELS[level - 1].costMult) / 5) * 5;
}

export function towerStats({ weapon, element }: TowerOption, level = 1): TowerStats {
  const w = WEAPONS[weapon];
  const e = ELEMENTS[element];
  const l = TOWER_LEVELS[level - 1];
  return {
    damage: w.damage * e.damageMult * l.damageMult,
    fireRate: w.fireRate * l.fireRateMult,
    range: w.range * l.rangeMult,
    projectileSpeed: w.projectileSpeed,
    armorPierce: e.armorPierce,
    critChance: e.critChance * l.effectPower,
    airBonus: w.airBonus,
    targets: w.targets,
    attack: w.attack,
    effectPower: l.effectPower,
  };
}
