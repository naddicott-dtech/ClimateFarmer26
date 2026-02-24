import type { DailyWeather, ClimateScenario, Season } from './types.ts';
import { totalDayToCalendar } from './calendar.ts';
import type { SeededRNG } from './rng.ts';

/**
 * Generate base daily weather from seasonal parameters + seeded RNG.
 *
 * IMPORTANT: This function is stateful — each call consumes RNG values.
 * It must be called exactly once per day in tick order. Calling it twice
 * for the same day with the same RNG will produce different results and
 * corrupt the deterministic sequence. The game loop in simulateTick is
 * the only authorized caller.
 *
 * Extreme events (heatwave/frost) are multi-day phenomena managed by
 * updateExtremeEvents(), not by this function. The isHeatwave/isFrost
 * flags on the returned weather are set to false here and overlaid
 * by the event system.
 */
export function generateDailyWeather(
  scenario: ClimateScenario,
  totalDay: number,
  rng: SeededRNG,
): DailyWeather {
  const cal = totalDayToCalendar(totalDay);
  const yearIndex = cal.year - 1;

  if (yearIndex < 0 || yearIndex >= scenario.years.length) {
    throw new Error(`No climate data for year ${cal.year} (totalDay ${totalDay})`);
  }

  const yearClimate = scenario.years[yearIndex];
  const params = yearClimate.seasons[cal.season as Season];

  // Temperature: base + random variance
  const tempHighVariance = (rng.next() - 0.5) * 2 * params.tempVariance;
  const tempLowVariance = (rng.next() - 0.5) * 2 * params.tempVariance;
  const tempHigh = params.avgTempHigh + tempHighVariance;
  const tempLow = Math.min(params.avgTempLow + tempLowVariance, tempHigh - 5); // Low must be < high

  // Precipitation
  const hasRain = rng.chance(params.precipProbability);
  const precipitation = hasRain
    ? params.precipIntensity * (0.5 + rng.next()) // 50-150% of base intensity
    : 0;

  // ET0: slight daily variance
  const et0 = params.avgET0 * (0.85 + rng.next() * 0.3); // 85-115% of average

  return {
    tempHigh,
    tempLow,
    precipitation,
    et0,
    isHeatwave: false, // Set by updateExtremeEvents()
    isFrost: false,     // Set by updateExtremeEvents()
  };
}

/** Heatwave/frost event durations (days) */
const EVENT_MIN_DAYS = 3;
const EVENT_MAX_DAYS = 5;
const DAYS_PER_SEASON = 90;

/**
 * Convert a per-season probability to a per-day probability.
 * Solves: 1 - (1 - dailyP)^90 = seasonP  →  dailyP = 1 - (1 - seasonP)^(1/90)
 */
function seasonalToDaily(seasonP: number): number {
  if (seasonP <= 0) return 0;
  if (seasonP >= 1) return 1;
  return 1 - Math.pow(1 - seasonP, 1 / DAYS_PER_SEASON);
}

/** The subset of game state that extreme event tracking needs. */
export interface ExtremeEventState {
  activeHeatwaveDays: number;
  activeFrostDays: number;
}

/**
 * Roll for new extreme events and manage active event countdowns.
 * Modifies both the weather (adds temperature effects) and the event state
 * (tracks remaining event days). Must be called once per tick after
 * generateDailyWeather.
 */
export function updateExtremeEvents(
  state: ExtremeEventState,
  weather: DailyWeather,
  scenario: ClimateScenario,
  totalDay: number,
  rng: SeededRNG,
): void {
  const cal = totalDayToCalendar(totalDay);
  const yearIndex = cal.year - 1;
  const params = scenario.years[yearIndex].seasons[cal.season as Season];

  // --- Heatwave ---
  if (state.activeHeatwaveDays > 0) {
    // Continue existing heatwave
    state.activeHeatwaveDays--;
    weather.isHeatwave = true;
    weather.tempHigh += 10; // Heatwave adds 10°F
  } else {
    // Roll for new heatwave. Convert per-season probability to per-day:
    // dailyP = 1 - (1 - seasonP)^(1/90) so that (1-dailyP)^90 = 1-seasonP
    const dailyChance = seasonalToDaily(params.heatwaveProbability);
    if (rng.chance(dailyChance)) {
      const duration = rng.nextInt(EVENT_MIN_DAYS, EVENT_MAX_DAYS);
      state.activeHeatwaveDays = duration - 1; // -1 because today counts
      weather.isHeatwave = true;
      weather.tempHigh += 10;
    }
  }

  // --- Frost ---
  if (state.activeFrostDays > 0) {
    // Continue existing frost
    state.activeFrostDays--;
    weather.isFrost = true;
    weather.tempLow = Math.min(weather.tempLow, 32); // Frost forces low to ≤32
  } else {
    // Roll for new frost start
    const dailyChance = seasonalToDaily(params.frostProbability);
    if (rng.chance(dailyChance)) {
      const duration = rng.nextInt(EVENT_MIN_DAYS, EVENT_MAX_DAYS);
      state.activeFrostDays = duration - 1;
      weather.isFrost = true;
      weather.tempLow = Math.min(weather.tempLow, 32);
    }
  }
}
