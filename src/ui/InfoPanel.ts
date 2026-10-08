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
}

const PRIORITY_LABELS: Record<TargetPriority, string> = {
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
    });
  }

  update(game: Game, subject: InfoSubject): void {
    const key = this.keyFor(game, subject);
    if (key === this.key) return;
    this.key = key;
    if (!subject) {
      this.root.innerHTML = `
        <h2>Tower info</h2>
        <p class="info-empty">Hover or pick a tower card to see what it does, or click a tower on the map to inspect it.</p>`;
      return;
    }
    if (subject.kind === 'hero') {
      this.root.innerHTML = this.renderHero(game);
      return;
    }
    const option = subject.kind === 'build' ? subject.option : { weapon: subject.tower.weapon, element: subject.tower.element };
    const tower = subject.kind === 'placed' ? subject.tower : null;
    this.root.innerHTML = this.render(game, option, tower);
    drawIcon(this.root.querySelector('canvas')!, option, tower?.level ?? 1);
  }

  private keyFor(game: Game, subject: InfoSubject): string {
    if (!subject) return 'none';
    if (subject.kind === 'hero') {
      const h = game.hero;
      return h ? `hero:${h.def.id}:${h.level}:${h.kills}:${h.cooldowns.map((c) => Math.ceil(c)).join(',')}:${h.jammed}:${game.battlefield.id}` : 'none';
    }
    if (subject.kind === 'build') {
      const { weapon, element } = subject.option;
      return `build:${weapon}:${element}:${game.gold >= towerCost(subject.option)}:${game.isLocked(subject.option)}:${game.battlefield.id}`;
    }
    const t = subject.tower;
    const next = game.nextUpgradeCost(t);
    return `placed:${t.id}:${t.level}:${t.priority}:${game.sellValue(t)}:${next !== null && game.gold >= next}:${game.battlefield.id}`;
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
          ? `🔒 Unlocks at Lv ${ab.unlockLevel}`
          : hero.cooldowns[slot] > 0
            ? `Recharging: ${Math.ceil(hero.cooldowns[slot])}s`
            : 'Ready';
        return `
        <div class="info-block hero-ability" style="--el-color:${def.color}">
          <div class="info-label"><svg viewBox="0 0 24 24" aria-hidden="true">${ABILITY_ICONS[ab.id] ?? ''}</svg>[${ABILITY_KEYS[slot]}] ${ab.name}</div>
          <p>${ab.description}</p>
          <p class="muted">cooldown ${Math.round(ab.cooldown * hero.cooldownMult)}s · ${state}</p>
        </div>`;
      })
      .join('');
    return `
      <h2>Hero</h2>
      ${heroProfile(def)}
      <div class="info-sub" style="margin-top:-4px">Lv ${hero.level} · ${next === null ? 'max level' : `${hero.kills}/${next} nearby kills to level ${hero.level + 1}`}</div>
      ${hero.jammed ? '<div class="info-cost" style="color:var(--danger)">⚠ Jammed: cooldowns paused</div>' : ''}
      <dl>
        <dt>Attack</dt><dd>${(a.damage * hero.damageMult).toFixed(1)}${a.cleave ? ' (cleave)' : a.chain ? ` (+${a.chain} jumps)` : ''}</dd>
        <dt>Fire rate</dt><dd>${a.fireRate.toFixed(1)}/s</dd>
        <dt>Range (tiles)</dt><dd>${a.range}</dd>
        <dt>XP radius</dt><dd>${HERO_LEVELS.xpRadius} tiles</dd>
      </dl>
      ${this.matchups(game, def.element, 'hero')}
      ${abilities}
      <p class="info-hint">Right-click the map to move. Can't be hurt. Mirrors are immune to heroes; Jammers nearby pause cooldowns.</p>`;
  }

  /** Which enemy elements this tower (or hero) is strong/weak against, and today's battlefield effect. */
  private matchups(game: Game, element: ElementId, who = 'tower'): string {
    const strongVs = ELEMENTS[OVERCOMES[element]];
    const weakVs = ELEMENTS[(Object.keys(OVERCOMES) as ElementId[]).find((e) => OVERCOMES[e] === element)!];
    const pct = (x: number) => `${Math.round(x * 100)}%`;
    const field = game.battlefield;
    const bonus = game.battlefieldBonus;
    const fieldLine =
      element === field.element
        ? `<p class="pro">${field.name}: +${pct(bonus)} damage this wave</p>`
        : element === weakenedElement(field)
          ? `<p class="con">${field.name}: −${pct(bonus)} damage this wave</p>`
          : `<p class="muted">${field.name}: no effect on this ${who}</p>`;
    return `
      <div class="info-block">
        <div class="info-label">Matchups</div>
        <p class="pro">+${pct(WEAKNESS_BONUS - 1)} vs ${strongVs.icon} ${strongVs.name} enemies</p>
        <p class="con">−${pct(1 - RESIST_PENALTY)} vs ${weakVs.icon} ${weakVs.name} enemies</p>
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
      ['Damage', num((st) => st.damage, 1)],
      ['Damage/s', num((st) => st.damage * st.fireRate, 1)],
      ['Fire rate', num((st) => st.fireRate, 2, '/s')],
      ['Range (tiles)', num((st) => st.range, 1)],
      ['Targets', s.targets.map((t) => (t === 'air' ? 'Air' : 'Ground')).join(' + ')],
    ];
    const a = s.attack;
    if (a.kind === 'multi') rows.push(['Shots', `Up to ${a.maxTargets} targets`]);
    if (a.kind === 'splash') rows.push(['Splash', `${a.radius.toFixed(1)} tile radius`]);
    if (a.kind === 'chain') rows.push(['Chain', `${a.jumps} jumps, −${Math.round(a.falloff * 100)}%`]);
    if (s.airBonus !== 1) rows.push(['Vs air', `+${Math.round((s.airBonus - 1) * 100)}% damage`]);
    if (s.critChance > 0) rows.push(['Crit', num((st) => Math.round(st.critChance * 100), 0, '% for 2×')]);
    if (option.element !== 'metal') rows.push(['Effect power', num((st) => Math.round(st.effectPower * 100), 0, '%')]);
    if (s.armorPierce > 0) rows.push(['Armor pierce', `${Math.round(s.armorPierce * 100)}%`]);

    let footer: string;
    if (tower) {
      const upgradeButton =
        upgrade === null
          ? `<button class="upgrade" disabled>Max level</button>`
          : `<button class="upgrade" data-action="upgrade" title="Upgrade [U]" ${game.gold < upgrade ? 'disabled' : ''}>
               Upgrade to Lv ${level + 1} · <b>${upgrade}</b>
             </button>`;
      footer = `
        ${upgradeButton}
        <div class="row">
          <button data-action="priority" title="Targeting priority">Target: ${PRIORITY_LABELS[tower.priority]}</button>
          <button data-action="sell" class="danger" title="Sell [S]">Sell +${game.sellValue(tower)}</button>
        </div>`;
    } else {
      const short = cost - game.gold;
      footer = game.isLocked(option)
        ? `<p class="info-hint warn">🔒 Encrypted this wave: can't be built. The lockdown changes after each wave.</p>`
        : short > 0
          ? `<p class="info-hint warn">Need ${short} more gold.</p>`
          : `<p class="info-hint">Click an empty pad to build. Shift-click to build several.</p>`;
    }

    return `
      <h2>${tower ? 'Selected tower' : 'Tower info'}</h2>
      <div class="info-head" style="--el-color:${el.color}">
        <canvas></canvas>
        <div>
          <div class="info-name">${towerName(option)}</div>
          <div class="pips">${Array.from({ length: MAX_TOWER_LEVEL }, (_, i) => `<span class="${i < level ? 'on' : ''}"></span>`).join('')}</div>
          <div class="info-sub">${el.icon} ${el.name} · ${w.name}</div>
          <div class="info-cost">${tower ? `Lv ${tower.level} · spent ${tower.spent}` : `Cost <b>${cost}</b>`}</div>
        </div>
      </div>
      <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <div class="info-block" style="--el-color:${el.color}">
        <div class="info-label">${el.icon} ${el.name} · ${el.role}</div>
        <p>${describeEffect(option.element, s.effectPower)}</p>
      </div>
      ${this.matchups(game, option.element)}
      ${comboBlock(option.element)}
      <div class="info-block">
        <div class="info-label">${w.name} · ${w.role}</div>
        <p class="pro">+ ${w.strength}</p>
        <p class="con">− ${w.weakness}</p>
      </div>
      ${footer}`;
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
      <div class="info-sub">${def.role} · ${def.pronouns}</div>
      <div class="info-sub" style="color:${ELEMENTS[def.element].color}">${ELEMENTS[def.element].icon} ${ELEMENTS[def.element].name} hero</div>
      <div class="info-sub">${def.race} · ${def.origin}</div>
      <p class="hero-bio">${def.bio}</p>
    </div>`;
}

/** The element combos this tower can start, with what each needs and does. */
function comboBlock(element: ElementId): string {
  const combos = combosFor(element);
  if (!combos.length) return '';
  return `
    <div class="info-block">
      <div class="info-label">Combos</div>
      ${combos.map((c) => `<p><b style="color:${c.color}">${c.name}</b> · ${c.description}</p>`).join('')}
    </div>`;
}
