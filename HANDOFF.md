# HANDOFF.md — Slice 3 Completion Handoff

**Date:** 2026-02-26
**Status:** Slice 3 complete (sub-slices 3a1 + 3a2 + 3b + 3c), all tests passing. Ready for Slice 4 planning.

## What Was Built

### Slice 1 (Complete)
Core farming simulation loop: plant → grow → harvest → economy. 3 annual crops (silage corn, winter wheat, processing tomatoes), 8×8 grid with bulk ops, weather system, soil model, save/load, auto-pause, tutorial.

### Slice 2 (Complete)
Event/storylet engine + loans + 3 climate events (heatwave, water allocation cut, late frost). Perennial crops (almonds, pistachios) with dormancy, chill hours, establishment periods. Extension agent advisor (Dr. Maria Santos, 5 storylets). Emergency loan system. Fog-of-war for chill hours. Save migration V1→V2→V3.

### Slice 3a1: Stretch Events + New Crops
- **2 stretch events:** Tomato Market Surge (price ×1.4 for 60 days) and Groundwater Pumping Ban (comply: 30-day watering restriction, or buy rights: $1,000)
- **2 new crops:** Sorghum (drought-tolerant annual, ky=0.50, $660/acre) and Citrus Navels (evergreen perennial, $4,900/acre, 35-year lifespan, no dormancy/chill)
- **Citrus harvest cadence fix:** `harvestedThisSeason` reset for ALL perennials at year-end (not just dormancy exit)

### Slice 3a2: Perennial Yield Curves
- **3-phase piecewise-linear yield curves:** Ramp (0.6→0.8→1.0) → Peak (1.0) → Decline (→floor)
- **Crop curves:** Almonds (decline year 15, floor 0.2), Pistachios (decline year 17, floor 0.2), Citrus (decline year 28, floor 0.3 — never declines in 30-year game)
- **Decline advisor:** `advisor-orchard-decline` fires when perennials enter decline phase
- **SidePanel UI:** Phase labels (Establishing, Ramping Up, Peak, Declining, Past Prime), years-until-decline countdown

### Slice 3b: Cover Crop System
- **Legume cover crop:** $30/plot, fall planting (months 9-11), spring auto-incorporation (+50N, +0.10% OM, -0.5in moisture)
- **Eligibility:** Empty cells OR deciduous perennials (has `dormantSeasons`). Evergreen citrus rejected.
- **ET rules:** Cover crop replaces bare soil ET (0.2× vs 0.3×). Halts OM decomposition during winter.
- **Bulk ops:** DD-1 pattern (field/row/col scope, partial offers, `executeBulkCoverCrop` engine function)
- **Save migration:** V3→V4 adds `coverCropId: null` to all cells + `frostProtectionEndsDay: 0` to GameState

### Slice 3c: Weather Service Advisor
- **NWS Fresno character:** 3 storylets with confidence language (High/Moderate/Low). `advisorId: 'weather-service'` routes character display in EventPanel.
- **`weather-heat-forecast`** (summer, year 2+, 25%): Pre-irrigate $200 (+1.5 moisture) or Monitor
- **`weather-frost-alert`** (spring, 20%): Deploy frost protection $150 (14-day `frostProtectionEndsDay`) or Wait
- **`weather-drought-outlook`** (spring, year 5+, 15%): Informational — mentions sorghum as drought-tolerant option
- **Frost protection mechanism:** `frostProtectionEndsDay` state field. Active when `totalDay < frostProtectionEndsDay`. Consumed only by late-frost-warning "accept-risk" (0.70→0.85 yield penalty). Full-protection ($300) does NOT consume it. Non-frost events ignore it. Overlapping activations: `max(current, new)`. TopBar shows ice indicator with countdown.
- **Advisor routing:** `advisorId` field on Storylet. All Dr. Santos advisors tagged `'extension-agent'`, weather service tagged `'weather-service'`. EventPanel renders correct character, icon, and subtitle.

### Additional: Playtest Logging + Bug Fixes
- **Playtest logging** (`src/engine/playtest-log.ts`): localStorage-toggled verbose logging for human QA. Captures commands, events, harvests, year-end summaries. `window.__playtestLog` + `window.__exportPlaytestLog()`.
- **#46 fix:** Tomato Market Surge now requires `has_crop: processing-tomatoes` precondition
- **#51 fix:** "Plant Field" bulk buttons now show notification instead of silently failing when no full rows available
- **Frost messaging fix:** Protected frost path shows "Yield reduced by 15% instead of 30%" (not contradictory "30%" message)

## Current Metrics

```
npx tsc -b             # Type-check: clean
npx vitest run         # 451 unit tests, all passing (14 test files)
npx vite build         # 37.80 KB gzipped JS, 4.51 KB CSS
npx playwright test    # 84 browser tests, all passing
SAVE_VERSION           # '4.0.0'
```

## Architecture Quick Reference

```
src/
  engine/          Pure TS, zero UI deps. All game logic.
    types.ts         GameState root type, Command union, CropInstance, constants
    game.ts          createInitialState, processCommand, simulateTick, harvestCell,
                     getPerennialAgeFactor, getPerennialPhase, executeBulkPlant,
                     executeWater, executeBulkCoverCrop, addNotification
    calendar.ts      Day↔calendar conversion (STARTING_DAY=59 = March 1)
    weather.ts       generateDailyWeather, updateExtremeEvents
    rng.ts           Mulberry32 seeded PRNG
    playtest-log.ts  Opt-in verbose logging for human QA
    events/
      types.ts       Storylet (with advisorId), Condition (16 types), Effect (10 types),
                     Choice, Foreshadowing, ActiveEvent, ActiveEffect
      selector.ts    evaluateEvents — precondition checking, weighted selection
      effects.ts     applyEffects — processes all Effect types including activate_frost_protection
  adapter/
    signals.ts       Bridges engine↔UI. _liveState → structuredClone → gameState signal
                     Debug hooks: window.__gameDebug (setCash, setDay, setDebt, triggerEvent, setFlag)
  data/
    crops.ts         7 crop definitions (4 annual + 3 perennial) with yield curves
    cover-crops.ts   Cover crop definitions (legume-cover)
    scenario.ts      30-year climate scenario with chillHours per year
    events.ts        STORYLETS array (3 climate + 2 market/regulatory + 9 advisor events = 14 total)
  save/
    storage.ts       localStorage: auto-save, manual saves, V1→V2→V3→V4 migration chain
  ui/
    components/      Preact components (App, GameScreen, NewGameScreen, TopBar, FarmGrid,
                     FarmCell, SidePanel, CropMenu, AutoPausePanel, NotificationBar,
                     ConfirmDialog, Tutorial, EventPanel)
    styles/          CSS Modules
tests/
  engine/            Unit tests: game, weather, calendar, save, rng, events, chill,
                     advisors, perennials, yieldcurve, covercrop, weather-advisor, slice3a1
  browser/           Playwright specs (game.spec.ts — 84 tests)
```

## Key Implementation Details for Next Session

### Crop Roster (7 crops)
| Crop | Type | Revenue/acre | Key trait |
|------|------|-------------|-----------|
| Silage Corn | Annual | $1,650 | Standard warm-season |
| Winter Wheat | Annual | $510 | Winter crop, light feeder |
| Processing Tomatoes | Annual | $3,600 | High revenue, water-hungry |
| Sorghum | Annual | $660 | Drought-tolerant (ky=0.50) |
| Almonds | Perennial | $6,250 peak | High chill needs (700hr), declines year 15 |
| Pistachios | Perennial | $4,800 peak | Lower chill (600hr), declines year 17 |
| Citrus Navels | Perennial | $4,900 | Evergreen, no chill, no decline in 30yr |

### Event System (14 storylets)
- **3 climate:** heatwave-advisory, water-allocation-cut, late-frost-warning (all have foreshadowing)
- **2 market/regulatory:** tomato-market-surge (no foreshadowing), groundwater-pumping-ban (no foreshadowing)
- **6 Dr. Santos advisors:** soil-nitrogen, crop-failure, chill-warning, drought-recovery, perennial-opportunity, orchard-decline
- **3 Weather Service advisors:** heat-forecast, frost-alert, drought-outlook

### Frost Protection Flow
1. `weather-frost-alert` fires → player chooses "Deploy Protection" ($150)
2. `activate_frost_protection` effect sets `frostProtectionEndsDay = totalDay + 14`
3. TopBar shows "Frost Protection (Xd)" indicator
4. If `late-frost-warning` fires during window and player chooses "Accept the Risk":
   - `applyFrostProtection()` replaces 0.70 multiplier with 0.85, replaces notification text
   - Consumes protection (`frostProtectionEndsDay = 0`)
5. If player pays $300 for full frost protection: weather protection NOT consumed
6. Protection expires naturally when `totalDay >= frostProtectionEndsDay`

### Save Migration Chain
- V4 (current, `'4.0.0'`): Full validation via `validateSave()`
- V3→V4: `migrateV3ToV4()` — adds `coverCropId: null` to all cells + `frostProtectionEndsDay: 0`
- V2→V3: adds `chillHoursAccumulated: 0` to all crop instances
- V1→V2: fills event system fields + perennial fields
- Both `readSave()` and `listManualSaves()` use the full migration chain

### Adapter Debug Hooks (for Playwright tests)
`window.__gameDebug` exposes: `setCash()`, `setDay()`, `setDebt()`, `setTotalLoansReceived()`, `setFlag()`, `triggerEvent()`, `getState()`. Test-only — does not resync RNG or resimulate.

## Open Issues & Priorities for Slice 4

### PRE-CLASSROOM RELEASE BLOCKER
- **#45: Economy too lenient** — Almond monoculture finished 30 years at $404k. Requires headless automated balance testing (ARCHITECTURE.md §12 Layer 2). Systematic tuning, NOT hand-tuning.

### Known UX bugs (deferred from playtesting)
- **#52:** Water Warning "Water Field" chains into redundant second confirmation dialog
- **#53:** Year-end expenses don't break down categories (maintenance costs invisible)
- **#54:** Calendar display lag after "Continue to Year 2"
- **#55:** Row/Column plant buttons don't show per-plot cost
- **#47:** Event clustering feels spammy (multiple events per season)
- **#48:** Perennial re-harvest confusion (no visual indicator when already harvested)
- **#49:** Cover crop/soil health pedagogy not landing (OM decline invisible)
- **#50:** Pause-to-play transition not intuitive

### Deferred Features → Slice 4+
- **Balance testing suite** — Headless automated strategy tests (monoculture, diversified, zero-irrigation, max-debt). BLOCKER prerequisite for classroom deployment.
- **Economic rebalancing** — Data-driven tuning from balance test results
- **Event system tuning** — Per-season event cap, mutual exclusion groups
- **Tech tree** — Fog-of-war event-driven tech unlocks (ARCHITECTURE.md §5.4)
- **Remaining advisors** — Financial Advisor/Banker, Farming Community
- **Insurance / credit systems** — Credit rating, variable loan rates, insurance premiums
- **K + Zn nutrients** — Only nitrogen is modeled
- **Additional crops** — Grapes, Stone Fruit, Agave, Heat-tolerant Avocados, Opuntia, Guayule
- **Additional climate scenarios** — Only 1 scenario exists. Need 5-8 for classroom use
- **Automation policies** — Replant-same, harvest-when-ready, water-when-dry. Unlocked via tech tree
- **Glossary / Information Index** — In-game educational reference
- **Solar lease event chain** — Multi-phase storylet
- **Completion code + Google Form** — End-of-game reporting
- **Year-end expense breakdown** — Show planting, watering, maintenance, loan repayment line items

### Accepted Limitations
- **Deep save validation** — Nested field tampering not caught (acceptable for classroom)
- **Single scenario** — Students all play the same climate track until more scenarios are added

## Verification Commands

```bash
npx tsc -b                    # Type-check (must be clean)
npx vitest run                # 451 unit tests
npx vite build                # Production build (<200KB gzipped)
npx playwright test           # 84 browser tests (builds first)
npm run test:all              # All tests in sequence
```
