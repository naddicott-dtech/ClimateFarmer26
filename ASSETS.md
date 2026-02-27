# Asset Manifest — ClimateFarmer26

All visual assets for the game. This file is the single source of truth for what art is needed, where it goes, and its status.

## Naming Convention

`{asset-id}_{width}x{height}.png`

Example: `extension-agent_128x128.png`

This embeds the target pixel dimensions in the filename so artists know exactly what size to produce. All assets use PNG with transparent backgrounds unless noted otherwise.

## Performance Budget

Target hardware is Chromebooks. Keep total asset payload under 500KB. Individual images should be optimized PNGs (use TinyPNG or similar before committing).

## Advisor Portraits

Displayed in the EventPanel when advisor-type events fire. Mapped by `advisorId` in code with fallback to `default_128x128.png`.

| Asset ID | File Path | Dimensions | Used In | Status | Notes |
|----------|-----------|------------|---------|--------|-------|
| `extension-agent` | `public/assets/advisors/extension-agent_128x128.png` | 128x128 | EventPanel (Dr. Elena Santos) | Placeholder | Agricultural extension agent. Warm, approachable. |
| `weather-service` | `public/assets/advisors/weather-service_128x128.png` | 128x128 | EventPanel (NWS Fresno) | Placeholder | Weather forecaster. Professional, could be a logo or person. |
| `default` | `public/assets/advisors/default_128x128.png` | 128x128 | EventPanel (fallback) | Placeholder | Generic advisor silhouette. Used when advisorId has no matching portrait. |

### Advisor Portrait Spec

- **Size:** 128x128 pixels (renders at 64x64 CSS pixels for retina sharpness)
- **Background:** Transparent PNG
- **Style:** Friendly, approachable — these are educational characters for high school students
- **Framing:** Head and shoulders, centered
- **File size target:** Under 20KB each

## Crop Icons (Future — Slice 4 Visual Pass)

Small icons for the crop menu and farm grid cells. Not yet needed.

| Asset ID | File Path | Dimensions | Used In | Status | Notes |
|----------|-----------|------------|---------|--------|-------|
| `crop-tomatoes` | `public/assets/crops/crop-tomatoes_48x48.png` | 48x48 | CropMenu, FarmCell | Not started | Processing tomatoes |
| `crop-corn` | `public/assets/crops/crop-corn_48x48.png` | 48x48 | CropMenu, FarmCell | Not started | Silage corn |
| `crop-wheat` | `public/assets/crops/crop-wheat_48x48.png` | 48x48 | CropMenu, FarmCell | Not started | Winter wheat |
| `crop-sorghum` | `public/assets/crops/crop-sorghum_48x48.png` | 48x48 | CropMenu, FarmCell | Not started | Sorghum |
| `crop-almonds` | `public/assets/crops/crop-almonds_48x48.png` | 48x48 | CropMenu, FarmCell | Not started | Almonds (tree) |
| `crop-pistachios` | `public/assets/crops/crop-pistachios_48x48.png` | 48x48 | CropMenu, FarmCell | Not started | Pistachios (tree) |
| `crop-citrus` | `public/assets/crops/crop-citrus_48x48.png` | 48x48 | CropMenu, FarmCell | Not started | Citrus navels (tree) |

## UI Icons (Future)

| Asset ID | File Path | Dimensions | Used In | Status | Notes |
|----------|-----------|------------|---------|--------|-------|
| (none yet) | | | | | |

## Implementation Contract (for Sub-slice 3c)

When implementing advisor portraits in the EventPanel:

1. Add `advisorId` field to Storylet type (optional, for advisor-type events)
2. Map `advisorId` to portrait path: `advisorId -> /assets/advisors/${advisorId}_128x128.png`
3. Fallback chain: specific portrait -> `default_128x128.png` -> text-only (no broken images)
4. Render `<img>` with `data-testid="advisor-portrait"`, `alt` text describing the advisor
5. Browser tests: verify `<img>` loads for advisor events, verify alt text is accessible
6. Keep text-first UI intact — portraits enhance but don't replace the text content

## Style Guide
  Create a single game-ready 2D digital illustration asset for an educational farming strategy game set in California’s San Joaquin Valley.

  SHARED STYLE GUIDE:
  Stylized semi-realistic look with warmth and personality. Painterly forms, clean readable silhouette, subtle hand-crafted texture, approachable for high school
  students. Grounded and optimistic tone.
  Palette direction: sun-baked earth (#A97142), wheat gold (#D8B45A), irrigation blue (#4A90B8), leaf green (#6FA35B), sky haze (#C9DCE8), orchard dark (#2F5D3A),
  accent orange (#E38B3A).
  Lighting: soft daylight, gentle directional light, mild contrast, no harsh dramatic shadows.
  Composition: one clear centered subject, high readability at small size.
  Hard constraints: transparent background, no scene background, no text, no letters, no logos, no watermark, no frame, no UI elements.

## Source & License

| Asset | Source | License | Attribution Required |
|-------|--------|---------|---------------------|
| Placeholder PNG | Project team | Internal use | No |
| (student contributions) | Student artists | (TBD — get written consent) | Yes — credit in-game or README |

### Student Art Contributions

If students create art for the game:
- Get written consent (school policy) before including any student work
- Credit the artist by name (or initials if preferred) in README.md
- Ensure art meets the dimension and transparency specs above
- Optimize PNGs before committing (TinyPNG, pngquant, etc.)
