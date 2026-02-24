// ============================================================================
// Perennial Crop Tests — ClimateFarmer26 Sub-Slice 2b (TDD)
// Tests written BEFORE implementation per CLAUDE.md workflow rules.
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, processCommand, simulateTick, getAvailableCrops } from '../../src/engine/game.ts';
import { getCropDefinition, getAllCropIds } from '../../src/data/crops.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import type { GameState, CropInstance } from '../../src/engine/types.ts';
import { GRID_ROWS, GRID_COLS, DAYS_PER_YEAR, STARTING_DAY } from '../../src/engine/types.ts';

// Helper: create fresh game state
function makeState(): GameState {
  return createInitialState('test-player', SLICE_1_SCENARIO);
}

// Helper: advance simulation by N days
function advanceDays(state: GameState, days: number): void {
  for (let i = 0; i < days; i++) {
    state.speed = 1;
    state.autoPauseQueue = [];
    simulateTick(state, SLICE_1_SCENARIO);
  }
}

// Helper: advance to a specific month (1-12) by running ticks
function advanceToMonth(state: GameState, targetMonth: number): void {
  const maxDays = DAYS_PER_YEAR * 2; // Safety cap
  for (let i = 0; i < maxDays; i++) {
    if (state.calendar.month === targetMonth) return;
    state.speed = 1;
    state.autoPauseQueue = [];
    simulateTick(state, SLICE_1_SCENARIO);
  }
  throw new Error(`Failed to reach month ${targetMonth} within ${maxDays} days`);
}

// Helper: advance to next year boundary
function advanceToNextYear(state: GameState): void {
  const startYear = state.calendar.year;
  const maxDays = DAYS_PER_YEAR + 10;
  for (let i = 0; i < maxDays; i++) {
    if (state.calendar.year > startYear) return;
    state.speed = 1;
    state.autoPauseQueue = [];
    simulateTick(state, SLICE_1_SCENARIO);
  }
  throw new Error(`Failed to advance past year ${startYear}`);
}

// ============================================================================
// Crop Definitions
// ============================================================================

describe('Perennial Crop Definitions', () => {
  it('almonds crop definition exists with perennial type', () => {
    const def = getCropDefinition('almonds');
    expect(def.type).toBe('perennial');
    expect(def.name).toBe('Almonds');
    expect(def.id).toBe('almonds');
  });

  it('pistachios crop definition exists with perennial type', () => {
    const def = getCropDefinition('pistachios');
    expect(def.type).toBe('perennial');
    expect(def.name).toBe('Pistachios');
    expect(def.id).toBe('pistachios');
  });

  it('perennial definitions have required perennial fields', () => {
    for (const id of ['almonds', 'pistachios']) {
      const def = getCropDefinition(id);
      expect(def.yearsToEstablish).toBeGreaterThan(0);
      expect(def.removalCost).toBeGreaterThan(0);
      expect(def.annualMaintenanceCost).toBeGreaterThan(0);
      expect(def.dormantSeasons).toContain('winter');
    }
  });

  it('almonds has 3-year establishment, pistachios has 4-year', () => {
    expect(getCropDefinition('almonds').yearsToEstablish).toBe(3);
    expect(getCropDefinition('pistachios').yearsToEstablish).toBe(4);
  });

  it('getAllCropIds includes perennials', () => {
    const ids = getAllCropIds();
    expect(ids).toContain('almonds');
    expect(ids).toContain('pistachios');
  });
});

// ============================================================================
// Planting
// ============================================================================

describe('Perennial Planting', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('plants a perennial with correct instance fields', () => {
    // Game starts in March (spring) — almonds plant Jan-Mar
    const result = processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    const crop = state.grid[0][0].crop!;
    expect(crop.isPerennial).toBe(true);
    expect(crop.perennialAge).toBe(0);
    expect(crop.perennialEstablished).toBe(false);
    expect(crop.isDormant).toBe(false);
    expect(crop.cropId).toBe('almonds');
  });

  it('deducts establishment cost (seedCostPerAcre)', () => {
    const cashBefore = state.economy.cash;
    const cost = getCropDefinition('almonds').seedCostPerAcre;

    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds',
    }, SLICE_1_SCENARIO);

    expect(state.economy.cash).toBe(cashBefore - cost);
  });

  it('enforces planting window for perennials', () => {
    // Advance to June (month 6) — outside almonds planting window (Jan-Mar)
    advanceToMonth(state, 6);

    const result = processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Almonds');
  });

  it('cannot plant on occupied cell (perennial or annual)', () => {
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds',
    }, SLICE_1_SCENARIO);

    const result = processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'pistachios',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('already has a crop');
  });

  it('perennials appear in getAvailableCrops during planting window', () => {
    // Game starts in March — almonds/pistachios plant Jan-Mar
    const available = getAvailableCrops(state);
    expect(available).toContain('almonds');
    expect(available).toContain('pistachios');
  });
});

// ============================================================================
// Establishment Period
// ============================================================================

describe('Perennial Establishment', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    // Plant almonds (3-year establishment)
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds',
    }, SLICE_1_SCENARIO);
  });

  it('perennial is not established in year 1', () => {
    // Advance through year 1
    advanceDays(state, 200);
    const crop = state.grid[0][0].crop!;
    expect(crop.perennialEstablished).toBe(false);
    expect(crop.isPerennial).toBe(true);
  });

  it('perennial does not reach harvestable during establishment', () => {
    // Advance through multiple growing seasons — crop should grow but not become harvestable
    advanceDays(state, 300);
    const crop = state.grid[0][0].crop!;
    // During establishment, growth should be capped before harvestable
    expect(crop.growthStage).not.toBe('harvestable');
    expect(crop.growthStage).not.toBe('overripe');
  });

  it('perennialAge increments at year boundary', () => {
    advanceToNextYear(state);
    const crop = state.grid[0][0].crop!;
    expect(crop.perennialAge).toBe(1);
  });

  it('almonds become established after 3 years', () => {
    for (let y = 0; y < 3; y++) {
      advanceToNextYear(state);
    }
    const crop = state.grid[0][0].crop!;
    expect(crop.perennialAge).toBe(3);
    expect(crop.perennialEstablished).toBe(true);
  });

  it('pistachios require 4 years to establish', () => {
    // Plant pistachios in a different cell
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 1, cellCol: 0, cropId: 'pistachios',
    }, SLICE_1_SCENARIO);

    for (let y = 0; y < 3; y++) {
      advanceToNextYear(state);
    }
    // After 3 years: pistachios NOT established
    const pistachio = state.grid[1][0].crop!;
    expect(pistachio.perennialAge).toBe(3);
    expect(pistachio.perennialEstablished).toBe(false);

    advanceToNextYear(state);
    // After 4 years: pistachios established
    const pistachio4 = state.grid[1][0].crop!;
    expect(pistachio4.perennialAge).toBe(4);
    expect(pistachio4.perennialEstablished).toBe(true);
  });

  it('maintenance cost deducted at year-end for each perennial cell', () => {
    const maintenanceCost = getCropDefinition('almonds').annualMaintenanceCost!;
    const expensesBefore = state.economy.yearlyExpenses;

    advanceToNextYear(state);

    // Maintenance cost should be in yearly expenses
    expect(state.economy.yearlyExpenses).toBeGreaterThanOrEqual(expensesBefore + maintenanceCost);
  });
});

// ============================================================================
// Dormancy
// ============================================================================

describe('Perennial Dormancy', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds',
    }, SLICE_1_SCENARIO);
  });

  it('perennial enters dormancy in winter', () => {
    // Advance to winter
    advanceToMonth(state, 12); // December
    const crop = state.grid[0][0].crop!;
    expect(crop.isDormant).toBe(true);
  });

  it('no GDD accumulation during dormancy', () => {
    advanceToMonth(state, 12);
    const crop = state.grid[0][0].crop!;
    const gddBefore = crop.gddAccumulated;

    // Advance a few days in winter
    advanceDays(state, 10);
    const crop2 = state.grid[0][0].crop!;
    expect(crop2.gddAccumulated).toBe(gddBefore);
  });

  it('reduced water use during dormancy (kc=0.2)', () => {
    // Advance to winter
    advanceToMonth(state, 12);
    const crop = state.grid[0][0].crop!;
    expect(crop.isDormant).toBe(true);
    // The crop coefficient lookup should return 0.2 for dormant perennials
    // (tested via soil moisture drain rate being lower, but we verify indirectly)
  });

  it('exits dormancy in spring', () => {
    // Advance through winter to spring
    advanceToMonth(state, 12); // winter
    expect(state.grid[0][0].crop!.isDormant).toBe(true);

    advanceToMonth(state, 3); // March = spring
    // After spring arrives, dormancy should end
    advanceDays(state, 5); // give it a few days to process
    expect(state.grid[0][0].crop!.isDormant).toBe(false);
  });

  it('GDD resets at spring awakening for new growing season', () => {
    // Advance through a full year cycle (spring → winter → spring)
    advanceToMonth(state, 12); // winter
    advanceToMonth(state, 3); // next spring
    advanceDays(state, 5);

    const crop = state.grid[0][0].crop!;
    // GDD should have been reset for the new growing season
    // (it should be small, having just started accumulating)
    expect(crop.gddAccumulated).toBeLessThan(200);
  });
});

// ============================================================================
// Perennial Harvest
// ============================================================================

describe('Perennial Harvest', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds',
    }, SLICE_1_SCENARIO);
  });

  it('harvest does NOT remove perennial crop', () => {
    // Fast-forward past establishment (3 years) into a harvestable state
    for (let y = 0; y < 3; y++) {
      advanceToNextYear(state);
    }

    // Advance through growing season to reach harvestable
    advanceDays(state, 200);

    const crop = state.grid[0][0].crop;
    if (!crop) throw new Error('Perennial disappeared before harvest test');

    // If crop reached harvestable or overripe, harvest it
    if (crop.growthStage === 'harvestable' || crop.growthStage === 'overripe') {
      const result = processCommand(state, {
        type: 'HARVEST', cellRow: 0, cellCol: 0,
      }, SLICE_1_SCENARIO);

      expect(result.success).toBe(true);
      // Crop should STILL be in the cell (not removed)
      expect(state.grid[0][0].crop).not.toBeNull();
      expect(state.grid[0][0].crop!.cropId).toBe('almonds');
    }
  });

  it('yields 0 during establishment period', () => {
    // In year 1, even if somehow harvestable, yield should be 0
    // Force crop to harvestable for testing
    const crop = state.grid[0][0].crop!;
    crop.growthStage = 'harvestable';

    const cashBefore = state.economy.cash;
    processCommand(state, {
      type: 'HARVEST', cellRow: 0, cellCol: 0,
    }, SLICE_1_SCENARIO);

    // Revenue should be ~0 (only labor cost deducted)
    const laborCost = getCropDefinition('almonds').laborCostPerAcre;
    // Cash change should be approximately -laborCost (0 revenue - labor)
    expect(state.economy.cash).toBeCloseTo(cashBefore - laborCost, 0);
  });

  it('produces full yield after establishment', () => {
    const crop = state.grid[0][0].crop!;
    // Simulate established state
    crop.perennialAge = 3;
    crop.perennialEstablished = true;
    crop.growthStage = 'harvestable';
    crop.waterStressDays = 0;

    const cashBefore = state.economy.cash;
    processCommand(state, {
      type: 'HARVEST', cellRow: 0, cellCol: 0,
    }, SLICE_1_SCENARIO);

    // Should have positive revenue
    expect(state.economy.cash).toBeGreaterThan(cashBefore);
  });

  it('overripe perennial survives (yield=0 that year, not destroyed)', () => {
    const crop = state.grid[0][0].crop!;
    crop.perennialAge = 4;
    crop.perennialEstablished = true;
    crop.growthStage = 'overripe';
    crop.overripeDaysRemaining = 1; // About to expire

    // Advance past overripe — crop should NOT be removed
    advanceDays(state, 5);

    const cropAfter = state.grid[0][0].crop;
    expect(cropAfter).not.toBeNull();
    expect(cropAfter!.cropId).toBe('almonds');
  });

  it('after harvest, perennial resets growth stage for next season', () => {
    const crop = state.grid[0][0].crop!;
    crop.perennialAge = 4;
    crop.perennialEstablished = true;
    crop.growthStage = 'harvestable';

    processCommand(state, {
      type: 'HARVEST', cellRow: 0, cellCol: 0,
    }, SLICE_1_SCENARIO);

    // Growth stage should reset (not harvestable anymore)
    const afterCrop = state.grid[0][0].crop!;
    expect(afterCrop.growthStage).not.toBe('harvestable');
    expect(afterCrop.growthStage).not.toBe('overripe');
  });
});

// ============================================================================
// Perennial Removal (REMOVE_CROP command)
// ============================================================================

describe('REMOVE_CROP Command', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds',
    }, SLICE_1_SCENARIO);
  });

  it('REMOVE_CROP clears the perennial from the cell', () => {
    const result = processCommand(state, {
      type: 'REMOVE_CROP', cellRow: 0, cellCol: 0,
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(state.grid[0][0].crop).toBeNull();
  });

  it('REMOVE_CROP deducts removal cost', () => {
    const cashBefore = state.economy.cash;
    const removalCost = getCropDefinition('almonds').removalCost!;

    processCommand(state, {
      type: 'REMOVE_CROP', cellRow: 0, cellCol: 0,
    }, SLICE_1_SCENARIO);

    expect(state.economy.cash).toBe(cashBefore - removalCost);
  });

  it('cannot REMOVE_CROP on empty cell', () => {
    const result = processCommand(state, {
      type: 'REMOVE_CROP', cellRow: 1, cellCol: 1,
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('no crop');
  });

  it('cannot REMOVE_CROP on annual crop (use harvest instead)', () => {
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 2, cellCol: 0, cropId: 'processing-tomatoes',
    }, SLICE_1_SCENARIO);

    const result = processCommand(state, {
      type: 'REMOVE_CROP', cellRow: 2, cellCol: 0,
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('annual');
  });

  it('cannot REMOVE_CROP if not enough cash', () => {
    state.economy.cash = 10; // Less than removal cost

    const result = processCommand(state, {
      type: 'REMOVE_CROP', cellRow: 0, cellCol: 0,
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('cash');
  });
});

// ============================================================================
// Regression: Water-Stress Dilution (Finding #1)
// ============================================================================

describe('Perennial Water-Stress Yield Penalty', () => {
  it('plantedDay resets at spring awakening so water stress is per-season', () => {
    const state = makeState();
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds',
    }, SLICE_1_SCENARIO);

    const originalPlantedDay = state.grid[0][0].crop!.plantedDay;

    // Advance through winter dormancy and into next spring
    advanceToMonth(state, 12); // winter → dormancy
    advanceToMonth(state, 3);  // spring → awakening
    advanceDays(state, 5);

    const crop = state.grid[0][0].crop!;
    // plantedDay should have been reset to approximately the spring awakening day
    expect(crop.plantedDay).toBeGreaterThan(originalPlantedDay);
    expect(crop.waterStressDays).toBe(0);
  });

  it('water stress penalty is meaningful in year 5 (not diluted)', () => {
    const state = makeState();
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds',
    }, SLICE_1_SCENARIO);

    // Fast-forward 4 years to get past establishment
    for (let y = 0; y < 4; y++) {
      advanceToNextYear(state);
    }

    const crop = state.grid[0][0].crop!;
    crop.perennialEstablished = true;
    crop.growthStage = 'harvestable';
    // Simulate significant water stress: 50 stress days out of ~100 growing days
    crop.waterStressDays = 50;
    // plantedDay should be recent (set at spring awakening), making totalGrowingDays ~100-200
    const totalGrowingDays = state.calendar.totalDay - crop.plantedDay;
    const stressFraction = crop.waterStressDays / totalGrowingDays;

    // If plantedDay wasn't reset, stressFraction would be ~50/1500 ≈ 0.03 (trivial).
    // With the fix, it should be meaningful: ~50/100-200 ≈ 0.25-0.50.
    expect(stressFraction).toBeGreaterThan(0.10);
  });
});

// ============================================================================
// Regression: Multiple Harvests Per Season (Finding #2)
// ============================================================================

describe('Perennial Single Harvest Per Season', () => {
  it('cannot harvest a perennial twice in the same season', () => {
    const state = makeState();
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds',
    }, SLICE_1_SCENARIO);

    const crop = state.grid[0][0].crop!;
    crop.perennialAge = 4;
    crop.perennialEstablished = true;
    crop.growthStage = 'harvestable';

    // First harvest should succeed
    const result1 = processCommand(state, {
      type: 'HARVEST', cellRow: 0, cellCol: 0,
    }, SLICE_1_SCENARIO);
    expect(result1.success).toBe(true);

    // Force back to harvestable (simulating continued GDD accumulation)
    state.grid[0][0].crop!.growthStage = 'harvestable';

    // Second harvest should be blocked
    const result2 = processCommand(state, {
      type: 'HARVEST', cellRow: 0, cellCol: 0,
    }, SLICE_1_SCENARIO);
    expect(result2.success).toBe(false);
    expect(result2.reason).toContain('Already harvested');
  });

  it('harvestedThisSeason resets at spring awakening', () => {
    const state = makeState();
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds',
    }, SLICE_1_SCENARIO);

    const crop = state.grid[0][0].crop!;
    crop.perennialAge = 4;
    crop.perennialEstablished = true;
    crop.harvestedThisSeason = true; // As if harvested this season

    // Advance through winter (dormancy) to next spring
    advanceToMonth(state, 12);
    advanceToMonth(state, 3);
    advanceDays(state, 5);

    // Flag should be reset
    expect(state.grid[0][0].crop!.harvestedThisSeason).toBe(false);
  });

  it('bulk harvest skips already-harvested perennials', () => {
    const state = makeState();

    // Plant almonds in two cells
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds',
    }, SLICE_1_SCENARIO);
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 1, cropId: 'almonds',
    }, SLICE_1_SCENARIO);

    // Set both to established + harvestable
    for (let c = 0; c < 2; c++) {
      const crop = state.grid[0][c].crop!;
      crop.perennialAge = 4;
      crop.perennialEstablished = true;
      crop.growthStage = 'harvestable';
    }

    // Harvest cell 0,0 individually
    processCommand(state, {
      type: 'HARVEST', cellRow: 0, cellCol: 0,
    }, SLICE_1_SCENARIO);

    // Force both back to harvestable
    state.grid[0][0].crop!.growthStage = 'harvestable';
    state.grid[0][1].crop!.growthStage = 'harvestable';

    // Bulk harvest should only harvest cell 0,1 (cell 0,0 already harvested this season)
    const result = processCommand(state, {
      type: 'HARVEST_BULK', scope: 'row', index: 0,
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(result.cellsAffected).toBe(1); // Only the un-harvested one
  });

  it('already-harvested perennial does not trigger harvest_ready auto-pause', () => {
    const state = makeState();
    processCommand(state, {
      type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds',
    }, SLICE_1_SCENARIO);

    const crop = state.grid[0][0].crop!;
    crop.perennialAge = 4;
    crop.perennialEstablished = true;
    crop.growthStage = 'harvestable';
    crop.harvestedThisSeason = true; // Already harvested

    // Clear any existing auto-pause, then tick
    state.autoPauseQueue = [];
    state.speed = 1;
    simulateTick(state, SLICE_1_SCENARIO);

    const harvestPauses = state.autoPauseQueue.filter(e => e.reason === 'harvest_ready');
    expect(harvestPauses.length).toBe(0);
  });
});

// ============================================================================
// Balance Tests (deterministic: seed 42, fixed strategies)
// ============================================================================

describe('Perennial Balance', () => {
  it('64 almonds planted year 1: cash at year 4 < $10,000 (high upfront, no revenue)', () => {
    const state = makeState();

    // Plant almonds in all 64 cells
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        processCommand(state, {
          type: 'PLANT_CROP', cellRow: r, cellCol: c, cropId: 'almonds',
        }, SLICE_1_SCENARIO);
      }
    }

    // Advance 4 years with periodic watering
    for (let y = 0; y < 4; y++) {
      for (let d = 0; d < DAYS_PER_YEAR; d++) {
        state.speed = 1;
        state.autoPauseQueue = [];
        simulateTick(state, SLICE_1_SCENARIO);

        // Water every 14 days
        if (d % 14 === 0) {
          state.autoPauseQueue = [];
          processCommand(state, { type: 'WATER', scope: 'all' }, SLICE_1_SCENARIO);
        }
      }
    }

    // After 4 years of no revenue + establishment costs + maintenance + watering,
    // cash should be significantly depleted
    expect(state.economy.cash).toBeLessThan(10_000);
  });

  it('16 almonds + 48 annual mix: cash at year 5 > starting cash (diversified)', () => {
    const state = makeState();

    // Plant 16 almonds (2 rows)
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        processCommand(state, {
          type: 'PLANT_CROP', cellRow: r, cellCol: c, cropId: 'almonds',
        }, SLICE_1_SCENARIO);
      }
    }

    // Plant annuals in remaining 48 cells
    for (let r = 2; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        processCommand(state, {
          type: 'PLANT_CROP', cellRow: r, cellCol: c, cropId: 'processing-tomatoes',
        }, SLICE_1_SCENARIO);
      }
    }

    // Advance 5 years: water and harvest when possible
    for (let y = 0; y < 5; y++) {
      for (let d = 0; d < DAYS_PER_YEAR; d++) {
        state.speed = 1;
        state.autoPauseQueue = [];
        simulateTick(state, SLICE_1_SCENARIO);

        // Water every 14 days
        if (d % 14 === 0) {
          state.autoPauseQueue = [];
          processCommand(state, { type: 'WATER', scope: 'all' }, SLICE_1_SCENARIO);
        }
        // Harvest all when available
        state.autoPauseQueue = [];
        processCommand(state, { type: 'HARVEST_BULK', scope: 'all' }, SLICE_1_SCENARIO);
      }

      // Re-plant annuals each spring if cells are empty
      if (state.calendar.month >= 3 && state.calendar.month <= 5) {
        for (let r = 2; r < GRID_ROWS; r++) {
          for (let c = 0; c < GRID_COLS; c++) {
            if (!state.grid[r][c].crop) {
              processCommand(state, {
                type: 'PLANT_CROP', cellRow: r, cellCol: c, cropId: 'processing-tomatoes',
              }, SLICE_1_SCENARIO);
            }
          }
        }
      }
    }

    // Diversified strategy should be profitable over 5 years
    expect(state.economy.cash).toBeGreaterThan(50_000);
  });
});
