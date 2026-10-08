import { dist } from '../systems/dmath';
import { HERO_LEVELS, MAX_HERO_LEVEL, type HeroAbilityDef, type HeroDef } from '../data/hero';

/** A hero on the map: walks where it's told, attacks on its own, levels up from nearby kills. */
export class Hero {
  /** Position in tile units. */
  x: number;
  y: number;
  /** Where it's walking to. */
  targetX: number;
  targetY: number;
  level = 1;
  /** Enemies that died within HERO_LEVELS.xpRadius of the hero, in total. */
  kills = 0;
  /** Seconds until each ability (by slot 0–3) is ready again. */
  readonly cooldowns = [0, 0, 0, 0];
  /** Seconds left on each ability's effect after a cast, and its full length (for countdowns). */
  readonly effects = [0, 0, 0, 0];
  readonly effectLengths = [0, 0, 0, 0];
  attackCooldown = 0;
  /** Attacks made so far (Aftershock counts every n-th). */
  attacks = 0;
  /** Facing (radians), for drawing. */
  angle = 0;
  /** True while a Jammer is close enough to stop its cooldowns. */
  jammed = false;
  /** Active self-buff (Overdrive, Rapid Fire). */
  buffTime = 0;
  buffAttackSpeed = 1;
  buffDamage = 1;
  /** Party bonus on attack and ability damage (all five elements in the party; see PARTY). */
  partyMult = 1;

  /** `player`: index of the player who controls this hero (0 in single-player). */
  constructor(readonly def: HeroDef, x: number, y: number, readonly player = 0) {
    this.x = this.targetX = x;
    this.y = this.targetY = y;
  }

  get moving(): boolean {
    return dist(this.targetX - this.x, this.targetY - this.y) > 0.02;
  }

  /** Multiplier on attack and ability damage from level (and the party bonus). */
  get damageMult(): number {
    return (1 + (this.level - 1) * HERO_LEVELS.damagePerLevel) * this.partyMult;
  }

  /** Multiplier on ability cooldowns from level. */
  get cooldownMult(): number {
    return 1 - (this.level - 1) * HERO_LEVELS.cooldownPerLevel;
  }

  /** Total nearby kills needed for the next level, or null at max level. */
  get killsForNextLevel(): number | null {
    return this.level >= MAX_HERO_LEVEL ? null : HERO_LEVELS.levelKills[this.level - 1];
  }

  /** Kills needed for the current level (0 at level 1), for the XP bar. */
  get killsForThisLevel(): number {
    return this.level === 1 ? 0 : HERO_LEVELS.levelKills[this.level - 2];
  }

  ability(slot: number): HeroAbilityDef {
    return this.def.abilities[slot];
  }

  isUnlocked(slot: number): boolean {
    return this.level >= this.def.abilities[slot].unlockLevel;
  }
}
