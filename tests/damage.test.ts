import { describe, expect, it } from 'vitest';
import { computeDamage, effectiveArmor, elementMultiplier, MIN_DAMAGE } from '../src/systems/damage';
import { RESIST_PENALTY, WEAKNESS_BONUS } from '../src/data/elements';

describe('effectiveArmor', () => {
  it('subtracts armor break before applying pierce', () => {
    expect(effectiveArmor(10, 4, 0.5)).toBe(3);
  });

  it('never goes below zero', () => {
    expect(effectiveArmor(3, 10)).toBe(0);
    expect(effectiveArmor(3, 10, 0.5)).toBe(0);
  });

  it('defaults to plain armor', () => {
    expect(effectiveArmor(5)).toBe(5);
  });
});

describe('computeDamage', () => {
  it('applies base × element − armor', () => {
    expect(computeDamage({ base: 20, elementMult: 1.5, crit: false, armor: 4 })).toBe(26);
  });

  it('doubles damage on crit before armor is subtracted', () => {
    expect(computeDamage({ base: 10, elementMult: 1, crit: true, armor: 5 })).toBe(15);
  });

  it('applies pierce and armor break', () => {
    expect(
      computeDamage({ base: 10, elementMult: 1, crit: false, armor: 8, armorBreak: 2, armorPierce: 0.5 }),
    ).toBe(7);
  });

  it('never deals less than the minimum', () => {
    expect(computeDamage({ base: 2, elementMult: 0.75, crit: false, armor: 50 })).toBe(MIN_DAMAGE);
  });
});

describe('elementMultiplier', () => {
  it('is neutral against enemies with no element', () => {
    expect(elementMultiplier('fire')).toBe(1);
  });

  it('follows the overcome cycle Water → Fire → Metal → Wood → Earth → Water', () => {
    expect(elementMultiplier('water', 'fire')).toBe(WEAKNESS_BONUS);
    expect(elementMultiplier('fire', 'metal')).toBe(WEAKNESS_BONUS);
    expect(elementMultiplier('metal', 'wood')).toBe(WEAKNESS_BONUS);
    expect(elementMultiplier('wood', 'earth')).toBe(WEAKNESS_BONUS);
    expect(elementMultiplier('earth', 'water')).toBe(WEAKNESS_BONUS);
  });

  it('is resisted in the reverse direction', () => {
    expect(elementMultiplier('fire', 'water')).toBe(RESIST_PENALTY);
    expect(elementMultiplier('water', 'earth')).toBe(RESIST_PENALTY);
  });

  it('is neutral for unrelated or same elements', () => {
    expect(elementMultiplier('fire', 'fire')).toBe(1);
    expect(elementMultiplier('fire', 'wood')).toBe(1);
  });
});
