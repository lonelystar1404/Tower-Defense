import { ABILITY_KEYS, HEROES, HERO_IDS, type HeroId } from '../data/hero';
import { ELEMENTS, type ElementId } from '../data/elements';
import { BUILD_ELEMENTS } from '../data/towers';
import { PARTY, PLAYER_COLORS } from '../data/party';
import { LEVELS } from '../data/levels';
import { t } from '../i18n';
import type { LevelDef } from '../data/levels';
import { drawHeroSprite } from '../render/sprites';
import { ABILITY_ICONS, abilityMeta } from './HeroBar';
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

/**
 * Hero select screen, shown before a hero map starts. Laid out like the online lobby: the hero
 * grid (with element filter tabs) on the left, the details of the hero you hover or tap on the
 * right (a pop-up on phones, from each hero's ⓘ). In 'party' mode (local Multiplayer) players
 * pick 2–5 different heroes, one each, in player order.
 */
export class HeroSelect {
  private level: LevelDef | null = null;
  private picked: HeroId = 'vex';
  private mode: 'single' | 'party' = 'single';
  /** Party mode: heroes picked so far, in player order (P1 first). */
  private party: HeroId[] = [];
  private frame = 0;
  /** Which heroes can be picked (second-roster heroes unlock by clearing a map). */
  private unlocked: (id: HeroId) => boolean = () => true;
  /** Hero shown on the right: the last one hovered or tapped. */
  private viewed: HeroId = 'vex';
  /** Element tab: only heroes of this element (null = all). */
  private filter: ElementId | null = null;
  /** Phones: the details pop-up is open. */
  private popup = false;

  constructor(
    private readonly root: HTMLElement,
    /** One hero in single mode; 2–5 (one per player) in party mode. */
    private readonly onDeploy: (level: LevelDef, heroes: HeroId[]) => void,
    private readonly onBack: () => void,
  ) {
    root.addEventListener('click', (ev) => {
      const el = ev.target as HTMLElement;
      if (el.closest('[data-back]')) return this.onBack();
      if (el.closest('[data-deploy]') && this.level) {
        if (this.mode === 'party') {
          if (this.party.length < PARTY.minPlayers) return;
          this.hide();
          return this.onDeploy(this.level, [...this.party]);
        }
        if (!this.unlocked(this.picked)) return;
        saveHero(this.picked);
        this.hide();
        return this.onDeploy(this.level, [this.picked]);
      }
      if (el.closest('[data-sel-popup-close]') || el.classList.contains('lb-popup')) {
        this.popup = false;
        return this.render();
      }
      const filter = el.closest<HTMLElement>('[data-sel-filter]');
      if (filter) {
        this.filter = (filter.dataset.selFilter || null) as ElementId | null;
        return this.render();
      }
      const info = el.closest<HTMLElement>('[data-sel-info]');
      if (info) {
        this.viewed = info.dataset.selInfo as HeroId;
        this.popup = true;
        return this.render();
      }
      const card = el.closest<HTMLElement>('[data-hero]');
      if (!card) return;
      const id = card.dataset.hero as HeroId;
      this.viewed = id;
      if (this.unlocked(id)) {
        if (this.mode === 'party') {
          // Tap to add the next player's hero; tap again to take it back out.
          if (this.party.includes(id)) this.party = this.party.filter((h) => h !== id);
          else if (this.party.length < PARTY.maxPlayers) this.party.push(id);
        } else this.picked = id;
      }
      this.render();
    });
    // Hovering a hero (mouse) shows its details, and they stay while you move over to read its skills.
    root.addEventListener('pointerover', (ev) => {
      if (ev.pointerType !== 'mouse') return;
      const id = (ev.target as HTMLElement).closest<HTMLElement>('.lb-hero-grid [data-hero]')?.dataset.hero as HeroId | undefined;
      if (id && id !== this.viewed) {
        this.viewed = id;
        this.renderDetails();
      }
    });
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  show(level: LevelDef, unlocked: (id: HeroId) => boolean = () => true, mode: 'single' | 'party' = 'single'): void {
    this.level = level;
    this.unlocked = unlocked;
    this.mode = mode;
    this.party = [];
    this.picked = unlocked(lastHero()) ? lastHero() : 'vex';
    this.viewed = this.picked;
    this.popup = false;
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

  /** The hero on the right, with a note: picked, which player has it, or what unlocks it. */
  private detailsHtml(id: HeroId): string {
    const slot = this.party.indexOf(id);
    const unlockMap = LEVELS.find((l) => l.id === HEROES[id].unlockedBy);
    const note = !this.unlocked(id)
      ? `<p class="lb-taken-note">🔒 ${t('Clear {map} to unlock', { map: t(unlockMap?.name ?? 'Core Nexus') })}</p>`
      : this.mode === 'party'
        ? slot >= 0 ? `<p class="lb-taken-note" style="color:${PLAYER_COLORS[slot]}">P${slot + 1}</p>` : ''
        : id === this.picked ? `<p class="lb-taken-note">✓ ${t('Your hero')}</p>` : '';
    return note + heroDetails(id);
  }

  private renderDetails(): void {
    const id = this.viewed;
    const box = this.root.querySelector<HTMLElement>('.lb-details');
    if (box) box.innerHTML = this.detailsHtml(id);
    this.root.querySelectorAll<HTMLElement>('.lb-hero-grid [data-hero]').forEach((b) => b.classList.toggle('viewed', b.dataset.hero === id));
  }

  private render(): void {
    const party = this.mode === 'party';
    const shown = this.viewed;
    const cells = HERO_IDS.filter((id) => !this.filter || HEROES[id].element === this.filter).map((id) => {
      const def = HEROES[id];
      const open = this.unlocked(id);
      const slot = this.party.indexOf(id);
      const picked = party ? slot >= 0 : id === this.picked;
      return `<div class="lb-hero-cell">
        <button class="lb-hero-btn ${picked ? 'picked' : ''} ${open ? '' : 'locked'} ${id === shown ? 'viewed' : ''}" data-hero="${id}" style="--el-color:${def.color}" aria-pressed="${picked}">
          <canvas width="96" height="96" data-portrait="${id}"></canvas>
          <span class="lb-hero-name">${def.callsign}</span>
          <span>${ELEMENTS[def.element].icon} ${t(ELEMENTS[def.element].name)}</span>
          ${open ? '' : '<span class="lb-taken">🔒</span>'}
          ${slot >= 0 ? `<span class="lb-taken" style="color:${PLAYER_COLORS[slot]}">P${slot + 1}</span>` : ''}
        </button>
        <button class="lb-info-btn" data-sel-info="${id}" title="${t('Details')}" aria-label="${t('Details')}: ${def.callsign}">ⓘ</button>
      </div>`;
    }).join('');
    const filters = [null, ...BUILD_ELEMENTS]
      .map((e) => `<button class="${this.filter === e ? 'active' : ''}" data-sel-filter="${e ?? ''}" ${e ? `style="--el-color:${ELEMENTS[e].color}" title="${t(ELEMENTS[e].name)}"` : ''}>${e ? ELEMENTS[e].icon : t('All')}</button>`)
      .join('');
    const covered = new Set(this.party.map((id) => HEROES[id].element));
    const deploy = party
      ? `<button class="primary" data-deploy ${this.party.length < PARTY.minPlayers ? 'disabled' : ''}>${
          this.party.length < PARTY.minPlayers ? t('Pick {n} or more heroes', { n: PARTY.minPlayers }) : t('Start with {n} players', { n: this.party.length })
        }</button>`
      : `<button class="primary" data-deploy>${t('Deploy {name}', { name: HEROES[this.picked].callsign })}</button>`;
    const partyInfo = party
      ? `<div class="party-pick">
          <p>${t('Each player picks a different hero: tap heroes in player order (P1 first), {min} to {max} players. Each player has their own gold and towers; lives are shared.', { min: PARTY.minPlayers, max: PARTY.maxPlayers })}</p>
          <p class="party-elements">${BUILD_ELEMENTS.map((e) => `<span class="${covered.has(e) ? 'on' : ''}" style="--el-color:${ELEMENTS[e].color}" title="${t(ELEMENTS[e].name)}">${ELEMENTS[e].icon}</span>`).join('')}
            ${covered.size >= 5 ? `<b>✦ ${t('Five elements: +{n}% hero damage', { n: Math.round(PARTY.fullElementsAttack * 100) })}</b>` : t('{n}/5 elements · all five give every hero +{pct}% damage', { n: covered.size, pct: Math.round(PARTY.fullElementsAttack * 100) })}</p>
        </div>`
      : '';
    this.root.innerHTML = `
      <div class="menu-card hero-select-card">
        <div class="menu-head">
          <h2>${party ? t('Multiplayer') : t('Choose your hero')} · ${t(this.level?.name ?? '')}</h2>
          <div class="row">
            <button data-back>${t('Back')}</button>
            ${deploy}
          </div>
        </div>
        ${partyInfo}
        <div class="lb-main">
          <section class="lb-pick-col">
            <div class="lb-filter" role="group" aria-label="${t('Element')}">${filters}</div>
            <div class="lb-hero-grid">${cells}</div>
          </section>
          <aside class="lb-details">${this.detailsHtml(shown)}</aside>
        </div>
        <div class="lb-popup" ${this.popup ? '' : 'hidden'}><div class="lb-popup-card"><button class="lb-popup-x" data-sel-popup-close aria-label="${t('Close')}">✕</button><div class="lb-popup-body">${this.popup ? this.detailsHtml(this.viewed) : ''}</div></div></div>
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

/** Which skill each hero's details panel shows (by hero), so it survives re-renders. */
const activeSkill = new Map<HeroId, number>();

/**
 * A hero's full details: profile, then the skills (passive first) as a row of icon tiles with
 * the hovered or tapped skill's name and description under them (see the handlers below), then
 * the stats in two columns. Skills come before stats so the description shows without
 * scrolling. Used by hero select and the online lobby.
 */
export function heroDetails(id: HeroId): string {
  const def = HEROES[id];
  const a = def.attack;
  const kind = a.cleave ? (a.range >= 2 ? t('Grenades, splash around the target') : t('Melee, hits around the target')) : a.chain ? t('Magic bolt, jumps to {n} more', { n: a.chain }) : a.range >= 4 ? t('Long-range shots') : t('Rapid shots');
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const skills = [
    ...(def.passive
      ? [{ icon: ABILITY_ICONS[`${id}-passive`], key: '✦', name: t(def.passive.name), tag: t('Passive'), meta: `✦ ${t('Passive')} · ${t('Always on')}`, text: t(def.passive.description), passive: true }]
      : []),
    ...def.abilities.map((ab, slot) => ({
      icon: ABILITY_ICONS[ab.id], key: ABILITY_KEYS[slot], name: t(ab.name), tag: `${t('Lv')} ${ab.unlockLevel}`, meta: abilityMeta(ab, slot), text: t(ab.description), passive: false,
    })),
  ];
  const active = Math.min(activeSkill.get(id) ?? 0, skills.length - 1);
  return `
    <div class="hero-details" style="--el-color:${def.color}">
      <canvas width="96" height="96" data-portrait="${id}"></canvas>
      ${heroProfile(def)}
      <div class="skill-list" data-skills-of="${id}">
        <h4>${t('Skills')}</h4>
        <ul>
          ${skills.map((sk, i) => `<li><button type="button" class="skill-row ${sk.passive ? 'passive' : ''} ${i === active ? 'active' : ''}" data-skill="${i}" aria-pressed="${i === active}" aria-label="${sk.key} · ${sk.name}" title="${sk.name}">
            <svg viewBox="0 0 24 24" aria-hidden="true">${sk.icon ?? ''}</svg>
            <span class="skill-key">${sk.key}</span>
            <span class="skill-tag">${sk.tag}</span>
          </button></li>`).join('')}
        </ul>
        <div class="skill-desc" aria-live="polite">
          ${skills.map((sk, i) => `<div data-skill-desc="${i}" ${i === active ? '' : 'hidden'}><b>${sk.name}</b><span class="lv">${sk.meta}</span><p>${sk.text}</p></div>`).join('')}
        </div>
      </div>
      <dl class="hero-stats">
        <dt>${t('Attack')}</dt><dd>${kind}</dd>
        <dt>${t('Damage')}</dt><dd>${a.damage}</dd>
        <dt>${t('Fire rate')}</dt><dd>${a.fireRate}/s</dd>
        <dt>${t('Range (tiles)')}</dt><dd>${a.range}</dd>
        <dt>${t('Crit chance')}</dt><dd>${pct(a.critChance)}</dd>
        <dt>${t('Armor pierce')}</dt><dd>${pct(a.armorPierce)}</dd>
        <dt>${t('Move speed')}</dt><dd>${t('{n} tiles/s', { n: def.speed })}</dd>
      </dl>
    </div>`;
}

/** Shows skill `i`'s description in its list (and remembers it for that hero). */
function showSkill(row: HTMLElement): void {
  const list = row.closest<HTMLElement>('.skill-list');
  if (!list) return;
  const i = Number(row.dataset.skill);
  activeSkill.set(list.dataset.skillsOf as HeroId, i);
  list.querySelectorAll<HTMLElement>('.skill-row').forEach((r) => {
    const on = Number(r.dataset.skill) === i;
    r.classList.toggle('active', on);
    r.setAttribute('aria-pressed', String(on));
  });
  list.querySelectorAll<HTMLElement>('[data-skill-desc]').forEach((d) => (d.hidden = Number(d.dataset.skillDesc) !== i));
}

// Hover (mouse), tap, or keyboard focus on a skill shows its description. One set of listeners
// for every details panel, wherever it's drawn.
if (typeof document !== 'undefined') {
  const pick = (ev: Event) => {
    const row = (ev.target as HTMLElement | null)?.closest?.<HTMLElement>('.skill-row');
    if (row) showSkill(row);
  };
  document.addEventListener('pointerover', (ev) => {
    if (ev.pointerType === 'mouse') pick(ev);
  });
  document.addEventListener('click', pick);
  document.addEventListener('focusin', pick);
}

/** Draws the hero portraits (`canvas[data-portrait]`) inside `root`, once. */
export function drawPortraits(root: HTMLElement): void {
  root.querySelectorAll<HTMLCanvasElement>('canvas[data-portrait]').forEach((c) => {
    const def = HEROES[c.dataset.portrait as HeroId];
    const dpr = Math.max(1, Math.round(window.devicePixelRatio || 1));
    c.width = 96 * dpr;
    c.height = 96 * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createRadialGradient(48, 48, 4, 48, 48, 46);
    g.addColorStop(0, `${def.color}44`);
    g.addColorStop(1, `${def.color}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 96, 96);
    drawHeroSprite(ctx, def.id, def.color, 48, 50, 24, -Math.PI / 2, 0);
  });
}
