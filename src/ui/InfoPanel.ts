import { weakenedElement } from '../data/battlefields';
import { ELEMENTS, OVERCOMES, RESIST_PENALTY, WEAKNESS_BONUS, type ElementId } from '../data/elements';
import { ABILITY_KEYS, HERO_LEVELS, type HeroDef } from '../data/hero';
import { ABILITY_ICONS } from './HeroBar';
import { combosFor } from '../data/combos';
import { describeEffect } from '../data/status';
import { MAX_TOWER_LEVEL, towerCost, towerName, towerStats, type TowerOption, type TowerStats } from '../data/towers';
import { WEAPONS } from '../data/weapons';
import type { Tower } from '../entities/Tower';
import type { Game } from '../game/Game';
import { drawTower } from '../render/sprites';
import type { TargetPriority } from '../systems/targeting';
import { getLang, t } from '../i18n';

/** What the panel describes: a tower about to be built, or one already on the map. */
export type InfoSubject =
  | { kind: 'build'; option: TowerOption }
  | { kind: 'placed'; tower: Tower }
  | { kind: 'hero' }
  | null;

export interface InfoActions {
  upgradeSelected(): void;
  sellSelected(): void;
  cyclePriority(): void;
  closeInfo(): void;
}

export const PRIORITY_LABELS: Record<TargetPriority, string> = {
  first: 'First',
  last: 'Last',
  strongest: 'Strongest',
  closest: 'Closest',
};

/**
 * Tower details panel (right of the sidebar). Rebuilds its HTML only when what it shows
 * changes, so it can be updated every frame.
 */
export class InfoPanel {
  private key = '';

  constructor(private readonly root: HTMLElement, actions: InfoActions) {
    root.addEventListener('click', (ev) => {
      const action = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'sell') actions.sellSelected();
      if (action === 'upgrade') actions.upgradeSelected();
      if (action === 'priority') actions.cyclePriority();
      if (action === 'close') actions.closeInfo();
    });
  }

  /** Forces a redraw (after a language change). */
  reset(): void {
    this.key = '';
  }

  update(game: Game, subject: InfoSubject): void {
    // On phones the panel floats over the build menu, only for a placed tower or the hero.
    this.root.dataset.kind = subject?.kind ?? 'none';
    const key = `${getLang()}:${this.keyFor(game, subject)}`;
    if (key === this.key) return;
    this.key = key;
    if (!subject) {
      this.root.innerHTML = `
        <h2>${t('Tower info')}</h2>
        <p class="info-empty">${t('Hover or pick a tower card to see what it does, or click a tower on the map to inspect it.')}</p>`;
      return;
    }
    if (subject.kind === 'hero') {
      this.root.innerHTML = this.renderHero(game) + this.closeButton();
      return;
    }
    const option = subject.kind === 'build' ? subject.option : { weapon: subject.tower.weapon, element: subject.tower.element };
    const tower = subject.kind === 'placed' ? subject.tower : null;
    this.root.innerHTML = this.render(game, option, tower) + (tower ? this.closeButton() : '');
    drawIcon(this.root.querySelector('canvas')!, option, tower?.level ?? 1);
  }

  /** Close (deselect) button, shown only where the panel floats over the build menu (phones). */
  private closeButton(): string {
    return `<button class="info-close" type="button" data-action="close" aria-label="${t('Close')}" title="${t('Close')}">✕</button>`;
  }

  private keyFor(game: Game, subject: InfoSubject): string {
    if (!subject) return 'none';
    if (subject.kind === 'hero') {
      const h = game.hero;
      return h ? `hero:${h.def.id}:${h.level}:${h.kills}:${h.cooldowns.map((c) => Math.ceil(c)).join(',')}:${h.jammed}:${game.battlefield.id}` : 'none';
    }
    if (subject.kind === 'build') {
      const { weapon, element } = subject.option;
      return `build:${weapon}:${element}:${Math.max(0, towerCost(subject.option) - game.gold)}:${game.isLocked(subject.option)}:${game.battlefield.id}`;
    }
    const t = subject.tower;
    const next = game.nextUpgradeCost(t);
    return `placed:${t.id}:${t.level}:${t.priority}:${game.sellValue(t)}:${next === null ? 'max' : Math.max(0, next - game.gold)}:${game.isLocked(t)}:${game.battlefield.id}`;
  }

  /** The hero: who they are, level and XP, attack, and each ability's state. */
  private renderHero(game: Game): string {
    const hero = game.hero;
    if (!hero) return '';
    const def = hero.def;
    const next = hero.killsForNextLevel;
    const a = def.attack;
    const abilities = def.abilities
      .map((ab, slot) => {
        const state = !hero.isUnlocked(slot)
          ? `🔒 ${t('Unlocks at Lv {n}', { n: ab.unlockLevel })}`
          : hero.cooldowns[slot] > 0
            ? t('Recharging: {n}s', { n: Math.ceil(hero.cooldowns[slot]) })
            : t('Ready');
        return `
        <div class="info-block hero-ability" style="--el-color:${def.color}">
          <div class="info-label"><svg viewBox="0 0 24 24" aria-hidden="true">${ABILITY_ICONS[ab.id] ?? ''}</svg>[${ABILITY_KEYS[slot]}] ${t(ab.name)}</div>
          <p>${t(ab.description)}</p>
          <p class="muted">${t('cooldown {n}s', { n: Math.round(ab.cooldown * hero.cooldownMult) })} · ${state}</p>
        </div>`;
      })
      .join('');
    return `
      <h2>${t('Hero')}</h2>
      ${heroProfile(def)}
      <div class="info-sub" style="margin-top:-4px">${t('Lv')} ${hero.level} · ${next === null ? t('max level') : t('{kills}/{next} nearby kills to level {level}', { kills: hero.kills, next, level: hero.level + 1 })}</div>
      ${hero.jammed ? `<div class="info-cost" style="color:var(--danger)">⚠ ${t('Jammed: cooldowns paused')}</div>` : ''}
      <dl>
        <dt>${t('Attack')}</dt><dd>${(a.damage * hero.damageMult).toFixed(1)}${a.cleave ? ` (${t('cleave')})` : a.chain ? ` (${t('+{n} jumps', { n: a.chain })})` : ''}</dd>
        <dt>${t('Fire rate')}</dt><dd>${a.fireRate.toFixed(1)}/s</dd>
        <dt>${t('Range (tiles)')}</dt><dd>${a.range}</dd>
        <dt>${t('XP radius')}</dt><dd>${t('{n} tiles', { n: HERO_LEVELS.xpRadius })}</dd>
      </dl>
      ${this.matchups(game, def.element, true)}
      ${
        def.passive
          ? `<div class="info-block hero-ability" style="--el-color:${def.color}">
          <div class="info-label"><svg viewBox="0 0 24 24" aria-hidden="true">${ABILITY_ICONS[`${def.id}-passive`] ?? ''}</svg>[✦] ${t(def.passive.name)}</div>
          <p>${t(def.passive.description)}</p>
          <p class="muted">${t('Passive')} · ${t('Always on')}</p>
        </div>`
          : ''
      }
      ${abilities}
      <p class="info-hint">${t("Right-click the map to move. Can't be hurt. Mirrors are immune to heroes; Jammers nearby pause cooldowns.")}</p>`;
  }

  /** Which enemy elements this tower (or hero) is strong/weak against, and today's battlefield effect. */
  private matchups(game: Game, element: ElementId, forHero = false): string {
    const strongVs = ELEMENTS[OVERCOMES[element]];
    const weakVs = ELEMENTS[(Object.keys(OVERCOMES) as ElementId[]).find((e) => OVERCOMES[e] === element)!];
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    const field = game.battlefield;
    const bonus = game.battlefieldBonus;
    const fieldLine =
      element === field.element
        ? `<p class="pro">${t('{field}: +{pct} damage this wave', { field: t(field.name), pct: pct(bonus) })}</p>`
        : element === weakenedElement(field)
          ? `<p class="con">${t('{field}: −{pct} damage this wave', { field: t(field.name), pct: pct(bonus) })}</p>`
          : `<p class="muted">${t(forHero ? '{field}: no effect on this hero' : '{field}: no effect on this tower', { field: t(field.name) })}</p>`;
    return `
      <div class="info-block">
        <div class="info-label">${t('Matchups')}</div>
        <p class="pro">${t('+{pct} vs {icon} {element} enemies', { pct: pct(WEAKNESS_BONUS - 1), icon: strongVs.icon, element: t(strongVs.name) })}</p>
        <p class="con">${t('−{pct} vs {icon} {element} enemies', { pct: pct(1 - RESIST_PENALTY), icon: weakVs.icon, element: t(weakVs.name) })}</p>
        ${fieldLine}
      </div>`;
  }

  private render(game: Game, option: TowerOption, tower: Tower | null): string {
    const el = ELEMENTS[option.element];
    const w = WEAPONS[option.weapon];
    const level = tower?.level ?? 1;
    const s = towerStats(option, level);
    const cost = towerCost(option);
    const upgrade = tower ? game.nextUpgradeCost(tower) : null;
    // On a placed tower that can still upgrade, show what the next level changes.
    const next = tower && upgrade !== null ? towerStats(option, level + 1) : null;
    const num = (f: (st: TowerStats) => number, digits: number, unit = '') => {
      const now = f(s).toFixed(digits) + unit;
      if (!next || f(next) === f(s)) return now;
      return `${now} <span class="up">→ ${f(next).toFixed(digits)}${unit}</span>`;
    };

    const rows: [string, string][] = [
      [t('Damage'), num((st) => st.damage, 1)],
      [t('Damage/s'), num((st) => st.damage * st.fireRate, 1)],
      [t('Fire rate'), num((st) => st.fireRate, 2, '/s')],
      [t('Range (tiles)'), num((st) => st.range, 1)],
      [t('Targets'), s.targets.map((m) => (m === 'air' ? t('Air') : t('Ground'))).join(' + ')],
    ];
    const a = s.attack;
    if (a.kind === 'multi') rows.push([t('Shots'), t('Up to {n} targets', { n: a.maxTargets })]);
    if (a.kind === 'splash') rows.push([t('Splash'), t('{n} tile radius', { n: a.radius.toFixed(1) })]);
    if (a.kind === 'chain') rows.push([t('Chain'), t('{n} jumps, −{pct}%', { n: a.jumps, pct: Math.round(a.falloff * 100) })]);
    if (s.airBonus !== 1) rows.push([t('Vs air'), t('+{pct}% damage', { pct: Math.round((s.airBonus - 1) * 100) })]);
    if (s.critChance > 0) rows.push([t('Crit'), num((st) => Math.round(st.critChance * 100), 0, '% ' + t('for 2×'))]);
    if (option.element !== 'metal') rows.push([t('Effect power'), num((st) => Math.round(st.effectPower * 100), 0, '%')]);
    if (s.armorPierce > 0) rows.push([t('Armor pierce'), `${Math.round(s.armorPierce * 100)}%`]);

    // Actions sit right under the name so Upgrade and Sell are easy to find.
    let actions: string;
    if (tower) {
      const upgradeButton =
        upgrade === null
          ? `<button class="upgrade" disabled>${t('Max level')}</button>`
          : game.isLocked(option)
            ? `<button class="upgrade" disabled title="${t('Locked this wave')}">🔒 ${t('Upgrade encrypted this wave')}</button>
               <p class="info-hint warn">${t("This combo is locked this wave: the tower keeps firing but can't be upgraded until a lockdown frees it.")}</p>`
            : `<button class="upgrade" data-action="upgrade" title="${t('Upgrade')} [U]" ${game.gold < upgrade ? 'disabled' : ''}>
               ${t('Upgrade to Lv {n}', { n: level + 1 })} · <b>${upgrade}</b>
             </button>
             ${game.gold < upgrade ? `<p class="info-hint warn">${t('Need {n} more gold.', { n: upgrade - game.gold })}</p>` : ''}`;
      actions = `
        ${upgradeButton}
        <div class="row">
          <button data-action="priority" title="${t('Targeting priority')}">${t('Target')}: ${t(PRIORITY_LABELS[tower.priority])}</button>
          <button data-action="sell" class="danger" title="${t('Sell')} [S]">${t('Sell')} +${game.sellValue(tower)}</button>
        </div>`;
    } else {
      const short = cost - game.gold;
      actions = game.isLocked(option)
        ? `<p class="info-hint warn">🔒 ${t("Encrypted this wave: can't be built. The lockdown changes after each wave.")}</p>`
        : short > 0
          ? `<p class="info-hint warn">${t('Need {n} more gold.', { n: short })}</p>`
          : `<p class="info-hint">${t('Click an empty pad to build. Shift-click to build several.')}</p>`;
    }

    return `
      <h2>${tower ? t('Selected tower') : t('Tower info')}</h2>
      <div class="info-head" style="--el-color:${el.color}">
        <canvas></canvas>
        <div>
          <div class="info-name">${t(towerName(option))}</div>
          <div class="pips">${Array.from({ length: MAX_TOWER_LEVEL }, (_, i) => `<span class="${i < level ? 'on' : ''}"></span>`).join('')}</div>
          <div class="info-sub">${el.icon} ${t(el.name)} · ${t(w.name)}</div>
          <div class="info-cost">${tower ? t('Lv {level} · spent {spent}', { level: tower.level, spent: tower.spent }) : `${t('Cost')} <b>${cost}</b>`}</div>
        </div>
      </div>
      <div class="info-actions" style="--el-color:${el.color}">${actions}</div>
      <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <div class="info-block" style="--el-color:${el.color}">
        <div class="info-label">${el.icon} ${t(el.name)} · ${t(el.role)}</div>
        <p>${describeEffect(option.element, s.effectPower)}</p>
      </div>
      ${this.matchups(game, option.element)}
      ${comboBlock(option.element)}
      <div class="info-block">
        <div class="info-label">${t(w.name)} · ${t(w.role)}</div>
        <p class="pro">+ ${t(w.strength)}</p>
        <p class="con">− ${t(w.weakness)}</p>
      </div>`;
  }
}

function drawIcon(canvas: HTMLCanvasElement, option: TowerOption, level: number): void {
  const size = 56;
  const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  drawTower(ctx, size / 2, size / 2, size * 0.86, option.element, option.weapon, -Math.PI / 4, 0, level);
}

/** Name, pronouns, race, origin, role, and bio: shared by the info panel and hero select. */
export function heroProfile(def: HeroDef): string {
  return `
    <div class="hero-profile" style="--el-color:${def.color}">
      <div class="info-name" style="color:${def.color}">${def.name}</div>
      <div class="info-sub">${t(def.role)} · ${t(def.pronouns)}</div>
      <div class="info-sub" style="color:${ELEMENTS[def.element].color}">${ELEMENTS[def.element].icon} ${t('{element} hero', { element: t(ELEMENTS[def.element].name) })}</div>
      <div class="info-sub">${t(def.race)} · ${t(def.origin)}</div>
      <p class="hero-bio">${t(def.bio)}</p>
    </div>`;
}

/** The element combos this tower can start, with what each needs and does. */
function comboBlock(element: ElementId): string {
  const combos = combosFor(element);
  if (!combos.length) return '';
  return `
    <div class="info-block">
      <div class="info-label">${t('Combos')}</div>
      ${combos.map((c) => `<p><b style="color:${c.color}">${t(c.name)}</b> · ${t(c.description)}</p>`).join('')}
    </div>`;
}
