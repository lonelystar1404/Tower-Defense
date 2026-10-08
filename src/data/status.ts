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
      return `Burn: ${pct(s.burn.dpsFraction * power)} of hit damage per second for ${s.burn.duration}s`;
    case 'water':
      return `Chill: −${pct(Math.min(s.chill.maxSlow, s.chill.slow * power))} speed for ${s.chill.duration}s. ${s.chill.hitsToFreeze} in a row freeze for ${s.freeze.duration}s`;
    case 'wood':
      return `Root ground units ${n(s.root.duration * power)}s. Poison ${n(s.poison.dpsPerStack * power)}/s per stack, up to ${s.poison.maxStacks}`;
    case 'earth':
      return `${pct(s.stun.chance * power)} stun chance (${s.stun.duration}s). −${n(s.armorBreak.perHit * power)} armor per hit, up to −${s.armorBreak.max}`;
    case 'metal':
      return `Pierce: ignores ${pct(ELEMENTS.metal.armorPierce)} of armor. ${pct(ELEMENTS.metal.critChance * power)} crit chance for 2× damage`;
  }
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
