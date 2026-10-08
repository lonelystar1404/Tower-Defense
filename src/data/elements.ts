/**
 * Elements: what a tower's attack *does*.
 * Only Metal is playable in the first build; the others carry colors and base numbers so the
 * renderer and weakness cycle already work when their status effects are added.
 */

export type ElementId = 'fire' | 'water' | 'wood' | 'earth' | 'metal';

export interface ElementDef {
  id: ElementId;
  name: string;
  icon: string;
  /** What the element is for, in a few words. */
  role: string;
  /** Neon trim color. */
  color: string;
  /** Bright highlight (cores, sparks). */
  accent: string;
  /** Deep tint for armor panels. */
  dark: string;
  /** Multiplies the weapon's base damage. */
  damageMult: number;
  /** Fraction of the target's armor this element ignores (0..1). */
  armorPierce: number;
  /** Chance (0..1) that a hit is a critical hit. */
  critChance: number;
}

export const ELEMENTS: Record<ElementId, ElementDef> = {
  fire: {
    id: 'fire', name: 'Fire', icon: '🔥', role: 'Damage over time',
    color: '#ff5a36', accent: '#ffc46b', dark: '#4a1208',
    damageMult: 1, armorPierce: 0, critChance: 0,
  },
  water: {
    id: 'water', name: 'Water', icon: '💧', role: 'Crowd control',
    color: '#00e5ff', accent: '#c8fbff', dark: '#063a4a',
    damageMult: 1.1, armorPierce: 0, critChance: 0,
  },
  wood: {
    id: 'wood', name: 'Wood', icon: '🌳', role: 'Area control / support',
    color: '#39ff88', accent: '#c4ffd9', dark: '#0b3d22',
    damageMult: 0.9, armorPierce: 0, critChance: 0,
  },
  earth: {
    id: 'earth', name: 'Earth', icon: '🪨', role: 'Heavy hitter vs. armor',
    color: '#ffb020', accent: '#ffe2a0', dark: '#4a3008',
    damageMult: 1.15, armorPierce: 0, critChance: 0,
  },
  metal: {
    id: 'metal', name: 'Metal', icon: '⚙️', role: 'Raw damage',
    color: '#c9d1ff', accent: '#ffffff', dark: '#2c3050',
    damageMult: 1.15, armorPierce: 0.5, critChance: 0.2,
  },
};

/** Five Elements cycle: each key overcomes its value. */
export const OVERCOMES: Record<ElementId, ElementId> = {
  water: 'fire',
  fire: 'metal',
  metal: 'wood',
  wood: 'earth',
  earth: 'water',
};

/** Damage multiplier when the attacking element overcomes the enemy's element. */
export const WEAKNESS_BONUS = 1.5;
/** Damage multiplier when the enemy's element overcomes the attacking element. */
export const RESIST_PENALTY = 0.75;
