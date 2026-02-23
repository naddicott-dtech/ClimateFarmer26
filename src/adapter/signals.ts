import { signal, computed, batch } from '@preact/signals';
import type { GameState, Command, CommandResult, Cell, DailyWeather } from '../engine/types.ts';
import { GRID_ROWS } from '../engine/types.ts';
import { createInitialState, processCommand, simulateTick, dismissAutoPause, resetYearlyTracking, addNotification, dismissNotification, getAvailableCrops, executeBulkPlant, executeWater } from '../engine/game.ts';
import { getCropDefinition } from '../data/crops.ts';
import { SLICE_1_SCENARIO } from '../data/scenario.ts';
import { autoSave, loadAutoSave, hasSaveData, saveGame, isTutorialDismissed, setTutorialDismissed } from '../save/storage.ts';
import { isSeasonChange } from '../engine/calendar.ts';

// ============================================================================
// Core State Signals
// ============================================================================

/**
 * The authoritative mutable game state. Engine functions mutate this directly.
 * The gameState signal holds a snapshot for UI reactivity.
 */
let _liveState: GameState | null = null;

/** Snapshot of game state for reactive UI. Updated via publishState(). */
export const gameState = signal<GameState | null>(null);

/** Current screen */
export const screen = signal<'new-game' | 'playing' | 'game-over'>('new-game');

/** Currently selected cell coordinates */
export const selectedCell = signal<{ row: number; col: number } | null>(null);

/** Whether the crop menu is open */
export const cropMenuOpen = signal(false);

/** Pending confirmation dialog */
export const confirmDialog = signal<ConfirmDialogState | null>(null);

/** Tutorial step: -1 = dismissed, 0-2 = active steps */
export const tutorialStep = signal<number>(isTutorialDismissed() ? -1 : 0);

/** Current weather for display */
export const currentWeather = signal<DailyWeather | null>(null);

/** Save error message */
export const saveError = signal<string | null>(null);

// ============================================================================
// State Publishing
// ============================================================================

/** Publish live state to the reactive signal (creates a deep clone for reactivity). */
function publishState(): void {
  if (_liveState) {
    gameState.value = structuredClone(_liveState);
  } else {
    gameState.value = null;
  }
}

// ============================================================================
// Computed Signals
// ============================================================================

export const currentDay = computed(() => gameState.value?.calendar.totalDay ?? 0);
export const currentCash = computed(() => gameState.value?.economy.cash ?? 0);
export const currentSpeed = computed(() => gameState.value?.speed ?? 0);
export const isPaused = computed(() => (gameState.value?.speed ?? 0) === 0);
export const isGameOver = computed(() => gameState.value?.gameOver ?? false);
export const autoPauseQueue = computed(() => gameState.value?.autoPauseQueue ?? []);
export const hasAutoPause = computed(() => (gameState.value?.autoPauseQueue.length ?? 0) > 0);
export const notifications = computed(() => gameState.value?.notifications ?? []);
export const yearEndSummaryPending = computed(() => gameState.value?.yearEndSummaryPending ?? false);

export const selectedCellData = computed<Cell | null>(() => {
  const state = gameState.value;
  const sel = selectedCell.value;
  if (!state || !sel) return null;
  return state.grid[sel.row]?.[sel.col] ?? null;
});

export const availableCrops = computed(() => {
  const state = gameState.value;
  if (!state) return [] as string[];
  return getAvailableCrops(state);
});

export const grid = computed(() => gameState.value?.grid ?? []);

// ============================================================================
// Types
// ============================================================================

export interface ConfirmDialogState {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// ============================================================================
// Game Lifecycle
// ============================================================================

export function startNewGame(playerId: string): void {
  const trimmed = playerId.trim().slice(0, 30);
  if (!trimmed) return;

  _liveState = createInitialState(trimmed, SLICE_1_SCENARIO);
  batch(() => {
    publishState();
    screen.value = 'playing';
    selectedCell.value = null;
    cropMenuOpen.value = false;
    confirmDialog.value = null;
    currentWeather.value = null;
    saveError.value = null;
    tutorialStep.value = isTutorialDismissed() ? -1 : 0;
  });
}

export function resumeGame(): void {
  const state = loadAutoSave();
  if (!state) return;

  _liveState = state;
  batch(() => {
    publishState();
    screen.value = 'playing';
    selectedCell.value = null;
    cropMenuOpen.value = false;
    confirmDialog.value = null;
    saveError.value = null;
    tutorialStep.value = -1;
  });
}

export function canResume(): boolean {
  return hasSaveData();
}

export function returnToTitle(): void {
  stopGameLoop();
  _liveState = null;
  batch(() => {
    publishState();
    screen.value = 'new-game';
    selectedCell.value = null;
    cropMenuOpen.value = false;
    confirmDialog.value = null;
    currentWeather.value = null;
  });
}

// ============================================================================
// Command Dispatch
// ============================================================================

export function dispatch(command: Command): CommandResult {
  if (!_liveState) return { success: false, reason: 'No active game.' };

  const result = processCommand(_liveState, command, SLICE_1_SCENARIO);
  publishState();
  return result;
}

// ============================================================================
// Cell Selection
// ============================================================================

export function selectCell(row: number, col: number): void {
  const current = selectedCell.value;
  if (current && current.row === row && current.col === col) {
    batch(() => {
      selectedCell.value = null;
      cropMenuOpen.value = false;
    });
  } else {
    batch(() => {
      selectedCell.value = { row, col };
      cropMenuOpen.value = false;
    });
  }
}

export function deselectCell(): void {
  batch(() => {
    selectedCell.value = null;
    cropMenuOpen.value = false;
  });
}

// ============================================================================
// Crop Menu
// ============================================================================

export function openCropMenu(): void {
  cropMenuOpen.value = true;
}

export function closeCropMenu(): void {
  cropMenuOpen.value = false;
}

export function plantCrop(cropId: string): void {
  const sel = selectedCell.value;
  if (!sel) return;

  const result = dispatch({ type: 'PLANT_CROP', cellRow: sel.row, cellCol: sel.col, cropId });
  if (result.success) {
    cropMenuOpen.value = false;
  }
}

// ============================================================================
// Bulk Operations
// ============================================================================

export function plantBulk(scope: 'all' | 'row' | 'col', cropId: string, index?: number): void {
  if (!_liveState) return;

  const result = processCommand(_liveState, { type: 'PLANT_BULK', scope, cropId, index }, SLICE_1_SCENARIO);

  if (result.success) {
    publishState();
    return;
  }

  if (result.partialOffer) {
    const offer = result.partialOffer;
    confirmDialog.value = {
      message: `You can afford to plant ${offer.affordableRows} full row${offer.affordableRows > 1 ? 's' : ''} (${offer.affordablePlots} plots) for $${offer.totalCost.toLocaleString()}. Plant ${offer.affordableRows} row${offer.affordableRows > 1 ? 's' : ''}?`,
      onConfirm: () => {
        if (!_liveState) return;
        const emptyCells: Cell[] = [];
        let rowsCollected = 0;
        for (let r = 0; r < GRID_ROWS && rowsCollected < offer.affordableRows; r++) {
          const rowEmpty = _liveState.grid[r].filter(c => c.crop === null);
          if (rowEmpty.length > 0) {
            emptyCells.push(...rowEmpty);
            rowsCollected++;
          }
        }

        const cropDef = getCropDefinition(cropId);
        executeBulkPlant(_liveState, emptyCells, cropId, cropDef.seedCostPerAcre);
        confirmDialog.value = null;
        publishState();
      },
      onCancel: () => {
        confirmDialog.value = null;
      },
    };
    return;
  }

  publishState();
}

export function harvestBulk(scope: 'all' | 'row' | 'col', index?: number): void {
  dispatch({ type: 'HARVEST_BULK', scope, index });
}

export function waterBulk(scope: 'all' | 'row' | 'col', index?: number): void {
  if (!_liveState) return;

  const result = processCommand(_liveState, { type: 'WATER', scope, index }, SLICE_1_SCENARIO);

  if (result.success) {
    publishState();
    return;
  }

  if (result.partialOffer) {
    const offer = result.partialOffer;
    confirmDialog.value = {
      message: `You can afford to water ${offer.affordableRows} row${offer.affordableRows > 1 ? 's' : ''} (${offer.affordablePlots} plots) for $${offer.totalCost.toLocaleString()}. Water ${offer.affordableRows} row${offer.affordableRows > 1 ? 's' : ''}?`,
      onConfirm: () => {
        if (!_liveState) return;
        const plantedCells: Cell[] = [];
        let rowsCollected = 0;
        for (let r = 0; r < GRID_ROWS && rowsCollected < offer.affordableRows; r++) {
          const rowPlanted = _liveState.grid[r].filter(c => c.crop !== null);
          if (rowPlanted.length > 0) {
            plantedCells.push(...rowPlanted);
            rowsCollected++;
          }
        }

        executeWater(_liveState, plantedCells);
        confirmDialog.value = null;
        publishState();
      },
      onCancel: () => {
        confirmDialog.value = null;
      },
    };
    return;
  }

  publishState();
}

// ============================================================================
// Auto-Pause
// ============================================================================

export function handleDismissAutoPause(): void {
  if (!_liveState) return;

  dismissAutoPause(_liveState);

  if (_liveState.yearEndSummaryPending && _liveState.autoPauseQueue.length === 0) {
    resetYearlyTracking(_liveState);
  }

  if (_liveState.gameOver && _liveState.autoPauseQueue.length === 0) {
    screen.value = 'game-over';
  }

  publishState();
}

// ============================================================================
// Notifications
// ============================================================================

export function handleDismissNotification(id: number): void {
  if (!_liveState) return;
  dismissNotification(_liveState, id);
  publishState();
}

// ============================================================================
// Tutorial
// ============================================================================

export function advanceTutorial(): void {
  const step = tutorialStep.value;
  if (step >= 2) {
    tutorialStep.value = -1;
  } else {
    tutorialStep.value = step + 1;
  }
}

export function skipTutorial(): void {
  tutorialStep.value = -1;
}

export function dismissTutorialPermanently(dismiss: boolean): void {
  setTutorialDismissed(dismiss);
  if (dismiss) {
    tutorialStep.value = -1;
  }
}

// ============================================================================
// Save
// ============================================================================

export function handleSave(slotName?: string): void {
  if (!_liveState) return;

  const result = slotName ? saveGame(_liveState, slotName) : autoSave(_liveState);
  if (!result.success) {
    saveError.value = result.error ?? 'Failed to save game.';
  } else {
    saveError.value = null;
    addNotification(_liveState, 'info', 'Game saved.');
    publishState();
  }
}

// ============================================================================
// Game Loop
// ============================================================================

let loopHandle: number | null = null;
let lastFrameTime = 0;
let tickAccumulator = 0;
let lastSeasonAutoSaveDay = -1;

const BASE_TICKS_PER_SECOND = 12;

export function startGameLoop(): void {
  if (loopHandle !== null) return;
  lastFrameTime = performance.now();
  tickAccumulator = 0;
  loopHandle = requestAnimationFrame(gameLoop);
}

export function stopGameLoop(): void {
  if (loopHandle !== null) {
    cancelAnimationFrame(loopHandle);
    loopHandle = null;
  }
}

function gameLoop(now: number): void {
  if (!_liveState || screen.value !== 'playing') {
    loopHandle = requestAnimationFrame(gameLoop);
    return;
  }

  const speed = _liveState.speed;

  if (speed > 0 && _liveState.autoPauseQueue.length === 0 && !_liveState.gameOver) {
    const dt = Math.min(now - lastFrameTime, 100);
    const ticksPerSecond = BASE_TICKS_PER_SECOND * speed;
    tickAccumulator += (dt / 1000) * ticksPerSecond;

    const maxTicksPerFrame = Math.ceil(ticksPerSecond / 30);
    let ticksThisFrame = 0;
    let lastWeather: DailyWeather | null = null;

    while (tickAccumulator >= 1 && ticksThisFrame < maxTicksPerFrame) {
      const prevDay = _liveState.calendar.totalDay;

      const weather = simulateTick(_liveState, SLICE_1_SCENARIO);
      if (weather) lastWeather = weather;
      ticksThisFrame++;
      tickAccumulator--;

      // Auto-save on season change
      if (isSeasonChange(prevDay, _liveState.calendar.totalDay) && _liveState.calendar.totalDay !== lastSeasonAutoSaveDay) {
        lastSeasonAutoSaveDay = _liveState.calendar.totalDay;
        autoSave(_liveState);
      }

      if (_liveState.autoPauseQueue.length > 0 || _liveState.gameOver) {
        tickAccumulator = 0;
        break;
      }
    }

    if (ticksThisFrame > 0) {
      if (lastWeather) currentWeather.value = lastWeather;
      publishState();
    }
  }

  lastFrameTime = now;
  loopHandle = requestAnimationFrame(gameLoop);
}
