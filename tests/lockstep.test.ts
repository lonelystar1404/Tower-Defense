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

function transports(hub: Hub, clients: number): NetTransport[] {
  const turnSubs: ((n: number, t: Turn) => void)[] = [];
  const checkSubs: ((w: number, c: Check) => void)[] = [];
  let onCmd: (p: number, c: Command) => void = () => {};
  const host: NetTransport = {
    isHost: true,
    sendCommand: () => {},
    onCommand: (cb) => (onCmd = cb),
    publishTurn: (n, t) => turnSubs.forEach((cb, i) => hub.send(`turn${i}`, () => cb(n, JSON.parse(JSON.stringify(t))))),
    onTurn: () => {},
    publishCheck: (w, c) => checkSubs.forEach((cb, i) => hub.send(`turn${i}`, () => cb(w, c))),
    onCheck: () => {},
    pruneTurns: () => {},
  };
  const list: NetTransport[] = [host];
  for (let i = 0; i < clients; i++) {
    list.push({
      isHost: false,
      sendCommand: (c) => hub.send(`cmd${i}`, () => onCmd(i + 1, JSON.parse(JSON.stringify(c)))),
      onCommand: () => {},
      publishTurn: () => {},
      onTurn: (cb) => (turnSubs[i] = cb),
      publishCheck: () => {},
      onCheck: (cb) => (checkSubs[i] = cb),
      pruneTurns: () => {},
    });
  }
  return list;
}

const overlink = LEVELS.find((l) => l.id === 'overlink')!;
const SHORT = { ...overlink, waves: overlink.waves.slice(0, 4), hpScale: 1 };
const HEROES: HeroId[] = ['vex', 'mateo', 'echo'];
const setup: RoomSetup = { level: SHORT, seed: 12345, heroes: HEROES, memberIds: ['NW-A', 'NW-B', 'NW-C'], names: ['P1', 'P2', 'P3'] };

/** Each player's scripted plan: towers to build early, then hero moves and abilities. */
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
  if (me === 0 && g.phase === 'build' && frame % 120 === 0) session.send({ k: 'ready' });
}

function play(maxDelay: number, sabotage = false) {
  const hub = new Hub(seededRng(7), maxDelay);
  const nets = transports(hub, 2);
  const sessions = nets.map((net, i) => new Lockstep(setup, net, i));
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
    // Every player's commands made it into the game.
    expect(new Set(sessions[0].game.towers.map((t) => t.owner))).toEqual(new Set([0, 1, 2]));
  });

  it('a device that drifts restores the host’s wave-end snapshot and matches again', { timeout: 120_000 }, () => {
    const { sessions, states } = play(10, true);
    expect(sessions[2].resyncs).toBeGreaterThanOrEqual(1);
    expect(sessions[1].resyncs).toBe(0);
    expect(states[2]).toBe(states[0]);
  });

  it('hashes strings stably', () => {
    expect(hashString('neon')).toBe(hashString('neon'));
    expect(hashString('neon')).not.toBe(hashString('neom'));
  });
});
