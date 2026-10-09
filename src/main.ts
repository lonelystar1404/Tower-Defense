import './style.css';
import { LEVELS, type LevelDef } from './data/levels';
import type { ElementId } from './data/elements';
import { BUILD_ELEMENTS, BUILD_WEAPONS, towerCost } from './data/towers';
import type { WeaponId } from './data/weapons';
import { Game } from './game/Game';
import { Renderer, type ViewState } from './render/Renderer';
import { ELEMENT_KEYS, Hud } from './ui/Hud';
import { HeroBar } from './ui/HeroBar';
import { ABILITY_KEYS, HERO_IDS, HEROES, type HeroId } from './data/hero';
import { HeroSelect, lastHero } from './ui/HeroSelect';
import { Sound } from './audio/Sound';
import { MapMenu } from './ui/MapMenu';
import { initTooltips } from './ui/tooltip';
import { PartyBar } from './ui/PartyBar';
import { memberId } from './platform/member';
import { applyCommand, roundPos, type Command } from './net/commands';
import type { Lockstep, RoomSetup } from './net/lockstep';
import type { Room, RoomMeta, RoomState, OnlineError } from './net/online';
import { Lobby } from './ui/Lobby';
import { isHeroUnlocked, loadProgress, markCleared } from './ui/progress';
import { dailyChallenge, dailyScore, type DailyChallenge } from './game/daily';
import { clearRun, DAILY_SLOT, loadRun, recordDaily, recordMapBest, saveRun, type SaveSlot } from './ui/saves';
import { getLang, initialLang, LANGS, setLang, t, type Lang } from './i18n';
import { backupNativeStorage, restoreNativeStorage } from './platform/nativeStorage';
import { SCORE } from './data/score';

// iOS app: bring back saves the web view may have lost (no-op in a browser).
await restoreNativeStorage();
setLang(initialLang(), false);

/** Fixed simulation step, so game speed and frame rate don't change outcomes. */
const STEP = 1 / 60;

const canvas = document.getElementById('game') as HTMLCanvasElement;
let level = LEVELS[0];
/** Hero used on hero maps; kept across restarts. */
let heroId: HeroId = lastHero();
/** Multiplayer: the party's heroes (one per player, P1 first); null for single-player. Kept across restarts. */
let party: HeroId[] | null = null;
let progress = loadProgress();
/** Set once the current game's end (win or loss) has been handled, so it's recorded only once. */
let endRecorded = false;
/**
 * Where the current run is saved: the map's id, or the daily slot (with today's challenge).
 * Runs are saved after every cleared wave and when the page is hidden or the map menu opens.
 */
let run: { slot: SaveSlot; daily: DailyChallenge | null } = { slot: LEVELS[0].id, daily: null };
/** Waves cleared when the run was last saved, so each clear is saved once. */
let savedWave = 0;

let game = new Game(level);
const view: ViewState & { element: ElementId; speed: number; paused: boolean; touch: boolean } = {
  element: 'fire',
  hover: null,
  pointer: null,
  heroSelected: false,
  aiming: null,
  buildChoice: null,
  selected: null,
  speed: 1,
  paused: false,
  /** Last input on the map was touch (or pen), not a mouse. */
  touch: false,
  /** The player using this screen. On a shared device, tapping a player's chip (or hero/tower) switches. */
  player: 0,
};

/** The hero of the player using this screen. */
const myHero = () => game.players[view.player]?.hero ?? null;

/** Plays as `player` on a shared device (multiplayer); drops aiming and hero selection. Online, you're always your own player. */
function setPlayer(player: number): void {
  if (online || player === view.player || !game.players[player]) return;
  view.player = player;
  view.aiming = null;
  view.heroSelected = false;
  sound.play('click');
}

const renderer = new Renderer(canvas);
const sound = new Sound();
const muteButton = document.getElementById('mute') as HTMLButtonElement;

// Browsers only allow audio after the player interacts with the page.
for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, () => sound.unlock(), { capture: true });
window.addEventListener('pointerdown', (ev) => (view.touch = ev.pointerType !== 'mouse'), { capture: true });

function toggleMute(): void {
  sound.setMuted(!sound.muted);
  updateMuteButton();
}

function updateMuteButton(): void {
  muteButton.classList.toggle('muted', sound.muted);
  muteButton.setAttribute('aria-pressed', String(sound.muted));
  const label = sound.muted ? t('Unmute sound [M]') : t('Mute sound [M]');
  muteButton.title = label;
  muteButton.setAttribute('aria-label', label);
}
muteButton.addEventListener('click', toggleMute);
updateMuteButton();
const hud = new Hud({
  startWave: () => {
    if (game.phase === 'build') act({ k: 'ready' });
  },
  chooseWeapon,
  chooseElement,
  sellSelected,
  upgradeSelected,
  cancelTool,
  closeInfo: () => {
    view.selected = null;
    view.heroSelected = false;
  },
  cyclePriority: () => {
    const t = view.selected;
    if (!t) return;
    if (t.owner !== view.player) return sound.play('denied');
    act({ k: 'prio', c: t.col, r: t.row });
  },
  setSpeed: (speed) => {
    if (online?.session) return online.room.setSpeed(speed);
    view.speed = speed;
    view.paused = false;
  },
  togglePause,
  restart: () => restartRun(),
  restartGame: () => {
    const inProgress = game.wavesStarted > 0 && !game.over;
    if (inProgress && !window.confirm(t('Restart {map} from wave 1? This run will be lost.', { map: t(level.name) }))) return;
    restartRun();
  },
  openMaps: () => {
    if (online) {
      if (!game.over && !window.confirm(t('Leave the online room? The game goes on without you.'))) return;
      void leaveOnline();
      menu.show(progress, false);
      return;
    }
    persist();
    menu.show(progress, true);
  },
  share: () => shareResult(),
  nextMap: () => {
    const next = LEVELS[LEVELS.indexOf(level) + 1];
    if (next) playLevel(next);
  },
});

const partyBar = new PartyBar(document.getElementById('party-bar')!, setPlayer);
const heroBar = new HeroBar(document.getElementById('hero-bar')!, {
  selectHero,
  useAbility,
});

function selectHero(): void {
  if (!myHero()) return;
  view.heroSelected = !view.heroSelected;
  view.selected = null;
  view.buildChoice = null;
}

/** Self and global abilities fire at once; point abilities wait for a click on the map. */
function useAbility(slot: number): void {
  const hero = myHero();
  if (!hero) return;
  if (!game.heroAbilityReady(slot, view.player)) {
    sound.play('denied');
    return;
  }
  const def = hero.ability(slot);
  if (def.target !== 'point') {
    act({ k: 'cast', s: slot, x: 0, y: 0 });
    return;
  }
  view.aiming = view.aiming === slot ? null : slot;
  view.buildChoice = null;
  view.selected = null;
}

/**
 * Picking a map for a new run: random-hero maps roll one of the unlocked heroes; other hero
 * maps go through hero select first. Multiplayer maps pick a party of 2–5 (or one hero in
 * Single mode).
 */
function pickLevel(next: LevelDef, mode: 'single' | 'party' = 'party'): void {
  menu.hide();
  const unlocked = (id: HeroId) => isHeroUnlocked(HEROES[id], progress);
  if (next.multiplayer) return mode === 'party' ? lobby.choose(next, '', rejoinCode()) : heroSelect.show(next, unlocked, 'single');
  party = null;
  if (next.heroStart && next.heroMode === 'random') {
    const pool = HERO_IDS.filter((id) => isHeroUnlocked(HEROES[id], progress));
    heroId = pool[Math.floor(Math.random() * pool.length)] ?? 'vex';
    startLevel(next);
  } else if (next.heroStart) heroSelect.show(next, (id) => isHeroUnlocked(HEROES[id], progress));
  else startLevel(next);
}

/** A new run on `next` replaces its saved one, after asking. */
function playLevel(next: LevelDef, mode?: 'single' | 'party'): void {
  const save = loadRun(next.id);
  if (save && !window.confirm(t('Start a new run on {map}? Your saved run (wave {n}) will be lost.', { map: t(next.name), n: save.snapshot.wavesStarted + 1 }))) return;
  pickLevel(next, mode);
}

function resumeLevel(next: LevelDef): void {
  const save = loadRun(next.id);
  if (!save) return playLevel(next);
  resume(Game.restore(next, save.snapshot), { slot: next.id, daily: null });
}

/** Today's Daily Challenge: its map with its hero and seeded conditions, no hero select. */
function playDaily(resumeSaved: boolean): void {
  const daily = dailyChallenge();
  const save = loadRun(DAILY_SLOT, daily.date);
  if (resumeSaved && save) return resume(Game.restore(daily.level, save.snapshot), { slot: DAILY_SLOT, daily });
  if (save && !window.confirm(t('Start a new daily attempt? Your saved attempt (wave {n}) will be lost.', { n: save.snapshot.wavesStarted + 1 }))) return;
  startLevel(daily.level, daily);
}

/** Replays the current run from wave 1 (Reboot / ↻): the same map, or a new daily attempt. */
function restartRun(): void {
  if (run.daily) startLevel(run.daily.level, run.daily);
  else startLevel(level);
}

const menu = new MapMenu(document.getElementById('menu')!, {
  play: playLevel,
  resume: resumeLevel,
  daily: playDaily,
  close: () => menu.hide(),
});
const heroSelect = new HeroSelect(
  document.getElementById('hero-select')!,
  (next, heroes) => {
    if (heroes.length > 1) party = heroes;
    else {
      heroId = heroes[0];
      party = null;
    }
    startLevel(next);
  },
  () => {
    heroSelect.hide();
    menu.show(progress, true);
  },
);

/**
 * Starts `next` from wave 1 with a fresh game (the chosen hero, or the daily's) and a clean UI
 * state. A fresh run replaces whatever was saved in its slot.
 */
function startLevel(next: LevelDef, daily: DailyChallenge | null = null): void {
  // Multiplayer on one device: every player here shares this device's MemberId as P1; the
  // others are local guests until online rooms give each their own.
  const options = party && next.multiplayer ? { party: { heroes: party, memberIds: [memberId()] } } : {};
  const fresh = daily ? new Game(next, Math.random, daily.hero, { conditionsSeed: daily.seed }) : new Game(next, Math.random, heroId, options);
  const slot = daily ? DAILY_SLOT : next.id;
  clearRun(slot);
  resume(fresh, { slot, daily });
}

/** Switches to `next` (new or restored) in `where`, with a clean UI state. */
function resume(next: Game, where: typeof run): void {
  game = next;
  level = next.level;
  run = where;
  view.player = 0;
  party = next.players.length > 1 ? next.heroes.map((h) => h.def.id) : party && next.level.multiplayer ? party : null;
  savedWave = next.wavesStarted;
  endRecorded = false;
  hud.setDaily(where.daily);
  view.buildChoice = null;
  view.selected = null;
  view.heroSelected = false;
  view.aiming = null;
  view.paused = false;
  menu.hide();
  heroSelect.hide();
}

/** Saves the run if it's between waves (see Game.snapshot). */
function persist(): void {
  if (online) return;
  const snapshot = game.snapshot();
  if (!snapshot) return;
  saveRun(run.slot, { snapshot, date: run.daily?.date });
  savedWave = game.wavesStarted;
  backupNativeStorage();
}
// Closing or hiding the tab (or leaving the iOS app) keeps towers built since the last clear,
// and settings changed since.
window.addEventListener('pagehide', () => {
  persist();
  backupNativeStorage();
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden') return;
  persist();
  backupNativeStorage();
});

/** Copies a daily result for friends (falls back to a prompt where the clipboard is blocked). */
function shareResult(): void {
  const daily = run.daily;
  if (!daily) return;
  const won = game.phase === 'won';
  const hero = game.hero ? ` · ${game.hero.def.callsign}` : '';
  const text = [
    `Neon Wardens ${t('Daily')} ${daily.date}`,
    `${t(daily.level.name)}${hero}`,
    won ? `✅ ${t('Won · {n} ♥ left', { n: game.lives })}` : `💥 ${t('Fell on wave {n}/{total}', { n: game.wavesStarted, total: game.totalWaves })}`,
    t('Score {score}', { score: dailyScore(game).toLocaleString() }),
    // Inside the iOS app the page lives at capacitor://localhost, which is no use to friends.
    ...(location.protocol.startsWith('http') ? [location.href.split('#')[0]] : []),
  ].join('\n');
  navigator.clipboard?.writeText(text).then(
    () => hud.flashShared(),
    () => window.prompt(t('Copy your result:'), text),
  ) ?? window.prompt(t('Copy your result:'), text);
}

/** Pointer position in tile units (fractional). */
function pointerAt(ev: MouseEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((ev.clientX - rect.left) / rect.width) * game.level.cols,
    y: ((ev.clientY - rect.top) / rect.height) * game.level.rows,
  };
}

function chooseWeapon(weapon: WeaponId): void {
  const option = { weapon, element: view.element };
  if (game.isLocked(option)) {
    sound.play('denied');
    return;
  }
  view.buildChoice = view.buildChoice?.weapon === weapon ? null : option;
  view.selected = null;
  view.heroSelected = false;
  view.aiming = null;
  sound.play('click');
}

function chooseElement(element: ElementId): void {
  if (element !== view.element) sound.play('click');
  view.element = element;
  if (view.buildChoice) view.buildChoice = { ...view.buildChoice, element };
}

function upgradeSelected(): void {
  const tw = view.selected;
  if (!tw) return;
  const cost = game.nextUpgradeCost(tw);
  const ok = tw.owner === view.player && cost !== null && game.players[view.player].gold >= cost && !game.isLocked(tw);
  if (!ok || !act({ k: 'up', c: tw.col, r: tw.row })) sound.play('denied');
}

function sellSelected(): void {
  const tw = view.selected;
  if (!tw) return;
  if (tw.owner !== view.player || !act({ k: 'sell', c: tw.col, r: tw.row })) sound.play('denied');
  view.selected = null;
}

/**
 * Every action that changes the game goes through here: applied at once when playing on this
 * device, sent to the host in an online room (it comes back in a turn for everyone).
 */
function act(cmd: Command): boolean {
  if (online) {
    if (!online.session || game.over) return false;
    online.session.send(cmd);
    return true;
  }
  return applyCommand(game, view.player, cmd);
}

function moveMyHero(x: number, y: number): void {
  act({ k: 'move', x: roundPos(x), y: roundPos(y) });
}

function tileAt(ev: MouseEvent): { col: number; row: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    col: Math.floor(((ev.clientX - rect.left) / rect.width) * game.level.cols),
    row: Math.floor(((ev.clientY - rect.top) / rect.height) * game.level.rows),
  };
}

/**
 * Touch has no hover, so the build preview and ability aim follow taps instead: the first tap
 * shows the preview there, a second tap on the same spot confirms. A long press stands in for
 * right-click. Mouse input is unchanged.
 */
/** How close (in tiles) a second tap must be to the first to confirm an aimed ability. */
const AIM_CONFIRM = 0.75;
const LONG_PRESS_MS = 500;
let longPress: { timer: number; x: number; y: number } | null = null;
/** Set when a long press fired, so the click that follows the finger lifting is ignored. */
let swallowClick = false;

function cancelTool(): void {
  view.aiming = null;
  view.buildChoice = null;
  view.hover = null;
  view.pointer = null;
}

/** Right-click (or long press): cancel whatever is in progress, else walk the hero there. */
function secondaryAction(p: { x: number; y: number }): void {
  if (view.aiming !== null || view.buildChoice) {
    cancelTool();
    return;
  }
  if (myHero()) {
    moveMyHero(p.x, p.y);
    return;
  }
  view.selected = null;
}

function endLongPress(): void {
  if (longPress) clearTimeout(longPress.timer);
  longPress = null;
}

canvas.addEventListener('pointerdown', (ev) => {
  if (ev.pointerType === 'mouse') return;
  endLongPress();
  const p = pointerAt(ev);
  longPress = {
    x: ev.clientX,
    y: ev.clientY,
    timer: window.setTimeout(() => {
      longPress = null;
      swallowClick = true;
      secondaryAction(p);
      sound.play('click');
    }, LONG_PRESS_MS),
  };
});
canvas.addEventListener('pointermove', (ev) => {
  if (ev.pointerType === 'mouse') {
    view.hover = tileAt(ev);
    view.pointer = pointerAt(ev);
  } else if (longPress && Math.hypot(ev.clientX - longPress.x, ev.clientY - longPress.y) > 10) endLongPress();
});
for (const type of ['pointerup', 'pointercancel'] as const) canvas.addEventListener(type, endLongPress);
canvas.addEventListener('pointerleave', (ev) => {
  if (ev.pointerType !== 'mouse') return;
  view.hover = null;
  view.pointer = null;
});
canvas.addEventListener('contextmenu', (ev) => {
  ev.preventDefault();
  // A long press already handled it (some browsers also send contextmenu for one).
  if (view.touch) return;
  secondaryAction(pointerAt(ev));
});
canvas.addEventListener('click', (ev) => {
  if (swallowClick) {
    swallowClick = false;
    return;
  }
  const { col, row } = tileAt(ev);
  const p = pointerAt(ev);
  const touch = view.touch;
  // Touch: remember the previous tap's preview, then clear it unless this tap previews again.
  const previewTile = view.hover;
  const previewPoint = view.pointer;
  if (touch) {
    view.hover = null;
    view.pointer = null;
  }
  if (view.aiming !== null) {
    if (touch && !(previewPoint && Math.hypot(previewPoint.x - p.x, previewPoint.y - p.y) <= AIM_CONFIRM)) {
      view.pointer = p;
      return;
    }
    const hero = myHero();
    const reach = hero ? hero.ability(view.aiming).castRange : 0;
    if (hero && game.heroAbilityReady(view.aiming, view.player) && Math.hypot(p.x - hero.x, p.y - hero.y) <= reach) {
      act({ k: 'cast', s: view.aiming, x: roundPos(p.x), y: roundPos(p.y) });
      view.aiming = null;
    } else {
      sound.play('denied');
      if (touch) view.pointer = p;
    }
    return;
  }
  // Tapping a hero selects it (on a shared device, another player's hero switches to them).
  const tapped = view.buildChoice ? undefined : game.heroes.find((h) => Math.hypot(p.x - h.x, p.y - h.y) < 0.55 && (!online || h.player === view.player));
  if (tapped) {
    if (tapped.player !== view.player) setPlayer(tapped.player);
    selectHero();
    return;
  }
  const hero = myHero();
  if (hero && view.heroSelected && !view.buildChoice && !game.towerAt(col, row)) {
    moveMyHero(p.x, p.y);
    return;
  }
  const existing = game.towerAt(col, row);
  if (existing) {
    // On a shared device, selecting another player's tower plays as its owner (their gold).
    if (existing.owner !== view.player) setPlayer(existing.owner);
    view.selected = existing;
    view.buildChoice = null;
    view.heroSelected = false;
    return;
  }
  if (view.buildChoice) {
    if (touch && !(previewTile && previewTile.col === col && previewTile.row === row)) {
      view.hover = { col, row };
      view.pointer = p;
      return;
    }
    const choice = view.buildChoice;
    const affordable = game.players[view.player].gold >= towerCost(choice);
    const built = game.canBuild(col, row) && affordable && !game.isLocked(choice) && act({ k: 'build', c: col, r: row, w: choice.weapon, e: choice.element });
    if (!built) {
      sound.play('denied');
      if (touch) view.hover = { col, row };
    }
    // Shift-click keeps the build tool active for placing several towers.
    if (built && !ev.shiftKey) view.buildChoice = null;
    return;
  }
  view.selected = null;
});

window.addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (menu.open || heroSelect.open || lobby.open) return;
  if (ev.code === 'Space') {
    ev.preventDefault();
    if (game.phase === 'build') act({ k: 'ready' });
  } else if (ev.key === 'Escape') {
    cancelTool();
    view.selected = null;
    view.heroSelected = false;
  } else if (ev.key === 's' || ev.key === 'S') {
    sellSelected();
  } else if (ev.key === 'u' || ev.key === 'U') {
    upgradeSelected();
  } else if (ev.key === 'm' || ev.key === 'M') {
    toggleMute();
  } else if (ev.key === 'h' || ev.key === 'H') {
    selectHero();
  } else if (ev.key === 'Tab' && game.players.length > 1) {
    // Multiplayer on one device: next player
    ev.preventDefault();
    setPlayer((view.player + 1) % game.players.length);
  } else if ((ABILITY_KEYS as readonly string[]).includes(ev.key.toUpperCase())) {
    useAbility((ABILITY_KEYS as readonly string[]).indexOf(ev.key.toUpperCase()));
  } else if (ev.key === 'p' || ev.key === 'P') {
    togglePause();
  } else if (/^[1-9]$/.test(ev.key)) {
    const weapon = BUILD_WEAPONS[Number(ev.key) - 1];
    if (weapon) chooseWeapon(weapon);
  } else {
    const i = ELEMENT_KEYS.indexOf(ev.key.toUpperCase() as (typeof ELEMENT_KEYS)[number]);
    if (i >= 0) chooseElement(BUILD_ELEMENTS[i]);
  }
});

// --- Online rooms ---------------------------------------------------------------------------

/**
 * An online room this device is in. The Firebase code (src/net/online.ts) is loaded the first
 * time someone opens online play. `session` exists once the host starts the game.
 */
let online: {
  mod: typeof import('./net/online');
  room: Room;
  level: LevelDef;
  state: RoomState | null;
  session: Lockstep | null;
  /** Which players (by slot) are connected. */
  present: boolean[];
  /** Real time (s) this device has been waiting for the next turn. */
  waiting: number;
  starting: boolean;
  /** Real time (s) the clock player has been disconnected (another takes over after CLOCK_GRACE). */
  clockGone: number;
  /** A takeover or step-down is being set up. */
  switching: boolean;
  /** The clock cleared the room's game data after the game ended. */
  cleared: boolean;
  /** The host's last heartbeat value and when (performance.now) this device saw it change. */
  lastBeat: number | undefined;
  beatAt: number;
  /** When this device last wrote its own heartbeat (as host). */
  beatSent: number;
  /** The lobby as last drawn (it's redrawn only when something besides the heartbeat changes). */
  lobbyKey: string;
  /** Lobby host: seconds everyone has been ready (the game starts after READY_DELAY). */
  allReady: number;
} | null = null;

/** Seconds the clock player may be gone before the next player takes over. */
const CLOCK_GRACE = 3;
/** Countdown (s) once everyone is ready; anyone un-readying stops it. */
const READY_DELAY = 5;

const ROOM_KEY = 'td-room';
/** How long after leaving a room the chooser offers to rejoin it. */
const REJOIN_MS = 3 * 60 * 60 * 1000;

function rememberRoom(code: string | null): void {
  try {
    if (code) localStorage.setItem(ROOM_KEY, JSON.stringify({ code, at: Date.now() }));
    else localStorage.removeItem(ROOM_KEY);
  } catch {
    // Storage blocked: no rejoin offer.
  }
}

/** The room this device was last in, if recent (offered as Rejoin). */
function rejoinCode(): string | undefined {
  try {
    const r = JSON.parse(localStorage.getItem(ROOM_KEY) ?? 'null') as { code?: string; at?: number } | null;
    return r?.code && Date.now() - (r.at ?? 0) < REJOIN_MS ? r.code : undefined;
  } catch {
    return undefined;
  }
}

function onlineErrorText(reason: OnlineError): string {
  switch (reason) {
    case 'setup':
      return t('Online play isn’t switched on for this game yet. Try again later.');
    case 'not-found':
      return t('No room with that code. Check it and try again.');
    case 'full':
      return t('That room is full (5 players).');
    case 'started':
      return t('That game has already started.');
    case 'version':
      return t('That room is on a different version of the game. Update and try again.');
    default:
      return t('Can’t reach the server. Check your connection and try again.');
  }
}

async function enterRoom(level: LevelDef, open: (mod: typeof import('./net/online')) => Promise<Room>): Promise<void> {
  lobby.busy(t('Connecting…'));
  try {
    const mod = await import('./net/online');
    const room = await open(mod);
    online = {
      mod, room, level, state: null, session: null, present: [], waiting: 0, starting: false, clockGone: 0, switching: false, cleared: false,
      lastBeat: undefined, beatAt: performance.now(), beatSent: 0, lobbyKey: '', allReady: 0,
    };
    rememberRoom(room.code);
    room.watch((state) => onRoomState(state));
    room.watchChat((messages) => lobby.setChat(messages));
  } catch (e) {
    const reason = (e as { reason?: OnlineError }).reason ?? 'network';
    console.warn('Online:', e);
    lobby.choose(level, onlineErrorText(reason), rejoinCode());
  }
}

function onRoomState(state: RoomState): void {
  const o = online;
  if (!o) return;
  o.state = state;
  const meta = state.meta;
  if (!meta) {
    // The room was deleted (everyone else left long ago, or it was cleaned up).
    if (o.session && !o.session.game.over) setNetStatus(t('The room was closed.'));
    else if (!o.session) lobby.choose(o.level, t('The room was closed.'));
    rememberRoom(null);
    void o.room.leave();
    hud.setOnline(null);
    online = null;
    return;
  }
  if (meta.beat !== o.lastBeat) {
    o.lastBeat = meta.beat;
    o.beatAt = performance.now();
  }
  if (meta.status === 'lobby') {
    const { beat: _beat, ...rest } = meta;
    const key = JSON.stringify([rest, state.players]);
    if (key !== o.lobbyKey) {
      o.lobbyKey = key;
      lobby.showRoom(o.room.code, o.room.uid, o.room.isHost, state);
    }
    return;
  }
  if (meta.order) o.present = meta.order.map((uid) => state.players.some((p) => p.uid === uid));
  // Pause and speed are shared: whoever changes them, everyone follows.
  view.paused = !!meta.paused;
  view.speed = meta.speed ?? 1;
  if (!o.session) {
    if (!o.starting) void startOnline(meta);
    return;
  }
  // This device was made the clock (it took over, or rejoined as the host): continue the turns.
  if (meta.host === o.room.uid && !o.session.clock && !o.switching) void takeOver(o);
  // Someone else is the clock now (this device dropped out and was replaced): its last turns may
  // never have reached the others, so rebuild from the latest checkpoint and follow.
  if (meta.host !== o.room.uid && o.session.clock && !o.switching) {
    o.session.stepDown();
    o.session = null;
    void startOnline(meta);
  }
}

/** Becomes the clock: run every turn the old clock published, then publish from there. */
async function takeOver(o: NonNullable<typeof online>): Promise<void> {
  o.switching = true;
  try {
    const last = await o.room.lastTurn();
    o.session?.handover(last);
  } finally {
    o.switching = false;
  }
}

/**
 * Every frame online: if the clock player has been gone for a while, the lowest-numbered player
 * still here claims the clock (a transaction, so only one wins).
 */
function watchClock(o: NonNullable<typeof online>, dt: number): void {
  const meta = o.state?.meta;
  const now = performance.now();
  // The host's heartbeat, even while paused (others treat a silent host as gone).
  if (meta && meta.host === o.room.uid && now - o.beatSent > o.mod.BEAT_MS) {
    o.beatSent = now;
    o.room.beat();
  }
  // Only a connected device can tell whether the host is gone (or take over).
  if (!o.room.connected) {
    o.clockGone = 0;
    return;
  }
  /** Host gone: no longer in the room for a few seconds, or silent past the timeout (e.g. a phone that lost signal). */
  const hostGone = () => {
    const hostHere = o.state!.players.some((p) => p.uid === meta!.host);
    o.clockGone = hostHere ? 0 : o.clockGone + dt;
    return o.clockGone >= CLOCK_GRACE || now - o.beatAt > o.mod.HOST_TIMEOUT_MS + 1000;
  };
  // Lobby: once everyone has picked and is ready, every screen counts down; the host starts the game at 0.
  if (meta && meta.status === 'lobby') {
    const before = o.allReady;
    // Counting up while everyone is ready (READY_DELAY = start); back to 0 if anyone un-readies.
    o.allReady = o.room.everyoneReady() ? Math.min(READY_DELAY, o.allReady + dt) : 0;
    const left = Math.ceil(READY_DELAY - o.allReady);
    lobby.setCountdown(o.allReady > 0 ? left : null);
    if (o.allReady > 0 && Math.ceil(READY_DELAY - before) !== left) sound.play(left === 0 ? 'tick-final' : 'tick');
    if (o.allReady >= READY_DELAY && before < READY_DELAY && meta.host === o.room.uid && o.state) void o.room.start(o.state);
  }
  // Lobby: if the host left, the first player still here becomes host.
  if (meta && meta.status === 'lobby' && !o.switching) {
    if (meta.host !== o.room.uid && hostGone() && o.state!.players.filter((p) => p.uid !== meta.host)[0]?.uid === o.room.uid) {
      o.switching = true;
      o.clockGone = 0;
      void o.room.claimClock(meta.host).finally(() => (o.switching = false));
    }
    return;
  }
  if (!meta?.order || !o.session || o.session.clock || o.switching || o.session.game.over) return;
  const hostSlot = meta.order.indexOf(meta.host);
  if (!hostGone() || hostSlot === view.player) return;
  // The first player (in slot order) who is still here, other than the old host, takes over.
  const firstHere = meta.order.findIndex((uid) => uid !== meta.host && o.state!.players.some((p) => p.uid === uid));
  if (firstHere !== view.player) return;
  o.switching = true;
  o.clockGone = 0;
  void o.room.claimClock(meta.host).finally(() => (o.switching = false));
}

/** The host started (or this device rejoined a game in progress): build the shared game. */
async function startOnline(meta: RoomMeta): Promise<void> {
  const o = online;
  if (!o || !meta.order || !meta.heroes) return;
  o.starting = true;
  const lvl = LEVELS.find((l) => l.id === meta.level) ?? o.level;
  const setup: RoomSetup = {
    level: lvl, seed: meta.seed, heroes: meta.heroes, memberIds: meta.members ?? [], names: meta.order.map((_, i) => `P${i + 1}`),
  };
  const slot = meta.order.indexOf(o.room.uid);
  // Every device starts as a follower from the latest checkpoint (none yet: from the start).
  const check = await o.room.latestCheck().catch(() => null);
  const { Lockstep } = await import('./net/lockstep');
  if (online !== o) return;
  o.session = new Lockstep(setup, o.room.transport(meta.order), slot, check ?? undefined);
  o.starting = false;
  lobby.hide();
  resume(o.session.game, { slot: 'online', daily: null });
  view.player = slot;
  view.speed = meta.speed ?? 1;
  view.paused = !!meta.paused;
  hud.setOnline({ code: o.room.code, host: true });
  // The room's host (creator at the start, or a rejoining clock nobody replaced) runs the clock.
  if (meta.host === o.room.uid) await takeOver(o);
}

/** Leaves the room; the game goes on for the others, and this player can rejoin with the code. */
async function leaveOnline(): Promise<void> {
  const o = online;
  online = null;
  rememberRoom(null);
  hud.setOnline(null);
  setNetStatus('');
  view.paused = false;
  if (o) await o.room.leave();
}

const netStatus = document.getElementById('net-status')!;
function setNetStatus(text: string): void {
  netStatus.hidden = !text;
  if (netStatus.textContent !== text) netStatus.textContent = text;
}

function togglePause(): void {
  // Online, anyone can pause; the room tells everyone (and the clock stops publishing turns).
  if (online?.session) return online.room.setPaused(!view.paused, view.player);
  view.paused = !view.paused;
}

const lobby = new Lobby(
  document.getElementById('lobby')!,
  {
    local: (lvl) => {
      lobby.hide();
      heroSelect.show(lvl, (id) => isHeroUnlocked(HEROES[id], progress), 'party');
    },
    create: (lvl) => void enterRoom(lvl, (mod) => mod.Room.create(lvl.id, memberId())),
    join: (lvl, text) => {
      const code = text.toUpperCase().replace(/[^0-9A-Z]/g, '');
      if (code.length !== 5) return lobby.choose(lvl, t('Enter the 5-character room code.'), rejoinCode());
      void enterRoom(lvl, (mod) => mod.Room.join(mod.normalizeCode(code), memberId()));
    },
    pickHero: (hero) => void online?.room.pickHero(hero).catch(() => {}),
    setReady: (ready) => void online?.room.setReady(ready).catch(() => {}),
    chat: (text) => online?.room.sendChat(text),
    back: () => {
      if (online) void leaveOnline();
      lobby.hide();
      menu.show(progress, false);
    },
  },
  memberId,
);

// Debug handle for the browser console in dev builds only, e.g. `__td.game.gold = 9999`, `__td.sound`.
if (import.meta.env.DEV) Object.assign(window, { __td: { get game() { return game; }, get session() { return online?.session ?? null; }, get online() { return online; }, sound } });

let last = performance.now();
let acc = 0;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const session = online?.session;
  if (online && session) {
    // Online: the lockstep session runs the game (it doesn't stop for menus: others keep playing).
    session.speed = view.speed;
    session.paused = view.paused;
    const advanced = session.frame(dt);
    online.waiting = advanced ? 0 : online.waiting + dt;
    watchClock(online, dt);
    if (session.game !== game) {
      // Resynced from a checkpoint: a new game object.
      game = session.game;
      view.selected = null;
    }
    if (game.over && session.clock && !online.cleared) {
      online.cleared = true;
      online.room.clearGameData();
    }
    const by = online.state?.meta?.pausedBy;
    setNetStatus(
      game.over
        ? ''
        : view.paused
          ? t('Paused by P{n}', { n: (by ?? 0) + 1 })
          : online.clockGone > 0 || performance.now() - online.beatAt > online.mod.HOST_TIMEOUT_MS
            ? t('A player disconnected: handing over the game…')
            : online.waiting > 1.5
              ? t('Waiting for the other players…')
              : '',
    );
  } else if (online) {
    watchClock(online, dt);
  } else if (!view.paused && !menu.open && !heroSelect.open && !lobby.open) {
    acc += dt * view.speed;
    while (acc >= STEP) {
      game.update(STEP);
      acc -= STEP;
    }
  }
  // A new lockdown (or switching element) can lock the tower being placed.
  if (view.buildChoice && game.isLocked(view.buildChoice)) view.buildChoice = null;
  if (game.over && !endRecorded) {
    endRecorded = true;
    if (!online) clearRun(run.slot);
    if (run.daily) hud.setDailyBest(recordDaily(run.daily.date, dailyScore(game)));
    else {
      if (game.phase === 'won') progress = markCleared(progress, level.id);
      const won = game.phase === 'won';
      hud.setMapBest(
        recordMapBest(level.id, {
          score: game.scoreTotal,
          lives: game.lives,
          waves: game.score.waves / SCORE.wave,
          won,
          hero: game.heroes.map((h) => h.def.callsign).join(' + ') || undefined,
        }),
      );
    }
    backupNativeStorage();
  } else if (game.phase === 'build' && game.wavesStarted > savedWave) {
    persist();
  }
  for (const id of game.drainSounds()) sound.play(id);
  renderer.draw(game, view);
  hud.update(game, view);
  heroBar.update(game, view.aiming, view.heroSelected, view.player);
  partyBar.update(game, view.player, online?.present);
  requestAnimationFrame(frame);
}
menu.show(progress, false);
requestAnimationFrame(frame);

// --- Language ---------------------------------------------------------------------------------

const langSelect = document.getElementById('lang') as HTMLSelectElement;
langSelect.innerHTML = LANGS.map((l) => `<option value="${l.id}">${l.label}</option>`).join('');

/** Text that lives in index.html, the help footer, and the page's language tag (fonts). */
function applyStaticText(): void {
  const lang = getLang();
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
  langSelect.value = lang;
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => (el.textContent = t(el.dataset.i18n!)));
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((el) => (el.title = t(el.dataset.i18nTitle!)));
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria!)));
  const help = document.getElementById('help')!;
  // Touch screens (phones, tablets): the tap flow instead of keyboard shortcuts.
  if (matchMedia('(pointer: coarse)').matches) {
    help.innerHTML = [
      t('Tap an element and a weapon, then tap an empty pad to preview it and tap again to build.'),
      t('Tap a tower to upgrade or sell it. Tap your hero, then tap the map to move; a long press also moves the hero or cancels.'),
    ].join('<br />');
    return;
  }
  const k = (key: string) => `<kbd>${key}</kbd>`;
  help.innerHTML =
    t('Pick an element ({elements}) and a weapon ({weapons}), then click an empty pad. Shift-click to build several.', {
      elements: `${k('Q')}–${k('T')}`,
      weapons: `${k('1')}–${k('6')}`,
    }) +
    '<br />' +
    [
      `${k('Space')} ${t('ready (next wave)')}`,
      `${k('Esc')} ${t('cancel')}`,
      `${k('U')} ${t('upgrade')}`,
      `${k('S')} ${t('sell')}`,
      `${k('P')} ${t('pause')}`,
      `${k('M')} ${t('mute')}`,
    ].join(' · ');
}

langSelect.addEventListener('change', () => {
  setLang(langSelect.value as Lang);
  applyStaticText();
  updateMuteButton();
  hud.relabel();
  menu.refresh();
  heroSelect.refresh();
});
applyStaticText();
initTooltips();
