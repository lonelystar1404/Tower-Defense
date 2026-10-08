import { describe, expect, it } from 'vitest';
import { ENEMIES, type EnemyId } from '../src/data/enemies';
import type { LevelDef } from '../src/data/levels';
import { towerStats } from '../src/data/towers';
import { Enemy } from '../src/entities/Enemy';
import { Game } from '../src/game/Game';
import { applyHit } from '../src/systems/combat';
import { selectTarget } from '../src/systems/targeting';

const STEP = 1 / 60;

/** A straight corridor along row 2 with lockdown and battlefields off. */
const corridor: LevelDef = {
  id: 'test', name: 'Test', description: '', cols: 12, rows: 5,
  path: [[-1, 2], [11, 2]], startGold: 5000, lives: 20, lockFraction: 0, battlefieldBonus: 0,
  waves: [{ groups: [{ enemy: 'grunt', count: 1, interval: 1 }], bonus: 0 }],
};

function place(game: Game, id: EnemyId, distance: number): Enemy {
  const def = ENEMIES[id];
  const e = new Enemy(def, def.movement === 'air' ? game.airPath : game.path);
  e.distance = distance;
  const p = e.route.pointAt(distance);
  e.x = p.x;
  e.y = p.y;
  game.enemies.push(e);
  return e;
}

describe('Shield (Shielder)', () => {
  it('absorbs damage before HP', () => {
    const e = new Enemy(ENEMIES.shielder, new Game(corridor).path);
    expect(e.shield).toBeCloseTo(e.maxHp * 0.8);
    e.takeDamage(10);
    expect(e.hp).toBe(e.maxHp);
    e.takeDamage(e.shield + 5);
    expect(e.shield).toBe(0);
    expect(e.hp).toBe(e.maxHp - 5);
  });

  it('blocks status effects until it breaks', () => {
    const e = new Enemy(ENEMIES.shielder, new Game(corridor).path);
    const fire = towerStats({ weapon: 'cannon', element: 'fire' });
    applyHit(e, fire, 'fire', () => 1);
    expect(e.status.burnTime).toBe(0);
    e.shield = 0;
    applyHit(e, fire, 'fire', () => 1);
    expect(e.status.burnTime).toBeGreaterThan(0);
  });
});

describe('Heal (Medic)', () => {
  it('heals other enemies in range every interval, up to their max HP', () => {
    const game = new Game(corridor);
    const medic = place(game, 'medic', 3);
    const near = place(game, 'grunt', 3.5);
    const far = place(game, 'grunt', 8);
    near.hp = near.maxHp * 0.5;
    far.hp = far.maxHp * 0.5;
    medic.hp = medic.maxHp * 0.5;
    for (let i = 0; i < 60 * 2.05; i++) game.update(STEP);
    expect(near.hp).toBeGreaterThan(near.maxHp * 0.5);
    expect(near.hp).toBeLessThanOrEqual(near.maxHp);
    expect(far.hp).toBe(far.maxHp * 0.5);
    expect(medic.hp).toBe(medic.maxHp * 0.5);
  });
});

describe('Split (Splitter)', () => {
  it('releases 3 Shards with its element where it died', () => {
    const game = new Game(corridor);
    game.build(5, 3, { weapon: 'sniper', element: 'metal' });
    const splitter = new Enemy(ENEMIES.splitter, game.path, 1, 'fire');
    splitter.distance = 5;
    splitter.hp = 1;
    game.enemies.push(splitter);
    for (let i = 0; i < 60 && splitter.alive; i++) game.update(STEP);
    game.update(STEP);
    const shards = game.enemies.filter((e) => e.def.id === 'shard');
    expect(splitter.alive).toBe(false);
    expect(shards).toHaveLength(3);
    for (const s of shards) {
      expect(s.element).toBe('fire');
      expect(Math.abs(s.distance - splitter.distance)).toBeLessThan(1);
    }
  });
});

describe('Stealth (Ghost)', () => {
  it('is hidden unless a tower is within reveal range', () => {
    const game = new Game(corridor);
    const ghost = place(game, 'ghost', 6);
    game.update(STEP);
    expect(ghost.hidden).toBe(true);
    expect(selectTarget(game.enemies, ghost.x, ghost.y, 5, ['ground'], 'first')).toBeNull();
    game.build(Math.floor(ghost.x), 3, { weapon: 'cannon', element: 'metal' });
    game.update(STEP);
    expect(ghost.hidden).toBe(false);
  });

  it('still takes splash damage while hidden', () => {
    const game = new Game(corridor, () => 1);
    const ghost = place(game, 'ghost', 6);
    // Mortar far enough (> 2 tiles) not to reveal it, aimed at a visible grunt beside it.
    game.build(Math.floor(ghost.x), 0, { weapon: 'mortar', element: 'metal' });
    place(game, 'brute', 6.2);
    for (let i = 0; i < 90 && ghost.hp === ghost.maxHp; i++) game.update(STEP);
    expect(ghost.hidden).toBe(true);
    expect(ghost.hp).toBeLessThan(ghost.maxHp);
  });
});

describe('Blink (Phaser)', () => {
  it('jumps ahead every interval, but waits while stunned', () => {
    const game = new Game(corridor);
    const phaser = place(game, 'phaser', 1);
    const ability = ENEMIES.phaser.ability as { kind: 'blink'; distance: number; interval: number };
    for (let i = 0; i < 60 * (ability.interval + 0.05); i++) game.update(STEP);
    const walked = ENEMIES.phaser.speed * (ability.interval + 0.05);
    expect(phaser.distance).toBeGreaterThan(1 + walked + ability.distance - 0.2);

    const stuck = place(game, 'phaser', 1);
    stuck.status.stunTime = 99;
    const before = stuck.distance;
    for (let i = 0; i < 60 * (ability.interval + 0.5); i++) game.update(STEP);
    expect(stuck.distance).toBe(before);
  });
});

describe('Spawn (Carrier)', () => {
  it('launches a Drone every interval while alive', () => {
    const game = new Game(corridor);
    place(game, 'carrier', 1);
    const interval = (ENEMIES.carrier.ability as { interval: number }).interval;
    for (let i = 0; i < 60 * (interval * 2 + 0.1); i++) game.update(STEP);
    expect(game.enemies.filter((e) => e.def.id === 'drone')).toHaveLength(2);
  });
});

describe('Disrupt (Disruptor)', () => {
  it('knocks out towers in reach, which then stop firing until it wears off', () => {
    const game = new Game(corridor);
    const near = game.build(3, 3, { weapon: 'cannon', element: 'metal' })!;
    const far = game.build(9, 3, { weapon: 'cannon', element: 'metal' })!;
    const d = place(game, 'disruptor', 4);
    d.status.stunTime = 99;
    d.abilityTimer = 0;
    game.update(STEP);
    const ability = ENEMIES.disruptor.ability as { kind: 'disrupt'; duration: number; interval: number };
    expect(near.disabledTime).toBeGreaterThan(ability.duration - 0.1);
    expect(far.disabledTime).toBe(0);
    // Offline: no shots at the Disruptor sitting in range.
    for (let i = 0; i < 60; i++) game.update(STEP);
    expect(d.hp).toBe(d.maxHp);
    // Back online after the duration (and before the next pulse lands).
    for (let i = 0; i < 60 * (ability.duration - 0.9); i++) game.update(STEP);
    expect(near.disabledTime).toBe(0);
    for (let i = 0; i < 30; i++) game.update(STEP);
    expect(d.hp).toBeLessThan(d.maxHp);
  });

  it('waits, charged, until a tower is in reach', () => {
    const game = new Game(corridor);
    const d = place(game, 'disruptor', 1);
    d.status.stunTime = 99;
    for (let i = 0; i < 60 * 5; i++) game.update(STEP);
    expect(d.abilityTimer).toBe(0);
    const t = game.build(1, 3, { weapon: 'cannon', element: 'metal' })!;
    game.update(STEP);
    expect(t.disabledTime).toBeGreaterThan(0);
  });
});

describe('Shift (Prism)', () => {
  it('moves its element one step around the cycle every interval', () => {
    const game = new Game(corridor);
    const p = place(game, 'prism', 1);
    p.status.stunTime = 99;
    const interval = (ENEMIES.prism.ability as { interval: number }).interval;
    expect(p.element).toBe('water');
    for (let i = 0; i < 60 * (interval + 0.05); i++) game.update(STEP);
    expect(p.element).toBe('fire');
    for (let i = 0; i < 60 * interval; i++) game.update(STEP);
    expect(p.element).toBe('metal');
  });
});

describe('Burrow (Burrower)', () => {
  it('dives: untargetable and immune while underground, then surfaces', () => {
    const game = new Game(corridor);
    const b = place(game, 'burrower', 1);
    b.abilityTimer = 0.01;
    game.update(STEP);
    expect(b.burrowed).toBe(true);
    expect(b.hidden).toBe(true);
    expect(b.takeDamage(50)).toBe(0);
    expect(b.hp).toBe(b.maxHp);
    expect(selectTarget([b], b.x, b.y, 3, ['ground'], 'first')).toBeNull();
    const before = b.distance;
    const duration = (ENEMIES.burrower.ability as { duration: number }).duration;
    for (let i = 0; i < 60 * (duration + 0.05); i++) game.update(STEP);
    expect(b.distance).toBeGreaterThan(before); // kept moving underground
    expect(b.burrowed).toBe(false);
    expect(b.hidden).toBe(false);
    expect(b.takeDamage(10)).toBe(10);
  });

  it("can't dig while stunned", () => {
    const game = new Game(corridor);
    const b = place(game, 'burrower', 1);
    b.abilityTimer = 0.01;
    b.status.stunTime = 1;
    game.update(STEP);
    expect(b.burrowed).toBe(false);
  });
});

describe('Fortify (Warden)', () => {
  it('gives other enemies in range extra armor, not itself, and only while near', () => {
    const game = new Game(corridor);
    const w = place(game, 'warden', 3);
    const near = place(game, 'grunt', 3.5);
    const far = place(game, 'grunt', 8);
    for (const e of [w, near, far]) e.status.stunTime = 99;
    game.update(STEP);
    const bonus = (ENEMIES.warden.ability as { armor: number }).armor;
    expect(near.armor).toBe(ENEMIES.grunt.armor + bonus);
    expect(far.armor).toBe(ENEMIES.grunt.armor);
    expect(w.armor).toBe(ENEMIES.warden.armor);
    // Armored hits do less damage.
    const stats = towerStats({ weapon: 'cannon', element: 'wood' });
    const plain = new Enemy(ENEMIES.grunt, game.path);
    expect(applyHit(near, stats, 'wood', () => 1).damage).toBeLessThan(applyHit(plain, stats, 'wood', () => 1).damage);
    w.hp = 0;
    game.update(STEP);
    expect(near.armor).toBe(ENEMIES.grunt.armor);
  });
});

describe('Obstacles', () => {
  it('block building on every tile they cover', () => {
    const game = new Game({ ...corridor, obstacles: [{ kind: 'tower', col: 3, row: 3, w: 2, h: 1 }] });
    expect(game.isObstacle(3, 3)).toBe(true);
    expect(game.canBuild(3, 3)).toBe(false);
    expect(game.canBuild(4, 3)).toBe(false);
    expect(game.canBuild(5, 3)).toBe(true);
    expect(game.build(4, 3, { weapon: 'cannon', element: 'metal' })).toBeNull();
  });
});
