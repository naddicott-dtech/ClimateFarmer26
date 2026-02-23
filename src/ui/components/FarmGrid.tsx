import { useCallback } from 'preact/hooks';
import { grid, selectedCell, selectCell } from '../../adapter/signals.ts';
import { GRID_ROWS, GRID_COLS } from '../../engine/types.ts';
import { FarmCell } from './FarmCell.tsx';
import styles from '../styles/FarmGrid.module.css';

export function FarmGrid() {
  const gridData = grid.value;
  const allEmpty = gridData.every(row => row.every(cell => cell.crop === null));

  // Arrow key navigation for the grid — SPEC §7.1
  const handleGridKeyDown = useCallback((e: KeyboardEvent) => {
    const sel = selectedCell.value;
    if (!sel) return;

    let { row, col } = sel;
    let moved = false;

    switch (e.key) {
      case 'ArrowUp':
        if (row > 0) { row--; moved = true; }
        break;
      case 'ArrowDown':
        if (row < GRID_ROWS - 1) { row++; moved = true; }
        break;
      case 'ArrowLeft':
        if (col > 0) { col--; moved = true; }
        break;
      case 'ArrowRight':
        if (col < GRID_COLS - 1) { col++; moved = true; }
        break;
    }

    if (moved) {
      e.preventDefault();
      selectCell(row, col);
      // Move focus to the new cell
      const el = document.querySelector(`[data-testid="farm-cell-${row}-${col}"]`) as HTMLElement;
      el?.focus();
    }
  }, []);

  return (
    <div class={styles.gridContainer}>
      <div class={styles.gridWrapper}>
        <div
          class={styles.grid}
          data-testid="farm-grid"
          role="grid"
          aria-label="Farm field - 8 rows by 8 columns"
          onKeyDown={handleGridKeyDown}
        >
          {gridData.map((row, r) =>
            row.map((cell, c) => (
              <FarmCell key={`${r}-${c}`} cell={cell} />
            ))
          )}
        </div>
        {allEmpty && (
          <div class={styles.emptyFieldHint} aria-live="polite">
            Select a plot and plant your first crop!
          </div>
        )}
      </div>
    </div>
  );
}
