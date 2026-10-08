import type { ElementId } from './elements';

/**
 * Element combos: two different elements meeting on one enemy. Tuning numbers live here; the
 * rules are in `applyHit` (src/systems/combat.ts) and `Game.hit` (spreading and splash).
 * Combos only come from tower hits (heroes have no element).
 */
export type ComboId = 'steam' | 'wildfire' | 'shatter' | 'corrosion' | 'rupture';

export interface ComboDef {
  id: ComboId;
  name: string;
  elements: readonly [ElementId, ElementId];
  /** Popup and effect color. */
  color: string;
  /** Player-facing: what triggers it and what it does. */
  description: string;
}

export const COMBO_NUMBERS = {
  steam: {
    /** Burst = this share of the triggering hit, plus all burn damage the enemy had left. Ignores armor. */
    hitFraction: 0.6,
    /** Enemies within this radius take `splashFraction` of the burst. */
    splashRadius: 0.9,
    splashFraction: 0.5,
  },
  wildfire: {
    /** The burn jumps to enemies within this radius. */
    spreadRadius: 1.3,
    /** The same enemy can't start another spread for this many seconds. */
    cooldown: 1,
  },
  shatter: {
    /** Damage multiplier on the Earth/Metal hit that breaks a freeze. */
    damageMult: 2,
  },
  corrosion: {
    /** Extra armor removed on top of Earth's normal armor break. */
    extraArmorBreak: 2,
  },
} as const;

export const COMBOS: Record<ComboId, ComboDef> = {
  steam: {
    id: 'steam', name: 'Steam', elements: ['fire', 'water'], color: '#e6f7ff',
    description: 'Fire on a chilled enemy (or Water on a burning one): a steam burst that ignores armor and splashes. Burn and chill end.',
  },
  wildfire: {
    id: 'wildfire', name: 'Wildfire', elements: ['fire', 'wood'], color: '#ff8a3d',
    description: 'An enemy both burning and poisoned spreads its burn to every enemy within 1.3 tiles.',
  },
  shatter: {
    id: 'shatter', name: 'Shatter', elements: ['water', 'earth'], color: '#bff4ff',
    description: 'An Earth or Metal hit on a frozen enemy does double damage and ends the freeze.',
  },
  corrosion: {
    id: 'corrosion', name: 'Corrosion', elements: ['wood', 'earth'], color: '#c6ff4a',
    description: 'An Earth hit on a poisoned enemy breaks twice as much armor and adds a poison stack.',
  },
  rupture: {
    id: 'rupture', name: 'Rupture', elements: ['earth', 'metal'], color: '#ffd23f',
    description: 'Once Earth has broken all of an enemy’s armor, Metal hits on it always crit.',
  },
};

export const COMBO_IDS = Object.keys(COMBOS) as ComboId[];

/** Combos an element can take part in (Shatter also counts Metal as its finisher). */
export function combosFor(element: ElementId): ComboDef[] {
  return COMBO_IDS.map((id) => COMBOS[id]).filter(
    (c) => c.elements.includes(element) || (c.id === 'shatter' && element === 'metal'),
  );
}
