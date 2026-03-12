import { describe, it, expect } from 'vitest';
import { isSeedApproved, validateSeed } from '../../src/engine/seed-validator.ts';
import { CURATED_SEEDS } from '../../src/data/curated-seeds.ts';
import { SCENARIOS, SCENARIO_IDS } from '../../src/data/scenarios.ts';

// ============================================================================
// §1: Curated seeds data validation
// ============================================================================

describe('Curated seeds: data validation', () => {
  it('CURATED_SEEDS has entries for all 5 scenarios', () => {
    for (const id of SCENARIO_IDS) {
      expect(CURATED_SEEDS[id], `Missing curated seeds for: ${id}`).toBeDefined();
      expect(CURATED_SEEDS[id].length).toBeGreaterThan(0);
    }
  });

  it('each scenario has at least 20 curated seeds', () => {
    for (const id of SCENARIO_IDS) {
      expect(
        CURATED_SEEDS[id].length,
        `${id} has only ${CURATED_SEEDS[id].length} seeds (need ≥20)`,
      ).toBeGreaterThanOrEqual(20);
    }
  });

  it('all seeds are positive integers', () => {
    for (const id of SCENARIO_IDS) {
      for (const seed of CURATED_SEEDS[id]) {
        expect(Number.isInteger(seed), `${id}: ${seed} is not an integer`).toBe(true);
        expect(seed, `${id}: ${seed} is not positive`).toBeGreaterThan(0);
      }
    }
  });

  it('no duplicate seeds within a scenario', () => {
    for (const id of SCENARIO_IDS) {
      const unique = new Set(CURATED_SEEDS[id]);
      expect(
        unique.size,
        `${id} has ${CURATED_SEEDS[id].length - unique.size} duplicate seeds`,
      ).toBe(CURATED_SEEDS[id].length);
    }
  });
});

// ============================================================================
// §2: Regression — validate a sample of curated seeds still pass
// ============================================================================

describe('Curated seeds: regression validation', () => {
  // Validate a sample of seeds per scenario to keep test time reasonable.
  // Full pool is 400+ seeds × 5 scenarios × 2 strategies = ~4000+ sims.
  // Sample 5 per scenario = 50 sims ≈ 1-2s.
  const SAMPLE_SIZE = 5;

  for (const scenarioId of SCENARIO_IDS) {
    it(`${scenarioId}: sample of ${SAMPLE_SIZE} curated seeds still pass`, () => {
      const pool = CURATED_SEEDS[scenarioId];
      // Pick evenly spaced seeds from the pool
      const step = Math.max(1, Math.floor(pool.length / SAMPLE_SIZE));
      const sample = [];
      for (let i = 0; i < pool.length && sample.length < SAMPLE_SIZE; i += step) {
        sample.push(pool[i]);
      }

      for (const seed of sample) {
        const approved = isSeedApproved(scenarioId, seed);
        if (!approved) {
          // Show details for debugging
          const d = validateSeed(scenarioId, seed, 'diversified');
          const c = validateSeed(scenarioId, seed, 'corn-only');
          expect.fail(
            `Seed ${seed} for ${scenarioId} no longer passes.\n` +
            `  diversified: climate=${d.climateEventCount}, emptySeasons=${d.maxConsecutiveEmptySeasons}, distinctSeasonal=${d.distinctSeasonalEventIds}, survived=${d.survivedToYear}\n` +
            `  corn-only: climate=${c.climateEventCount}, emptySeasons=${c.maxConsecutiveEmptySeasons}, distinctSeasonal=${c.distinctSeasonalEventIds}, survived=${c.survivedToYear}`,
          );
        }
      }
    });
  }
});

// ============================================================================
// §3: Validator unit tests
// ============================================================================

describe('Curated seeds: validator behavior', () => {
  it('validateSeed returns correct structure', () => {
    const result = validateSeed('gradual-warming', 1000, 'diversified');
    expect(result).toHaveProperty('seed', 1000);
    expect(result).toHaveProperty('scenarioId', 'gradual-warming');
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('climateEventCount');
    expect(result).toHaveProperty('maxConsecutiveEmptySeasons');
    expect(result).toHaveProperty('distinctSeasonalEventIds');
    expect(result).toHaveProperty('survivedToYear');
    expect(result).toHaveProperty('strategy', 'diversified');
  });

  it('isSeedApproved returns boolean', () => {
    const result = isSeedApproved('gradual-warming', 1000);
    expect(typeof result).toBe('boolean');
  });

  it('a known-good seed from CURATED_SEEDS passes', () => {
    const seed = CURATED_SEEDS['gradual-warming'][0];
    expect(isSeedApproved('gradual-warming', seed)).toBe(true);
  });

  it('diversified strategy fires more distinct seasonal events than corn-only', () => {
    const seed = CURATED_SEEDS['gradual-warming'][0];
    const d = validateSeed('gradual-warming', seed, 'diversified');
    const c = validateSeed('gradual-warming', seed, 'corn-only');
    // Diversified has perennials + more preconditions met = more seasonal events eligible
    expect(d.distinctSeasonalEventIds).toBeGreaterThanOrEqual(c.distinctSeasonalEventIds);
  });

  it('both strategies survive to year 30 with a curated seed', () => {
    const seed = CURATED_SEEDS['gradual-warming'][0];
    const d = validateSeed('gradual-warming', seed, 'diversified');
    const c = validateSeed('gradual-warming', seed, 'corn-only');
    expect(d.survivedToYear).toBe(30);
    expect(c.survivedToYear).toBe(30);
  });
});
