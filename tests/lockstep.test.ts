import { describe, expect, it } from 'vitest';
import type { HeroId } from '../src/data/hero';
import { LEVELS } from '../src/data/levels';
import { applyCommand, isCommand, type Command } from '../src/net/commands';
import { hashString, Lockstep, type Check, type NetTransport, type RoomSetup, type Turn } from '../src/net/lockstep';
import { seededRng } from '../src/systems/rng';

/**
 * An in-memory network: every message is delivered after a random number of frames (0–maxDelay),
 * in the order sent per channel, like Firebase. One hub, one transport per device.
 */
class Hub {
  private queue: { at: number; deliver: () => void }[] = [];
  frame = 0;
  private lastAt = new Map<string, number>();
  constructor(private readonly rng: () => number, private readonly maxDelay: number) {}

  send(channel: string, deliver: () => void): void {
    // In order per channel: never earlier than the previous message on it.
    const at = Math.max(this.frame + Math.floor(this.rng() * (this.maxDelay + 1)), this.lastAt.get(channel) ?? 0);
    this.lastAt.set(channel, at);
    this.queue.push({ at, deliver });
  }

  tick(): void {
    this.frame++;
    const due = this.queue.filter((m) => m.at <= this.frame);
    this.queue = this.queue.filter((m) => m.at > this.frame);
    for (const m of due) m.deliver();
  }
}

/**
 * A shared store like the room in Firebase: turns and checkpoints are kept, so a device that
 * subscribes late (rejoining) first gets everything already published; the inbox keeps
 * commands until whoever is the clock reads them.
 */
class Store {
  turns = new Map<number, Turn>();
  checks = new Map<number, Check>();
  turnSubs: { dev: number; cb: (n: number, t: Turn) => void }[] = [];
  checkSubs: { dev: number; cb: (w: number, c: Check) => void }[] = [];
  inbox: { p: number; c: Command }[] = [];
  reader: { dev: number; cb: (p: number, c: Command) => void } | null = null;
  /** Devices whose network is down: nothing they publish arrives, nothing reaches them. */
  offline = new Set<number>();
  constructor(readonly hub: Hub) {}

  transport(dev: number): NetTransport {
    const store = this;
    const hub = this.hub;
    const deliverInbox = () => {
      const r = store.reader;
      if (!r || store.offline.has(r.dev)) return;
      for (const m of store.inbox.splice(0)) r.cb(m.p, m.c);
    };
    return {
      sendCommand(c) {
        if (store.offline.has(dev)) return;
        const copy = JSON.parse(JSON.stringify(c)) as Command;
        hub.send(`cmd${dev}`, () => {
          store.inbox.push({ p: dev, c: copy });
          deliverInbox();
        });
      },
      listenCommands(cb) {
        store.reader = cb ? { dev, cb } : null;
        deliverInbox();
      },
      publishTurn(n, t) {
        if (store.offline.has(dev)) return;
        const copy = JSON.parse(JSON.stringify(t)) as Turn;
        store.turns.set(n, copy);
        for (const s of store.turnSubs) if (!store.offline.has(s.dev)) hub.send(`turn${s.dev}`, () => s.cb(n, copy));
      },
      onTurn(cb) {
        store.turnSubs.push({ dev, cb });
        for (const [n, t] of [...store.turns].sort((a, b) => a[0] - b[0])) hub.send(`turn${dev}`, () => cb(n, t));
      },
      publishCheck(w, c) {
        if (store.offline.has(dev)) return;
        store.checks.set(w, c);
        for (const s of store.checkSubs) if (!store.offline.has(s.dev)) hub.send(`turn${s.dev}`, () => s.cb(w, c));
      },
      onCheck(cb) {
        store.checkSubs.push({ dev, cb });
        for (const [w, c] of store.checks) hub.send(`turn${dev}`, () => cb(w, c));
      },
      pruneTurns: () => {},
    };
  }

  lastTurn(): number {
    return Math.max(-1, ...this.turns.keys());
  }

  latestCheck(): Check | undefined {
    return [...this.checks].sort((a, b) => b[0] - a[0])[0]?.[1];
  }
}

function transports(hub: Hub, clients: number): NetTransport[] {
  const store = new Store(hub);
  return Array.from({ length: clients + 1 }, (_, i) => store.transport(i));
}

const overlink = LEVELS.find((l) => l.id === 'overlink')!;
const SHORT = { ...overlink, waves: overlink.waves.slice(0, 4), hpScale: 1 };
const HEROES: HeroId[] = ['vex', 'mateo', 'echo'];
const setup: RoomSetup = { level: SHORT, seed: 12345, heroes: HEROES, memberIds: ['NW-A', 'NW-B', 'NW-C'], names: ['P1', 'P2', 'P3'] };

/** Set once any device has seen P3 in debt (a loan went through lockstep). */
let loanSeen = false;

/** Each player's scripted plan: towers to build early, then hero moves and abilities; between waves P3 borrows from P2. */
function playerAI(session: Lockstep, frame: number, rng: () => number): void {
  const g = session.game;
  const me = session.player;
  if (frame % 30 === me * 7) {
    // Try to build somewhere free near the road, or upgrade an own tower.
    const options: Command[] = [];
    for (let r = 0; r < g.level.rows; r++) for (let c = 0; c < g.level.cols; c++) if (g.canBuild(c, r)) options.push({ k: 'build', c, r, w: (['cannon', 'flak', 'multi', 'mortar'] as const)[(c + r + me) % 4], e: (['fire', 'water', 'wood', 'earth', 'metal'] as const)[(c * 3 + r) % 5] });
    const mine = g.towers.filter((t) => t.owner === me);
    if (mine.length > 3 && rng() < 0.4) options.splice(0, options.length, { k: 'up', c: mine[0].col, r: mine[0].row });
    if (options.length) session.send(options[Math.floor(rng() * options.length)]);
  }
  if (frame % 45 === me * 11 && g.enemies.length) {
    const e = g.enemies[Math.floor(rng() * g.enemies.length)];
    session.send({ k: 'move', x: Math.round(e.x * 100) / 100, y: Math.round(e.y * 100) / 100 });
    session.send({ k: 'cast', s: Math.floor(rng() * 2), x: Math.round(e.x * 100) / 100, y: Math.round(e.y * 100) / 100 });
  }
  if (me === 2 && g.borrowingOpen && frame % 40 === 3 && g.debtOf(2) === 0 && !g.loanRequests.length) session.send({ k: 'loan', to: 1, a: 30 });
  if (me === 1 && g.loanRequests.some((r) => r.lender === 1)) session.send({ k: 'lend', from: 2, y: true });
  if (g.debtOf(2) > 0) loanSeen = true;
  if (me === 0 && g.phase === 'build' && frame % 120 === 0) session.send({ k: 'ready' });
}

function play(maxDelay: number, sabotage = false) {
  const hub = new Hub(seededRng(7), maxDelay);
  const nets = transports(hub, 2);
  const sessions = nets.map((net, i) => new Lockstep(setup, net, i));
  sessions[0].handover(-1);
  const ais = sessions.map((_, i) => seededRng(100 + i));
  let sabotaged = false;
  for (let frame = 0; frame < 60 * 60 * 12 && !sessions.every((s) => s.game.over); frame++) {
    hub.tick();
    sessions.forEach((s, i) => {
      s.frame(1 / 60 * 3);
      playerAI(s, frame, ais[i]);
    });
    // Corrupt one client mid-wave: its next checkpoint must disagree and resync it.
    if (sabotage && !sabotaged && sessions[2].game.phase === 'wave' && sessions[2].game.wavesStarted === 2) {
      sessions[2].game.players[2].gold += 999;
      sabotaged = true;
    }
  }
  // Let clients catch up to the host.
  for (let i = 0; i < 2000; i++) {
    hub.tick();
    sessions.slice(1).forEach((s) => s.frame(1 / 20));
  }
  const states = sessions.map((s) => JSON.stringify({
    phase: s.game.phase, lives: s.game.lives, waves: s.game.wavesStarted, gold: s.game.players.map((p) => p.gold),
    towers: s.game.towers.map((t) => [t.col, t.row, t.level, t.owner]), score: s.game.score, time: s.game.time,
    loans: s.game.loans.map((l) => [l.borrower, l.lender, l.owed]),
  }));
  return { sessions, states };
}

describe('Online lockstep', () => {
  it('validates commands from the network', () => {
    expect(isCommand({ k: 'build', c: 1, r: 2, w: 'cannon', e: 'fire' })).toBe(true);
    expect(isCommand({ k: 'build', c: 1, r: 2, w: 'laser', e: 'fire' })).toBe(false);
    expect(isCommand({ k: 'cast', s: 7, x: 1, y: 1 })).toBe(false);
    expect(isCommand({ k: 'move', x: Infinity, y: 1 })).toBe(false);
    expect(isCommand({ k: 'hack' })).toBe(false);
    expect(isCommand(null)).toBe(false);
  });

  it('commands only touch the sender’s gold and towers', () => {
    const { sessions } = play(0);
    const g = sessions[0].game;
    const other = g.towers.find((t) => t.owner === 1)!;
    expect(applyCommand(g, 0, { k: 'sell', c: other.col, r: other.row })).toBe(false);
    expect(applyCommand(g, 0, { k: 'prio', c: other.col, r: other.row })).toBe(false);
  });

  it('host and clients end in exactly the same game, with laggy delivery and no resyncs', { timeout: 120_000 }, () => {
    const { sessions, states } = play(20);
    expect(sessions[0].game.wavesStarted).toBeGreaterThanOrEqual(3);
    expect(states[1]).toBe(states[0]);
    expect(states[2]).toBe(states[0]);
    expect(sessions.map((s) => s.resyncs)).toEqual([0, 0, 0]);
    expect(loanSeen, 'a loan went through').toBe(true);
    // Every player's commands made it into the game.
    expect(new Set(sessions[0].game.towers.map((t) => t.owner))).toEqual(new Set([0, 1, 2]));
  });

  it('a device that drifts restores the host’s wave-end snapshot and matches again', { timeout: 120_000 }, () => {
    const { sessions, states } = play(10, true);
    expect(sessions[2].resyncs).toBeGreaterThanOrEqual(1);
    expect(sessions[1].resyncs).toBe(0);
    expect(states[2]).toBe(states[0]);
  });

  it('when the clock leaves mid-wave, the next player takes over and the old clock rejoins in sync', { timeout: 120_000 }, () => {
    const hub = new Hub(seededRng(9), 8);
    const store = new Store(hub);
    const sessions = [0, 1, 2].map((i) => new Lockstep(setup, store.transport(i), i));
    sessions[0].handover(-1);
    const ais = sessions.map((_, i) => seededRng(200 + i));
    let away = false;
    let back = false;
    let awayAt = 0;
    let inWave2 = 0;
    for (let frame = 0; frame < 60 * 60 * 12 && !sessions.every((s) => s.game.over); frame++) {
      hub.tick();
      // P1 (the clock) drops out in the middle of wave 2.
      if (sessions[1].game.phase === 'wave' && sessions[1].game.wavesStarted === 2) inWave2++;
      if (!away && inWave2 === 40) {
        away = true;
        awayAt = frame;
        store.offline.add(0);
      }
      // Three seconds later P2 takes over from the last turn in the store.
      if (away && frame === awayAt + 180) sessions[1].handover(store.lastTurn());
      // After wave 3 has started, P1 comes back as a follower from the latest checkpoint.
      if (away && !back && sessions[1].game.wavesStarted >= 3) {
        back = true;
        store.offline.delete(0);
        sessions[0] = new Lockstep(setup, store.transport(0), 0, store.latestCheck());
      }
      sessions.forEach((s, i) => {
        if (i === 0 && away && !back) return;
        s.frame((1 / 60) * 3);
        playerAI(s, frame, ais[i]);
      });
    }
    for (let i = 0; i < 2000; i++) {
      hub.tick();
      sessions.forEach((s) => s.frame(1 / 20));
    }
    expect(away && back).toBe(true);
    expect(sessions[1].clock).toBe(true);
    expect(sessions[0].clock).toBe(false);
    const state = (s: Lockstep) => JSON.stringify({ phase: s.game.phase, lives: s.game.lives, gold: s.game.players.map((p) => p.gold), towers: s.game.towers.map((t) => [t.col, t.row, t.level, t.owner]), score: s.game.score });
    expect(sessions[1].game.wavesStarted).toBeGreaterThanOrEqual(3);
    expect(state(sessions[2])).toBe(state(sessions[1]));
    expect(state(sessions[0])).toBe(state(sessions[1]));
    expect(sessions[2].resyncs).toBe(0);
  });

  it('hashes strings stably', () => {
    expect(hashString('neon')).toBe(hashString('neon'));
    expect(hashString('neon')).not.toBe(hashString('neom'));
  });
});
