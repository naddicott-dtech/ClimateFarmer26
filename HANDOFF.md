# HANDOFF.md — Slice 1 Completion Handoff

**Date:** 2026-02-12
**Status:** Slice 1 complete, reviewed, all tests passing. Ready for Slice 2 planning.

## What Was Built (Slice 1)

The core farming simulation loop: plant → grow → harvest → economy. Students start a new game, plant crops in an 8×8 grid, watch them grow through weather simulation, harvest for revenue, and manage cash across seasons. The game runs for 30 in-game years with variable speed (pause/1×/2×/4×).

### Key Features
- **3 annual crops:** Processing Tomatoes, Silage Corn (spring/summer), Winter Wheat (fall)
- **Weather system:** Deterministic daily weather from seasonal parameters + seeded RNG. Multi-day extreme events (heatwave +10°F, frost forces low ≤32°F) with 3–5 day persistence.
- **Soil model:** Nitrogen depletion/replenishment, moisture tracking with ET0 loss + precipitation gain, organic matter (passive simulation)
- **Growth via GDD:** Crops accumulate Growing Degree Days; growth stages: planted → growing → harvestable → overripe (30-day grace, linear yield decay)
- **Economy:** Seed costs, irrigation costs ($5/plot), harvest revenue (yield × price), yearly expense/revenue tracking
- **Auto-pause system:** Priority-ordered events — bankruptcy/year_30 (100) > harvest_ready (80) > water_stress (60) > year_end (40). Stable sort preserves insertion order for equal priorities.
- **Bulk operations:** Plant/Harvest/Water at field, row, or column scope. Field-scope always shows confirmation dialog. Partial offers round down to complete empty rows (DD-1).
- **Save system:** Auto-save on season change. Manual named saves keyed by "Year N Season" (overwrites same slot). Load menu on title screen.
- **Tutorial:** 3-step tooltip overlay with Skip + Don't Show Again
- **Notifications:** Toast-style feedback for all player actions

### Test Coverage
- **123 unit tests** (Vitest) — engine logic, save/load, weather, calendar
- **45 Playwright browser tests** — full user flows, bulk actions, auto-pause, save/load, confirmation dialogs
- **Production build:** ~23KB gzipped JS

## Architecture Quick Reference

```
src/
  engine/     Pure TS, zero UI deps. All game logic.
    types.ts    GameState root type, Command union, constants
    game.ts     createInitialState, processCommand, simulateTick
    weather.ts  generateDailyWeather, updateExtremeEvents, ExtremeEventState
    calendar.ts Day↔calendar conversion (STARTING_DAY=59 = March 1)
    rng.ts      Mulberry32 seeded PRNG
  adapter/
    signals.ts  Bridges engine↔UI. _liveState (mutable) → structuredClone → gameState signal
  data/
    crops.ts    3 crop definitions
    scenario.ts 30-year climate scenario (SLICE_1_SCENARIO)
  save/
    storage.ts  localStorage: auto-save, manual saves, tutorial pref
  ui/
    components/ Preact components (App, GameScreen, NewGameScreen, TopBar, FarmGrid, etc.)
    styles/     CSS Modules
tests/
  engine/     Unit tests for game, weather, calendar, save, rng
  browser/    Playwright specs
```

## Review Fixes Applied

Three rounds of Senior Engineer review were conducted. All findings addressed:

### Round 1 (8 findings)
1. Harvest auto-pause condition — fixed to trigger on `growthStage === 'harvestable'`
2. Auto-pause priority ordering — added `AUTO_PAUSE_PRIORITY` map + stable sort
3. Plant/Water Field confirmation — always shows dialog, even when affordable
4. Column bulk actions — Plant/Harvest/Water Column buttons added to SidePanel
5. Manual save + load menu — named slots, title screen load/delete UI
6. `hasSaveData()` — now only checks auto-save (drives Continue button correctly)
7. DD-1 complete rows — partial plant offers skip partially-filled rows
8. Missing data-testids — conditional testids for gameover/year30/autopause panels

### Round 2 (Weather + plan review, 7 findings)
1. RNG continuity — warmup loop now calls both `generateDailyWeather` AND `updateExtremeEvents`
2. Event probability formula — replaced `p/90` with exact `1-(1-p)^(1/90)`
3. Streak test — validates ALL streaks ≥ 3 days, not just max
4. Stable sort test — equal-priority events preserve insertion order
5. Save naming — "Year N Season" prevents unbounded slot proliferation
6. `hasSaveData` scoping — test proves it only checks auto-save
7. RNG regression test — proves warmup matches manual from-day-0 simulation

### Round 3 (Final cleanup, 4 findings)
1. Bulk ops routing — affordable-path callbacks route through `processCommand`
2. Duplicate testids — crop ID included in per-crop button testids
3. Browser tests — confirmation dialog and save/load flow tests added
4. Unsafe cast — extracted `ExtremeEventState` interface, removed `as GameState`

## Known Deferred Items

- **Deep save validation** — nested field tampering not validated (acceptable for classroom use)
- **Advanced accessibility** — colorblind modes, full screen reader support (Slice 3-4)
- **Sound/music** — not essential for classroom
- **Emergency loans / credit** — Slice 2 (bankruptcy is game-over in Slice 1)

## What's Next (Slice 2: Events, Perennials, Loans & Advisor)

Slice 2 scope locked per ARCHITECTURE.md §13 and SPEC.md §12-19:

**Core (must ship):**
- Storylet/event engine + foreshadowing + 3 climate events (Heatwave Advisory, Water Allocation Cut, Late Frost Warning)
- 1 advisor (Extension Agent — Dr. Maria Santos, reliability 0.95)
- Perennial crops (almonds, pistachios) with establishment period, dormancy, non-destructive harvest
- Minimal emergency loan (one-time bailout, fixed 10% interest, parameterless TAKE_LOAN)
- Chill-hour tracking with fog-of-war reveal (hidden until advisor or first perennial planted)

**Stretch (only after Core passes all gates):** Market price fluctuation events OR a 2nd advisor.

**Deferred to Slice 3:** Tech tree, remaining advisors, insurance, credit systems, perennial decline phase.

**Sub-sliced as:** 2a (event engine + loans + 3 events) → 2b (perennials) → 2c (advisor + chill hours + stretch events). Each independently shippable.

## Verification Commands

```bash
npx tsc -b                    # Type-check (must be clean)
npx vitest run                # 123 unit tests
npx vite build                # Production build (<200KB gzipped)
npx playwright test           # 45 browser tests (builds first)
npm run test:all              # All tests in sequence
```
