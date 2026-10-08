import { BATTLEFIELD_BONUS, BATTLEFIELD_IDS, BATTLEFIELDS, type BattlefieldDef, type BattlefieldId } from '../data/battlefields';
import { ENEMIES, isBoss, type EnemyId } from '../data/enemies';
import { PREP_TIME, obstacleTiles, type LevelDef, type WaveDef } from '../data/levels';
import type { WeaponId } from '../data/weapons';
import { LOCKDOWN, MAX_TOWER_LEVEL, SELL_REFUND, towerCost, towerStats, upgradeCost, type TowerOption } from '../data/towers';
import { Enemy } from '../entities/Enemy';
import { Projectile } from '../entities/Projectile';
import { Tower } from '../entities/Tower';
import { Hero } from '../entities/Hero';
import { HEROES, HERO_LEVELS, MAX_HERO_LEVEL, effectLength, type HeroId } from '../data/hero';
import { COMBO_NUMBERS, COMBOS, type ComboId } from '../data/combos';
import { battlefieldMultiplier, computeDamage, elementMultiplier } from '../systems/damage';
import { applyHit } from '../systems/combat';
import { ELEMENTS, OVERCOMES, type ElementId } from '../data/elements';
import { applyElementEffect, newStatus, tickStatus } from '../systems/status';
import { comboKey, rollLocks, type ComboKey } from '../systems/lockdown';
import { Path } from '../systems/path';
import { seededRng, type Rng } from '../systems/rng';
import { t } from '../i18n';
import { chainTargets, selectTarget, selectTargets, type TargetPriority } from '../systems/targeting';

/**
 * All game state and rules for one level. Knows nothing about the DOM or canvas, so it runs
 * the same in the browser and in tests. Positions are in tile units.
 */

export type Phase = 'build' | 'wave' | 'won' | 'lost';

/** Short-lived visual feedback. Purely cosmetic. */
export type Effect = {
  x: number;
  y: number;
  ttl: number;
  maxTtl: number;
  color: string;
} & (
  | { kind: 'text'; text: string }
  | { kind: 'spark'; element: ElementId }
  /** Splash explosion; `radius` in tiles. */
  | { kind: 'blast'; radius: number; element: ElementId }
  /** Chain jumping through these points (tile units). */
  | { kind: 'beam'; points: { x: number; y: number }[]; element: ElementId }
  /** Brief screen shake (Earth stuns). */
  | { kind: 'shake' }
  /** Expanding ring (heals, blinks, splits); `radius` in tiles. */
  | { kind: 'pulse'; radius: number }
);

/**
 * Things worth a sound, queued by the game and drained by the page each frame
 * (`drainSounds`). The game only says what happened; `src/audio` decides how it sounds.
 */
export type GameSound =
  | `shot-${WeaponId}`
  | 'blast' | 'kill' | 'leak' | 'crit' | 'freeze' | 'stun'
  | 'build' | 'upgrade' | 'sell'
  | 'wave-start' | 'wave-clear' | 'win' | 'lose'
  /** Countdown ticks in the last 5 seconds; `tick-final` on the last one. */
  | 'tick' | 'tick-final'
  /** Enemy abilities */
  | 'shield-break' | 'heal' | 'blink' | 'split' | 'launch' | 'disrupt' | 'shift' | 'burrow'
  /** Heroes: attacks, level-ups, and one sound per ability (`ability:<id>`, plus `impact:<id>` when a strike lands) */
  | 'hero-shot' | 'hero-punch' | 'hero-zap' | 'level-up' | 'combustion'
  | `ability:${string}` | `impact:${string}`
  /** Element combos */
  | 'combo'
  /** Bosses: arrival and each new phase */
  | 'boss' | 'boss-phase';

/** Who dealt damage or got a kill, for the end-of-map breakdown and balance checks. */
export type DamageSource = { kind: 'hero' } | { kind: 'tower'; weapon: WeaponId; element: ElementId } | { kind: 'status' };

export interface GameStats {
  damage: { hero: number; towers: number; status: number; byWeapon: Partial<Record<WeaponId, number>>; byElement: Partial<Record<ElementId, number>> };
  kills: { hero: number; towers: number; status: number; byWeapon: Partial<Record<WeaponId, number>>; byElement: Partial<Record<ElementId, number>> };
  combos: Partial<Record<ComboId, number>>;
}

const HERO_SOURCE: DamageSource = { kind: 'hero' };
/** Melee cleave: share of the hit dealt to enemies next to the target. */
const CLEAVE_SHARE = 0.3;
const STATUS_SOURCE: DamageSource = { kind: 'status' };

/** A hero zone on the ground (Cryo Field, Firewall, Nanite Cloud). */
export interface Zone {
  x: number;
  y: number;
  radius: number;
  ttl: number;
  maxTtl: number;
  color: string;
  slow?: number;
  dps?: number;
  armorBreak?: number;
  stripShields?: boolean;
}

/** A delayed hero strike counting down to impact (Orbital Strike). */
export interface Strike {
  x: number;
  y: number;
  radius: number;
  damage: number;
  delay: number;
  /** The full delay, for the countdown clock. */
  maxDelay: number;
  /** Ability that called it (its impact sound). */
  ability: string;
}

/** A temporary turret placed by a hero (Echo's drones). */
export interface Summon {
  x: number;
  y: number;
  ttl: number;
  maxTtl: number;
  damage: number;
  fireRate: number;
  range: number;
  cooldown: number;
  angle: number;
}

/** Sounds queued but not drained (e.g. in tests) are capped so the queue can't grow forever. */
const MAX_QUEUED_SOUNDS = 64;

export interface SpawnEntry {
  time: number;
  enemy: EnemyId;
  hpMult: number;
  /** Group element override (null = no element; undefined = the enemy's default). */
  element?: ElementId | null;
  rewardMult: number;
}

export interface GameOptions {
  /**
   * Fixes each wave's lockdown and battlefield from this seed alone (the Daily Challenge), so
   * every player gets the same conditions however the fights go. Without it they come from `rng`.
   */
  conditionsSeed?: number;
}

/**
 * Everything needed to continue a run from the start of its next wave (saved between waves).
 * Plain JSON. Bump `v` when the shape changes; old saves are then dropped.
 */
export interface GameSnapshot {
  v: 1;
  levelId: string;
  heroId?: HeroId;
  conditionsSeed?: number;
  wavesStarted: number;
  gold: number;
  lives: number;
  time: number;
  lastWaveBonus: number;
  battlefield: BattlefieldId;
  locked: ComboKey[];
  towers: { col: number; row: number; weapon: WeaponId; element: ElementId; level: number; spent: number; priority: TargetPriority }[];
  hero?: { x: number; y: number; level: number; kills: number };
  stats: GameStats;
}

export const SNAPSHOT_VERSION = 1;

/** Spawns for one wave, in time order. `hpScale` multiplies every group's HP (LevelDef.hpScale). */
export function buildSpawnQueue(wave: WaveDef, hpScale = 1): SpawnEntry[] {
  const queue: SpawnEntry[] = [];
  for (const g of wave.groups) {
    for (let i = 0; i < g.count; i++) {
      queue.push({ time: (g.delay ?? 0) + i * g.interval, enemy: g.enemy, hpMult: (g.hpMult ?? 1) * hpScale, element: g.element, rewardMult: wave.rewardMult ?? 1 });
    }
  }
  return queue.sort((a, b) => a.time - b.time);
}

export class Game {
  /** Ground route. */
  readonly path: Path;
  /** Flight route for air units. */
  readonly airPath: Path;
  private readonly pathTiles: Set<string>;
  private readonly obstacleTiles: Set<string>;

  gold: number;
  lives: number;
  /** Number of waves started so far (the current wave number while one is running). */
  wavesStarted = 0;
  phase: Phase = 'build';
  /** Seconds simulated so far (drives animations). */
  time = 0;

  enemies: Enemy[] = [];
  towers: Tower[] = [];
  projectiles: Projectile[] = [];
  effects: Effect[] = [];

  /** Combos that can't be built until the next wave ends (see LOCKDOWN). */
  locked: Set<ComboKey> = new Set();
  /** Battlefield for the current or coming wave. */
  battlefield!: BattlefieldDef;
  /**
   * Seconds left to get ready before the next wave starts on its own; null when no countdown
   * is running (before the first wave, during a wave, after the last one).
   */
  prepRemaining: number | null = null;
  /** Bonus gold paid for the last cleared wave (shown in the "wave cleared" bar). */
  lastWaveBonus = 0;
  private sounds: GameSound[] = [];
  /** Enemies released mid-update (splits, launches); they join at the end of the tick. */
  private pending: Enemy[] = [];
  /** The hero, on maps that have one. */
  readonly hero: Hero | null;
  zones: Zone[] = [];
  strikes: Strike[] = [];
  summons: Summon[] = [];
  /** Damage, kills, and combos by source this game. */
  stats: GameStats = {
    damage: { hero: 0, towers: 0, status: 0, byWeapon: {}, byElement: {} },
    kills: { hero: 0, towers: 0, status: 0, byWeapon: {}, byElement: {} },
    combos: {},
  };

  private spawnQueue: SpawnEntry[] = [];
  private waveTime = 0;

  /** See GameOptions. */
  readonly conditionsSeed: number | undefined;

  constructor(readonly level: LevelDef, private readonly rng: Rng = Math.random, heroId: HeroId = 'vex', options: GameOptions = {}) {
    this.conditionsSeed = options.conditionsSeed;
    this.path = new Path(level.path);
    this.airPath = new Path(level.airPath ?? [level.path[0], level.path[level.path.length - 1]]);
    this.pathTiles = new Set(this.path.tiles().map(([c, r]) => `${c},${r}`));
    this.obstacleTiles = new Set(obstacleTiles(level.obstacles).map(([c, r]) => `${c},${r}`));
    this.gold = level.startGold;
    this.lives = level.lives;
    this.rollWaveConditions();
    this.hero = level.heroStart ? new Hero(HEROES[heroId], level.heroStart[0] + 0.5, level.heroStart[1] + 0.5) : null;
  }

  /**
   * Continues a run saved with `snapshot()`: same towers, gold, lives, hero level, stats, and
   * the conditions rolled for the next wave. The countdown waits for Ready.
   */
  static restore(level: LevelDef, snap: GameSnapshot, rng: Rng = Math.random): Game {
    const game = new Game(level, rng, snap.heroId, { conditionsSeed: snap.conditionsSeed });
    game.wavesStarted = snap.wavesStarted;
    game.gold = snap.gold;
    game.lives = snap.lives;
    game.time = snap.time;
    game.lastWaveBonus = snap.lastWaveBonus;
    game.battlefield = BATTLEFIELDS[snap.battlefield];
    game.locked = new Set(snap.locked);
    for (const t of snap.towers) {
      const option = { weapon: t.weapon, element: t.element };
      const tower = new Tower(t.col, t.row, option, t.spent);
      tower.level = t.level;
      tower.stats = towerStats(option, t.level);
      tower.priority = t.priority;
      game.towers.push(tower);
    }
    if (game.hero && snap.hero) {
      game.hero.x = game.hero.targetX = snap.hero.x;
      game.hero.y = game.hero.targetY = snap.hero.y;
      game.hero.level = snap.hero.level;
      game.hero.kills = snap.hero.kills;
    }
    game.stats = structuredClone(snap.stats);
    return game;
  }

  /** Saveable state between waves; null during a wave, after the game, or before wave 1. */
  snapshot(): GameSnapshot | null {
    if (this.phase !== 'build' || this.wavesStarted === 0) return null;
    const hero = this.hero;
    return {
      v: SNAPSHOT_VERSION,
      levelId: this.level.id,
      heroId: hero?.def.id,
      conditionsSeed: this.conditionsSeed,
      wavesStarted: this.wavesStarted,
      gold: this.gold,
      lives: this.lives,
      time: this.time,
      lastWaveBonus: this.lastWaveBonus,
      battlefield: this.battlefield.id,
      locked: [...this.locked],
      towers: this.towers.map((t) => ({ col: t.col, row: t.row, weapon: t.weapon, element: t.element, level: t.level, spent: t.spent, priority: t.priority })),
      hero: hero ? { x: hero.x, y: hero.y, level: hero.level, kills: hero.kills } : undefined,
      stats: structuredClone(this.stats),
    };
  }

  /** Damage shift on the current battlefield (0 when the level turns battlefields off). */
  get battlefieldBonus(): number {
    return this.level.battlefieldBonus ?? BATTLEFIELD_BONUS;
  }

  get totalWaves(): number {
    return this.level.waves.length;
  }

  get over(): boolean {
    return this.phase === 'won' || this.phase === 'lost';
  }

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.level.cols && row < this.level.rows;
  }

  isPath(col: number, row: number): boolean {
    return this.pathTiles.has(`${col},${row}`);
  }

  /** Blocked by a building, canal, or wreckage (see ObstacleDef). */
  isObstacle(col: number, row: number): boolean {
    return this.obstacleTiles.has(`${col},${row}`);
  }

  towerAt(col: number, row: number): Tower | undefined {
    return this.towers.find((t) => t.col === col && t.row === row);
  }

  isLocked(option: TowerOption): boolean {
    return this.locked.has(comboKey(option));
  }

  canBuild(col: number, row: number): boolean {
    return this.inBounds(col, row) && !this.isPath(col, row) && !this.isObstacle(col, row) && !this.towerAt(col, row);
  }

  build(col: number, row: number, option: TowerOption): Tower | null {
    const cost = towerCost(option);
    if (this.over || !this.canBuild(col, row) || this.gold < cost || this.isLocked(option)) return null;
    this.gold -= cost;
    const tower = new Tower(col, row, option, cost);
    this.towers.push(tower);
    this.sound('build');
    return tower;
  }

  /** Gold for the next level, or null at max level. */
  nextUpgradeCost(tower: Tower): number | null {
    if (tower.level >= MAX_TOWER_LEVEL) return null;
    return upgradeCost({ weapon: tower.weapon, element: tower.element }, tower.level + 1);
  }

  /**
   * Raises the tower one level if affordable. Allowed any time, like building, except while
   * the tower's combo is locked (lockdown blocks upgrades as well as new builds).
   */
  upgrade(tower: Tower): boolean {
    const cost = this.nextUpgradeCost(tower);
    if (this.over || cost === null || this.gold < cost || !this.towers.includes(tower) || this.isLocked(tower)) return false;
    this.gold -= cost;
    tower.spent += cost;
    tower.level++;
    this.sound('upgrade');
    tower.stats = towerStats({ weapon: tower.weapon, element: tower.element }, tower.level);
    this.effects.push({ kind: 'blast', x: tower.x, y: tower.y, radius: 0.8, element: tower.element, ttl: 0.4, maxTtl: 0.4, color: '' });
    this.addText(tower.x, tower.y - 0.5, `${t('LV')} ${tower.level}`, '#00f0ff');
    return true;
  }

  sellValue(tower: Tower): number {
    return Math.floor(tower.spent * SELL_REFUND);
  }

  sell(tower: Tower): number {
    const i = this.towers.indexOf(tower);
    if (this.over || i < 0) return 0;
    this.towers.splice(i, 1);
    this.sound('sell');
    const refund = this.sellValue(tower);
    this.gold += refund;
    return refund;
  }

  /** Seconds of preparation between waves for this level. */
  get prepTime(): number {
    return this.level.prepTime ?? PREP_TIME;
  }

  /** Starts the next wave now (the Ready button). */
  startWave(): boolean {
    if (this.phase !== 'build' || this.wavesStarted >= this.totalWaves) return false;
    this.prepRemaining = null;
    this.spawnQueue = buildSpawnQueue(this.level.waves[this.wavesStarted], this.level.hpScale);
    this.wavesStarted++;
    this.waveTime = 0;
    this.phase = 'wave';
    this.sound('wave-start');
    return true;
  }

  update(dt: number): void {
    if (this.over) return;
    this.time += dt;
    if (this.phase === 'build' && this.prepRemaining !== null) {
      const before = Math.ceil(this.prepRemaining);
      this.prepRemaining = Math.max(0, this.prepRemaining - dt);
      const after = Math.ceil(this.prepRemaining);
      if (after < before && after < 5) this.sound(after === 0 ? 'tick-final' : 'tick');
      if (this.prepRemaining === 0) this.startWave();
    }
    this.spawnEnemies(dt);
    this.updateAbilities(dt);
    this.moveEnemies(dt);
    if (this.over) return;
    this.updateZones(dt);
    this.updateTowers(dt);
    this.updateHero(dt);
    this.updateSummons(dt);
    this.updateProjectiles(dt);
    this.updateStrikes(dt);
    this.updateEffects(dt);
    this.enemies = this.enemies.filter((e) => e.alive);
    if (this.pending.length > 0) {
      this.enemies.push(...this.pending);
      this.pending = [];
    }
    this.checkWaveEnd();
  }

  /** Heal, blink, launch, stealth reveal, disrupt, shift, burrow, and fortify (see AbilityDef). */
  private updateAbilities(dt: number): void {
    // Warden armor is recomputed from scratch every tick.
    for (const e of this.enemies) {
      e.bonusArmor = 0;
      e.auraAmp = 0;
    }
    for (const e of this.enemies) {
      if (e.def.phases && e.alive) this.updateBoss(e);
      const ability = e.def.ability;
      if (!ability || !e.alive) continue;
      switch (ability.kind) {
        case 'stealth':
          e.hidden = !this.towers.some((t) => (t.x - e.x) ** 2 + (t.y - e.y) ** 2 <= ability.revealRange ** 2);
          break;
        case 'heal': {
          e.abilityTimer -= dt;
          if (e.abilityTimer > 0) break;
          e.abilityTimer += ability.interval;
          let healed = false;
          for (const other of this.enemies) {
            if (other === e || !other.alive || other.hp >= other.maxHp) continue;
            if ((other.x - e.x) ** 2 + (other.y - e.y) ** 2 > ability.radius ** 2) continue;
            other.hp = Math.min(other.maxHp, other.hp + other.maxHp * ability.fraction);
            healed = true;
          }
          if (healed) {
            this.effects.push({ kind: 'pulse', x: e.x, y: e.y, radius: ability.radius, ttl: 0.5, maxTtl: 0.5, color: e.def.color });
            this.sound('heal');
          }
          break;
        }
        case 'blink':
          e.abilityTimer -= dt;
          // Waits while stunned, frozen, or rooted, then blinks as soon as it can move.
          if (e.abilityTimer > 0 || e.speed === 0) break;
          e.abilityTimer = ability.interval;
          this.effects.push({ kind: 'pulse', x: e.x, y: e.y, radius: 0.5, ttl: 0.3, maxTtl: 0.3, color: e.def.color });
          e.distance = Math.min(e.route.length - 0.01, e.distance + ability.distance);
          this.sound('blink');
          break;
        case 'spawn':
          e.abilityTimer -= dt;
          if (e.abilityTimer > 0) break;
          e.abilityTimer += ability.interval;
          this.release(e, ability.child, 1);
          this.sound('launch');
          break;
        case 'disrupt': {
          e.abilityTimer = Math.max(0, e.abilityTimer - dt);
          if (e.abilityTimer > 0) break;
          // Waits, charged, until a tower is in reach.
          const hit = this.towers.filter((t) => (t.x - e.x) ** 2 + (t.y - e.y) ** 2 <= ability.radius ** 2);
          if (hit.length === 0) break;
          e.abilityTimer = ability.interval;
          for (const t of hit) {
            t.disabledTime = Math.max(t.disabledTime, ability.duration);
            this.effects.push({ kind: 'beam', x: e.x, y: e.y, points: [{ x: e.x, y: e.y }, { x: t.x, y: t.y }], element: 'metal', ttl: 0.25, maxTtl: 0.25, color: e.def.color });
          }
          this.effects.push({ kind: 'pulse', x: e.x, y: e.y, radius: ability.radius, ttl: 0.5, maxTtl: 0.5, color: e.def.color });
          this.addText(e.x, e.y - 0.5, t('DISRUPT'), e.def.color);
          this.sound('disrupt');
          break;
        }
        case 'shift':
          e.abilityTimer -= dt;
          if (e.abilityTimer > 0) break;
          e.abilityTimer += ability.interval;
          e.element = e.element ? OVERCOMES[e.element] : 'water';
          this.effects.push({ kind: 'pulse', x: e.x, y: e.y, radius: 0.55, ttl: 0.35, maxTtl: 0.35, color: ELEMENTS[e.element].color });
          this.sound('shift');
          break;
        case 'burrow':
          if (e.burrowTime > 0) {
            e.burrowTime = Math.max(0, e.burrowTime - dt);
            if (e.burrowTime === 0) this.effects.push({ kind: 'pulse', x: e.x, y: e.y, radius: 0.6, ttl: 0.35, maxTtl: 0.35, color: e.def.color });
          } else {
            e.abilityTimer -= dt;
            // Stunned, frozen, or rooted Burrowers can't dig.
            if (e.abilityTimer <= 0 && e.speed > 0) {
              e.abilityTimer = ability.interval;
              e.burrowTime = ability.duration;
              this.effects.push({ kind: 'pulse', x: e.x, y: e.y, radius: 0.6, ttl: 0.35, maxTtl: 0.35, color: e.def.color });
              this.sound('burrow');
            }
          }
          e.hidden = e.burrowTime > 0;
          break;
        case 'fortify':
          for (const other of this.enemies) {
            if (other === e || !other.alive) continue;
            if ((other.x - e.x) ** 2 + (other.y - e.y) ** 2 > ability.radius ** 2) continue;
            other.bonusArmor = Math.max(other.bonusArmor, ability.armor);
          }
          break;
      }
    }
  }

  /** Starts every boss phase whose HP threshold has been reached (several at once after a big hit). */
  private updateBoss(e: Enemy): void {
    const phases = e.def.phases!;
    while (e.phase < phases.length && e.hp <= e.maxHp * phases[e.phase].at) {
      const phase = phases[e.phase++];
      let label = t(phase.name).toUpperCase();
      for (const action of phase.actions) {
        switch (action.kind) {
          case 'summon':
            this.release(e, action.enemy, action.count);
            break;
          case 'shield':
            e.maxShield = e.shield = e.maxHp * action.fraction;
            break;
          case 'enrage':
            e.speedMult = action.speed;
            break;
          case 'shift':
            e.element = e.element ? OVERCOMES[e.element] : 'water';
            label += `: ${t(ELEMENTS[e.element].name).toUpperCase()}`;
            break;
          case 'cleanse': {
            // Armor break is permanent, so it survives the cleanse.
            const armorBreak = e.status.armorBreak;
            Object.assign(e.status, newStatus(), { armorBreak });
            break;
          }
        }
      }
      this.addText(e.x, e.y - 0.9, label, e.def.color);
      this.effects.push({ kind: 'pulse', x: e.x, y: e.y, radius: 1.4, ttl: 0.6, maxTtl: 0.6, color: e.def.color });
      this.effects.push({ kind: 'shake', x: 0, y: 0, ttl: 0.25, maxTtl: 0.25, color: '' });
      this.sound('boss-phase');
    }
  }

  /**
   * Releases `count` enemies of type `child` from `parent` (Splitter shards, Carrier drones).
   * They keep the parent's HP multiplier and reward scaling; same-route children start where
   * the parent is, slightly spread out.
   */
  private release(parent: Enemy, child: EnemyId, count: number): void {
    const def = ENEMIES[child];
    const route = def.movement === 'air' ? this.airPath : this.path;
    const sameRoute = route === parent.route;
    for (let i = 0; i < count; i++) {
      const element = def.id === 'shard' ? (parent.element ?? null) : undefined;
      const e = new Enemy(def, route, parent.hpMult, element);
      e.distance = sameRoute ? Math.max(0, parent.distance - i * 0.25) : 0;
      const p = route.pointAt(e.distance);
      e.x = p.x;
      e.y = p.y;
      e.reward = Math.max(1, Math.round(def.reward * (parent.reward / parent.def.reward)));
      this.pending.push(e);
    }
  }

  private spawnEnemies(dt: number): void {
    if (this.phase !== 'wave') return;
    this.waveTime += dt;
    while (this.spawnQueue.length > 0 && this.spawnQueue[0].time <= this.waveTime) {
      const entry = this.spawnQueue.shift()!;
      const def = ENEMIES[entry.enemy];
      const enemy = new Enemy(def, def.movement === 'air' ? this.airPath : this.path, entry.hpMult, entry.element);
      enemy.reward = Math.max(1, Math.round(def.reward * entry.rewardMult));
      this.enemies.push(enemy);
      if (isBoss(def)) this.sound('boss');
    }
  }

  private moveEnemies(dt: number): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.markTime = Math.max(0, e.markTime - dt);
      const dot = tickStatus(e.status, dt);
      if (dot > 0) {
        this.track('damage', STATUS_SOURCE, e.takeDamage(dot));
        if (!e.alive) {
          this.reward(e, STATUS_SOURCE);
          continue;
        }
      }
      e.distance += e.speed * dt;
      const p = e.route.pointAt(e.distance);
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const len = Math.hypot(dx, dy);
      if (len > 1e-6) {
        e.dirX = dx / len;
        e.dirY = dy / len;
      }
      e.x = p.x;
      e.y = p.y;
      if (e.distance >= e.route.length) {
        e.escaped = true;
        this.lives = Math.max(0, this.lives - e.def.livesCost);
        this.addText(e.x, e.y - 0.4, `-${e.def.livesCost} ♥`, '#ff3864');
        this.sound('leak');
        if (this.lives === 0) {
          this.phase = 'lost';
          this.sound('lose');
          return;
        }
      }
    }
  }

  private updateTowers(dt: number): void {
    for (const t of this.towers) {
      // Disrupted towers are offline: no aiming, recharging, or firing.
      if (t.disabledTime > 0) {
        t.disabledTime = Math.max(0, t.disabledTime - dt);
        continue;
      }
      // Overclocked towers (Echo) recharge faster.
      const boost = (t.boostTime > 0 ? t.boostMult : 1) * this.towerRateMult(t);
      t.boostTime = Math.max(0, t.boostTime - dt);
      t.cooldown = Math.max(0, t.cooldown - dt * boost);
      t.recoil = Math.max(0, t.recoil - dt * 5);
      const { attack, range, targets } = t.stats;
      const count = attack.kind === 'multi' ? attack.maxTargets : 1;
      const picked = selectTargets(this.enemies, t.x, t.y, range, targets, t.priority, count);
      if (picked.length === 0) continue;
      t.angle = Math.atan2(picked[0].y - t.y, picked[0].x - t.x);
      if (t.cooldown > 0) continue;
      this.fire(t, picked);
      t.cooldown = 1 / t.stats.fireRate;
      t.recoil = 1;
    }
  }

  private fire(t: Tower, picked: Enemy[]): void {
    const attack = t.stats.attack;
    this.sound(`shot-${t.weapon}`);
    switch (attack.kind) {
      case 'single':
        this.projectiles.push(new Projectile(t, picked[0]));
        break;
      case 'multi':
        picked.forEach((target, i) => {
          const side = picked.length === 1 ? 0 : (i - (picked.length - 1) / 2) * 0.15;
          this.projectiles.push(new Projectile(t, target, undefined, side));
        });
        break;
      case 'splash': {
        const target = picked[0];
        const flight = Math.hypot(target.x - t.x, target.y - t.y) / t.stats.projectileSpeed;
        const lead = Math.min(target.speed, attack.leadSpeedCap) * flight;
        this.projectiles.push(new Projectile(t, target, target.route.pointAt(target.distance + lead)));
        break;
      }
      case 'chain': {
        const chain = chainTargets(picked[0], this.enemies, attack.jumps, attack.jumpRange, t.stats.targets);
        const points = [{ x: t.x, y: t.y - 0.25 }, ...chain.map((e) => ({ x: e.x, y: e.y }))];
        this.effects.push({ kind: 'beam', x: t.x, y: t.y, points, element: t.element, ttl: 0.18, maxTtl: 0.18, color: '' });
        chain.forEach((e, i) => this.hit(e, t, (1 - attack.falloff) ** i));
        break;
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (const p of this.projectiles) {
      if (p.homing && p.target.alive) {
        p.tx = p.target.x;
        p.ty = p.target.y;
      }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const dist = Math.hypot(dx, dy);
      const step = p.source.stats.projectileSpeed * dt;
      if (dist > 1e-6) {
        p.dirX = dx / dist;
        p.dirY = dy / dist;
      }
      if (dist > step) {
        p.x += p.dirX * step;
        p.y += p.dirY * step;
        continue;
      }
      p.x = p.tx;
      p.y = p.ty;
      p.done = true;
      const radius = p.splashRadius;
      if (radius > 0) {
        this.effects.push({ kind: 'blast', x: p.x, y: p.y, radius, element: p.source.element, ttl: 0.35, maxTtl: 0.35, color: '' });
        this.sound('blast');
        for (const e of this.enemies) {
          if (!e.alive || !p.source.stats.targets.includes(e.movement)) continue;
          if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 <= radius * radius) this.hit(e, p.source);
        }
      } else if (p.target.alive) {
        this.effects.push({ kind: 'spark', x: p.x, y: p.y, element: p.source.element, ttl: 0.25, maxTtl: 0.25, color: '' });
        this.hit(p.target, p.source);
      }
    }
    this.projectiles = this.projectiles.filter((p) => !p.done);
  }

  /** One hit from a tower: damage, status effect, feedback text, kill reward. */
  private hit(enemy: Enemy, tower: Tower, scale = 1): void {
    // Burrowed enemies are out of reach: shots already in the air do nothing.
    if (enemy.burrowed) return;
    const hadShield = enemy.shield > 0;
    const result = applyHit(enemy, tower.stats, tower.element, this.rng, {
      scale: scale * this.towerDamageMult(tower),
      battlefield: this.battlefield,
      battlefieldBonus: this.battlefieldBonus,
    });
    if (hadShield && enemy.shield <= 0 && enemy.alive) {
      this.addText(enemy.x, enemy.y - 0.5, t('SHIELD DOWN'), '#4dd2ff');
      this.sound('shield-break');
    }
    if (result.crit) {
      this.addText(enemy.x, enemy.y - 0.35, t('CRIT!'), '#ff2bd6');
      this.sound('crit');
    }
    if (result.matchup !== 1 && this.time - enemy.lastMatchupPopup > 1.2) {
      enemy.lastMatchupPopup = this.time;
      const weak = result.matchup > 1;
      this.addText(enemy.x, enemy.y + 0.45, weak ? t('WEAK!') : t('RESIST'), weak ? '#7dffc0' : '#8b93b8');
    }
    if (result.froze) {
      this.addText(enemy.x, enemy.y - 0.35, t('FREEZE!'), '#00e5ff');
      this.sound('freeze');
    }
    if (result.stunned) {
      this.effects.push({ kind: 'shake', x: 0, y: 0, ttl: 0.15, maxTtl: 0.15, color: '' });
      this.sound('stun');
    }
    const source: DamageSource = { kind: 'tower', weapon: tower.weapon, element: tower.element };
    this.track('damage', source, result.dealt);
    for (const combo of result.combos) this.combo(combo, enemy, result.steamBurst, source);
    if (result.killed) this.reward(enemy, source);
  }

  /** Hero boosts on a tower's damage: Power Surge while it lasts, and a Field Engineer standing close. */
  towerDamageMult(tower: Tower): number {
    let mult = tower.boostTime > 0 ? tower.boostDamage : 1;
    const hero = this.hero;
    const p = hero?.def.passive?.effect;
    if (hero && p?.kind === 'tower-aura' && (tower.x - hero.x) ** 2 + (tower.y - hero.y) ** 2 <= p.radius ** 2) mult *= 1 + p.damage;
    return mult;
  }

  /** Auto-Loader (Echo): towers near the hero recharge faster. */
  towerRateMult(tower: Tower): number {
    const hero = this.hero;
    const p = hero?.def.passive?.effect;
    return hero && p?.kind === 'tower-rate-aura' && (tower.x - hero.x) ** 2 + (tower.y - hero.y) ** 2 <= p.radius ** 2 ? 1 + p.rate : 1;
  }

  /** Feedback and follow-ups for an element combo (Steam splash, Wildfire spread). */
  private combo(id: ComboId, enemy: Enemy, steamBurst: number, source: DamageSource): void {
    const def = COMBOS[id];
    this.stats.combos[id] = (this.stats.combos[id] ?? 0) + 1;
    if (this.time - enemy.lastComboPopup > 0.5) {
      enemy.lastComboPopup = this.time;
      this.addText(enemy.x, enemy.y - 0.65, `${t(def.name).toUpperCase()}!`, def.color);
      this.sound('combo');
    }
    switch (id) {
      case 'steam': {
        const { splashRadius, splashFraction } = COMBO_NUMBERS.steam;
        this.effects.push({ kind: 'pulse', x: enemy.x, y: enemy.y, radius: splashRadius, ttl: 0.45, maxTtl: 0.45, color: def.color });
        for (const e of this.enemies) {
          if (e === enemy || !e.alive || (e.x - enemy.x) ** 2 + (e.y - enemy.y) ** 2 > splashRadius ** 2) continue;
          this.track('damage', source, e.takeDamage(steamBurst * splashFraction));
          if (!e.alive) this.reward(e, source);
        }
        break;
      }
      case 'wildfire': {
        if (this.time - enemy.lastWildfire < COMBO_NUMBERS.wildfire.cooldown) break;
        enemy.lastWildfire = this.time;
        const { spreadRadius } = COMBO_NUMBERS.wildfire;
        const src = enemy.status;
        for (const e of this.enemies) {
          if (e === enemy || !e.alive || e.shield > 0) continue;
          if ((e.x - enemy.x) ** 2 + (e.y - enemy.y) ** 2 > spreadRadius ** 2) continue;
          e.status.burnDps = Math.max(e.status.burnTime > 0 ? e.status.burnDps : 0, src.burnDps);
          e.status.burnTime = Math.max(e.status.burnTime, src.burnTime);
          this.effects.push({
            kind: 'beam', x: enemy.x, y: enemy.y, points: [{ x: enemy.x, y: enemy.y }, { x: e.x, y: e.y }],
            element: 'fire', ttl: 0.25, maxTtl: 0.25, color: def.color,
          });
        }
        break;
      }
      case 'shatter':
        this.effects.push({ kind: 'blast', x: enemy.x, y: enemy.y, radius: 0.6, element: 'water', ttl: 0.35, maxTtl: 0.35, color: def.color });
        break;
      case 'corrosion':
      case 'rupture':
        this.effects.push({ kind: 'pulse', x: enemy.x, y: enemy.y, radius: 0.5, ttl: 0.35, maxTtl: 0.35, color: def.color });
        break;
    }
  }

  /** Adds damage dealt or a kill to the stats, by source. */
  private track(what: 'damage' | 'kills', source: DamageSource, amount = 1): void {
    const t = this.stats[what];
    if (source.kind === 'tower') {
      t.towers += amount;
      t.byWeapon[source.weapon] = (t.byWeapon[source.weapon] ?? 0) + amount;
      t.byElement[source.element] = (t.byElement[source.element] ?? 0) + amount;
    } else {
      t[source.kind] += amount;
    }
  }

  /** Returns and clears the sounds queued since the last call. */
  drainSounds(): GameSound[] {
    const out = this.sounds;
    this.sounds = [];
    return out;
  }

  private sound(id: GameSound): void {
    if (this.sounds.length >= MAX_QUEUED_SOUNDS) this.sounds.shift();
    this.sounds.push(id);
  }

  // --- Hero ---------------------------------------------------------------------------------

  /** Tells the hero to walk to (x, y) in tile units (clamped to the map). */
  moveHero(x: number, y: number): void {
    if (!this.hero || this.over) return;
    this.hero.targetX = Math.min(Math.max(x, 0.3), this.level.cols - 0.3);
    this.hero.targetY = Math.min(Math.max(y, 0.3), this.level.rows - 0.3);
  }

  /** Whether the ability in `slot` can be used right now (unlocked and off cooldown), ignoring aim. */
  heroAbilityReady(slot: number): boolean {
    const hero = this.hero;
    return !!hero && !this.over && hero.isUnlocked(slot) && hero.cooldowns[slot] <= 0;
  }

  /** Uses the ability in `slot`, aimed at (x, y) for point abilities. Returns false if it can't. */
  castHero(slot: number, x = 0, y = 0): boolean {
    const hero = this.hero;
    if (!hero || !this.heroAbilityReady(slot)) return false;
    const def = hero.ability(slot);
    if (def.target === 'point' && Math.hypot(x - hero.x, y - hero.y) > def.castRange) return false;
    if (def.target === 'self') {
      x = hero.x;
      y = hero.y;
    }
    const color = hero.def.color;
    const m = hero.damageMult;
    const eff = def.effect;
    switch (eff.kind) {
      case 'blast':
        for (const e of this.heroTargetsWithin(x, y, eff.radius)) {
          if (eff.stripShields) e.shield = 0;
          if (eff.stun) e.status.stunTime = Math.max(e.status.stunTime, eff.stun);
          this.heroDamage(e, eff.damage * m);
        }
        this.effects.push({ kind: 'pulse', x, y, radius: eff.radius, ttl: 0.5, maxTtl: 0.5, color });
        if (eff.stun) this.effects.push({ kind: 'shake', x: 0, y: 0, ttl: 0.15, maxTtl: 0.15, color: '' });
        else this.effects.push({ kind: 'blast', x, y, radius: eff.radius, element: 'water', ttl: 0.4, maxTtl: 0.4, color });
        break;
      case 'zone':
        this.zones.push({
          x, y, radius: eff.radius, ttl: eff.duration, maxTtl: eff.duration, color,
          slow: eff.slow, dps: eff.dps ? eff.dps * m : undefined, armorBreak: eff.armorBreak, stripShields: eff.stripShields,
        });
        break;
      case 'strike':
        this.strikes.push({ x, y, radius: eff.radius, damage: eff.damage * m, delay: eff.delay, maxDelay: eff.delay, ability: def.id });
        break;
      case 'dash':
        this.effects.push({
          kind: 'beam', x: hero.x, y: hero.y, points: [{ x: hero.x, y: hero.y }, { x, y }],
          element: 'fire', ttl: 0.25, maxTtl: 0.25, color,
        });
        hero.x = hero.targetX = x;
        hero.y = hero.targetY = y;
        for (const e of this.heroTargetsWithin(x, y, eff.radius)) this.heroDamage(e, eff.damage * m);
        this.effects.push({ kind: 'blast', x, y, radius: eff.radius, element: 'fire', ttl: 0.4, maxTtl: 0.4, color });
        this.effects.push({ kind: 'shake', x: 0, y: 0, ttl: 0.15, maxTtl: 0.15, color: '' });
        break;
      case 'buff':
        hero.buffTime = eff.duration;
        hero.buffAttackSpeed = eff.attackSpeed;
        hero.buffDamage = eff.damage;
        this.effects.push({ kind: 'pulse', x: hero.x, y: hero.y, radius: 0.9, ttl: 0.4, maxTtl: 0.4, color });
        break;
      case 'pierce': {
        const len = Math.hypot(x - hero.x, y - hero.y) || 1;
        const dx = (x - hero.x) / len;
        const dy = (y - hero.y) / len;
        const ex = hero.x + dx * eff.length;
        const ey = hero.y + dy * eff.length;
        for (const e of this.enemies) {
          if (!e.alive || e.def.ability?.kind === 'mirror') continue;
          const t = Math.max(0, Math.min(eff.length, (e.x - hero.x) * dx + (e.y - hero.y) * dy));
          if (Math.hypot(e.x - (hero.x + dx * t), e.y - (hero.y + dy * t)) <= eff.width) this.heroDamage(e, eff.damage * m);
        }
        this.effects.push({
          kind: 'beam', x: hero.x, y: hero.y, points: [{ x: hero.x, y: hero.y }, { x: ex, y: ey }],
          element: 'metal', ttl: 0.3, maxTtl: 0.3, color,
        });
        break;
      }
      case 'mark':
        for (const e of this.heroTargetsWithin(x, y, eff.radius)) {
          e.markTime = eff.duration;
          e.markAmp = eff.amp;
        }
        this.effects.push({ kind: 'pulse', x, y, radius: eff.radius, ttl: 0.5, maxTtl: 0.5, color });
        break;
      case 'snipe': {
        const targets = this.enemies
          .filter((e) => e.alive && e.def.ability?.kind !== 'mirror')
          .sort((a, b) => b.hp - a.hp)
          .slice(0, eff.count);
        for (const e of targets) {
          this.effects.push({
            kind: 'beam', x: hero.x, y: hero.y, points: [{ x: hero.x, y: hero.y }, { x: e.x, y: e.y }],
            element: 'metal', ttl: 0.35, maxTtl: 0.35, color,
          });
          this.heroDamage(e, eff.damage * m);
        }
        break;
      }
      case 'knockback':
        for (const e of this.heroTargetsWithin(x, y, eff.radius)) {
          e.distance = Math.max(0, e.distance - eff.distance);
          const p = e.route.pointAt(e.distance);
          e.x = p.x;
          e.y = p.y;
          this.heroDamage(e, eff.damage * m);
        }
        this.effects.push({ kind: 'pulse', x, y, radius: eff.radius, ttl: 0.6, maxTtl: 0.6, color });
        break;
      case 'chain': {
        const near = this.heroTargetsWithin(x, y, 1.5).sort(
          (a, b) => (a.x - x) ** 2 + (a.y - y) ** 2 - ((b.x - x) ** 2 + (b.y - y) ** 2),
        )[0];
        if (!near) break;
        const pool = this.enemies.filter((e) => e.def.ability?.kind !== 'mirror');
        const chain = chainTargets(near, pool, eff.jumps, eff.jumpRange, ['ground', 'air']);
        this.effects.push({
          kind: 'beam', x: hero.x, y: hero.y,
          points: [{ x: hero.x, y: hero.y }, ...chain.map((e) => ({ x: e.x, y: e.y }))],
          element: 'metal', ttl: 0.35, maxTtl: 0.35, color,
        });
        chain.forEach((e, i) => {
          if (eff.stripShields) e.shield = 0;
          this.heroDamage(e, eff.damage * m * (1 - eff.falloff) ** i);
        });
        break;
      }
      case 'freeze-all':
        for (const e of this.enemies) {
          if (!e.alive || e.def.ability?.kind === 'mirror') continue;
          e.status.stunTime = Math.max(e.status.stunTime, eff.duration);
          this.heroDamage(e, eff.damage * m);
        }
        this.effects.push({ kind: 'pulse', x: hero.x, y: hero.y, radius: 6, ttl: 0.8, maxTtl: 0.8, color });
        break;
      case 'summon':
        for (let i = 0; i < eff.count; i++) {
          const a = (i / eff.count) * Math.PI * 2;
          const r = eff.count > 1 ? 0.9 : 0;
          this.summons.push({
            x: Math.min(Math.max(x + Math.cos(a) * r, 0.3), this.level.cols - 0.3),
            y: Math.min(Math.max(y + Math.sin(a) * r, 0.3), this.level.rows - 0.3),
            ttl: eff.duration, maxTtl: eff.duration, damage: eff.damage * m, fireRate: eff.fireRate,
            range: eff.range, cooldown: 0, angle: 0,
          });
        }
        break;
      case 'repair': {
        const healed = Math.min(eff.lives, this.level.lives - this.lives);
        this.lives += healed;
        const core = this.path.points[this.path.points.length - 1];
        this.effects.push({ kind: 'pulse', x: core.x, y: core.y, radius: 1.5, ttl: 0.7, maxTtl: 0.7, color });
        this.addText(core.x, core.y - 0.6, healed > 0 ? `+${healed} ♥` : t('CORE OK'), '#7dffc0');
        break;
      }
      case 'tower-boost':
        for (const t of this.towers) {
          if ((t.x - x) ** 2 + (t.y - y) ** 2 > eff.radius ** 2) continue;
          t.boostTime = eff.duration;
          t.boostMult = eff.fireRate ?? 1;
          t.boostDamage = eff.damage ?? 1;
        }
        this.effects.push({ kind: 'pulse', x, y, radius: eff.radius, ttl: 0.5, maxTtl: 0.5, color });
        break;
    }
    this.sound(`ability:${def.id}`);
    hero.cooldowns[slot] = def.cooldown * hero.cooldownMult;
    hero.effects[slot] = hero.effectLengths[slot] = effectLength(eff);
    return true;
  }

  private updateHero(dt: number): void {
    const hero = this.hero;
    if (!hero) return;
    // Cooldowns stop while a Jammer is near; effect countdowns keep running.
    hero.jammed = this.enemies.some((e) => {
      const a = e.def.ability;
      return e.alive && a?.kind === 'jam' && (e.x - hero.x) ** 2 + (e.y - hero.y) ** 2 <= a.radius ** 2;
    });
    for (let i = 0; i < 4; i++) {
      if (!hero.jammed) hero.cooldowns[i] = Math.max(0, hero.cooldowns[i] - dt);
      hero.effects[i] = Math.max(0, hero.effects[i] - dt);
    }
    hero.buffTime = Math.max(0, hero.buffTime - dt);
    // Undertow: enemies near the hero are slowed, like standing in a slow zone.
    const passive = hero.def.passive?.effect;
    if (passive?.kind === 'slow-aura') {
      for (const e of this.heroTargetsWithin(hero.x, hero.y, passive.radius)) {
        e.status.chillSlow = Math.max(e.status.chillTime > 0 ? e.status.chillSlow : 0, passive.slow);
        e.status.chillTime = Math.max(e.status.chillTime, 0.15);
      }
    }
    // Spotter Uplink: enemies near the hero take more damage from everything (until next tick).
    if (passive?.kind === 'vulnerable-aura') {
      for (const e of this.heroTargetsWithin(hero.x, hero.y, passive.radius)) e.auraAmp = passive.amp;
    }
    const buffed = hero.buffTime > 0;

    if (hero.moving) {
      const dx = hero.targetX - hero.x;
      const dy = hero.targetY - hero.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.min(dist, hero.def.speed * dt);
      hero.x += (dx / dist) * step;
      hero.y += (dy / dist) * step;
      hero.angle = Math.atan2(dy, dx);
    }

    hero.attackCooldown = Math.max(0, hero.attackCooldown - dt);
    const atk = hero.def.attack;
    const targets = this.enemies.filter((e) => e.def.ability?.kind !== 'mirror');
    const target = selectTarget(targets, hero.x, hero.y, atk.range, ['ground', 'air'], 'first');
    if (!target) return;
    if (!hero.moving) hero.angle = Math.atan2(target.y - hero.y, target.x - hero.x);
    if (hero.attackCooldown > 0) return;
    hero.attackCooldown = 1 / (atk.fireRate * (buffed ? hero.buffAttackSpeed : 1));
    const damage = atk.damage * hero.damageMult * (buffed ? hero.buffDamage : 1);
    const color = hero.def.color;
    // Aftershock: every n-th attack also stuns what it hits.
    hero.attacks++;
    const stun = passive?.kind === 'every-nth-stun' && hero.attacks % passive.every === 0 ? passive.stun : 0;
    const strike = (e: Enemy, dmg: number) => {
      this.heroDamage(e, dmg);
      if (stun && e.alive) e.status.stunTime = Math.max(e.status.stunTime, stun);
    };
    if (stun) this.effects.push({ kind: 'shake', x: 0, y: 0, ttl: 0.12, maxTtl: 0.12, color: '' });
    if (atk.cleave) {
      // Melee: hits the target and everything right around it.
      for (const e of this.heroTargetsWithin(target.x, target.y, atk.cleave)) strike(e, e === target ? damage : damage * CLEAVE_SHARE);
      this.effects.push({ kind: 'pulse', x: target.x, y: target.y, radius: atk.cleave * 0.7, ttl: 0.2, maxTtl: 0.2, color });
      this.sound('hero-punch');
    } else if (atk.chain) {
      // Magic: a bolt that jumps to nearby enemies.
      const chain = chainTargets(target, targets, atk.chain, 1.8, ['ground', 'air']);
      this.effects.push({
        kind: 'beam', x: hero.x, y: hero.y, points: [{ x: hero.x, y: hero.y }, ...chain.map((e) => ({ x: e.x, y: e.y }))],
        element: 'metal', ttl: 0.15, maxTtl: 0.15, color,
      });
      chain.forEach((e, i) => strike(e, damage * 0.75 ** i));
      this.sound('hero-zap');
    } else {
      this.effects.push({
        kind: 'beam', x: hero.x, y: hero.y, points: [{ x: hero.x, y: hero.y }, { x: target.x, y: target.y }],
        element: 'water', ttl: 0.12, maxTtl: 0.12, color,
      });
      strike(target, damage);
      this.sound('hero-shot');
    }
  }

  /** Echo's drones: each shoots the enemy closest to the core in range until it expires. */
  private updateSummons(dt: number): void {
    for (const d of this.summons) {
      d.ttl -= dt;
      d.cooldown = Math.max(0, d.cooldown - dt);
      const targets = this.enemies.filter((e) => e.def.ability?.kind !== 'mirror');
      const target = selectTarget(targets, d.x, d.y, d.range, ['ground', 'air'], 'first');
      if (!target) continue;
      d.angle = Math.atan2(target.y - d.y, target.x - d.x);
      if (d.cooldown > 0) continue;
      d.cooldown = 1 / d.fireRate;
      this.effects.push({
        kind: 'beam', x: d.x, y: d.y, points: [{ x: d.x, y: d.y }, { x: target.x, y: target.y }],
        element: 'wood', ttl: 0.1, maxTtl: 0.1, color: this.hero?.def.color ?? '',
      });
      this.heroDamage(target, d.damage);
    }
    this.summons = this.summons.filter((d) => d.ttl > 0);
  }

  /**
   * Element multiplier for a hero hit on `enemy`: the hero's element against the enemy's
   * (weakness cycle) times the battlefield shift, exactly as for towers. Shows WEAK!/RESIST.
   */
  private heroElementMult(enemy: Enemy): number {
    const element = this.hero?.def.element;
    if (!element) return 1;
    const matchup = elementMultiplier(element, enemy.element);
    if (matchup !== 1 && this.time - enemy.lastMatchupPopup > 1.2) {
      enemy.lastMatchupPopup = this.time;
      const weak = matchup > 1;
      this.addText(enemy.x, enemy.y + 0.45, weak ? t('WEAK!') : t('RESIST'), weak ? '#7dffc0' : '#8b93b8');
    }
    return matchup * battlefieldMultiplier(element, enemy.element, this.battlefield, this.battlefieldBonus);
  }

  /**
   * Hero damage (attacks, abilities, drones): same formula as towers, with the hero's element
   * (no status effects). Mirrors are immune.
   */
  private heroDamage(enemy: Enemy, base: number): void {
    if (!enemy.alive || enemy.burrowed) return;
    if (enemy.def.ability?.kind === 'mirror') {
      if (this.time - enemy.lastMatchupPopup > 1.2) {
        enemy.lastMatchupPopup = this.time;
        this.addText(enemy.x, enemy.y + 0.45, t('IMMUNE'), '#e6f0ff');
      }
      return;
    }
    const atk = this.hero?.def.attack;
    const crit = this.rng() < (atk?.critChance ?? 0);
    // Headshot: crits hit harder than the usual 2× (the formula doubles; this scales the base).
    const p = this.hero?.def.passive?.effect;
    if (crit && p?.kind === 'crit-mult') base *= p.mult / 2;
    // Finisher: wounded enemies take extra damage (it never kills outright).
    if (p?.kind === 'finisher' && enemy.hp <= enemy.maxHp * p.threshold) base *= 1 + p.bonus;
    const dmg = computeDamage({
      base, elementMult: this.heroElementMult(enemy), crit, armor: enemy.armor,
      armorBreak: enemy.status.armorBreak, armorPierce: atk?.armorPierce ?? 0,
    });
    this.track('damage', HERO_SOURCE, enemy.takeDamage(dmg));
    if (enemy.alive) this.heroOnHit(enemy, dmg);
    if (!enemy.alive) this.reward(enemy, HERO_SOURCE);
  }

  /** Passives that trigger on a hero hit that didn't kill: Overgrowth. */
  private heroOnHit(enemy: Enemy, dmg: number): void {
    const hero = this.hero!;
    const p = hero.def.passive?.effect;
    if (!p || enemy.shield > 0) return;
    if (p.kind === 'element-hits') {
      applyElementEffect(enemy.status, hero.def.element, dmg, enemy.movement, this.rng, p.power);
    }
  }

  /** Living enemies within `radius` of (x, y) that the hero can affect (not Mirrors). */
  private heroTargetsWithin(x: number, y: number, radius: number): Enemy[] {
    return this.enemies.filter(
      (e) => e.alive && e.def.ability?.kind !== 'mirror' && (e.x - x) ** 2 + (e.y - y) ** 2 <= radius * radius,
    );
  }

  /** Hero zones: slow, burn, and/or strip armor from everything inside (except Mirrors). */
  private updateZones(dt: number): void {
    for (const z of this.zones) {
      z.ttl -= dt;
      for (const e of this.heroTargetsWithin(z.x, z.y, z.radius)) {
        if (z.slow) {
          e.status.chillSlow = Math.max(e.status.chillTime > 0 ? e.status.chillSlow : 0, z.slow);
          e.status.chillTime = Math.max(e.status.chillTime, 0.15);
        }
        if (z.armorBreak) e.status.armorBreak = Math.max(e.status.armorBreak, z.armorBreak);
        if (z.stripShields) e.shield = 0;
        if (z.dps) {
          this.track('damage', HERO_SOURCE, e.takeDamage(z.dps * dt * this.heroElementMult(e)));
          if (!e.alive) this.reward(e, HERO_SOURCE);
        }
      }
    }
    this.zones = this.zones.filter((z) => z.ttl > 0);
  }

  private updateStrikes(dt: number): void {
    for (const s of this.strikes) {
      s.delay -= dt;
      if (s.delay > 0) continue;
      for (const e of this.heroTargetsWithin(s.x, s.y, s.radius)) this.heroDamage(e, s.damage);
      this.effects.push({ kind: 'blast', x: s.x, y: s.y, radius: s.radius, element: 'fire', ttl: 0.6, maxTtl: 0.6, color: '' });
      this.effects.push({ kind: 'shake', x: 0, y: 0, ttl: 0.3, maxTtl: 0.3, color: '' });
      this.sound(`impact:${s.ability}`);
    }
    this.strikes = this.strikes.filter((s) => s.delay > 0);
  }

  /** Counts a kill toward the hero's level if it happened close enough. */
  private heroXp(enemy: Enemy): void {
    const hero = this.hero;
    if (!hero || (enemy.x - hero.x) ** 2 + (enemy.y - hero.y) ** 2 > HERO_LEVELS.xpRadius ** 2) return;
    hero.kills++;
    while (hero.level < MAX_HERO_LEVEL && hero.kills >= HERO_LEVELS.levelKills[hero.level - 1]) {
      hero.level++;
      this.addText(hero.x, hero.y - 0.6, t('LEVEL {n}', { n: hero.level }), hero.def.color);
      this.effects.push({ kind: 'pulse', x: hero.x, y: hero.y, radius: 1.2, ttl: 0.6, maxTtl: 0.6, color: hero.def.color });
      this.sound('level-up');
    }
  }

  /** Combustion (Arjun): set while an explosion is resolving, so explosion kills don't chain. */
  private bursting = false;

  private reward(enemy: Enemy, source: DamageSource): void {
    const burst = this.hero?.def.passive?.effect;
    if (source.kind === 'hero' && burst?.kind === 'death-burst' && !this.bursting) {
      this.bursting = true;
      for (const e of this.heroTargetsWithin(enemy.x, enemy.y, burst.radius)) if (e !== enemy) this.heroDamage(e, burst.damage * this.hero!.damageMult);
      this.effects.push({ kind: 'blast', x: enemy.x, y: enemy.y, radius: burst.radius, element: 'fire', ttl: 0.3, maxTtl: 0.3, color: '' });
      this.sound('combustion');
      this.bursting = false;
    }
    this.track('kills', source);
    this.sound('kill');
    this.heroXp(enemy);
    const ability = enemy.def.ability;
    if (ability?.kind === 'split') {
      this.release(enemy, ability.into, ability.count);
      this.effects.push({ kind: 'pulse', x: enemy.x, y: enemy.y, radius: 0.7, ttl: 0.35, maxTtl: 0.35, color: enemy.def.color });
      this.sound('split');
    }
    // Bounty: kills near the hero pay extra.
    const hero = this.hero;
    const p = hero?.def.passive?.effect;
    const bonus = hero && p?.kind === 'bounty' && (enemy.x - hero.x) ** 2 + (enemy.y - hero.y) ** 2 <= p.radius ** 2 ? Math.max(1, Math.round(enemy.reward * p.gold)) : 0;
    this.gold += enemy.reward + bonus;
    this.addText(enemy.x, enemy.y - 0.1, `+${enemy.reward + bonus}`, '#ffe600');
  }

  private updateEffects(dt: number): void {
    for (const fx of this.effects) {
      fx.ttl -= dt;
      if (fx.kind === 'text') fx.y -= dt * 0.8;
    }
    this.effects = this.effects.filter((fx) => fx.ttl > 0);
  }

  private checkWaveEnd(): void {
    if (this.phase !== 'wave' || this.spawnQueue.length > 0 || this.enemies.length > 0) return;
    this.lastWaveBonus = this.level.waves[this.wavesStarted - 1].bonus;
    this.gold += this.lastWaveBonus;
    this.phase = this.wavesStarted >= this.totalWaves ? 'won' : 'build';
    this.sound(this.phase === 'won' ? 'win' : 'wave-clear');
    if (this.phase === 'build') {
      this.rollWaveConditions();
      if (this.prepTime > 0) this.prepRemaining = this.prepTime;
    }
  }

  /** New lockdown and a new battlefield (never the same twice in a row) for the coming wave. */
  private rollWaveConditions(): void {
    // With a conditions seed, each wave's roll depends only on the seed and the wave number.
    const rng = this.conditionsSeed === undefined ? this.rng : seededRng((this.conditionsSeed ^ Math.imul(this.wavesStarted + 1, 0x9e3779b1)) >>> 0);
    this.locked = rollLocks(rng, this.level.lockFraction ?? LOCKDOWN.fraction);
    const choices = BATTLEFIELD_IDS.filter((id) => id !== this.battlefield?.id);
    // Clamped so a random source that can return exactly 1 still picks a valid battlefield.
    this.battlefield = BATTLEFIELDS[choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))]];
  }

  private addText(x: number, y: number, text: string, color: string): void {
    this.effects.push({ kind: 'text', x, y, text, color, ttl: 0.9, maxTtl: 0.9 });
  }
}
