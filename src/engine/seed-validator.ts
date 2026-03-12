/**
 * Seed Validator — Pre-validates seeds against an "experience contract"
 * to ensure every student run has meaningful climate pressure and event pacing.
 *
 * Runs headless 30-year simulations with two representative strategies:
 * - "diversified": almonds + corn + cover crops (engaged, experimenting student)
 * - "corn-only": corn only + cover crops (straightforward single-crop student)
 *
 * A seed passes only if BOTH strategies produce an acceptable event experience.
 *
 * Pure engine code — no UI dependencies.
 */

import type {
  GameState, Command, AutoPauseEvent, ClimateScenario, Cell,
} from './types.ts';
import { GRID_ROWS, GRID_COLS } from './types.ts';
import {
  createInitialState, processCommand, simulateTick,
  dismissAutoPause, resetYearlyTracking, executeBulkPlant,
  executeWater,
} from './game.ts';
import { totalDayToCalendar } from './calendar.ts';
import { getCropDefinition } from '../data/crops.ts';
import { SCENARIOS } from '../data/scenarios.ts';
import { STORYLETS } from '../data/events.ts';

// ============================================================================
// Types
// ============================================================================

export interface SeedValidationResult {
  seed: number;
  scenarioId: string;
  passed: boolean;
  climateEventCount: number;
  maxConsecutiveEmptySeasons: number;
  distinctSeasonalEventIds: number;
  survivedToYear: number;
  strategy: string;
}

// ============================================================================
// Experience Contract Thresholds
//
// All pacing metrics are based on SEASONAL-DRAW events (those with a `random`
// precondition). Condition-only advisors/tech-unlocks fire deterministically
// and don't reflect seed quality — including them masks flat RNG sequences.
// ============================================================================

/** Minimum climate-family seasonal events across 30 years */
const MIN_CLIMATE_EVENTS = 2;

/** Maximum consecutive seasons with zero seasonal-draw events firing.
 *  Current content creates structural gaps of ~10 seasons between event windows.
 *  20 seasons (5 years) rejects seeds where the seasonal system goes truly silent. */
const MAX_EMPTY_SEASON_RUN = 20;

/** Minimum year the game must survive to (no bankruptcy before this) */
const MIN_SURVIVAL_YEAR = 10;

/** Minimum distinct seasonal-draw storylet IDs that fire across 30 years */
const MIN_DISTINCT_SEASONAL_EVENTS = 4;

// ============================================================================
// Strategy Bots (simplified, validator-only)
// ============================================================================

interface ValidatorBot {
  name: string;
  handleAutoPause(state: GameState, pause: AutoPauseEvent, scenario: ClimateScenario): Command[];
  onTick(state: GameState, scenario: ClimateScenario): Command[];
}

function createDiversifiedBot(): ValidatorBot {
  let almondPlanted = false;

  return {
    name: 'diversified',

    handleAutoPause(state: GameState, pause: AutoPauseEvent, _scenario: ClimateScenario): Command[] {
      switch (pause.reason) {
        case 'harvest_ready':
          return [{ type: 'HARVEST_BULK', scope: 'all' }];
        case 'water_stress':
          return [{ type: 'WATER', scope: 'all' }];
        case 'loan_offer':
          return [{ type: 'TAKE_LOAN' }];
        case 'event':
        case 'advisor':
          if (state.activeEvent && state.activeEvent.choices.length > 0) {
            return [{
              type: 'RESPOND_EVENT',
              eventId: state.activeEvent.storyletId,
              choiceId: state.activeEvent.choices[0].id,
            }];
          }
          return [];
        default:
          return [];
      }
    },

    onTick(state: GameState, _scenario: ClimateScenario): Command[] {
      const { month, year } = state.calendar;
      const cmds: Command[] = [];

      // Year 1 Spring: plant almonds on rows 0-3, corn on rows 4-7
      if (!almondPlanted && month >= 3 && month <= 3 && year === 1) {
        for (let r = 0; r < 4; r++) {
          cmds.push({ type: 'PLANT_BULK', scope: 'row', index: r, cropId: 'almonds' });
        }
        for (let r = 4; r < 8; r++) {
          cmds.push({ type: 'PLANT_BULK', scope: 'row', index: r, cropId: 'silage-corn' });
        }
        almondPlanted = true;
      }

      // Subsequent springs: replant corn on empty rows (annual rows)
      if (year >= 2 && month === 3) {
        for (let r = 4; r < 8; r++) {
          if (state.grid[r].some(c => !c.crop)) {
            cmds.push({ type: 'PLANT_BULK', scope: 'row', index: r, cropId: 'silage-corn' });
          }
        }
      }

      // Fall: cover crops on empty cells (Y2+)
      if (month === 10 && year >= 2) {
        for (let r = 0; r < 8; r++) {
          if (state.grid[r].some(c => !c.crop && c.coverCropId === null)) {
            cmds.push({ type: 'SET_COVER_CROP_BULK', scope: 'row', index: r, coverCropId: 'legume-cover' });
          }
        }
      }

      return cmds;
    },
  };
}

function createCornOnlyBot(): ValidatorBot {
  return {
    name: 'corn-only',

    handleAutoPause(state: GameState, pause: AutoPauseEvent, _scenario: ClimateScenario): Command[] {
      switch (pause.reason) {
        case 'harvest_ready':
          return [{ type: 'HARVEST_BULK', scope: 'all' }];
        case 'water_stress':
          return [{ type: 'WATER', scope: 'all' }];
        case 'loan_offer':
          return [{ type: 'TAKE_LOAN' }];
        case 'event':
        case 'advisor':
          if (state.activeEvent && state.activeEvent.choices.length > 0) {
            return [{
              type: 'RESPOND_EVENT',
              eventId: state.activeEvent.storyletId,
              choiceId: state.activeEvent.choices[0].id,
            }];
          }
          return [];
        default:
          return [];
      }
    },

    onTick(state: GameState, _scenario: ClimateScenario): Command[] {
      const { month, year } = state.calendar;
      const cmds: Command[] = [];

      // Spring: plant corn on all empty cells
      if (month >= 3 && month <= 5) {
        if (state.economy.cash >= 3000) {
          const hasEmpties = state.grid.some(row => row.some(c => !c.crop));
          if (hasEmpties) {
            cmds.push({ type: 'PLANT_BULK', scope: 'all', cropId: 'silage-corn' });
          }
        }
      }

      // Fall: cover crops on empty cells (Y2+)
      if (month === 10 && year >= 2) {
        for (let r = 0; r < 8; r++) {
          if (state.grid[r].some(c => !c.crop && c.coverCropId === null)) {
            cmds.push({ type: 'SET_COVER_CROP_BULK', scope: 'row', index: r, coverCropId: 'legume-cover' });
          }
        }
      }

      return cmds;
    },
  };
}

// ============================================================================
// Simulation Runner (mirrors bot-runner.ts pattern)
// ============================================================================

/**
 * Execute a command, automatically accepting partial offers.
 * Mirrors bot-runner.ts executeCommandWithPartialOffers().
 */
function executeCommand(state: GameState, cmd: Command, scenario: ClimateScenario): void {
  const result = processCommand(state, cmd, scenario);

  if (result.partialOffer && cmd.type === 'PLANT_BULK' && cmd.scope === 'all') {
    const offer = result.partialOffer;
    const cropDef = getCropDefinition(cmd.cropId);
    const cells: Cell[] = [];
    let rowsCollected = 0;
    for (let r = 0; r < GRID_ROWS && rowsCollected < offer.affordableRows; r++) {
      const rowEmpty = state.grid[r].filter(c => c.crop === null);
      if (rowEmpty.length === GRID_COLS) {
        cells.push(...rowEmpty);
        rowsCollected++;
      }
    }
    if (cells.length > 0) {
      executeBulkPlant(state, cells, cmd.cropId, cropDef.seedCostPerAcre);
    }
  }

  if (result.partialOffer && cmd.type === 'WATER' && cmd.scope === 'all') {
    const offer = result.partialOffer;
    const cells: Cell[] = [];
    let rowsCollected = 0;
    for (let r = 0; r < GRID_ROWS && rowsCollected < offer.affordableRows; r++) {
      const rowPlanted = state.grid[r].filter(c => c.crop !== null);
      if (rowPlanted.length > 0) {
        cells.push(...rowPlanted);
        rowsCollected++;
      }
    }
    if (cells.length > 0) {
      executeWater(state, cells, scenario);
    }
  }
}

/** Set of storylet IDs that participate in seasonal draw (have random precondition) */
const SEASONAL_DRAW_IDS = new Set(
  STORYLETS.filter(s => s.preconditions.some(c => c.type === 'random')).map(s => s.id),
);

/** Set of climate-family storylet IDs */
const CLIMATE_STORYLET_IDS = new Set(
  STORYLETS.filter(s => s.type === 'climate').map(s => s.id),
);

const SEASON_ORDER: Record<string, number> = { spring: 0, summer: 1, fall: 2, winter: 3 };

/**
 * Run a headless 30-year simulation with a given strategy, tracking events.
 */
function runSimulation(
  scenarioId: string,
  seed: number,
  bot: ValidatorBot,
): SeedValidationResult {
  const baseScenario = SCENARIOS[scenarioId];
  if (!baseScenario) {
    throw new Error(`Unknown scenario: ${scenarioId}`);
  }
  const scenario: ClimateScenario = { ...baseScenario, seed };
  const state = createInitialState('validator-' + bot.name, scenario);

  // Main simulation loop (mirrors bot-runner.ts)
  for (;;) {
    // Handle auto-pauses
    while (state.autoPauseQueue.length > 0) {
      const pause = state.autoPauseQueue[0];

      if (pause.reason !== 'year_end' && pause.reason !== 'bankruptcy' && pause.reason !== 'year_30') {
        const cmds = bot.handleAutoPause(state, pause, scenario);
        for (const cmd of cmds) {
          executeCommand(state, cmd, scenario);
        }
      }

      dismissAutoPause(state);

      if (state.yearEndSummaryPending && state.autoPauseQueue.length === 0) {
        resetYearlyTracking(state);
      }
    }

    if (state.gameOver) break;

    // Bot proactive actions
    const cmds = bot.onTick(state, scenario);
    for (const cmd of cmds) {
      executeCommand(state, cmd, scenario);
    }

    // Advance one day
    state.speed = 1;
    simulateTick(state, scenario);
  }

  // ---- Post-hoc analysis of eventLog (seasonal-draw events only) ----

  const firedSeasonalIds = new Set<string>();
  let climateEventCount = 0;

  // Track which seasons had at least one seasonal-draw event
  const seasonsWithDrawEvent = new Set<number>();

  for (const occ of state.eventLog) {
    if (CLIMATE_STORYLET_IDS.has(occ.storyletId)) {
      climateEventCount++;
    }
    if (SEASONAL_DRAW_IDS.has(occ.storyletId)) {
      firedSeasonalIds.add(occ.storyletId);
      const cal = totalDayToCalendar(occ.day);
      seasonsWithDrawEvent.add((cal.year - 1) * 4 + SEASON_ORDER[cal.season]);
    }
  }

  // Compute max consecutive seasons without any seasonal-draw event.
  // Skip season 0 (Spring Y1) — no seasonal draw during onboarding.
  const totalSeasons = state.calendar.year * 4;
  let maxConsecutiveEmpty = 0;
  let currentEmptyRun = 0;

  for (let i = 1; i < totalSeasons; i++) {
    if (seasonsWithDrawEvent.has(i)) {
      currentEmptyRun = 0;
    } else {
      currentEmptyRun++;
      if (currentEmptyRun > maxConsecutiveEmpty) {
        maxConsecutiveEmpty = currentEmptyRun;
      }
    }
  }

  const passed =
    climateEventCount >= MIN_CLIMATE_EVENTS &&
    maxConsecutiveEmpty <= MAX_EMPTY_SEASON_RUN &&
    state.calendar.year >= MIN_SURVIVAL_YEAR &&
    firedSeasonalIds.size >= MIN_DISTINCT_SEASONAL_EVENTS;

  return {
    seed,
    scenarioId,
    passed,
    climateEventCount,
    maxConsecutiveEmptySeasons: maxConsecutiveEmpty,
    distinctSeasonalEventIds: firedSeasonalIds.size,
    survivedToYear: state.calendar.year,
    strategy: bot.name,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Validate a single seed with a single strategy.
 */
export function validateSeed(
  scenarioId: string,
  seed: number,
  strategy: 'diversified' | 'corn-only',
): SeedValidationResult {
  const bot = strategy === 'diversified' ? createDiversifiedBot() : createCornOnlyBot();
  return runSimulation(scenarioId, seed, bot);
}

/**
 * Validate a seed against both strategies.
 * Returns true only if both produce an acceptable experience.
 */
export function isSeedApproved(scenarioId: string, seed: number): boolean {
  const diversifiedResult = validateSeed(scenarioId, seed, 'diversified');
  if (!diversifiedResult.passed) return false;

  const cornResult = validateSeed(scenarioId, seed, 'corn-only');
  return cornResult.passed;
}
