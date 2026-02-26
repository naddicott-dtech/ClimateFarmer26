// ============================================================================
// Cover Crop Definitions — ClimateFarmer26 Slice 3b
// ============================================================================

export interface CoverCropDefinition {
  id: string;
  name: string;
  seedCostPerAcre: number;
  nitrogenFixation: number;    // lbs/acre at incorporation
  organicMatterBonus: number;  // percentage points at incorporation
  moistureDrawdown: number;    // inches lost at incorporation (tradeoff)
  winterETMultiplier: number;  // replaces bare-soil 0.3 ET
  shortDescription: string;
}

export const COVER_CROPS: Record<string, CoverCropDefinition> = {
  'legume-cover': {
    id: 'legume-cover',
    name: 'Clover/Vetch Mix',
    seedCostPerAcre: 30,
    nitrogenFixation: 50,
    organicMatterBonus: 0.10,
    moistureDrawdown: 0.5,
    winterETMultiplier: 0.2,
    shortDescription: 'Nitrogen-fixing legume mix. Costs $30/plot, adds +50 lbs/ac N and +0.10% OM at spring incorporation. Draws down 0.5in moisture.',
  },
};

export function getCoverCropDefinition(coverCropId: string): CoverCropDefinition {
  const def = COVER_CROPS[coverCropId];
  if (!def) {
    throw new Error(`Unknown cover crop ID: "${coverCropId}". Valid IDs: ${Object.keys(COVER_CROPS).join(', ')}`);
  }
  return def;
}
