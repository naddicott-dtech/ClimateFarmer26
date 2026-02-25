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

  describe('v1 → v2 migration', () => {
    it('migrates v1 save by filling Slice 2a defaults', () => {
      // Create a v1-shaped save (missing Slice 2a fields)
      const state = createInitialState('test-player', SLICE_1_SCENARIO);

      // Strip Slice 2a fields to simulate a v1 save
      const v1State = { ...state } as Record<string, unknown>;
      delete v1State.eventLog;
      delete v1State.activeEvent;
      delete v1State.pendingForeshadows;
      delete v1State.activeEffects;
      delete v1State.cropFailureStreak;
      delete v1State.flags;
      delete v1State.wateringRestricted;
      delete v1State.wateringRestrictionEndsDay;
      delete v1State.irrigationCostMultiplier;
      delete v1State.eventRngState;

      // Strip Slice 2a economy fields
      const v1Economy = { ...state.economy } as Record<string, unknown>;
      delete v1Economy.debt;
      delete v1Economy.totalLoansReceived;
      delete v1Economy.interestPaidThisYear;
      (v1State as Record<string, unknown>).economy = v1Economy;

      const v1Save = {
        version: '1.0.0',
        state: v1State,
        timestamp: Date.now(),
      };
      mockStorage[AUTOSAVE_KEY] = JSON.stringify(v1Save);

      const loaded = loadAutoSave();
      expect(loaded).not.toBeNull();
      expect(loaded!.eventLog).toEqual([]);
      expect(loaded!.activeEvent).toBeNull();
      expect(loaded!.economy.debt).toBe(0);
      expect(loaded!.economy.totalLoansReceived).toBe(0);
      expect(loaded!.wateringRestricted).toBe(false);
    });
  });

  describe('v2 manual save appears in listManualSaves', () => {
    it('old-version manual saves are listed after migration', () => {
      // Create a V2-format manual save directly in localStorage
      const state = createInitialState('old-player', SLICE_1_SCENARIO);
      const v2Save = {
        version: '2.0.0',
        state,
        timestamp: Date.now(),
      };
      mockStorage['climateFarmer_save_OldSlot'] = JSON.stringify(v2Save);

      const saves = listManualSaves();
      expect(saves.length).toBeGreaterThanOrEqual(1);
      expect(saves.some(s => s.slotName === 'OldSlot')).toBe(true);
    });
  });

  describe('v2 → v3 migration', () => {
    it('migrates v2 save by adding chillHoursAccumulated to crops', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      // Plant a crop, then strip the v3 field to simulate a v2 save
      processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'processing-tomatoes' }, SLICE_1_SCENARIO);

      const v2State = JSON.parse(JSON.stringify(state));
      // Remove chillHoursAccumulated from the crop instance
      delete v2State.grid[0][0].crop.chillHoursAccumulated;

      const v2Save = {
        version: '2.0.0',
        state: v2State,
        timestamp: Date.now(),
      };
      mockStorage[AUTOSAVE_KEY] = JSON.stringify(v2Save);

      const loaded = loadAutoSave();
      expect(loaded).not.toBeNull();
      expect(loaded!.grid[0][0].crop).not.toBeNull();
      expect(loaded!.grid[0][0].crop!.chillHoursAccumulated).toBe(0);
    });

    it('v2 save without crops migrates cleanly', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      const v2Save = {
        version: '2.0.0',
        state: JSON.parse(JSON.stringify(state)),
        timestamp: Date.now(),
      };
      mockStorage[AUTOSAVE_KEY] = JSON.stringify(v2Save);

      const loaded = loadAutoSave();
      expect(loaded).not.toBeNull();
      expect(loaded!.playerId).toBe('test-player');
    });
  });

  describe('v1 → v2 → v3 migration chain', () => {
    it('migrates v1 save all the way to v3 with chillHoursAccumulated', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      // Plant a crop
      processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'silage-corn' }, SLICE_1_SCENARIO);

      // Build a v1-shaped save (strip v2a AND v3 fields)
      const v1State = JSON.parse(JSON.stringify(state));
      delete v1State.eventLog;
      delete v1State.activeEvent;
      delete v1State.pendingForeshadows;
      delete v1State.activeEffects;
      delete v1State.cropFailureStreak;
      delete v1State.flags;
      delete v1State.wateringRestricted;
      delete v1State.wateringRestrictionEndsDay;
      delete v1State.irrigationCostMultiplier;
      delete v1State.eventRngState;
      delete v1State.economy.debt;
      delete v1State.economy.totalLoansReceived;
      delete v1State.economy.interestPaidThisYear;
      // Also strip v3 fields
      delete v1State.grid[0][0].crop.chillHoursAccumulated;

      const v1Save = {
        version: '1.0.0',
        state: v1State,
        timestamp: Date.now(),
      };
      mockStorage[AUTOSAVE_KEY] = JSON.stringify(v1Save);

      const loaded = loadAutoSave();
      expect(loaded).not.toBeNull();
      // v2 fields present
      expect(loaded!.eventLog).toEqual([]);
      expect(loaded!.economy.debt).toBe(0);
      // v3 fields present
      expect(loaded!.grid[0][0].crop!.chillHoursAccumulated).toBe(0);
    });
  });

  describe('v3 save round-trip', () => {
    it('preserves chillHoursAccumulated through save/load', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      processCommand(state, { type: 'PLANT_CROP', cellRow: 0, cellCol: 0, cropId: 'almonds' }, SLICE_1_SCENARIO);
      // Simulate some chill accumulation
      state.grid[0][0].crop!.chillHoursAccumulated = 350;
      state.flags['chillHoursRevealed'] = true;

      autoSave(state);
      const loaded = loadAutoSave();
      expect(loaded).not.toBeNull();
      expect(loaded!.grid[0][0].crop!.chillHoursAccumulated).toBe(350);
      expect(loaded!.flags['chillHoursRevealed']).toBe(true);
    });
  });

  describe('corrupt/unknown version saves', () => {
    it('returns null for unknown future version', () => {
      const state = createInitialState('test-player', SLICE_1_SCENARIO);
      autoSave(state);
      const raw = JSON.parse(mockStorage[AUTOSAVE_KEY]);
      raw.version = '4.0.0';
      mockStorage[AUTOSAVE_KEY] = JSON.stringify(raw);
      expect(loadAutoSave()).toBeNull();
    });

    it('returns null for completely corrupt save', () => {
      mockStorage[AUTOSAVE_KEY] = JSON.stringify({ version: '2.0.0', state: 'not-an-object' });
      expect(loadAutoSave()).toBeNull();
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
