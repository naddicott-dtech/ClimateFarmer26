/**
 * Bulk Tree Removal Tests — REMOVE_CROP_BULK command
 *
 * Tests engine-level bulk removal: perennials only, 2+ threshold,
 * atomic cost deduction, and mixed-crop scenarios.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, processCommand } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { getCropDefinition } from '../../src/data/crops.ts';
import type { GameState } from '../../src/engine/types.ts';

function makeState(): GameState {
  return createInitialState('test-bulk-remove', SLICE_1_SCENARIO);
}

function plantPerennial(state: GameState, row: number, col: number, cropId = 'almonds'): void {
  processCommand(state, { type: 'PLANT_CROP', cellRow: row, cellCol: col, cropId }, SLICE_1_SCENARIO);
}

function plantAnnual(state: GameState, row: number, col: number, cropId = 'silage-corn'): void {
  processCommand(state, { type: 'PLANT_CROP', cellRow: row, cellCol: col, cropId }, SLICE_1_SCENARIO);
}

// ---------------------------------------------------------------------------
// §1 — Basic behavior
// ---------------------------------------------------------------------------

describe('REMOVE_CROP_BULK — basic behavior', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    state.economy.cash = 50000; // plenty of cash
  });

  it('removes all perennials in scope all and deducts correct total cost', () => {
    plantPerennial(state, 0, 0, 'almonds');
    plantPerennial(state, 1, 0, 'almonds');
    plantPerennial(state, 2, 0, 'almonds');
    const cashBefore = state.economy.cash;
    const removalCost = getCropDefinition('almonds').removalCost!;

    const result = processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'all',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(result.cellsAffected).toBe(3);
    expect(state.grid[0][0].crop).toBeNull();
    expect(state.grid[1][0].crop).toBeNull();
    expect(state.grid[2][0].crop).toBeNull();
    expect(state.economy.cash).toBe(cashBefore - removalCost * 3);
  });

  it('removes only perennials in a row (annuals untouched)', () => {
    plantPerennial(state, 0, 0, 'almonds');
    plantPerennial(state, 0, 1, 'citrus-navels');
    plantAnnual(state, 0, 2, 'silage-corn');

    const result = processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'row', index: 0,
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(result.cellsAffected).toBe(2);
    expect(state.grid[0][0].crop).toBeNull();
    expect(state.grid[0][1].crop).toBeNull();
    expect(state.grid[0][2].crop).not.toBeNull(); // corn untouched
    expect(state.grid[0][2].crop!.cropId).toBe('silage-corn');
  });

  it('removes only perennials in a col (annuals untouched)', () => {
    plantPerennial(state, 0, 0, 'almonds');
    plantPerennial(state, 1, 0, 'almonds');
    plantAnnual(state, 2, 0, 'silage-corn');

    const result = processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'col', index: 0,
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(result.cellsAffected).toBe(2);
    expect(state.grid[0][0].crop).toBeNull();
    expect(state.grid[1][0].crop).toBeNull();
    expect(state.grid[2][0].crop!.cropId).toBe('silage-corn');
  });

  it('tracks cost in state.tracking.currentExpenses.removal', () => {
    plantPerennial(state, 0, 0, 'almonds');
    plantPerennial(state, 0, 1, 'almonds');
    const removalBefore = state.tracking.currentExpenses.removal;
    const removalCost = getCropDefinition('almonds').removalCost!;

    processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'all',
    }, SLICE_1_SCENARIO);

    expect(state.tracking.currentExpenses.removal).toBe(removalBefore + removalCost * 2);
  });

  it('adds notification with tree count and total cost', () => {
    plantPerennial(state, 0, 0, 'almonds');
    plantPerennial(state, 0, 1, 'almonds');
    const notifsBefore = state.notifications.length;

    processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'all',
    }, SLICE_1_SCENARIO);

    expect(state.notifications.length).toBeGreaterThan(notifsBefore);
    const lastNotif = state.notifications[state.notifications.length - 1];
    expect(lastNotif.message).toContain('2 tree(s)');
    expect(lastNotif.message).toContain('$1,000');
  });
});

// ---------------------------------------------------------------------------
// §2 — 2+ threshold (engine-enforced)
// ---------------------------------------------------------------------------

describe('REMOVE_CROP_BULK — 2+ threshold', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    state.economy.cash = 50000;
  });

  it('returns error when 0 perennials in scope', () => {
    const result = processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'all',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('No trees');
  });

  it('returns error when exactly 1 perennial in scope', () => {
    plantPerennial(state, 0, 0, 'almonds');

    const result = processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'all',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('single removal');
  });

  it('succeeds when exactly 2 perennials in scope', () => {
    plantPerennial(state, 0, 0, 'almonds');
    plantPerennial(state, 0, 1, 'almonds');

    const result = processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'all',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(result.cellsAffected).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// §3 — Edge cases
// ---------------------------------------------------------------------------

describe('REMOVE_CROP_BULK — edge cases', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    state.economy.cash = 50000;
  });

  it('returns error when cash insufficient for total removal cost', () => {
    plantPerennial(state, 0, 0, 'almonds');
    plantPerennial(state, 0, 1, 'almonds');
    state.economy.cash = 100; // almonds cost $500 each to remove

    const result = processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'all',
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Not enough cash');
  });

  it('does not remove any trees if cash insufficient (atomic)', () => {
    plantPerennial(state, 0, 0, 'almonds');
    plantPerennial(state, 0, 1, 'almonds');
    state.economy.cash = 100;

    processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'all',
    }, SLICE_1_SCENARIO);

    // Both trees should still be there
    expect(state.grid[0][0].crop).not.toBeNull();
    expect(state.grid[0][1].crop).not.toBeNull();
  });

  it('returns error for invalid row index', () => {
    const result = processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'row', index: 99,
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Invalid row');
  });

  it('returns error for invalid col index', () => {
    const result = processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'col', index: -1,
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(false);
    expect(result.reason).toContain('Invalid column');
  });

  it('mixed crops: removes almonds + citrus but leaves corn untouched', () => {
    plantPerennial(state, 0, 0, 'almonds');
    plantPerennial(state, 0, 1, 'citrus-navels');
    plantAnnual(state, 0, 2, 'silage-corn');
    const almondCost = getCropDefinition('almonds').removalCost!;
    const citrusCost = getCropDefinition('citrus-navels').removalCost!;
    const cashBefore = state.economy.cash;

    const result = processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'row', index: 0,
    }, SLICE_1_SCENARIO);

    expect(result.success).toBe(true);
    expect(result.cellsAffected).toBe(2);
    expect(state.grid[0][0].crop).toBeNull();
    expect(state.grid[0][1].crop).toBeNull();
    expect(state.grid[0][2].crop!.cropId).toBe('silage-corn');
    expect(state.economy.cash).toBe(cashBefore - almondCost - citrusCost);
  });
});

// ---------------------------------------------------------------------------
// §4 — Cost calculation
// ---------------------------------------------------------------------------

describe('REMOVE_CROP_BULK — cost calculation', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    state.economy.cash = 50000;
  });

  it('almonds ($500) × 3 cells = $1,500 total', () => {
    plantPerennial(state, 0, 0, 'almonds');
    plantPerennial(state, 0, 1, 'almonds');
    plantPerennial(state, 0, 2, 'almonds');
    const cashBefore = state.economy.cash;

    processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'all',
    }, SLICE_1_SCENARIO);

    expect(state.economy.cash).toBe(cashBefore - 1500);
  });

  it('mixed: 2 almonds ($500) + 1 citrus ($400) = $1,400 total', () => {
    plantPerennial(state, 0, 0, 'almonds');
    plantPerennial(state, 0, 1, 'almonds');
    plantPerennial(state, 0, 2, 'citrus-navels');
    const cashBefore = state.economy.cash;

    processCommand(state, {
      type: 'REMOVE_CROP_BULK', scope: 'all',
    }, SLICE_1_SCENARIO);

    expect(state.economy.cash).toBe(cashBefore - 1400);
  });
});
