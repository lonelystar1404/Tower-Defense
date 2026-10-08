import { describe, expect, it } from 'vitest';
import { ENEMIES, isBoss, type EnemyId } from '../src/data/enemies';
import { LEVELS, type LevelDef } from '../src/data/levels';
import { Enemy } from '../src/entities/Enemy';
import { dailyChallenge, dailyScore } from '../src/game/daily';
import { Game } from '../src/game/Game';
import { seededRng } from '../src/systems/rng';

const STEP = 1 / 60;

/** A straight corridor along row 2 with lockdown and battlefields off. */
const corridor: LevelDef = {
  id: 'test', name: 'Test', description: '', cols: 12, rows: 5,
  path: [[-1, 2], [11, 2]], startGold: 5000, lives: 20, lockFraction: 0, battlefieldBonus: 0,
  waves: [
    { groups: [{ enemy: 'grunt', count: 1, interval: 1 }], bonus: 10 },
    { groups: [{ enemy: 'grunt', count: 1, interval: 1 }], bonus: 10 },
    { groups: [{ enemy: 'grunt', count: 1, interval: 1 }], bonus: 10 },
  ],
};

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

/** Runs the current wave to its end with a tower that one-shots grunts. */
function clearWave(game: Game): void {
  game.startWave();
  for (let i = 0; i < 60 * 120 && game.phase === 'wave'; i++) game.update(STEP);
}

describe('Bosses', () => {
  it('each map ends with exactly one boss, in its final wave', () => {
    for (const level of LEVELS) {
      const bossWaves = level.waves.map((w, i) => (w.groups.some((g) => isBoss(ENEMIES[g.enemy])) ? i : -1)).filter((i) => i >= 0);
      expect(bossWaves, level.id).toEqual([level.waves.length - 1]);
      const groups = level.waves[level.waves.length - 1].groups.filter((g) => isBoss(ENEMIES[g.enemy]));
      expect(groups.map((g) => g.count), level.id).toEqual([1]);
    }
  });

  it('start each phase once when HP falls to its threshold', () => {
    const game = new Game(corridor);
    const boss = place(game, 'colossus', 2);
    game.update(STEP);
    expect(boss.phase).toBe(0);
    boss.hp = boss.maxHp * 0.6;
    game.update(STEP);
    expect(boss.phase).toBe(1);
    // Escorts: 2 Brutes and 6 Grunts with the boss's HP multiplier
    expect(game.enemies.filter((e) => e.def.id === 'brute')).toHaveLength(2);
    expect(game.enemies.filter((e) => e.def.id === 'grunt')).toHaveLength(6);
    game.update(STEP);
    expect(game.enemies.filter((e) => e.def.id === 'grunt')).toHaveLength(6);
    expect(game.drainSounds()).toContain('boss-phase');
  });

  it('can start several phases after one big hit', () => {
    const game = new Game(corridor);
    const boss = place(game, 'colossus', 2);
    boss.hp = boss.maxHp * 0.2;
    game.update(STEP);
    expect(boss.phase).toBe(2);
    expect(boss.speedMult).toBe(1.6);
  });

  it('Overdrive cleanses effects but keeps armor break', () => {
    const game = new Game(corridor);
    const boss = place(game, 'colossus', 2);
    boss.phase = 1;
    boss.status.stunTime = 2;
    boss.status.burnTime = 2;
    boss.status.burnDps = 5;
    boss.status.armorBreak = 6;
    boss.hp = boss.maxHp * 0.3;
    game.update(STEP);
    expect(boss.status.stunTime).toBe(0);
    expect(boss.status.burnTime).toBe(0);
    expect(boss.status.armorBreak).toBe(6);
    expect(boss.speed).toBeCloseTo(ENEMIES.colossus.speed * 1.6);
  });

  it('Bulwark raises a fresh shield; Chimera changes element', () => {
    const game = new Game(corridor);
    const bulwark = place(game, 'bulwark', 2);
    bulwark.shield = 0;
    bulwark.hp = bulwark.maxHp * 0.55;
    const chimera = place(game, 'chimera', 4);
    chimera.hp = chimera.maxHp * 0.7;
    game.update(STEP);
    expect(bulwark.shield).toBeCloseTo(bulwark.maxHp * 0.4);
    expect(bulwark.maxShield).toBeCloseTo(bulwark.maxHp * 0.4);
    expect(chimera.element).toBe('metal');
    expect(game.enemies.filter((e) => e.def.id === 'splitter')).toHaveLength(2);
  });

  it('play a warning when they arrive', () => {
    const game = new Game({ ...corridor, waves: [{ groups: [{ enemy: 'colossus', count: 1, interval: 1 }], bonus: 0 }] });
    game.startWave();
    game.update(STEP);
    expect(game.drainSounds()).toContain('boss');
  });
});

describe('Save and resume', () => {
  it('has nothing to save before wave 1 or during a wave', () => {
    const game = new Game(corridor);
    expect(game.snapshot()).toBeNull();
    game.startWave();
    expect(game.snapshot()).toBeNull();
  });

  it('restores towers, gold, lives, conditions, and stats between waves', () => {
    const game = new Game(LEVELS[0], seededRng(3));
    // First buildable tile next to the road
    const [col, row] = game.path.tiles().map(([c, r]) => [c, r - 1]).find(([c, r]) => game.canBuild(c, r))!;
    const cannon = game.build(col, row, { weapon: 'cannon', element: game.isLocked({ weapon: 'cannon', element: 'fire' }) ? 'metal' : 'fire' })!;
    game.gold += 500;
    game.upgrade(cannon);
    cannon.priority = 'strongest';
    clearWave(game);
    game.lives = 17;
    const snap = JSON.parse(JSON.stringify(game.snapshot()));
    const back = Game.restore(LEVELS[0], snap);
    expect(back.wavesStarted).toBe(1);
    expect(back.phase).toBe('build');
    expect(back.gold).toBe(game.gold);
    expect(back.lives).toBe(17);
    expect(back.battlefield).toBe(game.battlefield);
    expect([...back.locked].sort()).toEqual([...game.locked].sort());
    expect(back.stats).toEqual(game.stats);
    expect(back.prepRemaining).toBeNull();
    const t = back.towers[0];
    expect([t.col, t.row, t.weapon, t.element, t.level, t.spent, t.priority]).toEqual([col, row, cannon.weapon, cannon.element, 2, cannon.spent, 'strongest']);
    expect(t.stats).toEqual(cannon.stats);
    // The restored run plays on from the next wave.
    expect(back.startWave()).toBe(true);
    expect(back.wavesStarted).toBe(2);
  });

  it('keeps the hero, its level, and where it stood', () => {
    const zero = LEVELS.find((l) => l.id === 'zero-point')!;
    const game = new Game(zero, seededRng(1), 'leila');
    game.hero!.level = 4;
    game.hero!.kills = 40;
    game.hero!.x = game.hero!.targetX = 6.5;
    game.phase = 'build';
    game.wavesStarted = 3;
    const back = Game.restore(zero, game.snapshot()!);
    expect(back.hero!.def.id).toBe('leila');
    expect([back.hero!.level, back.hero!.kills, back.hero!.x, back.hero!.moving]).toEqual([4, 40, 6.5, false]);
  });
});

describe('Daily Challenge', () => {
  it('is the same for everyone on a UTC day and changes between days', () => {
    const a = dailyChallenge(new Date('2026-10-08T01:00:00Z'));
    const b = dailyChallenge(new Date('2026-10-08T23:00:00Z'));
    expect([a.date, a.seed, a.level.id, a.hero]).toEqual([b.date, b.seed, b.level.id, b.hero]);
    const days = Array.from({ length: 30 }, (_, i) => dailyChallenge(new Date(Date.UTC(2026, 9, 1 + i))));
    expect(new Set(days.map((d) => d.seed)).size).toBe(30);
    expect(new Set(days.map((d) => d.level.id)).size).toBeGreaterThan(3);
  });

  it('fixes each wave’s battlefield and lockdown from the seed, however the fight goes', () => {
    const withLockdown: LevelDef = { ...corridor, lockFraction: undefined };
    const rolls = (rng: () => number, conditionsSeed?: number) => {
      const game = new Game(withLockdown, rng, 'vex', { conditionsSeed });
      game.build(3, 1, { weapon: 'cannon', element: game.isLocked({ weapon: 'cannon', element: 'metal' }) ? 'earth' : 'metal' });
      const out: string[] = [];
      for (let w = 0; w < 3; w++) {
        out.push(`${game.battlefield.id}:${[...game.locked].sort().join(',')}`);
        clearWave(game);
      }
      return out;
    };
    // Different combat randomness, same conditions; without the seed they follow the combat rng.
    expect(rolls(seededRng(1), 42)).toEqual(rolls(seededRng(999), 42));
    expect(rolls(seededRng(1))).not.toEqual(rolls(seededRng(999)));
  });

  it('scores 100 per wave held, 50 per life left, and 1000 for a win', () => {
    const game = new Game(corridor);
    game.build(3, 1, { weapon: 'cannon', element: 'metal' });
    clearWave(game);
    expect(dailyScore(game)).toBe(100 + 20 * 50);
    clearWave(game);
    clearWave(game);
    expect(game.phase).toBe('won');
    expect(dailyScore(game)).toBe(300 + 20 * 50 + 1000);
  });
});
