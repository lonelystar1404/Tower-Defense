import { ABILITY_KEYS, HEROES, HERO_IDS, type HeroId } from '../data/hero';
import type { LevelDef } from '../data/levels';
import { drawHeroSprite } from '../render/sprites';
import { ABILITY_ICONS } from './HeroBar';
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

  constructor(
    private readonly root: HTMLElement,
    private readonly onDeploy: (level: LevelDef, hero: HeroId) => void,
    private readonly onBack: () => void,
  ) {
    root.addEventListener('click', (ev) => {
      const el = ev.target as HTMLElement;
      if (el.closest('[data-back]')) return this.onBack();
      if (el.closest('[data-deploy]') && this.level) {
        saveHero(this.picked);
        this.hide();
        return this.onDeploy(this.level, this.picked);
      }
      const card = el.closest<HTMLElement>('[data-hero]');
      if (card) {
        this.picked = card.dataset.hero as HeroId;
        this.render();
      }
    });
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  show(level: LevelDef): void {
    this.level = level;
    this.picked = lastHero();
    this.render();
    this.root.hidden = false;
    this.animate();
  }

  hide(): void {
    this.root.hidden = true;
    cancelAnimationFrame(this.frame);
  }

  private render(): void {
    const cards = HERO_IDS.map((id) => {
      const def = HEROES[id];
      const a = def.attack;
      const attack = a.cleave ? 'Melee, hits around the target' : a.chain ? `Magic bolt, jumps to ${a.chain} more` : a.range >= 4 ? 'Long-range shots' : 'Rapid shots';
      const abilities = def.abilities
        .map(
          (ab, slot) => `
          <li title="${ab.description}">
            <svg viewBox="0 0 24 24" aria-hidden="true">${ABILITY_ICONS[ab.id] ?? ''}</svg>
            <span><b>${ABILITY_KEYS[slot]}</b> ${ab.name}</span><span class="lv">Lv ${ab.unlockLevel}</span>
          </li>`,
        )
        .join('');
      return `
        <button class="hero-card ${id === this.picked ? 'picked' : ''}" data-hero="${id}" style="--el-color:${def.color}" aria-pressed="${id === this.picked}">
          <canvas width="96" height="96" data-portrait="${id}"></canvas>
          ${heroProfile(def)}
          <div class="hero-attack">⚔ ${attack} · range ${a.range}</div>
          <ul class="hero-abilities-list">${abilities}</ul>
        </button>`;
    }).join('');
    this.root.innerHTML = `
      <div class="menu-card hero-select-card">
        <div class="menu-head">
          <h2>Choose your hero · ${this.level?.name ?? ''}</h2>
          <div class="row">
            <button data-back>Back</button>
            <button class="primary" data-deploy>Deploy ${HEROES[this.picked].callsign}</button>
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
