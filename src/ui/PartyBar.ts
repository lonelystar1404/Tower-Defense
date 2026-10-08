import { ELEMENTS } from '../data/elements';
import { PARTY, PLAYER_COLORS } from '../data/party';
import type { Game } from '../game/Game';
import { t } from '../i18n';

/** "P2 · Leila": a player's number and their hero's call sign (or name without a hero). */
export function playerLabel(game: Game, player: number): string {
  const p = game.players[player];
  return p?.hero ? `P${player + 1} · ${p.hero.def.callsign}` : (p?.name ?? `P${player + 1}`);
}

/**
 * Multiplayer bar under the map: one chip per player (number, hero, element, gold). The chip of
 * the player using this screen is highlighted; on a shared device, tapping a chip switches player.
 * Shows the five-element party bonus when it's active. Hidden in single-player.
 */
export class PartyBar {
  private key = '';

  constructor(private readonly root: HTMLElement, private readonly onSelect: (player: number) => void) {
    root.addEventListener('click', (ev) => {
      const chip = (ev.target as HTMLElement).closest<HTMLElement>('[data-player]');
      if (chip) this.onSelect(Number(chip.dataset.player));
    });
  }

  /** `present`: online, which players (by slot) are connected; disconnected ones are dimmed. */
  update(game: Game, active: number, present?: boolean[]): void {
    const party = game.players.length > 1;
    this.root.hidden = !party;
    if (!party) return;
    const key = `${active}:${game.players.map((p) => p.gold).join(',')}:${present?.join(',') ?? ''}:${t('Gold')}`;
    if (key === this.key) return;
    this.key = key;
    const chips = game.players
      .map((p, i) => {
        const el = p.hero ? ELEMENTS[p.hero.def.element] : null;
        const gone = present && present[i] === false;
        return `<button class="party-chip ${i === active ? 'active' : ''} ${gone ? 'gone' : ''}" data-player="${i}" style="--player-color:${PLAYER_COLORS[i]}" aria-pressed="${i === active}" ${gone ? `title="${t('Disconnected')}"` : ''}>
          <span class="party-num">P${i + 1}</span>
          <span class="party-hero">${p.hero ? `<span class="party-name">${p.hero.def.callsign}</span> ${el!.icon}` : p.name}</span>
          <span class="party-gold">${p.gold}</span>
        </button>`;
      })
      .join('');
    const bonus = game.fullElementParty
      ? `<span class="party-bonus" title="${t('All five elements in the party: every hero deals +{n}% damage.', { n: Math.round(PARTY.fullElementsAttack * 100) })}">✦ ${t('Five elements: +{n}% hero damage', { n: Math.round(PARTY.fullElementsAttack * 100) })}</span>`
      : '';
    this.root.innerHTML = chips + bonus;
  }
}
