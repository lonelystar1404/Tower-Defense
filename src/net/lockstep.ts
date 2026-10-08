import type { HeroId } from '../data/hero';
import type { LevelDef } from '../data/levels';
import { Game, type GameSnapshot } from '../game/Game';
import { seededRng } from '../systems/rng';
import { applyCommand, isCommand, type Command, type PlayerCommand } from './commands';

/**
 * Online lockstep. The host is the clock: every TICKS_PER_TURN game ticks it publishes a turn
 * holding the commands it received, and every device (host included) runs the same turns in the
 * same order on its own copy of the game, so all copies stay the same. Clients send their
 * commands to the host and see them come back in a turn (a round trip of latency).
 *
 * At each wave end the host also publishes the game's snapshot and a hash of it. A device whose
 * hash differs restores the host's snapshot (resync); a device that joins late starts from the
 * latest one. The transport (Firebase, or memory in tests) is behind NetTransport.
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
  readonly isHost: boolean;
  /** Client → host. */
  sendCommand(cmd: Command): void;
  /** Host: commands from clients (player index already resolved by the transport). */
  onCommand(cb: (player: number, cmd: Command) => void): void;
  /** Host → everyone. */
  publishTurn(n: number, turn: Turn): void;
  onTurn(cb: (n: number, turn: Turn) => void): void;
  publishCheck(wave: number, check: Check): void;
  onCheck(cb: (wave: number, check: Check) => void): void;
  /** Host: drop turns up to and including `n` (everyone has a checkpoint after them). */
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
  /** Host: game speed (turns per second × 10) and pause. Clients follow the turns' speed. */
  speed = 1;
  paused = false;
  /** Times this device restored the host's snapshot because it had drifted. */
  resyncs = 0;
  private pending: PlayerCommand[] = [];
  private received = new Map<number, Turn>();
  /** Turns run since the last checkpoint, to replay after a resync from it. */
  private log: { n: number; turn: Turn }[] = [];
  private checks = new Map<number, Check>();
  /** This device's own hash per wave, to compare with the host's when it arrives. */
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
    if (net.isHost) net.onCommand((p, cmd) => isCommand(cmd) && this.pending.push({ ...cmd, p }));
    else {
      net.onTurn((n, turn) => {
        if (n >= this.turn) this.received.set(n, turn);
      });
      net.onCheck((wave, check) => this.onCheck(wave, check));
    }
  }

  /** Sends a command for this device's player. */
  send(cmd: Command): void {
    if (this.net.isHost) this.pending.push({ ...cmd, p: this.player });
    else this.net.sendCommand(cmd);
  }

  /** Advances by `dt` seconds of real time. Returns false while a client waits for the host. */
  frame(dt: number): boolean {
    if (this.net.isHost) {
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
    // Client: run received turns at the host's pace, faster when behind.
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
    if (this.net.isHost) {
      this.net.publishCheck(wave, { turn: n, hash, snap });
      // Keep the turns since the previous checkpoint, for anyone still catching up.
      const prev = this.checks.get(wave - 1);
      if (prev) this.net.pruneTurns(prev.turn);
      this.checks.set(wave, { turn: n, hash, snap });
      return;
    }
    this.ownHashes.set(wave, { turn: n, hash });
    const host = this.checks.get(wave);
    if (host) this.compare(wave, host);
  }

  private onCheck(wave: number, check: Check): void {
    this.checks.set(wave, check);
    const own = this.ownHashes.get(wave);
    if (own) this.compare(wave, check);
    // Far behind (turns before this checkpoint are being pruned): jump to it.
    else if (check.turn >= this.turn + 50) this.restoreFrom(check);
  }

  /** Host's checkpoint vs this device's: on a mismatch, restore the host's and replay since. */
  private compare(wave: number, host: Check): void {
    const own = this.ownHashes.get(wave);
    this.ownHashes.delete(wave);
    if (!own || own.hash === host.hash) return;
    const replay = this.log.filter((t) => t.n > host.turn);
    this.restoreFrom(host);
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
