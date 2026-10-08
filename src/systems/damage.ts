import { weakenedElement, type BattlefieldDef } from '../data/battlefields';
import { OVERCOMES, RESIST_PENALTY, WEAKNESS_BONUS, type ElementId } from '../data/elements';

/** The one and only damage formula. Every tower goes through `computeDamage`. */

export const CRIT_MULTIPLIER = 2;
export const MIN_DAMAGE = 1;

export interface DamageInput {
  base: number;
  elementMult: number;
  crit: boolean;
  armor: number;
  /** Armor removed by Armor Break. */
  armorBreak?: number;
  /** Fraction of the remaining armor ignored (Metal pierce). */
  armorPierce?: number;
}

export function effectiveArmor(armor: number, armorBreak = 0, armorPierce = 0): number {
  return Math.max(0, armor - armorBreak) * (1 - armorPierce);
}

/** final = base × elementMultiplier × (crit ? 2 : 1) − effectiveArmor, minimum 1. */
export function computeDamage(input: DamageInput): number {
  const armor = effectiveArmor(input.armor, input.armorBreak, input.armorPierce);
  const raw = input.base * input.elementMult * (input.crit ? CRIT_MULTIPLIER : 1) - armor;
  return Math.max(MIN_DAMAGE, raw);
}

/** Weakness-cycle multiplier for an attack element against an (optional) enemy element. */
export function elementMultiplier(attack: ElementId, defender?: ElementId): number {
  if (!defender) return 1;
  if (OVERCOMES[attack] === defender) return WEAKNESS_BONUS;
  if (OVERCOMES[defender] === attack) return RESIST_PENALTY;
  return 1;
}

/**
 * Battlefield shift on one hit. The attacking tower deals +bonus if its element is the
 * battlefield's and −bonus if it's the element the battlefield weakens; the enemy takes −bonus
 * if its element is the battlefield's (boosted) and +bonus if it's the weakened one.
 */
export function battlefieldMultiplier(
  attack: ElementId,
  defender: ElementId | undefined,
  field: BattlefieldDef | null,
  bonus: number,
): number {
  if (!field || bonus === 0) return 1;
  const weak = weakenedElement(field);
  const tower = attack === field.element ? 1 + bonus : attack === weak ? 1 - bonus : 1;
  const enemy = defender === field.element ? 1 - bonus : defender === weak ? 1 + bonus : 1;
  return tower * enemy;
}
