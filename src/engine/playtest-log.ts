/**
 * Playtest logging — opt-in verbose logging for human QA sessions.
 *
 * Enable:  localStorage.setItem('playtestLog', '1')
 * Disable: localStorage.removeItem('playtestLog')
 *
 * Access in console:
 *   window.__playtestLog          — array of all log entries
 *   window.__exportPlaytestLog()  — copy-paste-friendly JSON string
 *
 * Logs meaningful transitions only (commands, events, year-end, game-over).
 * Zero runtime cost when disabled.
 */

import type { GameState, Command } from './types.ts';
import { GRID_ROWS, GRID_COLS } from './types.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PlaytestLogType =
  | 'session_start'
  | 'command'
  | 'event_fired'
  | 'event_choice'
  | 'loan_offer'
  | 'loan_taken'
  | 'year_end'
  | 'harvest'
  | 'game_over';

interface PlaytestLogEntry {
  seq: number;
  ts: string;
  day: number;
  year: number;
  season: 'spring' | 'summer' | 'fall' | 'winter';
  type: PlaytestLogType;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const ENABLED = typeof localStorage !== 'undefined' && localStorage.getItem('playtestLog') === '1';
const log: PlaytestLogEntry[] = [];
let seq = 1;

// ---------------------------------------------------------------------------
// Core logger
// ---------------------------------------------------------------------------

function emit(type: PlaytestLogType, state: GameState, payload: Record<string, unknown>): void {
  if (!ENABLED) return;
  const entry: PlaytestLogEntry = {
    seq: seq++,
    ts: new Date().toISOString(),
    day: state.calendar.totalDay,
    year: state.calendar.year,
    season: state.calendar.season,
    type,
    payload,
  };
  log.push(entry);
  console.log('%c[PLAYTEST]', 'color: #2e7d32; font-weight: bold', entry);
}

// ---------------------------------------------------------------------------
// Public API — called from engine/adapter hooks
// ---------------------------------------------------------------------------

export function logSessionStart(state: GameState): void {
  emit('session_start', state, {
    playerId: state.playerId,
    scenarioId: state.scenarioId,
  });
}

export function logCommand(state: GameState, command: Command, ok: boolean, reason?: string, cashBefore?: number): void {
  emit('command', state, {
    cmd: command.type,
    ok,
    reason,
    cashBefore: cashBefore !== undefined ? Math.floor(cashBefore) : undefined,
    cashAfter: Math.floor(state.economy.cash),
  });
}

export function logEventFired(state: GameState, eventId: string, eventType: string, title: string, choices: string[]): void {
  emit('event_fired', state, { eventId, eventType, title, choices });
}

export function logEventChoice(state: GameState, eventId: string, choiceId: string, cashBefore: number): void {
  emit('event_choice', state, {
    eventId,
    choiceId,
    cashBefore: Math.floor(cashBefore),
    cashAfter: Math.floor(state.economy.cash),
  });
}

export function logLoanOffer(state: GameState, amount: number): void {
  emit('loan_offer', state, {
    amount,
    cash: Math.floor(state.economy.cash),
    debt: Math.floor(state.economy.debt),
  });
}

export function logLoanTaken(state: GameState, amount: number): void {
  emit('loan_taken', state, {
    amount,
    cashAfter: Math.floor(state.economy.cash),
    debtAfter: Math.floor(state.economy.debt),
  });
}

export function logHarvest(state: GameState, cropId: string, revenue: number, yieldAmount: number): void {
  emit('harvest', state, {
    cropId,
    revenue: Math.floor(revenue),
    yield: Math.round(yieldAmount * 10) / 10,
    cash: Math.floor(state.economy.cash),
  });
}

export function logYearEnd(state: GameState): void {
  // Compute crop mix
  const cropsById: Record<string, number> = {};
  let avgN = 0;
  let avgOM = 0;
  const totalCells = GRID_ROWS * GRID_COLS;

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = state.grid[r][c];
      if (cell.crop) {
        cropsById[cell.crop.cropId] = (cropsById[cell.crop.cropId] || 0) + 1;
      }
      avgN += cell.soil.nitrogen;
      avgOM += cell.soil.organicMatter;
    }
  }

  emit('year_end', state, {
    revenue: Math.floor(state.economy.yearlyRevenue),
    expenses: Math.floor(state.economy.yearlyExpenses),
    net: Math.floor(state.economy.yearlyRevenue - state.economy.yearlyExpenses),
    cash: Math.floor(state.economy.cash),
    debt: Math.floor(state.economy.debt),
    interestPaid: Math.floor(state.economy.interestPaidThisYear),
    avgNitrogen: Math.round(avgN / totalCells),
    avgOrganicMatter: Math.round((avgOM / totalCells) * 100) / 100,
    cropsById,
  });
}

export function logGameOver(state: GameState, reason: string): void {
  emit('game_over', state, {
    reason,
    cash: Math.floor(state.economy.cash),
    debt: Math.floor(state.economy.debt),
    year: state.calendar.year,
  });
}

// ---------------------------------------------------------------------------
// Expose to window for console access
// ---------------------------------------------------------------------------

export function isPlaytestLogEnabled(): boolean {
  return ENABLED;
}

if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__playtestLog = log;
  (window as unknown as Record<string, unknown>).__exportPlaytestLog = () => JSON.stringify(log, null, 2);
}
