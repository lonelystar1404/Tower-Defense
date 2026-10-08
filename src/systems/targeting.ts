import { sq } from './dmath';
import type { MovementType } from '../data/enemies';

export type TargetPriority = 'first' | 'last' | 'strongest' | 'closest';

export const TARGET_PRIORITIES: readonly TargetPriority[] = ['first', 'last', 'strongest', 'closest'];

export interface Targetable {
  x: number;
  y: number;
  /** Distance left to the base along the enemy's own route (ground path or flight line). */
  remaining: number;
  hp: number;
  movement: MovementType;
  alive: boolean;
  /** Stealthed and not revealed: towers can't pick it (splash can still hit it). */
  hidden?: boolean;
}

/** Up to `count` targets in range, best first by priority. */
export function selectTargets<T extends Targetable>(
  enemies: readonly T[],
  x: number,
  y: number,
  range: number,
  targets: readonly MovementType[],
  priority: TargetPriority,
  count: number,
): T[] {
  const range2 = range * range;
  const scored: { e: T; score: number }[] = [];
  for (const e of enemies) {
    if (!e.alive || e.hidden || !targets.includes(e.movement)) continue;
    const d2 = sq((e.x - x)) + sq((e.y - y));
    if (d2 > range2) continue;
    const score =
      priority === 'first' ? -e.remaining
      : priority === 'last' ? e.remaining
      : priority === 'strongest' ? e.hp
      : -d2;
    scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, count).map((s) => s.e);
}

/** The best target in range by priority, or null if nothing valid is in range. */
export function selectTarget<T extends Targetable>(
  enemies: readonly T[],
  x: number,
  y: number,
  range: number,
  targets: readonly MovementType[],
  priority: TargetPriority,
): T | null {
  return selectTargets(enemies, x, y, range, targets, priority, 1)[0] ?? null;
}

/**
 * Chain lightning: starting at `first`, repeatedly jump to the nearest enemy not hit yet
 * within `jumpRange` of the last one. Returns the whole chain, `first` included.
 */
export function chainTargets<T extends Targetable>(
  first: T,
  enemies: readonly T[],
  jumps: number,
  jumpRange: number,
  targets: readonly MovementType[],
): T[] {
  const chain = [first];
  const range2 = jumpRange * jumpRange;
  let last = first;
  for (let j = 0; j < jumps; j++) {
    let next: T | null = null;
    let bestD2 = range2;
    for (const e of enemies) {
      if (!e.alive || e.hidden || chain.includes(e) || !targets.includes(e.movement)) continue;
      const d2 = sq((e.x - last.x)) + sq((e.y - last.y));
      if (d2 <= bestD2) {
        bestD2 = d2;
        next = e;
      }
    }
    if (!next) break;
    chain.push(next);
    last = next;
  }
  return chain;
}
