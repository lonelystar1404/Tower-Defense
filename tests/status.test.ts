import { describe, expect, it } from 'vitest';
import { STATUS } from '../src/data/status';
import { applyElementEffect, MAX_SLOW, newStatus, speedMultiplier, tickStatus } from '../src/systems/status';

const never = () => 1;
const always = () => 0;

/** Ticks `seconds` in small steps and returns the total DoT dealt. */
function run(s: ReturnType<typeof newStatus>, seconds: number, dt = 0.01): number {
  let total = 0;
  for (let t = 0; t < seconds - 1e-9; t += dt) total += tickStatus(s, Math.min(dt, seconds - t));
  return total;
}

describe('Burn (Fire)', () => {
  it('deals a fraction of the hit per second for the burn duration', () => {
    const s = newStatus();
    applyElementEffect(s, 'fire', 20, 'ground', never);
    expect(run(s, 5)).toBeCloseTo(20 * STATUS.burn.dpsFraction * STATUS.burn.duration);
    expect(s.burnTime).toBe(0);
  });

  it('a new hit restarts the timer instead of stacking', () => {
    const s = newStatus();
    applyElementEffect(s, 'fire', 20, 'ground', never);
    run(s, 2);
    applyElementEffect(s, 'fire', 20, 'ground', never);
    expect(s.burnDps).toBeCloseTo(20 * STATUS.burn.dpsFraction);
    expect(s.burnTime).toBe(STATUS.burn.duration);
  });

  it('keeps the stronger burn when a weaker hit refreshes it', () => {
    const s = newStatus();
    applyElementEffect(s, 'fire', 40, 'ground', never);
    applyElementEffect(s, 'fire', 10, 'ground', never);
    expect(s.burnDps).toBeCloseTo(40 * STATUS.burn.dpsFraction);
  });

  it('does not slow the enemy', () => {
    const s = newStatus();
    applyElementEffect(s, 'fire', 20, 'ground', never);
    expect(speedMultiplier(s)).toBe(1);
  });
});

describe('Chill and Freeze (Water)', () => {
  it('slows by 30% for 2 seconds', () => {
    const s = newStatus();
    applyElementEffect(s, 'water', 5, 'ground', never);
    expect(speedMultiplier(s)).toBeCloseTo(0.7);
    run(s, 1.9);
    expect(speedMultiplier(s)).toBeCloseTo(0.7);
    run(s, 0.2);
    expect(speedMultiplier(s)).toBe(1);
  });

  it('freezes on the 3rd chill in a row, for 1 second', () => {
    const s = newStatus();
    expect(applyElementEffect(s, 'water', 5, 'ground', never).froze).toBe(false);
    expect(applyElementEffect(s, 'water', 5, 'ground', never).froze).toBe(false);
    expect(applyElementEffect(s, 'water', 5, 'ground', never).froze).toBe(true);
    expect(speedMultiplier(s)).toBe(0);
    run(s, 1.05);
    expect(speedMultiplier(s)).toBeCloseTo(0.7);
  });

  it('resets the count if the chill runs out between hits', () => {
    const s = newStatus();
    applyElementEffect(s, 'water', 5, 'ground', never);
    applyElementEffect(s, 'water', 5, 'ground', never);
    run(s, 2.1);
    expect(applyElementEffect(s, 'water', 5, 'ground', never).froze).toBe(false);
  });

  it('cannot freeze again until 3 seconds after thawing', () => {
    const s = newStatus();
    for (let i = 0; i < 3; i++) applyElementEffect(s, 'water', 5, 'ground', never);
    run(s, 1 + 2.5);
    for (let i = 0; i < 3; i++) expect(applyElementEffect(s, 'water', 5, 'ground', never).froze).toBe(false);
    run(s, 0.6);
    let froze = false;
    for (let i = 0; i < 3; i++) froze ||= applyElementEffect(s, 'water', 5, 'ground', never).froze;
    expect(froze).toBe(true);
  });
});

describe('Root and Poison (Wood)', () => {
  it('roots ground units for 0.5s, then they are immune for 1s', () => {
    const s = newStatus();
    expect(applyElementEffect(s, 'wood', 5, 'ground', never).rooted).toBe(true);
    expect(speedMultiplier(s)).toBe(0);
    run(s, 0.55);
    expect(speedMultiplier(s)).toBe(1);
    expect(applyElementEffect(s, 'wood', 5, 'ground', never).rooted).toBe(false);
    run(s, 1);
    expect(applyElementEffect(s, 'wood', 5, 'ground', never).rooted).toBe(true);
  });

  it('never roots air units', () => {
    const s = newStatus();
    expect(applyElementEffect(s, 'wood', 5, 'air', never).rooted).toBe(false);
    expect(speedMultiplier(s)).toBe(1);
  });

  it('poison stacks up to the max, each stack adding damage per second', () => {
    const s = newStatus();
    for (let i = 0; i < 7; i++) applyElementEffect(s, 'wood', 5, 'air', never);
    expect(s.poisonStacks).toBe(STATUS.poison.maxStacks);
    expect(run(s, 1)).toBeCloseTo(STATUS.poison.maxStacks * STATUS.poison.dpsPerStack);
  });

  it('every new stack refreshes the timer, and all stacks expire together', () => {
    const s = newStatus();
    applyElementEffect(s, 'wood', 5, 'air', never);
    run(s, 3);
    applyElementEffect(s, 'wood', 5, 'air', never);
    expect(s.poisonTime).toBe(STATUS.poison.duration);
    run(s, STATUS.poison.duration + 0.1);
    expect(s.poisonStacks).toBe(0);
  });
});

describe('Stun and Armor Break (Earth)', () => {
  it('stuns on a successful 15% roll, for 0.75s', () => {
    const s = newStatus();
    expect(applyElementEffect(s, 'earth', 5, 'ground', () => 0.149).stunned).toBe(true);
    expect(speedMultiplier(s)).toBe(0);
    run(s, 0.8);
    expect(speedMultiplier(s)).toBe(1);
  });

  it('does not stun on a failed roll', () => {
    const s = newStatus();
    expect(applyElementEffect(s, 'earth', 5, 'ground', () => 0.15).stunned).toBe(false);
  });

  it('removes 2 armor per hit, up to 10, permanently', () => {
    const s = newStatus();
    for (let i = 0; i < 3; i++) applyElementEffect(s, 'earth', 5, 'ground', never);
    expect(s.armorBreak).toBe(6);
    for (let i = 0; i < 5; i++) applyElementEffect(s, 'earth', 5, 'ground', never);
    expect(s.armorBreak).toBe(10);
    run(s, 60);
    expect(s.armorBreak).toBe(10);
  });
});

describe('Effect power (upgraded towers)', () => {
  it('scales burn, poison, root, stun chance, and armor break', () => {
    const weak = newStatus();
    const strong = newStatus();
    applyElementEffect(weak, 'fire', 20, 'ground', never, 1);
    applyElementEffect(strong, 'fire', 20, 'ground', never, 1.5);
    expect(strong.burnDps).toBeCloseTo(weak.burnDps * 1.5);

    applyElementEffect(strong, 'wood', 5, 'ground', never, 1.5);
    expect(strong.poisonDpsPerStack).toBeCloseTo(STATUS.poison.dpsPerStack * 1.5);
    expect(strong.rootTime).toBeCloseTo(STATUS.root.duration * 1.5);

    applyElementEffect(strong, 'earth', 5, 'ground', never, 1.5);
    expect(strong.armorBreak).toBeCloseTo(STATUS.armorBreak.perHit * 1.5);
    // 0.2 is above the base 15% stun chance but below 15% × 1.5
    expect(applyElementEffect(newStatus(), 'earth', 5, 'ground', () => 0.2, 1).stunned).toBe(false);
    expect(applyElementEffect(newStatus(), 'earth', 5, 'ground', () => 0.2, 1.5).stunned).toBe(true);
  });

  it('slows more, but never past the cap', () => {
    const s = newStatus();
    applyElementEffect(s, 'water', 5, 'ground', never, 1.5);
    expect(speedMultiplier(s)).toBeCloseTo(1 - STATUS.chill.slow * 1.5);
    const capped = newStatus();
    applyElementEffect(capped, 'water', 5, 'ground', never, 10);
    expect(speedMultiplier(capped)).toBeCloseTo(1 - MAX_SLOW);
  });

  it('keeps the stronger slow when a weaker tower refreshes it', () => {
    const s = newStatus();
    applyElementEffect(s, 'water', 5, 'ground', never, 1.5);
    applyElementEffect(s, 'water', 5, 'ground', never, 1);
    expect(speedMultiplier(s)).toBeCloseTo(1 - STATUS.chill.slow * 1.5);
  });
});

describe('Shared rules', () => {
  it('damage over time keeps ticking while frozen', () => {
    const s = newStatus();
    applyElementEffect(s, 'fire', 30, 'ground', never);
    for (let i = 0; i < 3; i++) applyElementEffect(s, 'water', 5, 'ground', never);
    expect(speedMultiplier(s)).toBe(0);
    expect(run(s, 1)).toBeCloseTo(30 * STATUS.burn.dpsFraction);
  });

  it('Metal applies no status', () => {
    const s = newStatus();
    applyElementEffect(s, 'metal', 50, 'ground', always);
    expect(s).toEqual(newStatus());
  });
});
