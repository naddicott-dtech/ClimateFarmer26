import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveGame, loadGame, autoSave, loadAutoSave,
  hasSaveData, hasManualSaves, deleteSave, deleteAutoSave,
  listManualSaves, AUTOSAVE_KEY,
} from '../../src/save/storage.ts';
import { createInitialState, simulateTick, processCommand } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import type { GameState, SaveGame } from '../../src/engine/types.ts';
import { SAVE_VERSION, STARTING_DAY } from '../../src/engine/types.ts';

describe('Save/Load System', () => {
  let mockStorage: Record<string, string>;

  beforeEach(() => {
    mockStorage = {};
    // Mock localStorage
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] ?? null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      get length() { return Object.keys(mockStorage).length; },
      key: (index: number) => Object.keys(mockStorage)[index] ?? null,
      clear: () => { mockStorage = {}; },
    });
  });

  describe('hasSaveData', () => {
    it('returns false when no saves exist', () => {
      expect(hasSaveData()).toBe(false);
    });

    it('returns true when auto-save exists', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      autoSave(state);
      expect(hasSaveData()).toBe(true);
    });

    it('returns false when only manual saves exist (no auto-save)', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      saveGame(state, 'slot1');
      expect(hasSaveData()).toBe(false);
    });
  });

  describe('hasManualSaves', () => {
    it('returns false when no manual saves exist', () => {
      expect(hasManualSaves()).toBe(false);
    });

    it('returns true when manual save exists', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      saveGame(state, 'slot1');
      expect(hasManualSaves()).toBe(true);
    });

    it('returns false when only auto-save exists', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      autoSave(state);
      expect(hasManualSaves()).toBe(false);
    });
  });

  describe('autoSave and loadAutoSave', () => {
    it('saves and loads game state', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      autoSave(state);
      const loaded = loadAutoSave();
      expect(loaded).not.toBeNull();
      expect(loaded!.playerId).toBe('test-player');
      expect(loaded!.calendar.totalDay).toBe(STARTING_DAY);
      expect(loaded!.economy.cash).toBe(50000);
    });

    it('preserves exact state after simulation', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      processCommand(state, { type: 'SET_SPEED', speed: 1 }, SLICE_1_SCENARIO);

      // Simulate 30 days
      for (let i = 0; i < 30; i++) {
        simulateTick(state, SLICE_1_SCENARIO);
      }
      state.speed = 0; // pause before saving

      const beforeSave = JSON.stringify(state);
      autoSave(state);
      const loaded = loadAutoSave()!;
      const afterLoad = JSON.stringify(loaded);

      expect(afterLoad).toBe(beforeSave);
    });

    it('overwrites previous auto-save', () => {
      const state1 = createInitialState('player1', SLICE_1_SCENARIO);
      autoSave(state1);

      const state2 = createInitialState('player2', SLICE_1_SCENARIO);
      autoSave(state2);

      const loaded = loadAutoSave()!;
      expect(loaded.playerId).toBe('player2');
    });
  });

  describe('manual save and load', () => {
    it('saves to named slot and loads back', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      saveGame(state, 'slot1');
      const loaded = loadGame('slot1');
      expect(loaded).not.toBeNull();
      expect(loaded!.playerId).toBe('test-player');
    });

    it('supports multiple save slots', () => {
      const state1 = createInitialState('player-a', SLICE_1_SCENARIO);
      saveGame(state1, 'slot1');

      const state2 = createInitialState('player-b', SLICE_1_SCENARIO);
      saveGame(state2, 'slot2');

      expect(loadGame('slot1')!.playerId).toBe('player-a');
      expect(loadGame('slot2')!.playerId).toBe('player-b');
    });

    it('lists manual saves', () => {
      const state = createInitialState('player-a', SLICE_1_SCENARIO);
      saveGame(state, 'slot1');
      saveGame(state, 'slot2');

      const saves = listManualSaves();
      expect(saves).toHaveLength(2);
      expect(saves.map(s => s.slotName)).toContain('slot1');
      expect(saves.map(s => s.slotName)).toContain('slot2');
    });

    it('lists saves with timestamps', () => {
      const state = createInitialState('player-a', SLICE_1_SCENARIO);
      const before = Date.now();
      saveGame(state, 'slot1');
      const after = Date.now();

      const saves = listManualSaves();
      expect(saves[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(saves[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('deleteSave', () => {
    it('deletes a manual save', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      saveGame(state, 'slot1');
      expect(loadGame('slot1')).not.toBeNull();

      deleteSave('slot1');
      expect(loadGame('slot1')).toBeNull();
    });

    it('deletes auto-save', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      autoSave(state);
      expect(loadAutoSave()).not.toBeNull();

      deleteAutoSave();
      expect(loadAutoSave()).toBeNull();
    });
  });

  describe('save integrity', () => {
    it('includes version in save data', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      autoSave(state);
      const raw = JSON.parse(mockStorage[AUTOSAVE_KEY]) as SaveGame;
      expect(raw.version).toBe(SAVE_VERSION);
    });

    it('includes timestamp in save data', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      const before = Date.now();
      autoSave(state);
      const raw = JSON.parse(mockStorage[AUTOSAVE_KEY]) as SaveGame;
      expect(raw.timestamp).toBeGreaterThanOrEqual(before);
    });

    it('returns null for corrupted JSON', () => {
      mockStorage[AUTOSAVE_KEY] = '{not valid json!!!';
      expect(loadAutoSave()).toBeNull();
    });

    it('returns null for save missing required fields', () => {
      mockStorage[AUTOSAVE_KEY] = JSON.stringify({ version: '1.0.0' });
      expect(loadAutoSave()).toBeNull();
    });

    it('returns null for save with wrong version', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      autoSave(state);
      const raw = JSON.parse(mockStorage[AUTOSAVE_KEY]) as SaveGame;
      raw.version = '99.99.99';
      mockStorage[AUTOSAVE_KEY] = JSON.stringify(raw);
      expect(loadAutoSave()).toBeNull();
    });

    it('returns null for tampered state (missing grid)', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      autoSave(state);
      const raw = JSON.parse(mockStorage[AUTOSAVE_KEY]);
      delete raw.state.grid;
      mockStorage[AUTOSAVE_KEY] = JSON.stringify(raw);
      expect(loadAutoSave()).toBeNull();
    });

    it('returns null for tampered state (NaN cash)', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      autoSave(state);
      const raw = JSON.parse(mockStorage[AUTOSAVE_KEY]);
      raw.state.economy.cash = 'NaN';
      mockStorage[AUTOSAVE_KEY] = JSON.stringify(raw);
      expect(loadAutoSave()).toBeNull();
    });
  });

  describe('determinism after load', () => {
    it('resumed game produces identical state to continuous game', () => {
      // Run game A continuously for 60 days
      const stateA = createInitialState('test-player', SLICE_1_SCENARIO);
      stateA.speed = 1;
      for (let i = 0; i < 60; i++) {
        simulateTick(stateA, SLICE_1_SCENARIO);
      }

      // Run game B for 30 days, save, load, run 30 more
      const stateB = createInitialState('test-player', SLICE_1_SCENARIO);
      stateB.speed = 1;
      for (let i = 0; i < 30; i++) {
        simulateTick(stateB, SLICE_1_SCENARIO);
      }
      autoSave(stateB);
      const stateB2 = loadAutoSave()!;
      stateB2.speed = 1;
      for (let i = 0; i < 30; i++) {
        simulateTick(stateB2, SLICE_1_SCENARIO);
      }

      // Both should be identical
      expect(stateB2.calendar.totalDay).toBe(stateA.calendar.totalDay);
      expect(stateB2.economy.cash).toBe(stateA.economy.cash);
      expect(stateB2.rngState).toBe(stateA.rngState);

      // Check every cell
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          expect(stateB2.grid[r][c].soil.moisture).toBe(stateA.grid[r][c].soil.moisture);
          expect(stateB2.grid[r][c].soil.nitrogen).toBe(stateA.grid[r][c].soil.nitrogen);
          expect(stateB2.grid[r][c].soil.organicMatter).toBe(stateA.grid[r][c].soil.organicMatter);
        }
      }
    });
  });

  describe('localStorage error handling', () => {
    it('handles localStorage quota exceeded', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => null,
        setItem: () => { throw new DOMException('QuotaExceededError'); },
        removeItem: () => {},
        length: 0,
        key: () => null,
        clear: () => {},
      });

      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      const result = autoSave(state);
      expect(result.success).toBe(false);
      expect(result.error).toContain('QuotaExceededError');
    });
  });
});
