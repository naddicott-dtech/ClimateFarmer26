import { describe, it, expect } from 'vitest';
import { generateDailyWeather, updateExtremeEvents } from '../../src/engine/weather.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { createInitialState } from '../../src/engine/game.ts';
import type { DailyWeather, GameState } from '../../src/engine/types.ts';
import { STARTING_DAY } from '../../src/engine/types.ts';

describe('Weather Generation', () => {
  it('generates deterministic weather for the same seed and day', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    // Advance both RNGs identically to day 100
    for (let d = 0; d < 100; d++) {
      generateDailyWeather(SLICE_1_SCENARIO, d, rng1);
      generateDailyWeather(SLICE_1_SCENARIO, d, rng2);
    }

    const w1 = generateDailyWeather(SLICE_1_SCENARIO, 100, rng1);
    const w2 = generateDailyWeather(SLICE_1_SCENARIO, 100, rng2);
    expect(w1).toEqual(w2);
  });

  it('double-read produces different results (RNG is stateful)', () => {
    const rng = new SeededRNG(42);

    // Two consecutive reads for the same day produce DIFFERENT results
    // because the RNG advances. This test documents the statefulness
    // and protects against accidental double-reads in the game loop.
    const w1 = generateDailyWeather(SLICE_1_SCENARIO, 100, rng);
    const w2 = generateDailyWeather(SLICE_1_SCENARIO, 100, rng);

    // At least one field should differ (temp variance is random)
    const same = w1.tempHigh === w2.tempHigh &&
      w1.tempLow === w2.tempLow &&
      w1.precipitation === w2.precipitation &&
      w1.et0 === w2.et0;
    expect(same).toBe(false);
  });

  it('produces reasonable summer temperatures for SJV', () => {
    const rng = new SeededRNG(42);
    // Day 180 is late June/early July — summer
    // Advance RNG to day 180
    for (let d = 0; d < 180; d++) {
      generateDailyWeather(SLICE_1_SCENARIO, d, rng);
    }
    const weather = generateDailyWeather(SLICE_1_SCENARIO, 180, rng);
    expect(weather.tempHigh).toBeGreaterThan(80);
    expect(weather.tempHigh).toBeLessThan(120);
    expect(weather.tempLow).toBeGreaterThan(45);
    expect(weather.tempLow).toBeLessThan(weather.tempHigh);
  });

  it('produces reasonable winter temperatures for SJV', () => {
    const rng = new SeededRNG(42);
    // Day 350 is mid-December — winter
    for (let d = 0; d < 350; d++) {
      generateDailyWeather(SLICE_1_SCENARIO, d, rng);
    }
    const weather = generateDailyWeather(SLICE_1_SCENARIO, 350, rng);
    expect(weather.tempHigh).toBeLessThan(80);
    expect(weather.tempLow).toBeLessThan(55);
  });

  it('summer has less rain than winter', () => {
    const rng = new SeededRNG(42);
    let summerRain = 0;
    let winterRain = 0;

    for (let d = 0; d < 365; d++) {
      const weather = generateDailyWeather(SLICE_1_SCENARIO, d, rng);
      // June-August (days ~152-243)
      if (d >= 152 && d < 243) summerRain += weather.precipitation;
      // Dec-Feb (days ~335-365 and 0-58)
      if (d >= 335 || d < 59) winterRain += weather.precipitation;
    }

    expect(winterRain).toBeGreaterThan(summerRain);
  });

  it('high temp is always greater than low temp', () => {
    const rng = new SeededRNG(42);
    for (let d = 0; d < 365; d++) {
      const weather = generateDailyWeather(SLICE_1_SCENARIO, d, rng);
      expect(weather.tempHigh).toBeGreaterThan(weather.tempLow);
    }
  });

  it('ET0 is always positive', () => {
    const rng = new SeededRNG(42);
    for (let d = 0; d < 365; d++) {
      const weather = generateDailyWeather(SLICE_1_SCENARIO, d, rng);
      expect(weather.et0).toBeGreaterThan(0);
    }
  });

  it('throws for invalid year', () => {
    const rng = new SeededRNG(42);
    expect(() => generateDailyWeather(SLICE_1_SCENARIO, 30 * 365, rng)).toThrow();
  });

  it('weather is consistent across year boundaries', () => {
    // Simulate through the end of year 1 into year 2 without errors
    const rng = new SeededRNG(SLICE_1_SCENARIO.seed);
    for (let d = 360; d < 370; d++) {
      const weather = generateDailyWeather(SLICE_1_SCENARIO, d, rng);
      expect(weather.tempHigh).toBeGreaterThan(-50); // Sanity
      expect(weather.tempHigh).toBeLessThan(150);
      expect(weather.et0).toBeGreaterThan(0);
    }
  });

  it('createInitialState warmup produces same RNG state as simulating from day 0', () => {
    // Method A: Manual simulation from day 0 with both weather + event rolls
    const rngA = new SeededRNG(SLICE_1_SCENARIO.seed);
    const warmupA = { activeHeatwaveDays: 0, activeFrostDays: 0 };
    for (let d = 0; d < STARTING_DAY; d++) {
      const w = generateDailyWeather(SLICE_1_SCENARIO, d, rngA);
      updateExtremeEvents(warmupA, w, SLICE_1_SCENARIO, d, rngA);
    }

    // Method B: createInitialState (should use identical warmup logic)
    const state = createInitialState('test', SLICE_1_SCENARIO);
    const rngB = new SeededRNG(state.rngState);

    // RNG states must match
    expect(state.rngState).toBe(rngA.getState());

    // Event tracking state must match
    expect(state.activeHeatwaveDays).toBe(warmupA.activeHeatwaveDays);
    expect(state.activeFrostDays).toBe(warmupA.activeFrostDays);

    // Future weather from both must be identical
    for (let d = STARTING_DAY; d < STARTING_DAY + 30; d++) {
      const wA = generateDailyWeather(SLICE_1_SCENARIO, d, rngA);
      const wB = generateDailyWeather(SLICE_1_SCENARIO, d, rngB);
      expect(wA).toEqual(wB);
    }
  });
});

describe('Extreme Events (multi-day)', () => {
  function makeTestState(): GameState {
    return createInitialState('test', SLICE_1_SCENARIO);
  }

  it('heatwave persists for 3-5 consecutive days once triggered', () => {
    // Run the simulation long enough to observe a heatwave.
    // Use a deterministic approach: manually inject one and verify persistence.
    const state = makeTestState();
    state.activeHeatwaveDays = 4; // 4 remaining days of heatwave

    const rng = new SeededRNG(SLICE_1_SCENARIO.seed);
    // Advance RNG to match state's starting day
    for (let d = 0; d < STARTING_DAY; d++) {
      generateDailyWeather(SLICE_1_SCENARIO, d, rng);
    }

    // Each tick should show isHeatwave=true and decrement the counter
    for (let i = 0; i < 4; i++) {
      const day = STARTING_DAY + i;
      const weather = generateDailyWeather(SLICE_1_SCENARIO, day, rng);
      updateExtremeEvents(state, weather, SLICE_1_SCENARIO, day, rng);
      expect(weather.isHeatwave).toBe(true);
    }
    expect(state.activeHeatwaveDays).toBe(0);
  });

  it('frost persists for multiple consecutive days once triggered', () => {
    const state = makeTestState();
    state.activeFrostDays = 3; // 3 remaining days of frost

    const rng = new SeededRNG(SLICE_1_SCENARIO.seed);
    for (let d = 0; d < STARTING_DAY; d++) {
      generateDailyWeather(SLICE_1_SCENARIO, d, rng);
    }

    for (let i = 0; i < 3; i++) {
      const day = STARTING_DAY + i;
      const weather = generateDailyWeather(SLICE_1_SCENARIO, day, rng);
      updateExtremeEvents(state, weather, SLICE_1_SCENARIO, day, rng);
      expect(weather.isFrost).toBe(true);
      expect(weather.tempLow).toBeLessThanOrEqual(32);
    }
    expect(state.activeFrostDays).toBe(0);
  });

  it('heatwave adds 10°F to high temperature', () => {
    const state = makeTestState();
    state.activeHeatwaveDays = 1;

    const rng1 = new SeededRNG(99);
    const rng2 = new SeededRNG(99);

    // Get base weather
    const baseWeather = generateDailyWeather(SLICE_1_SCENARIO, STARTING_DAY, rng1);
    const baseHigh = baseWeather.tempHigh;

    // Get weather with heatwave overlay
    const hwWeather = generateDailyWeather(SLICE_1_SCENARIO, STARTING_DAY, rng2);
    updateExtremeEvents(state, hwWeather, SLICE_1_SCENARIO, STARTING_DAY, rng2);

    expect(hwWeather.tempHigh).toBe(baseHigh + 10);
  });

  it('base weather never has isHeatwave or isFrost set', () => {
    const rng = new SeededRNG(42);
    for (let d = 0; d < 365; d++) {
      const weather = generateDailyWeather(SLICE_1_SCENARIO, d, rng);
      expect(weather.isHeatwave).toBe(false);
      expect(weather.isFrost).toBe(false);
    }
  });

  it('extreme events trigger from probability rolls over many days', () => {
    // Test updateExtremeEvents directly with many iterations to verify
    // the probability system fires. This avoids auto-pause complications
    // and tests the event system in isolation.
    const state = makeTestState();
    const rng = new SeededRNG(SLICE_1_SCENARIO.seed);

    // Advance RNG to match state start
    for (let d = 0; d < STARTING_DAY; d++) {
      generateDailyWeather(SLICE_1_SCENARIO, d, rng);
    }

    let heatwaveDays = 0;
    let frostDays = 0;

    // Simulate 5 years of weather + event rolls directly
    for (let d = STARTING_DAY; d < 365 * 5; d++) {
      const weather = generateDailyWeather(SLICE_1_SCENARIO, d, rng);
      updateExtremeEvents(state, weather, SLICE_1_SCENARIO, d, rng);
      if (weather.isHeatwave) heatwaveDays++;
      if (weather.isFrost) frostDays++;
    }

    // Over 5 years with summer heatwave probability ~10-40% per season
    // and winter frost probability ~8-15% per season, we expect events.
    expect(heatwaveDays + frostDays).toBeGreaterThan(0);
  });

  it('events always appear in multi-day streaks (not isolated single days)', () => {
    // Verify the persistence mechanism: when events trigger, they always
    // last at least EVENT_MIN_DAYS (3) consecutive days.
    const state = makeTestState();
    const rng = new SeededRNG(SLICE_1_SCENARIO.seed);

    for (let d = 0; d < STARTING_DAY; d++) {
      generateDailyWeather(SLICE_1_SCENARIO, d, rng);
    }

    const weatherLog: DailyWeather[] = [];
    for (let d = STARTING_DAY; d < 365 * 5; d++) {
      const weather = generateDailyWeather(SLICE_1_SCENARIO, d, rng);
      updateExtremeEvents(state, weather, SLICE_1_SCENARIO, d, rng);
      weatherLog.push(weather);
    }

    // Analyze streaks of either event type
    function analyzeStreaks(predicate: (w: DailyWeather) => boolean): { streakCount: number; maxStreak: number; minStreak: number } {
      let current = 0, max = 0, min = Infinity, count = 0;
      for (const w of weatherLog) {
        if (predicate(w)) {
          current++;
        } else {
          if (current > 0) { count++; max = Math.max(max, current); min = Math.min(min, current); }
          current = 0;
        }
      }
      if (current > 0) { count++; max = Math.max(max, current); min = Math.min(min, current); }
      if (count === 0) min = 0;
      return { streakCount: count, maxStreak: max, minStreak: min };
    }

    const hw = analyzeStreaks(w => w.isHeatwave);
    const fr = analyzeStreaks(w => w.isFrost);

    // At least one event type should have triggered over 5 years
    expect(hw.streakCount + fr.streakCount).toBeGreaterThan(0);

    // ALL streaks must be >= 3 days (EVENT_MIN_DAYS) — not just the longest
    if (hw.streakCount > 0) {
      expect(hw.minStreak).toBeGreaterThanOrEqual(3);
    }
    if (fr.streakCount > 0) {
      expect(fr.minStreak).toBeGreaterThanOrEqual(3);
    }
  });
});
