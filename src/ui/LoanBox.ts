import { LOAN, PLAYER_COLORS } from '../data/party';
import { loanOwed, type Game, type GameNotice } from '../game/Game';
import { t } from '../i18n';
import { playerLabel } from './PartyBar';

export interface LoanActions {
  /** Ask player `to` for `amount` gold (0 withdraws the request). */
  ask(to: number, amount: number): void;
  /** As `lender`, lend to (`yes`) or refuse `borrower`. */
  answer(lender: number, borrower: number, yes: boolean): void;
}

/** How long a loan message stays up, in seconds. */
const NOTICE_TIME = 6;

/**
 * Multiplayer loans, over the bottom right of the map: the borrow panel (pick a player and an
 * amount; opened from the party bar between waves), requests waiting for an answer (Lend /
 * Decline), and loan news (lent, declined, paid back in full). Online, each player only sees
 * what involves them; on a shared device everyone sees everything.
 */
export class LoanBox {
  /** The borrow panel is open. */
  panelOpen = false;
  private lender: number | null = null;
  private notices: { text: string; color: string; until: number }[] = [];
  private key = '';

  constructor(private readonly root: HTMLElement, private readonly actions: LoanActions) {
    root.addEventListener('click', (ev) => {
      const el = (ev.target as HTMLElement).closest<HTMLElement>('button');
      if (!el) return;
      const d = el.dataset;
      if (d.close !== undefined) this.panelOpen = false;
      else if (d.lender !== undefined) this.lender = Number(d.lender);
      else if (d.amount !== undefined && this.lender !== null) {
        this.actions.ask(this.lender, Number(d.amount));
        this.panelOpen = false;
      } else if (d.withdraw !== undefined) this.actions.ask(Number(d.withdraw), 0);
      else if (d.answer !== undefined) {
        const [lender, borrower] = d.answer.split(':').map(Number);
        this.actions.answer(lender, borrower, d.yes === '1');
      }
      this.key = '';
    });
  }

  toggle(): void {
    this.panelOpen = !this.panelOpen;
    this.key = '';
  }

  /**
   * Shows the game's loan news. `me`: the player on this screen online (only news about them
   * is shown), null on a shared device (all of it).
   */
  addNotices(game: Game, notices: GameNotice[], me: number | null): void {
    const now = performance.now() / 1000;
    for (const n of notices) {
      // A request already shows as a card (Lend / Decline, or "Waiting for …").
      if (n.kind === 'loan-asked' || (me !== null && n.borrower !== me && n.lender !== me)) continue;
      const borrower = playerLabel(game, n.borrower);
      const lender = playerLabel(game, n.lender);
      const text =
        n.kind === 'loan-lent'
            ? t('{lender} lent {borrower} {n} gold: {owed} to pay back next wave.', { borrower, lender, n: n.amount, owed: loanOwed(n.amount) })
            : n.kind === 'loan-declined'
              ? t('{lender} declined to lend {borrower} {n} gold.', { borrower, lender, n: n.amount })
              : t('Loan paid in full: {borrower} paid {lender} back {n} gold.', { borrower, lender, n: n.amount });
      const color = n.kind === 'loan-repaid' ? '#7dffc0' : n.kind === 'loan-declined' ? '#ff3864' : '#ffe600';
      this.notices.push({ text, color, until: now + NOTICE_TIME });
    }
    this.notices = this.notices.slice(-4);
  }

  /** `me`: the player using this screen; `shared`: one device for everyone (any lender can answer here). */
  update(game: Game, me: number, shared: boolean): void {
    const party = game.players.length > 1;
    const now = performance.now() / 1000;
    this.notices = this.notices.filter((n) => n.until > now);
    if (!party || !game.borrowingOpen) this.panelOpen = false;
    if (this.lender === me || (this.lender !== null && !game.players[this.lender])) this.lender = null;
    const incoming = game.loanRequests.filter((r) => (shared ? r.lender !== r.borrower : r.lender === me));
    const outgoing = game.loanRequests.filter((r) => r.borrower === me && !shared);
    const key = JSON.stringify([
      party, this.panelOpen, this.lender, me, game.borrowingOpen, game.loanRequests, game.players.map((p) => p.gold),
      this.notices.map((n) => n.text), t('Gold'),
    ]);
    if (key === this.key) return;
    this.key = key;
    this.root.hidden = !party || (!this.panelOpen && incoming.length === 0 && outgoing.length === 0 && this.notices.length === 0);
    if (this.root.hidden) return;

    const label = (p: number) => `<b style="color:${PLAYER_COLORS[p]}">${playerLabel(game, p)}</b>`;
    const notices = this.notices.map((n) => `<div class="loan-notice" style="--loan-color:${n.color}">${n.text}</div>`).join('');
    const requests = incoming
      .map((r) => {
        const short = game.players[r.lender].gold < r.amount;
        return `<div class="loan-card">
          <div>${t('{borrower} asks {lender} for {n} gold.', { borrower: label(r.borrower), lender: label(r.lender), n: `<b class="loan-gold">${r.amount}</b>` })}
            <small>${t('Pays back {owed} during the next wave.', { owed: loanOwed(r.amount) })}</small></div>
          <div class="loan-buttons">
            <button class="primary" data-answer="${r.lender}:${r.borrower}" data-yes="1" ${short ? `disabled title="${t('Not enough gold')}"` : ''}>${t('Lend')}</button>
            <button data-answer="${r.lender}:${r.borrower}" data-yes="0">${t('Decline')}</button>
          </div>
        </div>`;
      })
      .join('');
    const waiting = outgoing
      .map((r) => `<div class="loan-card"><div>${t('Waiting for {lender} to answer ({n} gold).', { lender: label(r.lender), n: r.amount })}</div>
        <div class="loan-buttons"><button data-withdraw="${r.lender}">${t('Cancel')}</button></div></div>`)
      .join('');
    let panel = '';
    if (this.panelOpen) {
      const lenders = game.players
        .map((p, i) => (i === me ? '' : `<button class="${i === this.lender ? 'active' : ''}" data-lender="${i}" style="--player-color:${PLAYER_COLORS[i]}">${playerLabel(game, i)} <span class="loan-gold">${p.gold}</span></button>`))
        .join('');
      const amounts =
        this.lender === null
          ? `<small>${t('Pick a player to ask.')}</small>`
          : LOAN.amounts
              .map((a) => `<button data-amount="${a}" title="${t('Pays back {owed} during the next wave.', { owed: loanOwed(a) })}">${a}</button>`)
              .join('');
      panel = `<div class="loan-card loan-panel">
        <div class="loan-head"><b>${t('Borrow gold')}</b><button class="loan-x" data-close aria-label="${t('Close')}">✕</button></div>
        <small>${t('+{pct}% interest, paid back automatically from your gold during the next wave.', { pct: LOAN.interestPercent })}</small>
        <div class="loan-buttons loan-lenders">${lenders}</div>
        <div class="loan-buttons">${amounts}</div>
      </div>`;
    }
    this.root.innerHTML = notices + requests + waiting + panel;
  }
}
