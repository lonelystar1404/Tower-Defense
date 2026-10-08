import { ELEMENTS } from '../data/elements';
import { ABILITY_KEYS, MAX_HERO_LEVEL, type HeroAbilityDef, type HeroDef } from '../data/hero';
import type { Game } from '../game/Game';
import { getLang, t } from '../i18n';
import { tipAttrs } from './tooltip';

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
  // Ronin
  'kaito-step': '<path d="M3 18l7-7M7 21l7-7" stroke-dasharray="2 2"/><path d="M12 12l9-9"/><path d="M17 3h4v4"/>',
  'kaito-iaido': '<path d="M3 20L20 3"/><path d="M5 22l-3-3 3-1z" fill="currentColor"/><path d="M14 3h7v7" stroke-dasharray="2 1.5"/>',
  'kaito-dance': '<path d="M4 4l16 16M20 4L4 20"/><circle cx="12" cy="12" r="9" stroke-dasharray="3 3"/>',
  'kaito-cuts': '<path d="M3 6l6 3M15 4l3 6M20 14l-6 2M10 20l-2-6M5 15l5-2"/><circle cx="12" cy="12" r="2" fill="currentColor"/>',
  // Tide
  'nalani-riptide': '<path d="M12 12m-2 0a2 2 0 1 0 4 0M12 7a5 5 0 1 1-5 5M12 3a9 9 0 1 1-9 9"/>',
  'nalani-wave': '<path d="M2 17c3-6 7-9 11-9 3 0 5 2 5 4s-2 3-4 2"/><path d="M2 21h20" stroke-dasharray="3 2"/>',
  'nalani-dive': '<path d="M12 3v10"/><path d="M8 9l4 4 4-4"/><path d="M3 17c2 0 2 2 4.5 2S10 17 12 17s2 2 4.5 2S19 17 21 17"/>',
  'nalani-tsunami': '<path d="M2 20c2-10 9-15 18-15-4 2-6 5-6 8 0 2 1 3 3 3"/><path d="M2 20h20"/>',
  // Forge
  'ines-charge': '<rect x="7" y="9" width="10" height="9" rx="1"/><path d="M12 9V5l3-2"/><path d="M10 13h4" stroke-dasharray="1.5 1"/>',
  'ines-surge': '<path d="M13 2L6 13h5l-1 9 7-11h-5z"/><path d="M3 21h4M17 21h4" stroke-dasharray="2 1"/>',
  'ines-barricade': '<path d="M3 20h18M5 20V9l3-3 3 3v11M13 20V9l3-3 3 3v11"/><path d="M5 13h6M13 13h6"/>',
  'ines-patch': '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/><path d="M12 8v8M8 12h8"/>',
  // Rua
  'rua-thorns': '<path d="M3 21l3-8 2 5 3-11 3 9 2-6 2 4 3-3v10z" fill="currentColor" fill-opacity=".2"/>',
  'rua-bramble': '<path d="M3 15c3-4 6 2 9-2s6 2 9-2"/><path d="M6 13l-1-3M11 13l1-3M16 12l1-3M8 17l-1 3M14 16l1 3"/>',
  'rua-spores': '<circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="1.5"/><circle cx="19" cy="5" r="1.2"/><circle cx="20" cy="16" r="1.6"/><circle cx="4" cy="17" r="1.2"/><circle cx="12" cy="21" r="1"/>',
  'rua-worldroot': '<path d="M12 2v8M12 10c-4 2-6 6-7 12M12 10c4 2 6 6 7 12M12 10v12M8 15l-4 1M16 15l4 1"/>',
  // Flare
  'zeynep-napalm': '<path d="M12 2c3 4 6 7 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3 0-2 0-4 0-7z" fill="currentColor" fill-opacity=".2"/>',
  'zeynep-flash': '<circle cx="12" cy="12" r="4"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4M4 4l3 3M17 17l3 3M4 20l3-3M17 7l3-3"/>',
  'zeynep-incendiary': '<path d="M3 10h11l3 2-3 2H3z"/><path d="M19 8c1 1 2 2 2 4s-1 3-2 4" stroke-dasharray="2 1.5"/><path d="M6 10v4M9 10v4"/>',
  'zeynep-sunfall': '<path d="M9 2h6l-1 12h-4z" fill="currentColor" fill-opacity=".2"/><path d="M4 22c2-4 5-6 8-6s6 2 8 6"/><path d="M12 14v3"/>',
  // Passives (shown as an always-on ability tile)
  'vex-passive': '<circle cx="12" cy="13" r="6"/><path d="M12 7v3M12 16v3M6 13h3M15 13h3"/><path d="M8 3.5a6 6 0 0 1 8 0M10 5.5a3 3 0 0 1 4 0"/>',
  'mateo-passive': '<rect x="7" y="7" width="10" height="9" rx="2"/><path d="M7 10.5h10M10 7v3.5M13.5 7v3.5"/><path d="M3 21l3-2.5M21 21l-3-2.5M12 22v-3"/>',
  'leila-passive': '<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/>',
  'arjun-passive': '<path d="M12 3l1.8 4.5L18 6l-1.5 4.5L21 12l-4.5 1.5L18 18l-4.2-1.5L12 21l-1.8-4.5L6 18l1.5-4.5L3 12l4.5-1.5L6 6l4.2 1.5z"/>',
  'echo-passive': '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/><path d="M10 12h4M12 10v4"/>',
  'kaito-passive': '<path d="M4 20L18 6"/><path d="M15 3l6 6"/><path d="M6 14l4 4"/><circle cx="17" cy="17" r="3" stroke-dasharray="2 1.5"/>',
  'nalani-passive': '<circle cx="12" cy="12" r="9" stroke-dasharray="3 2"/><path d="M6 13c2-2 4 2 6 0s4 2 6 0"/>',
  'ines-passive': '<path d="M14 4a4 4 0 0 0-5 5L3 15l3 3 6-6a4 4 0 0 0 5-5l-2 2-2-1-1-2z"/><path d="M17 15v6M14 18h6"/>',
  'rua-passive': '<path d="M5 19C5 10 11 4 20 4c0 9-6 15-15 15z"/><path d="M5 19l9-9"/>',
  'zeynep-passive': '<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5c-.5-1-1.5-1.5-2.5-1.5-1.5 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1 0-2-.5-2.5-1.5M12 6.5v1.5M12 16v1.5"/>',
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
    this.heroId = `${def.id}:${getLang()}`;
    this.root.style.setProperty('--hero-color', def.color);
    this.root.innerHTML = `
      <button class="hero-portrait" title="${t('Select {name}', { name: def.name })} [H]">
        <span class="hero-name">${def.callsign} <span title="${t('{element} hero', { element: t(ELEMENTS[def.element].name) })}">${ELEMENTS[def.element].icon}</span></span>
        <span class="hero-level"></span>
        <span class="hero-xp"><span class="hero-xp-fill"></span></span>
        <span class="hero-xp-text"></span>
      </button>
      <div class="hero-abilities">
        ${
          def.passive
            ? `<div class="ability passive" ${tipAttrs(t(def.passive.name), `✦ ${t('Passive')} · ${t('Always on')}`, t(def.passive.description), def.color)}>
            <span class="ability-clock"><svg class="ability-icon" viewBox="0 0 24 24" aria-hidden="true">${ABILITY_ICONS[`${def.id}-passive`] ?? ''}</svg></span>
            <span class="ability-text">
              <span class="ability-key">✦</span>
              <span class="ability-name">${t(def.passive.name)}</span>
              <span class="ability-state">${t('Always on')}</span>
            </span>
          </div>`
            : ''
        }
        ${def.abilities
          .map(
            (a, slot) => `
          <button class="ability" data-slot="${slot}" ${tipAttrs(t(a.name), abilityMeta(a, slot), t(a.description), def.color)}>
            <span class="ability-clock">
              <svg class="ability-icon" viewBox="0 0 24 24" aria-hidden="true">${ABILITY_ICONS[a.id] ?? ''}</svg>
              <span class="clock-hand"></span>
            </span>
            <span class="ability-text">
              <span class="ability-key">${ABILITY_KEYS[slot]}</span>
              <span class="ability-name">${t(a.name)}</span>
              <span class="ability-state"></span>
            </span>
          </button>`,
          )
          .join('')}
      </div>
      <span class="hero-jammed" hidden>⚠ ${t('JAMMED')}</span>`;
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
    if (`${hero.def.id}:${getLang()}` !== this.heroId) this.build(hero.def);
    this.root.classList.toggle('selected', selected);
    this.level.textContent = hero.level >= MAX_HERO_LEVEL ? t('LV MAX') : `${t('LV')} ${hero.level}`;
    const next = hero.killsForNextLevel;
    const frac = next === null ? 1 : (hero.kills - hero.killsForThisLevel) / (next - hero.killsForThisLevel);
    this.xpFill.style.width = `${Math.round(frac * 100)}%`;
    this.xpText.textContent = next === null ? t('{n} kills', { n: hero.kills }) : t('{kills}/{next} kills nearby', { kills: hero.kills, next });
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
      // While the cast effect lasts (zones, delays, stuns, buffs, drones), show its countdown.
      const effect = hero.effects[slot];
      const showEffect = effect > 0 && hero.effectLengths[slot] > 0.5;
      b.classList.toggle('active', showEffect);
      // Clock face: the hand sweeps clockwise from 12 o'clock through the effect (if one is
      // running), else through the recharge. The last second flashes.
      const sweep = showEffect ? 1 - effect / hero.effectLengths[slot] : unlocked && cd > 0 ? 1 - cd / full : 0;
      b.style.setProperty('--sweep', sweep.toFixed(4));
      b.classList.toggle('ending', (showEffect && effect <= 1) || (!showEffect && unlocked && cd > 0 && cd <= 1));
      // A short pop when an ability comes off cooldown.
      const wasCooling = b.dataset.cooling === '1';
      b.dataset.cooling = unlocked && cd > 0 ? '1' : '0';
      if (wasCooling && cd <= 0) {
        b.classList.remove('just-ready');
        void b.offsetWidth;
        b.classList.add('just-ready');
      }
      const label = a.effect.kind === 'strike' ? t('Impact') : t('Active');
      const state = !unlocked
        ? `🔒 ${t('Lv')} ${a.unlockLevel}`
        : showEffect
          ? `${label} ${effect.toFixed(1)}s`
          : cd > 0
            ? `${Math.ceil(cd)}s`
            : t('Ready');
      const el = b.querySelector('.ability-state')!;
      if (el.textContent !== state) el.textContent = state;
    });
  }
}

/** "Z · Lv 3 · cooldown 18s": the muted line in an ability's tooltip. */
export function abilityMeta(a: HeroAbilityDef, slot: number): string {
  return `${ABILITY_KEYS[slot]} · ${t('Unlocks at Lv {n}', { n: a.unlockLevel })} · ${t('cooldown {n}s', { n: a.cooldown })}`;
}
