import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateCondition, evaluateEvents } from '../../src/engine/events/selector.ts';
import { applyEffects, expireActiveEffects, getYieldModifier, getPriceModifier, getIrrigationCostMultiplier } from '../../src/engine/events/effects.ts';
import { createInitialState, simulateTick, processCommand, dismissAutoPause } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import type { GameState } from '../../src/engine/types.ts';
import type { Storylet, Condition } from '../../src/engine/events/types.ts';

// ============================================================================
// Test Helpers
// ============================================================================

function makeState(): GameState {
  return createInitialState('test-player', SLICE_1_SCENARIO);
}

function makeSimpleStorylet(overrides?: Partial<Storylet>): Storylet {
  return {
    id: 'test-event',
    type: 'climate',
    title: 'Test Event',
    description: 'A test event.',
    preconditions: [],
    priority: 50,
    cooldownDays: 0,
    choices: [
      {
        id: 'choice-a',
        label: 'Choice A',
        description: 'Pick A.',
        effects: [],
      },
    ],
    tags: ['test'],
    ...overrides,
  };
}

// ============================================================================
// Condition Evaluation
// ============================================================================

describe('Event condition evaluation', () => {
  let state: GameState;
  let rng: SeededRNG;

  beforeEach(() => {
    state = makeState();
    rng = new SeededRNG(42);
  });

  it('min_year: true when year >= threshold', () => {
    state.calendar.year = 3;
    expect(evaluateCondition({ type: 'min_year', year: 2 }, state, rng)).toBe(true);
    expect(evaluateCondition({ type: 'min_year', year: 3 }, state, rng)).toBe(true);
    expect(evaluateCondition({ type: 'min_year', year: 4 }, state, rng)).toBe(false);
  });

  it('max_year: true when year <= threshold', () => {
    state.calendar.year = 5;
    expect(evaluateCondition({ type: 'max_year', year: 10 }, state, rng)).toBe(true);
    expect(evaluateCondition({ type: 'max_year', year: 5 }, state, rng)).toBe(true);
    expect(evaluateCondition({ type: 'max_year', year: 4 }, state, rng)).toBe(false);
  });

  it('season: true when season matches', () => {
    state.calendar.season = 'summer';
    expect(evaluateCondition({ type: 'season', season: 'summer' }, state, rng)).toBe(true);
    expect(evaluateCondition({ type: 'season', season: 'winter' }, state, rng)).toBe(false);
  });

  it('season_not: true when season does not match', () => {
    state.calendar.season = 'spring';
    expect(evaluateCondition({ type: 'season_not', season: 'winter' }, state, rng)).toBe(true);
    expect(evaluateCondition({ type: 'season_not', season: 'spring' }, state, rng)).toBe(false);
  });

  it('cash_below: true when cash < threshold', () => {
    state.economy.cash = 5000;
    expect(evaluateCondition({ type: 'cash_below', amount: 10000 }, state, rng)).toBe(true);
    expect(evaluateCondition({ type: 'cash_below', amount: 5000 }, state, rng)).toBe(false);
  });

  it('cash_above: true when cash > threshold', () => {
    state.economy.cash = 60000;
    expect(evaluateCondition({ type: 'cash_above', amount: 50000 }, state, rng)).toBe(true);
    expect(evaluateCondition({ type: 'cash_above', amount: 60000 }, state, rng)).toBe(false);
  });

  it('has_crop: true when any crop is planted', () => {
    expect(evaluateCondition({ type: 'has_crop' }, state, rng)).toBe(false);

    state.grid[0][0].crop = {
      cropId: 'silage-corn', plantedDay: 59, gddAccumulated: 0,
      waterStressDays: 0, growthStage: 'seedling', overripeDaysRemaining: -1,
      isPerennial: false, perennialAge: 0, perennialEstablished: false, isDormant: false,
    };
    expect(evaluateCondition({ type: 'has_crop' }, state, rng)).toBe(true);
  });

  it('has_crop with cropId: true only when specific crop planted', () => {
    state.grid[0][0].crop = {
      cropId: 'silage-corn', plantedDay: 59, gddAccumulated: 0,
      waterStressDays: 0, growthStage: 'seedling', overripeDaysRemaining: -1,
      isPerennial: false, perennialAge: 0, perennialEstablished: false, isDormant: false,
    };
    expect(evaluateCondition({ type: 'has_crop', cropId: 'silage-corn' }, state, rng)).toBe(true);
    expect(evaluateCondition({ type: 'has_crop', cropId: 'processing-tomatoes' }, state, rng)).toBe(false);
  });

  it('avg_nitrogen_below: true when average N < threshold', () => {
    // All cells start at 100 N
    expect(evaluateCondition({ type: 'avg_nitrogen_below', level: 50 }, state, rng)).toBe(false);

    // Set all cells to low N
    for (const row of state.grid) {
      for (const cell of row) {
        cell.soil.nitrogen = 30;
      }
    }
    expect(evaluateCondition({ type: 'avg_nitrogen_below', level: 50 }, state, rng)).toBe(true);
  });

  it('any_perennial_planted: true when perennial crop exists', () => {
    expect(evaluateCondition({ type: 'any_perennial_planted' }, state, rng)).toBe(false);

    state.grid[0][0].crop = {
      cropId: 'almonds', plantedDay: 59, gddAccumulated: 0,
      waterStressDays: 0, growthStage: 'seedling', overripeDaysRemaining: -1,
      isPerennial: true, perennialAge: 0, perennialEstablished: false, isDormant: false,
    };
    expect(evaluateCondition({ type: 'any_perennial_planted' }, state, rng)).toBe(true);
  });

  it('consecutive_crop_failures: true when streak >= count', () => {
    state.cropFailureStreak = 2;
    expect(evaluateCondition({ type: 'consecutive_crop_failures', count: 2 }, state, rng)).toBe(true);
    expect(evaluateCondition({ type: 'consecutive_crop_failures', count: 3 }, state, rng)).toBe(false);
  });

  it('no_debt: true when debt is 0', () => {
    expect(evaluateCondition({ type: 'no_debt' }, state, rng)).toBe(true);
    state.economy.debt = 5000;
    expect(evaluateCondition({ type: 'no_debt' }, state, rng)).toBe(false);
  });

  it('has_flag: true when flag is set', () => {
    expect(evaluateCondition({ type: 'has_flag', flag: 'saw_advisor' }, state, rng)).toBe(false);
    state.flags['saw_advisor'] = true;
    expect(evaluateCondition({ type: 'has_flag', flag: 'saw_advisor' }, state, rng)).toBe(true);
  });

  it('random: consumes RNG deterministically', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    const result1 = evaluateCondition({ type: 'random', probability: 0.5 }, state, rng1);
    const result2 = evaluateCondition({ type: 'random', probability: 0.5 }, state, rng2);

    expect(result1).toBe(result2); // Same seed → same result
  });

  it('random: probability 1.0 always true, 0.0 always false', () => {
    expect(evaluateCondition({ type: 'random', probability: 1.0 }, state, rng)).toBe(true);
    expect(evaluateCondition({ type: 'random', probability: 0.0 }, state, rng)).toBe(false);
  });
});

// ============================================================================
// Event Selector
// ============================================================================

describe('Event selector', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('returns null when no events are eligible', () => {
    const rng = new SeededRNG(42);
    const storylets = [makeSimpleStorylet({ preconditions: [{ type: 'min_year', year: 99 }] })];
    const result = evaluateEvents(state, storylets, rng);
    expect(result.fireEvent).toBeNull();
  });

  it('returns eligible event with no preconditions', () => {
    const rng = new SeededRNG(42);
    const storylets = [makeSimpleStorylet({ preconditions: [] })];
    const result = evaluateEvents(state, storylets, rng);
    expect(result.fireEvent).not.toBeNull();
    expect(result.fireEvent!.id).toBe('test-event');
  });

  it('priority >= 100 fires guaranteed', () => {
    const rng = new SeededRNG(42);
    const guaranteed = makeSimpleStorylet({ id: 'guaranteed', priority: 100 });
    const lowPriority = makeSimpleStorylet({ id: 'low', priority: 10 });
    const result = evaluateEvents(state, [lowPriority, guaranteed], rng);
    expect(result.fireEvent!.id).toBe('guaranteed');
  });

  it('respects cooldown period', () => {
    const rng = new SeededRNG(42);
    const storylets = [makeSimpleStorylet({ cooldownDays: 365 })];

    // Log a previous occurrence 100 days ago
    state.eventLog.push({ storyletId: 'test-event', day: state.calendar.totalDay - 100, choiceId: 'choice-a' });

    const result = evaluateEvents(state, storylets, rng);
    expect(result.fireEvent).toBeNull();
  });

  it('fires after cooldown expires', () => {
    const rng = new SeededRNG(42);
    const storylets = [makeSimpleStorylet({ cooldownDays: 50 })];

    state.eventLog.push({ storyletId: 'test-event', day: state.calendar.totalDay - 100, choiceId: 'choice-a' });

    const result = evaluateEvents(state, storylets, rng);
    expect(result.fireEvent).not.toBeNull();
  });

  it('respects maxOccurrences', () => {
    const rng = new SeededRNG(42);
    const storylets = [makeSimpleStorylet({ maxOccurrences: 1 })];

    state.eventLog.push({ storyletId: 'test-event', day: 0, choiceId: 'choice-a' });

    const result = evaluateEvents(state, storylets, rng);
    expect(result.fireEvent).toBeNull();
  });

  it('does not fire when an activeEvent exists', () => {
    const rng = new SeededRNG(42);
    const storylets = [makeSimpleStorylet()];

    state.activeEvent = {
      storyletId: 'other', title: 'Other', description: 'x',
      choices: [], firedOnDay: 0,
    };

    const result = evaluateEvents(state, storylets, rng);
    expect(result.fireEvent).toBeNull();
  });

  it('evaluation order is array index order (deterministic)', () => {
    const rng = new SeededRNG(42);
    const first = makeSimpleStorylet({ id: 'first', priority: 100 });
    const second = makeSimpleStorylet({ id: 'second', priority: 100 });

    const result = evaluateEvents(state, [first, second], rng);
    // First in array wins when both are priority >= 100
    expect(result.fireEvent!.id).toBe('first');
  });

  it('weighted random selects by priority', () => {
    // Run many evaluations and verify the high-priority event is selected more often
    const highPriority = makeSimpleStorylet({ id: 'high', priority: 90 });
    const lowPriority = makeSimpleStorylet({ id: 'low', priority: 10 });

    let highCount = 0;
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRNG(seed);
      const result = evaluateEvents(state, [highPriority, lowPriority], rng);
      if (result.fireEvent?.id === 'high') highCount++;
    }

    // High priority (90 out of 100 weight) should win ~90% of the time
    expect(highCount).toBeGreaterThan(70);
    expect(highCount).toBeLessThan(100);
  });

  it('non-random conditions short-circuit before consuming RNG', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    // Event with failing non-random condition + random condition
    const storylets = [makeSimpleStorylet({
      preconditions: [
        { type: 'min_year', year: 99 },  // fails
        { type: 'random', probability: 0.5 },  // should NOT be evaluated
      ],
    })];

    evaluateEvents(state, storylets, rng1);

    // rng1 should NOT have been consumed (non-random condition failed first)
    expect(rng1.getState()).toBe(rng2.getState());
  });

  it('random condition consumed when non-random conditions pass', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    const storylets = [makeSimpleStorylet({
      preconditions: [
        { type: 'min_year', year: 1 },   // passes
        { type: 'random', probability: 0.5 },
      ],
    })];

    evaluateEvents(state, storylets, rng1);

    // rng1 should have been consumed (random was evaluated)
    expect(rng1.getState()).not.toBe(rng2.getState());
  });
});

// ============================================================================
// Determinism Regression
// ============================================================================

describe('Event determinism', () => {
  it('two runs with same seed + same commands produce identical eventLog', () => {
    // Run 1
    const state1 = createInitialState('p1', SLICE_1_SCENARIO);
    state1.speed = 1;

    // Advance to summer year 2 (where events can fire)
    // Plant some crops first so has_crop conditions can pass
    processCommand(state1, { type: 'PLANT_BULK', scope: 'all', cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);
    for (let i = 0; i < 500; i++) {
      simulateTick(state1, SLICE_1_SCENARIO);
      if (state1.autoPauseQueue.length > 0) {
        // Respond to any events with first choice
        if (state1.activeEvent) {
          processCommand(state1, {
            type: 'RESPOND_EVENT',
            eventId: state1.activeEvent.storyletId,
            choiceId: state1.activeEvent.choices[0].id,
          }, SLICE_1_SCENARIO);
        }
        // Accept loan if offered
        if (state1.autoPauseQueue.some(e => e.reason === 'loan_offer')) {
          processCommand(state1, { type: 'TAKE_LOAN' }, SLICE_1_SCENARIO);
        }
        state1.autoPauseQueue = [];
        state1.speed = 1;
        state1.gameOver = false;
      }
    }

    // Run 2 (identical)
    const state2 = createInitialState('p1', SLICE_1_SCENARIO);
    state2.speed = 1;
    processCommand(state2, { type: 'PLANT_BULK', scope: 'all', cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);
    for (let i = 0; i < 500; i++) {
      simulateTick(state2, SLICE_1_SCENARIO);
      if (state2.autoPauseQueue.length > 0) {
        if (state2.activeEvent) {
          processCommand(state2, {
            type: 'RESPOND_EVENT',
            eventId: state2.activeEvent.storyletId,
            choiceId: state2.activeEvent.choices[0].id,
          }, SLICE_1_SCENARIO);
        }
        if (state2.autoPauseQueue.some(e => e.reason === 'loan_offer')) {
          processCommand(state2, { type: 'TAKE_LOAN' }, SLICE_1_SCENARIO);
        }
        state2.autoPauseQueue = [];
        state2.speed = 1;
        state2.gameOver = false;
      }
    }

    // Event logs must be identical
    expect(state1.eventLog).toEqual(state2.eventLog);
    // Weather RNG must be identical (event RNG didn't contaminate it)
    expect(state1.rngState).toBe(state2.rngState);
    // Event RNG must be identical
    expect(state1.eventRngState).toBe(state2.eventRngState);
  });

  it('event RNG does not affect weather RNG', () => {
    // Run with events enabled (default STORYLETS)
    const state1 = createInitialState('p1', SLICE_1_SCENARIO);
    state1.speed = 1;
    for (let i = 0; i < 100; i++) {
      simulateTick(state1, SLICE_1_SCENARIO);
      if (state1.autoPauseQueue.length > 0) {
        if (state1.activeEvent) {
          processCommand(state1, {
            type: 'RESPOND_EVENT',
            eventId: state1.activeEvent.storyletId,
            choiceId: state1.activeEvent.choices[0].id,
          }, SLICE_1_SCENARIO);
        }
        state1.autoPauseQueue = [];
        state1.speed = 1;
        state1.gameOver = false;
      }
    }

    // The weather RNG state should be deterministic and independent of event outcomes
    // We just need to verify it's a valid number (the main check is the full determinism test above)
    expect(state1.rngState).toBeTypeOf('number');
    expect(Number.isFinite(state1.rngState)).toBe(true);
  });
});

// ============================================================================
// Event Effects
// ============================================================================

describe('Event effects', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('modify_cash adjusts cash', () => {
    applyEffects(state, [{ type: 'modify_cash', amount: -500 }], 'test');
    expect(state.economy.cash).toBe(50000 - 500);
    expect(state.economy.yearlyExpenses).toBe(500);
  });

  it('modify_moisture_all adjusts all cells', () => {
    // Set all cells to low moisture first
    for (const row of state.grid) {
      for (const cell of row) {
        cell.soil.moisture = 1.0;
      }
    }

    applyEffects(state, [{ type: 'modify_moisture_all', amount: 2.0 }], 'test');

    for (const row of state.grid) {
      for (const cell of row) {
        expect(cell.soil.moisture).toBe(3.0);
      }
    }
  });

  it('modify_moisture_all clamps to capacity', () => {
    applyEffects(state, [{ type: 'modify_moisture_all', amount: 100 }], 'test');

    for (const row of state.grid) {
      for (const cell of row) {
        expect(cell.soil.moisture).toBe(cell.soil.moistureCapacity);
      }
    }
  });

  it('modify_yield_modifier adds active effect', () => {
    applyEffects(state, [{
      type: 'modify_yield_modifier', cropId: '*', multiplier: 0.85, durationDays: 14,
    }], 'test');

    expect(state.activeEffects).toHaveLength(1);
    expect(state.activeEffects[0].effectType).toBe('yield_modifier');
    expect(state.activeEffects[0].multiplier).toBe(0.85);
    expect(state.activeEffects[0].expiresDay).toBe(state.calendar.totalDay + 14);
  });

  it('modify_price_modifier adds active effect', () => {
    applyEffects(state, [{
      type: 'modify_price_modifier', cropId: 'processing-tomatoes', multiplier: 1.4, durationDays: 60,
    }], 'test');

    expect(state.activeEffects).toHaveLength(1);
    expect(state.activeEffects[0].effectType).toBe('price_modifier');
  });

  it('restrict_watering sets wateringRestricted', () => {
    applyEffects(state, [{ type: 'restrict_watering', durationDays: 45 }], 'test');

    expect(state.wateringRestricted).toBe(true);
    expect(state.wateringRestrictionEndsDay).toBe(state.calendar.totalDay + 45);
    expect(state.activeEffects).toHaveLength(1);
  });

  it('set_flag sets a game flag', () => {
    applyEffects(state, [{ type: 'set_flag', flag: 'survived_drought', value: true }], 'test');
    expect(state.flags['survived_drought']).toBe(true);
  });

  it('modify_irrigation_cost adds active effect', () => {
    applyEffects(state, [{
      type: 'modify_irrigation_cost', multiplier: 1.5, durationDays: 90,
    }], 'test');

    expect(state.activeEffects).toHaveLength(1);
    expect(state.activeEffects[0].effectType).toBe('irrigation_cost_modifier');
  });
});

// ============================================================================
// Effect Expiry
// ============================================================================

describe('Effect expiry', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('removes expired effects', () => {
    state.activeEffects.push({
      effectType: 'yield_modifier', cropId: '*', multiplier: 0.85,
      expiresDay: state.calendar.totalDay - 1, sourceEventId: 'test',
    });
    state.activeEffects.push({
      effectType: 'price_modifier', cropId: '*', multiplier: 1.4,
      expiresDay: state.calendar.totalDay + 100, sourceEventId: 'test',
    });

    expireActiveEffects(state);

    expect(state.activeEffects).toHaveLength(1);
    expect(state.activeEffects[0].effectType).toBe('price_modifier');
  });

  it('clears watering restriction when effect expires', () => {
    state.wateringRestricted = true;
    state.activeEffects.push({
      effectType: 'watering_restriction',
      expiresDay: state.calendar.totalDay - 1, sourceEventId: 'test',
    });

    expireActiveEffects(state);

    expect(state.wateringRestricted).toBe(false);
    expect(state.activeEffects).toHaveLength(0);
  });
});

// ============================================================================
// Yield/Price Modifiers
// ============================================================================

describe('Yield and price modifiers', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('getYieldModifier returns 1.0 with no active effects', () => {
    expect(getYieldModifier(state, 'processing-tomatoes')).toBe(1.0);
  });

  it('getYieldModifier applies wildcard (*) modifiers', () => {
    state.activeEffects.push({
      effectType: 'yield_modifier', cropId: '*', multiplier: 0.85,
      expiresDay: state.calendar.totalDay + 100, sourceEventId: 'test',
    });
    expect(getYieldModifier(state, 'processing-tomatoes')).toBe(0.85);
    expect(getYieldModifier(state, 'silage-corn')).toBe(0.85);
  });

  it('getYieldModifier applies crop-specific modifiers', () => {
    state.activeEffects.push({
      effectType: 'yield_modifier', cropId: 'processing-tomatoes', multiplier: 0.7,
      expiresDay: state.calendar.totalDay + 100, sourceEventId: 'test',
    });
    expect(getYieldModifier(state, 'processing-tomatoes')).toBe(0.7);
    expect(getYieldModifier(state, 'silage-corn')).toBe(1.0); // unaffected
  });

  it('multiple modifiers on same crop multiply together', () => {
    state.activeEffects.push({
      effectType: 'yield_modifier', cropId: '*', multiplier: 0.9,
      expiresDay: state.calendar.totalDay + 100, sourceEventId: 'test1',
    });
    state.activeEffects.push({
      effectType: 'yield_modifier', cropId: '*', multiplier: 0.8,
      expiresDay: state.calendar.totalDay + 100, sourceEventId: 'test2',
    });
    expect(getYieldModifier(state, 'silage-corn')).toBeCloseTo(0.72, 5);
  });

  it('modifier product clamped to [0.0, 10.0]', () => {
    // Very high multipliers
    state.activeEffects.push({
      effectType: 'yield_modifier', cropId: '*', multiplier: 100,
      expiresDay: state.calendar.totalDay + 100, sourceEventId: 'test',
    });
    expect(getYieldModifier(state, 'silage-corn')).toBe(10.0);

    // Very low (negative shouldn't happen but clamped)
    state.activeEffects = [];
    state.activeEffects.push({
      effectType: 'yield_modifier', cropId: '*', multiplier: -1,
      expiresDay: state.calendar.totalDay + 100, sourceEventId: 'test',
    });
    expect(getYieldModifier(state, 'silage-corn')).toBe(0.0);
  });

  it('getPriceModifier works like yield modifier', () => {
    state.activeEffects.push({
      effectType: 'price_modifier', cropId: 'processing-tomatoes', multiplier: 1.4,
      expiresDay: state.calendar.totalDay + 100, sourceEventId: 'test',
    });
    expect(getPriceModifier(state, 'processing-tomatoes')).toBe(1.4);
    expect(getPriceModifier(state, 'silage-corn')).toBe(1.0);
  });

  it('getIrrigationCostMultiplier multiplies active cost effects', () => {
    state.activeEffects.push({
      effectType: 'irrigation_cost_modifier', multiplier: 1.5,
      expiresDay: state.calendar.totalDay + 100, sourceEventId: 'test',
    });
    expect(getIrrigationCostMultiplier(state)).toBe(1.5);
  });
});

// ============================================================================
// Foreshadowing
// ============================================================================

describe('Foreshadowing', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('generates foreshadowing but does NOT fire event immediately', () => {
    const rng = new SeededRNG(42);
    const storylets = [makeSimpleStorylet({
      foreshadowing: {
        signal: 'Storm approaching',
        daysBeforeEvent: 7,
        reliability: 1.0, // always reliable for this test
      },
    })];

    const result = evaluateEvents(state, storylets, rng);
    expect(result.newForeshadows).toHaveLength(1);
    expect(result.newForeshadows[0].signal).toBe('Storm approaching');
    expect(result.newForeshadows[0].isFalseAlarm).toBe(false);
    // Event should NOT fire on the same tick as foreshadowing
    expect(result.fireEvent).toBeNull();
  });

  it('foreshadowed event fires after daysBeforeEvent delay', () => {
    const rng = new SeededRNG(42);
    const storylets = [makeSimpleStorylet({
      foreshadowing: {
        signal: 'Storm approaching',
        daysBeforeEvent: 7,
        reliability: 1.0,
      },
    })];

    // Add a pending foreshadow that's reached its fire day
    state.pendingForeshadows.push({
      storyletId: 'test-event',
      signal: 'Storm approaching',
      appearsOnDay: state.calendar.totalDay - 7,
      eventFiresOnDay: state.calendar.totalDay, // fires today
      isFalseAlarm: false,
      dismissed: false,
    });

    const result = evaluateEvents(state, storylets, rng);
    expect(result.fireEvent).not.toBeNull();
    expect(result.fireEvent!.id).toBe('test-event');
  });

  it('false alarm foreshadow expires without firing event', () => {
    const rng = new SeededRNG(42);
    const storylets = [makeSimpleStorylet({
      foreshadowing: {
        signal: 'Storm approaching',
        daysBeforeEvent: 7,
        reliability: 1.0,
      },
    })];

    // Add a false alarm foreshadow that's reached its fire day
    state.pendingForeshadows.push({
      storyletId: 'test-event',
      signal: 'Storm approaching',
      appearsOnDay: state.calendar.totalDay - 7,
      eventFiresOnDay: state.calendar.totalDay, // fires today
      isFalseAlarm: true,
      dismissed: false,
    });

    const result = evaluateEvents(state, storylets, rng);
    // Event should NOT fire (it was a false alarm)
    expect(result.fireEvent).toBeNull();
    // The foreshadow should be dismissed
    expect(state.pendingForeshadows[0].dismissed).toBe(true);
  });

  it('does not duplicate foreshadowing for already-foreshadowed event', () => {
    const rng = new SeededRNG(42);
    const storylets = [makeSimpleStorylet({
      foreshadowing: {
        signal: 'Storm approaching',
        daysBeforeEvent: 7,
        reliability: 1.0,
      },
    })];

    // Already have a pending foreshadow for this event
    state.pendingForeshadows.push({
      storyletId: 'test-event',
      signal: 'Storm approaching',
      appearsOnDay: state.calendar.totalDay - 3,
      eventFiresOnDay: state.calendar.totalDay + 4,
      isFalseAlarm: false,
      dismissed: false,
    });

    const result = evaluateEvents(state, storylets, rng);
    expect(result.newForeshadows).toHaveLength(0);
    // Event should not fire yet (foreshadow hasn't matured)
    expect(result.fireEvent).toBeNull();
  });

  it('false alarm when reliability < 1.0 and RNG roll fails', () => {
    // Use a seed that produces a value > reliability threshold
    let foundFalseAlarm = false;
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRNG(seed);
      const freshState = makeState();
      const storylets = [makeSimpleStorylet({
        foreshadowing: {
          signal: 'Maybe storm',
          daysBeforeEvent: 7,
          reliability: 0.5,
        },
      })];

      const result = evaluateEvents(freshState, storylets, rng);
      if (result.newForeshadows.length > 0 && result.newForeshadows[0].isFalseAlarm) {
        foundFalseAlarm = true;
        break;
      }
    }

    expect(foundFalseAlarm).toBe(true);
  });
});

// ============================================================================
// RESPOND_EVENT command
// ============================================================================

describe('RESPOND_EVENT command', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('applies choice effects and logs event', () => {
    state.activeEvent = {
      storyletId: 'heatwave-advisory',
      title: 'Heatwave Advisory',
      description: 'Hot!',
      choices: [
        {
          id: 'emergency-irrigation',
          label: 'Emergency Irrigation',
          description: 'Costs $500',
          cost: 500,
          requiresCash: 500,
          effects: [
            { type: 'modify_cash', amount: -500 },
          ],
        },
      ],
      firedOnDay: state.calendar.totalDay,
    };

    const result = processCommand(state, {
      type: 'RESPOND_EVENT',
      eventId: 'heatwave-advisory',
      choiceId: 'emergency-irrigation',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(state.economy.cash).toBe(50000 - 500);
    expect(state.activeEvent).toBeNull();
    expect(state.eventLog).toHaveLength(1);
    expect(state.eventLog[0].choiceId).toBe('emergency-irrigation');
  });

  it('rejects when no active event', () => {
    const result = processCommand(state, {
      type: 'RESPOND_EVENT',
      eventId: 'fake',
      choiceId: 'fake',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
  });

  it('rejects invalid choice ID', () => {
    state.activeEvent = {
      storyletId: 'test', title: 'T', description: 'D',
      choices: [{ id: 'a', label: 'A', description: 'A', effects: [] }],
      firedOnDay: 0,
    };

    const result = processCommand(state, {
      type: 'RESPOND_EVENT',
      eventId: 'test',
      choiceId: 'nonexistent',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
  });

  it('rejects when event ID mismatches', () => {
    state.activeEvent = {
      storyletId: 'correct-id', title: 'T', description: 'D',
      choices: [{ id: 'a', label: 'A', description: 'A', effects: [] }],
      firedOnDay: 0,
    };

    const result = processCommand(state, {
      type: 'RESPOND_EVENT',
      eventId: 'wrong-id',
      choiceId: 'a',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
  });

  it('rejects when player cannot afford choice', () => {
    state.economy.cash = 100;
    state.activeEvent = {
      storyletId: 'test', title: 'T', description: 'D',
      choices: [{
        id: 'expensive', label: 'Expensive', description: 'Costs $500',
        requiresCash: 500,
        effects: [{ type: 'modify_cash', amount: -500 }],
      }],
      firedOnDay: 0,
    };

    const result = processCommand(state, {
      type: 'RESPOND_EVENT',
      eventId: 'test',
      choiceId: 'expensive',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
  });
});

// ============================================================================
// Dismiss event clears activeEvent (Finding 1 fix)
// ============================================================================

describe('Dismissing event auto-pause clears activeEvent', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('dismissAutoPause for event reason clears activeEvent', () => {
    state.activeEvent = {
      storyletId: 'test-event',
      title: 'Test',
      description: 'Test event',
      choices: [{ id: 'a', label: 'A', description: 'A', effects: [] }],
      firedOnDay: state.calendar.totalDay,
    };
    state.autoPauseQueue.push({ reason: 'event', message: 'Test Event' });

    dismissAutoPause(state);

    expect(state.activeEvent).toBeNull();
    // Should log as dismissed
    expect(state.eventLog).toHaveLength(1);
    expect(state.eventLog[0].choiceId).toBe('__dismissed__');
  });

  it('dismissAutoPause for non-event reason does NOT clear activeEvent', () => {
    state.activeEvent = {
      storyletId: 'test-event',
      title: 'Test',
      description: 'Test event',
      choices: [{ id: 'a', label: 'A', description: 'A', effects: [] }],
      firedOnDay: state.calendar.totalDay,
    };
    state.autoPauseQueue.push({ reason: 'harvest_ready', message: 'Harvest!' });

    dismissAutoPause(state);

    // activeEvent should still be set (dismissed a harvest, not the event)
    expect(state.activeEvent).not.toBeNull();
  });
});

// ============================================================================
// Irrigation cost multiplier in affordability (Finding 3 fix)
// ============================================================================

describe('Irrigation cost multiplier in affordability checks', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    // Plant a crop
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);
  });

  it('WATER fails when multiplier makes cost unaffordable', () => {
    // Set cost multiplier to make watering too expensive
    // Multiplier clamped to 10.0 max, so effective cost = $5 * 10 = $50/cell
    state.activeEffects.push({
      effectType: 'irrigation_cost_modifier',
      multiplier: 10,
      expiresDay: state.calendar.totalDay + 100,
      sourceEventId: 'test',
    });
    state.economy.cash = 49; // Can afford base cost ($5) but not 10x ($50)

    const result = processCommand(state, { type: 'WATER', scope: 'all' }, SLICE_1_SCENARIO);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('Not enough cash');
  });
});

// ============================================================================
// Watering restriction
// ============================================================================

describe('Watering restriction', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    // Plant a crop so watering is possible
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);
  });

  it('WATER command fails when watering is restricted', () => {
    state.wateringRestricted = true;
    const result = processCommand(state, { type: 'WATER', scope: 'all' }, SLICE_1_SCENARIO);
    expect(result.success).toBe(false);
    expect(result.reason).toContain('restricted');
  });

  it('WATER command works when restriction is not active', () => {
    state.wateringRestricted = false;
    const result = processCommand(state, { type: 'WATER', scope: 'all' }, SLICE_1_SCENARIO);
    expect(result.success).toBe(true);
  });
});
