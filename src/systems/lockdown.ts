import type { ElementId } from '../data/elements';
import { BUILD_ELEMENTS, BUILD_WEAPONS, LOCKDOWN, type TowerOption } from '../data/towers';
import type { WeaponId } from '../data/weapons';
import type { Rng } from './rng';

export type ComboKey = `${ElementId}-${WeaponId}`;

export function comboKey({ weapon, element }: TowerOption): ComboKey {
  return `${element}-${weapon}`;
}

/**
 * Picks which element × weapon combos are locked for a wave: `fraction` of all combos
 * (rounded), chosen at random, skipping any lock that would leave a weapon or an element
 * with fewer open combos than the LOCKDOWN minimums.
 */
export function rollLocks(rng: Rng, fraction: number): Set<ComboKey> {
  const combos: TowerOption[] = BUILD_WEAPONS.flatMap((weapon) => BUILD_ELEMENTS.map((element) => ({ weapon, element })));
  const target = Math.round(combos.length * fraction);
  // Fisher–Yates shuffle
  for (let i = combos.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [combos[i], combos[j]] = [combos[j], combos[i]];
  }
  const openPerWeapon = new Map<WeaponId, number>(BUILD_WEAPONS.map((w) => [w, BUILD_ELEMENTS.length]));
  const openPerElement = new Map<ElementId, number>(BUILD_ELEMENTS.map((e) => [e, BUILD_WEAPONS.length]));
  const locked = new Set<ComboKey>();
  for (const c of combos) {
    if (locked.size >= target) break;
    if (openPerWeapon.get(c.weapon)! <= LOCKDOWN.minOpenPerWeapon) continue;
    if (openPerElement.get(c.element)! <= LOCKDOWN.minOpenPerElement) continue;
    locked.add(comboKey(c));
    openPerWeapon.set(c.weapon, openPerWeapon.get(c.weapon)! - 1);
    openPerElement.set(c.element, openPerElement.get(c.element)! - 1);
  }
  return locked;
}
