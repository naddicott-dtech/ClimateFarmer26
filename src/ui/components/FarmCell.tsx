import { selectCell, selectedCell } from '../../adapter/signals.ts';
import { getGrowthProgress } from '../../engine/game.ts';
import { getCropDefinition } from '../../data/crops.ts';
import type { Cell } from '../../engine/types.ts';
import { WATER_VISUAL_WARNING_THRESHOLD, WATER_WILTING_THRESHOLD } from '../../engine/types.ts';
import styles from '../styles/FarmCell.module.css';

const CROP_ICONS: Record<string, Record<string, string>> = {
  'processing-tomatoes': {
    seedling: '\u{1F331}',
    vegetative: '\u{1FAB4}',
    flowering: '\u{1F33B}',
    mature: '\u{1F345}',
    harvestable: '\u{1F345}',
    overripe: '\u{1F345}',
  },
  'silage-corn': {
    seedling: '\u{1F331}',
    vegetative: '\u{1FAB4}',
    flowering: '\u{1F33E}',
    mature: '\u{1F33D}',
    harvestable: '\u{1F33D}',
    overripe: '\u{1F33D}',
  },
  'winter-wheat': {
    seedling: '\u{1F331}',
    vegetative: '\u{1FAB4}',
    flowering: '\u{1F33E}',
    mature: '\u{1F33E}',
    harvestable: '\u{1F33E}',
    overripe: '\u{1F33E}',
  },
  'almonds': {
    seedling: '\u{1F333}',
    vegetative: '\u{1F333}',
    flowering: '\u{1F338}',
    mature: '\u{1F333}',
    harvestable: '\u{1F95C}',
    overripe: '\u{1F95C}',
  },
  'pistachios': {
    seedling: '\u{1F333}',
    vegetative: '\u{1F333}',
    flowering: '\u{1F338}',
    mature: '\u{1F333}',
    harvestable: '\u{1F95C}',
    overripe: '\u{1F95C}',
  },
};

interface FarmCellProps {
  cell: Cell;
}

export function FarmCell({ cell }: FarmCellProps) {
  const { row, col, crop, soil } = cell;
  const isSelected = selectedCell.value?.row === row && selectedCell.value?.col === col;

  // Determine visual classes
  const stageClass = crop ? styles[crop.growthStage] ?? '' : '';
  const moistureRatio = soil.moistureCapacity > 0 ? soil.moisture / soil.moistureCapacity : 0;
  const moistureClass =
    crop && moistureRatio < WATER_WILTING_THRESHOLD ? styles.moistureCritical :
    crop && moistureRatio < WATER_VISUAL_WARNING_THRESHOLD ? styles.moistureWarning :
    '';

  // Crop icon — dormant perennials show a bare tree
  const icon = crop
    ? (crop.isDormant ? '\u{1FAB5}' : (CROP_ICONS[crop.cropId]?.[crop.growthStage] ?? '\u{1F331}'))
    : '';
  const dormantClass = crop?.isDormant ? styles.dormant : '';

  // Growth progress (0-1)
  const progress = crop ? getGrowthProgress(crop) : 0;

  // ARIA label for screen readers — SPEC §7.3
  const cropDef = crop ? getCropDefinition(crop.cropId) : null;
  const ariaLabel = crop
    ? `Row ${row + 1}, Column ${col + 1}: ${cropDef!.name}, ${crop.growthStage} stage, nitrogen ${Math.round(soil.nitrogen)}, moisture ${Math.round(soil.moisture * 10) / 10}`
    : `Row ${row + 1}, Column ${col + 1}: Empty plot, nitrogen ${Math.round(soil.nitrogen)}, moisture ${Math.round(soil.moisture * 10) / 10}`;

  function handleClick() {
    selectCell(row, col);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectCell(row, col);
    }
    // Arrow key navigation handled by grid container
  }

  return (
    <button
      data-testid={`farm-cell-${row}-${col}`}
      class={`${styles.cell} ${stageClass} ${moistureClass} ${dormantClass} ${isSelected ? styles.selected : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="gridcell"
      aria-label={ariaLabel}
      aria-selected={isSelected}
      tabIndex={row === 0 && col === 0 ? 0 : -1}
    >
      {icon && <span class={styles.cropIcon} aria-hidden="true">{icon}</span>}
      {crop && !crop.isDormant && crop.growthStage !== 'harvestable' && crop.growthStage !== 'overripe' && (
        <div class={styles.progressBar} style={{ width: `${progress * 100}%` }} />
      )}
    </button>
  );
}
