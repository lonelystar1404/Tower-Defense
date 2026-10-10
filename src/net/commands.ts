import { LOAN } from '../data/party';
import { ELEMENTS, type ElementId } from '../data/elements';
import { WEAPONS, type WeaponId } from '../data/weapons';
import type { Game } from '../game/Game';
import { TARGET_PRIORITIES } from '../systems/targeting';

/**
 * Everything a player can do to the game, as plain JSON (online play sends these between
 * devices). Towers are named by their tile, since tower ids differ between devices.
 */
export type Command =
  | { k: 'build'; c: number; r: number; w: WeaponId; e: ElementId }
  | { k: 'up'; c: number; r: number }
  | { k: 'sell'; c: number; r: number }
  | { k: 'prio'; c: number; r: number }
  | { k: 'move'; x: number; y: number }
  | { k: 'cast'; s: number; x: number; y: number }
  | { k: 'ready' }
  /** Spend a skill point on ability slot `s` (learn or rank up). */
  | { k: 'learn'; s: number }
  /** Ask player `to` for `a` gold (0 withdraws the request); between waves only. */
  | { k: 'loan'; to: number; a: number }
  /** Answer player `from`'s loan request: lend (`y`) or refuse. */
  | { k: 'lend'; from: number; y: boolean };

/** A command and the player (index) who sent it. */
export type PlayerCommand = Command & { p: number };

/** Map positions travel rounded to 1/100 tile (exact in JSON, and plenty for aiming). */
export function roundPos(v: number): number {
  return Math.round(v * 100) / 100;
}

const isInt = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < max;
const isPos = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > -2 && v < 100;

/** Whether `c` is a well-formed command (input from the network is untrusted). */
export function isCommand(c: unknown): c is Command {
  if (!c || typeof c !== 'object') return false;
  const o = c as Record<string, unknown>;
  switch (o.k) {
    case 'build':
      return isInt(o.c, 100) && isInt(o.r, 100) && typeof o.w === 'string' && o.w in WEAPONS && typeof o.e === 'string' && o.e in ELEMENTS;
    case 'up':
    case 'sell':
    case 'prio':
      return isInt(o.c, 100) && isInt(o.r, 100);
    case 'move':
      return isPos(o.x) && isPos(o.y);
    case 'cast':
      return isInt(o.s, 4) && isPos(o.x) && isPos(o.y);
    case 'ready':
      return true;
    case 'learn':
      return isInt(o.s, 4);
    case 'loan':
      return isInt(o.to, 5) && isInt(o.a, LOAN.maxAmount + 1);
    case 'lend':
      return isInt(o.from, 5) && typeof o.y === 'boolean';
    default:
      return false;
  }
}

/**
 * Applies `cmd` for `player`. Every device runs this with the same commands in the same order,
 * so it must only use the game's own (deterministic) rules. Returns whether it did anything.
 */
export function applyCommand(game: Game, player: number, cmd: Command): boolean {
  if (!game.players[player] || !isCommand(cmd)) return false;
  switch (cmd.k) {
    case 'build':
      return !!game.build(cmd.c, cmd.r, { weapon: cmd.w, element: cmd.e }, player);
    case 'up': {
      const t = game.towerAt(cmd.c, cmd.r);
      return !!t && game.upgrade(t, player);
    }
    case 'sell': {
      const t = game.towerAt(cmd.c, cmd.r);
      return !!t && game.sell(t, player) > 0;
    }
    case 'prio': {
      const t = game.towerAt(cmd.c, cmd.r);
      if (!t || t.owner !== player) return false;
      t.priority = TARGET_PRIORITIES[(TARGET_PRIORITIES.indexOf(t.priority) + 1) % TARGET_PRIORITIES.length];
      return true;
    }
    case 'move':
      game.moveHero(cmd.x, cmd.y, player);
      return true;
    case 'cast':
      return game.castHero(cmd.s, cmd.x, cmd.y, player);
    case 'ready':
      return game.startWave();
    case 'learn':
      return game.learnSkill(cmd.s, player);
    case 'loan':
      return game.requestLoan(player, cmd.to, cmd.a);
    case 'lend':
      return game.answerLoan(player, cmd.from, cmd.y);
  }
}
