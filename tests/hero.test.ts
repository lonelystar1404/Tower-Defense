import { describe, expect, it } from 'vitest';
import { ENEMIES, type EnemyId } from '../src/data/enemies';
import { HEROES, HERO_IDS, HERO_LEVELS, type HeroId } from '../src/data/hero';
import { LEVELS, type LevelDef } from '../src/data/levels';
import { Enemy } from '../src/entities/Enemy';
import { Game } from '../src/game/Game';

const STEP = 1 / 60;

/** Straight corridor along row 2 with a hero at (5, 3); lockdown and battlefields off. */
const arena: LevelDef = {
  id: 'hero-test', name: 'Hero test', description: '', cols: 14, rows: 6,
  path: [[-1, 2], [13, 2]], startGold: 5000, lives: 20, lockFraction: 0, battlefieldBonus: 0,
  heroStart: [5, 3],
  waves: [{ groups: [{ enemy: 'grunt', count: 1, interval: 1 }], bonus: 0 }],
};

function game(hero: HeroId = 'vex', rng: () => number = () => 1, level = 10): Game {
  const g = new Game(arena, rng, hero);
  g.hero!.level = level;
  return g;
}

function place(g: Game, id: EnemyId, distance: number, hpMult = 50): Enemy {
  const e = new Enemy(ENEMIES[id], g.path, hpMult);
  e.distance = distance;
  const p = g.path.pointAt(distance);
  e.x = p.x;
  e.y = p.y;
  g.enemies.push(e);
  return e;
}

/** Keeps enemies still so positions in tests stay put. */
function freeze(...enemies: Enemy[]): void {
  for (const e of enemies) e.status.stunTime = 99;
}

function run(g: Game, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) g.update(STEP);
}

const hurt = (e: Enemy) => e.hp < e.maxHp;

describe('Heroes', () => {
  it('ten heroes, each with a full profile and four abilities unlocking at 1, 3, 5, 8', () => {
    expect(HERO_IDS).toHaveLength(10);
    for (const id of HERO_IDS) {
      const h = HEROES[id];
      for (const field of [h.name, h.pronouns, h.race, h.origin, h.role, h.bio]) expect(field.length).toBeGreaterThan(0);
      expect(h.abilities.map((a) => a.unlockLevel)).toEqual([1, 3, 5, 8]);
    }
    expect(new Set(HERO_IDS.map((id) => HEROES[id].role)).size).toBe(10);
  });

  it('the chosen hero is the one on the map; maps without heroStart have none', () => {
    expect(new Game(LEVELS[0]).hero).toBeNull();
    expect(new Game(arena, Math.random, 'leila').hero!.def.id).toBe('leila');
  });

  it('walks to where it is told at its own speed, staying on the map', () => {
    const g = game('mateo');
    const hero = g.hero!;
    g.moveHero(hero.x + 4, hero.y);
    run(g, 0.5);
    expect(hero.x).toBeCloseTo(5.5 + HEROES.mateo.speed * 0.5, 1);
    g.moveHero(-50, 99);
    run(g, 10);
    expect(hero.x).toBeGreaterThan(0);
    expect(hero.y).toBeLessThan(arena.rows);
  });

  it('attacks on its own, never Mirrors', () => {
    const g = game('vex');
    const grunt = place(g, 'grunt', 6);
    const mirror = place(g, 'mirror', 6.5);
    run(g, 1);
    expect(hurt(grunt)).toBe(true);
    expect(hurt(mirror)).toBe(false);
  });

  it('melee (Brick) cleaves enemies next to its target; magic (Arjun) jumps between enemies', () => {
    const brick = game('mateo');
    const a = place(brick, 'grunt', 6.1);
    const b = place(brick, 'grunt', 6.6);
    freeze(a, b);
    run(brick, 1);
    expect(hurt(a) && hurt(b)).toBe(true);

    const arjun = game('arjun');
    const c = place(arjun, 'grunt', 6);
    const d = place(arjun, 'grunt', 7.4);
    freeze(c, d);
    run(arjun, 0.9);
    expect(hurt(c) && hurt(d)).toBe(true);
  });

  it('counts nearby kills toward its level and unlocks abilities', () => {
    const g = game('vex', () => 1, 2);
    const hero = g.hero!;
    hero.kills = HERO_LEVELS.levelKills[1] - 1;
    expect(g.heroAbilityReady(1)).toBe(false);
    const e = place(g, 'grunt', 6, 1);
    e.hp = 0.1;
    run(g, 0.5);
    expect(hero.level).toBe(3);
    expect(g.heroAbilityReady(1)).toBe(true);
  });

  it('cooldowns stop while a Jammer is near; effect countdowns keep running', () => {
    const g = game('vex');
    const hero = g.hero!;
    g.castHero(2, 3, 2.5);
    hero.cooldowns[0] = 5;
    const jammer = place(g, 'jammer', 6);
    freeze(jammer);
    run(g, 1);
    expect(hero.jammed).toBe(true);
    expect(hero.cooldowns[0]).toBe(5);
    expect(hero.effects[2]).toBeLessThan(hero.effectLengths[2]);
  });
});

describe('Hero elements', () => {
  it('each roster of five covers every element once', () => {
    const first = HERO_IDS.filter((id) => !HEROES[id].unlockedBy).map((id) => HEROES[id].element);
    const second = HERO_IDS.filter((id) => HEROES[id].unlockedBy).map((id) => HEROES[id].element);
    expect(new Set(first).size).toBe(5);
    expect(new Set(second).size).toBe(5);
    expect(HEROES.vex.element).toBe('water');
    expect(HEROES.mateo.element).toBe('earth');
    expect(HEROES.leila.element).toBe('metal');
    expect(HEROES.arjun.element).toBe('fire');
    expect(HEROES.echo.element).toBe('wood');
  });

  it('hero hits follow the weakness cycle: +50% vs the element it overcomes, −25% vs the one that overcomes it', () => {
    // Vex is Water: strong vs Fire, resisted by Earth. Runners have no armor so damage is exact.
    const dealt = (element: 'fire' | 'earth' | null) => {
      const g = game('vex', () => 1, 1);
      const e = new Enemy(ENEMIES.runner, g.path, 50, element);
      e.distance = 5.5;
      Object.assign(e, g.path.pointAt(5.5));
      g.enemies.push(e);
      g.castHero(0, e.x, e.y);
      return e.maxHp - e.hp;
    };
    const neutral = dealt(null);
    expect(dealt('fire')).toBeCloseTo(neutral * 1.5);
    expect(dealt('earth')).toBeCloseTo(neutral * 0.75);
  });
});

describe('Vex (Tactician)', () => {
  it('Pulse Blast hits its area; refused out of range; then on cooldown', () => {
    const g = game('vex');
    const a = place(g, 'brute', 5.5);
    const b = place(g, 'brute', 10);
    expect(g.castHero(0, 20, 2.5)).toBe(false);
    expect(g.castHero(0, a.x, a.y)).toBe(true);
    expect(hurt(a)).toBe(true);
    expect(hurt(b)).toBe(false);
    expect(g.castHero(0, a.x, a.y)).toBe(false);
  });

  it('EMP stuns and strips shields around her, but not Mirrors', () => {
    const g = game('vex');
    const s = place(g, 'shielder', 6);
    const m = place(g, 'mirror', 5.5);
    expect(g.castHero(1)).toBe(true);
    expect(s.shield).toBe(0);
    expect(s.status.stunTime).toBeGreaterThan(1);
    expect(m.status.stunTime).toBe(0);
  });

  it('Cryo Field slows; Orbital Strike lands after its delay', () => {
    const g = game('vex');
    const a = place(g, 'grunt', 3);
    g.castHero(2, a.x, a.y);
    g.update(STEP);
    expect(a.speed).toBeCloseTo(ENEMIES.grunt.speed * 0.5);
    const b = place(g, 'brute', 10);
    freeze(b);
    g.castHero(3, b.x, b.y);
    run(g, 0.8);
    expect(hurt(b)).toBe(false);
    run(g, 0.4);
    expect(hurt(b)).toBe(true);
  });
});

describe('Brick (Melee)', () => {
  it('Rocket Leap moves him to the spot and damages enemies there', () => {
    const g = game('mateo');
    const e = place(g, 'brute', 8.5);
    freeze(e);
    expect(g.castHero(1, e.x, e.y)).toBe(true);
    expect(g.hero!.x).toBeCloseTo(e.x);
    expect(hurt(e)).toBe(true);
  });

  it('Overdrive speeds up his attacks while it lasts', () => {
    const g = game('mateo');
    const e = place(g, 'brute', 6);
    freeze(e);
    g.castHero(2);
    run(g, 0.05);
    const eff = HEROES.mateo.abilities[2].effect as { attackSpeed: number };
    expect(g.hero!.attackCooldown).toBeCloseTo(1 / (HEROES.mateo.attack.fireRate * eff.attackSpeed), 1);
  });
});

describe('Leila (Ranged)', () => {
  it('Piercing Round hits everything in its line, nothing beside it', () => {
    const g = game('leila');
    const inLine = [place(g, 'brute', 8), place(g, 'brute', 11)];
    const g2 = new Enemy(ENEMIES.brute, g.path, 50);
    g2.x = 9;
    g2.y = 5.5;
    g.enemies.push(g2);
    freeze(...inLine, g2);
    // Stand on the road so the shot runs along it
    const hero = g.hero!;
    hero.x = hero.targetX = 3.5;
    hero.y = hero.targetY = 2.5;
    expect(g.castHero(0, inLine[0].x, inLine[0].y)).toBe(true);
    for (const e of inLine) expect(hurt(e)).toBe(true);
    expect(hurt(g2)).toBe(false);
  });

  it('Mark Target makes enemies take more damage from everything', () => {
    const g = game('leila');
    const marked = place(g, 'grunt', 6);
    g.castHero(1, marked.x, marked.y);
    const plain = new Enemy(ENEMIES.grunt, g.path, 50);
    marked.takeDamage(100);
    plain.takeDamage(100);
    expect(marked.maxHp - marked.hp).toBeCloseTo((plain.maxHp - plain.hp) * 1.35);
  });

  it('Headhunter hits the toughest enemies anywhere on the map', () => {
    const g = game('leila');
    const weak = place(g, 'grunt', 1, 1);
    const tough = place(g, 'brute', 12, 50);
    freeze(weak, tough);
    for (let i = 0; i < 6; i++) freeze(place(g, 'brute', 0.5 + i * 0.1, 40));
    g.castHero(3);
    expect(hurt(tough)).toBe(true);
    expect(hurt(weak)).toBe(false);
  });
});

describe('Arjun (Mage)', () => {
  it('Firewall burns enemies inside it over time', () => {
    const g = game('arjun');
    const e = place(g, 'brute', 4);
    freeze(e);
    g.castHero(0, e.x, e.y);
    run(g, 1);
    expect(e.maxHp - e.hp).toBeGreaterThan(20);
  });

  it('Gravity Well throws enemies back along the road', () => {
    const g = game('arjun');
    const e = place(g, 'brute', 8);
    freeze(e);
    g.castHero(1, e.x, e.y);
    expect(e.distance).toBeCloseTo(5);
  });

  it('Chain Storm jumps through a line of enemies; Time Lock stops everything', () => {
    const g = game('arjun');
    const line = [5, 6.5, 8, 9.5].map((d) => place(g, 'brute', d));
    freeze(...line);
    g.castHero(2, line[0].x, line[0].y);
    for (const e of line) expect(hurt(e)).toBe(true);
    const far = place(g, 'grunt', 1, 50);
    const mirror = place(g, 'mirror', 2, 50);
    g.castHero(3);
    expect(far.status.stunTime).toBeGreaterThan(2);
    expect(mirror.status.stunTime).toBe(0);
  });
});

describe('Echo (Summoner)', () => {
  it('Deploy Drone places a drone that shoots on its own until it expires', () => {
    const g = game('echo');
    g.moveHero(0.5, 5.5);
    run(g, 3);
    const e = place(g, 'brute', 9);
    freeze(e);
    expect(g.castHero(0, 9, 3.5)).toBe(false); // too far from Echo now
    g.moveHero(8.5, 4.5);
    run(g, 3);
    expect(g.castHero(0, 9.5, 3.5)).toBe(true);
    expect(g.summons).toHaveLength(1);
    const before = e.hp;
    run(g, 1);
    expect(e.hp).toBeLessThan(before);
    run(g, 12);
    expect(g.summons).toHaveLength(0);
  });

  it('Overclock Towers makes nearby towers fire faster; Nanite Cloud strips armor; Drone Swarm places four', () => {
    const g = game('echo');
    const tower = g.build(6, 3, { weapon: 'cannon', element: 'metal' })!;
    g.castHero(1, tower.x, tower.y);
    expect(tower.boostTime).toBeGreaterThan(0);
    const e = place(g, 'brute', 5);
    freeze(e);
    g.castHero(2, e.x, e.y);
    g.update(STEP);
    expect(e.status.armorBreak).toBeGreaterThanOrEqual(4);
    g.castHero(3, e.x, e.y);
    expect(g.summons.length).toBeGreaterThanOrEqual(4);
  });
});

describe('Second roster (passives)', () => {
  it('unlocks by clearing Core Nexus; each has a passive and four icons', async () => {
    const { isHeroUnlocked } = await import('../src/ui/progress');
    const second = HERO_IDS.filter((id) => HEROES[id].unlockedBy);
    expect(second.sort()).toEqual(['ines', 'kaito', 'nalani', 'rua', 'zeynep']);
    for (const id of second) {
      const def = HEROES[id];
      expect(def.unlockedBy).toBe('core-nexus');
      expect(def.passive?.description.length).toBeGreaterThan(0);
      expect(isHeroUnlocked(def, { cleared: [] })).toBe(false);
      expect(isHeroUnlocked(def, { cleared: ['core-nexus'] })).toBe(true);
    }
    expect(isHeroUnlocked(HEROES.vex, { cleared: [] })).toBe(true);
  });

  it('Execution (Ronin) finishes a weakened enemy, but not a boss', () => {
    // Distance 6 on the corridor puts an enemy one tile from the hero.
    const g = game('kaito', () => 1, 1);
    const e = place(g, 'brute', 6);
    freeze(e);
    e.hp = e.maxHp * 0.12 + 5;
    run(g, 1.5);
    expect(e.alive).toBe(false);
    const g2 = game('kaito', () => 1, 1);
    const boss = place(g2, 'colossus', 6, 1);
    freeze(boss);
    boss.phase = 2;
    boss.hp = boss.maxHp * 0.1;
    run(g2, 1);
    expect(boss.alive).toBe(true);
  });

  it('Undertow (Tide) slows enemies near her only', () => {
    const g = game('nalani', () => 1, 1);
    const hero = g.hero!;
    const near = place(g, 'grunt', hero.x - 0.5);
    const far = place(g, 'grunt', hero.x + 5);
    near.hp = far.hp = 1e9;
    g.update(STEP);
    expect(near.speed).toBeCloseTo(ENEMIES.grunt.speed * 0.75);
    expect(far.speed).toBeCloseTo(ENEMIES.grunt.speed);
  });

  it('Field Engineer (Forge) boosts nearby towers; Power Surge stacks on top; Core Patch restores lives', () => {
    const g = game('ines');
    const near = g.build(5, 4, { weapon: 'cannon', element: 'metal' })!;
    const far = g.build(12, 4, { weapon: 'cannon', element: 'metal' })!;
    expect(g.towerDamageMult(near)).toBeCloseTo(1.2);
    expect(g.towerDamageMult(far)).toBe(1);
    g.castHero(1, near.x, near.y);
    expect(g.towerDamageMult(near)).toBeCloseTo(1.2 * 1.4);
    g.lives = 10;
    g.castHero(3);
    expect(g.lives).toBe(14);
    g.hero!.cooldowns[3] = 0;
    g.lives = 19;
    g.castHero(3);
    expect(g.lives).toBe(20);
  });

  it('Overgrowth (Rua) roots and poisons what he hits; other heroes apply no effects', () => {
    const hit = (id: HeroId) => {
      const g = game(id, () => 1, 1);
      const e = place(g, 'grunt', 6);
      freeze(e);
      run(g, 1);
      return e.status;
    };
    expect(hit('rua').poisonStacks).toBeGreaterThan(0);
    expect(hit('echo').poisonStacks).toBe(0);
  });

  it('Bounty (Flare) pays extra for kills near her', () => {
    const gold = (id: HeroId) => {
      const g = game(id, () => 1, 1);
      const e = place(g, 'brute', 4, 1);
      freeze(e);
      e.x = g.hero!.x + 0.5;
      e.y = g.hero!.y;
      e.hp = 1;
      const before = g.gold;
      run(g, 1);
      expect(e.alive).toBe(false);
      return g.gold - before;
    };
    expect(gold('zeynep')).toBe(ENEMIES.brute.reward + Math.round(ENEMIES.brute.reward * 0.3));
    expect(gold('vex')).toBe(ENEMIES.brute.reward);
  });
});

describe('First roster passives', () => {
  it('every hero has a passive with an icon', async () => {
    const { ABILITY_ICONS } = await import('../src/ui/HeroBar');
    for (const id of HERO_IDS) {
      expect(HEROES[id].passive, id).toBeDefined();
      expect(ABILITY_ICONS[`${id}-passive`], id).toBeDefined();
    }
  });

  it('Spotter Uplink (Vex): enemies near her take 12% more damage, from anything', () => {
    const g = game('vex', () => 1, 1);
    const near = place(g, 'grunt', 6);
    const far = place(g, 'grunt', 12);
    freeze(near, far);
    g.update(STEP);
    expect(near.auraAmp).toBeCloseTo(0.12);
    expect(far.auraAmp).toBe(0);
    const before = near.hp;
    near.takeDamage(100);
    expect(before - near.hp).toBeCloseTo(112);
  });

  it('Aftershock (Brick): every third punch stuns what it hits', () => {
    const g = game('mateo', () => 1, 1);
    const e = place(g, 'brute', 6);
    freeze(e);
    e.status.stunTime = 0;
    e.status.rootTime = 99; // hold it still without a stun
    const stunnedAfter: number[] = [];
    for (let i = 0; i < 60 * 4 && g.hero!.attacks < 3; i++) {
      g.update(STEP);
      if (e.status.stunTime > 0 && stunnedAfter.length === 0) stunnedAfter.push(g.hero!.attacks);
    }
    expect(stunnedAfter).toEqual([3]);
  });

  it('Headshot (Leila): crits deal 3× instead of 2×', () => {
    const hit = (id: HeroId, rng: () => number) => {
      const g = game(id, rng, 1);
      const e = place(g, 'grunt', 6);
      freeze(e);
      const before = e.hp;
      run(g, 0.05);
      return before - e.hp;
    };
    // rng 0 crits; compare against the same hit without a crit.
    const normal = hit('leila', () => 0.99);
    const crit = hit('leila', () => 0);
    expect(crit / normal).toBeGreaterThan(2.6);
  });

  it("Combustion (Arjun): his kills explode, but explosion kills don't chain", () => {
    const g = game('arjun', () => 1, 1);
    const a = place(g, 'grunt', 6, 1);
    const b = place(g, 'grunt', 6.5, 1);
    const c = place(g, 'grunt', 7.3, 1);
    freeze(a, b, c);
    a.hp = 1;
    b.hp = 5;
    c.hp = c.maxHp;
    // Kill a directly with a hit
    (g as unknown as { heroDamage(e: Enemy, d: number): void }).heroDamage(a, 50);
    expect(a.alive).toBe(false);
    expect(b.alive).toBe(false); // caught in a's explosion
    expect(c.hp).toBe(c.maxHp); // b's death didn't explode again
  });

  it('Auto-Loader (Echo): towers near Echo fire 15% faster', () => {
    const g = game('echo');
    const near = g.build(5, 4, { weapon: 'cannon', element: 'metal' })!;
    const far = g.build(12, 4, { weapon: 'cannon', element: 'metal' })!;
    expect(g.towerRateMult(near)).toBeCloseTo(1.15);
    expect(g.towerRateMult(far)).toBe(1);
  });
});
