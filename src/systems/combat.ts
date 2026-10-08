import type { BattlefieldDef } from '../data/battlefields';
import { COMBO_NUMBERS, type ComboId } from '../data/combos';
import { STATUS } from '../data/status';
import type { ElementId } from '../data/elements';
import type { TowerStats } from '../data/towers';
import type { Enemy } from '../entities/Enemy';
import { battlefieldMultiplier, computeDamage, elementMultiplier } from './damage';
import type { Rng } from './rng';
import { applyElementEffect, type EffectEvents } from './status';

export interface HitResult extends EffectEvents {
  damage: number;
  crit: boolean;
  killed: boolean;
  /** Weakness-cycle multiplier for this hit (>1 weak, <1 resisted), for feedback. */
  matchup: number;
  /** Element combos this hit set off (see src/data/combos.ts). */
  combos: ComboId[];
  /** Armor-ignoring damage of a Steam burst on this enemy (0 if none); Game splashes part of it. */
  steamBurst: number;
  /** Damage that actually landed (hit + burst, without overkill), for stats. */
  dealt: number;
}

export interface HitOptions {
  /** Reduces the base damage (chain jumps). */
  scale?: number;
  battlefield?: BattlefieldDef | null;
  battlefieldBonus?: number;
}

/**
 * Applies one hit from a tower to an enemy: damage (all math goes through computeDamage),
 * then the element's status effect if the enemy survived, then any element combo. The element
 * multiplier combines the weakness cycle and the battlefield. Rolls `rng` for the crit first,
 * then for any effect chance.
 *
 * Combos read the enemy's state from before the hit:
 * - Shatter: a frozen enemy hit by Earth or Metal takes double damage; the freeze ends.
 * - Rupture: Metal always crits once Earth has broken all of the enemy's armor.
 * - Corrosion: Earth on a poisoned enemy breaks extra armor and adds a poison stack.
 * - Steam: Fire on a chilled enemy, or Water on a burning one, bursts for 60% of the hit plus
 *   the burn it had left (ignoring armor); burn and chill end.
 * - Wildfire: reported when the enemy ends up both burning and poisoned from a Fire or Wood
 *   hit; Game spreads the burn to nearby enemies.
 */
export function applyHit(enemy: Enemy, stats: TowerStats, element: ElementId, rng: Rng, options: HitOptions = {}): HitResult {
  const { scale = 1, battlefield = null, battlefieldBonus = 0 } = options;
  const s = enemy.status;
  const combos: ComboId[] = [];
  const shatter = s.freezeTime > 0 && (element === 'earth' || element === 'metal');
  const rupture = element === 'metal' && s.armorBreak >= STATUS.armorBreak.max;
  const chilled = s.chillTime > 0;
  const burning = s.burnTime > 0;
  const poisoned = s.poisonTime > 0 && s.poisonStacks > 0;
  const burnLeft = burning ? s.burnDps * s.burnTime : 0;

  const rolled = stats.critChance > 0 && rng() < stats.critChance;
  const crit = rolled || rupture;
  const matchup = elementMultiplier(element, enemy.element);
  const damage = computeDamage({
    base: stats.damage * scale * (enemy.movement === 'air' ? stats.airBonus : 1) * (shatter ? COMBO_NUMBERS.shatter.damageMult : 1),
    elementMult: matchup * battlefieldMultiplier(element, enemy.element, battlefield, battlefieldBonus),
    crit,
    armor: enemy.armor,
    armorBreak: s.armorBreak,
    armorPierce: stats.armorPierce,
  });
  if (shatter) {
    s.freezeTime = 0;
    s.chillTime = 0;
    s.chillHits = 0;
    s.chillSlow = 0;
    combos.push('shatter');
  }
  if (rupture) combos.push('rupture');
  const wasAlive = enemy.alive;
  let dealt = enemy.takeDamage(damage);

  let events: EffectEvents = { froze: false, stunned: false, rooted: false };
  let steamBurst = 0;
  // Status effects (and the combos built on them) land only on a living enemy whose shield is down.
  if (enemy.alive && enemy.shield <= 0) {
    events = applyElementEffect(s, element, damage, enemy.movement, rng, stats.effectPower);
    if (element === 'earth' && poisoned) {
      s.armorBreak = Math.min(STATUS.armorBreak.max, s.armorBreak + COMBO_NUMBERS.corrosion.extraArmorBreak);
      s.poisonStacks = Math.min(STATUS.poison.maxStacks, s.poisonStacks + 1);
      s.poisonTime = STATUS.poison.duration;
      combos.push('corrosion');
    }
    if ((element === 'fire' && chilled) || (element === 'water' && burning)) {
      steamBurst = damage * COMBO_NUMBERS.steam.hitFraction + burnLeft;
      s.burnTime = 0;
      s.burnDps = 0;
      s.chillTime = 0;
      s.chillHits = 0;
      s.chillSlow = 0;
      dealt += enemy.takeDamage(steamBurst);
      combos.push('steam');
    }
    if ((element === 'fire' || element === 'wood') && s.burnTime > 0 && s.poisonTime > 0 && s.poisonStacks > 0) {
      combos.push('wildfire');
    }
  }
  const killed = wasAlive && !enemy.alive;
  return { damage, crit, killed, matchup, combos, steamBurst, dealt, ...events };
}
