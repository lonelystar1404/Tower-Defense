/**
 * Deterministic math for game rules. Online multiplayer runs the same simulation on every device
 * (lockstep), so the rules may only use operations every JavaScript engine computes bit for bit
 * the same: + − × ÷ and Math.sqrt (all exactly rounded by IEEE 754), Math.floor/round/min/max.
 * Math.hypot, `**`, Math.pow, and trig can differ in the last bit between Chrome and Safari, so
 * they're for drawing only. tests/determinism.test.ts checks the rules don't use them.
 */

export function sq(x: number): number {
  return x * x;
}

/** Length of (dx, dy). */
export function dist(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy);
}

/** base^n for a whole n ≥ 0, by repeated multiplication. */
export function powi(base: number, n: number): number {
  let r = 1;
  for (let i = 0; i < n; i++) r *= base;
  return r;
}

/**
 * Points evenly spaced on a unit circle, as literal numbers (no trig at run time), for 1–6 points;
 * the first points right (+x), then counterclockwise on screen like the old cos/sin layout.
 */
const H = 0.8660254037844386; // √3 / 2
const C5 = [
  [1, 0], [0.30901699437494745, 0.9510565162951535], [-0.8090169943749473, 0.5877852522924732],
  [-0.8090169943749476, -0.587785252292473], [0.30901699437494723, -0.9510565162951536],
] as const;
const RING: readonly (readonly (readonly [number, number])[])[] = [
  [],
  [[1, 0]],
  [[1, 0], [-1, 0]],
  [[1, 0], [-0.5, H], [-0.5, -H]],
  [[1, 0], [0, 1], [-1, 0], [0, -1]],
  C5,
  [[1, 0], [0.5, H], [-0.5, H], [-1, 0], [-0.5, -H], [0.5, -H]],
];

/** `count` points on a unit circle (see RING); more than 6 wrap around the 6-point ring. */
export function ringPoints(count: number): (readonly [number, number])[] {
  if (count < RING.length) return [...RING[count]];
  return Array.from({ length: count }, (_, i) => RING[6][i % 6]);
}
