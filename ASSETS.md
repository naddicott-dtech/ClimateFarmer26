# Asset Manifest — ClimateFarmer26

All visual assets for the game. This file is the single source of truth for what art is needed, where it goes, and its status.

## Naming Convention

`{asset-id}_{width}x{height}.jpeg`

Example: `extension-agent_128x128.jpeg`

This embeds the target pixel dimensions in the filename so artists know exactly what size to produce.

## Performance Budget

Target hardware is Chromebooks. Keep total asset payload under 2MB. Individual images should be optimized before committing.

## Advisor Portraits

Displayed in the EventPanel when advisor-type events fire. Mapped by `advisorId` in code via `ADVISOR_CHARACTERS` in `src/ui/components/EventPanel.tsx`.

| Asset ID | File Path | Dimensions | Used In | Status | Notes |
|----------|-----------|------------|---------|--------|-------|
| `extension-agent` | `public/assets/advisors/extension-agent_128x128.jpeg` | 128x128 | EventPanel (Dr. Maria Santos) | Complete | Agricultural extension agent. Warm, approachable. |
| `weather-service` | `public/assets/advisors/weather-service_128x128.jpeg` | 128x128 | EventPanel (NWS Fresno) | Complete | Weather forecaster. Professional. |
| `default` | `public/assets/advisors/default_128x128.jpeg` | 128x128 | EventPanel (fallback) | Complete | Generic advisor silhouette. Used when advisorId has no matching portrait. |

### Advisor Portrait Spec

- **Size:** 128x128 pixels (renders at 64x64 CSS pixels for retina sharpness)
- **Style:** Friendly, approachable — these are educational characters for high school students
- **Framing:** Head and shoulders, centered
- **Rendering:** Rendered as `<img>` with `data-testid="advisor-portrait"`, circular crop via CSS `border-radius: 50%`

## Crop Icons

Small icons shown on farm grid cells at harvestable/overripe growth stages. Earlier growth stages use emoji. Mapped via `CROP_ART` in `src/ui/components/FarmCell.tsx`.

| Asset ID | File Path | Dimensions | Used In | Status | Notes |
|----------|-----------|------------|---------|--------|-------|
| `crop-tomatoes` | `public/assets/crops/crop-tomatoes_48x48.jpeg` | 48x48 | FarmCell (harvestable/overripe) | Complete | Processing tomatoes |
| `crop-corn` | `public/assets/crops/crop-corn_48x48.jpeg` | 48x48 | FarmCell (harvestable/overripe) | Complete | Silage corn |
| `crop-wheat` | `public/assets/crops/crop-wheat_48x48.jpeg` | 48x48 | FarmCell (harvestable/overripe) | Complete | Winter wheat |
| `crop-sorghum` | `public/assets/crops/crop-sorghum_48x48.jpeg` | 48x48 | FarmCell (harvestable/overripe) | Complete | Sorghum |
| `crop-almonds` | `public/assets/crops/crop-almonds_48x48.jpeg` | 48x48 | FarmCell (harvestable/overripe) | Complete | Almonds (tree) |
| `crop-pistachios` | `public/assets/crops/crop-pistachios_48x48.jpeg` | 48x48 | FarmCell (harvestable/overripe) | Complete | Pistachios (tree) |
| `crop-citrus` | `public/assets/crops/crop-citrus_48x48.jpeg` | 48x48 | FarmCell (harvestable/overripe) | Complete | Citrus navels (tree) |

## UI Icons (Future)

| Asset ID | File Path | Dimensions | Used In | Status | Notes |
|----------|-----------|------------|---------|--------|-------|
| (none yet) | | | | | |

## Source & License

| Asset | Source | License | Attribution Required |
|-------|--------|---------|---------------------|
| Advisor portraits | Neal Addicott using Nano Banana Pro | Project use | Yes |
| Crop icons | Neal Addicott using Nano Banana Pro | Project use | Yes |
| (student contributions) | Student artists | (TBD — get written consent) | Yes — credit in-game or README |

## Prompting information
  Sources used:

  - https://ai.google.dev/gemini-api/docs/image-generation
  - https://ai.google.dev/gemini-api/docs/imagen
  - https://firebase.google.com/docs/ai-logic/prompt-design
  - https://ai.google.dev/gemini-api/docs/prompting-strategies

  Prompt (shared element):
    Create a single game-ready 2D digital illustration asset for an educational farming strategy game set in California’s San Joaquin Valley.

  SHARED STYLE GUIDE:
  Stylized semi-realistic look with warmth and personality. Painterly forms, clean readable silhouette, subtle hand-crafted texture, approachable for high school
  students. Grounded and optimistic tone.
  Palette direction: sun-baked earth (#A97142), wheat gold (#D8B45A), irrigation blue (#4A90B8), leaf green (#6FA35B), sky haze (#C9DCE8), orchard dark (#2F5D3A),
  accent orange (#E38B3A).
  Lighting: soft daylight, gentle directional light, mild contrast, no harsh dramatic shadows.
  Composition: one clear centered subject, high readability at small size.
  Hard constraints: transparent background, no scene background, no text, no letters, no logos, no watermark, no frame, no UI elements.

  Example specific prompt:
    ASSET-SPECIFIC:
  Head-and-shoulders portrait of a friendly agricultural extension advisor (Latina woman, late 30s to early 40s), calm confident smile, practical field jacket over
  collared shirt, slight clipboard edge visible.
  Expression should feel approachable and trustworthy, professional but not corporate.
  Face should occupy about 65% of the canvas, centered.
  Output as square icon art intended for 128x128.

### Student Art Contributions

If students create art for the game:
- Get written consent (school policy) before including any student work
- Credit the artist by name (or initials if preferred) in README.md
- Ensure art meets the dimension specs above
