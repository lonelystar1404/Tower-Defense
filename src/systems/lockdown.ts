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
 * (rounded), chosen at random, while every weapon and every element keeps at least the
 * LOCKDOWN minimum of open combos. The minimums are reserved first (so a high fraction still
 * locks exactly its share), then the rest of the open slots are filled at random.
 */
export function rollLocks(rng: Rng, fraction: number): Set<ComboKey> {
  const combos: TowerOption[] = BUILD_WEAPONS.flatMap((weapon) => BUILD_ELEMENTS.map((element) => ({ weapon, element })));
  const target = Math.round(combos.length * fraction);
  if (target === 0) return new Set();
  // Fisher–Yates shuffle
  for (let i = combos.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [combos[i], combos[j]] = [combos[j], combos[i]];
  }
  const open = new Set<ComboKey>();
  const openCount = (match: (c: TowerOption) => boolean) => combos.filter((c) => match(c) && open.has(comboKey(c))).length;
  const needsWeapon = (w: WeaponId) => openCount((c) => c.weapon === w) < LOCKDOWN.minOpenPerWeapon;
  const needsElement = (e: ElementId) => openCount((c) => c.element === e) < LOCKDOWN.minOpenPerElement;
  // Reserve the minimums, preferring combos that cover a weapon and an element that both need one.
  for (;;) {
    const free = combos.filter((c) => !open.has(comboKey(c)));
    const pick =
      free.find((c) => needsWeapon(c.weapon) && needsElement(c.element)) ??
      free.find((c) => needsWeapon(c.weapon) || needsElement(c.element));
    if (!pick) break;
    open.add(comboKey(pick));
  }
  // Fill the remaining open slots at random, then lock everything else.
  for (const c of combos) {
    if (combos.length - open.size <= target) break;
    open.add(comboKey(c));
  }
  return new Set(combos.map(comboKey).filter((k) => !open.has(k)));
}
