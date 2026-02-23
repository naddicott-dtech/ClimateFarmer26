import type { GameState, SaveGame } from '../engine/types.ts';
import { SAVE_VERSION, GRID_ROWS, GRID_COLS } from '../engine/types.ts';

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
    if (!validateSave(parsed)) return null;

    return parsed.state;
  } catch {
    return null;
  }
}

// ============================================================================
// Save Management
// ============================================================================

export function hasSaveData(): boolean {
  if (localStorage.getItem(AUTOSAVE_KEY)) return true;

  // Check for any manual saves
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
      if (!validateSave(parsed)) continue;

      saves.push({
        slotName: key.slice(MANUAL_SAVE_PREFIX.length),
        timestamp: parsed.timestamp,
        playerId: parsed.state.playerId,
        day: parsed.state.calendar.totalDay,
        year: parsed.state.calendar.year,
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
