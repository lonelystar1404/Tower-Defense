import type { HeroId } from '../data/hero';
import type { LevelDef } from '../data/levels';
import { Game, type GameSnapshot } from '../game/Game';
import { seededRng } from '../systems/rng';
import { applyCommand, isCommand, type Command, type PlayerCommand } from './commands';

/**
 * Online lockstep. One device at a time is the clock (at first the room's creator): every
 * TICKS_PER_TURN game ticks it publishes a turn holding the commands it received, and every
 * device (the clock included) runs the same turns in the same order on its own copy of the game,
 * so all copies stay the same. The others send their commands to the clock's inbox and see them
 * come back in a turn (a round trip of latency).
 *
 * The clock can move: if it leaves, another device takes over with `handover(lastTurn)`, which
 * first runs every turn the old clock published, then continues from there. Devices that rejoin
 * start as followers from the latest checkpoint.
 *
 * At each wave end the clock also publishes the game's snapshot and a hash of it. A device whose
 * hash differs restores that snapshot (resync). The transport (Firebase, or memory in tests) is
 * behind NetTransport.
 */
export const TICKS_PER_TURN = 6;
const STEP = 1 / 60;
/** A client further behind than this many turns runs extra turns per frame to catch up. */
const CATCH_UP = 4;

/** One turn: game speed (1–3, for pacing only) and the commands to apply before its ticks. */
export interface Turn {
  s: number;
  c?: PlayerCommand[];
}

/** A wave-end checkpoint: the turn it was taken after, the snapshot (JSON), and its hash. */
export interface Check {
  turn: number;
  hash: string;
  snap: string;
}

export interface NetTransport {
  /** A follower's command, to the clock's inbox. */
  sendCommand(cmd: Command): void;
  /** Clock: start (or stop, with null) receiving the inbox's commands, with the sender's player index. */
  listenCommands(cb: ((player: number, cmd: Command) => void) | null): void;
  /** Clock → everyone. */
  publishTurn(n: number, turn: Turn): void;
  onTurn(cb: (n: number, turn: Turn) => void): void;
  publishCheck(wave: number, check: Check): void;
  onCheck(cb: (wave: number, check: Check) => void): void;
  /** Clock: drop turns up to and including `n` (everyone has a checkpoint after them). */
  pruneTurns(n: number): void;
}

/** What every device needs to build the same starting game. */
export interface RoomSetup {
  level: LevelDef;
  seed: number;
  heroes: HeroId[];
  memberIds: string[];
  names: string[];
}

/** The starting game for a room: same seed for combat, lockdowns, and battlefields on every device. */
export function roomGame(setup: RoomSetup): Game {
  return new Game(setup.level, seededRng(setup.seed), setup.heroes[0], {
    party: { heroes: setup.heroes, memberIds: setup.memberIds, names: setup.names },
    conditionsSeed: setup.seed,
    waveSeed: setup.seed,
  });
}

/** FNV-1a (32-bit) of a string, in hex. */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

export class Lockstep {
  game: Game;
  /** Next turn to run. */
  turn = 0;
  /** Clock: game speed and pause (set by the room). Followers pace themselves on the turns' speed. */
  speed = 1;
  paused = false;
  /** Times this device restored a checkpoint because it had drifted. */
  resyncs = 0;
  /** Whether this device is the clock (publishes the turns). */
  clock = false;
  /** Set by `handover`: the turn from which this device becomes the clock. */
  private takeoverAt: number | null = null;
  private pending: PlayerCommand[] = [];
  private received = new Map<number, Turn>();
  /** Turns run since the last checkpoint, to replay after a resync from it. */
  private log: { n: number; turn: Turn }[] = [];
  private checks = new Map<number, Check>();
  /** This device's own hash per wave, to compare with the clock's when it arrives. */
  private ownHashes = new Map<number, { turn: number; hash: string }>();
  private budget = 0;
  private lastWave = 0;

  constructor(
    private readonly setup: RoomSetup,
    private readonly net: NetTransport,
    /** This device's player index. */
    readonly player: number,
    /** Start from a checkpoint (rejoining a game in progress). */
    from?: Check,
  ) {
    this.game = roomGame(setup);
    if (from) this.restoreFrom(from);
    this.lastWave = this.game.wavesStarted;
    net.onTurn((n, turn) => {
      if (n >= this.turn) this.received.set(n, turn);
    });
    net.onCheck((wave, check) => this.onCheck(wave, check));
  }

  /**
   * Makes this device the clock once it has run every published turn up to `lastPublished`
   * (-1 for a new game). Until then it keeps following (catching up as fast as turns arrive).
   */
  handover(lastPublished: number): void {
    if (this.clock) return;
    this.takeoverAt = lastPublished + 1;
  }

  /** Stops being the clock (another device took over); turns come from it again. */
  stepDown(): void {
    if (!this.clock) return;
    this.clock = false;
    this.takeoverAt = null;
    this.net.listenCommands(null);
    // Own commands not yet published go to the new clock.
    for (const { p: _p, ...cmd } of this.pending.splice(0)) this.net.sendCommand(cmd as Command);
  }

  /** Sends a command for this device's player. */
  send(cmd: Command): void {
    if (this.clock) this.pending.push({ ...cmd, p: this.player });
    else this.net.sendCommand(cmd);
  }

  /** Advances by `dt` seconds of real time. Returns false while a follower waits for turns. */
  frame(dt: number): boolean {
    if (this.takeoverAt !== null && !this.clock) {
      // Catch up on everything the old clock published, as fast as it arrives, then take over.
      let guard = 0;
      while (this.turn < this.takeoverAt && guard++ < 2000) {
        const turn = this.received.get(this.turn);
        if (!turn) return false;
        this.received.delete(this.turn);
        this.run(this.turn, turn);
      }
      this.becomeClock();
    }
    if (this.clock) {
      if (this.paused || this.game.over) return true;
      this.budget += dt * this.speed * 60;
      let guard = 0;
      while (this.budget >= TICKS_PER_TURN && guard++ < 20) {
        this.budget -= TICKS_PER_TURN;
        const turn: Turn = { s: this.speed };
        if (this.pending.length) turn.c = this.pending.splice(0);
        this.net.publishTurn(this.turn, turn);
        this.run(this.turn, turn);
      }
      this.budget = Math.min(this.budget, TICKS_PER_TURN);
      return true;
    }
    // Follower: run received turns at the clock's pace, faster when behind.
    const next = this.received.get(this.turn);
    if (!next) {
      this.budget = Math.min(this.budget, TICKS_PER_TURN);
      return false;
    }
    this.budget += dt * next.s * 60;
    const behind = this.received.size > CATCH_UP;
    let guard = 0;
    while (guard++ < 200) {
      const turn = this.received.get(this.turn);
      if (!turn) break;
      if (!(behind && this.received.size > 2) && this.budget < TICKS_PER_TURN) break;
      this.budget = Math.max(0, this.budget - TICKS_PER_TURN);
      this.received.delete(this.turn);
      this.run(this.turn, turn);
    }
    return true;
  }

  private becomeClock(): void {
    this.clock = true;
    this.takeoverAt = null;
    this.budget = 0;
    this.received.clear();
    this.net.listenCommands((p, cmd) => isCommand(cmd) && this.pending.push({ ...cmd, p }));
  }

  /** Runs turn `n`: its commands, then its ticks; at a wave end, the checkpoint. */
  private run(n: number, turn: Turn): void {
    for (const c of turn.c ?? []) applyCommand(this.game, c.p, c);
    for (let i = 0; i < TICKS_PER_TURN; i++) this.game.update(STEP);
    this.turn = n + 1;
    this.log.push({ n, turn });
    const g = this.game;
    if (g.phase === 'build' && g.wavesStarted > this.lastWave) this.checkpoint(n);
    if (g.wavesStarted > this.lastWave && g.phase !== 'wave') this.lastWave = g.wavesStarted;
  }

  private checkpoint(n: number): void {
    const snapshot = this.game.snapshot();
    if (!snapshot) return;
    const snap = JSON.stringify(snapshot);
    const hash = hashString(snap);
    const wave = this.game.wavesStarted;
    this.log = [];
    if (this.clock) {
      // A checkpoint already published for this wave (by an earlier clock) stands.
      if (!this.checks.has(wave)) this.net.publishCheck(wave, { turn: n, hash, snap });
      // Keep the turns since the previous checkpoint, for anyone still catching up.
      const prev = this.checks.get(wave - 1);
      if (prev) this.net.pruneTurns(prev.turn);
      if (!this.checks.has(wave)) this.checks.set(wave, { turn: n, hash, snap });
      return;
    }
    this.ownHashes.set(wave, { turn: n, hash });
    const clock = this.checks.get(wave);
    if (clock) this.compare(wave, clock);
  }

  private onCheck(wave: number, check: Check): void {
    if (this.checks.get(wave)?.hash === check.hash) return;
    this.checks.set(wave, check);
    if (this.clock) return;
    const own = this.ownHashes.get(wave);
    if (own) this.compare(wave, check);
    // Far behind (turns before this checkpoint are being pruned): jump to it.
    else if (check.turn >= this.turn + 50) this.restoreFrom(check);
  }

  /** The clock's checkpoint vs this device's: on a mismatch, restore the clock's and replay since. */
  private compare(wave: number, clock: Check): void {
    const own = this.ownHashes.get(wave);
    this.ownHashes.delete(wave);
    if (!own || own.hash === clock.hash) return;
    const replay = this.log.filter((t) => t.n > clock.turn);
    this.restoreFrom(clock);
    this.resyncs++;
    for (const t of replay) this.run(t.n, t.turn);
  }

  private restoreFrom(check: Check): void {
    const snap = JSON.parse(check.snap) as GameSnapshot;
    this.game = Game.restore(this.setup.level, snap, seededRng(this.setup.seed), { exact: true, waveSeed: this.setup.seed });
    this.turn = check.turn + 1;
    this.lastWave = this.game.wavesStarted;
    this.log = [];
    for (const n of [...this.received.keys()]) if (n < this.turn) this.received.delete(n);
  }
}
