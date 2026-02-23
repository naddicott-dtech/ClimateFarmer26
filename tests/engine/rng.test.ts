import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../../src/engine/rng.ts';

describe('SeededRNG', () => {
  it('produces deterministic sequences from the same seed', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);
    const seq1 = Array.from({ length: 100 }, () => rng1.next());
    const seq2 = Array.from({ length: 100 }, () => rng2.next());
    expect(seq1).toEqual(seq2);
  });

  it('produces different sequences from different seeds', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(99);
    const v1 = rng1.next();
    const v2 = rng2.next();
    expect(v1).not.toBe(v2);
  });

  it('next() returns values in [0, 1)', () => {
    const rng = new SeededRNG(123);
    for (let i = 0; i < 1000; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('nextInt() returns values in [min, max] inclusive', () => {
    const rng = new SeededRNG(456);
    const min = 3;
    const max = 7;
    const values = new Set<number>();
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(min, max);
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThanOrEqual(max);
      expect(Number.isInteger(v)).toBe(true);
      values.add(v);
    }
    // Should hit all values in range with 1000 trials
    for (let v = min; v <= max; v++) {
      expect(values.has(v)).toBe(true);
    }
  });

  it('chance() returns booleans with approximate probability', () => {
    const rng = new SeededRNG(789);
    let trueCount = 0;
    const trials = 10000;
    for (let i = 0; i < trials; i++) {
      if (rng.chance(0.3)) trueCount++;
    }
    // Should be roughly 30% ± 3%
    expect(trueCount / trials).toBeGreaterThan(0.27);
    expect(trueCount / trials).toBeLessThan(0.33);
  });

  it('save and restore state produces identical continuation', () => {
    const rng = new SeededRNG(42);
    // Advance 50 steps
    for (let i = 0; i < 50; i++) rng.next();
    const savedState = rng.getState();

    // Continue from saved state
    const next3 = [rng.next(), rng.next(), rng.next()];

    // Restore and verify same continuation
    rng.setState(savedState);
    const restored3 = [rng.next(), rng.next(), rng.next()];

    expect(restored3).toEqual(next3);
  });
});
