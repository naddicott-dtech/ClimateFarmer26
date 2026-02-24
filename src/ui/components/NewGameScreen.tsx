import { useState } from 'preact/hooks';
import {
  startNewGame, resumeGame, canResume, canLoadSaves,
  getManualSaves, loadSavedGame, handleDeleteSave,
} from '../../adapter/signals.ts';
import type { SaveSlotInfo } from '../../save/storage.ts';
import styles from '../styles/NewGameScreen.module.css';

export function NewGameScreen() {
  const [playerId, setPlayerId] = useState('');
  const [validation, setValidation] = useState('');
  const [showLoads, setShowLoads] = useState(false);
  const [saves, setSaves] = useState<SaveSlotInfo[]>([]);
  const hasResume = canResume();
  const hasLoads = canLoadSaves();

  function handleInput(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    // Truncate to 30 chars per SPEC §1.2
    const truncated = value.slice(0, 30);
    setPlayerId(truncated);
    if (validation && truncated.trim().length > 0) {
      setValidation('');
    }
  }

  function handleStart() {
    const trimmed = playerId.trim();
    if (!trimmed) {
      setValidation('Please enter a Player ID to get started.');
      return;
    }
    startNewGame(trimmed);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleStart();
    }
  }

  function handleResume() {
    resumeGame();
  }

  function toggleLoadMenu() {
    if (!showLoads) {
      setSaves(getManualSaves());
    }
    setShowLoads(!showLoads);
  }

  function handleLoad(slotName: string) {
    loadSavedGame(slotName);
  }

  function handleDelete(slotName: string) {
    handleDeleteSave(slotName);
    // Refresh list
    const updated = getManualSaves();
    setSaves(updated);
    if (updated.length === 0) {
      setShowLoads(false);
    }
  }

  function formatTimestamp(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  return (
    <div class={styles.screen}>
      <h1 class={styles.title}>Climate Farmer</h1>
      <p class={styles.subtitle}>
        Manage a San Joaquin Valley farm through 30 years of changing climate.
        Plant crops, manage water, and keep your farm profitable.
      </p>
      <div class={styles.form}>
        <label class={styles.label} for="player-id-input">Player ID</label>
        <input
          id="player-id-input"
          data-testid="newgame-player-id"
          class={styles.input}
          type="text"
          value={playerId}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="e.g. P3-14 or Team Blue"
          maxLength={30}
          aria-label="Player ID"
          aria-describedby={validation ? 'player-id-validation' : undefined}
          autoFocus
        />
        {playerId.length >= 25 && (
          <span class={styles.charCount}>{playerId.length}/30</span>
        )}
        <div
          id="player-id-validation"
          class={styles.validation}
          role="alert"
          aria-live="polite"
        >
          {validation}
        </div>
        <div class={styles.buttonGroup}>
          <button
            data-testid="newgame-start"
            class={styles.startBtn}
            onClick={handleStart}
          >
            Start New Game
          </button>
          {hasResume && (
            <button
              data-testid="save-resume"
              class={styles.resumeBtn}
              onClick={handleResume}
            >
              Continue Saved Game
            </button>
          )}
          {hasLoads && (
            <button
              data-testid="save-load-toggle"
              class={styles.loadToggleBtn}
              onClick={toggleLoadMenu}
            >
              {showLoads ? 'Hide Saved Games' : 'Load Game'}
            </button>
          )}
        </div>

        {showLoads && saves.length > 0 && (
          <div class={styles.loadSection} data-testid="save-load-menu">
            <div class={styles.loadTitle}>Saved Games</div>
            {saves.map(save => (
              <div key={save.slotName} class={styles.saveEntry}>
                <div class={styles.saveInfo}>
                  <span class={styles.saveName}>{save.slotName}</span>
                  <span class={styles.saveTimestamp}>{formatTimestamp(save.timestamp)}</span>
                </div>
                <div class={styles.saveActions}>
                  <button
                    data-testid={`save-load-${save.slotName}`}
                    class={styles.loadBtn}
                    onClick={() => handleLoad(save.slotName)}
                  >
                    Load
                  </button>
                  <button
                    data-testid={`save-delete-${save.slotName}`}
                    class={styles.deleteBtn}
                    onClick={() => handleDelete(save.slotName)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
