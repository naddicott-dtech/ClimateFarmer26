import type {
  GameState, Cell, SoilState, CropInstance, Command, CommandResult,
  GameSpeed, DailyWeather, Notification, GrowthStage,
  ClimateScenario,
} from './types.ts';
import {
  GRID_ROWS, GRID_COLS, STARTING_CASH, STARTING_NITROGEN,
  STARTING_ORGANIC_MATTER, STARTING_MOISTURE, BASE_MOISTURE_CAPACITY,
  OM_MOISTURE_BONUS_PER_PERCENT, OVERRIPE_GRACE_DAYS, DAYS_PER_YEAR,
  MAX_YEARS, WATER_STRESS_AUTOPAUSE_THRESHOLD, IRRIGATION_COST_PER_CELL,
  WATER_DOSE_INCHES, STARTING_DAY,
} from './types.ts';
import { totalDayToCalendar, isYearEnd, isSeasonChange, isInPlantingWindow, getSeasonName, getMonthName } from './calendar.ts';
import { generateDailyWeather, updateExtremeEvents } from './weather.ts';
import { getCropDefinition } from '../data/crops.ts';
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
  // The RNG state must match what it would be if we had simulated from day 0.
  const rng = new SeededRNG(scenario.seed);
  for (let d = 0; d < STARTING_DAY; d++) {
    generateDailyWeather(scenario, d, rng);
  }

  return {
    calendar: totalDayToCalendar(STARTING_DAY),
    speed: 0,
    grid,
    economy: { cash: STARTING_CASH, yearlyRevenue: 0, yearlyExpenses: 0 },
    notifications: [],
    autoPauseQueue: [],
    playerId,
    scenarioId: scenario.id,
    rngState: rng.getState(),
    waterStressPausedThisSeason: false,
    activeHeatwaveDays: 0,
    activeFrostDays: 0,
    nextNotificationId: 1,
    gameOver: false,
    yearEndSummaryPending: false,
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

    if (affordableCells < emptyCells.length) {
      // Group empty cells by row and figure out how many complete rows we can afford
      const emptyByRow = groupByRow(emptyCells);
      let rowsAffordable = 0;
      let plotsInRows = 0;
      let costForRows = 0;

      for (const [, cells] of emptyByRow) {
        const rowCost = cells.length * costPerCell;
        if (costForRows + rowCost <= state.economy.cash) {
          rowsAffordable++;
          plotsInRows += cells.length;
          costForRows += rowCost;
        } else {
          break;
        }
      }

      if (rowsAffordable === 0) {
        return {
          success: false,
          reason: `Not enough cash to plant a full row. Cost per row: $${emptyByRow.values().next().value!.length * costPerCell}, Available: $${Math.floor(state.economy.cash)}.`,
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
    }

    // Can afford all — plant everything
    return executeBulkPlant(state, emptyCells, cropId, costPerCell);

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
  const cells = getCellsInScope(state, scope, index).filter(c => c.crop !== null);
  if (cells.length === 0) {
    return { success: false, reason: 'No planted plots to water.' };
  }

  const totalCost = cells.length * IRRIGATION_COST_PER_CELL;

  if (scope === 'all') {
    // Water Field: round down to complete rows if can't afford all
    if (state.economy.cash < totalCost) {
      const affordableCells = Math.floor(state.economy.cash / IRRIGATION_COST_PER_CELL);
      if (affordableCells <= 0) {
        return { success: false, reason: `Not enough cash to water. Cost per plot: $${IRRIGATION_COST_PER_CELL}.` };
      }

      const plantedByRow = groupByRow(cells);
      let rowsAffordable = 0;
      let plotsInRows = 0;
      let costForRows = 0;

      for (const [, rowCells] of plantedByRow) {
        const rowCost = rowCells.length * IRRIGATION_COST_PER_CELL;
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
  const totalCost = cells.length * IRRIGATION_COST_PER_CELL;
  state.economy.cash -= totalCost;
  state.economy.yearlyExpenses += totalCost;

  for (const cell of cells) {
    cell.soil.moisture = Math.min(cell.soil.moisture + WATER_DOSE_INCHES, cell.soil.moistureCapacity);
  }

  return { success: true, cost: totalCost, cellsAffected: cells.length };
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
        simulateCrop(cell, weather, state);

        if (cell.crop && cell.crop.growthStage === 'harvestable' && cell.crop.overripeDaysRemaining === OVERRIPE_GRACE_DAYS) {
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

  // Year end check
  if (isYearEnd(newTotalDay)) {
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
      },
    });
  }

  // Bankruptcy check
  if (state.economy.cash <= 0) {
    state.gameOver = true;
    state.gameOverReason = 'bankruptcy';
    state.speed = 0;
    state.autoPauseQueue.push({
      reason: 'bankruptcy',
      message: "You've run out of money.",
      data: {
        cash: state.economy.cash,
        yearlyRevenue: state.economy.yearlyRevenue,
        yearlyExpenses: state.economy.yearlyExpenses,
      },
    });
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

function simulateCrop(cell: Cell, weather: DailyWeather, state: GameState): void {
  const crop = cell.crop!;
  const cropDef = getCropDefinition(crop.cropId);

  // Overripe countdown
  if (crop.growthStage === 'overripe') {
    crop.overripeDaysRemaining--;
    if (crop.overripeDaysRemaining <= 0) {
      // Crop rots — total loss
      addNotification(state, 'crop_rotted',
        `Your ${cropDef.name} in row ${cell.row + 1} rotted in the field. Total loss.`);
      cell.crop = null;
      return;
    }
    return; // No further growth for overripe
  }

  // Harvestable: start overripe countdown
  if (crop.growthStage === 'harvestable') {
    // Transition to overripe if we've been harvestable for a tick
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
  crop.growthStage = getGrowthStage(progress);
}

function getGrowthStage(progress: number): GrowthStage {
  if (progress >= 1.0) return 'harvestable';
  if (progress >= 0.8) return 'mature';
  if (progress >= 0.5) return 'flowering';
  if (progress >= 0.2) return 'vegetative';
  return 'seedling';
}

function getCropCoefficient(crop: CropInstance): number {
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

  // Base yield
  let yieldAmount = cropDef.yieldPotential;

  // Water stress factor: 1 - ky * (stressDays / totalGrowingDays)
  const totalGrowingDays = Math.max(1, state.calendar.totalDay - crop.plantedDay);
  const waterStressFraction = crop.waterStressDays / totalGrowingDays;
  const waterFactor = Math.max(0, 1 - cropDef.ky * waterStressFraction);
  yieldAmount *= waterFactor;

  // Nitrogen factor: min(1, soilN at harvest / needed)
  // We use current soil N as a proxy (it was depleted during growth)
  const nFactor = Math.min(1, (cell.soil.nitrogen + cropDef.nitrogenUptake * 0.5) / cropDef.nitrogenUptake);
  yieldAmount *= nFactor;

  // Overripe penalty (linear decay over 30-day grace period)
  if (crop.growthStage === 'overripe') {
    const overripeFactor = crop.overripeDaysRemaining / OVERRIPE_GRACE_DAYS;
    yieldAmount *= overripeFactor;
  }

  yieldAmount = Math.max(0, yieldAmount);

  const revenue = yieldAmount * cropDef.basePrice;
  const laborCost = cropDef.laborCostPerAcre;
  const netRevenue = revenue - laborCost;

  state.economy.cash += netRevenue;
  state.economy.yearlyRevenue += revenue;
  state.economy.yearlyExpenses += laborCost;

  addNotification(state, 'harvest',
    `Harvested ${cropDef.name}: ${yieldAmount.toFixed(1)} ${cropDef.yieldUnit} at $${cropDef.basePrice}/${cropDef.yieldUnit} = $${revenue.toFixed(0)} (labor: $${laborCost})`);

  cell.crop = null;

  assertFinite(state.economy.cash, 'economy.cash after harvest');
  return netRevenue;
}

// ============================================================================
// Year-End Reset
// ============================================================================

export function resetYearlyTracking(state: GameState): void {
  state.economy.yearlyRevenue = 0;
  state.economy.yearlyExpenses = 0;
  state.yearEndSummaryPending = false;
}

// ============================================================================
// Helpers
// ============================================================================

function createCropInstance(cropId: string, plantedDay: number): CropInstance {
  return {
    cropId,
    plantedDay,
    gddAccumulated: 0,
    waterStressDays: 0,
    growthStage: 'seedling',
    overripeDaysRemaining: -1,
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
    c => c.crop !== null && (c.crop.growthStage === 'harvestable' || c.crop.growthStage === 'overripe'),
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
  state.autoPauseQueue.shift();
}

/** Get available crops for the current planting window */
export function getAvailableCrops(state: GameState): string[] {
  const { month } = state.calendar;
  const allCropIds = ['processing-tomatoes', 'silage-corn', 'winter-wheat'];
  return allCropIds.filter(id => {
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
