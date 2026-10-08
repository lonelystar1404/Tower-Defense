import { describe, expect, it } from 'vitest';
import { ENEMIES, type EnemyId } from '../src/data/enemies';
import { LEVELS, type LevelDef } from '../src/data/levels';
import { BUILD_ELEMENTS, MAX_TOWER_LEVEL, towerCost, towerStats, upgradeCost, type TowerOption } from '../src/data/towers';
import type { ElementId } from '../src/data/elements';
import type { WeaponId } from '../src/data/weapons';
import { Enemy } from '../src/entities/Enemy';
import { buildSpawnQueue, Game } from '../src/game/Game';
import { HERO_IDS, type HeroId } from '../src/data/hero';
import { applyHit } from '../src/systems/combat';
import { battlefieldMultiplier } from '../src/systems/damage';
import { BATTLEFIELDS } from '../src/data/battlefields';
import { seededRng } from '../src/systems/rng';

const STEP = 1 / 60;
/** The real level with lockdown and battlefield effects off, so unit tests are exact. */
const level: LevelDef = { ...LEVELS[0], lockFraction: 0, battlefieldBonus: 0 };
/** The real level as players get it (the first map has no lockdown). */
const realLevel = LEVELS[0];
const tower = (weapon: WeaponId, element: ElementId): TowerOption => ({ weapon, element });
const metal = (weapon: WeaponId): TowerOption => tower(weapon, 'metal');
const STEEL_CANNON = metal('cannon');

/** A straight corridor along row 2, for weapon tests. */
const corridor: LevelDef = {
  id: 'test', name: 'Test', description: '', cols: 12, rows: 5,
  path: [[-1, 2], [11, 2]], startGold: 1000, lives: 20, lockFraction: 0, battlefieldBonus: 0,
  waves: [{ groups: [{ enemy: 'grunt', count: 1, interval: 1 }], bonus: 0 }],
};

/** Puts an enemy of `id` at `distance` along its route, without moving it this tick. */
function place(game: Game, id: EnemyId, distance: number, hpMult = 1): Enemy {
  const def = ENEMIES[id];
  const e = new Enemy(def, def.movement === 'air' ? game.airPath : game.path, hpMult);
  e.distance = distance;
  const p = e.route.pointAt(distance);
  e.x = p.x;
  e.y = p.y;
  game.enemies.push(e);
  return e;
}

/** Runs until the current wave ends (or the game ends), using the hero's abilities if there is one. */
function playWave(game: Game): void {
  game.startWave();
  for (let i = 0; i < 60 * 600 && game.phase === 'wave'; i++) {
    game.update(STEP);
    if (game.hero && i % 15 === 0) heroAI(game);
  }
}

/**
 * A simple hero player for any hero. Melee heroes chase the lead enemy; everyone fires
 * abilities when they'd hit something: point abilities at the enemy closest to the core in
 * reach (strikes at the biggest cluster), self blasts at 3+ enemies near, buffs when something
 * is in attack range, global abilities when 4+ enemies are on the map. Knockbacks are saved
 * for enemies within 8 tiles of the core.
 */
function heroAI(game: Game): void {
  const hero = game.hero!;
  const alive = game.enemies.filter((e) => e.alive && !e.hidden);
  if (alive.length === 0) return;
  const near = (x: number, y: number, r: number) => alive.filter((e) => Math.hypot(e.x - x, e.y - y) <= r);
  const lead = (reach: number) => near(hero.x, hero.y, reach).sort((a, b) => a.remaining - b.remaining)[0];
  if (hero.def.attack.range < 2) {
    const target = lead(6);
    if (target) game.moveHero(target.x, target.y);
  }
  hero.def.abilities.forEach((a, slot) => {
    if (!game.heroAbilityReady(slot)) return;
    const eff = a.effect;
    if (eff.kind === 'repair') {
      if (game.lives <= game.level.lives - 3) game.castHero(slot);
    } else if (a.target === 'global') {
      if (alive.length >= 4) game.castHero(slot);
    } else if (a.target === 'self') {
      if (eff.kind === 'buff') {
        if (near(hero.x, hero.y, hero.def.attack.range).length > 0) game.castHero(slot);
      } else if (near(hero.x, hero.y, a.aimRadius).length >= 3) game.castHero(slot);
    } else if (eff.kind === 'strike') {
      const crowd = (e: (typeof alive)[number]) => near(e.x, e.y, a.aimRadius).length;
      const best = [...alive].sort((x, y) => crowd(y) - crowd(x))[0];
      if (crowd(best) >= 4) game.castHero(slot, best.x, best.y);
    } else {
      const t = lead(a.castRange);
      // Save knockbacks for enemies close to the core (they push kills away from the hero).
      if (t && (eff.kind !== 'knockback' || t.remaining < 8)) game.castHero(slot, t.x, t.y);
    }
  });
}

/** How much of the routes this tower could hit from this tile, sampled every 0.1 tiles. */
function coverage(game: Game, col: number, row: number, option: TowerOption): number {
  const { range, targets } = towerStats(option);
  let n = 0;
  for (const [movement, route] of [['ground', game.path], ['air', game.airPath]] as const) {
    if (!targets.includes(movement)) continue;
    for (let d = 0; d < route.length; d += 0.1) {
      const p = route.pointAt(d);
      if ((p.x - col - 0.5) ** 2 + (p.y - row - 0.5) ** 2 <= range * range) n++;
    }
  }
  return n;
}

/** Route samples (every 0.1 tile) a new tower must cover to be worth building. */
const MIN_USEFUL_COVERAGE = 40;

/**
 * Simulates a sensible player: before each wave, buys towers in `plan` order (cycling),
 * each on the free tile where it covers the most route, until the next one is unaffordable.
 * If the planned combo is locked, it takes the same weapon in the first open element.
 * With `upgrades`, once it has `maxTowers` towers it spends leftover gold upgrading the
 * lowest-level towers first (oldest first among equals). It also does that whenever no free
 * tile covers enough route to be worth a tower, like a player whose map is full.
 */
function playBot(lvl: LevelDef, seed: number, plan: TowerOption[], maxTowers = Infinity, upgrades = false, hero: HeroId = 'vex'): Game {
  const game = new Game(lvl, seededRng(seed), hero);
  let next = 0;
  while (!game.over) {
    let mapFull = false;
    while (game.towers.length < maxTowers) {
      const planned = plan[next % plan.length];
      const element = game.isLocked(planned)
        ? BUILD_ELEMENTS.find((e) => !game.isLocked({ weapon: planned.weapon, element: e }))!
        : planned.element;
      const option = { weapon: planned.weapon, element };
      if (game.gold < towerCost(option)) break;
      let best: [number, number] | null = null;
      let bestScore = 0;
      for (let r = 0; r < lvl.rows; r++) {
        for (let c = 0; c < lvl.cols; c++) {
          if (!game.canBuild(c, r)) continue;
          const s = coverage(game, c, r, option);
          if (s > bestScore) {
            bestScore = s;
            best = [c, r];
          }
        }
      }
      // A tile that covers less than ~4 tiles of route isn't worth a tower; upgrade instead.
      if (!best || bestScore < MIN_USEFUL_COVERAGE) {
        mapFull = true;
        break;
      }
      if (!game.build(best[0], best[1], option)) break;
      next++;
    }
    // Upgrade with leftover gold at the tower cap (if asked to), or always once no useful tile is left.
    if ((upgrades && game.towers.length >= maxTowers) || mapFull) {
      for (;;) {
        const t = [...game.towers]
          .filter((tw) => game.nextUpgradeCost(tw) !== null && !game.isLocked(tw))
          .sort((a, b) => a.level - b.level)[0];
        if (!t || !game.upgrade(t)) break;
      }
    }
    playWave(game);
  }
  return game;
}

/** Weapons a sensible player buys, in order. */
const WEAPON_PLAN: WeaponId[] = ['cannon', 'multi', 'mortar', 'flak', 'cannon', 'chain', 'flak', 'sniper'];
/** The weapon plan with elements chosen for each job. */
const MIXED_PLAN: TowerOption[] = [
  tower('cannon', 'earth'), tower('multi', 'water'), tower('mortar', 'fire'), tower('flak', 'metal'),
  tower('cannon', 'metal'), tower('chain', 'wood'), tower('flak', 'water'), tower('sniper', 'metal'),
];
/** The weapon plan with every tower on one element. */
const singleElementPlan = (element: ElementId) => WEAPON_PLAN.map((w) => tower(w, element));

describe('buildSpawnQueue', () => {
  it('orders spawns from several groups by time', () => {
    const q = buildSpawnQueue({
      groups: [
        { enemy: 'grunt', count: 2, interval: 2 },
        { enemy: 'grunt', count: 2, interval: 2, delay: 1, hpMult: 3 },
      ],
      bonus: 0,
    });
    expect(q.map((e) => e.time)).toEqual([0, 1, 2, 3]);
    expect(q.map((e) => e.hpMult)).toEqual([1, 3, 1, 3]);
  });
});

describe('Map HP scale', () => {
  it('multiplies every spawn group\'s HP', () => {
    const wave = { groups: [{ enemy: 'grunt' as const, count: 2, interval: 1, hpMult: 2 }, { enemy: 'brute' as const, count: 1, interval: 1 }], bonus: 0 };
    expect(buildSpawnQueue(wave, 1.5).map((e) => e.hpMult)).toEqual([3, 1.5, 3]);
    const game = new Game({ ...corridor, hpScale: 0.5 });
    game.startWave();
    game.update(STEP);
    expect(game.enemies[0].maxHp).toBe(ENEMIES.grunt.hp * 0.5);
  });
});

describe('Game economy', () => {
  it('builds only on free, in-bounds, non-path tiles and charges gold', () => {
    const game = new Game(level);
    const [pc, pr] = level.path[1];
    expect(game.build(pc, pr, STEEL_CANNON)).toBeNull();
    expect(game.build(-1, 0, STEEL_CANNON)).toBeNull();
    expect(game.build(0, 0, STEEL_CANNON)).not.toBeNull();
    expect(game.build(0, 0, STEEL_CANNON)).toBeNull();
    expect(game.gold).toBe(level.startGold - towerCost(STEEL_CANNON));
  });

  it('refuses to build without enough gold', () => {
    const game = new Game({ ...level, startGold: 10 });
    expect(game.build(0, 0, STEEL_CANNON)).toBeNull();
    expect(game.gold).toBe(10);
  });

  it('refunds 70% on sell', () => {
    const game = new Game(level);
    const tower = game.build(0, 0, STEEL_CANNON)!;
    game.sell(tower);
    expect(game.towers).toHaveLength(0);
    expect(game.gold).toBe(level.startGold - 50 + 35);
  });
});

describe('Sound events', () => {
  it('are queued for building, upgrading, selling, and drained once', () => {
    const game = new Game({ ...level, startGold: 5000 });
    const t = game.build(0, 0, STEEL_CANNON)!;
    game.upgrade(t);
    game.sell(t);
    expect(game.drainSounds()).toEqual(['build', 'upgrade', 'sell']);
    expect(game.drainSounds()).toEqual([]);
  });

  it('cover a wave: start, shots, kills, and clear', () => {
    const game = new Game({ ...corridor, waves: [{ groups: [{ enemy: 'grunt', count: 2, interval: 1 }], bonus: 0 }, ...level.waves] }, () => 0.5);
    game.build(5, 3, metal('cannon'));
    game.drainSounds();
    game.startWave();
    const heard = new Set<string>();
    for (let i = 0; i < 60 * 60 && game.phase === 'wave'; i++) {
      game.update(STEP);
      for (const id of game.drainSounds()) heard.add(id);
    }
    expect([...heard]).toEqual(expect.arrayContaining(['wave-start', 'shot-cannon', 'kill', 'wave-clear']));
  });

  it('tick in the last 5 seconds of the countdown', () => {
    const game = new Game({ ...corridor, prepTime: 30 });
    game.prepRemaining = 6;
    const ticks: string[] = [];
    for (let i = 0; i < 60 * 7; i++) {
      game.update(STEP);
      ticks.push(...game.drainSounds().filter((id) => id.startsWith('tick')));
    }
    expect(ticks).toEqual(['tick', 'tick', 'tick', 'tick', 'tick-final']);
  });

  it('cap the queue when nobody drains it', () => {
    const game = new Game({ ...level, startGold: 100000 });
    for (let c = 0; c < 20; c++) for (let r = 10; r < 12; r++) game.build(c, r, STEEL_CANNON);
    expect(game.drainSounds().length).toBeLessThanOrEqual(64);
  });
});

describe('Get-ready countdown', () => {
  const twoWaves: LevelDef = {
    ...corridor,
    prepTime: 30,
    waves: [
      { groups: [{ enemy: 'grunt', count: 1, interval: 1 }], bonus: 15 },
      { groups: [{ enemy: 'grunt', count: 1, interval: 1 }], bonus: 0 },
    ],
  };
  const clearFirstWave = () => {
    const game = new Game(twoWaves, () => 0.5);
    game.build(5, 3, metal('cannon'));
    game.build(8, 3, metal('cannon'));
    playWave(game);
    return game;
  };

  it('does not run before the first wave', () => {
    const game = new Game(twoWaves);
    expect(game.prepRemaining).toBeNull();
    for (let i = 0; i < 60 * 60; i++) game.update(STEP);
    expect(game.phase).toBe('build');
    expect(game.wavesStarted).toBe(0);
  });

  it('starts at 30s after a wave is cleared and remembers the bonus', () => {
    const game = clearFirstWave();
    expect(game.phase).toBe('build');
    expect(game.prepRemaining).toBe(30);
    expect(game.lastWaveBonus).toBe(15);
  });

  it('starts the next wave by itself when it reaches 0', () => {
    const game = clearFirstWave();
    for (let i = 0; i < 60 * 29; i++) game.update(STEP);
    expect(game.phase).toBe('build');
    for (let i = 0; i < 60 * 2; i++) game.update(STEP);
    expect(game.phase).toBe('wave');
    expect(game.wavesStarted).toBe(2);
    expect(game.prepRemaining).toBeNull();
  });

  it('Ready skips the rest of the countdown', () => {
    const game = clearFirstWave();
    game.update(5);
    expect(game.startWave()).toBe(true);
    expect(game.wavesStarted).toBe(2);
    expect(game.prepRemaining).toBeNull();
  });

  it('is off when prepTime is 0, and not set after the last wave', () => {
    const noTimer = new Game({ ...twoWaves, prepTime: 0 }, () => 0.5);
    noTimer.build(5, 3, metal('cannon'));
    playWave(noTimer);
    expect(noTimer.prepRemaining).toBeNull();
    const game = clearFirstWave();
    playWave(game);
    expect(game.phase).toBe('won');
    expect(game.prepRemaining).toBeNull();
  });
});

describe('Upgrades', () => {
  it('cost gold, raise the level, and improve damage and range', () => {
    const game = new Game(level);
    const t = game.build(0, 0, STEEL_CANNON)!;
    const before = { ...t.stats };
    const gold = game.gold;
    const cost = game.nextUpgradeCost(t)!;
    expect(cost).toBe(upgradeCost(STEEL_CANNON, 2));
    expect(game.upgrade(t)).toBe(true);
    expect(t.level).toBe(2);
    expect(game.gold).toBe(gold - cost);
    expect(t.stats.damage).toBeGreaterThan(before.damage);
    expect(t.stats.range).toBeGreaterThan(before.range);
  });

  it('stop at the max level', () => {
    const game = new Game({ ...level, startGold: 10000 });
    const t = game.build(0, 0, STEEL_CANNON)!;
    for (let i = 1; i < MAX_TOWER_LEVEL; i++) expect(game.upgrade(t)).toBe(true);
    expect(t.level).toBe(MAX_TOWER_LEVEL);
    expect(game.nextUpgradeCost(t)).toBeNull();
    expect(game.upgrade(t)).toBe(false);
  });

  it('need enough gold', () => {
    const game = new Game({ ...level, startGold: towerCost(STEEL_CANNON) });
    const t = game.build(0, 0, STEEL_CANNON)!;
    expect(game.upgrade(t)).toBe(false);
    expect(t.level).toBe(1);
  });

  it('count toward the sell refund', () => {
    const game = new Game({ ...level, startGold: 10000 });
    const t = game.build(0, 0, STEEL_CANNON)!;
    game.upgrade(t);
    expect(game.sellValue(t)).toBe(Math.floor((towerCost(STEEL_CANNON) + upgradeCost(STEEL_CANNON, 2)) * 0.7));
  });

  it('make the element effect stronger', () => {
    const game = new Game(corridor);
    const a = place(game, 'brute', 1);
    const b = place(game, 'brute', 1);
    applyHit(a, towerStats(tower('cannon', 'fire'), 1), 'fire', () => 1);
    applyHit(b, towerStats(tower('cannon', 'fire'), 3), 'fire', () => 1);
    expect(b.status.burnDps).toBeGreaterThan(a.status.burnDps);
  });
});

describe('Game waves', () => {
  it('loses lives when enemies reach the base, and ends at 0 lives', () => {
    const game = new Game({ ...level, lives: 3 });
    playWave(game);
    expect(game.lives).toBe(0);
    expect(game.phase).toBe('lost');
  });

  it('pays kill rewards and the wave bonus, then returns to build phase', () => {
    const game = new Game({
      ...level,
      waves: [{ groups: [{ enemy: 'grunt', count: 1, interval: 1 }], bonus: 20 }, ...level.waves],
    }, seededRng(1));
    game.build(4, 3, STEEL_CANNON);
    const before = game.gold;
    playWave(game);
    expect(game.phase).toBe('build');
    expect(game.lives).toBe(level.lives);
    expect(game.gold).toBe(before + ENEMIES.grunt.reward + 20);
  });

  it('scales kill rewards by the wave rewardMult', () => {
    const game = new Game({
      ...corridor,
      waves: [{ groups: [{ enemy: 'brute', count: 1, interval: 1 }], bonus: 0, rewardMult: 0.5 }],
    });
    game.startWave();
    game.update(STEP);
    expect(game.enemies[0].reward).toBe(Math.round(ENEMIES.brute.reward * 0.5));
  });

  it('cannot start a wave while one is running', () => {
    const game = new Game(level);
    expect(game.startWave()).toBe(true);
    expect(game.startWave()).toBe(false);
  });
});

describe('Flyers', () => {
  it('fly a straight line from spawn to base', () => {
    const game = new Game(level);
    const [c0, r0] = level.path[0];
    const [c1, r1] = level.path[level.path.length - 1];
    expect(game.airPath.length).toBeCloseTo(Math.hypot(c1 - c0, r1 - r0));
    expect(game.airPath.length).toBeLessThan(game.path.length);
  });

  it('are ignored by ground-only weapons and hit by anti-air', () => {
    const game = new Game(corridor, seededRng(1));
    const drone = place(game, 'drone', 3);
    game.build(Math.floor(drone.x), 3, STEEL_CANNON);
    for (let i = 0; i < 30; i++) game.update(STEP);
    expect(game.projectiles).toHaveLength(0);
    game.build(Math.floor(drone.x), 1, metal('flak'));
    game.update(STEP);
    expect(game.projectiles).toHaveLength(1);
  });

  it('take bonus damage from flak', () => {
    const stats = towerStats(metal('flak'));
    const game = new Game(corridor);
    const drone = place(game, 'drone', 3);
    const hit = applyHit(drone, stats, 'metal', () => 1);
    expect(hit.damage).toBeCloseTo(stats.damage * stats.airBonus);
  });
});

describe('Weapons', () => {
  it('Multi-Shot fires at up to 3 different targets at once', () => {
    const game = new Game(corridor);
    for (const d of [3, 3.5, 4, 4.5]) place(game, 'grunt', d);
    game.build(4, 3, metal('multi'));
    game.update(STEP);
    const targets = new Set(game.projectiles.map((p) => p.target));
    expect(game.projectiles).toHaveLength(3);
    expect(targets.size).toBe(3);
  });

  it('Mortar damages every ground enemy in the blast, and only those', () => {
    const game = new Game(corridor, () => 1);
    const near = [place(game, 'brute', 5), place(game, 'brute', 5.4)];
    // In range but behind, so the mortar aims at the front pair.
    const far = place(game, 'brute', 2.5);
    game.build(4, 4, metal('mortar'));
    for (let i = 0; i < 60 && near[0].hp === near[0].maxHp; i++) game.update(STEP);
    for (const e of near) expect(e.hp).toBeLessThan(e.maxHp);
    expect(far.hp).toBe(far.maxHp);
  });

  it('Chain hits the first target and jumps with falling damage', () => {
    const game = new Game(corridor, () => 1);
    const chain = [4, 5, 6, 7].map((d) => place(game, 'brute', d));
    game.build(5, 3, metal('chain'));
    game.update(STEP);
    const dealt = chain.map((e) => e.maxHp - e.hp).sort((a, b) => b - a);
    expect(dealt.every((d) => d > 0)).toBe(true);
    for (let i = 1; i < dealt.length; i++) expect(dealt[i]).toBeLessThan(dealt[i - 1]);
  });

  it('Sniper defaults to the strongest target in range', () => {
    const game = new Game(corridor);
    place(game, 'grunt', 6);
    const brute = place(game, 'brute', 2);
    const sniper = game.build(4, 0, metal('sniper'))!;
    expect(sniper.priority).toBe('strongest');
    game.update(STEP);
    expect(game.projectiles[0].target).toBe(brute);
  });
});

describe('Elements in play', () => {
  it('burn damage that finishes an enemy still pays the reward', () => {
    const game = new Game(corridor, () => 1);
    const grunt = place(game, 'grunt', 0);
    applyHit(grunt, towerStats(tower('cannon', 'fire')), 'fire', () => 1);
    grunt.hp = 0.5;
    const before = game.gold;
    game.update(0.5);
    expect(grunt.alive).toBe(false);
    expect(game.gold).toBe(before + ENEMIES.grunt.reward);
  });

  it('frozen enemies stop moving', () => {
    const game = new Game(corridor);
    const grunt = place(game, 'grunt', 1);
    const stats = towerStats(tower('flak', 'water'));
    for (let i = 0; i < 3; i++) applyHit(grunt, stats, 'water', () => 1);
    const before = grunt.distance;
    game.update(0.5);
    expect(grunt.distance).toBe(before);
  });

  it('Earth armor break makes later hits on armored enemies hurt more', () => {
    const game = new Game(corridor);
    const brute = place(game, 'brute', 1);
    const stats = towerStats(tower('cannon', 'earth'));
    const first = applyHit(brute, stats, 'earth', () => 1).damage;
    for (let i = 0; i < 4; i++) applyHit(brute, stats, 'earth', () => 1);
    const later = applyHit(brute, stats, 'earth', () => 1).damage;
    expect(later - first).toBeCloseTo(ENEMIES.brute.armor);
  });

  it('effects are not applied to an enemy the hit killed', () => {
    const game = new Game(corridor);
    const grunt = place(game, 'grunt', 1);
    grunt.hp = 1;
    applyHit(grunt, towerStats(tower('cannon', 'fire')), 'fire', () => 1);
    expect(grunt.status.burnTime).toBe(0);
  });
});

describe('Enemy elements', () => {
  it('come from the enemy type, unless the wave group overrides them', () => {
    const game = new Game(corridor);
    expect(new Enemy(ENEMIES.brute, game.path).element).toBe(ENEMIES.brute.element);
    expect(new Enemy(ENEMIES.brute, game.path, 1, 'wood').element).toBe('wood');
    expect(new Enemy(ENEMIES.brute, game.path, 1, null).element).toBeUndefined();
    expect(new Enemy(ENEMIES.grunt, game.path).element).toBeUndefined();
  });

  it('spawn with their group element', () => {
    const game = new Game({ ...corridor, waves: [{ groups: [{ enemy: 'grunt', count: 1, interval: 1, element: 'water' }], bonus: 0 }] });
    game.startWave();
    game.update(STEP);
    expect(game.enemies[0].element).toBe('water');
  });

  it('use the weakness cycle: +50% when the tower overcomes them, −25% when they resist', () => {
    const game = new Game(corridor);
    const stats = towerStats(tower('cannon', 'fire'));
    const metalGrunt = new Enemy(ENEMIES.grunt, game.path, 10, 'metal');
    const waterGrunt = new Enemy(ENEMIES.grunt, game.path, 10, 'water');
    const plain = new Enemy(ENEMIES.grunt, game.path, 10, null);
    const dmg = (e: Enemy) => applyHit(e, stats, 'fire', () => 1).damage;
    const armor = ENEMIES.grunt.armor;
    expect(dmg(metalGrunt) + armor).toBeCloseTo((dmg(plain) + armor) * 1.5);
    expect(dmg(waterGrunt) + armor).toBeCloseTo((dmg(plain) + armor) * 0.75);
  });
});

describe('Battlefields', () => {
  it('a new battlefield each wave, never the same twice in a row', () => {
    const waves = Array.from({ length: 6 }, () => ({ groups: [{ enemy: 'grunt' as const, count: 1, interval: 1 }], bonus: 0 }));
    const game = new Game({ ...corridor, waves, startGold: 5000 }, seededRng(4));
    game.build(5, 3, metal('cannon'));
    game.build(8, 3, metal('cannon'));
    const seen = [game.battlefield.id];
    for (let w = 0; w < 5; w++) {
      playWave(game);
      seen.push(game.battlefield.id);
    }
    for (let i = 1; i < seen.length; i++) expect(seen[i]).not.toBe(seen[i - 1]);
    expect(new Set(seen).size).toBeGreaterThan(1);
  });

  it('shift damage for towers and enemies of the boosted and weakened elements', () => {
    const game = new Game({ ...corridor, battlefieldBonus: 0.05 });
    game.battlefield = BATTLEFIELDS.mars; // Fire +5%, Metal −5%
    const hit = (element: ElementId, enemyElement: ElementId | null) => {
      const e = new Enemy(ENEMIES.grunt, game.path, 10, enemyElement);
      return applyHit(e, towerStats(tower('cannon', element)), element, () => 1, { battlefield: game.battlefield, battlefieldBonus: 0.05 }).damage + ENEMIES.grunt.armor;
    };
    const base = (element: ElementId) => towerStats(tower('cannon', element)).damage;
    expect(hit('fire', null)).toBeCloseTo(base('fire') * 1.05);
    // Metal ignores half the armor, so only half of it was subtracted.
    expect(hit('metal', null) - ENEMIES.grunt.armor * 0.5).toBeCloseTo(base('metal') * 0.95);
    expect(hit('wood', null)).toBeCloseTo(base('wood'));
    // Enemies: Fire enemies (boosted) take 5% less; Metal enemies (weakened) take 5% more.
    // Earth vs Fire and Water vs Metal are neutral in the weakness cycle, isolating the battlefield.
    expect(hit('earth', 'fire')).toBeCloseTo(base('earth') * 0.95);
    expect(hit('water', 'metal')).toBeCloseTo(base('water') * 1.05);
  });

  it('battlefieldMultiplier is neutral with no battlefield or no bonus', () => {
    expect(battlefieldMultiplier('fire', 'metal', null, 0.05)).toBe(1);
    expect(battlefieldMultiplier('fire', 'metal', BATTLEFIELDS.mars, 0)).toBe(1);
  });
});

// Full 25-wave simulations take several seconds each.
describe('Balance: Neon District', { timeout: 60_000 }, () => {
  it('is beatable by a sensible mixed build across many seeds', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const game = playBot(realLevel, seed, MIXED_PLAN);
      expect(game.phase, `seed ${seed}`).toBe('won');
    }
  });

  it('every hero map is beatable with every hero', { timeout: 600_000 }, () => {
    // One seed per hero and map to keep the suite quick (the random-hero maps can hand out any of them).
    const heroMaps = LEVELS.filter((l) => l.heroStart);
    expect(heroMaps.map((l) => l.id)).toEqual(['chrome-canyon', 'orbital-spire', 'zero-point', 'blackout-sector', 'core-nexus']);
    for (const map of heroMaps) {
      for (const hero of HERO_IDS) {
        for (let seed = 1; seed <= 1; seed++) {
          const game = playBot(map, seed, MIXED_PLAN, Infinity, false, hero);
          expect(game.phase, `${map.id} ${hero} seed ${seed}: fell on wave ${game.wavesStarted}`).toBe('won');
        }
      }
    }
  });

  it('every other map is beatable by the mixed build, lockdown on', () => {
    for (const map of LEVELS.slice(1)) {
      for (let seed = 1; seed <= 3; seed++) {
        const game = playBot(map, seed, MIXED_PLAN);
        expect(game.phase, `${map.id} seed ${seed}: fell on wave ${game.wavesStarted}`).toBe('won');
      }
    }
  });

  it('cannot be beaten with ground-only towers (needs anti-air)', () => {
    expect(playBot(level, 1, [metal('cannon'), metal('mortar')]).phase).toBe('lost');
  });

  it('every element can carry a build on its own through wave 8', () => {
    // Waves 9+ (elemental mix, armored columns, sky fortress) are meant to require mixing elements.
    for (const element of ['fire', 'water', 'wood', 'earth', 'metal'] as const) {
      const game = playBot(level, 1, singleElementPlan(element));
      expect(game.phase === 'won' || game.wavesStarted > 8, `${element} fell on wave ${game.wavesStarted}`).toBe(true);
    }
  });

  it('a mixed build of 16 towers that upgrades gets past wave 15', () => {
    // Waves 16–25 expect a much bigger defense (most of the map plus upgrades).
    for (let seed = 1; seed <= 5; seed++) {
      const game = playBot(realLevel, seed, MIXED_PLAN, 16, true);
      expect(game.phase === 'won' || game.wavesStarted > 15, `seed ${seed}: fell on wave ${game.wavesStarted}`).toBe(true);
    }
  });

  it('is an easy first map: 10 towers that upgrade win it', () => {
    for (let seed = 1; seed <= 3; seed++) {
      const game = playBot(realLevel, seed, MIXED_PLAN, 10, true);
      expect(game.phase, `seed ${seed}: fell on wave ${game.wavesStarted}`).toBe('won');
    }
  });

  it('cannot be beaten with just three towers', () => {
    expect(playBot(level, 1, MIXED_PLAN, 3).phase).toBe('lost');
  });
});
