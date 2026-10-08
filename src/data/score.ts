/**
 * Map score: how well a run went, comparable between players on the same map (and the same
 * Daily Challenge). Every cleared wave earns points, more the faster it was cleared; every life
 * lost costs points. Shown live at the top left of the map.
 *
 * Speed: a wave can't be cleared before its last enemy spawns, so the clock starts then. Clearing
 * right away earns the full bonus; it falls to 0 over the time its slowest enemy needs to walk
 * (or fly) its whole route, so towers that kill early score more than ones that finish enemies at
 * the core. Leaked enemies count against it, so letting a wave run through isn't "fast".
 */
export const SCORE = {
  /** Points for clearing a wave. */
  wave: 100,
  /** Most speed points a wave can add. */
  speed: 100,
  /** Points lost per life lost (given back if a life is restored). */
  life: 50,
} as const;

/**
 * Speed points for one wave: `SCORE.speed` × how early it was cleared (1 right after the last
 * spawn, 0 at `window` seconds later) × the share of its enemies killed rather than leaked.
 */
export function speedPoints(clearTime: number, spawnEnd: number, window: number, killed: number, leaked: number): number {
  const early = Math.min(1, Math.max(0, 1 - Math.max(0, clearTime - spawnEnd) / Math.max(window, 1e-6)));
  const total = killed + leaked;
  const kept = total > 0 ? killed / total : 1;
  return Math.round(SCORE.speed * early * kept);
}
