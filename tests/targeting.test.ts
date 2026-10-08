import { describe, expect, it } from 'vitest';
import { chainTargets, selectTarget, selectTargets, type Targetable } from '../src/systems/targeting';

function enemy(over: Partial<Targetable>): Targetable {
  return { x: 0, y: 0, remaining: 10, hp: 10, movement: 'ground', alive: true, ...over };
}

describe('selectTarget', () => {
  const a = enemy({ x: 1, remaining: 5, hp: 10 });
  const b = enemy({ x: 2, remaining: 2, hp: 5 });
  const c = enemy({ x: 0.5, remaining: 8, hp: 30 });
  const all = [a, b, c];

  it('picks by priority', () => {
    expect(selectTarget(all, 0, 0, 3, ['ground'], 'first')).toBe(b);
    expect(selectTarget(all, 0, 0, 3, ['ground'], 'last')).toBe(c);
    expect(selectTarget(all, 0, 0, 3, ['ground'], 'strongest')).toBe(c);
    expect(selectTarget(all, 0, 0, 3, ['ground'], 'closest')).toBe(c);
  });

  it('ignores enemies out of range', () => {
    expect(selectTarget(all, 0, 0, 1.5, ['ground'], 'first')).toBe(a);
  });

  it('ignores movement types the weapon cannot hit', () => {
    const flyer = enemy({ movement: 'air', remaining: 0.1 });
    expect(selectTarget([flyer, a], 0, 0, 3, ['ground'], 'first')).toBe(a);
    expect(selectTarget([flyer, a], 0, 0, 3, ['air'], 'first')).toBe(flyer);
  });

  it('ignores dead enemies and returns null when nothing is valid', () => {
    expect(selectTarget([enemy({ alive: false })], 0, 0, 3, ['ground'], 'first')).toBeNull();
  });
});

describe('selectTargets', () => {
  it('returns up to `count` targets, best first', () => {
    const list = [5, 1, 3, 4].map((remaining) => enemy({ remaining }));
    expect(selectTargets(list, 0, 0, 3, ['ground'], 'first', 3).map((e) => e.remaining)).toEqual([1, 3, 4]);
  });

  it('returns fewer when fewer are in range', () => {
    expect(selectTargets([enemy({})], 0, 0, 3, ['ground'], 'first', 3)).toHaveLength(1);
  });
});

describe('chainTargets', () => {
  it('jumps to the nearest unhit enemy each time, up to the jump limit', () => {
    const a = enemy({ x: 0 });
    const b = enemy({ x: 1 });
    const c = enemy({ x: 2 });
    const d = enemy({ x: 0.8, y: 0.8 });
    expect(chainTargets(a, [a, b, c, d], 2, 1.5, ['ground'])).toEqual([a, b, d]);
    expect(chainTargets(a, [a, b, c, d], 5, 1.5, ['ground'])).toEqual([a, b, d, c]);
  });

  it('stops when nothing is within jump range', () => {
    const a = enemy({ x: 0 });
    expect(chainTargets(a, [a, enemy({ x: 3 })], 3, 1.5, ['ground'])).toEqual([a]);
  });

  it('only jumps to movement types the weapon can hit', () => {
    const a = enemy({});
    const flyer = enemy({ x: 0.5, movement: 'air' });
    expect(chainTargets(a, [a, flyer], 3, 1.5, ['ground'])).toEqual([a]);
  });
});
