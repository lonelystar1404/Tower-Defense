/**
 * Online rooms on Firebase (Realtime Database + anonymous sign-in). Loaded on demand (dynamic
 * import), so the Firebase SDK is only downloaded by players who open online multiplayer.
 *
 * Data, under /rooms/{CODE} (rules in database.rules.json):
 *   meta     { host, level, seed, status: 'lobby'|'playing', v, created, paused?, order?, heroes?, members? }
 *   players/{uid}  { member, hero, joined }   (removed when that player disconnects)
 *   inbox/{push}   { u: uid, c: Command }    (clients → host; the host deletes each after reading)
 *   turns/{n}      Turn                      (host → everyone; pruned after each checkpoint)
 *   checks/{wave}  Check                     (host → everyone; wave-end snapshots)
 * The host's disconnect deletes the whole room, so nothing is left behind.
 */
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getDatabase, ref, get, set, update, push, remove, onValue, onChildAdded, onDisconnect, serverTimestamp,
  query, orderByKey, limitToLast, type Database, type DatabaseReference, type Unsubscribe,
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
export const PROTOCOL = 1;
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
  /** Set when the game starts: player uids in slot order, their heroes and MemberIds. */
  order?: string[];
  heroes?: HeroId[];
  members?: string[];
}

export interface RoomPlayer {
  uid: string;
  member: string;
  hero: HeroId | null;
  joined: number;
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

/** A room this device is in (lobby or game). */
export class Room {
  private unsubs: Unsubscribe[] = [];
  private closed = false;

  private constructor(
    private readonly db: Database,
    readonly uid: string,
    readonly code: string,
    readonly isHost: boolean,
  ) {}

  private r(path = ''): DatabaseReference {
    return ref(this.db, `rooms/${this.code}${path ? `/${path}` : ''}`);
  }

  /** Creates a room for `level` with this device as host. */
  static async create(level: string, member: string): Promise<Room> {
    const { db, uid } = await connect();
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      const room = new Room(db, uid, code, true);
      try {
        if ((await get(room.r('meta'))).exists()) continue;
        const seed = crypto.getRandomValues(new Uint32Array(1))[0] >>> 1;
        const meta: RoomMeta & { created: object } = { host: uid, level, seed, status: 'lobby', v: PROTOCOL, created: serverTimestamp() };
        await set(room.r('meta'), meta);
        await set(room.r(`players/${uid}`), { member, hero: null, joined: serverTimestamp() });
        // The host leaving (or losing connection) closes the room and deletes its data.
        await onDisconnect(room.r()).remove();
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
    const room = new Room(db, uid, code, false);
    try {
      const meta = (await get(room.r('meta'))).val() as RoomMeta | null;
      if (!meta) throw new OnlineFailure('not-found');
      if (meta.v !== PROTOCOL) throw new OnlineFailure('version');
      const isHost = meta.host === uid;
      const joined = new Room(db, uid, code, isHost);
      if (meta.status === 'playing') {
        if (!meta.order?.includes(uid)) throw new OnlineFailure('started');
      } else {
        const players = (await get(room.r('players'))).val() as Record<string, unknown> | null;
        if (players && !(uid in players) && Object.keys(players).length >= PARTY.maxPlayers) throw new OnlineFailure('full');
      }
      await set(joined.r(`players/${uid}`), { member, hero: meta.heroes?.[meta.order?.indexOf(uid) ?? -1] ?? null, joined: serverTimestamp() });
      await onDisconnect(joined.r(isHost ? '' : `players/${uid}`)).remove();
      return joined;
    } catch (e) {
      if (e instanceof OnlineFailure) throw e;
      throw new OnlineFailure(String(e).includes('PERMISSION_DENIED') ? 'setup' : 'network', String(e));
    }
  }

  /** Calls back with the room (meta and players) whenever it changes; meta null = room closed. */
  watch(cb: (state: RoomState) => void): void {
    const state: RoomState = { meta: null, players: [] };
    let gotMeta = false;
    this.unsubs.push(
      onValue(this.r('meta'), (s) => {
        gotMeta = true;
        state.meta = s.val() as RoomMeta | null;
        cb({ ...state });
      }),
      onValue(this.r('players'), (s) => {
        const val = (s.val() ?? {}) as Record<string, Omit<RoomPlayer, 'uid'>>;
        state.players = Object.entries(val)
          .map(([uid, p]) => ({ uid, member: p.member, hero: p.hero ?? null, joined: typeof p.joined === 'number' ? p.joined : Date.now() }))
          .sort((a, b) => a.joined - b.joined || (a.uid < b.uid ? -1 : 1));
        if (gotMeta) cb({ ...state });
      }),
    );
  }

  pickHero(hero: HeroId | null): Promise<void> {
    return set(this.r(`players/${this.uid}/hero`), hero);
  }

  /** Host: starts the game with the players present, in join order (host first). */
  async start(state: RoomState): Promise<void> {
    if (!this.isHost || !state.meta) return;
    const players = [...state.players].sort((a, b) => (a.uid === this.uid ? -1 : b.uid === this.uid ? 1 : 0));
    const heroes = players.map((p) => p.hero);
    if (players.length < PARTY.minPlayers || players.length > PARTY.maxPlayers) return;
    if (heroes.some((h) => !h || !(h in HEROES)) || new Set(heroes).size !== heroes.length) return;
    await update(this.r('meta'), { status: 'playing', order: players.map((p) => p.uid), heroes, members: players.map((p) => p.member) });
  }

  setPaused(paused: boolean): void {
    if (this.isHost) void update(this.r('meta'), { paused }).catch(() => {});
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

  /** The lockstep transport for this room, with `order` = player uids in slot order. */
  transport(order: string[]): NetTransport {
    const room = this;
    let pruned = -1;
    let lastWave = 0;
    return {
      isHost: this.isHost,
      sendCommand(cmd: Command) {
        void push(room.r('inbox'), { u: room.uid, c: cmd }).catch(() => {});
      },
      onCommand(cb) {
        room.unsubs.push(
          onChildAdded(room.r('inbox'), (s) => {
            const v = s.val() as { u?: string; c?: Command } | null;
            void remove(s.ref).catch(() => {});
            const player = v?.u ? order.indexOf(v.u) : -1;
            if (player > 0 && v?.c) cb(player, v.c);
          }),
        );
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

  /** Leaves: the host's leaving deletes the room; a player's removes just them. */
  async leave(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const u of this.unsubs) u();
    this.unsubs = [];
    try {
      if (this.isHost) {
        await onDisconnect(this.r()).cancel();
        await remove(this.r());
      } else {
        await onDisconnect(this.r(`players/${this.uid}`)).cancel();
        await remove(this.r(`players/${this.uid}`));
      }
    } catch {
      // Offline: the server-side onDisconnect cleans up instead.
    }
  }
}
