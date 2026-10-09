/**
 * Multiplayer party rules (Map 8 on). Each player brings one hero and has their own gold; lives
 * and the core are shared. See "Multiplayer" in CLAUDE.md.
 */
export const PARTY = {
  minPlayers: 2,
  maxPlayers: 5,
  /** Extra hero damage for everyone when the party's heroes cover all five elements. */
  fullElementsAttack: 0.1,
} as const;

/**
 * Gold loans between players (multiplayer only). Asked for and answered only between waves; the
 * borrower pays back `amount + interest` during the waves after, in installments taken
 * automatically from their gold once a second.
 */
export const LOAN = {
  /** Interest in whole percent (integer math, so every device agrees). */
  interestPercent: 10,
  /** Amounts offered in the borrow panel. */
  amounts: [25, 50, 100, 200] as readonly number[],
  /** Largest single request. */
  maxAmount: 1000,
  /** Each installment is the debt divided by this (rounded up): about this many seconds to repay. */
  repaySeconds: 20,
} as const;

/**
 * Where each player's hero starts, as offsets in tiles from the map's `heroStart` (player 1 in
 * the middle). Fixed numbers rather than angles, so every device places them identically.
 */
export const PARTY_START_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.8, 0],
  [-0.8, 0],
  [0, 0.8],
  [0, -0.8],
];

/** Colors that mark each player's towers and name (player 1 first). */
export const PLAYER_COLORS = ['#00f0ff', '#ff2bd6', '#ffe600', '#7dffc0', '#ff8a3d'] as const;
