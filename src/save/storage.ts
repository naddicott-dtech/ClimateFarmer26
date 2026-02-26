import type { GameState, SaveGame } from '../engine/types.ts';
import { SAVE_VERSION, GRID_ROWS, GRID_COLS, EVENT_RNG_SEED_OFFSET } from '../engine/types.ts';
import { SLICE_1_SCENARIO } from '../data/scenario.ts';

// ============================================================================
// Storage Keys
// ============================================================================

export const AUTOSAVE_KEY = 'climateFarmer_autosave';
const MANUAL_SAVE_PREFIX = 'climateFarmer_save_';
const TUTORIAL_DISMISSED_KEY = 'climateFarmer_tutorialDismissed';

// ============================================================================
// Save Operations
// ============================================================================

export interface SaveResult {
  success: boolean;
  error?: string;
}

export function autoSave(state: GameState): SaveResult {
  return writeSave(AUTOSAVE_KEY, state);
}

export function saveGame(state: GameState, slotName: string): SaveResult {
  return writeSave(MANUAL_SAVE_PREFIX + slotName, state);
}

function writeSave(key: string, state: GameState): SaveResult {
  const saveData: SaveGame = {
    version: SAVE_VERSION,
    state,
    timestamp: Date.now(),
  };

  try {
    localStorage.setItem(key, JSON.stringify(saveData));
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// Load Operations
// ============================================================================

export function loadAutoSave(): GameState | null {
  return readSave(AUTOSAVE_KEY);
}

export function loadGame(slotName: string): GameState | null {
  return readSave(MANUAL_SAVE_PREFIX + slotName);
}

function readSave(key: string): GameState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as SaveGame;
    if (!validateSave(parsed)) {
      // Try v3 → v4 migration
      if (isV3Save(parsed)) {
        return migrateV3ToV4(parsed);
      }
      // Try v2 → v3 → v4 chain
      if (isV2Save(parsed)) {
        const v3State = migrateV2ToV3(parsed);
        if (v3State) {
          const v3Save = { version: '3.0.0', state: v3State, timestamp: (parsed as SaveGame).timestamp ?? Date.now() } as unknown as SaveGame;
          return migrateV3ToV4(v3Save);
        }
      }
      // Try v1 → v2 → v3 → v4 chain
      if (isV1Save(parsed)) {
        const v2State = migrateV1ToV2(parsed);
        if (v2State) {
          const v2Save = { version: '2.0.0', state: v2State, timestamp: Date.now() } as unknown as SaveGame;
          const v3State = migrateV2ToV3(v2Save);
          if (v3State) {
            const v3Save = { version: '3.0.0', state: v3State, timestamp: Date.now() } as unknown as SaveGame;
            return migrateV3ToV4(v3Save);
          }
        }
      }
      return null;
    }

    return parsed.state;
  } catch {
    return null;
  }
}

// ============================================================================
// Save Management
// ============================================================================

/** Returns true only if an auto-save exists (powers the "Continue" button). */
export function hasSaveData(): boolean {
  return localStorage.getItem(AUTOSAVE_KEY) !== null;
}

/** Returns true if any named manual saves exist (powers the "Load Game" button). */
export function hasManualSaves(): boolean {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(MANUAL_SAVE_PREFIX)) return true;
  }
  return false;
}

export interface SaveSlotInfo {
  slotName: string;
  timestamp: number;
  playerId: string;
  day: number;
  year: number;
}

export function listManualSaves(): SaveSlotInfo[] {
  const saves: SaveSlotInfo[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(MANUAL_SAVE_PREFIX)) continue;

    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as SaveGame;
      const savedTimestamp = parsed.timestamp ?? Date.now();

      // Try current-version validation first, then migration for older saves
      let state: GameState | null = null;
      if (validateSave(parsed)) {
        state = parsed.state;
      } else if (isV3Save(parsed)) {
        state = migrateV3ToV4(parsed);
      } else if (isV2Save(parsed)) {
        const v3State = migrateV2ToV3(parsed);
        if (v3State) {
          const v3Save = { version: '3.0.0', state: v3State, timestamp: savedTimestamp } as unknown as SaveGame;
          state = migrateV3ToV4(v3Save);
        }
      } else if (isV1Save(parsed)) {
        const v2State = migrateV1ToV2(parsed);
        if (v2State) {
          const v2Save = { version: '2.0.0', state: v2State, timestamp: savedTimestamp } as unknown as SaveGame;
          const v3State = migrateV2ToV3(v2Save);
          if (v3State) {
            const v3Save = { version: '3.0.0', state: v3State, timestamp: savedTimestamp } as unknown as SaveGame;
            state = migrateV3ToV4(v3Save);
          }
        }
      }

      if (!state) continue;

      saves.push({
        slotName: key.slice(MANUAL_SAVE_PREFIX.length),
        timestamp: savedTimestamp,
        playerId: state.playerId,
        day: state.calendar.totalDay,
        year: state.calendar.year,
      });
    } catch {
      // Skip corrupted saves
    }
  }

  return saves.sort((a, b) => b.timestamp - a.timestamp);
}

export function deleteSave(slotName: string): void {
  localStorage.removeItem(MANUAL_SAVE_PREFIX + slotName);
}

export function deleteAutoSave(): void {
  localStorage.removeItem(AUTOSAVE_KEY);
}

// ============================================================================
// Tutorial Preference
// ============================================================================

export function isTutorialDismissed(): boolean {
  return localStorage.getItem(TUTORIAL_DISMISSED_KEY) === 'true';
}

export function setTutorialDismissed(dismissed: boolean): void {
  if (dismissed) {
    localStorage.setItem(TUTORIAL_DISMISSED_KEY, 'true');
  } else {
    localStorage.removeItem(TUTORIAL_DISMISSED_KEY);
  }
}

// ============================================================================
// Validation
// ============================================================================

function validateSave(data: unknown): data is SaveGame {
  if (!data || typeof data !== 'object') return false;
  const save = data as Record<string, unknown>;

  // Version check
  if (save.version !== SAVE_VERSION) return false;

  // Timestamp check
  if (typeof save.timestamp !== 'number') return false;

  // State existence
  if (!save.state || typeof save.state !== 'object') return false;
  const state = save.state as Record<string, unknown>;

  // Required state fields
  if (!state.calendar || typeof state.calendar !== 'object') return false;
  if (!state.grid || !Array.isArray(state.grid)) return false;
  if (!state.economy || typeof state.economy !== 'object') return false;
  if (typeof state.playerId !== 'string') return false;
  if (typeof state.rngState !== 'number') return false;

  // Grid dimensions check
  const grid = state.grid as unknown[][];
  if (grid.length !== GRID_ROWS) return false;
  for (const row of grid) {
    if (!Array.isArray(row) || row.length !== GRID_COLS) return false;
  }

  // Economy values must be finite numbers
  const economy = state.economy as Record<string, unknown>;
  if (typeof economy.cash !== 'number' || !Number.isFinite(economy.cash)) return false;

  return true;
}

// ============================================================================
// V2 → V3 Migration (adds chill hours to crop instances)
// ============================================================================

function isV2Save(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const save = data as Record<string, unknown>;
  return save.version === '2.0.0';
}

/**
 * Migrate a v2 save to v3 by adding chillHoursAccumulated to all crop instances.
 * Returns null if migration fails.
 */
function migrateV2ToV3(data: unknown): GameState | null {
  try {
    const save = data as SaveGame;
    const state = save.state as GameState & Record<string, unknown>;

    // Add chillHoursAccumulated to all crop instances
    for (const row of state.grid) {
      for (const cell of row) {
        if (cell.crop) {
          if ((cell.crop as unknown as Record<string, unknown>).chillHoursAccumulated === undefined) {
            cell.crop.chillHoursAccumulated = 0;
          }
        }
      }
    }

    return state as GameState;
  } catch {
    return null;
  }
}

// ============================================================================
// V1 → V2 Migration (best-effort, minimal)
// ============================================================================

function isV1Save(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const save = data as Record<string, unknown>;
  return save.version === '1.0.0';
}

/**
 * Migrate a v1 save to v2 by filling in Slice 2a defaults.
 * Returns null if migration fails (caller should show "start new game").
 */
function migrateV1ToV2(data: unknown): GameState | null {
  try {
    const save = data as SaveGame;
    const state = save.state as GameState & Record<string, unknown>;

    // Fill missing economy fields
    if (state.economy.debt === undefined) state.economy.debt = 0;
    if (state.economy.totalLoansReceived === undefined) state.economy.totalLoansReceived = 0;
    if (state.economy.interestPaidThisYear === undefined) state.economy.interestPaidThisYear = 0;

    // Fill missing event system fields
    if (!state.eventLog) state.eventLog = [];
    if (state.activeEvent === undefined) state.activeEvent = null;
    if (!state.pendingForeshadows) state.pendingForeshadows = [];
    if (!state.activeEffects) state.activeEffects = [];
    if (state.cropFailureStreak === undefined) state.cropFailureStreak = 0;
    if (!state.flags) state.flags = {};
    if (state.wateringRestricted === undefined) state.wateringRestricted = false;
    if (state.wateringRestrictionEndsDay === undefined) state.wateringRestrictionEndsDay = 0;
    if (state.irrigationCostMultiplier === undefined) state.irrigationCostMultiplier = 1.0;
    // Derive event RNG seed from scenario seed, not a hardcoded value.
    // This is correct for the current scenario; future multi-scenario support
    // would need the scenario ID to look up the right seed.
    if (state.eventRngState === undefined) {
      state.eventRngState = SLICE_1_SCENARIO.seed + EVENT_RNG_SEED_OFFSET;
    }

    // Fill missing perennial fields on crop instances
    for (const row of state.grid) {
      for (const cell of row) {
        if (cell.crop) {
          if (cell.crop.isPerennial === undefined) cell.crop.isPerennial = false;
          if (cell.crop.perennialAge === undefined) cell.crop.perennialAge = 0;
          if (cell.crop.perennialEstablished === undefined) cell.crop.perennialEstablished = false;
          if (cell.crop.isDormant === undefined) cell.crop.isDormant = false;
          if (cell.crop.harvestedThisSeason === undefined) cell.crop.harvestedThisSeason = false;
        }
      }
    }

    return state as GameState;
  } catch {
    return null;
  }
}

// ============================================================================
// V3 → V4 Migration (adds coverCropId + frostProtectionEndsDay)
// ============================================================================

function isV3Save(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const save = data as Record<string, unknown>;
  return save.version === '3.0.0';
}

/**
 * Migrate a v3 save to v4 by adding:
 * - coverCropId: null on all cells (for 3b cover crops)
 * - frostProtectionEndsDay: 0 on GameState (for 3c weather advisor)
 */
function migrateV3ToV4(data: unknown): GameState | null {
  try {
    const save = data as SaveGame;
    const state = save.state as GameState & Record<string, unknown>;

    // Add coverCropId to all cells
    for (const row of state.grid) {
      for (const cell of row) {
        if ((cell as unknown as Record<string, unknown>).coverCropId === undefined) {
          cell.coverCropId = null;
        }
      }
    }

    // Add frostProtectionEndsDay to GameState
    if (state.frostProtectionEndsDay === undefined) {
      state.frostProtectionEndsDay = 0;
    }

    return state as GameState;
  } catch {
    return null;
  }
}
