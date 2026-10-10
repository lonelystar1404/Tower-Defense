import { describe, expect, it } from 'vitest';
import { ENEMIES, type EnemyId } from '../src/data/enemies';
import { HEROES, HERO_IDS, HERO_LEVELS, type HeroId } from '../src/data/hero';
import { LEVELS, type LevelDef } from '../src/data/levels';
import { Enemy } from '../src/entities/Enemy';
import type { Hero } from '../src/entities/Hero';
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
  // Every skill point spent (at level 10: everything at max rank).
  while (g.learnNext());
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
  it('fifteen heroes, each with a full profile, three basic abilities and an ultimate learned from Lv 6', () => {
    expect(HERO_IDS).toHaveLength(15);
    for (const id of HERO_IDS) {
      const h = HEROES[id];
      for (const field of [h.name, h.pronouns, h.race, h.origin, h.role, h.bio]) expect(field.length).toBeGreaterThan(0);
      expect(h.abilities.map((a) => a.unlockLevel)).toEqual([1, 1, 1, 6]);
    }
    expect(new Set(HERO_IDS.map((id) => HEROES[id].role)).size).toBe(15);
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

  it('levels up from nearby kills and gets one skill point per level', () => {
    const g = new Game(arena, () => 1, 'vex');
    const hero = g.hero!;
    expect(hero.skillPoints).toBe(1);
    expect(g.heroAbilityReady(0)).toBe(false); // nothing learned yet
    expect(g.learnSkill(0)).toBe(true);
    expect(hero.skillPoints).toBe(0);
    expect(g.learnSkill(1)).toBe(false); // no point left
    hero.kills = HERO_LEVELS.levelKills[0] - 1;
    const e = place(g, 'grunt', 6, 1);
    e.hp = 0.1;
    run(g, 0.5);
    expect(hero.level).toBe(2);
    expect(hero.skillPoints).toBe(1);
    expect([0, 1, 2, 3].filter((s) => hero.canLearn(s))).toEqual([1, 2]); // Z rank 2 needs Lv 3, V needs Lv 6
  });

  it('skill ranks: lower ranks are weaker and slower to recharge; rank 2 at Lv 3, rank 3 at Lv 5, the ultimate at Lv 6', () => {
    const hit = (rank: number) => {
      const g = new Game(arena, () => 1, 'vex');
      g.hero!.level = 10;
      for (let r = 0; r < rank; r++) g.learnSkill(0);
      const e = place(g, 'grunt', 6);
      freeze(e);
      g.castHero(0, e.x, e.y);
      return { dmg: e.maxHp - e.hp, cd: g.hero!.cooldowns[0] };
    };
    const [r1, r2, r3] = [hit(1), hit(2), hit(3)];
    expect(r1.dmg).toBeLessThan(r2.dmg);
    expect(r2.dmg).toBeLessThan(r3.dmg);
    expect(r1.cd).toBeGreaterThan(r2.cd);
    expect(r2.cd).toBeGreaterThan(r3.cd);
    const g = new Game(arena, () => 1, 'vex');
    const hero = g.hero!;
    hero.level = 2;
    g.learnSkill(0);
    expect(g.learnSkill(0)).toBe(false); // rank 2 needs Lv 3
    hero.level = 5;
    expect(g.learnSkill(3)).toBe(false); // ultimate needs Lv 6
    expect(g.learnSkill(0)).toBe(true);
    expect(g.learnSkill(0)).toBe(true);
    expect(g.learnSkill(0)).toBe(false); // max rank 3
    hero.level = 6;
    expect(g.learnSkill(3)).toBe(true);
    expect(g.learnSkill(3)).toBe(false); // the ultimate has one rank
    hero.level = 10;
    while (g.learnNext());
    expect(hero.ranks).toEqual([3, 3, 3, 1]);
    expect(hero.skillPoints).toBe(0);
  });

  it('skill choices travel as a command and survive a save; old saves get the default build', async () => {
    const { applyCommand, isCommand } = await import('../src/net/commands');
    expect(isCommand({ k: 'learn', s: 2 })).toBe(true);
    expect(isCommand({ k: 'learn', s: 4 })).toBe(false);
    const g = new Game(arena, () => 1, 'vex');
    g.hero!.level = 4;
    expect(applyCommand(g, 0, { k: 'learn', s: 2 })).toBe(true);
    g.learnSkill(2);
    g.wavesStarted = 1;
    const snap = JSON.parse(JSON.stringify(g.snapshot()));
    expect(Game.restore(arena, snap).hero!.ranks).toEqual([0, 0, 2, 0]);
    delete snap.hero.ranks;
    expect(Game.restore(arena, snap).hero!.skillPoints).toBe(0);
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
    const roster = (by: string | undefined) => HERO_IDS.filter((id) => HEROES[id].unlockedBy === by).map((id) => HEROES[id].element);
    for (const by of [undefined, 'core-nexus', 'overlink']) {
      expect(roster(by), String(by)).toHaveLength(5);
      expect(new Set(roster(by)).size, String(by)).toBe(5);
    }
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
    const second = HERO_IDS.filter((id) => HEROES[id].unlockedBy === 'core-nexus');
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

  it('Finisher (Ronin) hits wounded enemies harder, and never kills outright', () => {
    const p = HEROES.kaito.passive!.effect as { bonus: number };
    const hit = (fraction: number) => {
      const g = game('kaito', () => 1, 1);
      const e = place(g, 'runner', 6); // no armor, so the ratio is exact
      freeze(e);
      e.hp = e.maxHp * fraction;
      const before = e.hp;
      run(g, 0.05);
      return { dealt: before - e.hp, alive: e.alive };
    };
    const healthy = hit(0.9);
    const wounded = hit(0.25);
    expect(wounded.dealt / healthy.dealt).toBeCloseTo(1 + p.bonus, 1);
    expect(wounded.alive).toBe(true);
  });

  it('no hero skill kills regardless of HP: every effect kind deals a set amount of damage', () => {
    for (const id of HERO_IDS) {
      expect(HEROES[id].passive?.effect.kind, id).not.toBe('execute');
      for (const ab of HEROES[id].abilities) expect(ab.effect.kind, ab.id).not.toBe('execute');
    }
  });

  it('Undertow (Tide) slows enemies near her only', () => {
    const g = game('nalani', () => 1, 1);
    const hero = g.hero!;
    const near = place(g, 'grunt', hero.x - 0.5);
    const far = place(g, 'grunt', hero.x + 5);
    near.hp = far.hp = 1e9;
    g.update(STEP);
    expect(near.speed).toBeCloseTo(ENEMIES.grunt.speed * (1 - (HEROES.nalani.passive!.effect as { slow: number }).slow));
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

  it('Spotter Uplink (Vex): enemies near her take more damage, from anything', () => {
    const amp = (HEROES.vex.passive!.effect as { amp: number }).amp;
    const g = game('vex', () => 1, 1);
    const near = place(g, 'grunt', 6);
    const far = place(g, 'grunt', 12);
    freeze(near, far);
    g.update(STEP);
    expect(near.auraAmp).toBeCloseTo(amp);
    expect(far.auraAmp).toBe(0);
    const before = near.hp;
    near.takeDamage(100);
    expect(before - near.hp).toBeCloseTo(100 * (1 + amp));
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
    (g as unknown as { heroDamage(e: Enemy, d: number, h: Hero): void }).heroDamage(a, 50, g.hero!);
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

describe('Third roster (new mechanics)', () => {
  it('unlocks by clearing Overlink; each has a passive and five icons', async () => {
    const { isHeroUnlocked } = await import('../src/ui/progress');
    const { ABILITY_ICONS } = await import('../src/ui/HeroBar');
    const third = HERO_IDS.filter((id) => HEROES[id].unlockedBy === 'overlink');
    expect(third.sort()).toEqual(['baraka', 'killa', 'linh', 'oksana', 'pilar']);
    for (const id of third) {
      const def = HEROES[id];
      expect(def.passive?.description.length).toBeGreaterThan(0);
      expect(isHeroUnlocked(def, { cleared: ['core-nexus'] })).toBe(false);
      expect(isHeroUnlocked(def, { cleared: ['overlink'] })).toBe(true);
      for (const key of [`${id}-passive`, ...def.abilities.map((ab) => ab.id)]) expect(ABILITY_ICONS[key], key).toBeDefined();
    }
  });

  // Enemies at distance 10 sit at (9.5, 2.5): in cast range of a hero at (5.5, 3.5) but out of most attack ranges.
  it('Reprogram (Glitch) sends enemies backward; bosses only pause; Zero Day hits the whole map', () => {
    const g = game('linh');
    const grunt = place(g, 'grunt', 10);
    const boss = place(g, 'colossus', 10.3, 1);
    expect(g.castHero(0, grunt.x, grunt.y)).toBe(true);
    run(g, 1);
    expect(grunt.distance).toBeLessThan(10);
    expect(boss.distance).toBeGreaterThan(10.3);
    const far = place(g, 'runner', 1);
    const back = place(g, 'grunt', 12);
    expect(g.castHero(3, 0, 0)).toBe(true);
    run(g, 0.5);
    expect(far.distance).toBeLessThan(1);
    expect(back.distance).toBeLessThan(12);
    expect(hurt(far) && hurt(back)).toBe(true);
  });

  it('Denial of Service (Glitch) shuts off enemy abilities: no heals, ghosts exposed, Jammers silent', () => {
    const g = game('linh');
    const medic = place(g, 'medic', 10);
    const patient = place(g, 'grunt', 10.5);
    const ghost = place(g, 'ghost', 9.6);
    freeze(medic, patient, ghost);
    patient.hp = patient.maxHp / 2;
    run(g, 0.1);
    expect(ghost.hidden).toBe(true);
    expect(g.castHero(1, medic.x, medic.y)).toBe(true);
    run(g, 3);
    expect(patient.hp).toBe(patient.maxHp / 2);
    expect(ghost.hidden).toBe(false);
    // A Jammer next to her stops her cooldowns, until it's inside the zone.
    const g2 = game('linh');
    const jammer = place(g2, 'jammer', 6);
    freeze(jammer);
    run(g2, 0.1);
    expect(g2.hero!.jammed).toBe(true);
    g2.castHero(1, jammer.x, jammer.y);
    run(g2, 0.1);
    expect(g2.hero!.jammed).toBe(false);
  });

  it('Logic Bomb (Glitch): a marked enemy explodes when it dies; Backdoor: kills cut her cooldowns', () => {
    const g = game('linh');
    const bomb = place(g, 'grunt', 10);
    const bystander = place(g, 'grunt', 11.1);
    freeze(bomb, bystander);
    expect(g.castHero(2, bomb.x, bomb.y)).toBe(true);
    bomb.hp = 1;
    g.hero!.cooldowns[1] = 5;
    // Reprogram aimed so it reaches the bomb (1.3 away) but not the bystander (2.4 away).
    expect(g.castHero(0, bomb.x - 1.3, bomb.y)).toBe(true);
    expect(bomb.alive).toBe(false);
    expect(hurt(bystander)).toBe(true);
    expect(g.hero!.cooldowns[1]).toBeCloseTo(4.5);
  });

  it('Proximity Mines (Fuse) sit on the road and blow when a ground enemy walks over; Demolition Run wires the whole road', () => {
    const g = game('baraka');
    expect(g.castHero(0, 8.5, 3.2)).toBe(true);
    expect(g.mines).toHaveLength(3);
    for (const m of g.mines) expect(m.y).toBeCloseTo(2.5);
    const grunt = place(g, 'grunt', 6.5);
    run(g, 4);
    expect(g.mines.length).toBeLessThan(3);
    expect(hurt(grunt)).toBe(true);
    const g2 = game('baraka');
    expect(g2.castHero(3, 0, 0)).toBe(true);
    expect(g2.mines).toHaveLength(8);
    const xs = g2.mines.map((m) => m.x);
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
  });

  it('Sticky Bomb (Fuse) rides its enemy, then goes off; Carpet Bomb drops five staggered blasts; Scorched Earth burns', () => {
    const g = game('baraka');
    const runner = place(g, 'grunt', 9);
    expect(g.castHero(1, runner.x, runner.y)).toBe(true);
    run(g, 1);
    expect(g.strikes).toHaveLength(1);
    expect(g.strikes[0].x).toBeCloseTo(runner.x);
    expect(runner.distance).toBeGreaterThan(9);
    run(g, 0.6);
    expect(g.strikes).toHaveLength(0);
    expect(hurt(runner)).toBe(true);
    const g2 = game('baraka');
    expect(g2.castHero(2, 8.5, 2.5)).toBe(true);
    expect(g2.strikes).toHaveLength(5);
    const delays = g2.strikes.map((st) => st.delay);
    expect(delays).toEqual([...delays].sort((a, b) => a - b));
    // His kills leave a small burning patch.
    const g3 = game('baraka');
    const weak = place(g3, 'grunt', 6);
    freeze(weak);
    weak.hp = 1;
    run(g3, 1.5);
    expect(weak.alive).toBe(false);
    expect(g3.zones.some((z) => z.quiet && (z.dps ?? 0) > 0)).toBe(true);
  });

  it('Glacier Wall (Stasis) stops enemies; Flash Freeze stuns, then shatters; Brittle marks what she hits', () => {
    const g = game('oksana');
    const walker = place(g, 'grunt', 7.5);
    expect(g.castHero(0, 9.5, 2.5)).toBe(true);
    run(g, 1.2);
    expect(walker.speed).toBe(0);
    expect(walker.markTime).toBeGreaterThan(0); // Brittle: she's been hitting it
    const g2 = game('oksana');
    const target = place(g2, 'grunt', 10.5);
    expect(g2.castHero(1, target.x, target.y)).toBe(true);
    const afterFreeze = target.maxHp - target.hp;
    expect(target.status.stunTime).toBeGreaterThan(1);
    run(g2, 1.6);
    expect(target.maxHp - target.hp).toBeGreaterThan(afterFreeze * 3);
  });

  it('Time Dilation (Stasis) speeds up towers inside; Absolute Zero freezes the map and leaves enemies brittle', () => {
    const g = game('oksana');
    const tower = g.build(8, 1, { weapon: 'cannon', element: 'metal' })!;
    expect(g.towerRateMult(tower)).toBe(1);
    expect(g.castHero(2, tower.x, tower.y)).toBe(true);
    expect(g.towerRateMult(tower)).toBeCloseTo(1.4);
    const a = place(g, 'grunt', 2);
    const b = place(g, 'brute', 12);
    expect(g.castHero(3, 0, 0)).toBe(true);
    for (const e of [a, b]) {
      expect(e.status.stunTime).toBeGreaterThanOrEqual(2);
      expect(e.markAmp).toBeCloseTo(0.25);
      expect(e.markTime).toBeCloseTo(6);
    }
  });

  it('Strangler Vine (Canopy) holds the toughest enemy in reach and squeezes harder; bosses are not held', () => {
    const g = game('killa');
    const grunt = place(g, 'grunt', 10);
    const brute = place(g, 'brute', 9.8);
    expect(g.castHero(0, 0, 0)).toBe(true);
    run(g, 0.5);
    expect(g.tethers[0].target).toBe(brute);
    expect(brute.speed).toBe(0);
    const hp0 = brute.hp;
    run(g, 1);
    const first = hp0 - brute.hp;
    run(g, 2);
    const hp1 = brute.hp;
    run(g, 1);
    expect(hp1 - brute.hp).toBeGreaterThan(first * 1.3);
    expect(hurt(grunt)).toBe(false);
    const g2 = game('killa');
    const boss = place(g2, 'colossus', 10, 1);
    g2.castHero(0, 0, 0);
    run(g2, 0.5);
    expect(g2.tethers[0].target).toBe(boss);
    expect(boss.speed).toBeGreaterThan(0);
  });

  it('Seed Bomb (Canopy) leaves brambles; Great Bloom boosts every tower; Photosynthesis recharges faster standing still', () => {
    const g = game('killa');
    const e = place(g, 'grunt', 10);
    freeze(e);
    expect(g.castHero(1, e.x, e.y)).toBe(true);
    expect(g.zones).toHaveLength(1);
    const far = g.build(0, 0, { weapon: 'cannon', element: 'metal' })!;
    expect(g.castHero(3, 0, 0)).toBe(true);
    expect(far.boostTime).toBeGreaterThan(0);
    expect(g.towerDamageMult(far)).toBeCloseTo(1.25);
    const still = g.hero!.cooldowns[1];
    run(g, 1);
    expect(still - g.hero!.cooldowns[1]).toBeCloseTo(1.35, 1);
    g.moveHero(0.5, 5.5);
    const moving = g.hero!.cooldowns[1];
    run(g, 1);
    expect(moving - g.hero!.cooldowns[1]).toBeCloseTo(1, 1);
  });

  it('Heavy Footing (Atlas) strips armor nearby (never below 0); Fault Line stuns its line; Upheaval blocks the road', () => {
    const g = game('pilar');
    const brute = place(g, 'brute', 6);
    const grunt = place(g, 'grunt', 6.5);
    freeze(brute, grunt);
    run(g, 0.1);
    expect(brute.armor).toBe(ENEMIES.brute.armor - 3);
    expect(grunt.armor).toBe(0);
    const g2 = game('pilar');
    const inLine = place(g2, 'grunt', 9);
    expect(g2.castHero(0, 8.5, 2.5)).toBe(true);
    expect(inLine.status.stunTime).toBeCloseTo(0.5);
    const g3 = game('pilar');
    const victim = place(g3, 'grunt', 10);
    expect(g3.castHero(3, victim.x, victim.y)).toBe(true);
    expect(hurt(victim)).toBe(true);
    expect(g3.zones[0].slow).toBe(1);
    run(g3, 0.5);
    expect(victim.speed).toBe(0);
  });

  it('Continental Drift (Atlas) swaps the lead ground enemy with the last one; bosses stay put', () => {
    const g = game('pilar');
    const tail = place(g, 'grunt', 2);
    const middle = place(g, 'grunt', 6);
    const lead = place(g, 'grunt', 11);
    const boss = place(g, 'colossus', 12.5, 1);
    freeze(tail, middle, lead, boss);
    expect(g.castHero(1, 0, 0)).toBe(true);
    expect(lead.distance).toBe(2);
    expect(tail.distance).toBe(11);
    expect(middle.distance).toBe(6);
    expect(boss.distance).toBe(12.5);
  });

  it('mines and vines survive an exact restore (online resync between waves)', () => {
    const g = game('baraka');
    g.castHero(0, 8.5, 2.5);
    g.wavesStarted = 1;
    const back = Game.restore(arena, JSON.parse(JSON.stringify(g.snapshot())), () => 1, { exact: true });
    expect(back.mines).toHaveLength(3);
    expect(back.mines[0].owner).toBe(back.hero);
    const k = game('killa');
    k.castHero(0, 0, 0);
    k.wavesStarted = 1;
    const kb = Game.restore(arena, JSON.parse(JSON.stringify(k.snapshot())), () => 1, { exact: true });
    expect(kb.tethers).toHaveLength(1);
  });
});

describe('Ability sounds', () => {
  it('every ability has its own cast sound, strikes an impact sound, and casting queues it', async () => {
    const { HERO_SOUNDS } = await import('../src/audio/Sound');
    for (const id of HERO_IDS) {
      for (const ab of HEROES[id].abilities) {
        expect(HERO_SOUNDS[`ability:${ab.id}`], ab.id).toBeDefined();
        if (ab.effect.kind === 'strike') expect(HERO_SOUNDS[`impact:${ab.id}`], ab.id).toBeDefined();
      }
    }
    const g = game('vex');
    g.drainSounds();
    g.castHero(0, g.hero!.x + 1, g.hero!.y);
    expect(g.drainSounds()).toContain('ability:vex-pulse');
  });
});
