import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, processCommand, simulateTick } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { DORMANCY_DAYS } from '../../src/engine/types.ts';
import { totalDayToCalendar } from '../../src/engine/calendar.ts';
import type { GameState } from '../../src/engine/types.ts';

// ============================================================================
// Test Helpers
// ============================================================================

function makeState(): GameState {
  return createInitialState('test-player', SLICE_1_SCENARIO);
}

/**
 * Advance the simulation to a target totalDay.
 * Clears auto-pause queue and re-enables speed after each pause.
 */
function advanceTo(state: GameState, targetDay: number): void {
  state.speed = 1;
  while (state.calendar.totalDay < targetDay) {
    simulateTick(state, SLICE_1_SCENARIO);
    if (state.autoPauseQueue.length > 0) {
      // Respond to events to keep sim running
      if (state.activeEvent) {
        processCommand(state, {
          type: 'RESPOND_EVENT',
          eventId: state.activeEvent.storyletId,
          choiceId: state.activeEvent.choices[0].id,
        }, SLICE_1_SCENARIO);
      }
      // Accept loan if offered
      if (state.autoPauseQueue.some(e => e.reason === 'loan_offer')) {
        processCommand(state, { type: 'TAKE_LOAN' }, SLICE_1_SCENARIO);
      }
      state.autoPauseQueue = [];
      state.speed = 1;
      state.gameOver = false;
    }
  }
  state.speed = 0;
}

// ============================================================================
// Scenario Data — Chill Hours
// ============================================================================

describe('Scenario chill hours', () => {
  it('years 1-5 have 800 chill hours', () => {
    for (let y = 0; y < 5; y++) {
      expect(SLICE_1_SCENARIO.years[y].chillHours).toBe(800);
    }
  });

  it('years 6-15 have 700 chill hours', () => {
    for (let y = 5; y < 15; y++) {
      expect(SLICE_1_SCENARIO.years[y].chillHours).toBe(700);
    }
  });

  it('years 16-25 have 630 chill hours', () => {
    for (let y = 15; y < 25; y++) {
      expect(SLICE_1_SCENARIO.years[y].chillHours).toBe(630);
    }
  });

  it('years 26-30 have 570 chill hours', () => {
    for (let y = 25; y < 30; y++) {
      expect(SLICE_1_SCENARIO.years[y].chillHours).toBe(570);
    }
  });

  it('all 30 years have chillHours defined', () => {
    expect(SLICE_1_SCENARIO.years).toHaveLength(30);
    for (const year of SLICE_1_SCENARIO.years) {
      expect(year.chillHours).toBeTypeOf('number');
      expect(year.chillHours).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Chill Hour Accumulation
// ============================================================================

describe('Chill hour accumulation', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    // Give plenty of cash so maintenance costs don't bankrupt
    state.economy.cash = 500_000;
  });

  it('resets to 0 at dormancy entry', () => {
    // Plant almond (Jan-Mar window, game starts March 1 = totalDay 59)
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const crop = state.grid[0][0].crop!;
    crop.chillHoursAccumulated = 500; // simulate some prior value

    // Dec 1 of Year 1 = totalDay 334 (totalDay is 0-indexed: day-of-year 335 = totalDay 334)
    advanceTo(state, 334);

    // Crop should now be dormant with chill reset and first day's accumulation applied
    const updatedCrop = state.grid[0][0].crop;
    expect(updatedCrop).not.toBeNull();
    if (updatedCrop) {
      expect(updatedCrop.isDormant).toBe(true);
      // Entry day resets to 0 then accumulates one day's worth
      const expectedPerDay = SLICE_1_SCENARIO.years[0].chillHours / DORMANCY_DAYS;
      expect(updatedCrop.chillHoursAccumulated).toBeCloseTo(expectedPerDay, 1);
    }
  });

  it('increases daily during dormancy', () => {
    // Plant almond and advance to dormancy
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);

    // Advance into winter
    advanceTo(state, 340); // ~Dec 6, a few days into dormancy

    const crop = state.grid[0][0].crop;
    expect(crop).not.toBeNull();
    if (crop) {
      expect(crop.isDormant).toBe(true);
      // Should have accumulated some chill hours (a few days worth)
      expect(crop.chillHoursAccumulated).toBeGreaterThan(0);
    }
  });

  it('accumulates at yearChillHours / DORMANCY_DAYS rate', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);

    // Dec 1 = totalDay 334. Entry tick resets chill then accumulates first day.
    advanceTo(state, 334);
    const crop = state.grid[0][0].crop!;
    expect(crop.isDormant).toBe(true);
    const expectedPerDay = SLICE_1_SCENARIO.years[0].chillHours / DORMANCY_DAYS;
    expect(crop.chillHoursAccumulated).toBeCloseTo(expectedPerDay, 1);

    // Advance exactly 10 more days (to totalDay 344 = Dec 11)
    advanceTo(state, 344);
    // Year 1 has 800 chill hours, daily rate = 800/90 ≈ 8.89
    // 11 total dormancy ticks (entry day + 10): each accumulates dailyChill
    const expectedTotal = expectedPerDay * 11;
    expect(crop.chillHoursAccumulated).toBeCloseTo(expectedTotal, 0);
  });

  it('preserves accumulated chill at spring awakening', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);

    // Advance through entire winter into next spring
    // Year 1 ends at day 364. Year 2 March 1 = day 59+365 = 424
    advanceTo(state, 424);

    const crop = state.grid[0][0].crop!;
    expect(crop.isDormant).toBe(false); // Awakened in spring
    // Should have full winter's worth of chill hours (800 for year 1)
    // All 90 dormancy days accumulate: 90 × (800/90) = 800
    expect(crop.chillHoursAccumulated).toBeCloseTo(800, 0);
  });

  it('annuals do not accumulate chill hours', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);

    advanceTo(state, 200);

    const crop = state.grid[0][0].crop;
    // Crop may have been harvested/rotted by now, but if it exists:
    if (crop) {
      expect(crop.chillHoursAccumulated).toBe(0);
    }
  });

  it('non-established perennials still accumulate chill', () => {
    // Plant almond (3 year establishment)
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);

    // Advance through first winter to next spring
    advanceTo(state, 424); // Year 2 March 1

    const crop = state.grid[0][0].crop!;
    expect(crop.perennialEstablished).toBe(false);
    // Should still have accumulated chill hours
    expect(crop.chillHoursAccumulated).toBeGreaterThan(0);
  });
});

// ============================================================================
// Chill Hour Yield Penalty
// ============================================================================

describe('Chill hour yield penalty', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    state.economy.cash = 500_000;
  });

  it('full chill hours → no yield penalty (chillFactor = 1.0)', () => {
    // Plant almond, give it full chill hours, make it harvestable
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const crop = state.grid[0][0].crop!;

    // Simulate established, harvestable, with full chill
    crop.perennialEstablished = true;
    crop.perennialAge = 4;
    crop.chillHoursAccumulated = 700; // almonds need 700
    crop.growthStage = 'harvestable';
    crop.gddAccumulated = 3000;
    crop.waterStressDays = 0;
    crop.plantedDay = state.calendar.totalDay - 100;

    const result = processCommand(state, { type: 'HARVEST', cellRow: 0, cellCol: 0 }, SLICE_1_SCENARIO);
    expect(result.success).toBe(true);
    // Full chill = full yield, revenue should be substantial
    expect(result.revenue).toBeGreaterThan(0);
  });

  it('partial chill hours → proportional yield reduction', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const crop0 = state.grid[0][0].crop!;
    crop0.perennialEstablished = true;
    crop0.perennialAge = 4;
    crop0.chillHoursAccumulated = 700; // full
    crop0.growthStage = 'harvestable';
    crop0.gddAccumulated = 3000;
    crop0.waterStressDays = 0;
    crop0.plantedDay = state.calendar.totalDay - 100;

    processCommand(state, { type: 'PLANT_CROP', cellRow: 1, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const crop1 = state.grid[1][0].crop!;
    crop1.perennialEstablished = true;
    crop1.perennialAge = 4;
    crop1.chillHoursAccumulated = 350; // half
    crop1.growthStage = 'harvestable';
    crop1.gddAccumulated = 3000;
    crop1.waterStressDays = 0;
    crop1.plantedDay = state.calendar.totalDay - 100;

    const cashBefore = state.economy.cash;
    processCommand(state, { type: 'HARVEST', cellRow: 0, cellCol: 0 }, SLICE_1_SCENARIO);
    const fullRevenue = state.economy.cash - cashBefore + 300; // add back labor cost

    const cashBefore2 = state.economy.cash;
    processCommand(state, { type: 'HARVEST', cellRow: 1, cellCol: 0 }, SLICE_1_SCENARIO);
    const halfRevenue = state.economy.cash - cashBefore2 + 300;

    // Half chill should produce roughly half the gross revenue
    expect(halfRevenue).toBeLessThan(fullRevenue);
    expect(halfRevenue).toBeCloseTo(fullRevenue * 0.5, -2); // within ~$100
  });

  it('zero chill hours → yield 0', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const crop = state.grid[0][0].crop!;
    crop.perennialEstablished = true;
    crop.perennialAge = 4;
    crop.chillHoursAccumulated = 0; // zero chill
    crop.growthStage = 'harvestable';
    crop.gddAccumulated = 3000;
    crop.waterStressDays = 0;
    crop.plantedDay = state.calendar.totalDay - 100;

    const cashBefore = state.economy.cash;
    processCommand(state, { type: 'HARVEST', cellRow: 0, cellCol: 0 }, SLICE_1_SCENARIO);
    const netChange = state.economy.cash - cashBefore;

    // Yield is 0, so gross revenue is 0, but labor cost is still deducted
    expect(netChange).toBeLessThanOrEqual(0);
  });

  it('chillFactor capped at 1.0 (excess chill does not boost yield)', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const crop0 = state.grid[0][0].crop!;
    crop0.perennialEstablished = true;
    crop0.perennialAge = 4;
    crop0.chillHoursAccumulated = 700; // exactly required
    crop0.growthStage = 'harvestable';
    crop0.gddAccumulated = 3000;
    crop0.waterStressDays = 0;
    crop0.plantedDay = state.calendar.totalDay - 100;

    processCommand(state, { type: 'PLANT_CROP', cellRow: 1, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const crop1 = state.grid[1][0].crop!;
    crop1.perennialEstablished = true;
    crop1.perennialAge = 4;
    crop1.chillHoursAccumulated = 1400; // double required
    crop1.growthStage = 'harvestable';
    crop1.gddAccumulated = 3000;
    crop1.waterStressDays = 0;
    crop1.plantedDay = state.calendar.totalDay - 100;

    const cashBefore = state.economy.cash;
    processCommand(state, { type: 'HARVEST', cellRow: 0, cellCol: 0 }, SLICE_1_SCENARIO);
    const exactRevenue = state.economy.cash - cashBefore;

    const cashBefore2 = state.economy.cash;
    processCommand(state, { type: 'HARVEST', cellRow: 1, cellCol: 0 }, SLICE_1_SCENARIO);
    const excessRevenue = state.economy.cash - cashBefore2;

    // Should be identical (capped at 1.0)
    expect(excessRevenue).toBeCloseTo(exactRevenue, 0);
  });

  it('annuals ignore chill penalty entirely', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);
    const crop = state.grid[0][0].crop!;
    crop.growthStage = 'harvestable';
    crop.gddAccumulated = 2500;
    crop.waterStressDays = 0;
    crop.plantedDay = state.calendar.totalDay - 100;
    crop.chillHoursAccumulated = 0; // zero chill shouldn't matter

    const result = processCommand(state, { type: 'HARVEST', cellRow: 0, cellCol: 0 }, SLICE_1_SCENARIO);
    expect(result.success).toBe(true);
    expect(result.revenue).toBeGreaterThan(0);
  });

  it('non-established perennials skip chill penalty (yield already 0)', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const crop = state.grid[0][0].crop!;
    // Not established
    crop.perennialEstablished = false;
    crop.perennialAge = 1;
    crop.chillHoursAccumulated = 0;
    crop.growthStage = 'harvestable';
    crop.gddAccumulated = 3000;

    // Should succeed without crashing even with 0 chill
    const result = processCommand(state, { type: 'HARVEST', cellRow: 0, cellCol: 0 }, SLICE_1_SCENARIO);
    expect(result.success).toBe(true);
  });

  it('generates deficit notification when chill is insufficient', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    const crop = state.grid[0][0].crop!;
    crop.perennialEstablished = true;
    crop.perennialAge = 4;
    crop.chillHoursAccumulated = 200; // well below 700 required
    crop.growthStage = 'harvestable';
    crop.gddAccumulated = 3000;
    crop.waterStressDays = 0;
    crop.plantedDay = state.calendar.totalDay - 100;

    const notifCount = state.notifications.length;
    processCommand(state, { type: 'HARVEST', cellRow: 0, cellCol: 0 }, SLICE_1_SCENARIO);

    // Should have added a notification about chill deficit
    const newNotifs = state.notifications.slice(notifCount);
    const chillNotif = newNotifs.find(n => n.message.toLowerCase().includes('chill'));
    expect(chillNotif).toBeDefined();
  });
});

// ============================================================================
// Fog-of-War: chillHoursRevealed flag
// ============================================================================

describe('Chill hours fog-of-war', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    state.economy.cash = 500_000;
  });

  it('chillHoursRevealed is false initially', () => {
    expect(state.flags['chillHoursRevealed']).toBeFalsy();
  });

  it('set to true when first perennial is planted (single cell)', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    expect(state.flags['chillHoursRevealed']).toBe(true);
  });

  it('annuals do not trigger chillHoursRevealed', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);
    expect(state.flags['chillHoursRevealed']).toBeFalsy();
  });

  it('bulk plant triggers chillHoursRevealed when planting perennials', () => {
    processCommand(state, { type: 'PLANT_BULK', scope: 'row', index: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    expect(state.flags['chillHoursRevealed']).toBe(true);
  });

  it('flag persists after being set (second perennial does not flip it)', () => {
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
    expect(state.flags['chillHoursRevealed']).toBe(true);
    processCommand(state, { type: 'PLANT_CROP', cellRow: 1, cellCol: 0, cropId: 'pistachios' }, SLICE_1_SCENARIO);
    expect(state.flags['chillHoursRevealed']).toBe(true);
  });
});

// ============================================================================
// Teaching Moment: Almonds fail before pistachios as climate warms
// ============================================================================

describe('Chill hours teaching moment', () => {
  it('year 20 chill (630) is insufficient for almonds (700 req) but sufficient for pistachios (600 req)', () => {
    // Year 20 = index 19 in the scenario
    const yearClimate = SLICE_1_SCENARIO.years[19];
    expect(yearClimate.chillHours).toBe(630);

    // Almonds need 700 — deficit
    const almondFactor = Math.min(1, yearClimate.chillHours / 700);
    expect(almondFactor).toBeLessThan(1);
    expect(almondFactor).toBeCloseTo(0.9, 1);

    // Pistachios need 600 — sufficient
    const pistachioFactor = Math.min(1, yearClimate.chillHours / 600);
    expect(pistachioFactor).toBe(1);
  });

  it('year 28 chill (570) causes significant almond deficit but pistachios barely affected', () => {
    const yearClimate = SLICE_1_SCENARIO.years[27]; // year 28 = index 27
    expect(yearClimate.chillHours).toBe(570);

    // Almonds: 570/700 ≈ 0.81
    const almondFactor = Math.min(1, yearClimate.chillHours / 700);
    expect(almondFactor).toBeCloseTo(0.814, 2);

    // Pistachios: 570/600 = 0.95
    const pistachioFactor = Math.min(1, yearClimate.chillHours / 600);
    expect(pistachioFactor).toBeCloseTo(0.95, 2);
  });
});
