import type { ElementId } from '../data/elements';
import type { EnemyDef, MovementType } from '../data/enemies';
import type { Path } from '../systems/path';
import { newStatus, speedMultiplier, type StatusState } from '../systems/status';
import type { Targetable } from '../systems/targeting';

let nextId = 1;

export class Enemy implements Targetable {
  readonly id = nextId++;
  readonly maxHp: number;
  hp: number;
  /** Tiles moved along `route`. */
  distance = 0;
  x: number;
  y: number;
  /** Facing direction (unit vector), for drawing. */
  dirX = 1;
  dirY = 0;
  /** Burn, chill, poison, etc. (see systems/status). */
  readonly status: StatusState = newStatus();
  /** True once the enemy has reached the base. */
  escaped = false;
  /** Game time of the last WEAK!/RESIST popup, to keep them from spamming. */
  lastMatchupPopup = -Infinity;
  /** Game time of the last combo popup and the last Wildfire spread from this enemy. */
  lastComboPopup = -Infinity;
  lastWildfire = -Infinity;
  /** Gold for killing it (the type's reward, scaled by the wave's rewardMult). */
  reward: number;
  /** Remaining energy shield (Shielder); absorbs damage before HP. */
  shield = 0;
  /** Size of the current shield (bosses raise new ones), for the shield bar. */
  maxShield: number;
  /** Stealth units can't be targeted while hidden (see Game.updateAbilities). */
  hidden = false;
  /** Seconds until the next heal / blink / spawn. */
  abilityTimer = 0;
  /** Marked (Leila): takes `markAmp` more damage from everything while `markTime` > 0. */
  markTime = 0;
  markAmp = 0;
  /** This enemy's element (from its wave group, else its type), if any. Prisms change it. */
  element: ElementId | undefined;
  /** Extra armor from a nearby Warden (recomputed every tick). */
  bonusArmor = 0;
  /** Burrowers: seconds left underground (untargetable and immune while > 0). */
  burrowTime = 0;
  /** Bosses: how many phases have started so far, and the speed boost from enraging. */
  phase = 0;
  speedMult = 1;

  /**
   * `route` is the ground path for walkers or the flight line for flyers. `element` overrides
   * the type's default; pass null for no element.
   */
  constructor(readonly def: EnemyDef, readonly route: Path, readonly hpMult = 1, element?: ElementId | null) {
    this.element = element === null ? undefined : (element ?? def.element);
    this.reward = def.reward;
    this.maxHp = def.hp * hpMult;
    this.maxShield = def.ability?.kind === 'shield' ? this.maxHp * def.ability.fraction : 0;
    this.shield = this.maxShield;
    if (def.ability && 'interval' in def.ability) this.abilityTimer = def.ability.interval;
    this.hidden = def.ability?.kind === 'stealth';
    this.hp = this.maxHp;
    const start = route.pointAt(0);
    this.x = start.x;
    this.y = start.y;
  }

  /**
   * Applies damage, shield first. Returns the damage that actually landed (shield and HP lost,
   * not counting overkill), for stats.
   */
  takeDamage(amount: number): number {
    if (this.burrowed) return 0;
    if (this.markTime > 0) amount *= 1 + this.markAmp;
    const before = this.shield + Math.max(0, this.hp);
    const absorbed = Math.min(this.shield, amount);
    this.shield -= absorbed;
    this.hp -= amount - absorbed;
    return Math.min(amount, before);
  }

  /** Armor right now: the type's plus any Warden bonus. */
  get armor(): number {
    return this.def.armor + this.bonusArmor;
  }

  get burrowed(): boolean {
    return this.burrowTime > 0;
  }

  get alive(): boolean {
    return this.hp > 0 && !this.escaped;
  }

  get movement(): MovementType {
    return this.def.movement;
  }

  /** Current speed in tiles per second, after slows and stops. */
  get speed(): number {
    return this.def.speed * this.speedMult * speedMultiplier(this.status);
  }

  get remaining(): number {
    return this.route.length - this.distance;
  }
}
