import { ABILITY_KEYS, HEROES, HERO_IDS, type HeroId } from '../data/hero';
import { LEVELS } from '../data/levels';
import { t } from '../i18n';
import type { LevelDef } from '../data/levels';
import { drawHeroSprite } from '../render/sprites';
import { ABILITY_ICONS, abilityMeta } from './HeroBar';
import { tipAttrs } from './tooltip';
import { heroProfile } from './InfoPanel';

const KEY = 'td-hero';

/** The hero picked last time (saved in the browser), or Vex. */
export function lastHero(): HeroId {
  try {
    const id = localStorage.getItem(KEY);
    return id && id in HEROES ? (id as HeroId) : 'vex';
  } catch {
    return 'vex';
  }
}

function saveHero(id: HeroId): void {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Storage blocked: the pick lasts for this visit only.
  }
}

/** Hero select screen, shown before a hero map starts. */
export class HeroSelect {
  private level: LevelDef | null = null;
  private picked: HeroId = 'vex';
  private frame = 0;
  /** Which heroes can be picked (second-roster heroes unlock by clearing a map). */
  private unlocked: (id: HeroId) => boolean = () => true;

  constructor(
    private readonly root: HTMLElement,
    private readonly onDeploy: (level: LevelDef, hero: HeroId) => void,
    private readonly onBack: () => void,
  ) {
    root.addEventListener('click', (ev) => {
      const el = ev.target as HTMLElement;
      if (el.closest('[data-back]')) return this.onBack();
      if (el.closest('[data-deploy]') && this.level && this.unlocked(this.picked)) {
        saveHero(this.picked);
        this.hide();
        return this.onDeploy(this.level, this.picked);
      }
      const card = el.closest<HTMLElement>('[data-hero]');
      if (card && !card.classList.contains('locked')) {
        this.picked = card.dataset.hero as HeroId;
        this.render();
      }
    });
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  show(level: LevelDef, unlocked: (id: HeroId) => boolean = () => true): void {
    this.level = level;
    this.unlocked = unlocked;
    this.picked = unlocked(lastHero()) ? lastHero() : 'vex';
    this.render();
    this.root.hidden = false;
    this.animate();
  }

  /** Redraws the screen if it's open (after a language change). */
  refresh(): void {
    if (this.open) this.render();
  }

  hide(): void {
    this.root.hidden = true;
    cancelAnimationFrame(this.frame);
  }

  private render(): void {
    const cards = HERO_IDS.map((id) => {
      const def = HEROES[id];
      const a = def.attack;
      const attack = a.cleave ? t('Melee, hits around the target') : a.chain ? t('Magic bolt, jumps to {n} more', { n: a.chain }) : a.range >= 4 ? t('Long-range shots') : t('Rapid shots');
      const abilities = def.abilities
        .map(
          (ab, slot) => `
          <li ${tipAttrs(t(ab.name), abilityMeta(ab, slot), t(ab.description), def.color)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">${ABILITY_ICONS[ab.id] ?? ''}</svg>
            <span><b>${ABILITY_KEYS[slot]}</b> ${t(ab.name)}</span><span class="lv">${t('Lv')} ${ab.unlockLevel}</span>
          </li>`,
        )
        .join('');
      const open = this.unlocked(id);
      const unlockMap = LEVELS.find((l) => l.id === def.unlockedBy);
      // The passive is listed first, as an always-on ability.
      const passive = def.passive
        ? `<li class="passive" ${tipAttrs(t(def.passive.name), `✦ ${t('Passive')} · ${t('Always on')}`, t(def.passive.description), def.color)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">${ABILITY_ICONS[`${id}-passive`] ?? ''}</svg>
            <span><b>✦</b> ${t(def.passive.name)}</span><span class="lv">${t('Passive')}</span>
          </li>`
        : '';
      return `
        <button class="hero-card ${id === this.picked ? 'picked' : ''} ${open ? '' : 'locked'}" data-hero="${id}" style="--el-color:${def.color}" aria-pressed="${id === this.picked}" ${open ? '' : 'aria-disabled="true"'}>
          ${open ? '' : `<span class="hero-lock">🔒 ${t('Clear {map} to unlock', { map: t(unlockMap?.name ?? 'Core Nexus') })}</span>`}
          <canvas width="96" height="96" data-portrait="${id}"></canvas>
          ${heroProfile(def)}
          <div class="hero-attack">⚔ ${attack} · ${t('range {n}', { n: a.range })}</div>
          <ul class="hero-abilities-list">${passive}${abilities}</ul>
        </button>`;
    }).join('');
    this.root.innerHTML = `
      <div class="menu-card hero-select-card">
        <div class="menu-head">
          <h2>${t('Choose your hero')} · ${t(this.level?.name ?? '')}</h2>
          <div class="row">
            <button data-back>${t('Back')}</button>
            <button class="primary" data-deploy>${t('Deploy {name}', { name: HEROES[this.picked].callsign })}</button>
          </div>
        </div>
        <div class="hero-grid">${cards}</div>
      </div>`;
  }

  /** Portraits idle-animate (Arjun flickers, glyphs orbit) while the screen is open. */
  private animate(): void {
    const draw = (now: number) => {
      this.root.querySelectorAll<HTMLCanvasElement>('[data-portrait]').forEach((c) => {
        const def = HEROES[c.dataset.portrait as HeroId];
        const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
        if (c.width !== 96 * dpr) {
          c.width = 96 * dpr;
          c.height = 96 * dpr;
        }
        const ctx = c.getContext('2d')!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, 96, 96);
        const g = ctx.createRadialGradient(48, 48, 4, 48, 48, 46);
        g.addColorStop(0, `${def.color}44`);
        g.addColorStop(1, `${def.color}00`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 96, 96);
        drawHeroSprite(ctx, def.id, def.color, 48, 50, 24, -Math.PI / 2 + Math.sin(now / 900) * 0.15, now / 1000);
      });
      this.frame = requestAnimationFrame(draw);
    };
    this.frame = requestAnimationFrame(draw);
  }
}
