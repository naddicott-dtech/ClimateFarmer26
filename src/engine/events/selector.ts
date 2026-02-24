// ============================================================================
// Event Selector — ClimateFarmer26 Slice 2a
// Evaluates storylet preconditions, selects events, manages foreshadowing.
// ============================================================================

import type { GameState } from '../types.ts';
import type { Storylet, Condition, PendingForeshadow } from './types.ts';
import { SeededRNG } from '../rng.ts';
import { GRID_ROWS, GRID_COLS } from '../types.ts';

export interface EvaluateEventsResult {
  fireEvent: Storylet | null;
  newForeshadows: PendingForeshadow[];
}

/**
 * Evaluate a single condition against the current game state.
 * For `random` conditions, consumes one value from the event RNG.
 */
export function evaluateCondition(
  condition: Condition,
  state: GameState,
  rng: SeededRNG,
): boolean {
  switch (condition.type) {
    case 'min_year':
      return state.calendar.year >= condition.year;
    case 'max_year':
      return state.calendar.year <= condition.year;
    case 'season':
      return state.calendar.season === condition.season;
    case 'season_not':
      return state.calendar.season !== condition.season;
    case 'cash_below':
      return state.economy.cash < condition.amount;
    case 'cash_above':
      return state.economy.cash > condition.amount;
    case 'has_crop': {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const crop = state.grid[r][c].crop;
          if (crop) {
            if (!condition.cropId || crop.cropId === condition.cropId) return true;
          }
        }
      }
      return false;
    }
    case 'avg_nitrogen_below': {
      let totalN = 0;
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          totalN += state.grid[r][c].soil.nitrogen;
        }
      }
      return (totalN / (GRID_ROWS * GRID_COLS)) < condition.level;
    }
    case 'any_perennial_planted': {
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          const crop = state.grid[r][c].crop;
          if (crop && crop.isPerennial) return true;
        }
      }
      return false;
    }
    case 'consecutive_crop_failures':
      return state.cropFailureStreak >= condition.count;
    case 'no_debt':
      return state.economy.debt === 0;
    case 'has_flag':
      return state.flags[condition.flag] === true;
    case 'random':
      return rng.next() < condition.probability;
    default: {
      const _exhaustive: never = condition;
      throw new Error(`Unhandled condition type: ${(_exhaustive as Condition).type}`);
    }
  }
}

/**
 * Check if a storylet is on cooldown based on event history.
 */
function isOnCooldown(storylet: Storylet, state: GameState): boolean {
  if (storylet.cooldownDays <= 0) return false;
  const lastOccurrence = state.eventLog
    .filter(e => e.storyletId === storylet.id)
    .sort((a, b) => b.day - a.day)[0];
  if (!lastOccurrence) return false;
  return (state.calendar.totalDay - lastOccurrence.day) < storylet.cooldownDays;
}

/**
 * Check if a storylet has exceeded its max occurrences.
 */
function hasExceededMaxOccurrences(storylet: Storylet, state: GameState): boolean {
  if (storylet.maxOccurrences === undefined) return false;
  const count = state.eventLog.filter(e => e.storyletId === storylet.id).length;
  return count >= storylet.maxOccurrences;
}

/**
 * Evaluate all preconditions for a storylet.
 * Non-random conditions are evaluated first (short-circuit on first false).
 * The `random` condition is evaluated ONLY if all non-random conditions pass.
 * This ensures deterministic RNG consumption: exactly one RNG call per storylet
 * whose non-random preconditions pass.
 */
function evaluateAllConditions(
  storylet: Storylet,
  state: GameState,
  rng: SeededRNG,
): boolean {
  const nonRandom = storylet.preconditions.filter(c => c.type !== 'random');
  const randomConds = storylet.preconditions.filter(c => c.type === 'random');

  // Evaluate non-random conditions first (short-circuit)
  for (const cond of nonRandom) {
    if (!evaluateCondition(cond, state, rng)) return false;
  }

  // Only evaluate random conditions if all non-random passed
  for (const cond of randomConds) {
    if (!evaluateCondition(cond, state, rng)) return false;
  }

  return true;
}

/**
 * Main event evaluation. Called once per tick from simulateTick.
 *
 * Determinism guarantees:
 * - Storylets are evaluated in array index order (always)
 * - Non-random conditions short-circuit before consuming RNG
 * - Random conditions consume exactly one RNG call per eligible storylet
 * - Ties broken by array index (stable sort)
 *
 * Foreshadowing lifecycle:
 * - When a storylet's conditions pass and it has foreshadowing with no pending
 *   foreshadow: create the foreshadow but DON'T fire the event yet.
 * - On subsequent ticks, if a pending foreshadow exists and totalDay >= eventFiresOnDay:
 *   the storylet becomes eligible to fire (if not a false alarm).
 * - False alarm foreshadows expire silently at eventFiresOnDay (marked dismissed).
 * - Storylets without foreshadowing fire immediately when conditions pass.
 */
export function evaluateEvents(
  state: GameState,
  allStorylets: readonly Storylet[],
  rng: SeededRNG,
): EvaluateEventsResult {
  // Don't fire new events while one is pending
  if (state.activeEvent) {
    return { fireEvent: null, newForeshadows: [] };
  }

  const newForeshadows: PendingForeshadow[] = [];

  // Phase 1: Resolve mature foreshadows (totalDay >= eventFiresOnDay).
  // Foreshadowed events fire with guaranteed priority — the player was warned,
  // so the event must follow through. Only one fires per tick; others stay pending.
  // False alarms are dismissed silently.
  let foreshadowedFire: Storylet | null = null;

  for (const foreshadow of state.pendingForeshadows) {
    if (foreshadow.dismissed) continue;
    if (state.calendar.totalDay < foreshadow.eventFiresOnDay) continue;

    if (foreshadow.isFalseAlarm) {
      // False alarm: dismiss silently, event doesn't fire
      foreshadow.dismissed = true;
      continue;
    }

    // Real mature foreshadow — fire if we haven't already selected one
    if (!foreshadowedFire) {
      const storylet = allStorylets.find(s => s.id === foreshadow.storyletId);
      if (storylet && !isOnCooldown(storylet, state) && !hasExceededMaxOccurrences(storylet, state)) {
        foreshadowedFire = storylet;
        foreshadow.dismissed = true; // Only dismiss the one we're firing
      } else {
        // Storylet blocked by cooldown/maxOccurrences — dismiss the stale foreshadow
        foreshadow.dismissed = true;
      }
    }
    // If foreshadowedFire is already set, leave other mature foreshadows
    // undismissed — they'll fire on subsequent ticks
  }

  // If a foreshadowed event matured, it fires immediately (guaranteed).
  // Still run Phase 2 for new foreshadow creation, but skip event selection.
  if (foreshadowedFire) {
    // Phase 2 (foreshadow creation only): check for new foreshadows
    for (const storylet of allStorylets) {
      if (storylet.id === foreshadowedFire.id) continue;
      if (!storylet.foreshadowing) continue;
      if (isOnCooldown(storylet, state)) continue;
      if (hasExceededMaxOccurrences(storylet, state)) continue;

      const hasForeshadow = state.pendingForeshadows.some(
        f => f.storyletId === storylet.id &&
          (!f.dismissed || f.eventFiresOnDay === state.calendar.totalDay),
      );
      if (hasForeshadow) continue;

      if (evaluateAllConditions(storylet, state, rng)) {
        const isReliable = rng.next() < storylet.foreshadowing.reliability;
        newForeshadows.push({
          storyletId: storylet.id,
          signal: storylet.foreshadowing.signal,
          appearsOnDay: state.calendar.totalDay,
          eventFiresOnDay: state.calendar.totalDay + storylet.foreshadowing.daysBeforeEvent,
          isFalseAlarm: !isReliable,
          advisorSource: storylet.foreshadowing.advisorSource,
          dismissed: false,
        });
      }
    }

    return { fireEvent: foreshadowedFire, newForeshadows };
  }

  // Phase 2: Evaluate storylets without active foreshadows.
  const eligible: Storylet[] = [];

  for (const storylet of allStorylets) {
    if (isOnCooldown(storylet, state)) continue;
    if (hasExceededMaxOccurrences(storylet, state)) continue;

    // Skip if there's an active (undismissed) foreshadow for this storylet — it's pending.
    // Also skip if a foreshadow was dismissed THIS tick (prevents false-alarm churn:
    // a false alarm dismissed in Phase 1 would otherwise be re-created immediately).
    const hasForeshadow = state.pendingForeshadows.some(
      f => f.storyletId === storylet.id &&
        (!f.dismissed || f.eventFiresOnDay === state.calendar.totalDay),
    );
    if (hasForeshadow) continue;

    // Evaluate preconditions (RNG consumed deterministically)
    if (evaluateAllConditions(storylet, state, rng)) {
      if (storylet.foreshadowing) {
        // Storylet has foreshadowing: create foreshadow, don't fire yet
        const isReliable = rng.next() < storylet.foreshadowing.reliability;
        newForeshadows.push({
          storyletId: storylet.id,
          signal: storylet.foreshadowing.signal,
          appearsOnDay: state.calendar.totalDay,
          eventFiresOnDay: state.calendar.totalDay + storylet.foreshadowing.daysBeforeEvent,
          isFalseAlarm: !isReliable,
          advisorSource: storylet.foreshadowing.advisorSource,
          dismissed: false,
        });
      } else {
        // No foreshadowing: eligible to fire immediately
        eligible.push(storylet);
      }
    }
  }

  if (eligible.length === 0) {
    return { fireEvent: null, newForeshadows };
  }

  // Select event: priority >= 100 is guaranteed (first one wins by array order)
  const guaranteed = eligible.find(s => s.priority >= 100);
  if (guaranteed) {
    return { fireEvent: guaranteed, newForeshadows };
  }

  // Weighted random by priority
  const totalWeight = eligible.reduce((sum, s) => sum + s.priority, 0);
  if (totalWeight <= 0) {
    return { fireEvent: null, newForeshadows };
  }

  let roll = rng.next() * totalWeight;
  for (const storylet of eligible) {
    roll -= storylet.priority;
    if (roll <= 0) {
      return { fireEvent: storylet, newForeshadows };
    }
  }

  // Fallback (should not happen, but deterministic)
  return { fireEvent: eligible[eligible.length - 1], newForeshadows };
}
