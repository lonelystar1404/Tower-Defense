import { ELEMENTS } from '../data/elements';
import { HEROES, HERO_IDS, type HeroId } from '../data/hero';
import type { LevelDef } from '../data/levels';
import { PARTY, PLAYER_COLORS } from '../data/party';
import { BUILD_ELEMENTS } from '../data/towers';
import { t } from '../i18n';
import type { RoomState } from '../net/online';
import { drawPortraits, heroDetails } from './HeroSelect';

export interface LobbyActions {
  /** Play the party on this device (no room). */
  local(level: LevelDef): void;
  create(level: LevelDef): void;
  join(level: LevelDef, code: string): void;
  pickHero(hero: HeroId): void;
  start(): void;
  /** Leave the room (or close the chooser). */
  back(): void;
}

/**
 * Multiplayer screens: first the choice (online room or this device), then the room lobby with
 * its code, the players, and a hero picker (each player a different hero). Plain view: main.ts
 * drives it with the room state.
 */
export class Lobby {
  private level: LevelDef | null = null;
  private view: 'choose' | 'busy' | 'room' = 'choose';
  private message = '';
  private room: { code: string; uid: string; isHost: boolean; state: RoomState } | null = null;
  /** Hero shown in the details panel (the last one tapped). */
  private viewed: HeroId | null = null;

  constructor(private readonly root: HTMLElement, private readonly actions: LobbyActions, private readonly member: () => string) {
    root.addEventListener('click', (ev) => {
      const el = ev.target as HTMLElement;
      const level = this.level;
      if (!level) return;
      if (el.closest('[data-lb-back]')) return this.actions.back();
      if (el.closest('[data-lb-local]')) return this.actions.local(level);
      if (el.closest('[data-lb-create]')) return this.actions.create(level);
      if (el.closest('[data-lb-join]')) {
        const code = (this.root.querySelector('#lb-code') as HTMLInputElement | null)?.value ?? '';
        return this.actions.join(level, code);
      }
      if (el.closest('[data-lb-start]')) return this.actions.start();
      const hero = el.closest<HTMLElement>('[data-lb-hero]');
      if (hero) {
        // Tapping shows the hero's details; a free hero is also picked.
        const id = hero.dataset.lbHero as HeroId;
        this.viewed = id;
        if (hero.classList.contains('taken')) this.render();
        else this.actions.pickHero(id);
      }
    });
    root.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && (ev.target as HTMLElement).id === 'lb-code' && this.level) {
        this.actions.join(this.level, (ev.target as HTMLInputElement).value);
      }
    });
  }

  get open(): boolean {
    return !this.root.hidden;
  }

  /** The multiplayer chooser for `level`; `rejoin` offers going back to a recent room. */
  choose(level: LevelDef, message = '', rejoin?: string): void {
    this.level = level;
    this.view = 'choose';
    this.message = message;
    this.room = null;
    this.render(rejoin);
    this.root.hidden = false;
  }

  busy(message: string): void {
    this.view = 'busy';
    this.message = message;
    this.render();
    this.root.hidden = false;
  }

  showRoom(code: string, uid: string, isHost: boolean, state: RoomState): void {
    this.view = 'room';
    this.room = { code, uid, isHost, state };
    this.render();
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  refresh(): void {
    if (this.open) this.render();
  }

  private render(rejoin?: string): void {
    const level = this.level;
    const head = (title: string, extra = '') => `
      <div class="menu-head">
        <h2>${title}${level ? ` · ${t(level.name)}` : ''}</h2>
        <div class="row">${extra}<button data-lb-back>${this.view === 'room' ? t('Leave') : t('Back')}</button></div>
      </div>`;
    const msg = this.message ? `<p class="lb-msg">${this.message}</p>` : '';
    if (this.view === 'busy') {
      this.root.innerHTML = `<div class="menu-card lobby-card">${head(t('Multiplayer'))}<p class="lb-busy">${this.message}</p></div>`;
      return;
    }
    if (this.view === 'choose' || !this.room) {
      this.root.innerHTML = `
        <div class="menu-card lobby-card">
          ${head(t('Multiplayer'))}
          ${msg}
          <div class="lb-options">
            <section class="lb-option">
              <h3>🌐 ${t('Online room')}</h3>
              <p>${t('Each player on their own phone, tablet, or computer. One player creates a room and shares its code; {min}–{max} players.', { min: PARTY.minPlayers, max: PARTY.maxPlayers })}</p>
              <button class="primary" data-lb-create>${t('Create a room')}</button>
              <div class="lb-join">
                <input id="lb-code" maxlength="5" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="${t('Code')}" value="${rejoin ?? ''}" aria-label="${t('Room code')}" />
                <button data-lb-join>${rejoin ? t('Rejoin') : t('Join')}</button>
              </div>
            </section>
            <section class="lb-option">
              <h3>📱 ${t('This device')}</h3>
              <p>${t('Pass one device around: everyone picks a hero, then tap a player under the map to play as them.')}</p>
              <button data-lb-local>${t('Play on this device')}</button>
            </section>
          </div>
          <p class="lb-member">${t('Member ID')} <b>${this.member()}</b></p>
        </div>`;
      return;
    }
    const { code, uid, isHost, state } = this.room;
    const players = [...state.players].sort((a, b) => (a.uid === state.meta?.host ? -1 : b.uid === state.meta?.host ? 1 : 0));
    const takenBy = new Map(players.filter((p) => p.hero).map((p) => [p.hero!, players.indexOf(p)]));
    const mine = players.find((p) => p.uid === uid)?.hero ?? null;
    const heroes = players.map((p) => p.hero);
    const ready = players.length >= PARTY.minPlayers && heroes.every(Boolean) && new Set(heroes).size === heroes.length;
    const covered = new Set(heroes.filter(Boolean).map((h) => HEROES[h!].element));
    const list = players
      .map((p, i) => {
        const def = p.hero ? HEROES[p.hero] : null;
        return `<li style="--player-color:${PLAYER_COLORS[i]}">
          <span class="party-num">P${i + 1}</span>
          <span class="lb-who">${p.uid === uid ? `<b>${t('You')}</b>` : p.member}${p.uid === state.meta?.host ? ` <i>${t('host')}</i>` : ''}</span>
          <span class="lb-hero" ${def ? `style="color:${def.color}"` : ''}>${def ? `${def.callsign} ${ELEMENTS[def.element].icon}` : t('choosing…')}</span>
        </li>`;
      })
      .join('');
    const empty = Array.from({ length: PARTY.maxPlayers - players.length }, (_, i) => `<li class="lb-empty"><span class="party-num">P${players.length + i + 1}</span><span class="lb-who">${t('open')}</span></li>`).join('');
    const viewed = this.viewed ?? mine ?? HERO_IDS[0];
    const viewedBy = takenBy.get(viewed);
    const picker = HERO_IDS.map((id) => {
      const def = HEROES[id];
      const by = takenBy.get(id);
      const taken = by !== undefined && players[by].uid !== uid;
      return `<button class="lb-hero-btn ${id === mine ? 'picked' : ''} ${taken ? 'taken' : ''} ${id === viewed ? 'viewed' : ''}" data-lb-hero="${id}" style="--el-color:${def.color}" aria-pressed="${id === mine}">
        <span class="lb-hero-name">${def.callsign}</span>
        <span>${ELEMENTS[def.element].icon} ${t(ELEMENTS[def.element].name)}</span>
        ${taken ? `<span class="lb-taken" style="color:${PLAYER_COLORS[by!]}">P${by! + 1}</span>` : ''}
      </button>`;
    }).join('');
    const start = isHost
      ? `<button class="primary" data-lb-start ${ready ? '' : 'disabled'}>${ready ? t('Start with {n} players', { n: players.length }) : players.length < PARTY.minPlayers ? t('Waiting for players…') : t('Waiting for heroes…')}</button>`
      : `<span class="lb-wait">${t('Waiting for the host to start…')}</span>`;
    this.root.innerHTML = `
      <div class="menu-card lobby-card">
        ${head(t('Online room'), start)}
        <div class="lb-room">
          <div class="lb-code-box">
            <span class="score-label">${t('Room code')}</span>
            <span class="lb-code">${code}</span>
            <span class="lb-share">${t('Share this code: friends tap Multiplayer → Join.')}</span>
          </div>
          <ul class="lb-players">${list}${empty}</ul>
        </div>
        <p class="party-elements">${BUILD_ELEMENTS.map((e) => `<span class="${covered.has(e) ? 'on' : ''}" style="--el-color:${ELEMENTS[e].color}">${ELEMENTS[e].icon}</span>`).join('')}
          ${covered.size >= 5 ? `<b>✦ ${t('Five elements: +{n}% hero damage', { n: Math.round(PARTY.fullElementsAttack * 100) })}</b>` : t('{n}/5 elements · all five give every hero +{pct}% damage', { n: covered.size, pct: Math.round(PARTY.fullElementsAttack * 100) })}</p>
        <h3 class="lb-pick-title">${t('Pick your hero')}</h3>
        <div class="lb-pick">
          <div class="lb-hero-grid">${picker}</div>
          <aside class="lb-details">
            ${viewedBy !== undefined && players[viewedBy].uid !== uid ? `<p class="lb-taken-note" style="color:${PLAYER_COLORS[viewedBy]}">${t('Taken by P{n}', { n: viewedBy + 1 })}</p>` : viewed === mine ? `<p class="lb-taken-note">✓ ${t('Your hero')}</p>` : ''}
            ${heroDetails(viewed)}
          </aside>
        </div>
      </div>`;
    drawPortraits(this.root);
  }
}
