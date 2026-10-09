import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { LEVELS, obstacleTiles } from '../src/data/levels';
import { Path } from '../src/systems/path';
import { enemiesIn, mapsOnTab, newEnemiesIn } from '../src/ui/MapMenu';
import { isUnlocked, unlockedByClearing } from '../src/ui/progress';

describe('Maps', () => {
  it('have unique ids and 15–40 waves each', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
    for (const level of LEVELS) {
      expect(level.waves.length, level.id).toBeGreaterThanOrEqual(15);
      expect(level.waves.length, level.id).toBeLessThanOrEqual(40);
    }
  });

  it('have a valid road: axis-aligned, enters from off the map, ends on the map', () => {
    for (const level of LEVELS) {
      const path = new Path(level.path);
      const tiles = path.tiles();
      const inside = ([c, r]: [number, number]) => c >= 0 && r >= 0 && c < level.cols && r < level.rows;
      expect(inside(level.path[0]), `${level.id} start`).toBe(false);
      expect(inside(level.path[level.path.length - 1]), `${level.id} base`).toBe(true);
      expect(tiles.slice(1).every(inside), `${level.id} tiles`).toBe(true);
    }
  });

  it('keep obstacles on the map and off the road', () => {
    for (const level of LEVELS) {
      const road = new Set(new Path(level.path).tiles().map(([c, r]) => `${c},${r}`));
      for (const [c, r] of obstacleTiles(level.obstacles)) {
        expect(c >= 0 && r >= 0 && c < level.cols && r < level.rows, `${level.id} ${c},${r} in bounds`).toBe(true);
        expect(road.has(`${c},${r}`), `${level.id} ${c},${r} off the road`).toBe(false);
      }
    }
    // The last two maps are the ones with obstacles.
    expect(obstacleTiles(LEVELS[5].obstacles).length).toBeGreaterThan(15);
    expect(obstacleTiles(LEVELS[6].obstacles).length).toBeGreaterThan(15);
  });

  it('have a hero from Chrome Canyon (map 3) on: random on maps 3–5, chosen after', () => {
    const first = LEVELS.findIndex((l) => l.id === 'chrome-canyon');
    LEVELS.forEach((level, i) => {
      expect(level.heroStart !== undefined, level.id).toBe(i >= first);
      if (level.heroStart) expect(level.heroMode ?? 'choose', level.id).toBe(i <= first + 2 ? 'random' : 'choose');
    });
  });

  it('only use known enemies', () => {
    for (const level of LEVELS) for (const w of level.waves) for (const g of w.groups) expect(ENEMIES[g.enemy], g.enemy).toBeDefined();
  });

  it('each later map introduces its own new enemy types', () => {
    // Bosses count too: Bulwark, Chimera, and Leviathan first appear on maps 2–4.
    expect(newEnemiesIn(1).sort()).toEqual(['bulwark', 'medic', 'shielder']);
    expect(newEnemiesIn(2).sort()).toEqual(['chimera', 'ghost', 'shard', 'splitter']);
    expect(newEnemiesIn(3).sort()).toEqual(['carrier', 'leviathan', 'phaser']);
    expect(newEnemiesIn(4).sort()).toEqual(['jammer', 'mirror']);
    expect(newEnemiesIn(5).sort()).toEqual(['disruptor', 'prism']);
    expect(newEnemiesIn(6).sort()).toEqual(['burrower', 'warden']);
    expect(newEnemiesIn(7).sort()).toEqual(['surger']);
    // New enemies stay on their own map
    expect(enemiesIn(LEVELS[0])).not.toContain('shielder');
    expect(enemiesIn(LEVELS[3])).not.toContain('ghost');
  });
});

describe('Map select tabs', () => {
  it('split the campaign from the multiplayer maps, each numbered from 1', () => {
    const single = mapsOnTab('single');
    const multi = mapsOnTab('multi');
    expect(single.length + multi.length).toBe(LEVELS.length);
    expect(single.map((m) => m.number)).toEqual(single.map((_, i) => i + 1));
    expect(single.every((m) => !m.level.multiplayer)).toBe(true);
    expect(multi.map((m) => [m.number, m.level.id])).toEqual([[1, 'overlink'], [2, 'gridlock']]);
    expect(multi.map((m) => m.index)).toEqual([7, 8]);
  });
});

describe('Progress', () => {
  it('opens the first map and each next one after the previous is cleared', () => {
    expect(isUnlocked(LEVELS, 0, { cleared: [] })).toBe(true);
    expect(isUnlocked(LEVELS, 1, { cleared: [] })).toBe(false);
    expect(isUnlocked(LEVELS, 1, { cleared: [LEVELS[0].id] })).toBe(true);
    expect(isUnlocked(LEVELS, 2, { cleared: [LEVELS[0].id] })).toBe(false);
  });

  it('opens multiplayer together with Map 3 (Chrome Canyon); Gridlock after Overlink', () => {
    const at = (id: string) => LEVELS.findIndex((l) => l.id === id);
    const overlink = at('overlink');
    const gridlock = at('gridlock');
    expect(isUnlocked(LEVELS, overlink, { cleared: ['neon-district'] })).toBe(false);
    expect(isUnlocked(LEVELS, overlink, { cleared: ['neon-district', 'harbor-grid'] })).toBe(true);
    expect(unlockedByClearing(LEVELS, overlink)?.id).toBe('harbor-grid');
    expect(isUnlocked(LEVELS, gridlock, { cleared: ['neon-district', 'harbor-grid'] })).toBe(false);
    expect(isUnlocked(LEVELS, gridlock, { cleared: ['overlink'] })).toBe(true);
  });

  it('opens maps marked unlocked without progress; Zero Point follows the normal order', () => {
    const zero = LEVELS.findIndex((l) => l.id === 'zero-point');
    expect(isUnlocked(LEVELS, zero, { cleared: [] })).toBe(false);
    expect(isUnlocked(LEVELS, zero, { cleared: [LEVELS[zero - 1].id] })).toBe(true);
    const open = LEVELS.map((l, i) => (i === zero ? { ...l, unlocked: true } : l));
    expect(isUnlocked(open, zero, { cleared: [] })).toBe(true);
  });
});
