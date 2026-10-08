import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/data/levels';
import { BUILD_ELEMENTS, BUILD_WEAPONS, LOCKDOWN, towerCost } from '../src/data/towers';
import { Game } from '../src/game/Game';
import { comboKey, rollLocks } from '../src/systems/lockdown';
import { seededRng } from '../src/systems/rng';

const total = BUILD_WEAPONS.length * BUILD_ELEMENTS.length;

describe('rollLocks', () => {
  it('locks 30% of combos and keeps every weapon and element usable', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const locked = rollLocks(seededRng(seed), LOCKDOWN.fraction);
      expect(locked.size).toBe(Math.round(total * LOCKDOWN.fraction));
      for (const weapon of BUILD_WEAPONS) {
        const open = BUILD_ELEMENTS.filter((element) => !locked.has(comboKey({ weapon, element }))).length;
        expect(open).toBeGreaterThanOrEqual(LOCKDOWN.minOpenPerWeapon);
      }
      for (const element of BUILD_ELEMENTS) {
        const open = BUILD_WEAPONS.filter((weapon) => !locked.has(comboKey({ weapon, element }))).length;
        expect(open).toBeGreaterThanOrEqual(LOCKDOWN.minOpenPerElement);
      }
    }
  });

  it('is deterministic for a seed and varies between seeds', () => {
    expect([...rollLocks(seededRng(5), 0.3)]).toEqual([...rollLocks(seededRng(5), 0.3)]);
    expect([...rollLocks(seededRng(5), 0.3)].sort()).not.toEqual([...rollLocks(seededRng(6), 0.3)].sort());
  });

  it('locks nothing at fraction 0', () => {
    expect(rollLocks(seededRng(1), 0).size).toBe(0);
  });
});

describe('Lockdown in the game', () => {
  const level = { ...LEVELS[0], startGold: 10000 };

  it('locked combos cannot be built; open ones can', () => {
    const game = new Game(level, seededRng(3));
    const [key] = [...game.locked];
    const [element, weapon] = key.split('-') as [never, never];
    expect(game.isLocked({ weapon, element })).toBe(true);
    expect(game.build(0, 0, { weapon, element })).toBeNull();
    const open = BUILD_WEAPONS.flatMap((w) => BUILD_ELEMENTS.map((e) => ({ weapon: w, element: e }))).find((o) => !game.isLocked(o))!;
    expect(game.build(0, 0, open)).not.toBeNull();
  });

  it('rolls a new lockdown after each wave', () => {
    const game = new Game({ ...level, waves: [{ groups: [{ enemy: 'grunt', count: 1, interval: 1 }], bonus: 0 }, ...level.waves] }, seededRng(3));
    game.build(4, 3, { weapon: 'cannon', element: [...BUILD_ELEMENTS].find((e) => !game.isLocked({ weapon: 'cannon', element: e }))! });
    const before = [...game.locked].sort();
    game.startWave();
    for (let i = 0; i < 60 * 120 && game.phase === 'wave'; i++) game.update(1 / 60);
    expect(game.phase).toBe('build');
    expect([...game.locked].sort()).not.toEqual(before);
  });

  it('towers already built keep working and can still upgrade when their combo gets locked', () => {
    const game = new Game({ ...level, lockFraction: 0 }, seededRng(1));
    const option = { weapon: 'cannon', element: 'metal' } as const;
    const t = game.build(0, 0, option)!;
    game.locked = new Set([comboKey(option)]);
    expect(game.upgrade(t)).toBe(true);
    expect(game.gold).toBeLessThan(10000 - towerCost(option));
  });

  it('lockFraction 0 turns lockdown off', () => {
    expect(new Game({ ...level, lockFraction: 0 }).locked.size).toBe(0);
  });
});
