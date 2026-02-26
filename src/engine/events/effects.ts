// ============================================================================
// Event Effects — ClimateFarmer26 Slice 2a
// Apply effects from event choices, manage active effect expiry, compute modifiers.
// ============================================================================

import type { GameState } from '../types.ts';
import type { Effect } from './types.ts';
import { GRID_ROWS, GRID_COLS } from '../types.ts';
import { addNotification } from '../game.ts';

/** Clamp a modifier product to the allowed range [0.0, 10.0] */
function clampModifier(value: number): number {
  return Math.max(0.0, Math.min(10.0, value));
}

/**
 * Apply all effects from a choice to the game state.
 * Called when the player responds to an event.
 */
export function applyEffects(
  state: GameState,
  effects: Effect[],
  sourceEventId: string,
): void {
  for (const effect of effects) {
    switch (effect.type) {
      case 'modify_cash':
        state.economy.cash += effect.amount;
        state.economy.yearlyExpenses += Math.max(0, -effect.amount);
        state.economy.yearlyRevenue += Math.max(0, effect.amount);
        break;

      case 'modify_moisture_all':
        for (let r = 0; r < GRID_ROWS; r++) {
          for (let c = 0; c < GRID_COLS; c++) {
            const soil = state.grid[r][c].soil;
            soil.moisture = Math.max(0, Math.min(
              soil.moisture + effect.amount,
              soil.moistureCapacity,
            ));
          }
        }
        break;

      case 'modify_nitrogen_all':
        for (let r = 0; r < GRID_ROWS; r++) {
          for (let c = 0; c < GRID_COLS; c++) {
            const soil = state.grid[r][c].soil;
            soil.nitrogen = Math.max(0, Math.min(soil.nitrogen + effect.amount, 200));
          }
        }
        break;

      case 'modify_yield_modifier':
        state.activeEffects.push({
          effectType: 'yield_modifier',
          cropId: effect.cropId,
          multiplier: effect.multiplier,
          expiresDay: state.calendar.totalDay + effect.durationDays,
          sourceEventId,
        });
        break;

      case 'modify_price_modifier':
        state.activeEffects.push({
          effectType: 'price_modifier',
          cropId: effect.cropId,
          multiplier: effect.multiplier,
          expiresDay: state.calendar.totalDay + effect.durationDays,
          sourceEventId,
        });
        break;

      case 'modify_irrigation_cost':
        state.activeEffects.push({
          effectType: 'irrigation_cost_modifier',
          multiplier: effect.multiplier,
          expiresDay: state.calendar.totalDay + effect.durationDays,
          sourceEventId,
        });
        break;

      case 'add_notification':
        addNotification(state, effect.notificationType, effect.message);
        break;

      case 'restrict_watering':
        state.wateringRestricted = true;
        state.wateringRestrictionEndsDay = state.calendar.totalDay + effect.durationDays;
        state.activeEffects.push({
          effectType: 'watering_restriction',
          expiresDay: state.calendar.totalDay + effect.durationDays,
          sourceEventId,
        });
        break;

      case 'set_flag':
        state.flags[effect.flag] = effect.value;
        break;

      case 'activate_frost_protection': {
        const newEnd = state.calendar.totalDay + effect.durationDays;
        state.frostProtectionEndsDay = Math.max(state.frostProtectionEndsDay, newEnd);
        break;
      }

      default: {
        const _exhaustive: never = effect;
        throw new Error(`Unhandled effect type: ${(_exhaustive as Effect).type}`);
      }
    }
  }
}

/**
 * Remove active effects that have expired (expiresDay <= current totalDay).
 * Also clears watering restriction when its effect expires.
 */
export function expireActiveEffects(state: GameState): void {
  const currentDay = state.calendar.totalDay;
  const expired = state.activeEffects.filter(e => currentDay >= e.expiresDay);
  state.activeEffects = state.activeEffects.filter(e => currentDay < e.expiresDay);

  // Clear watering restriction if its effect expired
  for (const e of expired) {
    if (e.effectType === 'watering_restriction') {
      state.wateringRestricted = false;
    }
  }
}

/**
 * Compute the combined yield modifier for a given crop (or all crops).
 * Modifiers multiply together. Product clamped to [0.0, 10.0].
 */
export function getYieldModifier(state: GameState, cropId: string): number {
  let product = 1.0;
  for (const effect of state.activeEffects) {
    if (effect.effectType === 'yield_modifier' && effect.multiplier !== undefined) {
      if (effect.cropId === '*' || effect.cropId === cropId) {
        product *= effect.multiplier;
      }
    }
  }
  return clampModifier(product);
}

/**
 * Compute the combined price modifier for a given crop (or all crops).
 * Modifiers multiply together. Product clamped to [0.0, 10.0].
 */
export function getPriceModifier(state: GameState, cropId: string): number {
  let product = 1.0;
  for (const effect of state.activeEffects) {
    if (effect.effectType === 'price_modifier' && effect.multiplier !== undefined) {
      if (effect.cropId === '*' || effect.cropId === cropId) {
        product *= effect.multiplier;
      }
    }
  }
  return clampModifier(product);
}

/**
 * Compute the combined irrigation cost multiplier.
 * Modifiers multiply together. Product clamped to [0.0, 10.0].
 */
export function getIrrigationCostMultiplier(state: GameState): number {
  let product = 1.0;
  for (const effect of state.activeEffects) {
    if (effect.effectType === 'irrigation_cost_modifier' && effect.multiplier !== undefined) {
      product *= effect.multiplier;
    }
  }
  return clampModifier(product);
}
