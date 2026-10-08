import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { HEROES, HERO_IDS, type HeroId } from '../src/data/hero';
import { LEVELS, type LevelDef } from '../src/data/levels';
import { PARTY } from '../src/data/party';
import { Enemy } from '../src/entities/Enemy';
import { dailyChallenge } from '../src/game/daily';
import { Game } from '../src/game/Game';
import { isMemberId, newMemberId } from '../src/platform/member';
import { playParty } from './partyBot';

const STEP = 1 / 60;

/** A straight corridor along row 2 with a hero start, lockdown and battlefields off. */
const corridor: LevelDef = {
  id: 'test', name: 'Test', description: '', cols: 12, rows: 5,
  path: [[-1, 2], [11, 2]], startGold: 500, lives: 20, lockFraction: 0, battlefieldBonus: 0,
  heroStart: [5, 3], multiplayer: true,
  waves: [
    { groups: [{ enemy: 'grunt', count: 1, interval: 1 }], bonus: 10 },
    { groups: [{ enemy: 'grunt', count: 1, interval: 1 }], bonus: 10 },
  ],
};

const party = (heroes: HeroId[]) => new Game(corridor, () => 0.5, heroes[0], { party: { heroes } });

describe('MemberId', () => {
  it('is NW- and three groups of four easy-to-read characters', () => {
    for (let i = 0; i < 50; i++) expect(isMemberId(newMemberId())).toBe(true);
    expect(newMemberId(() => new Uint32Array(12))).toBe('NW-2222-2222-2222');
    expect(isMemberId('NW-0OIL-2222-2222')).toBe(false);
  });

  it('is different every time', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newMemberId()));
    expect(ids.size).toBe(500);
  });
});

describe('Party (multiplayer)', () => {
  it('has one player per hero, each with the start gold, heroes spread around the start', () => {
    const g = party(['vex', 'mateo', 'leila']);
    expect(g.players.map((p) => p.hero?.def.id)).toEqual(['vex', 'mateo', 'leila']);
    expect(g.players.map((p) => p.gold)).toEqual([500, 500, 500]);
    expect(g.heroes.map((h) => h.player)).toEqual([0, 1, 2]);
    expect(new Set(g.heroes.map((h) => `${h.x},${h.y}`)).size).toBe(3);
    expect(g.hero).toBe(g.players[0].hero);
  });

  it('caps the party at five players', () => {
    expect(party(['vex', 'mateo', 'leila', 'arjun', 'echo', 'kaito']).players).toHaveLength(PARTY.maxPlayers);
  });

  it('builds with the builder’s gold; only the owner can upgrade or sell, and the refund is theirs', () => {
    const g = party(['vex', 'mateo']);
    const t = g.build(3, 1, { weapon: 'cannon', element: 'metal' }, 1)!;
    expect(t.owner).toBe(1);
    expect(g.players[1].gold).toBe(450);
    expect(g.players[0].gold).toBe(500);
    expect(g.upgrade(t, 0)).toBe(false);
    expect(g.sell(t, 0)).toBe(0);
    expect(g.upgrade(t, 1)).toBe(true);
    const before = g.players[1].gold;
    expect(g.sell(t, 1)).toBeGreaterThan(0);
    expect(g.players[1].gold).toBeGreaterThan(before);
    expect(g.players[0].gold).toBe(500);
  });

  it('pays kill gold to the killer and the wave bonus to everyone', () => {
    const g = party(['vex', 'mateo']);
    for (const h of g.heroes) h.x = h.targetX = 50; // out of the way
    g.build(3, 1, { weapon: 'cannon', element: 'metal' }, 1);
    g.startWave();
    for (let i = 0; i < 60 * 30 && g.phase === 'wave'; i++) g.update(STEP);
    expect(g.lives).toBe(20);
    expect(g.players[0].gold).toBe(500 + 10);
    expect(g.players[1].gold).toBe(450 + ENEMIES.grunt.reward + 10);
  });

  it('pays burn and poison kills to the player who last hit the enemy', () => {
    const g = party(['vex', 'mateo']);
    const e = new Enemy(ENEMIES.grunt, g.path);
    e.distance = 3;
    e.hp = 0.01;
    e.lastHitBy = 1;
    e.status.burnTime = 2;
    e.status.burnDps = 5;
    g.startWave();
    g.enemies.push(e);
    g.update(STEP);
    expect(e.alive).toBe(false);
    expect(g.players[1].gold).toBe(500 + ENEMIES.grunt.reward);
    expect(g.players[0].gold).toBe(500);
  });

  it('moves and casts for the right player', () => {
    const g = party(['vex', 'mateo']);
    g.moveHero(9, 1, 1);
    expect(g.players[1].hero!.targetX).toBe(9);
    expect(g.players[0].hero!.targetX).not.toBe(9);
    expect(g.castHero(0, 0, 0, 1)).toBe(true); // Brick's Ground Slam (self)
    expect(g.players[1].hero!.cooldowns[0]).toBeGreaterThan(0);
    expect(g.players[0].hero!.cooldowns[0]).toBe(0);
  });

  it('gives every hero +10% damage when the party covers all five elements, and only then', () => {
    const five: HeroId[] = ['nalani', 'zeynep', 'leila', 'rua', 'ines']; // Water, Fire, Metal, Wood, Earth
    expect(new Set(five.map((id) => HEROES[id].element)).size).toBe(5);
    const full = party(five);
    expect(full.fullElementParty).toBe(true);
    for (const h of full.heroes) expect(h.damageMult).toBeCloseTo(1 + PARTY.fullElementsAttack);
    const four = party(['nalani', 'zeynep', 'leila', 'rua', 'vex']); // two Water heroes
    expect(four.fullElementParty).toBe(false);
    for (const h of four.heroes) expect(h.damageMult).toBe(1);
  });

  it('survives save and resume with every player’s gold, hero, and towers', () => {
    const g = party(['vex', 'mateo']);
    g.build(3, 1, { weapon: 'cannon', element: 'metal' }, 1);
    g.startWave();
    for (let i = 0; i < 60 * 30 && g.phase === 'wave'; i++) g.update(STEP);
    g.players[1].hero!.level = 4;
    const snap = JSON.parse(JSON.stringify(g.snapshot()));
    const back = Game.restore(corridor, snap);
    expect(back.players.map((p) => p.gold)).toEqual(g.players.map((p) => p.gold));
    expect(back.players.map((p) => p.hero?.def.id)).toEqual(['vex', 'mateo']);
    expect(back.players[1].hero!.level).toBe(4);
    expect(back.towers[0].owner).toBe(1);
  });

  it('a Surger speeds up the enemies around it, not itself', () => {
    const g = new Game({ ...corridor, multiplayer: false }, () => 0.5);
    const surger = new Enemy(ENEMIES.surger, g.path);
    const near = new Enemy(ENEMIES.grunt, g.path);
    const far = new Enemy(ENEMIES.grunt, g.path);
    surger.distance = 4;
    near.distance = 5;
    far.distance = 9;
    for (const e of [surger, near, far]) {
      const p = e.route.pointAt(e.distance);
      e.x = p.x;
      e.y = p.y;
      g.enemies.push(e);
    }
    g.update(STEP);
    expect(near.speed).toBeCloseTo(ENEMIES.grunt.speed * 1.35);
    expect(far.speed).toBeCloseTo(ENEMIES.grunt.speed);
    expect(surger.speed).toBeCloseTo(ENEMIES.surger.speed);
  });
});

describe('Map 8: Overlink', () => {
  const overlink = LEVELS.find((l) => l.id === 'overlink')!;

  it('is the eighth map, a multiplayer hero map, and never the Daily Challenge', () => {
    expect(LEVELS.indexOf(overlink)).toBe(7);
    expect(overlink.multiplayer).toBe(true);
    expect(overlink.heroStart).toBeDefined();
    expect(LEVELS.filter((l) => l.multiplayer).map((l) => l.id)).toEqual(['overlink']);
    for (let day = 0; day < 200; day++) {
      const date = new Date(Date.UTC(2026, 0, 1) + day * 86_400_000);
      expect(dailyChallenge(date).level.multiplayer, date.toISOString()).toBeFalsy();
    }
  });

  it('one hero alone cannot hold it, whichever hero', { timeout: 600_000 }, () => {
    for (const hero of HERO_IDS) {
      const g = playParty(overlink, 1, [hero]);
      expect(g.phase, `${hero} alone`).toBe('lost');
    }
  });

  it('a party of two can win it, whichever pair', { timeout: 900_000 }, () => {
    // Each hero paired with the next, so every hero is tested in two pairs.
    for (let i = 0; i < HERO_IDS.length; i++) {
      const pair: HeroId[] = [HERO_IDS[i], HERO_IDS[(i + 1) % HERO_IDS.length]];
      const g = playParty(overlink, 1, pair);
      expect(g.phase, `${pair.join('+')}: fell on wave ${g.wavesStarted}`).toBe('won');
    }
  });

  it('a full five-element party wins comfortably', { timeout: 300_000 }, () => {
    const g = playParty(overlink, 1, ['nalani', 'zeynep', 'leila', 'rua', 'ines']);
    expect(g.phase).toBe('won');
    expect(g.lives).toBeGreaterThanOrEqual(15);
  });
});
