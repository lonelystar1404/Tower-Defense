import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../src/data/enemies';
import { HEROES, HERO_IDS, type HeroId } from '../src/data/hero';
import { LEVELS, type LevelDef } from '../src/data/levels';
import { LOAN, PARTY } from '../src/data/party';
import { Enemy } from '../src/entities/Enemy';
import { dailyChallenge } from '../src/game/daily';
import { Game, loanOwed } from '../src/game/Game';
import { applyCommand, isCommand } from '../src/net/commands';
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
    expect(g.learnSkill(0, 1)).toBe(true); // each hero spends its own skill points
    expect(g.players[0].hero!.ranks[0]).toBe(0);
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

describe('Loans between players', () => {
  /** Waves that last a minute (one grunt that spawns late), so repayment has time to run. */
  const slow: LevelDef = {
    ...corridor,
    waves: [0, 1, 2].map(() => ({ groups: [{ enemy: 'grunt' as const, count: 1, interval: 1, delay: 60 }], bonus: 0 })),
  };
  const loanParty = () => new Game(slow, () => 0.5, 'vex', { party: { heroes: ['vex', 'mateo', 'leila'] } });
  const run = (g: Game, seconds: number) => {
    for (let i = 0; i < seconds * 60 && !g.over; i++) g.update(STEP);
  };

  it('owe the amount plus 10%, rounded up', () => {
    expect(LOAN.interestPercent).toBe(10);
    expect(loanOwed(50)).toBe(55);
    expect(loanOwed(25)).toBe(28);
    expect(loanOwed(30)).toBe(33);
  });

  it('move gold only when the lender says yes, and only between waves', () => {
    const g = loanParty();
    expect(g.requestLoan(0, 1, 100)).toBe(true);
    expect(g.loanRequests).toEqual([{ borrower: 0, lender: 1, amount: 100 }]);
    expect(g.players[0].gold).toBe(500);
    expect(g.answerLoan(2, 0, true)).toBe(false); // not asked
    expect(g.answerLoan(1, 0, true)).toBe(true);
    expect(g.players.map((p) => p.gold)).toEqual([600, 400, 500]);
    expect(g.debtOf(0)).toBe(110);
    expect(g.loanRequests).toEqual([]);
    expect(g.drainNotices().map((n) => n.kind)).toEqual(['loan-asked', 'loan-lent']);

    g.requestLoan(2, 1, 50);
    g.startWave();
    expect(g.loanRequests).toEqual([]); // lapsed
    expect(g.borrowingOpen).toBe(false);
    expect(g.requestLoan(2, 0, 50)).toBe(false);
  });

  it('can be declined, withdrawn, and need the gold on hand', () => {
    const g = loanParty();
    g.requestLoan(0, 1, 50);
    expect(g.answerLoan(1, 0, false)).toBe(true);
    expect(g.players[0].gold).toBe(500);
    expect(g.drainNotices().at(-1)?.kind).toBe('loan-declined');
    g.requestLoan(0, 1, 50);
    expect(g.requestLoan(0, 1, 0)).toBe(true);
    expect(g.loanRequests).toEqual([]);
    g.requestLoan(2, 1, 1000);
    expect(g.answerLoan(1, 2, true)).toBe(false); // lender has 500
    expect(g.requestLoan(0, 0, 50)).toBe(false);
    expect(g.requestLoan(0, 1, 1001)).toBe(false);
    expect(new Game(corridor, () => 0.5).requestLoan(0, 0, 50)).toBe(false); // single-player
  });

  it('are repaid automatically during the next wave, an installment a second, with a message when paid in full', () => {
    const g = loanParty();
    g.requestLoan(0, 1, 200);
    g.answerLoan(1, 0, true);
    g.drainNotices();
    run(g, 5);
    expect(g.debtOf(0)).toBe(220); // nothing taken between waves
    g.startWave();
    run(g, 1.01);
    const step = Math.ceil(220 / LOAN.repaySeconds);
    expect(g.debtOf(0)).toBe(220 - step);
    expect(g.players[1].gold).toBe(300 + step);
    run(g, LOAN.repaySeconds);
    expect(g.debtOf(0)).toBe(0);
    expect(g.loans).toEqual([]);
    expect(g.players[0].gold).toBe(700 - 220);
    expect(g.players[1].gold).toBe(300 + 220);
    expect(g.drainNotices()).toEqual([{ kind: 'loan-repaid', borrower: 0, lender: 1, amount: 220 }]);
  });

  it('take only what the borrower has; the rest carries into later waves', () => {
    const g = loanParty();
    g.requestLoan(0, 1, 100);
    g.answerLoan(1, 0, true);
    g.players[0].gold = 20;
    g.startWave();
    run(g, 30);
    expect(g.players[0].gold).toBe(0);
    expect(g.debtOf(0)).toBe(110 - 20);
    g.players[0].gold = 500;
    run(g, 30);
    expect(g.debtOf(0)).toBe(0);
  });

  it('travel as commands and survive a save', () => {
    expect(isCommand({ k: 'loan', to: 1, a: 50 })).toBe(true);
    expect(isCommand({ k: 'loan', to: 1, a: LOAN.maxAmount + 1 })).toBe(false);
    expect(isCommand({ k: 'lend', from: 0, y: true })).toBe(true);
    expect(isCommand({ k: 'lend', from: 0, y: 1 })).toBe(false);
    const g = loanParty();
    g.startWave();
    run(g, 90);
    expect(g.phase).toBe('build');
    expect(applyCommand(g, 2, { k: 'loan', to: 0, a: 25 })).toBe(true);
    expect(applyCommand(g, 0, { k: 'lend', from: 2, y: true })).toBe(true);
    expect(g.debtOf(2)).toBe(28);
    g.requestLoan(1, 2, 50);
    const snap = JSON.parse(JSON.stringify(g.snapshot()));
    const back = Game.restore(slow, snap, () => 0.5, { exact: true });
    expect(back.loans.map(({ borrower, lender, owed }) => [borrower, lender, owed])).toEqual(g.loans.map(({ borrower, lender, owed }) => [borrower, lender, owed]));
    expect(back.loans).toHaveLength(1);
    expect(back.loanRequests).toEqual([{ borrower: 1, lender: 2, amount: 50 }]);
  });
});

describe('Multiplayer maps', () => {
  it('Overlink is the eighth map and Gridlock the ninth, both multiplayer hero maps, never the Daily Challenge', () => {
    expect(LEVELS.filter((l) => l.multiplayer).map((l) => l.id)).toEqual(['overlink', 'gridlock']);
    expect(LEVELS.findIndex((l) => l.id === 'overlink')).toBe(7);
    expect(LEVELS.findIndex((l) => l.id === 'gridlock')).toBe(8);
    for (const level of LEVELS.filter((l) => l.multiplayer)) expect(level.heroStart, level.id).toBeDefined();
    for (let day = 0; day < 200; day++) {
      const date = new Date(Date.UTC(2026, 0, 1) + day * 86_400_000);
      expect(dailyChallenge(date).level.multiplayer, date.toISOString()).toBeFalsy();
    }
  });

  it('Gridlock has ten more waves than Overlink', () => {
    const waves = (id: string) => LEVELS.find((l) => l.id === id)!.waves.length;
    expect(waves('gridlock')).toBe(waves('overlink') + 10);
  });
});

for (const id of ['overlink', 'gridlock']) {
  describe(`Map balance: ${id}`, () => {
    const level = LEVELS.find((l) => l.id === id)!;

    it('one hero alone cannot hold it, whichever hero', { timeout: 900_000 }, () => {
      for (const hero of HERO_IDS) {
        const g = playParty(level, 1, [hero]);
        expect(g.phase, `${hero} alone`).toBe('lost');
      }
    });

    it('a party of two can win it, whichever pair', { timeout: 1_200_000 }, () => {
      // Each hero paired with the next, so every hero is tested in two pairs.
      for (let i = 0; i < HERO_IDS.length; i++) {
        const pair: HeroId[] = [HERO_IDS[i], HERO_IDS[(i + 1) % HERO_IDS.length]];
        const g = playParty(level, 1, pair);
        expect(g.phase, `${pair.join('+')}: fell on wave ${g.wavesStarted}`).toBe('won');
      }
    });

    it('a full five-element party wins comfortably', { timeout: 400_000 }, () => {
      const g = playParty(level, 1, ['nalani', 'zeynep', 'leila', 'rua', 'ines']);
      expect(g.phase).toBe('won');
      expect(g.lives).toBeGreaterThanOrEqual(15);
    });
  });
}
