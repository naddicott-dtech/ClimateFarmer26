import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateCondition, drawSeasonalEvents, hasRandomCondition } from '../../src/engine/events/selector.ts';
import { createInitialState, processCommand } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import type { GameState } from '../../src/engine/types.ts';
import type { Storylet, Condition } from '../../src/engine/events/types.ts';

// ============================================================================
// Test Helpers
// ============================================================================

const FORUM_IDS = [
  'forum-rotation-tip',
  'forum-neighbor-corn-died',
  'forum-water-board-gossip',
  'forum-market-whisper',
  'forum-heat-worry',
  'forum-insurance-debate',
  'forum-organic-buzz',
  'forum-bad-advice',
];

function makeState(): GameState {
  return createInitialState('test-6b', SLICE_1_SCENARIO);
}

function setYear(state: GameState, year: number): void {
  state.calendar.year = year;
}

/**
 * Evaluate all non-random preconditions for a storylet.
 * Returns true if all pass (matches drawSeasonalEvents step 2 logic).
 */
function evaluateNonRandomConditions(storylet: Storylet, state: GameState): boolean {
  const rng = new SeededRNG(12345);
  const nonRandom = storylet.preconditions.filter(c => c.type !== 'random');
  return nonRandom.every(c => evaluateCondition(c, state, rng));
}

// ============================================================================
// §1: Data validation — all 8 Forum storylets
// ============================================================================

describe('Slice 6b: Forum storylet data validation', () => {
  it('all 8 Forum storylets exist in the STORYLETS array', () => {
    for (const id of FORUM_IDS) {
      const storylet = STORYLETS.find(s => s.id === id);
      expect(storylet, `Missing storylet: ${id}`).toBeDefined();
    }
  });

  it('all Forum storylets have type "community"', () => {
    for (const id of FORUM_IDS) {
      const storylet = STORYLETS.find(s => s.id === id)!;
      expect(storylet.type, `${id} should have type "community"`).toBe('community');
    }
  });

  it('all Forum storylets have a random precondition (seasonal draw)', () => {
    for (const id of FORUM_IDS) {
      const storylet = STORYLETS.find(s => s.id === id)!;
      const hasRandom = storylet.preconditions.some(c => c.type === 'random');
      expect(hasRandom, `${id} should have a random precondition`).toBe(true);
    }
  });

  it('all Forum storylets require has_flag met_forum', () => {
    for (const id of FORUM_IDS) {
      const storylet = STORYLETS.find(s => s.id === id)!;
      const hasMetForum = storylet.preconditions.some(
        c => c.type === 'has_flag' && c.flag === 'met_forum',
      );
      expect(hasMetForum, `${id} should require has_flag met_forum`).toBe(true);
    }
  });

  it('all Forum storylets have maxOccurrences = 1', () => {
    for (const id of FORUM_IDS) {
      const storylet = STORYLETS.find(s => s.id === id)!;
      expect(storylet.maxOccurrences, `${id} should have maxOccurrences = 1`).toBe(1);
    }
  });

  it('all Forum storylets have advisorId "growers-forum"', () => {
    for (const id of FORUM_IDS) {
      const storylet = STORYLETS.find(s => s.id === id)!;
      expect(storylet.advisorId, `${id} should have advisorId "growers-forum"`).toBe('growers-forum');
    }
  });
});

// ============================================================================
// §2: Behavioral tests
// ============================================================================

describe('Slice 6b: Forum storylet behavioral tests', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('Forum storylets do not fire without met_forum flag', () => {
    setYear(state, 5); // in range for most Forum events
    // Do NOT set met_forum flag
    for (const id of FORUM_IDS) {
      const storylet = STORYLETS.find(s => s.id === id)!;
      expect(
        evaluateNonRandomConditions(storylet, state),
        `${id} should not pass without met_forum`,
      ).toBe(false);
    }
  });

  it('forum-water-board-gossip fires at Y7 and fails at Y6 and Y10', () => {
    state.flags['met_forum'] = true;
    const storylet = STORYLETS.find(s => s.id === 'forum-water-board-gossip')!;

    // Y7 — should pass
    setYear(state, 7);
    expect(evaluateNonRandomConditions(storylet, state)).toBe(true);

    // Y6 — too early
    setYear(state, 6);
    expect(evaluateNonRandomConditions(storylet, state)).toBe(false);

    // Y10 — too late
    setYear(state, 10);
    expect(evaluateNonRandomConditions(storylet, state)).toBe(false);
  });

  it('forum-neighbor-corn-died requires corn planted', () => {
    state.flags['met_forum'] = true;
    setYear(state, 6);
    const storylet = STORYLETS.find(s => s.id === 'forum-neighbor-corn-died')!;

    // No corn planted — should fail
    expect(evaluateNonRandomConditions(storylet, state)).toBe(false);

    // Plant corn (cropId is 'silage-corn')
    processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);
    expect(evaluateNonRandomConditions(storylet, state)).toBe(true);
  });

  it('"community" type gets separate cap slot from "advisor" in seasonal draw', () => {
    // Craft two synthetic storylets: one advisor, one community, both with random: 1.0
    const advisorStorylet: Storylet = {
      id: 'test-advisor',
      type: 'advisor',
      title: 'Test Advisor',
      description: 'Test',
      preconditions: [
        { type: 'min_year', year: 1 },
        { type: 'random', probability: 1.0 },
      ],
      priority: 50,
      cooldownDays: 0,
      choices: [{ id: 'ok', label: 'OK', description: 'OK', effects: [] }],
      tags: [],
    };

    const communityStorylet: Storylet = {
      id: 'test-community',
      type: 'community',
      title: 'Test Community',
      description: 'Test',
      preconditions: [
        { type: 'min_year', year: 1 },
        { type: 'random', probability: 1.0 },
      ],
      priority: 50,
      cooldownDays: 0,
      choices: [{ id: 'ok', label: 'OK', description: 'OK', effects: [] }],
      tags: [],
    };

    setYear(state, 2);

    // Season boundaries for summer (roughly day 152-243)
    const seasonStart = 152;
    const seasonEnd = 243;

    const result = drawSeasonalEvents(
      state,
      [advisorStorylet, communityStorylet],
      42,
      0.5, // moderate stress
      seasonStart,
      seasonEnd,
    );

    // Both should be accepted — different family types
    const acceptedIds = result.map(r => r.storyletId);
    expect(acceptedIds).toContain('test-advisor');
    expect(acceptedIds).toContain('test-community');
    expect(acceptedIds.length).toBe(2);
  });
});

// ============================================================================
// §3: Avocado unlock timing fix
// ============================================================================

describe('Slice 6b: regime-heat-threshold timing fix', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('regime-heat-threshold fires at Y15-20 (not Y20-25)', () => {
    const storylet = STORYLETS.find(s => s.id === 'regime-heat-threshold')!;

    // Check the preconditions directly
    const minYear = storylet.preconditions.find(
      (c): c is Extract<Condition, { type: 'min_year' }> => c.type === 'min_year',
    );
    const maxYear = storylet.preconditions.find(
      (c): c is Extract<Condition, { type: 'max_year' }> => c.type === 'max_year',
    );

    expect(minYear?.year).toBe(15);
    expect(maxYear?.year).toBe(20);
  });
});
