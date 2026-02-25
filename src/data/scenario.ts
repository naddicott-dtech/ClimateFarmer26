import type { ClimateScenario, YearClimate, SeasonParams } from '../engine/types.ts';

/**
 * Slice 1 Baseline Scenario — "Gradual Challenge"
 *
 * 30-year climate track for the San Joaquin Valley.
 * Mild-to-moderate difficulty with one dry summer in Year 3.
 * Temperatures gradually warm. Water allocation tightens over time.
 *
 * Real SJV climate context:
 * - Summer highs: 95-105°F, lows: 60-70°F
 * - Winter highs: 55-65°F, lows: 35-45°F
 * - Annual precip: ~10-12 inches, mostly in winter
 * - ET0: 0.15-0.35 inches/day depending on season
 */

function makeSeasonParams(overrides: Partial<SeasonParams> = {}): SeasonParams {
  return {
    avgTempHigh: 75,
    avgTempLow: 50,
    tempVariance: 8,
    precipProbability: 0.05,
    precipIntensity: 0.3,
    avgET0: 0.2,
    heatwaveProbability: 0,
    frostProbability: 0,
    ...overrides,
  };
}

function makeYear(year: number): YearClimate {
  // Gradual warming: +0.1°F per year
  const warmingOffset = (year - 1) * 0.1;
  // Water allocation tightens slightly over decades
  const waterAllocation = Math.max(0.7, 1.0 - (year - 1) * 0.008);

  // Year 3 is the "dry summer" for drama per SPEC
  const isDrySummer = year === 3;
  // Years 10+ get occasional extra heat
  const extraHeat = year >= 10 ? 0.02 : 0;

  // Chill hours decline over 30 years — the core teachable moment for perennials.
  // Almonds need 700, pistachios need 600. By year ~16+, almonds start failing.
  const chillHours =
    year <= 5  ? 800 :
    year <= 15 ? 700 :
    year <= 25 ? 630 :
                 570;

  return {
    year,
    chillHours,
    seasons: {
      spring: makeSeasonParams({
        avgTempHigh: 75 + warmingOffset,
        avgTempLow: 48 + warmingOffset,
        tempVariance: 10,
        precipProbability: 0.12,
        precipIntensity: 0.4,
        avgET0: 0.18,
        frostProbability: year <= 5 ? 0.05 : 0.02, // less frost as climate warms
      }),
      summer: makeSeasonParams({
        avgTempHigh: (isDrySummer ? 102 : 97) + warmingOffset,
        avgTempLow: 63 + warmingOffset,
        tempVariance: 6,
        precipProbability: isDrySummer ? 0.01 : 0.03,
        precipIntensity: 0.2,
        avgET0: isDrySummer ? 0.35 : 0.30,
        heatwaveProbability: isDrySummer ? 0.4 : 0.1 + extraHeat,
      }),
      fall: makeSeasonParams({
        avgTempHigh: 78 + warmingOffset,
        avgTempLow: 50 + warmingOffset,
        tempVariance: 12,
        precipProbability: 0.08,
        precipIntensity: 0.5,
        avgET0: 0.15,
      }),
      winter: makeSeasonParams({
        avgTempHigh: 57 + warmingOffset,
        avgTempLow: 38 + warmingOffset,
        tempVariance: 8,
        precipProbability: 0.20,
        precipIntensity: 0.6,
        avgET0: 0.08,
        frostProbability: year <= 15 ? 0.15 : 0.08,
      }),
    },
    waterAllocation,
  };
}

const years: YearClimate[] = [];
for (let y = 1; y <= 30; y++) {
  years.push(makeYear(y));
}

export const SLICE_1_SCENARIO: ClimateScenario = {
  id: 'slice-1-baseline',
  name: 'Gradual Challenge',
  description: 'A manageable 30-year track with gradual warming and one dry summer early on. Good for learning the basics.',
  seed: 42,
  years,
};
