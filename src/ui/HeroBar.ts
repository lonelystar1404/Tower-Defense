import { ELEMENTS } from '../data/elements';
import { ABILITY_KEYS, MAX_HERO_LEVEL, type HeroDef } from '../data/hero';
import type { Game } from '../game/Game';

/** Line-art icons for every hero ability (24×24, drawn with currentColor), by ability id. */
export const ABILITY_ICONS: Record<string, string> = {
  // Vex
  'vex-pulse': '<circle cx="12" cy="12" r="3.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.9 4.9l2.8 2.8M16.3 16.3l2.8 2.8M4.9 19.1l2.8-2.8M16.3 7.7l2.8-2.8"/>',
  'vex-emp': '<circle cx="12" cy="12" r="10" stroke-dasharray="3 2"/><path d="M13 3.5 7 13h5l-1 7.5 6-9.5h-5z" fill="currentColor" fill-opacity=".25"/>',
  'vex-cryo': '<path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10"/><path d="M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5M3.6 10.4l3.4-.9-.9-3.4M20.4 13.6l-3.4.9.9 3.4M3.6 13.6l3.4.9-.9 3.4M20.4 10.4l-3.4-.9.9-3.4"/>',
  'vex-orbital': '<rect x="9" y="1.5" width="6" height="3" rx=".5"/><path d="M5 3h4M15 3h4M12 4.5v7" stroke-dasharray="2 1.5"/><circle cx="12" cy="16" r="5"/><path d="M12 9.5v3M12 19.5v3M5.5 16h3M15.5 16h3"/>',
  // Brick
  'mateo-slam': '<path d="M8 3h8v6H8z" fill="currentColor" fill-opacity=".25"/><path d="M12 9v4M3 21l4-5 3 3 2-4 2 4 3-3 4 5"/>',
  'mateo-leap': '<path d="M4 20c2-9 8-14 16-16"/><path d="M14 3.5 20 4l-.5 6"/><path d="M3 21h6" stroke-dasharray="2 1.5"/>',
  'mateo-overdrive': '<path d="M5 18a8 8 0 1 1 14 0"/><path d="M12 13l5-5"/><circle cx="12" cy="13" r="1.5" fill="currentColor"/><path d="M8 21h8"/>',
  'mateo-quake': '<path d="M2 14h3l2-5 3 10 3-14 3 12 2-6h4"/>',
  // Leila
  'leila-pierce': '<path d="M2 12h17"/><path d="M15 8l5 4-5 4"/><path d="M6 8v8M10 8v8" stroke-dasharray="1.5 1.5"/>',
  'leila-mark': '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  'leila-rapid': '<path d="M3 8h9M3 12h13M3 16h9"/><path d="M14 6l4 2-4 2M17 10l4 2-4 2M14 14l4 2-4 2"/>',
  'leila-headhunter': '<path d="M12 3c4 0 7 3 7 7 0 3-2 4-2 6v3H7v-3c0-2-2-3-2-6 0-4 3-7 7-7z"/><circle cx="9.5" cy="11" r="1.5"/><circle cx="14.5" cy="11" r="1.5"/><path d="M2 2l20 20" stroke-dasharray="2 1.5"/>',
  // Arjun
  'arjun-firewall': '<path d="M3 21h18M5 21V11M10 21V8M14 21V8M19 21V11"/><path d="M12 2c2 3 3 4 3 6a3 3 0 0 1-6 0c0-2 1-3 3-6z" fill="currentColor" fill-opacity=".25"/>',
  'arjun-gravity': '<path d="M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M12 6c3.3 0 6 2.7 6 6s-2.7 6-6 6-6-2.7-6-6M12 2c5.5 0 10 4.5 10 10"/>',
  'arjun-storm': '<path d="M7 15a4 4 0 0 1-.6-8 5.5 5.5 0 0 1 10.6 1.5A3.5 3.5 0 0 1 17 15"/><path d="M12 13l-2 4h3l-2 5"/>',
  'arjun-timelock': '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6M12 2v3"/><path d="M4 4l3 3M20 4l-3 3"/>',
  // Echo
  'echo-drone': '<rect x="8" y="9" width="8" height="6" rx="1.5"/><path d="M8 12H3M16 12h5M4 9h4M16 9h4"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  'echo-overclock': '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/><path d="M13 8l-3 4h4l-3 4"/>',
  'echo-nanites': '<circle cx="6" cy="8" r="1.5"/><circle cx="12" cy="5" r="1.5"/><circle cx="18" cy="9" r="1.5"/><circle cx="8" cy="14" r="1.5"/><circle cx="15" cy="15" r="1.5"/><circle cx="11" cy="20" r="1.5"/><path d="M3 12c3-2 6 2 9 0s6-2 9 0" stroke-dasharray="2 2"/>',
  'echo-swarm': '<rect x="3" y="3" width="6" height="4" rx="1"/><rect x="15" y="3" width="6" height="4" rx="1"/><rect x="3" y="17" width="6" height="4" rx="1"/><rect x="15" y="17" width="6" height="4" rx="1"/><circle cx="12" cy="12" r="2.5"/>',
};

export interface HeroBarActions {
  selectHero(): void;
  useAbility(slot: number): void;
}

/**
 * Hero bar under the map: the hero's call sign, level and XP, and its four ability buttons with
 * icon, key, effect countdown, cooldown, or lock level. Hidden on maps without a hero; rebuilt
 * when the hero changes.
 */
export class HeroBar {
  private buttons: HTMLButtonElement[] = [];
  private heroId = '';
  private level!: HTMLElement;
  private xpFill!: HTMLElement;
  private xpText!: HTMLElement;
  private jammed!: HTMLElement;

  constructor(private readonly root: HTMLElement, private readonly actions: HeroBarActions) {}

  private build(def: HeroDef): void {
    this.heroId = def.id;
    this.root.style.setProperty('--hero-color', def.color);
    this.root.innerHTML = `
      <button class="hero-portrait" title="Select ${def.name} [H]">
        <span class="hero-name">${def.callsign} <span title="${ELEMENTS[def.element].name} hero">${ELEMENTS[def.element].icon}</span></span>
        <span class="hero-level"></span>
        <span class="hero-xp"><span class="hero-xp-fill"></span></span>
        <span class="hero-xp-text"></span>
      </button>
      <div class="hero-abilities">
        ${def.abilities
          .map(
            (a, slot) => `
          <button class="ability" data-slot="${slot}" title="${a.name} [${ABILITY_KEYS[slot]}]: ${a.description}">
            <svg class="ability-icon" viewBox="0 0 24 24" aria-hidden="true">${ABILITY_ICONS[a.id] ?? ''}</svg>
            <span class="ability-text">
              <span class="ability-key">${ABILITY_KEYS[slot]}</span>
              <span class="ability-name">${a.name}</span>
              <span class="ability-state"></span>
            </span>
            <span class="ability-active"></span>
          </button>`,
          )
          .join('')}
      </div>
      <span class="hero-jammed" hidden>⚠ JAMMED</span>`;
    this.level = this.root.querySelector('.hero-level')!;
    this.xpFill = this.root.querySelector('.hero-xp-fill')!;
    this.xpText = this.root.querySelector('.hero-xp-text')!;
    this.jammed = this.root.querySelector('.hero-jammed')!;
    this.root.querySelector('.hero-portrait')!.addEventListener('click', () => this.actions.selectHero());
    this.buttons = [...this.root.querySelectorAll<HTMLButtonElement>('[data-slot]')];
    this.buttons.forEach((b) => b.addEventListener('click', () => this.actions.useAbility(Number(b.dataset.slot))));
  }

  update(game: Game, aiming: number | null, selected: boolean): void {
    const hero = game.hero;
    this.root.hidden = !hero;
    if (!hero) return;
    if (hero.def.id !== this.heroId) this.build(hero.def);
    this.root.classList.toggle('selected', selected);
    this.level.textContent = hero.level >= MAX_HERO_LEVEL ? 'LV MAX' : `LV ${hero.level}`;
    const next = hero.killsForNextLevel;
    const frac = next === null ? 1 : (hero.kills - hero.killsForThisLevel) / (next - hero.killsForThisLevel);
    this.xpFill.style.width = `${Math.round(frac * 100)}%`;
    this.xpText.textContent = next === null ? `${hero.kills} kills` : `${hero.kills}/${next} kills nearby`;
    this.jammed.hidden = !hero.jammed;
    this.buttons.forEach((b, slot) => {
      const a = hero.ability(slot);
      const unlocked = hero.isUnlocked(slot);
      const cd = hero.cooldowns[slot];
      const full = a.cooldown * hero.cooldownMult;
      b.classList.toggle('locked', !unlocked);
      b.classList.toggle('cooling', unlocked && cd > 0);
      b.classList.toggle('ready', unlocked && cd <= 0);
      b.classList.toggle('aiming', aiming === slot);
      b.style.setProperty('--cd', unlocked && cd > 0 ? String(cd / full) : '0');
      // While the cast effect lasts (zones, delays, stuns, buffs, drones), show its countdown.
      const effect = hero.effects[slot];
      const showEffect = effect > 0 && hero.effectLengths[slot] > 0.5;
      b.classList.toggle('active', showEffect);
      b.style.setProperty('--active', showEffect ? String(effect / hero.effectLengths[slot]) : '0');
      const label = a.effect.kind === 'strike' ? 'Impact' : 'Active';
      const state = !unlocked
        ? `🔒 Lv ${a.unlockLevel}`
        : showEffect
          ? `${label} ${effect.toFixed(1)}s`
          : cd > 0
            ? `${Math.ceil(cd)}s`
            : 'Ready';
      const el = b.querySelector('.ability-state')!;
      if (el.textContent !== state) el.textContent = state;
    });
  }
}
