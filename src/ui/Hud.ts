import { ELEMENTS, type ElementId } from '../data/elements';
import { weakenedElement } from '../data/battlefields';
import { ENEMIES, isBoss } from '../data/enemies';
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
import type { DailyChallenge } from '../game/daily';
import { SCORE } from '../data/score';
import type { MapBest } from './saves';
import { t } from '../i18n';

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
  /** Copy the Daily Challenge result to share. */
  share(): void;
  /** Drop the build tool or ability aim (the Cancel button over the map). */
  cancelTool(): void;
  /** Deselect the tower or hero shown in the info panel. */
  closeInfo(): void;
}

export interface HudView {
  heroSelected: boolean;
  /** Element used for new towers. */
  element: ElementId;
  buildChoice: TowerOption | null;
  selected: Tower | null;
  speed: number;
  paused: boolean;
  /** Hero ability slot being aimed. */
  aiming: number | null;
  /** The player is using touch: hints say "tap" and describe the tap-twice confirm. */
  touch: boolean;
  /** The player using this screen (their gold and hero). 0 in single-player. */
  player: number;
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
  private readonly toolBar = $('tool-bar');
  private readonly toolHint = $('tool-hint');
  private readonly info: InfoPanel;
  /** Weapon card under the mouse, previewed in the info panel. */
  private hoverWeapon: WeaponId | null = null;
  /** Element the card icons and names were last drawn for. */
  private cardsElement: ElementId | null = null;
  private readonly cache = new Map<HTMLElement, string>();
  /** The Daily Challenge being played, if any, and the best score recorded today. */
  private daily: DailyChallenge | null = null;
  private dailyBestScore = 0;
  /** Campaign runs: the map's best before this run ended, and whether this run beat it. */
  private mapBest: { previous: MapBest | null; isNew: boolean } | null = null;
  private readonly scoreBadge = $('score-badge');
  private readonly scoreValue = $('score-value');
  private readonly scoreGain = $('score-gain');
  /** Score badge animation: the wave whose points are showing, until when (game time), and the last total. */
  private gainWave = 0;
  private gainUntil = 0;
  private lastScore = 0;
  private dropUntil = 0;

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
    $('share-result').addEventListener('click', () => actions.share());
    $('cancel-tool').addEventListener('click', () => actions.cancelTool());

    const picker = $('element-picker');
    BUILD_ELEMENTS.forEach((element, i) => {
      const def = ELEMENTS[element];
      const el = document.createElement('button');
      el.className = 'element-button';
      el.style.setProperty('--el-color', def.color);
      el.textContent = def.icon;
      el.title = `${t(def.name)} [${ELEMENT_KEYS[i]}]`;
      el.setAttribute('aria-label', t(def.name));
      el.addEventListener('click', () => actions.chooseElement(element));
      picker.append(el);
      this.elementButtons.push({ element, el });
    });

    const menu = $('build-menu');
    BUILD_WEAPONS.forEach((weapon, i) => {
      const w = WEAPONS[weapon];
      const el = document.createElement('button');
      el.className = 'build-card';
      el.title = `${t(w.name)}: ${t(w.role)} [${i + 1}]`;
      const icon = document.createElement('canvas');
      el.append(icon);
      const text = document.createElement('div');
      text.innerHTML = `<div class="name"></div><div class="meta"></div>`;
      text.querySelector('.meta')!.textContent = `${t(w.name)} · ${t(w.role)}`;
      el.append(text);
      const cost = document.createElement('span');
      cost.className = 'cost';
      cost.textContent = String(w.cost);
      el.append(cost);
      el.addEventListener('click', () => actions.chooseWeapon(weapon));
      // Mouse only: a tap would leave the card "hovered" until the next tap elsewhere.
      el.addEventListener('pointerenter', (ev) => {
        if (ev.pointerType === 'mouse') this.hoverWeapon = weapon;
      });
      el.addEventListener('pointerleave', () => (this.hoverWeapon = null));
      menu.append(el);
      this.buildCards.push({ weapon, el, icon, name: text.querySelector('.name')!, cost });
    });
  }

  /** Marks the run as today's Daily Challenge (or a normal map with null). */
  setDaily(daily: DailyChallenge | null): void {
    this.daily = daily;
    this.dailyBestScore = 0;
    this.mapBest = null;
    this.gainWave = 0;
    this.gainUntil = 0;
    this.lastScore = 0;
    this.cache.delete($('overlay-text'));
  }

  setDailyBest(best: number): void {
    this.dailyBestScore = best;
  }

  /** The map's best score when the run ended (campaign runs). */
  setMapBest(result: { previous: MapBest | null; isNew: boolean } | null): void {
    this.mapBest = result;
    this.cache.delete($('overlay-text'));
  }

  /** Brief "Copied!" on the share button. */
  flashShared(): void {
    const button = $('share-result');
    button.textContent = t('Copied!');
    setTimeout(() => (button.textContent = t('Copy result')), 1500);
  }

  /** After a language change: redraw everything that's only written once. */
  relabel(): void {
    this.cache.clear();
    this.cardsElement = null;
    this.info.reset();
    BUILD_WEAPONS.forEach((weapon, i) => {
      const w = WEAPONS[weapon];
      const card = this.buildCards[i];
      card.el.title = `${t(w.name)}: ${t(w.role)} [${i + 1}]`;
      card.el.querySelector('.meta')!.textContent = `${t(w.name)} · ${t(w.role)}`;
    });
    this.elementButtons.forEach(({ element, el }) => el.setAttribute('aria-label', t(ELEMENTS[element].name)));
  }

  update(game: Game, view: HudView): void {
    this.setText($('level-name'), this.daily ? t('Daily {date} · {map}', { date: this.daily.date, map: t(game.level.name) }) : t(game.level.name));
    this.setText(this.lives, String(game.lives));
    const me = game.players[view.player] ?? game.players[0];
    this.setText(this.gold, String(me.gold));
    this.setText(this.wave, `${game.wavesStarted}/${game.totalWaves}`);

    this.startWave.disabled = game.phase !== 'build';
    const nextWave = Math.min(game.wavesStarted + 1, game.totalWaves);
    this.setText(
      this.startWave,
      game.phase === 'wave'
        ? t('Wave {n} in progress…', { n: game.wavesStarted })
        : game.prepRemaining !== null
          ? t('Ready · wave {n} in {time}', { n: nextWave, time: `0:${String(Math.ceil(game.prepRemaining)).padStart(2, '0')}` })
          : t('Ready · wave {n}', { n: nextWave }),
    );
    this.updatePrepBar(game);
    this.updateToolBar(game, view);
    this.updateScore(game);
    this.setText(this.pause, view.paused ? '▶' : '⏸');
    for (const b of this.speedButtons) b.classList.toggle('active', Number(b.dataset.speed) === view.speed);

    for (const { element, el } of this.elementButtons) {
      el.classList.toggle('active', element === view.element);
      // Badge: how many of this element's towers can be built this wave.
      const open = BUILD_WEAPONS.filter((weapon) => !game.isLocked({ weapon, element })).length;
      el.dataset.open = String(open);
      el.title = `${t(ELEMENTS[element].name)} [${ELEMENT_KEYS[BUILD_ELEMENTS.indexOf(element)]}]: ${t('{open} of {total} towers available this wave', { open, total: BUILD_WEAPONS.length })}`;
    }
    const total = BUILD_WEAPONS.length * BUILD_ELEMENTS.length;
    this.lockdown.hidden = game.locked.size === 0;
    this.setText(
      this.lockdown,
      '🔒 ' + t('Lockdown: {open} of {total} towers available, {locked} encrypted. New lockdown after each wave.', { open: total - game.locked.size, total, locked: game.locked.size }),
    );
    const el = ELEMENTS[view.element];
    const combos = combosFor(view.element).map((c) => `${t(c.name)} (+${t(ELEMENTS[c.elements.find((e) => e !== view.element) ?? c.elements[0]].name)})`);
    this.setText(this.elementInfo, `${t(el.name)}: ${describeEffect(view.element)}${combos.length ? `. ${t('Combos')}: ${combos.join(', ')}` : ''}`);
    this.elementInfo.title = combosFor(view.element).map((c) => `${t(c.name)}: ${t(c.description)}`).join('\n');
    if (this.cardsElement !== view.element) {
      this.cardsElement = view.element;
      for (const card of this.buildCards) {
        const option = { weapon: card.weapon, element: view.element };
        drawIcon(card.icon, option);
        card.name.textContent = t(towerName(option));
      }
    }
    for (const { weapon, el, cost } of this.buildCards) {
      const option = { weapon, element: view.element };
      const locked = game.isLocked(option);
      el.classList.toggle('selected', view.buildChoice?.weapon === weapon);
      el.classList.toggle('locked', locked);
      el.setAttribute('aria-disabled', String(locked));
      el.classList.toggle('unaffordable', me.gold < towerCost(option));
      this.setText(cost, locked ? '🔒' : String(towerCost(option)));
    }

    this.updateBattlefield(game);
    this.updateNextWave(game);
    this.info.update(game, this.infoSubject(view), view.player);
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
      game.wavesStarted === 0
        ? game.hero && game.level.heroMode === 'random' && game.players.length === 1
          ? `${t('Get ready')} · ${t('Your hero this time: {name}', { name: game.hero.def.callsign })}`
          : t('Get ready')
        : t('Wave {n} cleared', { n: game.wavesStarted }) + (game.lastWaveBonus ? ` · ${t('+{n} gold', { n: game.lastWaveBonus })}` : ''),
    );
    const sub = t('Next: wave {n} of {total} on {field}', { n: next, total: game.totalWaves, field: `<b style="color:${fieldColor}">${t(field.name)}</b>` });
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

  /**
   * Over the bottom of the map while a tool is active: what to do next and a Cancel button
   * (touch players have no right-click or Esc). The hero hint is for touch only.
   */
  private updateToolBar(game: Game, view: HudView): void {
    let hint = '';
    const hero = game.players[view.player]?.hero;
    if (view.aiming !== null && hero) {
      const name = t(hero.ability(view.aiming).name);
      hint = view.touch ? t('{ability}: tap to aim, tap the same spot again to fire', { ability: name }) : t('{ability}: click to fire', { ability: name });
    } else if (view.buildChoice) {
      hint = view.touch ? t('Tap a pad to preview, tap it again to build') : t('Click a pad to build · Shift-click to build several');
    } else if (view.heroSelected && hero && view.touch) {
      hint = t('Tap the map to move {name}', { name: hero.def.callsign });
    }
    this.toolBar.hidden = !hint || game.over;
    $('cancel-tool').hidden = view.aiming === null && !view.buildChoice;
    this.setText(this.toolHint, hint);
  }

  /**
   * Score at the top left of the map. After a clear, "+175" (wave + speed points) shows next to
   * it for a few seconds; losing a life flashes it red.
   */
  private updateScore(game: Game): void {
    const total = game.scoreTotal;
    this.setText(this.scoreValue, total.toLocaleString());
    if (total < this.lastScore) this.dropUntil = game.time + 1;
    this.lastScore = total;
    this.scoreBadge.classList.toggle('drop', game.time < this.dropUntil);
    const cleared = game.score.waves / SCORE.wave;
    if (game.lastWaveScore && cleared > this.gainWave) {
      this.gainWave = cleared;
      this.gainUntil = game.time + 4;
      const { wave, speed } = game.lastWaveScore;
      this.setText(this.scoreGain, `+${wave + speed}` + (speed > 0 ? ` ⚡${speed}` : ''));
    }
    this.scoreGain.hidden = game.time >= this.gainUntil;
    const lost = Math.max(0, game.level.lives - game.lives);
    const tip = t('Waves {waves} · Speed {speed} · Lives lost −{lives}', {
      waves: game.score.waves,
      speed: game.score.speed,
      lives: lost * SCORE.life,
    });
    if (this.scoreBadge.dataset.tipMeta !== tip) {
      this.scoreBadge.dataset.tip = t('Score');
      this.scoreBadge.dataset.tipMeta = tip;
      this.scoreBadge.dataset.tipBody = t('{wave} per wave cleared, up to {speed} more for clearing it fast (after its last enemy appears), −{life} per life lost.', {
        wave: SCORE.wave,
        speed: SCORE.speed,
        life: SCORE.life,
      });
    }
  }

  private updateBattlefield(game: Game): void {
    const field = game.battlefield;
    const up = ELEMENTS[field.element];
    const down = ELEMENTS[weakenedElement(field)];
    const pct = Math.round(game.battlefieldBonus * 100);
    const html = `
      <h2>${t('Battlefield')}</h2>
      <div class="bf-row">
        <span class="bf-name" style="--el-color:${up.color}">${t(field.name)}</span>
        <span class="bf-mods">
          <span style="color:${up.color}">${up.icon} ${t(up.name)} +${pct}%</span>
          <span style="color:${down.color}">${down.icon} ${t(down.name)} −${pct}%</span>
        </span>
      </div>`;
    this.battlefield.title = t(
      '{up} towers deal +{pct}% damage and {up} enemies take {pct}% less. {down} towers deal −{pct}% damage and {down} enemies take {pct}% more.',
      { up: t(up.name), down: t(down.name), pct },
    );
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
      !wave ? t('All waves cleared') : `${during ? t('Wave') : t('Next wave')} ${index + 1}/${game.totalWaves}`,
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
        const air = (def.movement === 'air' ? ` <span class="tag">${t('air')}</span>` : '') + (isBoss(def) ? ` <span class="tag boss">${t('boss')}</span>` : '');
        const el = element
          ? ` <span class="el-tag" style="--el-color:${ELEMENTS[element].color}" title="${t(ELEMENTS[element].name)}">${ELEMENTS[element].icon}<span class="el-name"> ${t(ELEMENTS[element].name)}</span></span>`
          : '';
        return `<li title="${t(def.description)}"><span class="dot" style="background:${def.color};color:${def.color}"></span>${n} × ${t(def.name)}${el}${air}</li>`;
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
    $('next-map').hidden = !!this.daily || !(game.phase === 'won' && index >= 0 && index < LEVELS.length - 1);
    $('share-result').hidden = !this.daily;
    this.setText(
      $('overlay-title'),
      (this.daily ? `${t('Daily')}: ` : '') + (game.phase === 'won' ? t('{map} secured', { map: t(game.level.name) }) : t('Core breached')),
    );
    const held =
      game.phase === 'won'
        ? t(game.lives === 1 ? 'All {waves} waves held with {lives} life left.' : 'All {waves} waves held with {lives} lives left.', { waves: game.totalWaves, lives: game.lives })
        : t('You fell on wave {n} of {total}.', { n: game.wavesStarted, total: game.totalWaves });
    const score = game.scoreTotal;
    const scoreText = `${t('Score {score}.', { score: score.toLocaleString() })} `;
    const best = this.mapBest;
    this.setText(
      $('overlay-text'),
      this.daily
        ? `${held} ${scoreText}` + (score >= this.dailyBestScore ? t('Your best today!') : t('Best today: {score}.', { score: this.dailyBestScore.toLocaleString() }))
        : held +
          (game.phase === 'won'
            ? ' ' + (index >= 0 && index < LEVELS.length - 1 ? t('{map} unlocked.', { map: t(LEVELS[index + 1].name) }) : t('Every map cleared!'))
            : '') +
          ` ${scoreText}` +
          (!best ? '' : best.isNew ? t('New best on this map!') : t('Best on this map: {score}.', { score: best.previous!.score.toLocaleString() })),
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
    .map(([w, d]) => `<li>${t(WEAPONS[w as keyof typeof WEAPONS].name)}<span>${Math.round(d ?? 0).toLocaleString()}</span></li>`)
    .join('');
  const comboList = Object.entries(combos)
    .map(([c, n]) => `<li style="color:${COMBOS[c as keyof typeof COMBOS].color}">${t(COMBOS[c as keyof typeof COMBOS].name)}<span>×${n}</span></li>`)
    .join('');
  return `
    <div class="stat-block">
      <h3>${t('Kills')}</h3>
      <ul>
        <li>${t('Towers')}<span>${kills.towers} · ${pct(kills.towers)}</span></li>
        ${game.hero ? `<li>${game.players.length > 1 ? t('Heroes') : game.hero.def.callsign}<span>${kills.hero} · ${pct(kills.hero)}</span></li>` : ''}
        <li>${t('Burn & poison')}<span>${kills.status} · ${pct(kills.status)}</span></li>
      </ul>
    </div>
    <div class="stat-block"><h3>${t('Tower damage')}</h3><ul>${weapons || '<li>—</li>'}</ul></div>
    <div class="stat-block"><h3>${t('Combos')}</h3><ul>${comboList || `<li>${t('None')}</li>`}</ul></div>
    <div class="stat-block"><h3>${t('Score')}</h3><ul>
      <li>${t('Waves')}<span>+${game.score.waves.toLocaleString()}</span></li>
      <li>${t('Speed')}<span>+${game.score.speed.toLocaleString()}</span></li>
      <li>${t('Lives lost')}<span>${game.lives < game.level.lives ? `−${((game.level.lives - game.lives) * SCORE.life).toLocaleString()}` : '0'}</span></li>
      <li><b>${t('Total')}</b><span><b>${game.scoreTotal.toLocaleString()}</b></span></li>
    </ul></div>`;
}
