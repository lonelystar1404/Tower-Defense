import type { ElementId } from '../data/elements';
import type { MovementType } from '../data/enemies';
import { STATUS } from '../data/status';
import type { Rng } from './rng';

/**
 * The one shared status-effect system: Burn, Chill, Freeze, Root, Poison, Stun, Armor Break.
 * Pure functions over a plain state object, so stacking and refresh rules are easy to test.
 *
 * Damage over time (burn, poison) is applied continuously, ignores armor, and keeps ticking
 * while the enemy is frozen, rooted, or stunned.
 *
 * `power` (1 at tower level 1, higher when upgraded) scales burn and poison damage, the chill
 * slow (capped at MAX_SLOW), root duration, stun chance, and armor break per hit. When effects
 * of different strengths overlap, the stronger one is kept.
 */

/** Slows never go beyond this, however strong the tower. */
export const MAX_SLOW = STATUS.chill.maxSlow;

export interface StatusState {
  burnDps: number;
  burnTime: number;
  chillTime: number;
  /** Fraction of speed removed while chilled. */
  chillSlow: number;
  /** Chill hits in a row while the chill hasn't run out. */
  chillHits: number;
  freezeTime: number;
  /** Counts down through the freeze and the immunity after it. */
  freezeImmuneTime: number;
  rootTime: number;
  /** Counts down through the root and the immunity after it. */
  rootImmuneTime: number;
  poisonStacks: number;
  /** Damage per second per stack (the strongest poison applied). */
  poisonDpsPerStack: number;
  poisonTime: number;
  stunTime: number;
  /** Armor removed so far (permanent). */
  armorBreak: number;
}

export function newStatus(): StatusState {
  return {
    burnDps: 0, burnTime: 0,
    chillTime: 0, chillSlow: 0, chillHits: 0,
    freezeTime: 0, freezeImmuneTime: 0,
    rootTime: 0, rootImmuneTime: 0,
    poisonStacks: 0, poisonDpsPerStack: 0, poisonTime: 0,
    stunTime: 0,
    armorBreak: 0,
  };
}

/** What a hit just triggered, for visual feedback. */
export interface EffectEvents {
  froze: boolean;
  stunned: boolean;
  rooted: boolean;
}

/**
 * Applies an element's signature effect after a hit that dealt `hitDamage`.
 * Rolls `rng` only for Earth's stun chance.
 */
export function applyElementEffect(
  s: StatusState,
  element: ElementId,
  hitDamage: number,
  movement: MovementType,
  rng: Rng,
  power = 1,
): EffectEvents {
  const events: EffectEvents = { froze: false, stunned: false, rooted: false };
  switch (element) {
    case 'fire':
      s.burnDps = Math.max(s.burnTime > 0 ? s.burnDps : 0, hitDamage * STATUS.burn.dpsFraction * power);
      s.burnTime = STATUS.burn.duration;
      break;

    case 'water': {
      const canFreeze = s.freezeImmuneTime <= 0;
      s.chillHits = s.chillTime > 0 && canFreeze ? s.chillHits + 1 : 1;
      s.chillSlow = Math.max(s.chillTime > 0 ? s.chillSlow : 0, Math.min(MAX_SLOW, STATUS.chill.slow * power));
      s.chillTime = STATUS.chill.duration;
      if (canFreeze && s.chillHits >= STATUS.chill.hitsToFreeze) {
        s.freezeTime = STATUS.freeze.duration;
        s.freezeImmuneTime = STATUS.freeze.duration + STATUS.freeze.immunity;
        s.chillHits = 0;
        events.froze = true;
      }
      break;
    }

    case 'wood':
      if (movement === 'ground' && s.rootImmuneTime <= 0) {
        s.rootTime = STATUS.root.duration * power;
        s.rootImmuneTime = s.rootTime + STATUS.root.immunity;
        events.rooted = true;
      }
      s.poisonStacks = Math.min(STATUS.poison.maxStacks, s.poisonStacks + 1);
      s.poisonDpsPerStack = Math.max(s.poisonDpsPerStack, STATUS.poison.dpsPerStack * power);
      s.poisonTime = STATUS.poison.duration;
      break;

    case 'earth':
      s.armorBreak = Math.min(STATUS.armorBreak.max, s.armorBreak + STATUS.armorBreak.perHit * power);
      if (rng() < STATUS.stun.chance * power) {
        s.stunTime = Math.max(s.stunTime, STATUS.stun.duration);
        events.stunned = true;
      }
      break;

    case 'metal':
      // Metal's pierce and crit are part of the hit itself (see ElementDef).
      break;
  }
  return events;
}

/** Advances all timers by `dt` and returns the damage-over-time dealt during it. */
export function tickStatus(s: StatusState, dt: number): number {
  let damage = 0;
  if (s.burnTime > 0) {
    damage += s.burnDps * Math.min(dt, s.burnTime);
    s.burnTime = Math.max(0, s.burnTime - dt);
    if (s.burnTime === 0) s.burnDps = 0;
  }
  if (s.poisonTime > 0) {
    damage += s.poisonStacks * s.poisonDpsPerStack * Math.min(dt, s.poisonTime);
    s.poisonTime = Math.max(0, s.poisonTime - dt);
    if (s.poisonTime === 0) {
      s.poisonStacks = 0;
      s.poisonDpsPerStack = 0;
    }
  }
  s.chillTime = Math.max(0, s.chillTime - dt);
  if (s.chillTime === 0) {
    s.chillHits = 0;
    s.chillSlow = 0;
  }
  s.freezeTime = Math.max(0, s.freezeTime - dt);
  s.freezeImmuneTime = Math.max(0, s.freezeImmuneTime - dt);
  s.rootTime = Math.max(0, s.rootTime - dt);
  s.rootImmuneTime = Math.max(0, s.rootImmuneTime - dt);
  s.stunTime = Math.max(0, s.stunTime - dt);
  return damage;
}

/** Multiplier on the enemy's base speed: 0 while frozen, rooted, or stunned. */
export function speedMultiplier(s: StatusState): number {
  if (s.freezeTime > 0 || s.rootTime > 0 || s.stunTime > 0) return 0;
  return s.chillTime > 0 ? 1 - s.chillSlow : 1;
}
