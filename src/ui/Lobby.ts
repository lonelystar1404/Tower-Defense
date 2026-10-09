import { ELEMENTS } from '../data/elements';
import { HEROES, HERO_IDS, type HeroId } from '../data/hero';
import type { LevelDef } from '../data/levels';
import { PARTY, PLAYER_COLORS } from '../data/party';
import { BUILD_ELEMENTS } from '../data/towers';
import type { ElementId } from '../data/elements';
import { t } from '../i18n';
import type { ChatMessage, RoomState } from '../net/online';
import { drawPortraits, heroDetails } from './HeroSelect';

export interface LobbyActions {
  /** Play the party on this device (no room). */
  local(level: LevelDef): void;
  create(level: LevelDef): void;
  join(level: LevelDef, code: string): void;
  pickHero(hero: HeroId): void;
  setReady(ready: boolean): void;
  chat(text: string): void;
  /** Leave the room (or close the chooser). */
  back(): void;
}

/** Longest chat message (also enforced by the database rules). */
export const CHAT_MAX = 200;

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Multiplayer screens: first the choice (online room or this device), then the room lobby in a
 * "champion select" layout: the five player cards in a strip across the top, the hero grid with
 * element filters and the tapped hero's details below, and the chat and READY along the bottom.
 * When everyone has picked and is ready, a short countdown runs and the game starts. On phones the
 * details open as a pop-up. Plain view: main.ts drives it with the room state.
 */
export class Lobby {
  private level: LevelDef | null = null;
  private view: 'choose' | 'busy' | 'room' = 'choose';
  private message = '';
  private room: { code: string; uid: string; isHost: boolean; state: RoomState } | null = null;
  /** Hero shown in the details panel (the last one tapped). */
  private viewed: HeroId | null = null;
  private chatLog: ChatMessage[] = [];
  private chatOpen = true;
  /** Messages that arrived while the chat was collapsed. */
  private unread = 0;
  /** Element filter on the hero grid (null = all). */
  private filter: ElementId | null = null;
  /** Phones: the details pop-up is open. */
  private popup = false;
  /** Seconds until the game starts (everyone ready), or null. */
  private countdown: number | null = null;

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
      const ready = el.closest<HTMLButtonElement>('[data-lb-ready]');
      if (ready && !ready.disabled) return this.actions.setReady(ready.dataset.lbReady !== '1');
      if (el.closest('[data-lb-chat-toggle]')) {
        this.chatOpen = !this.chatOpen;
        this.unread = 0;
        return this.updateChat();
      }
      if (el.closest('[data-lb-send]')) return this.sendChat();
      if (el.closest('[data-lb-copy]')) return this.copyCode(el.closest<HTMLElement>('[data-lb-copy]')!);
      const filter = el.closest<HTMLElement>('[data-lb-filter]');
      if (filter) {
        this.filter = (filter.dataset.lbFilter || null) as ElementId | null;
        return this.updateRoom();
      }
      if (el.closest('[data-lb-popup-close]') || el.classList.contains('lb-popup')) {
        this.popup = false;
        return this.updateRoom();
      }
      const info = el.closest<HTMLElement>('[data-lb-info]');
      if (info) {
        this.viewed = info.dataset.lbInfo as HeroId;
        this.popup = true;
        return this.updateRoom();
      }
      const hero = el.closest<HTMLElement>('[data-lb-hero]');
      if (hero) {
        // Tapping shows the hero's details; a free hero is also picked (if you're not ready yet).
        const id = hero.dataset.lbHero as HeroId;
        this.viewed = id;
        if (hero.classList.contains('taken') || this.amReady()) this.updateRoom();
        else this.actions.pickHero(id);
      }
    });
    root.addEventListener('keydown', (ev) => {
      const target = ev.target as HTMLElement;
      if (ev.key === 'Enter' && target.id === 'lb-code' && this.level) this.actions.join(this.level, (target as HTMLInputElement).value);
      if (ev.key === 'Enter' && target.id === 'lb-chat-input') this.sendChat();
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
    this.chatLog = [];
    this.renderChooser(rejoin);
    this.root.hidden = false;
  }

  busy(message: string): void {
    this.view = 'busy';
    this.message = message;
    this.root.innerHTML = `<div class="menu-card lobby-card">${this.head(t('Multiplayer'))}<p class="lb-busy">${message}</p></div>`;
    this.root.hidden = false;
  }

  showRoom(code: string, uid: string, isHost: boolean, state: RoomState): void {
    const fresh = this.view !== 'room' || this.room?.code !== code;
    this.view = 'room';
    this.room = { code, uid, isHost, state };
    if (fresh || !this.root.querySelector('.lb-strip')) this.renderRoomShell();
    this.updateRoom();
    this.root.hidden = false;
  }

  /** The room's chat (oldest first), shown over the hero details. */
  setChat(messages: ChatMessage[]): void {
    const added = messages.length - this.chatLog.length;
    this.chatLog = messages;
    if (!this.chatOpen && added > 0) this.unread += added;
    if (this.view === 'room') this.updateChat();
  }

  /** Seconds left before the game starts, or null when not everyone is ready. */
  setCountdown(seconds: number | null): void {
    if (seconds === this.countdown) return;
    this.countdown = seconds;
    if (this.view === 'room') this.updateBottom();
  }

  hide(): void {
    this.root.hidden = true;
  }

  private copyCode(button: HTMLElement): void {
    if (!this.room) return;
    navigator.clipboard?.writeText(this.room.code).then(
      () => {
        button.textContent = `✓ ${t('Copied!')}`;
        setTimeout(() => (button.textContent = `⧉ ${t('Copy code')}`), 1200);
      },
      () => {},
    );
  }

  refresh(): void {
    if (!this.open) return;
    if (this.view === 'room') {
      this.renderRoomShell();
      this.updateRoom();
    } else if (this.view === 'choose') this.renderChooser();
  }

  private amReady(): boolean {
    return !!this.room?.state.players.find((p) => p.uid === this.room!.uid)?.ready;
  }

  private sendChat(): void {
    const input = this.root.querySelector<HTMLInputElement>('#lb-chat-input');
    const text = input?.value.trim() ?? '';
    if (!input || !text) return;
    this.actions.chat(text.slice(0, CHAT_MAX));
    input.value = '';
  }

  private head(title: string): string {
    const level = this.level;
    return `
      <div class="menu-head">
        <h2>${title}${level ? ` · ${t(level.name)}` : ''}</h2>
        <div class="row"><button data-lb-back>${this.view === 'room' ? t('Leave') : t('Back')}</button></div>
      </div>`;
  }

  private renderChooser(rejoin?: string): void {
    const msg = this.message ? `<p class="lb-msg">${this.message}</p>` : '';
    this.root.innerHTML = `
      <div class="menu-card lobby-card">
        ${this.head(t('Multiplayer'))}
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
  }

  /** The room's fixed layout; its parts are filled by updateRoom (so the chat input keeps its text). */
  private renderRoomShell(): void {
    const level = this.level;
    this.root.innerHTML = `
      <div class="menu-card lobby-card lobby-room">
        <div class="lb-top">
          <h2>${t('Online room')}</h2>
          <span class="lb-code">${this.room?.code ?? ''}</span>
          <button class="lb-copy" data-lb-copy title="${t('Share this code: friends tap Multiplayer → Join.')}">⧉ ${t('Copy code')}</button>
          <span class="lb-map">${level ? `${t(level.name)} · ${t('{n} waves', { n: level.waves.length })}` : ''}</span>
          <button data-lb-back>${t('Leave')}</button>
        </div>
        <ol class="lb-strip"></ol>
        <p class="party-elements"></p>
        <div class="lb-main">
          <section class="lb-pick-col">
            <div class="lb-filter" role="group" aria-label="${t('Element')}"></div>
            <div class="lb-hero-grid"></div>
          </section>
          <aside class="lb-details"></aside>
        </div>
        <div class="lb-bottom">
          <div class="lb-chat">
            <button class="lb-chat-head" data-lb-chat-toggle></button>
            <ol class="lb-chat-log" aria-live="polite"></ol>
            <div class="lb-chat-send">
              <input id="lb-chat-input" maxlength="${CHAT_MAX}" autocomplete="off" placeholder="${t('Say something…')}" aria-label="${t('Chat message')}" />
              <button data-lb-send>${t('Send')}</button>
            </div>
          </div>
          <div class="lb-go">
            <button class="lb-ready-btn" data-lb-ready="0"></button>
            <p class="lb-status"></p>
          </div>
        </div>
        <div class="lb-popup" hidden><div class="lb-popup-card"><button class="lb-popup-x" data-lb-popup-close aria-label="${t('Close')}">✕</button><div class="lb-popup-body"></div></div></div>
      </div>`;
    this.updateChat();
  }

  private updateRoom(): void {
    if (!this.room) return;
    const { uid, state } = this.room;
    const players = this.playersInOrder();
    const takenBy = new Map(players.filter((p) => p.hero).map((p) => [p.hero!, players.indexOf(p)]));
    const mine = players.find((p) => p.uid === uid)?.hero ?? null;
    const heroes = players.map((p) => p.hero);
    const covered = new Set(heroes.filter(Boolean).map((h) => HEROES[h!].element));

    // Top: the five player cards.
    this.set('.lb-strip', Array.from({ length: PARTY.maxPlayers }, (_, i) => {
      const p = players[i];
      if (!p) return `<li class="lb-slot empty"><span class="party-num">P${i + 1}</span><span class="lb-slot-name">${t('open')}</span></li>`;
      const def = p.hero ? HEROES[p.hero] : null;
      return `<li class="lb-slot ${p.ready ? 'is-ready' : ''} ${p.uid === uid ? 'me' : ''}" style="--player-color:${PLAYER_COLORS[i]}${def ? `;--el-color:${def.color}` : ''}">
        ${def ? `<canvas width="96" height="96" data-portrait="${p.hero}"></canvas>` : '<span class="lb-slot-q">?</span>'}
        <span class="lb-slot-text">
          <span class="party-num">P${i + 1}${p.uid === state.meta?.host ? ` <i>${t('host')}</i>` : ''}</span>
          <span class="lb-slot-name">${p.uid === uid ? t('You') : p.member}</span>
          <span class="lb-slot-hero">${def ? `${def.callsign} ${ELEMENTS[def.element].icon}` : t('choosing…')}</span>
        </span>
        <span class="lb-ready-mark" title="${p.ready ? t('Ready') : t('Not ready')}">${p.ready ? '✓' : '…'}</span>
      </li>`;
    }).join(''));

    this.set('.party-elements', `${BUILD_ELEMENTS.map((e) => `<span class="${covered.has(e) ? 'on' : ''}" style="--el-color:${ELEMENTS[e].color}" title="${t(ELEMENTS[e].name)}">${ELEMENTS[e].icon}</span>`).join('')}
      ${covered.size >= 5 ? `<b>✦ ${t('Five elements: +{n}% hero damage', { n: Math.round(PARTY.fullElementsAttack * 100) })}</b>` : t('{n}/5 elements · all five give every hero +{pct}% damage', { n: covered.size, pct: Math.round(PARTY.fullElementsAttack * 100) })}`);

    // Middle: element tabs and the hero grid.
    this.set('.lb-filter', [null, ...BUILD_ELEMENTS].map((e) => `<button class="${this.filter === e ? 'active' : ''}" data-lb-filter="${e ?? ''}" ${e ? `style="--el-color:${ELEMENTS[e].color}" title="${t(ELEMENTS[e].name)}"` : ''}>${e ? ELEMENTS[e].icon : t('All')}</button>`).join(''));
    const viewed = this.viewed ?? mine ?? HERO_IDS[0];
    this.set('.lb-hero-grid', HERO_IDS.filter((id) => !this.filter || HEROES[id].element === this.filter).map((id) => {
      const def = HEROES[id];
      const by = takenBy.get(id);
      const taken = by !== undefined && players[by].uid !== uid;
      return `<div class="lb-hero-cell">
        <button class="lb-hero-btn ${id === mine ? 'picked' : ''} ${taken ? 'taken' : ''} ${id === viewed ? 'viewed' : ''}" data-lb-hero="${id}" style="--el-color:${def.color}" aria-pressed="${id === mine}">
          <canvas width="96" height="96" data-portrait="${id}"></canvas>
          <span class="lb-hero-name">${def.callsign}</span>
          <span>${ELEMENTS[def.element].icon} ${t(ELEMENTS[def.element].name)}</span>
          ${by !== undefined ? `<span class="lb-taken" style="color:${PLAYER_COLORS[by]}">P${by + 1}</span>` : ''}
        </button>
        <button class="lb-info-btn" data-lb-info="${id}" title="${t('Details')}" aria-label="${t('Details')}: ${def.callsign}">ⓘ</button>
      </div>`;
    }).join(''));

    // Right (pop-up on phones): the hero's details.
    const viewedBy = takenBy.get(viewed);
    const note = viewedBy !== undefined && players[viewedBy].uid !== uid
      ? `<p class="lb-taken-note" style="color:${PLAYER_COLORS[viewedBy]}">${t('Taken by P{n}', { n: viewedBy + 1 })}</p>`
      : viewed === mine
        ? `<p class="lb-taken-note">✓ ${t('Your hero')}</p>`
        : '';
    const details = `${note}${heroDetails(viewed)}`;
    this.set('.lb-details', details);
    const popup = this.root.querySelector<HTMLElement>('.lb-popup');
    if (popup) {
      popup.hidden = !this.popup;
      if (this.popup) this.set('.lb-popup-body', details);
    }
    drawPortraits(this.root);
    this.updateBottom();
    this.updateChat();
  }

  /** READY and the status / countdown under it. */
  private updateBottom(): void {
    if (!this.room) return;
    const players = this.playersInOrder();
    const me = players.find((p) => p.uid === this.room!.uid);
    const ready = !!me?.ready;
    const button = this.root.querySelector<HTMLButtonElement>('.lb-ready-btn');
    if (button) {
      button.dataset.lbReady = ready ? '1' : '0';
      button.disabled = !me?.hero;
      button.classList.toggle('primary', !ready && !!me?.hero);
      const label = ready ? `✓ ${t('Ready')} · ${t('tap to change')}` : me?.hero ? t('Ready') : t('Pick a hero first');
      if (button.textContent !== label) button.textContent = label;
    }
    const status = this.countdown !== null
      ? `<b class="lb-count">${t('Starting in {n}…', { n: this.countdown })}</b>`
      : players.length < PARTY.minPlayers
        ? t('Waiting for players…')
        : t('Starts when everyone has picked a hero and is ready.');
    this.set('.lb-status', status);
  }

  /** Players in lobby order: the host first, then by when they joined (P1 = host). */
  private playersInOrder() {
    const { state } = this.room!;
    return [...state.players].sort((a, b) => (a.uid === state.meta?.host ? -1 : b.uid === state.meta?.host ? 1 : 0));
  }

  private updateChat(): void {
    const head = this.root.querySelector<HTMLElement>('.lb-chat-head');
    const log = this.root.querySelector<HTMLElement>('.lb-chat-log');
    const chat = this.root.querySelector<HTMLElement>('.lb-chat');
    if (!head || !log || !chat || !this.room) return;
    chat.classList.toggle('collapsed', !this.chatOpen);
    head.innerHTML = `💬 ${t('Chat')}${this.unread ? ` <b>${this.unread}</b>` : ''} <span>${this.chatOpen ? '▾' : '▸'}</span>`;
    const players = this.playersInOrder();
    const html = this.chatLog.length
      ? this.chatLog
          .map((m) => {
            const i = players.findIndex((p) => p.uid === m.u);
            const color = i >= 0 ? PLAYER_COLORS[i] : 'var(--muted)';
            const who = m.u === this.room!.uid ? t('You') : i >= 0 ? `P${i + 1}` : m.member;
            return `<li><b style="color:${color}">${escapeHtml(who)}</b> ${escapeHtml(m.text)}</li>`;
          })
          .join('')
      : `<li class="lb-chat-empty">${t('Say hi and plan your heroes.')}</li>`;
    if (log.innerHTML !== html) {
      const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 30;
      log.innerHTML = html;
      if (atBottom) log.scrollTop = log.scrollHeight;
    }
  }

  private set(selector: string, html: string): void {
    const el = this.root.querySelector<HTMLElement>(selector);
    if (el && el.innerHTML !== html) el.innerHTML = html;
  }
}
