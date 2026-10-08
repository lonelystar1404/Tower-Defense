import { describe, expect, it } from 'vitest';
import { COMBO_NUMBERS, combosFor } from '../src/data/combos';
import { ENEMIES } from '../src/data/enemies';
import type { LevelDef } from '../src/data/levels';
import { STATUS } from '../src/data/status';
import { towerStats, type TowerOption } from '../src/data/towers';
import type { WeaponId } from '../src/data/weapons';
import type { ElementId } from '../src/data/elements';
import { Enemy } from '../src/entities/Enemy';
import { Game } from '../src/game/Game';
import { applyHit } from '../src/systems/combat';

const corridor: LevelDef = {
  id: 'combo-test', name: 'Combo test', description: '', cols: 12, rows: 5,
  path: [[-1, 2], [11, 2]], startGold: 5000, lives: 20, lockFraction: 0, battlefieldBonus: 0,
  waves: [{ groups: [{ enemy: 'grunt', count: 1, interval: 1 }], bonus: 0 }],
};
const never = () => 1;
const stats = (weapon: WeaponId, element: ElementId) => towerStats({ weapon, element } as TowerOption);

function enemy(game: Game, distance = 4, hpMult = 50): Enemy {
  const e = new Enemy(ENEMIES.brute, game.path, hpMult, null);
  e.distance = distance;
  const p = game.path.pointAt(distance);
  e.x = p.x;
  e.y = p.y;
  game.enemies.push(e);
  return e;
}

describe('Element combos', () => {
  it('Steam: Fire on a chilled enemy bursts (ignoring armor) and ends burn and chill', () => {
    const game = new Game(corridor);
    const e = enemy(game);
    applyHit(e, stats('cannon', 'water'), 'water', never);
    expect(e.status.chillTime).toBeGreaterThan(0);
    const before = e.hp;
    const hit = applyHit(e, stats('cannon', 'fire'), 'fire', never);
    expect(hit.combos).toContain('steam');
    expect(hit.steamBurst).toBeCloseTo(hit.damage * COMBO_NUMBERS.steam.hitFraction);
    expect(before - e.hp).toBeCloseTo(hit.damage + hit.steamBurst);
    expect(e.status.chillTime).toBe(0);
    expect(e.status.burnTime).toBe(0);
  });

  it('Steam also works the other way: Water on a burning enemy adds the burn it had left', () => {
    const game = new Game(corridor);
    const e = enemy(game);
    applyHit(e, stats('cannon', 'fire'), 'fire', never);
    const burnLeft = e.status.burnDps * e.status.burnTime;
    const hit = applyHit(e, stats('cannon', 'water'), 'water', never);
    expect(hit.combos).toContain('steam');
    expect(hit.steamBurst).toBeCloseTo(hit.damage * COMBO_NUMBERS.steam.hitFraction + burnLeft);
  });

  it('Steam splashes onto enemies right next to it', () => {
    const game = new Game(corridor, never);
    // Towers aim at the enemy furthest along the road, so that one is chilled.
    const next = enemy(game, 4);
    const target = enemy(game, 4.4);
    target.status.chillTime = 2;
    const t = game.build(4, 3, { weapon: 'cannon', element: 'fire' })!;
    t.angle = 0;
    for (let i = 0; i < 120 && next.hp === next.maxHp; i++) game.update(1 / 60);
    expect(next.hp).toBeLessThan(next.maxHp);
    expect(game.stats.combos.steam).toBeGreaterThan(0);
  });

  it('Wildfire: a burning, poisoned enemy spreads its burn to neighbours', () => {
    const game = new Game(corridor, never);
    // Towers aim at the enemy furthest along the road, so that one is poisoned.
    const b = enemy(game, 4.2);
    const a = enemy(game, 5);
    a.status.poisonStacks = 2;
    a.status.poisonTime = 3;
    game.build(4, 3, { weapon: 'cannon', element: 'fire' });
    for (let i = 0; i < 120 && b.status.burnTime === 0; i++) game.update(1 / 60);
    expect(game.stats.combos.wildfire).toBeGreaterThan(0);
    expect(b.status.burnTime).toBeGreaterThan(0);
  });

  it('Shatter: Earth on a frozen enemy does double damage and ends the freeze', () => {
    const game = new Game(corridor);
    const plain = enemy(game);
    const frozen = enemy(game);
    frozen.status.freezeTime = 1;
    frozen.status.chillTime = 2;
    const normal = applyHit(plain, stats('cannon', 'earth'), 'earth', never);
    const hit = applyHit(frozen, stats('cannon', 'earth'), 'earth', never);
    expect(hit.combos).toContain('shatter');
    expect(hit.damage + ENEMIES.brute.armor).toBeCloseTo((normal.damage + ENEMIES.brute.armor) * COMBO_NUMBERS.shatter.damageMult);
    expect(frozen.status.freezeTime).toBe(0);
  });

  it('Corrosion: Earth on a poisoned enemy breaks extra armor and adds a poison stack', () => {
    const game = new Game(corridor);
    const e = enemy(game);
    e.status.poisonStacks = 1;
    e.status.poisonTime = 2;
    const hit = applyHit(e, stats('cannon', 'earth'), 'earth', never);
    expect(hit.combos).toContain('corrosion');
    expect(e.status.armorBreak).toBe(STATUS.armorBreak.perHit + COMBO_NUMBERS.corrosion.extraArmorBreak);
    expect(e.status.poisonStacks).toBe(2);
  });

  it('Rupture: Metal always crits once armor is fully broken', () => {
    const game = new Game(corridor);
    const e = enemy(game);
    e.status.armorBreak = STATUS.armorBreak.max;
    const hit = applyHit(e, stats('cannon', 'metal'), 'metal', never);
    expect(hit.crit).toBe(true);
    expect(hit.combos).toContain('rupture');
    const intact = enemy(game);
    expect(applyHit(intact, stats('cannon', 'metal'), 'metal', never).crit).toBe(false);
  });

  it('every element can start at least one combo', () => {
    for (const el of ['fire', 'water', 'wood', 'earth', 'metal'] as const) expect(combosFor(el).length, el).toBeGreaterThan(0);
  });
});

describe('Stats', () => {
  it('track kills and damage by source, without overkill', () => {
    const game = new Game(corridor, never);
    // One Sniper shot is more than a Grunt's HP; only the HP it had should count.
    const e = new Enemy(ENEMIES.grunt, game.path, 1, null);
    e.distance = 4;
    const p = game.path.pointAt(4);
    e.x = p.x;
    e.y = p.y;
    game.enemies.push(e);
    game.build(4, 3, { weapon: 'sniper', element: 'metal' });
    for (let i = 0; i < 60 * 15 && e.alive; i++) game.update(1 / 60);
    expect(game.stats.kills.towers).toBe(1);
    expect(game.stats.kills.byWeapon.sniper).toBe(1);
    expect(game.stats.damage.towers).toBeCloseTo(e.maxHp, 0);
  });
});
