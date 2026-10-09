/**
 * Online rooms on Firebase (Realtime Database + anonymous sign-in). Loaded on demand (dynamic
 * import), so the Firebase SDK is only downloaded by players who open online multiplayer.
 *
 * Data, under /rooms/{CODE} (rules in database.rules.json):
 *   meta     { host, level, seed, status: 'lobby'|'playing', v, created, paused?, pausedBy?, speed?, order?, heroes?, members? }
 *            `host` is the room's creator, then whoever is the lockstep clock (it moves if the clock leaves).
 *   players/{uid}  { member, hero, joined }   (presence: removed while that player is disconnected)
 *   inbox/{push}   { u: uid, c: Command }    (players → clock; the clock deletes each after reading)
 *   turns/{n}      Turn                      (clock → everyone; pruned after each checkpoint)
 *   checks/{wave}  Check                     (clock → everyone; wave-end snapshots)
 *   chat/{push}    { u: uid, member, text, at }  (lobby chat; deleted with the room)
 * /roomIndex/{CODE} = creation time, so rooms abandoned for a day can be found and deleted (by the
 * next player who creates a room). The last player to leave deletes the room.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getDatabase, ref, get, set, update, push, remove, onValue, onChildAdded, onDisconnect, serverTimestamp, runTransaction,
  query, orderByKey, orderByValue, endAt, limitToLast, limitToFirst, type Database, type DatabaseReference, type Unsubscribe,
} from 'firebase/database';
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence, signInAnonymously } from 'firebase/auth';
import type { HeroId } from '../data/hero';
import { HEROES } from '../data/hero';
import { PARTY } from '../data/party';
import type { Command } from './commands';
import type { Check, NetTransport, Turn } from './lockstep';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCYwR2y8xJd4Z4R3Iqo3t9LFBVoCfxQ42M',
  authDomain: 'neon-wardens.firebaseapp.com',
  databaseURL: 'https://neon-wardens-default-rtdb.firebaseio.com',
  projectId: 'neon-wardens',
  storageBucket: 'neon-wardens.firebasestorage.app',
  messagingSenderId: '116851020101',
  appId: '1:116851020101:web:c7ec278af107db5d842e2c',
};

/** Bump when the room data or lockstep rules change, so old and new app versions don't mix. */
export const PROTOCOL = 4;
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const CODE_LENGTH = 5;

export type OnlineError = 'setup' | 'not-found' | 'full' | 'started' | 'version' | 'network';

export class OnlineFailure extends Error {
  constructor(readonly reason: OnlineError, detail?: string) {
    super(detail ?? reason);
  }
}

export interface RoomMeta {
  host: string;
  level: string;
  seed: number;
  status: 'lobby' | 'playing';
  v: number;
  paused?: boolean;
  /** Slot of the player who paused. */
  pausedBy?: number;
  speed?: number;
  created?: number;
  /** The host's heartbeat (server time), every BEAT_MS; a host silent for HOST_TIMEOUT_MS can be replaced. */
  beat?: number;
  /** Set when the game starts: player uids in slot order, their heroes and MemberIds. */
  order?: string[];
  heroes?: HeroId[];
  members?: string[];
}

export interface RoomPlayer {
  uid: string;
  member: string;
  hero: HeroId | null;
  /** Picked a hero and pressed Ready (the game starts when everyone is). */
  ready: boolean;
  joined: number;
}

export interface ChatMessage {
  u: string;
  member: string;
  text: string;
}

export interface RoomState {
  meta: RoomMeta | null;
  /** In join order. */
  players: RoomPlayer[];
}

let conn: Promise<{ db: Database; uid: string }> | null = null;

/** Signs in (anonymously) and connects, once. */
export function connect(): Promise<{ db: Database; uid: string }> {
  conn ??= (async () => {
    let app: FirebaseApp;
    try {
      app = initializeApp(FIREBASE_CONFIG);
    } catch (e) {
      throw new OnlineFailure('setup', String(e));
    }
    // No popup/redirect resolver: anonymous sign-in only, which also works inside the iOS app.
    const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
    try {
      const cred = await signInAnonymously(auth);
      return { db: getDatabase(app), uid: cred.user.uid };
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      throw new OnlineFailure(code.includes('operation-not-allowed') || code.includes('admin-restricted') || code.includes('configuration') ? 'setup' : 'network', code);
    }
  })();
  conn.catch(() => (conn = null));
  return conn;
}

function newCode(): string {
  const v = crypto.getRandomValues(new Uint32Array(CODE_LENGTH));
  return [...v].map((x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
}

export function normalizeCode(text: string): string {
  return text.toUpperCase().replace(/[^2-9A-HJKMNP-Z]/g, '').slice(0, CODE_LENGTH);
}

const turnKey = (n: number) => String(n).padStart(9, '0');

/** How often the host writes its heartbeat, and how long a silent host keeps the role (also in database.rules.json). */
export const BEAT_MS = 2000;
export const HOST_TIMEOUT_MS = 8000;

/** Rooms older than this are abandoned (deleted by the next room creator). */
const STALE_MS = 24 * 60 * 60 * 1000;

/** A room this device is in (lobby or game). */
export class Room {
  private unsubs: Unsubscribe[] = [];
  private commandsUnsub: Unsubscribe | null = null;
  private closed = false;
  /** Latest room state seen by `watch`. */
  state: RoomState = { meta: null, players: [] };
  /** Whether this device is connected to Firebase right now. */
  connected = true;
  /** This player's entry (re-written whenever the connection comes back). */
  private me: { member: string; hero: HeroId | null; ready: boolean; joined: number | object };

  private constructor(
    private readonly db: Database,
    readonly uid: string,
    readonly code: string,
    member: string,
    hero: HeroId | null,
  ) {
    this.me = { member, hero, ready: false, joined: serverTimestamp() };
  }

  /** Whether this device is the room's host: the creator in the lobby, the lockstep clock in game. */
  get isHost(): boolean {
    return this.state.meta?.host === this.uid;
  }

  private r(path = ''): DatabaseReference {
    return ref(this.db, `rooms/${this.code}${path ? `/${path}` : ''}`);
  }

  /** Keeps this player's presence entry while connected, and puts it back after a dropped connection. */
  private async present(): Promise<void> {
    await set(this.r(`players/${this.uid}`), this.me);
    this.unsubs.push(
      onValue(ref(this.db, '.info/connected'), (s) => {
        this.connected = s.val() === true;
        if (s.val() !== true || this.closed) return;
        void onDisconnect(this.r(`players/${this.uid}`)).remove().then(() => set(this.r(`players/${this.uid}`), this.me)).catch(() => {});
      }),
    );
  }

  /** Deletes a few rooms abandoned for over a day (their index entries are the only ones readable). */
  private static async cleanStale(db: Database): Promise<void> {
    try {
      const old = await get(query(ref(db, 'roomIndex'), orderByValue(), endAt(Date.now() - STALE_MS - 60 * 60 * 1000), limitToFirst(10)));
      const changes: Record<string, null> = {};
      old.forEach((c) => {
        changes[`rooms/${c.key}`] = null;
        changes[`roomIndex/${c.key}`] = null;
      });
      if (Object.keys(changes).length) await update(ref(db), changes);
    } catch {
      // Best effort.
    }
  }

  /** Creates a room for `level` with this device as host. */
  static async create(level: string, member: string): Promise<Room> {
    const { db, uid } = await connect();
    void Room.cleanStale(db);
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      const room = new Room(db, uid, code, member, null);
      try {
        if ((await get(room.r('meta'))).exists()) continue;
        const seed = crypto.getRandomValues(new Uint32Array(1))[0] >>> 1;
        const meta: Omit<RoomMeta, 'created' | 'beat'> & { created: object; beat: object } = { host: uid, level, seed, status: 'lobby', v: PROTOCOL, created: serverTimestamp(), beat: serverTimestamp() };
        await set(room.r('meta'), meta);
        await set(ref(db, `roomIndex/${code}`), serverTimestamp());
        await room.present();
        return room;
      } catch (e) {
        throw new OnlineFailure(String(e).includes('PERMISSION_DENIED') ? 'setup' : 'network', String(e));
      }
    }
    throw new OnlineFailure('network', 'no free room code');
  }

  /** Joins (or, for a player already in its game, rejoins) the room with `code`. */
  static async join(code: string, member: string): Promise<Room> {
    const { db, uid } = await connect();
    try {
      const meta = (await get(ref(db, `rooms/${code}/meta`))).val() as RoomMeta | null;
      if (!meta) throw new OnlineFailure('not-found');
      if (meta.v !== PROTOCOL) throw new OnlineFailure('version');
      if (meta.status === 'playing') {
        if (!meta.order?.includes(uid)) throw new OnlineFailure('started');
      } else {
        const players = (await get(ref(db, `rooms/${code}/players`))).val() as Record<string, unknown> | null;
        if (players && !(uid in players) && Object.keys(players).length >= PARTY.maxPlayers) throw new OnlineFailure('full');
      }
      const room = new Room(db, uid, code, member, meta.heroes?.[meta.order?.indexOf(uid) ?? -1] ?? null);
      room.state = { meta, players: [] };
      await room.present();
      return room;
    } catch (e) {
      if (e instanceof OnlineFailure) throw e;
      throw new OnlineFailure(String(e).includes('PERMISSION_DENIED') ? 'setup' : 'network', String(e));
    }
  }

  /** Calls back with the room (meta and players) whenever it changes; meta null = room deleted. */
  watch(cb: (state: RoomState) => void): void {
    let gotMeta = false;
    this.unsubs.push(
      onValue(this.r('meta'), (s) => {
        gotMeta = true;
        this.state = { ...this.state, meta: s.val() as RoomMeta | null };
        cb(this.state);
      }),
      onValue(this.r('players'), (s) => {
        const val = (s.val() ?? {}) as Record<string, Omit<RoomPlayer, 'uid'>>;
        const players = Object.entries(val)
          .map(([uid, p]) => ({ uid, member: p.member, hero: p.hero ?? null, ready: !!p.ready, joined: typeof p.joined === 'number' ? p.joined : Date.now() }))
          .sort((a, b) => a.joined - b.joined || (a.uid < b.uid ? -1 : 1));
        const mine = players.find((p) => p.uid === this.uid);
        if (mine) this.me = { member: mine.member, hero: mine.hero, ready: mine.ready, joined: mine.joined };
        this.state = { ...this.state, players };
        if (gotMeta) cb(this.state);
      }),
    );
  }

  /** Picking (or changing) a hero clears Ready. */
  pickHero(hero: HeroId | null): Promise<void> {
    this.me.hero = hero;
    this.me.ready = false;
    return update(this.r(`players/${this.uid}`), { hero, ready: false });
  }

  setReady(ready: boolean): Promise<void> {
    this.me.ready = ready;
    return set(this.r(`players/${this.uid}/ready`), ready);
  }

  /** Room chat: the last messages, oldest first, and every new one. */
  watchChat(cb: (messages: ChatMessage[]) => void): void {
    const log: ChatMessage[] = [];
    this.unsubs.push(
      onChildAdded(query(this.r('chat'), orderByKey(), limitToLast(50)), (s) => {
        const m = s.val() as Partial<ChatMessage> | null;
        if (!m?.u || typeof m.text !== 'string') return;
        log.push({ u: m.u, member: String(m.member ?? ''), text: m.text.slice(0, 200) });
        if (log.length > 50) log.shift();
        cb([...log]);
      }),
    );
  }

  private lastChat = 0;
  sendChat(text: string): void {
    // A little flood protection; the rules cap the length.
    const now = Date.now();
    if (now - this.lastChat < 600) return;
    this.lastChat = now;
    void push(this.r('chat'), { u: this.uid, member: this.me.member, text: text.slice(0, 200), at: serverTimestamp() }).catch(() => {});
  }

  /** Lobby host: true when 2–5 players are here, each with a different hero, all ready. */
  everyoneReady(): boolean {
    const players = this.state.players;
    const heroes = players.map((p) => p.hero);
    return players.length >= PARTY.minPlayers && players.length <= PARTY.maxPlayers && players.every((p) => p.hero && p.ready) && new Set(heroes).size === heroes.length;
  }

  /** Host: starts the game with the players present, in join order (host first). */
  async start(state: RoomState): Promise<void> {
    if (!this.isHost || !state.meta) return;
    const players = [...state.players].sort((a, b) => (a.uid === this.uid ? -1 : b.uid === this.uid ? 1 : 0));
    const heroes = players.map((p) => p.hero);
    if (players.length < PARTY.minPlayers || players.length > PARTY.maxPlayers) return;
    if (heroes.some((h) => !h || !(h in HEROES)) || new Set(heroes).size !== heroes.length) return;
    if (players.some((p) => !p.ready)) return;
    await update(this.r('meta'), { status: 'playing', order: players.map((p) => p.uid), heroes, members: players.map((p) => p.member), speed: 1, paused: false });
  }

  /** Host: the heartbeat that tells the others it's still here (even while paused). */
  beat(): void {
    if (this.isHost && this.connected) void update(this.r('meta'), { beat: serverTimestamp() }).catch(() => {});
  }

  /** Any player can pause or resume the shared game, and set its speed. */
  setPaused(paused: boolean, by: number): void {
    void update(this.r('meta'), { paused, pausedBy: by }).catch(() => {});
  }

  setSpeed(speed: number): void {
    void update(this.r('meta'), { speed, paused: false }).catch(() => {});
  }

  /**
   * Takes over as the clock from `oldHost` (who left). A transaction, so when several players try
   * at once exactly one wins. Resolves true if this device is now the host.
   */
  async claimClock(oldHost: string): Promise<boolean> {
    try {
      const r = await runTransaction(this.r('meta/host'), (cur) => (cur === oldHost ? this.uid : undefined));
      return r.committed && r.snapshot.val() === this.uid;
    } catch {
      return false;
    }
  }

  /** The newest published turn number, or -1 (a new clock continues after it). */
  async lastTurn(): Promise<number> {
    const s = await get(query(this.r('turns'), orderByKey(), limitToLast(1)));
    let n = -1;
    s.forEach((c) => {
      n = Number(c.key);
    });
    return n;
  }

  /** The latest wave-end checkpoint (for rejoining a game in progress). */
  async latestCheck(): Promise<Check | null> {
    const s = await get(query(this.r('checks'), orderByKey(), limitToLast(1)));
    let check: Check | null = null;
    s.forEach((c) => {
      check = c.val() as Check;
    });
    return check;
  }

  /** Clock, at game over: the turns, checkpoints, and inbox aren't needed any more. */
  clearGameData(): void {
    if (this.isHost) void update(this.r(), { turns: null, checks: null, inbox: null }).catch(() => {});
  }

  /** The lockstep transport for this room, with `order` = player uids in slot order. */
  transport(order: string[]): NetTransport {
    const room = this;
    let pruned = -1;
    let lastWave = 0;
    return {
      sendCommand(cmd: Command) {
        void push(room.r('inbox'), { u: room.uid, c: cmd }).catch(() => {});
      },
      listenCommands(cb) {
        room.commandsUnsub?.();
        room.commandsUnsub = null;
        if (!cb) return;
        room.commandsUnsub = onChildAdded(room.r('inbox'), (s) => {
          const v = s.val() as { u?: string; c?: Command } | null;
          void remove(s.ref).catch(() => {});
          const player = v?.u ? order.indexOf(v.u) : -1;
          if (player >= 0 && v?.c) cb(player, v.c);
        });
      },
      publishTurn(n: number, turn: Turn) {
        void set(room.r(`turns/${turnKey(n)}`), turn).catch(() => {});
      },
      onTurn(cb) {
        room.unsubs.push(onChildAdded(room.r('turns'), (s) => cb(Number(s.key), s.val() as Turn)));
      },
      publishCheck(wave: number, check: Check) {
        const changes: Record<string, unknown> = { [`checks/${wave}`]: check };
        // Keep only the last two checkpoints.
        for (let w = lastWave + 1; w <= wave - 2; w++) changes[`checks/${w}`] = null;
        lastWave = Math.max(lastWave, wave - 2);
        void update(room.r(), changes).catch(() => {});
      },
      onCheck(cb) {
        room.unsubs.push(onChildAdded(room.r('checks'), (s) => cb(Number(s.key), s.val() as Check)));
      },
      pruneTurns(n: number) {
        const changes: Record<string, null> = {};
        for (let i = pruned + 1; i <= n; i++) changes[`turns/${turnKey(i)}`] = null;
        pruned = Math.max(pruned, n);
        if (Object.keys(changes).length) void update(room.r(), changes).catch(() => {});
      },
    };
  }

  /**
   * Leaves the room. The game goes on for the others (another player takes over as the clock if
   * this was it); this player can rejoin with the code. The last player to leave deletes the room.
   */
  async leave(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const u of this.unsubs) u();
    this.unsubs = [];
    this.commandsUnsub?.();
    this.commandsUnsub = null;
    const others = this.state.players.filter((p) => p.uid !== this.uid).length;
    try {
      await onDisconnect(this.r(`players/${this.uid}`)).cancel();
      if (others === 0) {
        // Last one out: become host if needed (the old host is gone), then delete everything.
        const host = this.state.meta?.host;
        if (host && host !== this.uid) await this.claimClock(host);
        await update(ref(this.db), { [`rooms/${this.code}`]: null, [`roomIndex/${this.code}`]: null });
      } else {
        await remove(this.r(`players/${this.uid}`));
      }
    } catch {
      // Offline: the server-side onDisconnect removes the presence; stale rooms are cleaned up later.
    }
  }
}
