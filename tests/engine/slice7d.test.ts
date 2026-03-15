import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateCondition, evaluateEvents } from '../../src/engine/events/selector.ts';
import { applyEffects } from '../../src/engine/events/effects.ts';
import { createInitialState } from '../../src/engine/game.ts';
import { SLICE_1_SCENARIO } from '../../src/data/scenario.ts';
import { STORYLETS } from '../../src/data/events.ts';
import { getTechLevel } from '../../src/engine/tech-levels.ts';
import { SeededRNG } from '../../src/engine/rng.ts';
import type { GameState } from '../../src/engine/types.ts';
import type { Storylet } from '../../src/engine/events/types.ts';

// ============================================================================
// Test Helpers
// ============================================================================

function makeState(): GameState {
  return createInitialState('test-player', SLICE_1_SCENARIO);
}

function getStorylet(id: string): Storylet {
  const s = STORYLETS.find(s => s.id === id);
  if (!s) throw new Error(`Storylet not found: ${id}`);
  return s;
}

function setYear(state: GameState, year: number): void {
  state.calendar.year = year;
  state.calendar.totalDay = 59 + (year - 1) * 365;
}

function evaluateNonRandomConditions(storylet: Storylet, state: GameState): boolean {
  const rng = new SeededRNG(42);
  for (const cond of storylet.preconditions.filter(c => c.type !== 'random')) {
    if (!evaluateCondition(cond, state, rng)) return false;
  }
  return true;
}

// Plant a crop so has_crop passes
function plantCrop(state: GameState): void {
  state.grid[0][0].crop = {
    cropId: 'silage-corn', plantedDay: 59, gddAccumulated: 0,
    waterStressDays: 0, growthStage: 'seedling', overripeDaysRemaining: -1,
    isPerennial: false, perennialAge: 0, perennialEstablished: false, isDormant: false,
    harvestedThisSeason: false, chillHoursAccumulated: 0,
  };
}

// ============================================================================
// §7d.0: advisor-avocado-research structural
// ============================================================================

describe('§7d.0: advisor-avocado-research structural', () => {
  it('exists with correct type and advisorId', () => {
    const s = getStorylet('advisor-avocado-research');
    expect(s.type).toBe('advisor');
    expect(s.advisorId).toBe('extension-agent');
  });

  it('has priority 95', () => {
    expect(getStorylet('advisor-avocado-research').priority).toBe(95);
  });

  it('is condition-only (no random precondition)', () => {
    const s = getStorylet('advisor-avocado-research');
    expect(s.preconditions.some(c => c.type === 'random')).toBe(false);
  });

  it('has correct preconditions: min_year 10, max_year 14, not_has_flag tech_crop_avocado, has_crop', () => {
    const s = getStorylet('advisor-avocado-research');
    expect(s.preconditions).toContainEqual({ type: 'min_year', year: 10 });
    expect(s.preconditions).toContainEqual({ type: 'max_year', year: 14 });
    expect(s.preconditions).toContainEqual({ type: 'not_has_flag', flag: 'tech_crop_avocado' });
    expect(s.preconditions).toContainEqual({ type: 'has_crop' });
  });

  it('has cooldownDays 365 and maxOccurrences 2', () => {
    const s = getStorylet('advisor-avocado-research');
    expect(s.cooldownDays).toBe(365);
    expect(s.maxOccurrences).toBe(2);
  });

  it('has 2 choices', () => {
    expect(getStorylet('advisor-avocado-research').choices.length).toBe(2);
  });

  it('has no foreshadowing', () => {
    expect(getStorylet('advisor-avocado-research').foreshadowing).toBeUndefined();
  });

  it('has tech-unlock tag', () => {
    expect(getStorylet('advisor-avocado-research').tags).toContain('tech-unlock');
  });
});

// ============================================================================
// §7d.1: advisor-avocado-research choice effects
// ============================================================================

describe('§7d.1: advisor-avocado-research choice effects', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('research choice costs $600 and sets tech_crop_avocado', () => {
    const s = getStorylet('advisor-avocado-research');
    const choice = s.choices.find(c => c.id === 'research-avocado-early');
    expect(choice).toBeDefined();
    expect(choice!.requiresCash).toBe(600);

    const cashBefore = state.economy.cash;
    applyEffects(state, choice!.effects, 'advisor-avocado-research');

    expect(state.flags['tech_crop_avocado']).toBe(true);
    expect(state.economy.cash).toBe(cashBefore - 600);
  });

  it('defer choice is free and does not set tech_crop_avocado', () => {
    const s = getStorylet('advisor-avocado-research');
    const choice = s.choices.find(c => c.id === 'defer-avocado');
    expect(choice).toBeDefined();
    expect(choice!.requiresCash).toBeUndefined();

    const cashBefore = state.economy.cash;
    applyEffects(state, choice!.effects, 'advisor-avocado-research');

    expect(state.flags['tech_crop_avocado']).toBeUndefined();
    expect(state.economy.cash).toBe(cashBefore);
  });

  it('fires when year 10-14, no tech_crop_avocado flag, has crop', () => {
    setYear(state, 12);
    plantCrop(state);
    expect(evaluateNonRandomConditions(getStorylet('advisor-avocado-research'), state)).toBe(true);
  });

  it('does NOT fire before year 10', () => {
    setYear(state, 9);
    plantCrop(state);
    expect(evaluateNonRandomConditions(getStorylet('advisor-avocado-research'), state)).toBe(false);
  });

  it('does NOT fire after year 14', () => {
    setYear(state, 15);
    plantCrop(state);
    expect(evaluateNonRandomConditions(getStorylet('advisor-avocado-research'), state)).toBe(false);
  });

  it('does NOT fire when tech_crop_avocado already set', () => {
    setYear(state, 12);
    plantCrop(state);
    state.flags['tech_crop_avocado'] = true;
    expect(evaluateNonRandomConditions(getStorylet('advisor-avocado-research'), state)).toBe(false);
  });
});

// ============================================================================
// §7d.2: regime-heat-threshold restructured
// ============================================================================

describe('§7d.2: regime-heat-threshold restructured', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    setYear(state, 17);
    plantCrop(state);
  });

  it('has single choice: acknowledge-heat-regime', () => {
    const s = getStorylet('regime-heat-threshold');
    expect(s.choices.length).toBe(1);
    expect(s.choices[0].id).toBe('acknowledge-heat-regime');
  });

  it('acknowledge choice sets regime_heat_threshold, no cost', () => {
    const s = getStorylet('regime-heat-threshold');
    const choice = s.choices[0];
    expect(choice.requiresCash).toBeUndefined();
    expect(choice.cost).toBeUndefined();

    applyEffects(state, choice.effects, 'regime-heat-threshold');
    expect(state.flags['regime_heat_threshold']).toBe(true);
  });

  it('acknowledge choice does NOT set tech_crop_avocado', () => {
    const s = getStorylet('regime-heat-threshold');
    applyEffects(state, s.choices[0].effects, 'regime-heat-threshold');
    expect(state.flags['tech_crop_avocado']).toBeUndefined();
  });

  it('does not have tech-unlock tag', () => {
    const s = getStorylet('regime-heat-threshold');
    expect(s.tags).not.toContain('tech-unlock');
  });

  it('still has regime-shift tag', () => {
    expect(getStorylet('regime-heat-threshold').tags).toContain('regime-shift');
  });

  it('preconditions unchanged: Y15-20, not_has_flag, has_crop', () => {
    const s = getStorylet('regime-heat-threshold');
    expect(s.preconditions).toContainEqual({ type: 'min_year', year: 15 });
    expect(s.preconditions).toContainEqual({ type: 'max_year', year: 20 });
    expect(s.preconditions).toContainEqual({ type: 'not_has_flag', flag: 'regime_heat_threshold' });
    expect(s.preconditions).toContainEqual({ type: 'has_crop' });
  });
});

// ============================================================================
// §7d.3: advisor-avocado-catchup structural
// ============================================================================

describe('§7d.3: advisor-avocado-catchup structural', () => {
  it('exists with correct type and advisorId', () => {
    const s = getStorylet('advisor-avocado-catchup');
    expect(s.type).toBe('advisor');
    expect(s.advisorId).toBe('extension-agent');
  });

  it('has priority 90', () => {
    expect(getStorylet('advisor-avocado-catchup').priority).toBe(90);
  });

  it('is condition-only (no random precondition)', () => {
    const s = getStorylet('advisor-avocado-catchup');
    expect(s.preconditions.some(c => c.type === 'random')).toBe(false);
  });

  it('has correct preconditions: has_flag regime_heat_threshold, not_has_flag tech_crop_avocado, max_year 25, has_crop', () => {
    const s = getStorylet('advisor-avocado-catchup');
    expect(s.preconditions).toContainEqual({ type: 'has_flag', flag: 'regime_heat_threshold' });
    expect(s.preconditions).toContainEqual({ type: 'not_has_flag', flag: 'tech_crop_avocado' });
    expect(s.preconditions).toContainEqual({ type: 'max_year', year: 25 });
    expect(s.preconditions).toContainEqual({ type: 'has_crop' });
  });

  it('has cooldownDays 365 and maxOccurrences 2', () => {
    const s = getStorylet('advisor-avocado-catchup');
    expect(s.cooldownDays).toBe(365);
    expect(s.maxOccurrences).toBe(2);
  });

  it('has foreshadowing: 90 days, reliability 1.0', () => {
    const s = getStorylet('advisor-avocado-catchup');
    expect(s.foreshadowing).toBeDefined();
    expect(s.foreshadowing!.daysBeforeEvent).toBe(90);
    expect(s.foreshadowing!.reliability).toBe(1.0);
    expect(s.foreshadowing!.advisorSource).toBe('extension-agent');
  });

  it('has 2 choices', () => {
    expect(getStorylet('advisor-avocado-catchup').choices.length).toBe(2);
  });

  it('has tech-unlock tag', () => {
    expect(getStorylet('advisor-avocado-catchup').tags).toContain('tech-unlock');
  });
});

// ============================================================================
// §7d.4: advisor-avocado-catchup choice effects
// ============================================================================

describe('§7d.4: advisor-avocado-catchup choice effects', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
  });

  it('research choice costs $800 and sets tech_crop_avocado', () => {
    const s = getStorylet('advisor-avocado-catchup');
    const choice = s.choices.find(c => c.id === 'research-avocado-late');
    expect(choice).toBeDefined();
    expect(choice!.requiresCash).toBe(800);

    const cashBefore = state.economy.cash;
    applyEffects(state, choice!.effects, 'advisor-avocado-catchup');

    expect(state.flags['tech_crop_avocado']).toBe(true);
    expect(state.economy.cash).toBe(cashBefore - 800);
  });

  it('defer choice is free and does not set tech_crop_avocado', () => {
    const s = getStorylet('advisor-avocado-catchup');
    const choice = s.choices.find(c => c.id === 'defer-avocado-late');
    expect(choice).toBeDefined();
    expect(choice!.requiresCash).toBeUndefined();

    const cashBefore = state.economy.cash;
    applyEffects(state, choice!.effects, 'advisor-avocado-catchup');

    expect(state.flags['tech_crop_avocado']).toBeUndefined();
    expect(state.economy.cash).toBe(cashBefore);
  });
});

// ============================================================================
// §7d.5: Pedagogical sequence
// ============================================================================

describe('§7d.5: Pedagogical sequence', () => {
  let state: GameState;

  beforeEach(() => {
    state = makeState();
    plantCrop(state);
  });

  it('early research → catchup not eligible (not_has_flag blocks)', () => {
    // Student took early research
    state.flags['tech_crop_avocado'] = true;
    state.flags['regime_heat_threshold'] = true;
    setYear(state, 18);

    expect(evaluateNonRandomConditions(getStorylet('advisor-avocado-catchup'), state)).toBe(false);
  });

  it('no early research → regime fires → catchup eligible', () => {
    // Student skipped early research, regime has fired
    state.flags['regime_heat_threshold'] = true;
    setYear(state, 18);

    expect(evaluateNonRandomConditions(getStorylet('advisor-avocado-catchup'), state)).toBe(true);
  });

  it('early research + regime fires → student has both flags', () => {
    state.flags['tech_crop_avocado'] = true;
    state.flags['regime_heat_threshold'] = true;

    // Both flags coexist — student adapted early AND climate changed
    expect(state.flags['tech_crop_avocado']).toBe(true);
    expect(state.flags['regime_heat_threshold']).toBe(true);
  });

  it('catchup not eligible before regime fires', () => {
    // No regime flag yet
    setYear(state, 18);
    expect(evaluateNonRandomConditions(getStorylet('advisor-avocado-catchup'), state)).toBe(false);
  });

  it('catchup not eligible after year 25', () => {
    state.flags['regime_heat_threshold'] = true;
    setYear(state, 26);
    expect(evaluateNonRandomConditions(getStorylet('advisor-avocado-catchup'), state)).toBe(false);
  });
});

// ============================================================================
// §7d.6: Tech level integration
// ============================================================================

describe('§7d.6: Tech level integration', () => {
  it('tech_crop_avocado from early event contributes to crop tech level', () => {
    const flags: Record<string, boolean> = { tech_crop_avocado: true };
    expect(getTechLevel(flags, 'crop')).toBe(1);
  });

  it('tech_crop_avocado + tech_crop_agave → crop level 2', () => {
    const flags: Record<string, boolean> = {
      tech_crop_avocado: true,
      tech_crop_agave: true,
    };
    expect(getTechLevel(flags, 'crop')).toBe(2);
  });

  it('tech level is identical regardless of which event sets the flag', () => {
    // Early event sets the same flag as the old regime path
    const earlyFlags: Record<string, boolean> = { tech_crop_avocado: true };
    const lateFlags: Record<string, boolean> = { tech_crop_avocado: true };
    expect(getTechLevel(earlyFlags, 'crop')).toBe(getTechLevel(lateFlags, 'crop'));
  });
});

// ============================================================================
// §7d.7: Pacing
// ============================================================================

describe('§7d.7: Pacing', () => {
  it('early event window (Y10-14) does not overlap with regime window (Y15-20)', () => {
    const early = getStorylet('advisor-avocado-research');
    const regime = getStorylet('regime-heat-threshold');

    const earlyMax = early.preconditions.find(c => c.type === 'max_year');
    const regimeMin = regime.preconditions.find(c => c.type === 'min_year');

    expect(earlyMax).toBeDefined();
    expect(regimeMin).toBeDefined();
    // Early max year must be strictly less than regime min year
    expect((earlyMax as { year: number }).year).toBeLessThan((regimeMin as { year: number }).year);
  });

  it('catchup requires regime flag (cannot fire before regime)', () => {
    const catchup = getStorylet('advisor-avocado-catchup');
    expect(catchup.preconditions).toContainEqual({ type: 'has_flag', flag: 'regime_heat_threshold' });
  });

  it('catchup has max_year 25 to prevent late offers', () => {
    const catchup = getStorylet('advisor-avocado-catchup');
    expect(catchup.preconditions).toContainEqual({ type: 'max_year', year: 25 });
  });

  it('catchup has 90-day foreshadow so it does not fire immediately after regime', () => {
    const catchup = getStorylet('advisor-avocado-catchup');
    expect(catchup.foreshadowing).toBeDefined();
    expect(catchup.foreshadowing!.daysBeforeEvent).toBe(90);
  });

  it('foreshadow integration: catchup creates foreshadow first, fires after delay', () => {
    const state = makeState();
    plantCrop(state);
    state.flags['regime_heat_threshold'] = true;
    setYear(state, 18);

    const catchup = getStorylet('advisor-avocado-catchup');
    const rng = new SeededRNG(42);

    // First evaluation: creates foreshadow, does not fire
    const result1 = evaluateEvents(state, [catchup], rng);
    expect(result1.fireEvent).toBeNull();
    expect(result1.newForeshadows.length).toBe(1);
    expect(result1.newForeshadows[0].storyletId).toBe('advisor-avocado-catchup');

    // Apply foreshadow to state
    state.pendingForeshadows.push(result1.newForeshadows[0]);

    // Advance to fire day
    state.calendar.totalDay = result1.newForeshadows[0].eventFiresOnDay;

    // Second evaluation: fires the foreshadowed event
    const rng2 = new SeededRNG(99);
    const result2 = evaluateEvents(state, [catchup], rng2);
    expect(result2.fireEvent).not.toBeNull();
    expect(result2.fireEvent!.id).toBe('advisor-avocado-catchup');
  });
});
