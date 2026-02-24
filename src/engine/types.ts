// ============================================================================
// Core Engine Types — ClimateFarmer26
// All game state types. Pure data, no logic. Serializable for save/load.
// ============================================================================

import type {
  ActiveEvent, EventOccurrence, ActiveEffect, PendingForeshadow,
} from './events/types.ts';

// --- Calendar ---

export type Season = 'spring' | 'summer' | 'fall' | 'winter';

export interface CalendarDate {
  day: number;        // 1-365 within the year
  month: number;      // 1-12
  season: Season;
  year: number;       // 1-30
  totalDay: number;   // absolute day since game start (0-indexed, used by engine)
}

// --- Commands ---

export type Command =
  | { type: 'PLANT_CROP'; cellRow: number; cellCol: number; cropId: string }
  | { type: 'PLANT_BULK'; scope: 'all' | 'row' | 'col'; index?: number; cropId: string }
  | { type: 'HARVEST'; cellRow: number; cellCol: number }
  | { type: 'HARVEST_BULK'; scope: 'all' | 'row' | 'col'; index?: number }
  | { type: 'WATER'; scope: 'all' | 'row' | 'col'; index?: number }
  | { type: 'SET_SPEED'; speed: GameSpeed }
  // Slice 2a: Event system + loans
  | { type: 'RESPOND_EVENT'; eventId: string; choiceId: string }
  | { type: 'TAKE_LOAN' }  // parameterless — amount is engine-computed
  // Slice 2b: Perennial removal
  | { type: 'REMOVE_CROP'; cellRow: number; cellCol: number };

export type GameSpeed = 0 | 1 | 2 | 4;

export interface CommandResult {
  success: boolean;
  reason?: string;
  /** For bulk ops: how many cells were affected */
  cellsAffected?: number;
  /** For harvest: total revenue earned */
  revenue?: number;
  /** For plant/water: total cost */
  cost?: number;
  /** For partial bulk ops: dialog info */
  partialOffer?: {
    affordableRows: number;
    affordablePlots: number;
    totalCost: number;
  };
}

// --- Climate Scenario ---

export interface SeasonParams {
  avgTempHigh: number;        // °F
  avgTempLow: number;         // °F
  tempVariance: number;       // daily deviation range in °F
  precipProbability: number;  // 0-1 chance of rain per day
  precipIntensity: number;    // inches when it rains
  avgET0: number;             // reference evapotranspiration (inches/day)
  heatwaveProbability: number;// 0-1 chance of multi-day heat event per season
  frostProbability: number;   // 0-1 chance of frost event per season
}

export interface YearClimate {
  year: number;
  seasons: {
    spring: SeasonParams;
    summer: SeasonParams;
    fall: SeasonParams;
    winter: SeasonParams;
  };
  waterAllocation: number;    // 0-1 fraction of normal allocation (future: caps irrigation availability)
}

export interface ClimateScenario {
  id: string;
  name: string;
  description: string;
  seed: number;
  years: YearClimate[];       // 30 entries
}

// --- Daily Weather (generated from scenario params) ---

export interface DailyWeather {
  tempHigh: number;           // °F
  tempLow: number;            // °F
  precipitation: number;      // inches
  et0: number;                // reference evapotranspiration
  isHeatwave: boolean;
  isFrost: boolean;
}

// --- Crop Definitions ---

export interface CropDefinition {
  id: string;
  name: string;
  type: 'annual' | 'perennial';

  // Growth
  gddBase: number;            // base temperature °F for GDD calculation
  gddToMaturity: number;      // cumulative GDD needed to reach harvestable
  plantingWindow: { startMonth: number; endMonth: number };

  // Water
  waterUsePerDay: number;     // inches/day at peak Kc
  cropCoefficients: { stage: GrowthStage; kc: number }[];
  ky: number;                 // yield response to water stress

  // Nutrients
  nitrogenUptake: number;     // lbs/acre removed at full yield

  // Economics
  yieldPotential: number;     // units/acre at maximum
  yieldUnit: string;          // e.g., "tons", "bu"
  basePrice: number;          // $/unit
  seedCostPerAcre: number;
  laborCostPerAcre: number;

  // Perennial-only fields (undefined for annuals)
  yearsToEstablish?: number;          // almonds: 3, pistachios: 4
  removalCost?: number;               // cost to clear a perennial from a cell
  annualMaintenanceCost?: number;     // deducted at year-end per perennial cell
  dormantSeasons?: Season[];          // seasons where crop goes dormant (typically ['winter'])
  productiveLifespan?: number;        // display only in 2b (almonds: 22, pistachios: 25)
  chillHoursRequired?: number;        // data placeholder — NOT used until 2c

  // Display
  shortDescription: string;
}

export type GrowthStage = 'seedling' | 'vegetative' | 'flowering' | 'mature' | 'harvestable' | 'overripe';

// --- Farm Grid ---

export interface CropInstance {
  cropId: string;
  plantedDay: number;         // totalDay when planted
  gddAccumulated: number;
  waterStressDays: number;
  growthStage: GrowthStage;
  overripeDaysRemaining: number; // 30 → 0, then crop rots. -1 means not overripe.
  // Slice 2b: Perennial tracking (defaults to false/0 for annuals)
  isPerennial: boolean;
  perennialAge: number;
  perennialEstablished: boolean;
  isDormant: boolean;
  harvestedThisSeason: boolean;
}

export interface SoilState {
  nitrogen: number;           // lbs/acre
  organicMatter: number;      // percentage (e.g., 2.0)
  moisture: number;           // inches
  moistureCapacity: number;   // max inches (function of OM)
}

export interface Cell {
  row: number;
  col: number;
  crop: CropInstance | null;
  soil: SoilState;
}

// --- Economy ---

export interface EconomyState {
  cash: number;
  yearlyRevenue: number;
  yearlyExpenses: number;
  // Slice 2a: Loan system
  debt: number;
  totalLoansReceived: number; // 0 or 1 (max 1 in Slice 2)
  interestPaidThisYear: number;
}

// --- Notifications ---

export type NotificationType =
  | 'info'
  | 'harvest'
  | 'season_change'
  | 'year_end'
  | 'water_warning'
  | 'nitrogen_warning'
  | 'crop_rotted'
  | 'bankruptcy'
  // Slice 2a
  | 'foreshadowing'
  | 'event_result'
  | 'loan';

export interface Notification {
  id: number;
  type: NotificationType;
  message: string;
  day: number;                // totalDay when generated
}

// --- Auto-Pause ---

export type AutoPauseReason =
  | 'harvest_ready'
  | 'water_stress'
  | 'bankruptcy'
  | 'year_end'
  | 'year_30'
  // Slice 2a
  | 'loan_offer'
  | 'event'
  | 'advisor';

export interface AutoPauseEvent {
  reason: AutoPauseReason;
  message: string;
  data?: Record<string, unknown>;
}

/** Priority for auto-pause events. Higher = more urgent = shown first. */
export const AUTO_PAUSE_PRIORITY: Record<AutoPauseReason, number> = {
  bankruptcy: 100,
  year_30: 100,
  loan_offer: 95,
  event: 85,
  advisor: 82,
  harvest_ready: 80,
  water_stress: 60,
  year_end: 40,
};

// --- Full Game State ---

export interface GameState {
  calendar: CalendarDate;
  speed: GameSpeed;
  grid: Cell[][];             // 8x8 — grid[row][col]
  economy: EconomyState;
  notifications: Notification[];
  autoPauseQueue: AutoPauseEvent[];
  playerId: string;
  scenarioId: string;
  rngState: number;           // for save/resume determinism
  waterStressPausedThisSeason: boolean; // DD-5: only auto-pause once per season
  activeHeatwaveDays: number; // remaining days of current heatwave event (0 = none)
  activeFrostDays: number;    // remaining days of current frost event (0 = none)
  nextNotificationId: number;
  gameOver: boolean;
  gameOverReason?: string;
  yearEndSummaryPending: boolean;
  // Slice 2a: Event system
  eventLog: EventOccurrence[];
  activeEvent: ActiveEvent | null;
  pendingForeshadows: PendingForeshadow[];
  activeEffects: ActiveEffect[];
  cropFailureStreak: number;
  flags: Record<string, boolean>;
  wateringRestricted: boolean;
  wateringRestrictionEndsDay: number;
  irrigationCostMultiplier: number;
  eventRngState: number;      // separate RNG for events (seeded from mainSeed + 10000)
}

// --- Save/Load ---

export interface SaveGame {
  version: string;
  state: GameState;
  timestamp: number;
}

// --- Constants ---

export const GRID_ROWS = 8;
export const GRID_COLS = 8;
export const MAX_YEARS = 30;
export const DAYS_PER_YEAR = 365;
export const OVERRIPE_GRACE_DAYS = 30;
export const STARTING_CASH = 50_000;
export const STARTING_NITROGEN = 100;
export const STARTING_ORGANIC_MATTER = 2.0;
export const STARTING_MOISTURE = 4.0;
export const BASE_MOISTURE_CAPACITY = 6.0;
export const OM_MOISTURE_BONUS_PER_PERCENT = 0.8; // inches per 1% OM
export const WATER_STRESS_AUTOPAUSE_THRESHOLD = 0.25; // 25% of capacity
export const WATER_VISUAL_WARNING_THRESHOLD = 0.30;
export const WATER_WILTING_THRESHOLD = 0.15;
export const NITROGEN_HIGH_THRESHOLD = 80;
export const NITROGEN_MODERATE_THRESHOLD = 40;
export const IRRIGATION_COST_PER_CELL = 5; // $ per cell per watering
export const WATER_DOSE_INCHES = 3.0; // inches per watering action (~14 days worth at typical ET)
export const STARTING_DAY = 59; // March 1 (0-indexed totalDay) — Spring start per SPEC
export const SAVE_VERSION = '2.0.0';

// Loan constants
export const LOAN_INTEREST_RATE = 0.10; // 10% annual
export const LOAN_REPAYMENT_FRACTION = 0.20; // 20% of gross harvest revenue
export const LOAN_DEBT_CAP = 100_000; // debt > this = game over
export const EVENT_RNG_SEED_OFFSET = 10_000; // event RNG = mainSeed + this
