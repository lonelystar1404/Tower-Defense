import { t } from '../i18n';
import { ELEMENTS, type ElementId } from './elements';

/**
 * Status-effect numbers. Rules live in `src/systems/status.ts`; only tuning values live here.
 * Durations are in seconds.
 */
export const STATUS = {
  /** Fire. A new hit restarts the timer; burns don't stack (the stronger burn is kept). */
  burn: { dpsFraction: 0.25, duration: 3 },
  /** Water. Each hit slows; `hitsToFreeze` chills in a row (without the chill running out) freeze. Upgrades can't slow past `maxSlow`. */
  chill: { slow: 0.3, duration: 2, hitsToFreeze: 3, maxSlow: 0.6 },
  /** Water. Stops the enemy, then it can't be frozen again for `immunity` seconds after it thaws. */
  freeze: { duration: 1, immunity: 3 },
  /** Wood, ground units only. Holds the enemy in place, then a short immunity so it can't be held forever. */
  root: { duration: 0.5, immunity: 1 },
  /** Wood. Each hit adds a stack and refreshes the timer; all stacks expire together. */
  poison: { dpsPerStack: 1.5, maxStacks: 5, duration: 3 },
  /** Earth. Chance per hit to stop the enemy briefly. */
  stun: { chance: 0.15, duration: 0.75 },
  /** Earth. Permanent armor loss per hit, up to `max`. */
  armorBreak: { perHit: 2, max: 10 },
} as const;

/**
 * One-line, player-facing description of each element's signature effect, with numbers for
 * a tower whose effect power is `power` (1 at level 1). Mirrors the rules in systems/status.
 */
export function describeEffect(element: ElementId, power = 1): string {
  const s = STATUS;
  const n = (x: number) => +x.toFixed(2);
  switch (element) {
    case 'fire':
      return t('Burn: {pct} of hit damage per second for {s}s', { pct: pct(s.burn.dpsFraction * power), s: s.burn.duration });
    case 'water':
      return t('Chill: −{slow} speed for {s}s. {n} in a row freeze for {f}s', { slow: pct(Math.min(s.chill.maxSlow, s.chill.slow * power)), s: s.chill.duration, n: s.chill.hitsToFreeze, f: s.freeze.duration });
    case 'wood':
      return t('Root ground units {root}s. Poison {dps}/s per stack, up to {max}', { root: n(s.root.duration * power), dps: n(s.poison.dpsPerStack * power), max: s.poison.maxStacks });
    case 'earth':
      return t('{chance} stun chance ({s}s). −{brk} armor per hit, up to −{max}', { chance: pct(s.stun.chance * power), s: s.stun.duration, brk: n(s.armorBreak.perHit * power), max: s.armorBreak.max });
    case 'metal':
      return t('Pierce: ignores {pierce} of armor. {crit} crit chance for 2× damage', { pierce: pct(ELEMENTS.metal.armorPierce), crit: pct(ELEMENTS.metal.critChance * power) });
  }
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
