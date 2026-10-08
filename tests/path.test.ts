import { describe, expect, it } from 'vitest';
import { Path } from '../src/systems/path';

describe('Path', () => {
  const path = new Path([[0, 0], [3, 0], [3, 2]]);

  it('measures length between tile centers', () => {
    expect(path.length).toBe(5);
  });

  it('interpolates along segments', () => {
    expect(path.pointAt(1)).toEqual({ x: 1.5, y: 0.5 });
    expect(path.pointAt(4)).toEqual({ x: 3.5, y: 1.5 });
  });

  it('clamps to the ends', () => {
    expect(path.pointAt(-1)).toEqual({ x: 0.5, y: 0.5 });
    expect(path.pointAt(99)).toEqual({ x: 3.5, y: 2.5 });
  });

  it('lists every tile once', () => {
    expect(path.tiles()).toEqual([[0, 0], [1, 0], [2, 0], [3, 0], [3, 1], [3, 2]]);
  });

  it('allows diagonal routes for flyers but not tile listing', () => {
    const air = new Path([[0, 0], [3, 4]]);
    expect(air.length).toBe(5);
    expect(() => air.tiles()).toThrow();
  });
});
