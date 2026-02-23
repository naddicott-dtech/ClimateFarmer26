import type { CropDefinition } from '../engine/types.ts';

/**
 * Slice 1 crops: 3 annuals for the San Joaquin Valley.
 *
 * Data grounded in real California agriculture:
 * - Processing Tomatoes: High-value, heavy nitrogen feeder, warm-season
 * - Silage Corn: Reliable, moderate water/N needs, warm-season
 * - Winter Wheat: Cool-season, lower water use, gives students a rotation option
 *
 * Yield and price values are simplified for gameplay but proportionally realistic.
 */
export const CROPS: Record<string, CropDefinition> = {
  'processing-tomatoes': {
    id: 'processing-tomatoes',
    name: 'Processing Tomatoes',
    type: 'annual',

    gddBase: 50,           // °F base temp
    gddToMaturity: 2500,   // ~120 days in SJV summer
    plantingWindow: { startMonth: 3, endMonth: 5 }, // March–May

    waterUsePerDay: 0.25,  // inches/day at peak
    cropCoefficients: [
      { stage: 'seedling', kc: 0.3 },
      { stage: 'vegetative', kc: 0.7 },
      { stage: 'flowering', kc: 1.1 },
      { stage: 'mature', kc: 0.9 },
      { stage: 'harvestable', kc: 0.5 },
      { stage: 'overripe', kc: 0.3 },
    ],
    ky: 1.05,              // sensitive to water stress

    nitrogenUptake: 200,   // lbs/acre — heavy feeder

    yieldPotential: 45,    // tons/acre
    yieldUnit: 'tons',
    basePrice: 80,         // $/ton
    seedCostPerAcre: 150,
    laborCostPerAcre: 200,

    shortDescription: 'High-value warm-season crop. Heavy nitrogen feeder — depletes soil fast without rotation.',
  },

  'silage-corn': {
    id: 'silage-corn',
    name: 'Silage Corn',
    type: 'annual',

    gddBase: 50,
    gddToMaturity: 2700,   // ~130 days
    plantingWindow: { startMonth: 3, endMonth: 5 },

    waterUsePerDay: 0.22,
    cropCoefficients: [
      { stage: 'seedling', kc: 0.3 },
      { stage: 'vegetative', kc: 0.8 },
      { stage: 'flowering', kc: 1.15 },
      { stage: 'mature', kc: 0.85 },
      { stage: 'harvestable', kc: 0.4 },
      { stage: 'overripe', kc: 0.2 },
    ],
    ky: 0.9,               // moderate water sensitivity

    nitrogenUptake: 150,   // lbs/acre — moderate feeder

    yieldPotential: 30,    // tons/acre
    yieldUnit: 'tons',
    basePrice: 55,         // $/ton
    seedCostPerAcre: 100,
    laborCostPerAcre: 80,

    shortDescription: 'Reliable feed crop. Moderate water and nitrogen needs. Good rotation partner for tomatoes.',
  },

  'winter-wheat': {
    id: 'winter-wheat',
    name: 'Winter Wheat',
    type: 'annual',

    gddBase: 40,           // lower base temp — grows in cool weather
    gddToMaturity: 2000,   // ~180 days (slow, cool-season growth)
    plantingWindow: { startMonth: 10, endMonth: 11 }, // October–November

    waterUsePerDay: 0.15,  // lower water needs
    cropCoefficients: [
      { stage: 'seedling', kc: 0.3 },
      { stage: 'vegetative', kc: 0.6 },
      { stage: 'flowering', kc: 1.0 },
      { stage: 'mature', kc: 0.7 },
      { stage: 'harvestable', kc: 0.3 },
      { stage: 'overripe', kc: 0.15 },
    ],
    ky: 0.65,              // drought-tolerant

    nitrogenUptake: 80,    // lbs/acre — light feeder

    yieldPotential: 80,    // bushels/acre
    yieldUnit: 'bu',
    basePrice: 7,          // $/bushel
    seedCostPerAcre: 50,
    laborCostPerAcre: 40,

    shortDescription: 'Cool-season grain. Low water needs, light on soil. Plant in fall, harvest in spring.',
  },
};

export function getCropDefinition(cropId: string): CropDefinition {
  const crop = CROPS[cropId];
  if (!crop) {
    throw new Error(`Unknown crop ID: "${cropId}". Valid IDs: ${Object.keys(CROPS).join(', ')}`);
  }
  return crop;
}

export function getAllCropIds(): string[] {
  return Object.keys(CROPS);
}
