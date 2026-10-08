import './style.css';
import { LEVELS, type LevelDef } from './data/levels';
import type { ElementId } from './data/elements';
import { BUILD_ELEMENTS, BUILD_WEAPONS } from './data/towers';
import type { WeaponId } from './data/weapons';
import type { Tower } from './entities/Tower';
import { Game } from './game/Game';
import { Renderer, type ViewState } from './render/Renderer';
import { TARGET_PRIORITIES } from './systems/targeting';
import { ELEMENT_KEYS, Hud } from './ui/Hud';
import { HeroBar } from './ui/HeroBar';
import { ABILITY_KEYS, HEROES, type HeroId } from './data/hero';
import { HeroSelect, lastHero } from './ui/HeroSelect';
import { Sound } from './audio/Sound';
import { MapMenu } from './ui/MapMenu';
import { isHeroUnlocked, loadProgress, markCleared } from './ui/progress';
import { dailyChallenge, dailyScore, type DailyChallenge } from './game/daily';
import { clearRun, DAILY_SLOT, loadRun, recordDaily, saveRun, type SaveSlot } from './ui/saves';
import { getLang, initialLang, LANGS, setLang, t, type Lang } from './i18n';

setLang(initialLang(), false);

/** Fixed simulation step, so game speed and frame rate don't change outcomes. */
const STEP = 1 / 60;

const canvas = document.getElementById('game') as HTMLCanvasElement;
let level = LEVELS[0];
/** Hero used on hero maps; kept across restarts. */
let heroId: HeroId = lastHero();
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
const view: ViewState & { element: ElementId; speed: number; paused: boolean } = {
  element: 'fire',
  hover: null,
  pointer: null,
  heroSelected: false,
  aiming: null,
  buildChoice: null,
  selected: null,
  speed: 1,
  paused: false,
};

const renderer = new Renderer(canvas);
const sound = new Sound();
const muteButton = document.getElementById('mute') as HTMLButtonElement;

// Browsers only allow audio after the player interacts with the page.
for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, () => sound.unlock(), { capture: true });

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
  startWave: () => game.startWave(),
  chooseWeapon,
  chooseElement,
  sellSelected,
  upgradeSelected,
  cyclePriority: () => {
    const t = view.selected;
    if (!t) return;
    t.priority = TARGET_PRIORITIES[(TARGET_PRIORITIES.indexOf(t.priority) + 1) % TARGET_PRIORITIES.length];
  },
  setSpeed: (speed) => {
    view.speed = speed;
    view.paused = false;
  },
  togglePause: () => {
    view.paused = !view.paused;
  },
  restart: () => restartRun(),
  restartGame: () => {
    const inProgress = game.wavesStarted > 0 && !game.over;
    if (inProgress && !window.confirm(t('Restart {map} from wave 1? This run will be lost.', { map: t(level.name) }))) return;
    restartRun();
  },
  openMaps: () => {
    persist();
    menu.show(progress, true);
  },
  share: () => shareResult(),
  nextMap: () => {
    const next = LEVELS[LEVELS.indexOf(level) + 1];
    if (next) playLevel(next);
  },
});

const heroBar = new HeroBar(document.getElementById('hero-bar')!, {
  selectHero,
  useAbility,
});

function selectHero(): void {
  if (!game.hero) return;
  view.heroSelected = !view.heroSelected;
  view.selected = null;
  view.buildChoice = null;
}

/** Self and global abilities fire at once; point abilities wait for a click on the map. */
function useAbility(slot: number): void {
  if (!game.hero) return;
  if (!game.heroAbilityReady(slot)) {
    sound.play('denied');
    return;
  }
  const def = game.hero.ability(slot);
  if (def.target !== 'point') {
    game.castHero(slot);
    return;
  }
  view.aiming = view.aiming === slot ? null : slot;
  view.buildChoice = null;
  view.selected = null;
}

/** Picking a map for a new run: hero maps go through hero select first. */
function pickLevel(next: LevelDef): void {
  menu.hide();
  if (next.heroStart) heroSelect.show(next, (id) => isHeroUnlocked(HEROES[id], progress));
  else startLevel(next);
}

/** A new run on `next` replaces its saved one, after asking. */
function playLevel(next: LevelDef): void {
  const save = loadRun(next.id);
  if (save && !window.confirm(t('Start a new run on {map}? Your saved run (wave {n}) will be lost.', { map: t(next.name), n: save.snapshot.wavesStarted + 1 }))) return;
  pickLevel(next);
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
  (next, hero) => {
    heroId = hero;
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
  const fresh = daily ? new Game(next, Math.random, daily.hero, { conditionsSeed: daily.seed }) : new Game(next, Math.random, heroId);
  const slot = daily ? DAILY_SLOT : next.id;
  clearRun(slot);
  resume(fresh, { slot, daily });
}

/** Switches to `next` (new or restored) in `where`, with a clean UI state. */
function resume(next: Game, where: typeof run): void {
  game = next;
  level = next.level;
  run = where;
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
  const snapshot = game.snapshot();
  if (!snapshot) return;
  saveRun(run.slot, { snapshot, date: run.daily?.date });
  savedWave = game.wavesStarted;
}
// Closing or hiding the tab keeps towers built since the last clear.
window.addEventListener('pagehide', persist);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') persist();
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
    location.href.split('#')[0],
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
  if (view.selected && !game.upgrade(view.selected)) sound.play('denied');
}

function sellSelected(): void {
  if (!view.selected) return;
  game.sell(view.selected);
  view.selected = null;
}

function tileAt(ev: MouseEvent): { col: number; row: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    col: Math.floor(((ev.clientX - rect.left) / rect.width) * game.level.cols),
    row: Math.floor(((ev.clientY - rect.top) / rect.height) * game.level.rows),
  };
}

canvas.addEventListener('mousemove', (ev) => {
  view.hover = tileAt(ev);
  view.pointer = pointerAt(ev);
});
canvas.addEventListener('mouseleave', () => {
  view.hover = null;
  view.pointer = null;
});
// Right-click cancels whatever is in progress; otherwise it walks the hero there.
canvas.addEventListener('contextmenu', (ev) => {
  ev.preventDefault();
  if (view.aiming !== null || view.buildChoice) {
    view.aiming = null;
    view.buildChoice = null;
    return;
  }
  if (game.hero) {
    const p = pointerAt(ev);
    game.moveHero(p.x, p.y);
    return;
  }
  view.selected = null;
});
canvas.addEventListener('click', (ev) => {
  const { col, row } = tileAt(ev);
  const p = pointerAt(ev);
  if (view.aiming !== null) {
    if (game.castHero(view.aiming, p.x, p.y)) view.aiming = null;
    else sound.play('denied');
    return;
  }
  const hero = game.hero;
  if (hero && !view.buildChoice && Math.hypot(p.x - hero.x, p.y - hero.y) < 0.55) {
    selectHero();
    return;
  }
  if (hero && view.heroSelected && !view.buildChoice && !game.towerAt(col, row)) {
    game.moveHero(p.x, p.y);
    return;
  }
  const existing = game.towerAt(col, row);
  if (existing) {
    view.selected = existing;
    view.buildChoice = null;
    view.heroSelected = false;
    return;
  }
  if (view.buildChoice) {
    const built: Tower | null = game.build(col, row, view.buildChoice);
    if (!built) sound.play('denied');
    // Shift-click keeps the build tool active for placing several towers.
    if (built && !ev.shiftKey) view.buildChoice = null;
    return;
  }
  view.selected = null;
});

window.addEventListener('keydown', (ev) => {
  if (ev.target instanceof HTMLInputElement || ev.metaKey || ev.ctrlKey || ev.altKey) return;
  if (menu.open || heroSelect.open) return;
  if (ev.code === 'Space') {
    ev.preventDefault();
    game.startWave();
  } else if (ev.key === 'Escape') {
    view.buildChoice = null;
    view.selected = null;
    view.aiming = null;
    view.heroSelected = false;
  } else if (ev.key === 's' || ev.key === 'S') {
    sellSelected();
  } else if (ev.key === 'u' || ev.key === 'U') {
    upgradeSelected();
  } else if (ev.key === 'm' || ev.key === 'M') {
    toggleMute();
  } else if (ev.key === 'h' || ev.key === 'H') {
    selectHero();
  } else if ((ABILITY_KEYS as readonly string[]).includes(ev.key.toUpperCase())) {
    useAbility((ABILITY_KEYS as readonly string[]).indexOf(ev.key.toUpperCase()));
  } else if (ev.key === 'p' || ev.key === 'P') {
    view.paused = !view.paused;
  } else if (/^[1-9]$/.test(ev.key)) {
    const weapon = BUILD_WEAPONS[Number(ev.key) - 1];
    if (weapon) chooseWeapon(weapon);
  } else {
    const i = ELEMENT_KEYS.indexOf(ev.key.toUpperCase() as (typeof ELEMENT_KEYS)[number]);
    if (i >= 0) chooseElement(BUILD_ELEMENTS[i]);
  }
});

// Debug handle for the browser console in dev builds only, e.g. `__td.game.gold = 9999`, `__td.sound`.
if (import.meta.env.DEV) Object.assign(window, { __td: { get game() { return game; }, sound } });

let last = performance.now();
let acc = 0;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!view.paused && !menu.open && !heroSelect.open) {
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
    clearRun(run.slot);
    if (run.daily) hud.setDailyBest(recordDaily(run.daily.date, dailyScore(game)));
    else if (game.phase === 'won') progress = markCleared(progress, level.id);
  } else if (game.phase === 'build' && game.wavesStarted > savedWave) {
    persist();
  }
  for (const id of game.drainSounds()) sound.play(id);
  renderer.draw(game, view);
  hud.update(game, view);
  heroBar.update(game, view.aiming, view.heroSelected);
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
  const k = (key: string) => `<kbd>${key}</kbd>`;
  document.getElementById('help')!.innerHTML =
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
