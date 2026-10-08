import { describe, expect, it } from 'vitest';
import { dist, powi, ringPoints, sq } from '../src/systems/dmath';

/** Source of every rules file (read through Vite, so no Node types are needed). */
const RULES = import.meta.glob(['../src/game/**/*.ts', '../src/systems/**/*.ts', '../src/entities/**/*.ts', '../src/data/**/*.ts'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

/** Code lines only (comments stripped), so docs can still mention the forbidden functions. */
function codeLines(src: string): string[] {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .filter((l) => l.trim());
}

describe('Deterministic rules (online lockstep)', () => {
  it('game rules use no engine-dependent math (hypot, **, pow, trig except for drawing angles)', () => {
    const bad: string[] = [];
    for (const [file, src] of Object.entries(RULES)) {
      if (file.endsWith('dmath.ts')) continue;
      for (const line of codeLines(src)) {
        const trig = /Math\.(sin|cos|tan|asin|acos|exp|log|pow|hypot|cbrt|sinh|cosh|tanh|expm1|log1p|log2|log10)\(/.test(line);
        const pow = /\*\*/.test(line);
        // atan2 is allowed only to set an `angle` used for drawing.
        const atan = /Math\.atan2\(/.test(line) && !/\.angle = Math\.atan2\(/.test(line);
        if (trig || pow || atan) bad.push(`${file}: ${line.trim()}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it('dmath helpers', () => {
    expect(sq(3)).toBe(9);
    expect(dist(3, 4)).toBe(5);
    expect(powi(0.75, 3)).toBe(0.75 * 0.75 * 0.75);
    expect(powi(2, 0)).toBe(1);
    for (let n = 1; n <= 6; n++) {
      const pts = ringPoints(n);
      expect(pts).toHaveLength(n);
      for (const [x, y] of pts) expect(Math.abs(x * x + y * y - 1)).toBeLessThan(1e-12);
    }
  });
});
