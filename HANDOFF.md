# HANDOFF.md — Slice 2 Completion Handoff

**Date:** 2026-02-25
**Status:** Slice 2 complete (sub-slices 2a + 2b + 2c), all tests passing. Ready for Slice 3 planning.

## What Was Built

### Slice 1 (Complete — reviewed 3 rounds)
Core farming simulation loop: plant → grow → harvest → economy. 3 annual crops, 8×8 grid with bulk ops, weather system, soil model, save/load, auto-pause, tutorial. See git history for details.

### Slice 2a: Event Engine + Loans + 3 Climate Events
- **Storylet/event engine** — Precondition-based event selection with deterministic evaluation order, separate event RNG (seeded from mainSeed + 10000), cooldowns, and `maxOccurrences` caps
- **Foreshadowing system** — Advance warnings N days before events, with reliability (false alarms possible). Foreshadowed events get guaranteed priority when they mature
- **3 climate events:** Heatwave Advisory (year 2+, summer, 30%), Water Allocation Cut (year 3+, summer, 20%), Late Frost Warning (spring, 15%)
- **Emergency loan system** — First insolvency offers a one-time loan (engine-computed amount, 10% annual interest, 20% harvest revenue auto-repayment). Second insolvency or debt >$100k = hard game over
- **Effect system** — `modify_cash`, `modify_moisture_all`, `modify_nitrogen_all`, `modify_yield_modifier`, `modify_irrigation_cost`, `restrict_watering`, `add_notification`, `set_flag`
- **Active effects with duration** — Yield/price modifiers and irrigation cost changes expire after N days

### Slice 2b: Perennial Crops
- **2 perennial crops:** Almonds (establishment: 3 years, $960 seed, 700 chill hours required) and Pistachios (establishment: 4 years, $900 seed, 600 chill hours required)
- **Establishment period** — Zero yield during establishment, perennialAge tracked, perennialEstablished flag
- **Dormancy** — Winter dormancy with automatic entry/exit based on season. Chill hours accumulate during dormancy
- **Non-destructive harvest** — Collects fruit, keeps tree. Growth stage resets to mature. `harvestedThisSeason` guard prevents double-harvest
- **Explicit removal** — `REMOVE_CROP` command required to clear perennials (with confirmation dialog)

### Slice 2c: Extension Agent Advisor + Chill Hours + Fog-of-War
- **5 advisor storylets** (Dr. Maria Santos, Extension Agent):
  - `advisor-soil-nitrogen` — Fires when avg nitrogen < 50 (year 2+). Offers fertilizer ($400, +60N to all cells) or acknowledgment
  - `advisor-crop-failure` — Fires after crop failures. Offers diversification or irrigation tips
  - `advisor-chill-warning` — Fires when perennials planted (year 8+). Reveals chill hour data
  - `advisor-drought-recovery` — Fires when cash < $30k (year 4+). Offers cost-cutting or low-cost crop advice
  - `advisor-perennial-opportunity` — Fires when cash > $40k, no debt, no perennials (year 3+). Suggests tree crops
- **Chill-hour mechanics:**
  - Pre-defined chill hours per year in scenario data: 800 (years 1-5), 700 (6-15), 630 (16-25), 570 (26-30)
  - Accumulation during winter dormancy: `dailyChill = yearChillHours / 90`, resets at dormancy entry
  - Yield penalty at harvest: `chillFactor = clamp(accumulated / required, 0, 1)`. Annuals skip, non-established perennials skip
  - Teaching moment: by year 20, chill hours (630) are insufficient for almonds (700 required) but sufficient for pistachios (600 required)
- **Fog-of-war:** Chill hour UI hidden until `state.flags['chillHoursRevealed']` is true. Set by: (a) planting first perennial, or (b) advisor chill-warning event choice
- **Dynamic testid prefixes:** Advisor events use `advisor-choice-*`, climate/regulatory events use `event-choice-*`
- **Save migration:** V2→V3 (adds `chillHoursAccumulated` to crop instances), V1→V2→V3 chaining for oldest saves

### Reviewer Findings Addressed (4 rounds for 2a, 1 round for 2c)
All findings documented in KNOWN_ISSUES.md with resolution details.

## Current Metrics

```
npx tsc -b             # Type-check: clean
npx vitest run         # 300 unit tests, all passing (10 test files)
npx vite build         # 32.38 KB gzipped JS, 4.35 KB CSS
npx playwright test    # 65 browser tests, all passing
SAVE_VERSION           # '3.0.0'
```

## Architecture Quick Reference

```
src/
  engine/          Pure TS, zero UI deps. All game logic.
    types.ts         GameState root type, Command union, CropInstance, constants
    game.ts          createInitialState, processCommand, simulateTick, harvestCell
    calendar.ts      Day↔calendar conversion (STARTING_DAY=59 = March 1)
    weather.ts       generateDailyWeather, updateExtremeEvents, ExtremeEventState
    rng.ts           Mulberry32 seeded PRNG
    events/
      types.ts       Storylet, Condition, Effect, Choice, Foreshadowing types
      selector.ts    evaluateEvents — precondition checking, weighted selection
      effects.ts     applyEffects — processes all Effect types on GameState
  adapter/
    signals.ts       Bridges engine↔UI. _liveState → structuredClone → gameState signal
                     Debug hooks: window.__gameDebug (setCash, setDay, setDebt, triggerEvent, setFlag)
  data/
    crops.ts         5 crop definitions (3 annual + 2 perennial)
    scenario.ts      30-year climate scenario with chillHours per year
    events.ts        STORYLETS array (3 climate + 5 advisor events)
  save/
    storage.ts       localStorage: auto-save, manual saves, V1→V2→V3 migration
  ui/
    components/      Preact components (App, GameScreen, NewGameScreen, TopBar, FarmGrid,
                     FarmCell, SidePanel, CropMenu, AutoPausePanel, NotificationBar,
                     ConfirmDialog, Tutorial, EventPanel)
    styles/          CSS Modules
tests/
  engine/            Unit tests: game, weather, calendar, save, rng, events, chill, advisors
  browser/           Playwright specs (game.spec.ts)
```

## Key Implementation Details for Next Session

### Event System Flow
1. `simulateTick()` calls `evaluateEvents()` each tick
2. `evaluateEvents()` checks all storylets in array order against preconditions
3. Non-random conditions evaluated first (short-circuit). `random` condition consumed from event RNG only if all others pass
4. Foreshadowing: conditions pass → foreshadow created → event fires N days later (guaranteed priority)
5. Active event → auto-pause, EventPanel overlay. Player choice → `RESPOND_EVENT` command → `applyEffects()`

### Chill Hour Flow
1. Scenario data: `yearClimate.chillHours` (800→700→630→570 over 30 years)
2. `simulateCrop()`: dormancy entry resets `chillHoursAccumulated` to 0, then accumulates `yearChillHours / 90` per dormant day
3. `harvestCell()`: after event yield modifier, applies `chillFactor = clamp(accumulated / required, 0, 1)` as yield multiplier
4. Annuals: `chillHoursRequired` undefined → skip. Non-established perennials: skip penalty

### Save Migration Chain
- V3 (current, `'3.0.0'`): Full validation via `validateSave()`
- V2 (`'2.0.0'`): `migrateV2ToV3()` — adds `chillHoursAccumulated: 0` to all crop instances
- V1 (`'1.0.0'`): `migrateV1ToV2()` → `migrateV2ToV3()` chain — fills event system fields, perennial fields, then chill fields
- Unknown/corrupt: returns null (no crash)

### Adapter Debug Hooks (for Playwright tests)
`window.__gameDebug` exposes: `setCash()`, `setDay()`, `setDebt()`, `setTotalLoansReceived()`, `setFlag()`, `triggerEvent()`, `getState()`. Test-only — does not resync RNG or resimulate.

## Deferred Items (Documented in KNOWN_ISSUES.md)

### Deferred from Slice 2 → Slice 3
- **Stretch events:** `tomato-market-surge` and `groundwater-pumping-ban` were designed but deferred per Neal's pre-flight feedback. Canonical specs below (not yet in code):
  - **Tomato Market Surge:** type=market, conditions: not winter + year 2+ + 10% random, priority 45, cooldown 365 days. Single choice: Acknowledge → tomato price ×1.4 for 60 days.
  - **Groundwater Pumping Ban:** type=regulatory, conditions: summer + year 5+ + 12% random, priority 55, cooldown 730 days. Choices: Comply (no irrigation 30 days) OR Buy surface water rights ($1,000).
- **Perennial decline phase** — Trees should lose productivity after peak years. Not yet modeled.
- **Age-based yield curves** — Perennials currently use binary yield (0 during establishment, 1.0 after). Real orchards have a ramp-up curve.
- **Tech tree** — Fog-of-war event-driven tech unlocks (ARCHITECTURE.md §5.4). Not started.
- **Remaining 3 advisors** — Financial advisor, Weather service, Farming community. Only Extension Agent (Dr. Santos) is implemented.
- **Insurance / credit systems** — Credit rating, variable rates, insurance premiums. Only one-time emergency loan exists.
- **K + Zn nutrients** — Only nitrogen is tracked. Potassium and zinc deferred.
- **Cover crops** — Off-season crop strategies not yet implemented.
- **Additional crops** — 7 more crops from the full 12-crop roster (ARCHITECTURE.md §8).
- **Additional scenarios** — Only 1 scenario exists. Need 5-8 for classroom use.

### Deferred from Slice 2 → Slice 4
- **Automation policies** — Replant-same, harvest-when-ready, water-when-dry
- **Glossary / Information Index** — In-game educational reference
- **Solar lease event chain** — Multi-phase storylet
- **Completion code + Google Form** — End-of-game reporting
- **Advanced accessibility** — Colorblind modes, full screen reader support
- **Sound / music**

### Accepted Limitations
- **Deep save validation** — Nested field tampering not caught (acceptable for classroom)
- **Single scenario** — Students all play the same climate track until more scenarios are added

## What's Next (Slice 3: Depth & Discovery)

Per ARCHITECTURE.md §13, Slice 3 adds the systems that make the game truly educational:

**Likely priorities (Neal to confirm):**
1. Stretch events (tomato market surge, groundwater pumping ban) — already designed, low effort
2. Perennial decline phase + age-based yield curves — completes the perennial lifecycle
3. Additional crop roster (grapes, citrus, stone fruit, future/adaptive crops)
4. K + Zn nutrients with tech-gated visibility
5. Cover crop strategies
6. Tech tree (event-driven fog-of-war unlocks)
7. Additional advisors (Financial, Weather, Community)
8. Additional climate scenarios (need 5-8 total)
9. Insurance + credit systems

## Verification Commands

```bash
npx tsc -b                    # Type-check (must be clean)
npx vitest run                # 300 unit tests
npx vite build                # Production build (<200KB gzipped)
npx playwright test           # 65 browser tests (builds first)
npm run test:all              # All tests in sequence
```
