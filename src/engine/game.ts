import type {
  GameState, Cell, SoilState, CropInstance, Command, CommandResult,
  GameSpeed, DailyWeather, GrowthStage, Notification,
  ClimateScenario,
} from './types.ts';
import {
  GRID_ROWS, GRID_COLS, STARTING_CASH, STARTING_NITROGEN,
  STARTING_ORGANIC_MATTER, STARTING_MOISTURE, BASE_MOISTURE_CAPACITY,
  OM_MOISTURE_BONUS_PER_PERCENT, OVERRIPE_GRACE_DAYS, DAYS_PER_YEAR,
  MAX_YEARS, WATER_STRESS_AUTOPAUSE_THRESHOLD, IRRIGATION_COST_PER_CELL,
  WATER_DOSE_INCHES, STARTING_DAY, AUTO_PAUSE_PRIORITY,
  EVENT_RNG_SEED_OFFSET, LOAN_INTEREST_RATE, LOAN_REPAYMENT_FRACTION,
  LOAN_DEBT_CAP, DORMANCY_DAYS,
} from './types.ts';
import { evaluateEvents } from './events/selector.ts';
import { applyEffects, expireActiveEffects, getYieldModifier, getPriceModifier, getIrrigationCostMultiplier } from './events/effects.ts';
import { STORYLETS } from '../data/events.ts';
import { totalDayToCalendar, isYearEnd, isSeasonChange, isInPlantingWindow, getSeasonName, getMonthName } from './calendar.ts';
import { generateDailyWeather, updateExtremeEvents } from './weather.ts';
import { getCropDefinition, getAllCropIds } from '../data/crops.ts';
import { SeededRNG } from './rng.ts';

// ============================================================================
// Game State Creation
// ============================================================================

export function createInitialState(playerId: string, scenario: ClimateScenario): GameState {
  const grid: Cell[][] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    const rowCells: Cell[] = [];
    for (let col = 0; col < GRID_COLS; col++) {
      rowCells.push({
        row,
        col,
        crop: null,
        soil: createInitialSoil(),
      });
    }
    grid.push(rowCells);
  }

  // Advance RNG through the skipped days (Jan-Feb) to maintain determinism.
  // Both generateDailyWeather AND updateExtremeEvents consume RNG values,
  // so we must call both — exactly as simulateTick does — to keep the
  // RNG sequence identical to what a from-day-0 simulation would produce.
  const rng = new SeededRNG(scenario.seed);
  const warmup = { activeHeatwaveDays: 0, activeFrostDays: 0 };
  for (let d = 0; d < STARTING_DAY; d++) {
    const w = generateDailyWeather(scenario, d, rng);
    updateExtremeEvents(warmup, w, scenario, d, rng);
  }

  // Initialize event RNG (separate stream, seeded from mainSeed + offset).
  // No warmup needed: event evaluation starts at STARTING_DAY, and the event
  // RNG is never consumed before then (unlike weather RNG which generates
  // Jan-Feb weather during warmup).
  const eventRng = new SeededRNG(scenario.seed + EVENT_RNG_SEED_OFFSET);

  return {
    calendar: totalDayToCalendar(STARTING_DAY),
    speed: 0,
    grid,
    economy: {
      cash: STARTING_CASH,
      yearlyRevenue: 0,
      yearlyExpenses: 0,
      debt: 0,
      totalLoansReceived: 0,
      interestPaidThisYear: 0,
    },
    notifications: [],
    autoPauseQueue: [],
    playerId,
    scenarioId: scenario.id,
    rngState: rng.getState(),
    waterStressPausedThisSeason: false,
    activeHeatwaveDays: warmup.activeHeatwaveDays,
    activeFrostDays: warmup.activeFrostDays,
    nextNotificationId: 1,
    gameOver: false,
    yearEndSummaryPending: false,
    // Slice 2a: Event system
    eventLog: [],
    activeEvent: null,
    pendingForeshadows: [],
    activeEffects: [],
    cropFailureStreak: 0,
    flags: {},
    wateringRestricted: false,
    wateringRestrictionEndsDay: 0,
    irrigationCostMultiplier: 1.0,
    eventRngState: eventRng.getState(),
  };
}

function createInitialSoil(): SoilState {
  const om = STARTING_ORGANIC_MATTER;
  return {
    nitrogen: STARTING_NITROGEN,
    organicMatter: om,
    moisture: STARTING_MOISTURE,
    moistureCapacity: BASE_MOISTURE_CAPACITY + (om - 2.0) * OM_MOISTURE_BONUS_PER_PERCENT,
  };
}

// ============================================================================
// Runtime Assertions
// ============================================================================

function assertFinite(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid state: ${label} is ${value} (expected finite number)`);
  }
}

// ============================================================================
// Command Processing
// ============================================================================

export function processCommand(state: GameState, command: Command, _scenario: ClimateScenario): CommandResult {
  switch (command.type) {
    case 'SET_SPEED':
      return processSetSpeed(state, command.speed);
    case 'PLANT_CROP':
      return processPlantCrop(state, command.cellRow, command.cellCol, command.cropId);
    case 'PLANT_BULK':
      return processPlantBulk(state, command.scope, command.cropId, command.index);
    case 'HARVEST':
      return processHarvest(state, command.cellRow, command.cellCol);
    case 'HARVEST_BULK':
      return processHarvestBulk(state, command.scope, command.index);
    case 'WATER':
      return processWater(state, command.scope, command.index);
    case 'RESPOND_EVENT':
      return processRespondEvent(state, command.eventId, command.choiceId);
    case 'TAKE_LOAN':
      return processTakeLoan(state);
    case 'REMOVE_CROP':
      return processRemoveCrop(state, command.cellRow, command.cellCol);
    default: {
      const _exhaustive: never = command;
      throw new Error(`Unhandled command type: ${(_exhaustive as Command).type}`);
    }
  }
}

function processSetSpeed(state: GameState, speed: GameSpeed): CommandResult {
  state.speed = speed;
  return { success: true };
}

function processPlantCrop(state: GameState, row: number, col: number, cropId: string): CommandResult {
  const cell = getCell(state, row, col);
  if (!cell) return { success: false, reason: 'Invalid cell position.' };
  if (cell.crop) return { success: false, reason: 'This plot already has a crop.' };

  const cropDef = getCropDefinition(cropId);
  const cal = state.calendar;
  if (!isInPlantingWindow(cal.month, cropDef.plantingWindow.startMonth, cropDef.plantingWindow.endMonth)) {
    return {
      success: false,
      reason: `${cropDef.name} can only be planted ${getMonthName(cropDef.plantingWindow.startMonth)}–${getMonthName(cropDef.plantingWindow.endMonth)}.`,
    };
  }

  const cost = cropDef.seedCostPerAcre;
  if (state.economy.cash < cost) {
    return { success: false, reason: `Not enough cash. Cost: $${cost}, Available: $${Math.floor(state.economy.cash)}.` };
  }

  state.economy.cash -= cost;
  state.economy.yearlyExpenses += cost;
  cell.crop = createCropInstance(cropId, state.calendar.totalDay);

  // Reveal chill hours when first perennial is planted
  if (cropDef.type === 'perennial' && !state.flags['chillHoursRevealed']) {
    state.flags['chillHoursRevealed'] = true;
  }

  return { success: true, cost, cellsAffected: 1 };
}

function processPlantBulk(state: GameState, scope: 'all' | 'row' | 'col', cropId: string, index?: number): CommandResult {
  const cropDef = getCropDefinition(cropId);
  const cal = state.calendar;
  if (!isInPlantingWindow(cal.month, cropDef.plantingWindow.startMonth, cropDef.plantingWindow.endMonth)) {
    return {
      success: false,
      reason: `${cropDef.name} can only be planted ${getMonthName(cropDef.plantingWindow.startMonth)}–${getMonthName(cropDef.plantingWindow.endMonth)}.`,
    };
  }

  const emptyCells = getEmptyCells(state, scope, index);
  if (emptyCells.length === 0) {
    return { success: false, reason: 'No empty plots in the selected area.' };
  }

  const costPerCell = cropDef.seedCostPerAcre;

  if (scope === 'all') {
    // Plant Field: round down to complete rows
    const affordableCells = Math.floor(state.economy.cash / costPerCell);
    if (affordableCells <= 0) {
      return { success: false, reason: `Not enough cash. Cost per plot: $${costPerCell}.` };
    }

    // DD-1: Only consider fully empty rows (skip rows with any existing crops)
    const emptyByRow = groupByRow(emptyCells);
    const fullRows: Cell[][] = [];
    for (const [, cells] of emptyByRow) {
      if (cells.length === GRID_COLS) {
        fullRows.push(cells);
      }
    }

    const fullRowCells = fullRows.flat();
    const fullRowCost = fullRowCells.length * costPerCell;

    if (fullRowCells.length === 0) {
      return {
        success: false,
        reason: 'No fully empty rows available. Use "Plant Row" to fill specific rows.',
      };
    }

    if (state.economy.cash >= fullRowCost) {
      // Can afford all full rows — plant everything
      return executeBulkPlant(state, fullRowCells, cropId, costPerCell);
    }

    // Partial: figure out how many complete rows we can afford
    let rowsAffordable = 0;
    let plotsInRows = 0;
    let costForRows = 0;

    for (const rowCells of fullRows) {
      const rowCost = rowCells.length * costPerCell;
      if (costForRows + rowCost <= state.economy.cash) {
        rowsAffordable++;
        plotsInRows += rowCells.length;
        costForRows += rowCost;
      } else {
        break;
      }
    }

    if (rowsAffordable === 0) {
      return {
        success: false,
        reason: `Not enough cash to plant a full row. Cost per row: $${GRID_COLS * costPerCell}, Available: $${Math.floor(state.economy.cash)}.`,
      };
    }

    return {
      success: false,
      reason: 'partial',
      partialOffer: {
        affordableRows: rowsAffordable,
        affordablePlots: plotsInRows,
        totalCost: costForRows,
      },
    };

  } else {
    // Row/Column: all-or-nothing
    const totalCost = emptyCells.length * costPerCell;
    if (state.economy.cash < totalCost) {
      return { success: false, reason: `Not enough cash to plant this ${scope}. Cost: $${totalCost}, Available: $${Math.floor(state.economy.cash)}.` };
    }
    return executeBulkPlant(state, emptyCells, cropId, costPerCell);
  }
}

/**
 * Execute a confirmed bulk plant. Used after initial validation or after user confirms partial.
 */
export function executeBulkPlant(
  state: GameState,
  cells: Cell[],
  cropId: string,
  costPerCell: number,
): CommandResult {
  const totalCost = cells.length * costPerCell;
  state.economy.cash -= totalCost;
  state.economy.yearlyExpenses += totalCost;

  for (const cell of cells) {
    cell.crop = createCropInstance(cropId, state.calendar.totalDay);
  }

  // Reveal chill hours when first perennial is bulk-planted
  if (!state.flags['chillHoursRevealed']) {
    const def = getCropDefinition(cropId);
    if (def.type === 'perennial') {
      state.flags['chillHoursRevealed'] = true;
    }
  }

  return { success: true, cost: totalCost, cellsAffected: cells.length };
}

function processHarvest(state: GameState, row: number, col: number): CommandResult {
  const cell = getCell(state, row, col);
  if (!cell) return { success: false, reason: 'Invalid cell position.' };
  if (!cell.crop) return { success: false, reason: 'No crop to harvest.' };

  const stage = cell.crop.growthStage;
  if (stage !== 'harvestable' && stage !== 'overripe') {
    return { success: false, reason: `Crop is not ready to harvest (${stage}).` };
  }

  if (cell.crop.isPerennial && cell.crop.harvestedThisSeason) {
    return { success: false, reason: 'Already harvested this season. Trees produce one crop per year.' };
  }

  const revenue = harvestCell(state, cell);
  return { success: true, revenue, cellsAffected: 1 };
}

function processHarvestBulk(state: GameState, scope: 'all' | 'row' | 'col', index?: number): CommandResult {
  const harvestable = getHarvestableCells(state, scope, index);
  if (harvestable.length === 0) {
    return { success: false, reason: 'No crops ready to harvest.' };
  }

  let totalRevenue = 0;
  for (const cell of harvestable) {
    totalRevenue += harvestCell(state, cell);
  }

  return { success: true, revenue: totalRevenue, cellsAffected: harvestable.length };
}

function processWater(state: GameState, scope: 'all' | 'row' | 'col', index?: number): CommandResult {
  // Watering restriction check (from regulatory events)
  if (state.wateringRestricted) {
    return { success: false, reason: 'Watering is currently restricted by water allocation regulations.' };
  }

  const cells = getCellsInScope(state, scope, index).filter(c => c.crop !== null);
  if (cells.length === 0) {
    return { success: false, reason: 'No planted plots to water.' };
  }

  // Apply irrigation cost multiplier from active effects (e.g. water allocation cut)
  const costMultiplier = getIrrigationCostMultiplier(state);
  const effectiveCostPerCell = IRRIGATION_COST_PER_CELL * costMultiplier;
  const totalCost = cells.length * effectiveCostPerCell;

  if (scope === 'all') {
    // Water Field: round down to complete rows if can't afford all
    if (state.economy.cash < totalCost) {
      const affordableCells = Math.floor(state.economy.cash / effectiveCostPerCell);
      if (affordableCells <= 0) {
        return { success: false, reason: `Not enough cash to water. Cost per plot: $${effectiveCostPerCell}.` };
      }

      const plantedByRow = groupByRow(cells);
      let rowsAffordable = 0;
      let plotsInRows = 0;
      let costForRows = 0;

      for (const [, rowCells] of plantedByRow) {
        const rowCost = rowCells.length * effectiveCostPerCell;
        if (costForRows + rowCost <= state.economy.cash) {
          rowsAffordable++;
          plotsInRows += rowCells.length;
          costForRows += rowCost;
        } else {
          break;
        }
      }

      if (rowsAffordable === 0) {
        return { success: false, reason: `Not enough cash to water a full row.` };
      }

      return {
        success: false,
        reason: 'partial',
        partialOffer: {
          affordableRows: rowsAffordable,
          affordablePlots: plotsInRows,
          totalCost: costForRows,
        },
      };
    }
  } else {
    if (state.economy.cash < totalCost) {
      return { success: false, reason: `Not enough cash to water this ${scope}. Cost: $${totalCost}, Available: $${Math.floor(state.economy.cash)}.` };
    }
  }

  return executeWater(state, cells);
}

export function executeWater(state: GameState, cells: Cell[]): CommandResult {
  const costMultiplier = getIrrigationCostMultiplier(state);
  const costPerCell = IRRIGATION_COST_PER_CELL * costMultiplier;
  const totalCost = cells.length * costPerCell;
  state.economy.cash -= totalCost;
  state.economy.yearlyExpenses += totalCost;

  for (const cell of cells) {
    cell.soil.moisture = Math.min(cell.soil.moisture + WATER_DOSE_INCHES, cell.soil.moistureCapacity);
  }

  return { success: true, cost: totalCost, cellsAffected: cells.length };
}

// ============================================================================
// Event Response
// ============================================================================

function processRespondEvent(state: GameState, eventId: string, choiceId: string): CommandResult {
  if (!state.activeEvent) {
    return { success: false, reason: 'No active event to respond to.' };
  }
  if (state.activeEvent.storyletId !== eventId) {
    return { success: false, reason: 'Event ID mismatch.' };
  }

  const choice = state.activeEvent.choices.find(c => c.id === choiceId);
  if (!choice) {
    return { success: false, reason: `Invalid choice: ${choiceId}.` };
  }

  // Check if player can afford the choice
  if (choice.requiresCash !== undefined && state.economy.cash < choice.requiresCash) {
    return { success: false, reason: `Not enough cash. Requires $${choice.requiresCash}.` };
  }

  // Apply effects
  applyEffects(state, choice.effects, eventId);

  // Log the event
  state.eventLog.push({
    storyletId: eventId,
    day: state.calendar.totalDay,
    choiceId,
  });

  // Clear active event
  state.activeEvent = null;

  return { success: true };
}

// ============================================================================
// Loan System
// ============================================================================

/**
 * Compute the loan amount offered to the player.
 * Amount covers current deficit plus $5,000 buffer, rounded up to nearest $1,000.
 */
export function computeLoanAmount(cash: number): number {
  return Math.ceil((Math.abs(cash) + 5000) / 1000) * 1000;
}

function processTakeLoan(state: GameState): CommandResult {
  // TAKE_LOAN is only valid while a loan_offer auto-pause is active
  const hasLoanOffer = state.autoPauseQueue.some(e => e.reason === 'loan_offer');
  if (!hasLoanOffer) {
    return { success: false, reason: 'No loan offer is currently available.' };
  }

  if (state.economy.totalLoansReceived >= 1) {
    return { success: false, reason: 'You have already received an emergency loan.' };
  }

  const amount = computeLoanAmount(state.economy.cash);
  state.economy.cash += amount;
  state.economy.debt = amount;
  state.economy.totalLoansReceived = 1;

  addNotification(state, 'loan',
    `Emergency loan of $${amount.toLocaleString()} received. 10% annual interest. 20% of harvest revenue will go toward repayment.`);

  // Clear the game over state (loan saves the farm)
  state.gameOver = false;
  state.gameOverReason = undefined;

  return { success: true };
}

function processRemoveCrop(state: GameState, row: number, col: number): CommandResult {
  const cell = getCell(state, row, col);
  if (!cell) return { success: false, reason: 'Invalid cell position.' };
  if (!cell.crop) return { success: false, reason: 'This plot has no crop to remove.' };
  if (!cell.crop.isPerennial) {
    return { success: false, reason: 'Use harvest to clear annual crops.' };
  }

  const cropDef = getCropDefinition(cell.crop.cropId);
  const cost = cropDef.removalCost ?? 0;

  if (state.economy.cash < cost) {
    return { success: false, reason: `Not enough cash. Removal cost: $${cost}, Available: $${Math.floor(state.economy.cash)}.` };
  }

  state.economy.cash -= cost;
  state.economy.yearlyExpenses += cost;
  addNotification(state, 'info', `Removed ${cropDef.name} from row ${row + 1}, col ${col + 1}. Cost: $${cost}.`);
  cell.crop = null;

  return { success: true, cost };
}

// ============================================================================
// Simulation Tick
// ============================================================================

export function simulateTick(state: GameState, scenario: ClimateScenario): DailyWeather | null {
  if (state.gameOver) return null;
  if (state.speed === 0) return null;
  if (state.autoPauseQueue.length > 0) return null;

  const prevTotalDay = state.calendar.totalDay;
  const newTotalDay = prevTotalDay + 1;

  // Check for game completion (Year 30)
  if (newTotalDay >= MAX_YEARS * DAYS_PER_YEAR) {
    state.autoPauseQueue.push({
      reason: 'year_30',
      message: `Congratulations! You completed 30 years of farming! Final cash: $${Math.floor(state.economy.cash).toLocaleString()}.`,
    });
    state.gameOver = true;
    state.speed = 0;
    return null;
  }

  // Generate weather (base + extreme events)
  const rng = new SeededRNG(state.rngState);
  const weather = generateDailyWeather(scenario, newTotalDay, rng);
  updateExtremeEvents(state, weather, scenario, newTotalDay, rng);
  state.rngState = rng.getState();

  // Advance calendar
  state.calendar = totalDayToCalendar(newTotalDay);

  // Season change detection
  if (isSeasonChange(prevTotalDay, newTotalDay)) {
    state.waterStressPausedThisSeason = false; // Reset per-season auto-pause flag
    const seasonName = getSeasonName(state.calendar.season);
    addNotification(state, 'season_change', `${seasonName} — Year ${state.calendar.year}`);
  }

  // Expire active effects (remove where totalDay >= expiresDay)
  expireActiveEffects(state);

  // Simulate each cell
  let anyHarvestReady = false;
  let anyWaterStress = false;

  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const cell = state.grid[row][col];

      // Soil simulation (runs even without crops)
      simulateSoil(cell, weather);

      // Crop simulation
      if (cell.crop) {
        simulateCrop(cell, weather, state, scenario);

        if (cell.crop && cell.crop.growthStage === 'harvestable' &&
            !(cell.crop.isPerennial && cell.crop.harvestedThisSeason)) {
          anyHarvestReady = true;
        }

        // Water stress check
        if (cell.crop && cell.soil.moisture < cell.soil.moistureCapacity * WATER_STRESS_AUTOPAUSE_THRESHOLD) {
          anyWaterStress = true;
        }
      }
    }
  }

  // Auto-pause: harvest ready
  if (anyHarvestReady) {
    state.autoPauseQueue.push({
      reason: 'harvest_ready',
      message: 'Your crops are ready to harvest!',
    });
  }

  // Auto-pause: water stress (first per season only)
  if (anyWaterStress && !state.waterStressPausedThisSeason) {
    state.waterStressPausedThisSeason = true;
    state.autoPauseQueue.push({
      reason: 'water_stress',
      message: 'Some of your crops need water!',
    });
  }

  // Event evaluation (uses separate event RNG)
  const eventRng = new SeededRNG(state.eventRngState);
  const eventResult = evaluateEvents(state, STORYLETS, eventRng);
  state.eventRngState = eventRng.getState();

  // Process foreshadowing
  for (const foreshadow of eventResult.newForeshadows) {
    state.pendingForeshadows.push(foreshadow);
    addNotification(state, 'foreshadowing', foreshadow.signal);
  }

  // Fire selected event
  if (eventResult.fireEvent) {
    const storylet = eventResult.fireEvent;
    state.activeEvent = {
      storyletId: storylet.id,
      title: storylet.title,
      description: storylet.description,
      choices: storylet.choices,
      firedOnDay: newTotalDay,
    };
    state.autoPauseQueue.push({
      reason: storylet.type === 'advisor' ? 'advisor' : 'event',
      message: storylet.title,
    });
  }

  // Loan interest accrual (daily simple interest)
  if (state.economy.debt > 0) {
    const dailyInterest = state.economy.debt * (LOAN_INTEREST_RATE / DAYS_PER_YEAR);
    state.economy.debt += dailyInterest;
    state.economy.interestPaidThisYear += dailyInterest;

    // Debt spiral safety cap
    if (state.economy.debt > LOAN_DEBT_CAP) {
      state.gameOver = true;
      state.gameOverReason = 'debt_spiral';
      state.speed = 0;
      state.autoPauseQueue.push({
        reason: 'bankruptcy',
        message: `Your debt has exceeded $${LOAN_DEBT_CAP.toLocaleString()}. The bank has foreclosed on your farm.`,
        data: { debt: state.economy.debt },
      });
    }
  }

  // Year end check
  if (isYearEnd(newTotalDay)) {
    // Perennial year-end: age increment, establishment check, maintenance cost
    for (let row = 0; row < GRID_ROWS; row++) {
      for (let col = 0; col < GRID_COLS; col++) {
        const cell = state.grid[row][col];
        if (cell.crop && cell.crop.isPerennial) {
          cell.crop.perennialAge++;
          const def = getCropDefinition(cell.crop.cropId);
          if (!cell.crop.perennialEstablished && def.yearsToEstablish &&
              cell.crop.perennialAge >= def.yearsToEstablish) {
            cell.crop.perennialEstablished = true;
          }
          // Deduct annual maintenance
          if (def.annualMaintenanceCost) {
            state.economy.cash -= def.annualMaintenanceCost;
            state.economy.yearlyExpenses += def.annualMaintenanceCost;
          }
        }
      }
    }

    state.yearEndSummaryPending = true;
    state.autoPauseQueue.push({
      reason: 'year_end',
      message: `Year ${state.calendar.year} is complete.`,
      data: {
        year: state.calendar.year,
        revenue: state.economy.yearlyRevenue,
        expenses: state.economy.yearlyExpenses,
        netProfit: state.economy.yearlyRevenue - state.economy.yearlyExpenses,
        cash: state.economy.cash,
        debt: state.economy.debt,
        interestPaid: state.economy.interestPaidThisYear,
      },
    });
  }

  // Bankruptcy check (modified for Slice 2: loan offer on first insolvency)
  if (state.economy.cash <= 0 && !state.gameOver) {
    if (state.economy.totalLoansReceived === 0) {
      // First insolvency: offer emergency loan
      const loanAmount = computeLoanAmount(state.economy.cash);
      state.autoPauseQueue.push({
        reason: 'loan_offer',
        message: `You've run out of money. The bank is offering an emergency loan of $${loanAmount.toLocaleString()}.`,
        data: {
          loanAmount,
          interestRate: LOAN_INTEREST_RATE,
          cash: state.economy.cash,
        },
      });
      // Temporarily set gameOver (TAKE_LOAN clears it; declining = permanent)
      state.gameOver = true;
      state.gameOverReason = 'bankruptcy';
      state.speed = 0;
    } else {
      // Second insolvency: hard game over
      state.gameOver = true;
      state.gameOverReason = 'bankruptcy';
      state.speed = 0;
      state.autoPauseQueue.push({
        reason: 'bankruptcy',
        message: "You've run out of money again. With an outstanding loan, the bank can no longer help.",
        data: {
          cash: state.economy.cash,
          debt: state.economy.debt,
          yearlyRevenue: state.economy.yearlyRevenue,
          yearlyExpenses: state.economy.yearlyExpenses,
        },
      });
    }
  }

  // Sort auto-pause queue by priority (most urgent first per SPEC §3.6)
  if (state.autoPauseQueue.length > 1) {
    state.autoPauseQueue.sort(
      (a, b) => AUTO_PAUSE_PRIORITY[b.reason] - AUTO_PAUSE_PRIORITY[a.reason],
    );
  }

  // Auto-pause: stop simulation if there are pending events
  if (state.autoPauseQueue.length > 0) {
    state.speed = 0;
  }

  // Validate state (catch NaN/Infinity bugs)
  assertFinite(state.economy.cash, 'economy.cash');

  return weather;
}

// ============================================================================
// Soil Simulation
// ============================================================================

function simulateSoil(cell: Cell, weather: DailyWeather): void {
  const soil = cell.soil;

  // Evapotranspiration (water loss)
  const etLoss = cell.crop
    ? weather.et0 * getCropCoefficient(cell.crop)
    : weather.et0 * 0.3; // Bare soil still loses some moisture

  soil.moisture = Math.max(0, soil.moisture - etLoss);

  // Precipitation (water gain)
  soil.moisture = Math.min(soil.moisture + weather.precipitation, soil.moistureCapacity);

  // Organic matter decomposition (very slow: ~2%/year of current OM)
  const omDecompRate = 0.02 / DAYS_PER_YEAR;
  soil.organicMatter = Math.max(0.5, soil.organicMatter - soil.organicMatter * omDecompRate);

  // Update moisture capacity based on OM
  soil.moistureCapacity = BASE_MOISTURE_CAPACITY + (soil.organicMatter - 2.0) * OM_MOISTURE_BONUS_PER_PERCENT;

  // Nitrogen mineralization from OM (slow natural replenishment)
  const nMineralization = (soil.organicMatter / 100) * 30 / DAYS_PER_YEAR; // ~0.6 lbs/day at 2% OM
  soil.nitrogen = Math.min(soil.nitrogen + nMineralization, 200); // Cap at 200

  assertFinite(soil.moisture, 'soil.moisture');
  assertFinite(soil.nitrogen, 'soil.nitrogen');
  assertFinite(soil.organicMatter, 'soil.organicMatter');
}

// ============================================================================
// Crop Simulation
// ============================================================================

function simulateCrop(cell: Cell, weather: DailyWeather, state: GameState, scenario: ClimateScenario): void {
  const crop = cell.crop!;
  const cropDef = getCropDefinition(crop.cropId);

  // --- Perennial dormancy management ---
  if (crop.isPerennial && cropDef.dormantSeasons) {
    const shouldBeDormant = cropDef.dormantSeasons.includes(state.calendar.season);
    if (shouldBeDormant && !crop.isDormant) {
      // Enter dormancy: reset chill accumulation for this winter
      crop.isDormant = true;
      crop.chillHoursAccumulated = 0;
      // Fall through to dormant block below for first day's accumulation
    } else if (!shouldBeDormant && crop.isDormant) {
      // Spring awakening: exit dormancy, reset GDD for new growing season
      // Chill hours are PRESERVED — they represent last winter's total
      crop.isDormant = false;
      crop.gddAccumulated = 0;
      crop.waterStressDays = 0;
      crop.plantedDay = state.calendar.totalDay; // Fix #1: reset so water-stress denominator matches current season
      crop.harvestedThisSeason = false;           // Fix #2: allow one harvest per growing season
      crop.growthStage = 'seedling';
      crop.overripeDaysRemaining = -1;
    }
    if (crop.isDormant) {
      // Accumulate chill hours during dormancy (if crop requires chill)
      if (cropDef.chillHoursRequired !== undefined) {
        const yearIndex = Math.max(0, Math.min(state.calendar.year - 1, scenario.years.length - 1));
        const yearChillHours = scenario.years[yearIndex].chillHours;
        const dailyChill = yearChillHours / DORMANCY_DAYS;
        crop.chillHoursAccumulated += dailyChill;
      }
      // No GDD accumulation, no growth during dormancy. Reduced water use via kc.
      return;
    }
  }

  // Overripe countdown
  if (crop.growthStage === 'overripe') {
    crop.overripeDaysRemaining--;
    if (crop.overripeDaysRemaining <= 0) {
      if (crop.isPerennial) {
        // Perennial survives overripe — yield=0 that year, reset for next season
        crop.growthStage = 'mature';
        crop.overripeDaysRemaining = -1;
        crop.gddAccumulated = cropDef.gddToMaturity * 0.8; // reset to mature stage
        addNotification(state, 'info',
          `Your ${cropDef.name} in row ${cell.row + 1} missed the harvest window. No yield this season, but the trees survive.`);
        return;
      }
      // Annual crop rots — total loss
      addNotification(state, 'crop_rotted',
        `Your ${cropDef.name} in row ${cell.row + 1} rotted in the field. Total loss.`);
      cell.crop = null;
      return;
    }
    return; // No further growth for overripe
  }

  // Harvestable: start overripe countdown
  if (crop.growthStage === 'harvestable') {
    crop.growthStage = 'overripe';
    crop.overripeDaysRemaining = OVERRIPE_GRACE_DAYS;
    return;
  }

  // GDD accumulation
  const avgTemp = (weather.tempHigh + weather.tempLow) / 2;
  const gdd = Math.max(0, avgTemp - cropDef.gddBase);
  crop.gddAccumulated += gdd;

  // Water stress tracking
  if (cell.soil.moisture < cell.soil.moistureCapacity * 0.15) {
    crop.waterStressDays++;
  }

  // Nitrogen uptake (proportional to growth)
  const growthFraction = gdd / cropDef.gddToMaturity;
  const nUptake = cropDef.nitrogenUptake * growthFraction;
  cell.soil.nitrogen = Math.max(0, cell.soil.nitrogen - nUptake);

  // Growth stage transitions
  const progress = crop.gddAccumulated / cropDef.gddToMaturity;
  if (crop.isPerennial && !crop.perennialEstablished) {
    // During establishment: cap growth at vegetative (no fruit production)
    crop.growthStage = getGrowthStage(Math.min(progress, 0.49));
  } else {
    crop.growthStage = getGrowthStage(progress);
  }
}

function getGrowthStage(progress: number): GrowthStage {
  if (progress >= 1.0) return 'harvestable';
  if (progress >= 0.8) return 'mature';
  if (progress >= 0.5) return 'flowering';
  if (progress >= 0.2) return 'vegetative';
  return 'seedling';
}

function getCropCoefficient(crop: CropInstance): number {
  if (crop.isPerennial && crop.isDormant) return 0.2; // Reduced water use during dormancy
  const cropDef = getCropDefinition(crop.cropId);
  const entry = cropDef.cropCoefficients.find(c => c.stage === crop.growthStage);
  return entry ? entry.kc : 0.5;
}

// ============================================================================
// Harvest Calculation
// ============================================================================

function harvestCell(state: GameState, cell: Cell): number {
  const crop = cell.crop!;
  const cropDef = getCropDefinition(crop.cropId);

  // Base yield — perennials yield 0 during establishment
  let yieldAmount = cropDef.yieldPotential;
  if (crop.isPerennial && !crop.perennialEstablished) {
    yieldAmount = 0;
  }

  // Water stress factor: 1 - ky * (stressDays / totalGrowingDays)
  const totalGrowingDays = Math.max(1, state.calendar.totalDay - crop.plantedDay);
  const waterStressFraction = crop.waterStressDays / totalGrowingDays;
  const waterFactor = Math.max(0, 1 - cropDef.ky * waterStressFraction);
  yieldAmount *= waterFactor;

  // Nitrogen factor: min(1, soilN at harvest / needed)
  const nFactor = Math.min(1, (cell.soil.nitrogen + cropDef.nitrogenUptake * 0.5) / cropDef.nitrogenUptake);
  yieldAmount *= nFactor;

  // Overripe penalty (linear decay over 30-day grace period)
  if (crop.growthStage === 'overripe') {
    const overripeFactor = crop.overripeDaysRemaining / OVERRIPE_GRACE_DAYS;
    yieldAmount *= overripeFactor;
  }

  // Apply event yield modifier
  const yieldMod = getYieldModifier(state, crop.cropId);
  yieldAmount *= yieldMod;

  // Chill hour penalty for established perennials
  // Canonical formula: clamp(accumulated / required, 0, 1)
  // Skip if: chillHoursRequired is undefined (annuals), or not established (yield already 0)
  if (cropDef.chillHoursRequired !== undefined && crop.isPerennial && crop.perennialEstablished) {
    const chillFactor = cropDef.chillHoursRequired === 0
      ? 1.0
      : Math.min(1.0, Math.max(0, crop.chillHoursAccumulated / cropDef.chillHoursRequired));
    yieldAmount *= chillFactor;
    if (chillFactor < 1.0) {
      const deficit = cropDef.chillHoursRequired - crop.chillHoursAccumulated;
      const pctLoss = Math.round((1 - chillFactor) * 100);
      addNotification(state, 'info',
        `${cropDef.name}: insufficient chill hours (${Math.round(crop.chillHoursAccumulated)}/${cropDef.chillHoursRequired}). Yield reduced by ${pctLoss}% (deficit: ${Math.round(deficit)} hours).`);
    }
  }

  yieldAmount = Math.max(0, yieldAmount);

  // Apply event price modifier
  const priceMod = getPriceModifier(state, crop.cropId);
  const actualPrice = cropDef.basePrice * priceMod;

  const grossRevenue = yieldAmount * actualPrice;
  const laborCost = cropDef.laborCostPerAcre;

  // Step 1-2: Add gross revenue to cash and yearly tracking
  state.economy.cash += grossRevenue;
  state.economy.yearlyRevenue += grossRevenue;
  state.economy.yearlyExpenses += laborCost;
  state.economy.cash -= laborCost;

  // Step 3: Loan repayment — 20% of GROSS harvest revenue
  let repayment = 0;
  if (state.economy.debt > 0) {
    repayment = Math.min(grossRevenue * LOAN_REPAYMENT_FRACTION, state.economy.debt);
    state.economy.cash -= repayment;
    state.economy.debt -= repayment;
    state.economy.yearlyExpenses += repayment;
  }

  const netRevenue = grossRevenue - laborCost - repayment;

  if (repayment > 0) {
    addNotification(state, 'harvest',
      `Harvested ${cropDef.name}: ${yieldAmount.toFixed(1)} ${cropDef.yieldUnit} at $${actualPrice.toFixed(2)}/${cropDef.yieldUnit} = $${grossRevenue.toFixed(0)} (labor: $${laborCost}, loan repayment: $${repayment.toFixed(0)})`);
  } else {
    addNotification(state, 'harvest',
      `Harvested ${cropDef.name}: ${yieldAmount.toFixed(1)} ${cropDef.yieldUnit} at $${actualPrice.toFixed(2)}/${cropDef.yieldUnit} = $${grossRevenue.toFixed(0)} (labor: $${laborCost})`);
  }

  if (crop.isPerennial) {
    // Perennial: reset for next season but keep the crop
    crop.growthStage = 'mature';
    crop.gddAccumulated = cropDef.gddToMaturity * 0.8; // back to mature stage
    crop.overripeDaysRemaining = -1;
    crop.waterStressDays = 0;
    crop.plantedDay = state.calendar.totalDay; // Fix #1: reset so next season's water-stress denominator is fresh
    crop.harvestedThisSeason = true;           // Fix #2: prevent multiple harvests per season
  } else {
    // Annual: remove crop after harvest
    cell.crop = null;
  }

  assertFinite(state.economy.cash, 'economy.cash after harvest');
  return netRevenue;
}

// ============================================================================
// Year-End Reset
// ============================================================================

export function resetYearlyTracking(state: GameState): void {
  state.economy.yearlyRevenue = 0;
  state.economy.yearlyExpenses = 0;
  state.economy.interestPaidThisYear = 0;
  state.yearEndSummaryPending = false;
}

// ============================================================================
// Helpers
// ============================================================================

function createCropInstance(cropId: string, plantedDay: number): CropInstance {
  const def = getCropDefinition(cropId);
  return {
    cropId,
    plantedDay,
    gddAccumulated: 0,
    waterStressDays: 0,
    growthStage: 'seedling',
    overripeDaysRemaining: -1,
    isPerennial: def.type === 'perennial',
    perennialAge: 0,
    perennialEstablished: false,
    isDormant: false,
    harvestedThisSeason: false,
    chillHoursAccumulated: 0,
  };
}

function getCell(state: GameState, row: number, col: number): Cell | null {
  if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return null;
  return state.grid[row][col];
}

function getCellsInScope(state: GameState, scope: 'all' | 'row' | 'col', index?: number): Cell[] {
  const cells: Cell[] = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (scope === 'all' || (scope === 'row' && r === index) || (scope === 'col' && c === index)) {
        cells.push(state.grid[r][c]);
      }
    }
  }
  return cells;
}

function getEmptyCells(state: GameState, scope: 'all' | 'row' | 'col', index?: number): Cell[] {
  return getCellsInScope(state, scope, index).filter(c => c.crop === null);
}

function getHarvestableCells(state: GameState, scope: 'all' | 'row' | 'col', index?: number): Cell[] {
  return getCellsInScope(state, scope, index).filter(
    c => c.crop !== null &&
      (c.crop.growthStage === 'harvestable' || c.crop.growthStage === 'overripe') &&
      !(c.crop.isPerennial && c.crop.harvestedThisSeason),
  );
}

function groupByRow(cells: Cell[]): Map<number, Cell[]> {
  const map = new Map<number, Cell[]>();
  // Sort by row to maintain top-to-bottom fill order
  const sorted = [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
  for (const cell of sorted) {
    const existing = map.get(cell.row);
    if (existing) {
      existing.push(cell);
    } else {
      map.set(cell.row, [cell]);
    }
  }
  return map;
}

export function addNotification(state: GameState, type: Notification['type'], message: string): void {
  state.notifications.push({
    id: state.nextNotificationId++,
    type,
    message,
    day: state.calendar.totalDay,
  });
}

export function dismissNotification(state: GameState, notificationId: number): void {
  state.notifications = state.notifications.filter(n => n.id !== notificationId);
}

export function dismissAutoPause(state: GameState): void {
  const dismissed = state.autoPauseQueue.shift();

  // If dismissing an event/advisor auto-pause without responding,
  // clear the activeEvent to prevent deadlock (evaluateEvents blocks
  // while activeEvent is set).
  if (dismissed && (dismissed.reason === 'event' || dismissed.reason === 'advisor')) {
    if (state.activeEvent) {
      // Log the event as dismissed (no choice made)
      state.eventLog.push({
        storyletId: state.activeEvent.storyletId,
        day: state.calendar.totalDay,
        choiceId: '__dismissed__',
      });
      state.activeEvent = null;
    }
  }
}

/** Get available crops for the current planting window */
export function getAvailableCrops(state: GameState): string[] {
  const { month } = state.calendar;
  return getAllCropIds().filter(id => {
    const def = getCropDefinition(id);
    return isInPlantingWindow(month, def.plantingWindow.startMonth, def.plantingWindow.endMonth);
  });
}

/** Calculate yield percentage for a crop (for display during overripe period) */
export function getYieldPercentage(crop: CropInstance): number {
  if (crop.growthStage === 'overripe') {
    return Math.max(0, (crop.overripeDaysRemaining / OVERRIPE_GRACE_DAYS) * 100);
  }
  if (crop.growthStage === 'harvestable') return 100;
  return 0; // Not harvestable yet
}

/** Get growth progress as a 0–1 fraction */
export function getGrowthProgress(crop: CropInstance): number {
  const cropDef = getCropDefinition(crop.cropId);
  return Math.min(1, crop.gddAccumulated / cropDef.gddToMaturity);
}
