import { ELEMENTS, type ElementId } from '../data/elements';
import { weakenedElement } from '../data/battlefields';
import { ENEMIES } from '../data/enemies';
import { LEVELS } from '../data/levels';
import { COMBOS } from '../data/combos';
import { describeEffect } from '../data/status';
import { combosFor } from '../data/combos';
import { BUILD_ELEMENTS, BUILD_WEAPONS, towerCost, towerName, type TowerOption } from '../data/towers';
import { WEAPONS, type WeaponId } from '../data/weapons';
import type { Tower } from '../entities/Tower';
import type { Game } from '../game/Game';
import { drawTower } from '../render/sprites';
import { InfoPanel, type InfoSubject } from './InfoPanel';

export interface HudActions {
  upgradeSelected(): void;
  startWave(): void;
  chooseWeapon(weapon: WeaponId): void;
  chooseElement(element: ElementId): void;
  sellSelected(): void;
  cyclePriority(): void;
  setSpeed(speed: number): void;
  togglePause(): void;
  restart(): void;
  /** Restart from the top bar (asks first if a run is in progress). */
  restartGame(): void;
  openMaps(): void;
  nextMap(): void;
}

export interface HudView {
  heroSelected: boolean;
  /** Element used for new towers. */
  element: ElementId;
  buildChoice: TowerOption | null;
  selected: Tower | null;
  speed: number;
  paused: boolean;
}

function $<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

/** Keeps the DOM sidebar and overlay in sync with the game. Writes only when text changes. */
export class Hud {
  private readonly lives = $('lives');
  private readonly gold = $('gold');
  private readonly wave = $('wave');
  private readonly startWave = $<HTMLButtonElement>('start-wave');
  private readonly pause = $<HTMLButtonElement>('pause');
  private readonly speedButtons = [...document.querySelectorAll<HTMLButtonElement>('[data-speed]')];
  private readonly overlay = $('overlay');
  private readonly waveListTitle = $('wave-list-title');
  private readonly nextWaveList = $('next-wave-list');
  private readonly elementInfo = $('element-info');
  private readonly elementButtons: { element: ElementId; el: HTMLButtonElement }[] = [];
  private readonly buildCards: { weapon: WeaponId; el: HTMLButtonElement; icon: HTMLCanvasElement; name: HTMLElement; cost: HTMLElement }[] = [];
  private readonly lockdown = $('lockdown');
  private readonly battlefield = $('battlefield');
  private readonly prepBar = $('prep-bar');
  private readonly prepTitle = $('prep-title');
  private readonly prepSub = $('prep-sub');
  private readonly prepTime = $('prep-time');
  private readonly prepFill = $('prep-fill');
  private readonly info: InfoPanel;
  /** Weapon card under the mouse, previewed in the info panel. */
  private hoverWeapon: WeaponId | null = null;
  /** Element the card icons and names were last drawn for. */
  private cardsElement: ElementId | null = null;
  private readonly cache = new Map<HTMLElement, string>();

  constructor(actions: HudActions) {
    this.startWave.addEventListener('click', () => actions.startWave());
    $('prep-ready').addEventListener('click', () => actions.startWave());
    this.pause.addEventListener('click', () => actions.togglePause());
    for (const b of this.speedButtons) b.addEventListener('click', () => actions.setSpeed(Number(b.dataset.speed)));
    this.info = new InfoPanel($('info-panel'), actions);
    $('restart').addEventListener('click', () => actions.restart());
    $('restart-game').addEventListener('click', () => actions.restartGame());
    $('open-maps').addEventListener('click', () => actions.openMaps());
    $('overlay-maps').addEventListener('click', () => actions.openMaps());
    $('next-map').addEventListener('click', () => actions.nextMap());

    const picker = $('element-picker');
    BUILD_ELEMENTS.forEach((element, i) => {
      const def = ELEMENTS[element];
      const el = document.createElement('button');
      el.className = 'element-button';
      el.style.setProperty('--el-color', def.color);
      el.textContent = def.icon;
      el.title = `${def.name} [${ELEMENT_KEYS[i]}]`;
      el.setAttribute('aria-label', def.name);
      el.addEventListener('click', () => actions.chooseElement(element));
      picker.append(el);
      this.elementButtons.push({ element, el });
    });

    const menu = $('build-menu');
    BUILD_WEAPONS.forEach((weapon, i) => {
      const w = WEAPONS[weapon];
      const el = document.createElement('button');
      el.className = 'build-card';
      el.title = `${w.name}: ${w.role} [${i + 1}]`;
      const icon = document.createElement('canvas');
      el.append(icon);
      const text = document.createElement('div');
      text.innerHTML = `<div class="name"></div><div class="meta"></div>`;
      text.querySelector('.meta')!.textContent = `${w.name} · ${w.role}`;
      el.append(text);
      const cost = document.createElement('span');
      cost.className = 'cost';
      cost.textContent = String(w.cost);
      el.append(cost);
      el.addEventListener('click', () => actions.chooseWeapon(weapon));
      el.addEventListener('mouseenter', () => (this.hoverWeapon = weapon));
      el.addEventListener('mouseleave', () => (this.hoverWeapon = null));
      menu.append(el);
      this.buildCards.push({ weapon, el, icon, name: text.querySelector('.name')!, cost });
    });
  }

  update(game: Game, view: HudView): void {
    this.setText($('level-name'), game.level.name);
    this.setText(this.lives, String(game.lives));
    this.setText(this.gold, String(game.gold));
    this.setText(this.wave, `${game.wavesStarted}/${game.totalWaves}`);

    this.startWave.disabled = game.phase !== 'build';
    const nextWave = Math.min(game.wavesStarted + 1, game.totalWaves);
    this.setText(
      this.startWave,
      game.phase === 'wave'
        ? `Wave ${game.wavesStarted} in progress…`
        : game.prepRemaining !== null
          ? `Ready · wave ${nextWave} in 0:${String(Math.ceil(game.prepRemaining)).padStart(2, '0')}`
          : `Ready · wave ${nextWave}`,
    );
    this.updatePrepBar(game);
    this.setText(this.pause, view.paused ? '▶' : '⏸');
    for (const b of this.speedButtons) b.classList.toggle('active', Number(b.dataset.speed) === view.speed);

    for (const { element, el } of this.elementButtons) {
      el.classList.toggle('active', element === view.element);
      const n = BUILD_WEAPONS.filter((weapon) => game.isLocked({ weapon, element })).length;
      el.dataset.locked = String(n);
    }
    this.lockdown.hidden = game.locked.size === 0;
    this.setText(
      this.lockdown,
      `🔒 Lockdown: ${game.locked.size} of ${BUILD_WEAPONS.length * BUILD_ELEMENTS.length} towers encrypted. New lockdown after each wave.`,
    );
    const el = ELEMENTS[view.element];
    const combos = combosFor(view.element).map((c) => `${c.name} (+${ELEMENTS[c.elements.find((e) => e !== view.element) ?? c.elements[0]].name})`);
    this.setText(this.elementInfo, `${el.name}: ${describeEffect(view.element)}${combos.length ? `. Combos: ${combos.join(', ')}` : ''}`);
    this.elementInfo.title = combosFor(view.element).map((c) => `${c.name}: ${c.description}`).join('\n');
    if (this.cardsElement !== view.element) {
      this.cardsElement = view.element;
      for (const card of this.buildCards) {
        const option = { weapon: card.weapon, element: view.element };
        drawIcon(card.icon, option);
        card.name.textContent = towerName(option);
      }
    }
    for (const { weapon, el, cost } of this.buildCards) {
      const option = { weapon, element: view.element };
      const locked = game.isLocked(option);
      el.classList.toggle('selected', view.buildChoice?.weapon === weapon);
      el.classList.toggle('locked', locked);
      el.setAttribute('aria-disabled', String(locked));
      el.classList.toggle('unaffordable', game.gold < towerCost(option));
      this.setText(cost, locked ? '🔒' : String(towerCost(option)));
    }

    this.updateBattlefield(game);
    this.updateNextWave(game);
    this.info.update(game, this.infoSubject(view));
    this.updateOverlay(game);
  }

  /** Hovered card first, then the card picked for building, then the tower selected on the map. */
  private infoSubject(view: HudView): InfoSubject {
    if (this.hoverWeapon) return { kind: 'build', option: { weapon: this.hoverWeapon, element: view.element } };
    if (view.buildChoice) return { kind: 'build', option: view.buildChoice };
    if (view.selected) return { kind: 'placed', tower: view.selected };
    if (view.heroSelected) return { kind: 'hero' };
    return null;
  }

  /** "Wave cleared / get ready" bar over the map, with the countdown and the Ready button. */
  private updatePrepBar(game: Game): void {
    const show = game.phase === 'build';
    this.prepBar.hidden = !show;
    if (!show) return;
    const next = game.wavesStarted + 1;
    const field = game.battlefield;
    const fieldColor = ELEMENTS[field.element].color;
    this.setText(
      this.prepTitle,
      game.wavesStarted === 0 ? 'Get ready' : `Wave ${game.wavesStarted} cleared${game.lastWaveBonus ? ` · +${game.lastWaveBonus} gold` : ''}`,
    );
    const sub = `Next: wave ${next} of ${game.totalWaves} on <b style="color:${fieldColor}">${field.name}</b>`;
    if (this.cache.get(this.prepSub) !== sub) {
      this.cache.set(this.prepSub, sub);
      this.prepSub.innerHTML = sub;
    }
    const remaining = game.prepRemaining;
    this.prepBar.classList.toggle('timed', remaining !== null);
    this.prepBar.classList.toggle('urgent', remaining !== null && remaining <= 5);
    this.setText(this.prepTime, remaining === null ? '' : `${Math.ceil(remaining)}`);
    this.prepFill.style.width = remaining === null ? '0%' : `${(remaining / game.prepTime) * 100}%`;
  }

  private updateBattlefield(game: Game): void {
    const field = game.battlefield;
    const up = ELEMENTS[field.element];
    const down = ELEMENTS[weakenedElement(field)];
    const pct = Math.round(game.battlefieldBonus * 100);
    const html = `
      <h2>Battlefield</h2>
      <div class="bf-row">
        <span class="bf-name" style="--el-color:${up.color}">${field.name}</span>
        <span class="bf-mods">
          <span style="color:${up.color}">${up.icon} ${up.name} +${pct}%</span>
          <span style="color:${down.color}">${down.icon} ${down.name} −${pct}%</span>
        </span>
      </div>`;
    this.battlefield.title =
      `${up.name} towers deal +${pct}% damage and ${up.name} enemies take ${pct}% less. ` +
      `${down.name} towers deal −${pct}% damage and ${down.name} enemies take ${pct}% more.`;
    if (this.cache.get(this.battlefield) !== html) {
      this.cache.set(this.battlefield, html);
      this.battlefield.innerHTML = html;
    }
  }

  /** Enemy list in the bar above the map: the coming wave between waves, the current one during a wave. */
  private updateNextWave(game: Game): void {
    const during = game.phase === 'wave';
    const index = during ? game.wavesStarted - 1 : game.wavesStarted;
    const wave = game.level.waves[index];
    this.setText(
      this.waveListTitle,
      !wave ? 'All waves cleared' : `${during ? 'Wave' : 'Next wave'} ${index + 1}/${game.totalWaves}`,
    );
    if (!wave) {
      this.nextWaveList.innerHTML = '';
      this.cache.delete(this.nextWaveList);
      return;
    }
    // Group by enemy type and element (a group can override the type's element).
    const counts = new Map<string, { id: (typeof wave.groups)[number]['enemy']; element: ElementId | undefined; n: number }>();
    for (const g of wave.groups) {
      const element = g.element === null ? undefined : (g.element ?? ENEMIES[g.enemy].element);
      const key = `${g.enemy}:${element}`;
      const entry = counts.get(key) ?? { id: g.enemy, element, n: 0 };
      entry.n += g.count;
      counts.set(key, entry);
    }
    const html = [...counts.values()]
      .map(({ id, element, n }) => {
        const def = ENEMIES[id];
        const air = def.movement === 'air' ? ' <span class="tag">air</span>' : '';
        const el = element
          ? ` <span class="el-tag" style="--el-color:${ELEMENTS[element].color}" title="${ELEMENTS[element].name}">${ELEMENTS[element].icon}<span class="el-name"> ${ELEMENTS[element].name}</span></span>`
          : '';
        return `<li><span class="dot" style="background:${def.color};color:${def.color}"></span>${n} × ${def.name}${el}${air}</li>`;
      })
      .join('');
    if (this.cache.get(this.nextWaveList) !== html) {
      this.cache.set(this.nextWaveList, html);
      this.nextWaveList.innerHTML = html;
    }
  }

  private updateOverlay(game: Game): void {
    this.overlay.hidden = !game.over;
    if (!game.over) return;
    const index = LEVELS.indexOf(game.level);
    $('next-map').hidden = !(game.phase === 'won' && index >= 0 && index < LEVELS.length - 1);
    this.setText($('overlay-title'), game.phase === 'won' ? `${game.level.name} secured` : 'Core breached');
    this.setText(
      $('overlay-text'),
      game.phase === 'won'
        ? `All ${game.totalWaves} waves held with ${game.lives} ${game.lives === 1 ? 'life' : 'lives'} left.` +
          (index >= 0 && index < LEVELS.length - 1 ? ` ${LEVELS[index + 1].name} unlocked.` : ' Every map cleared!')
        : `You fell on wave ${game.wavesStarted} of ${game.totalWaves}.`,
    );
    const html = statsBreakdown(game);
    if (this.cache.get($('overlay-stats')) !== html) {
      this.cache.set($('overlay-stats'), html);
      $('overlay-stats').innerHTML = html;
    }
  }

  private setText(el: HTMLElement, text: string): void {
    if (this.cache.get(el) === text) return;
    this.cache.set(el, text);
    el.textContent = text;
  }
}

/** Keyboard shortcuts for the element picker, in BUILD_ELEMENTS order. */
export const ELEMENT_KEYS = ['Q', 'W', 'E', 'R', 'T'] as const;

function drawIcon(canvas: HTMLCanvasElement, option: TowerOption): void {
  const size = 40;
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawTower(ctx, size / 2, size / 2, size, option.element, option.weapon, -Math.PI / 4);
}

/** End-of-map breakdown: who got the kills, damage by weapon, and combos set off. */
function statsBreakdown(game: Game): string {
  const { kills, damage, combos } = game.stats;
  const total = kills.hero + kills.towers + kills.status || 1;
  const pct = (n: number) => `${Math.round((n / total) * 100)}%`;
  const weapons = Object.entries(damage.byWeapon)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([w, d]) => `<li>${WEAPONS[w as keyof typeof WEAPONS].name}<span>${Math.round(d ?? 0).toLocaleString()}</span></li>`)
    .join('');
  const comboList = Object.entries(combos)
    .map(([c, n]) => `<li style="color:${COMBOS[c as keyof typeof COMBOS].color}">${COMBOS[c as keyof typeof COMBOS].name}<span>×${n}</span></li>`)
    .join('');
  return `
    <div class="stat-block">
      <h3>Kills</h3>
      <ul>
        <li>Towers<span>${kills.towers} · ${pct(kills.towers)}</span></li>
        ${game.hero ? `<li>${game.hero.def.callsign}<span>${kills.hero} · ${pct(kills.hero)}</span></li>` : ''}
        <li>Burn &amp; poison<span>${kills.status} · ${pct(kills.status)}</span></li>
      </ul>
    </div>
    <div class="stat-block"><h3>Tower damage</h3><ul>${weapons || '<li>—</li>'}</ul></div>
    <div class="stat-block"><h3>Combos</h3><ul>${comboList || '<li>None</li>'}</ul></div>`;
}
