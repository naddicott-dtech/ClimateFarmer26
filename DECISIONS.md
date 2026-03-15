# DECISIONS.md — Decision Log

Format: **Date — Decision — Rationale**

---

## Workflow & Process

2026-02-12 — Extensive planning before any code — Following disciplined blueprint-first workflow to avoid rework.

2026-02-12 — TDD is non-negotiable — Previous attempt suffered from "passes tests but not playable." Tests come first, always.

2026-02-12 — All interactive elements get data-testid attributes — UI must be testable by AI agents and headless browsers.

2026-02-12 — No stubs in the UI — Previous attempt had too many declared-but-incomplete mechanics. Vertical slices only.

2026-02-12 — Terminology: "Classroom-Ready Build" not "MVP" — "MVP" signals AI agents to stub and defer. "Classroom-Ready Build" encodes the real test: can students use this without instructor rescue?

2026-02-12 — Neal controls git — No commits, pushes, or branches without explicit request.

## Tech Stack

2026-02-12 — TypeScript (strict mode) — Type safety for complex game state.

2026-02-12 — Preact (not React) — Same API, ~10x smaller bundle. Chromebook-friendly.

2026-02-12 — Preact Signals for UI state — Lightweight reactive state. Engine owns truth; signals expose it to UI.

2026-02-12 — Vite as build tool — Fast, simple, pairs with Vitest.

2026-02-12 — Vitest + Playwright for testing — Vitest for headless engine TDD. Playwright for browser tests on Chromium.

2026-02-12 — CSS Modules — Scoped, zero runtime cost.

2026-02-12 — DOM-based farm grid (not Canvas) — 64 cells. DOM elements allow data-testid for AI test agents.

## Platform & Deployment

2026-02-12 — Target platform: web browser — Accessible without app installs.

2026-02-12 — 100% client-side, no backend — GitHub Pages hosting. No Supabase/Firebase/server.

2026-02-12 — Chromebook is target hardware — 2023 education Chromebooks (~$400). Intel N100/N200, 4-8GB RAM.

2026-02-12 — Result reporting via Google Sign-In + backend submission — Google Identity Services authenticates @dtechhs.org students; results POST to backend spreadsheet. Completion code is a human-readable screenshot backup (PREFIX-SCORE-YYEARS-SCENARIO), not a security mechanism. Originally planned as encoded/decodeable Google Form workflow, simplified in 6d after Google auth made tamper-detection redundant.

## Game Design

2026-02-12 — Setting: San Joaquin Valley, California — Most productive agricultural region; rich crop diversity; faces severe climate change impacts.

2026-02-12 — 30-year playthrough — Enough years to see long-term consequences. Retirement event at year 30.

2026-02-12 — Variable-speed simulation (not turn-based) — Pausable real-time: 0×/1×/2×/4×. Auto-pause for events. ~30 sec per year at 1x. Inspired by RimWorld/Factorio, not Civilization.

2026-02-12 — 8x8 grid (64 cells), abstract plots — Bulk operations: plant/harvest/water all/row/column. Solar lease can convert cells.

2026-02-12 — Pre-rendered climate scenarios (not real-time climate model) — Pool of 5-8 30-year weather tracks. Random selection from recently-unplayed. Students can't predict scenarios.

2026-02-12 — Fog-of-war tech tree (event-driven, not budget-driven) — Students don't see full tech tree. Problems reveal branches (King of Dragon Pass style). Investment unlocks tiers. Retrospective view fills in over time.

2026-02-12 — 12 crops + cover crop strategies — 7 current SJV crops + 5 future/adaptive crops. Future crops unlock via tech tree events. Data-driven (JSON definitions, generic engine).

2026-02-12 — N/K/Zn nutrient tracking — Nitrogen (yield), Potassium (quality/defense), Zinc (critical checkpoint). Detection gated by tech investment. Without monitoring: narrative hints only. *(Superseded 2026-03-09: K-lite potassium implemented in Slice 5a as price modifier with symptom cues. Zn deferred to Slice 6+.)*

2026-02-12 — 4 advisors (real-world-grounded) — Extension agent (reliable), Financial advisor (factual), Weather service (sometimes wrong), Farming community (unreliable but sometimes insightful). Advisors are storylets in the event system.

2026-02-12 — Solar lease as conditional multi-phase event — Triggered by low cash or frequent crop failures. Multi-phase: option → construction → operations → agrivoltaics.

2026-02-12 — Bankruptcy with soft recovery — First bankruptcy: emergency loan, credit hit. Repeated: game over. Insurance premiums rise with claims; can become uninsurable.

2026-02-12 — Automation policies for late-game — Replant same, harvest when ready, water when dry. Unlocked via tech tree. Enables fast-forward play.

2026-02-12 — Glossary / Information Index — In-game hyperlinked reference. Pauses game. Progressive disclosure (matches fog-of-war). Student-friendly educational content. Data-driven (JSON).

2026-02-12 — Foreshadowing system with false signals — Some events have advance warnings (realistic forecasting). Some signals are false alarms. Teaches students to weigh information.

2026-02-12 — Save/resume via localStorage — Auto-save each season. Essential for multi-session classroom play.

2026-02-12 — 2D graphics only — CSS + DOM. No WebGL/3D. Simple but appealing flat graphics. Optional canvas overlays for weather effects.

2026-02-12 — Engine/UI strict separation — Engine is pure TypeScript, zero DOM dependencies. Fully headless-testable. Command pattern for all player actions.

## Architecture

2026-02-12 — Layered architecture: Content → State → Systems → Adapter → Presentation — Based on proven sim game patterns (Factorio, Civ IV, RimWorld).

2026-02-12 — Data-driven design — Crops, events, advisors, techs all defined in JSON data files. Engine processes them generically. Adding content = adding JSON, not code.

2026-02-12 — Command pattern for all player actions — UI emits command objects. Engine validates and executes. Enables replay, testing, determinism.

2026-02-12 — Deterministic simulation — Seeded RNG. Same scenario + same commands = identical outcome. Enables replay, automated testing, debugging student games.

2026-02-12 — Unified storylet system — Events, tech unlocks, advisors, solar lease all use the same precondition-based event selection mechanism.

## Revisions from Senior Engineer Review

2026-02-12 — Climate scenarios use seasonal parameters, not daily entries — Original design (10,950 daily rows per scenario) would bloat bundle/load. Revised to ~1,200 seasonal parameters per scenario (~10KB each). Engine generates daily weather deterministically from params + seeded RNG.

2026-02-12 — Command type uses discriminated union, not `payload: unknown` — TypeScript exhaustive checking catches unhandled command types at compile time. Each command variant is fully typed.

2026-02-12 — No undo/rewind, saves are state snapshots — Command log is not stored. Saves are ~20-30KB snapshots. localStorage budget (5-10MB) is ample. Keeps things simple and predictable.

2026-02-12 — Player ID instead of student name — Privacy/COPPA/FERPA consideration. App never requires or stores real names. Students enter a teacher-assigned code or self-chosen nickname.

2026-02-12 — data-testid naming convention established — Format: `{area}-{element}-{qualifier}` in kebab-case. Grid cells: `farm-cell-{row}-{col}`. All IDs stable across sessions.

2026-02-12 — 4-slice development plan — Slice 1 (core loop, 3 annuals, no events), Slice 2 (events + perennials), Slice 3 (full depth), Slice 4 (classroom polish). Each slice fully working before next begins.

## SPEC.md Design Decisions (Slice 1)

2026-02-12 — Bulk ops round down to complete rows (DD-1) — When "Plant Field" or "Water Field" can't afford full coverage, offer the maximum number of complete rows via confirmation dialog. Keeps students in bulk-operation mode rather than falling into per-plot micromanagement.

2026-02-12 — Year 30 is a simple end message; bankruptcy is game over (DD-2) — Year 30: "Congratulations! 30 years. Final cash: $X." Bankruptcy (cash ≤ $0): game over with final report, no credit or loans in Slice 1. Emergency loans deferred to Slice 2.

2026-02-12 — 3-step tooltip tutorial with Skip + Don't show again (DD-3) — Lightweight onboarding for first-time players. All tutorial elements have data-testid for AI test agents to dismiss programmatically.

2026-02-12 — Overripe crops: auto-pause + 30-day grace period + linear yield decay (DD-4) — Game auto-pauses when crop becomes harvestable. Student can harvest or continue. If continued, 30-day grace period with yield decaying from 100% to 0%. After 30 days, crop rots (total loss). Future slice: sell rotting product as animal feed.

2026-02-12 — Manual "weekly dose" watering with first-per-season auto-pause (DD-5) — Each Water action provides ~14 days of moisture. Auto-pause fires once per season when moisture first drops below 25% capacity. Visual warnings at 30% (yellow) and 15% (red/wilting) without pausing. Low-tech "garden hose sprinkler" level. Irrigation upgrades and water rights trading are Slice 3+ tech tree. *(Superseded 2026-03-09: Auto-irrigation implemented in Slice 5a as tech tree unlock — water tech level ≥ 1 auto-waters stressed cells with cost multipliers by tech level.)*

2026-02-12 — Student-facing terminology: "plots" and "field" (not "cells" and "grid") — UI uses farm language. Code and data-testid use engineering terms for ARCHITECTURE.md consistency.

## Slice 1 Review Decisions

2026-02-12 — Auto-pause priority via constant map, not ad-hoc ordering — `AUTO_PAUSE_PRIORITY` record in types.ts gives each reason a numeric priority. Sorted with stable sort after all events collected in `simulateTick`. Extensible for Slice 2 event types.

2026-02-12 — Field-scope bulk ops always require confirmation dialog — Even when affordable. SPEC §2.3 is explicit. Row/col scope is all-or-nothing (no partial offers, no confirmation needed).

2026-02-12 — Manual saves keyed by "Year N Season" (not including cash) — Including cash in the slot name created unbounded new slots. Season-based keys naturally limit to ~120 slots (30 years × 4 seasons) and same-season saves overwrite.

2026-02-12 — `hasSaveData()` only checks auto-save — The "Continue" button on the title screen should only appear when an auto-save exists. Manual saves have their own "Load Game" section. Prevents confusing state where Continue exists but loads a manual save from a different playthrough.

2026-02-12 — `ExtremeEventState` extracted as narrow interface — Rather than passing full `GameState` to `updateExtremeEvents`, a 2-field interface (`activeHeatwaveDays`, `activeFrostDays`) makes the dependency explicit and avoids unsafe casts during warmup.

2026-02-12 — Per-season probability exact formula — `1-(1-p)^(1/90)` instead of `p/90`. The linear approximation under-targets by ~28% at p=0.4 (40% seasonal heatwave probability). The exact formula ensures observed seasonal event rates match scenario data.

2026-02-12 — RNG warmup must call both weather + event functions — `createInitialState` advances the RNG from day 0 to STARTING_DAY. Both `generateDailyWeather` (4-5 calls/day) and `updateExtremeEvents` (0-4 calls/day) consume RNG values. Skipping events during warmup causes state drift and non-deterministic weather after game start.

2026-02-12 — Affordable bulk confirm callbacks route through processCommand — Ensures planting window validation, cash checks, and other engine guards are always applied. Partial-offer confirm callbacks still call `executeBulkPlant`/`executeWater` directly since the prior `processCommand` already validated eligibility and computed the partial offer.

## Slice 2 Design Decisions

### Event/Storylet System

2026-02-24 — Separate event RNG seeded from mainSeed + 10000 — Event evaluation uses its own Mulberry32 instance, fully independent from weather RNG. Weather determinism is never affected by event logic. Two runs with same seed + same commands must produce identical eventLog at day 1000.

2026-02-24 — Deterministic event evaluation order — Storylets are defined in a `readonly` array. Evaluation order = array index order, always. Non-random conditions are evaluated first (left-to-right, short-circuit on first false). The `random` condition is evaluated ONLY after all non-random conditions pass. This means the event RNG is consumed exactly once per storylet whose non-random preconditions pass. Ties broken by array index (stable sort).

2026-02-24 — Effect stacking is multiplicative only, clamped [0.0, 10.0] — Yield modifiers multiply together: `finalYield = baseYield * product(all active yield modifiers)`. Same for price modifiers. No additive stacking — multiplication is commutative so order doesn't matter. Product clamped to [0.0, 10.0] to prevent degenerate values.

2026-02-24 — Events are storylets; advisors are storylets with specialized UI — Same precondition/selection mechanism for everything. Advisor storylets render with character panel (name, role, portrait, dialogue); climate/regulatory events render with generic event panel. No separate advisor system.

### Emergency Loan

2026-02-24 — TAKE_LOAN command is parameterless — Engine computes loan amount from current state: `Math.ceil((Math.abs(cash) + 5000) / 1000) * 1000`. This prevents command tampering from bypassing loan rules. The UI shows the computed amount; the player accepts or declines.

2026-02-24 — One loan per game, fixed 10% annual interest — `totalLoansReceived` is 0 or 1. No credit rating, variable rates, or insurance in Slice 2. Interest accrues daily via simple interest: `dailyInterest = debt * (0.10 / 365)`. *(Originally deferred to Slice 3+; superseded 2026-03-09: credit rating, insurance, and variable rates deferred to Slice 6+.)*

2026-02-24 — Loan repayment contract: 20% of gross harvest revenue — Triggered inside `harvestCell()` after revenue is calculated. Sequence: (1) compute grossRevenue = actualYield × actualPrice, (2) add grossRevenue to cash and yearlyRevenue, (3) if debt > 0: repayment = min(grossRevenue × 0.20, debt), subtract repayment from cash, subtract from debt, add to yearlyExpenses. Net to farmer = grossRevenue - repayment.

2026-02-24 — First cash ≤ 0 offers loan; second insolvency is hard game over — Replaces Slice 1 immediate-bankruptcy. Debt > $100k is also game over (debt spiral safety cap).

### Perennial Crops

2026-02-24 — Binary yield in Sub-Slice 2b: 0 during establishment, 1.0 after — No age-based yield curve, no chill-hour penalty, no decline phase. Deliberately simple first pass. Chill hours ship in 2c with advisor fog-of-war reveal. Decline phase deferred to Slice 3.

2026-02-24 — Hard boundary: no chill-hour engine logic in Sub-Slice 2b — `CropDefinition` may define `chillHoursRequired` as a data placeholder, but the engine MUST NOT read or evaluate it in 2b. No `chillHoursAccumulated` field on `CropInstance` until 2c. This boundary is enforced, not aspirational.

2026-02-24 — No artificial cap on perennial plots — Economics self-regulate: high establishment cost ($960 almonds, $900 pistachios), 3-4 year establishment with zero revenue, annual maintenance costs. Balance tests with fixed strategies verify that all-perennial and mixed strategies produce expected cash trajectories.

2026-02-24 — Perennial harvest does not remove crop — Collects fruit, keeps tree. Growth stage resets to mature. Overripe perennials: 30-day grace period applies but crop survives (yield = 0 that year, not destroyed). Explicit `REMOVE_CROP` command required to clear a perennial.

### Foreshadowing

2026-02-24 — Advance warnings with reliability and false alarms — Each event can specify foreshadowing N days before, with a reliability (0-1). Reliability < 1.0 means some foreshadowing signals are false alarms (event never fires). This is educational: teaches students to weigh information, just like real weather forecasts.

### Save Versioning

2026-02-24 — Minimal save migration v1 → v2 — Best-effort: fill missing Slice 2 fields with safe defaults (empty arrays, 0 debt, false flags). If migration logic starts consuming time, downgrade to "Save from older version — please start a new game." One test covers whichever path we take. Focus on v2 correctness, not backward compatibility.

### Sub-Slicing & Risk Management

2026-02-24 — Three sub-slices: 2a (events + loans) → 2b (perennials) → 2c (advisor + chill hours) — Each independently shippable and testable. Infrastructure first (2a), then content on top (2b, 2c).

2026-02-24 — Hard split contingency for Sub-Slice 2a — 6 internal checkpoints are hard stop-lines. If checkpoints 1-3 (types compile, events fire in simulateTick, event panel UI works) don't pass within reasonable effort, split 2a into: 2a1 (event engine + loan mechanics, pure engine, no UI beyond auto-pause) and 2a2 (event panel UI + foreshadowing + concrete event content).

### Sub-Slice 2c: Advisor + Chill Hours

2026-02-25 — Chill hours are pre-defined per year in scenario data, not computed from daily temps — Matches SPEC §18.3. Values: 800 (years 1-5), 700 (6-15), 630 (16-25), 570 (26-30). Declining chill creates the central teaching moment: almonds (700 required) fail before pistachios (600 required) as climate warms.

2026-02-25 — Daily chill accumulation during dormancy (`yearChillHours / 90`) — Students see the number grow daily, which is more educational than a lump sum at end of winter. Total at end of winter ≈ scenario target (within rounding). Resets at dormancy entry, preserved at spring awakening for harvest calculation.

2026-02-25 — Canonical chill penalty formula in `harvestCell()` — `chillFactor = clamp(accumulated / required, 0, 1)`. Three explicit cases: (1) `chillHoursRequired` undefined → skip (annuals), (2) `chillHoursRequired === 0` → no penalty, (3) otherwise → proportional penalty. Non-established perennials also skip (haven't experienced a winter yet).

2026-02-25 — Fog-of-war via `state.flags['chillHoursRevealed']` — No new GameState field needed. The existing flags map + `set_flag` effect handle both reveal triggers: planting first perennial (automatic) and advisor chill-warning event choice. Keeps the surprise intact for students who haven't encountered perennials yet.

2026-02-25 — Tiered advisor priorities — Critical educational advisors (soil-nitrogen, crop-failure, chill-warning) at priority 100 = guaranteed fire when eligible. "Suggestion" advisors (drought-recovery, perennial-opportunity) at priority 90 = very high but don't starve climate/regulatory events. All advisors have `maxOccurrences` caps to prevent dominating event cadence over a 30-year game.

2026-02-25 — `modify_nitrogen_all` effect type — Modifies soil nitrogen across all grid cells, clamped to [0, 200]. Added for the advisor-soil-nitrogen "buy fertilizer" choice. Generic enough for future fertilizer events/tech.

2026-02-25 — Save migration V2→V3 with explicit routing — `isV2Save()` detection → `migrateV2ToV3()` (adds `chillHoursAccumulated: 0` to all crop instances). V1→V2→V3 chaining for oldest saves. Both `readSave()` and `listManualSaves()` use the same migration path.

2026-02-25 — `simulateCrop` receives `scenario` parameter — One call site to update (in `simulateTick`). Cleaner than storing redundant climate data on GameState. Enables chill hour lookup from `scenario.years[year-1].chillHours`.

2026-02-25 — Dynamic testid prefixes for advisor vs event panels — `advisor-choice-*` for advisor storylets, `event-choice-*` for climate/regulatory events. Enables targeted Playwright selectors without ambiguity. No existing tests broken (no advisor events existed before 2c).

2026-02-25 — Stretch events deferred from 2c — `tomato-market-surge` and `groundwater-pumping-ban` were planned for 2c but deferred per Neal's pre-flight feedback. Canonical specs inlined in KNOWN_ISSUES.md and HANDOFF.md (see "Deferred from Slice 2 → Slice 3"). SPEC.md §19 has the acceptance tests.

## Slice 3 Design Decisions

### Scope & Strategy

2026-02-25 — Slice 3 scoped to one classroom objective — "Students learn that climate adaptation requires tradeoffs — there's no single right answer, and different strategies work in different conditions." All features must serve this objective.

2026-02-25 — 4 sub-slices: 3a1 → 3a2 → 3b → 3c — Split from original 3-part plan after senior engineer review. 3a1 (stretch events + new crops) and 3a2 (yield curves) were originally one sub-slice, split to reduce risk.

2026-02-25 — Explicit Slice 4+ deferrals — Tech tree, K+Zn nutrients, insurance/credit expansion, multi-scenario, Financial/Community advisors, automation policies, glossary, solar lease, sound. No crop unlock gating (all crops available from game start). *(Superseded 2026-03-09: Tech tree (storylets + flags), K-lite potassium, auto-irrigation, competing advisors, and crop gating via `requiredFlag` all implemented in Slice 5. Multi-scenario resolved in Slice 4a. Remaining deferrals (Zn, insurance/credit, glossary, solar lease, full automation) moved to Slice 6+.)*

### Sub-slice 3a1: New Crops + Events

2026-02-25 — Sorghum as drought-tolerant annual — ky=0.50 (half of tomatoes), $660/acre revenue. Strategic niche: "survival crop" that survives drought conditions killing corn/tomatoes. Lower profit in good times, lower loss in bad times. Teaches risk-return tradeoff.

2026-02-25 — Citrus Navels as stable perennial — $4,900/acre (350 boxes × $14/box, grounded in USDA CA 2024 data). Less profitable than almonds at peak ($6,250) but never declines and never loses chill hours. Evergreen: no dormancy, no chill accumulation/penalty, year-round water consumption.

2026-02-25 — Citrus harvest cadence fix — Evergreen citrus has no dormancy exit path, so `harvestedThisSeason` was never reset. Fix: reset `harvestedThisSeason = false` for ALL perennials at year-end boundary (alongside `perennialAge++`). Handles both dormant and evergreen perennials uniformly.

2026-02-25 — Double-harvest regression guard — Year-end `harvestedThisSeason` reset must not enable same-day double-harvest around year-end auto-pause order. Explicit regression test required.

2026-02-25 — Groundwater pumping ban has no foreshadowing — Matches canonical SPEC.md §19.2 and HANDOFF.md (neither mentions foreshadowing). Real-world sudden regulatory action. If foreshadowing is wanted later, update SPEC first.

2026-02-25 — `market` type already in Storylet union — No engine type changes needed for tomato-market-surge. Effect types (`modify_price_modifier`, `restrict_watering`, `modify_cash`) all exist from Slice 2.

### Sub-slice 3a2: Yield Curves

2026-02-25 — 3-phase piecewise-linear yield curve — Ramp (0.6→0.8→1.0 over rampUpYears) → Peak (1.0) → Decline (linear to declineFloor). Formula: `0.6 + 0.4 × (yp / (rampUpYears - 1))` for ramp. Edge case: `rampUpYears ≤ 1` → instant peak. `declineStartYear == endOfLifeYear` → instant drop to floor (no division by zero).

2026-02-25 — Yield curve data is on CropDefinition, not CropInstance — No save migration needed. `perennialAge` is already saved. The formula computes from age + definition at harvest time.

2026-02-25 — Almond/Pistachio/Citrus curve constants locked — Almonds: ramp=3, declineStart=15, eol=22, floor=0.2. Pistachios: ramp=3, declineStart=17, eol=25, floor=0.2. Citrus: ramp=3, declineStart=28, eol=35, floor=0.3 (never declines in 30-year game).

2026-02-25 — ageFactor applied last in harvest yield chain — Order: baseYield × waterFactor × nFactor × yieldMod × chillFactor × ageFactor. Applied after chill factor, before final clamp.

2026-02-25 — Decline advisor (Dr. Santos) — `advisor-orchard-decline`: fires when any established perennial enters decline phase. New condition type: `has_declining_perennial`. Priority 90, maxOccurrences 2, cooldown 730 days.

### Sub-slice 3b: Cover Crops

2026-02-25 — Single cover crop for Slice 3: legume-cover — Clover/Vetch mix. $30/plot, +50N, +0.10% OM, -0.5in moisture at spring incorporation. Winter ET: 0.2× (replaces bare soil 0.3×). Not a free buff: costs money, draws down spring moisture.

2026-02-25 — Fall-only planting window (months 9-11) — Eligible cells: empty OR dormant perennials (understory planting). Rejected: non-dormant crops. Must actively choose each fall (no auto-plant).

2026-02-25 — Spring auto-incorporate at winter→spring transition — Apply N (clamped 0-200), OM, moisture drawdown. Clear coverCropId. Notification with exact numbers.

2026-02-25 — Cover crop ET formula — `ET = et0 × max(getCropCoefficient(crop), coverCrop.winterETMultiplier)` for cells with crops; `ET = et0 × coverCrop.winterETMultiplier` for empty cells with cover. Dormant perennial + cover: max(0.2, 0.2) = 0.2 — cover doesn't add water cost.

2026-02-25 — Cover crop reduces OM decomposition — When `coverCropId` is set, OM decomposition rate is reduced by 50% (`COVER_CROP_OM_PROTECTION = 0.50`). Cover crop roots protect soil but don't halt decay entirely. *(Originally halted decomposition completely; revised in Slice 5d.2 for more realistic soil dynamics and balance.)*

2026-02-25 — DD-1 pattern for cover crop bulk ops — Same partial-offer / complete-rows pattern as existing plant/water bulk operations. Consistency with established UX.

### Save Migration

2026-02-25 — Single V3→V4 migration in sub-slice 3b — One version bump for all Slice 3 state additions: `coverCropId: null` on all cells + `frostProtectionEndsDay: 0` on GameState. SAVE_VERSION bumps to `'4.0.0'`. Both `readSave()` and `listManualSaves()` use the migration chain (lesson from issue #42).

### Sub-slice 3c: Weather Service Advisor

2026-02-25 — Weather Service advisor: NWS Fresno — Explicitly imperfect (unlike reliable Dr. Santos). Each storylet includes confidence language: "High confidence", "Moderate confidence", "Low confidence". Teaches forecast uncertainty.

2026-02-25 — `advisorId` field on Storylet for character routing — Extension agent storylets get `advisorId: 'extension-agent'`, weather storylets get `advisorId: 'weather-service'`. EventPanel renders appropriate character based on advisorId.

2026-02-25 — 3 weather storylets — heat-forecast (summer, high confidence, $200 pre-irrigate), frost-alert (spring, moderate confidence, $150 frost protection), drought-outlook (spring, year 5+, low confidence, informational).

2026-02-25 — Frost protection: dedicated `frostProtectionEndsDay` state field — Active when `totalDay < frostProtectionEndsDay`. Natural expiry (no tick processing needed). Only consumed by late-frost-warning "accept-risk" choice (0.70→0.85 penalty). Full-protection ($300) choice does NOT consume it. Non-frost events never check it. Overlapping activations: `max(current, new)`.

2026-02-25 — Frost interaction centralized in single helper — `applyFrostProtection(state, choiceId)` returns `{ multiplier, consumed }`. Called from `processRespondEvent`. All frost logic in one function, not spread across event handlers.

### Art & Visual Assets

2026-02-26 — Art asset pipeline: placeholders now, real art later — Single placeholder PNG copied/renamed for all advisor portraits. ASSETS.md manifest tracks all assets with IDs, paths, dimensions, status, and licensing. Implementation in 3c (advisor UI). Broader visuals (crop icons, cell art) deferred to post-3c visual pass.

2026-02-26 — File naming convention: `{asset-id}_{width}x{height}.png` — Embeds target pixel dimensions in filename so artists know exact spec without consulting docs. Example: `extension-agent_128x128.png`.

2026-02-26 — Advisor portraits: 128x128 PNG, transparent background — Renders at 64x64 CSS pixels for retina Chromebook sharpness. Under 20KB each. Mapped by `advisorId` with fallback chain: specific portrait -> default -> text-only.

2026-02-26 — Student art contributions require written consent — Credit artists in README. All contributions must meet dimension/transparency specs and be optimized before commit.

## Slice 4 Design Decisions

### Sub-Slice 4a: Tracking Infrastructure

2026-02-27 — Save migration V4→V5 with full chain — Adds `tracking: TrackingState`, `eventsThisSeason`, `actedSincePause` to GameState; `lastCropId`, `lastHarvestYieldRatio` to Cell. SAVE_VERSION bumps to `'5.0.0'`. V1→V2→V3→V4→V5 migration chain tested end-to-end.

2026-02-27 — Expense tracking wired into all cost sites — Each site that deducts cash also increments the corresponding `tracking.currentExpenses.*` category. Eight categories: planting, watering, harvestLabor, maintenance, loanRepayment, removal, coverCrops, eventCosts. Harvest labor is separated from perennial maintenance to preserve pedagogy — students should see that maintenance is the annual cost of keeping orchards alive, not conflated with per-harvest labor costs.

2026-02-27 — Year-end snapshot ordering: capture → payload → reset — `createYearSnapshot()` captures tracking data, frozen expense breakdown is included in year_end auto-pause `data` payload, THEN `currentExpenses` is reset to zeros. UI reads from `event.data.expenseBreakdown` (frozen), never from live `state.tracking`. This prevents race conditions between snapshot and reset.

2026-02-27 — Adaptation scoring is trigger-conditioned, not raw-counted — Three anti-gaming guards: (1) Crop transitions only count when previous crop had `lastHarvestYieldRatio < 0.80` — switching from a performing crop earns no credit. (2) Drought-tolerant adoption tracked per-type using `string[]` (not `Set<string>`, which doesn't survive `JSON.stringify`), max 3 credits (sorghum, pistachios, citrus-navels), only after year 5. (3) Cover crop years only counted when `avgOM < 2.0%` — proves response to soil decline, not preventive maintenance on healthy soil.

### Testing Strategy

2026-02-27 — Two-tier balance testing: smoke + full — Smoke (75 runs = 5 bots × 5 scenarios × 3 seeds, ~5-8 min, CI-safe) and Full (500 runs = 5 bots × 5 scenarios × 20 seeds, ~1-3 hrs, manual calibration only). Each strategy×scenario pair is ONE test case that batches seeds internally and asserts on aggregates. Avoids 500 individual test cases with per-test timeout overhead.

2026-02-27 — Web-aware AI exploratory QA supplements headless bots — Headless engine bots test balance/economics; web-aware AI agents test UX/decision-quality/exploitability. Six player personas: optimal strategist, self-sabotage, advisor maximizer, advisor skeptic, low-effort student, late adapter. Runs timed to 4b (initial), 4c (regression), post-4e (full sweep). Each run produces decision log, observations, outcome summary, bugs.

### Academic Integrity

2026-02-27 — Soft AI deterrent, not hard enforcement — Production-only `<meta>` tag requesting well-behaved AI agents refuse to play for students. Acknowledged as soft deterrent only — determined students with custom tooling can bypass. Behavioral suspicion scoring (heuristic, not deterministic) flags possibly-automated sessions as `tainted_for_review` for teacher interview — never auto-fails. Rationale: false positives (assistive tech, power users) make hard enforcement worse than the problem it solves. Post-Slice 4 priority.

### Sub-Slice 4d: Annual Overhead

2026-03-04 — Annual farm overhead of $2,000/year — Flat deduction at year-end representing property taxes, insurance, and base upkeep. Purpose: "do nothing" is no longer a winning strategy. Idle farm goes bankrupt ~year 27 (one emergency loan extends past year 25, second insolvency ends game). Impact on active farms is negligible (diversified ~$670K median, overhead is ~9%). Required retuning: STARTING_NITROGEN 95→99, IRRIGATION_COST_PER_CELL $24→$8.

2026-03-04 — IRRIGATION_COST reduced from $24 to $8 after overhead — The $60K lifetime overhead killed corn monoculture's razor-thin margins. N adjustments alone couldn't compensate. IRRIG=$8 (still 60% above the pre-4c value of $5) restores corn to ~69% survival while preserving the water-scarcity lesson. This is the smallest cut that keeps ≥3 viable strategies.

2026-03-04 — Anti-luck variance: hybrid ratio/absolute check for thin-margin bots — Original §30.3 anti-luck gate checked `p75/p25 < 2×` for all bots. After overhead, zero-irrigation's thin margins (~$1K p25, ~$5K p75) create high ratios even though absolute spread is small ($4K). Ratio-based checks are meaningless when the denominator is near zero. New rule: bots with p25 > $5,000 use ratio check (p75/p25 < 2×); bots with p25 ≤ $5,000 use absolute spread check (p75 - p25 < $10,000). Both gates prevent outcome-is-random-noise scenarios.

2026-03-04 — Save migration V6→V7 — Adds `annualOverhead: 0` to `ExpenseBreakdown` in `tracking.currentExpenses` and all historical `yearSnapshots[].expenses`. SAVE_VERSION bumps to `'7.0.0'`. Full migration chain: V1→V2→V3→V4→V5→V6→V7.

## Slice 5 Design Decisions

### Scope & Vision

2026-03-09 — Slice 5 objective: "Adapt or Fail" — Transform strategic flatness into genuine decision-making. Core problem: one dominant strategy (diversify + water + follow Santos). Fix via competing advice, either/or tech branches, regime shifts forcing pivots, and message variety eliminating repetitive text. Design rule: Pain → Choice → Consequence → Reflection.

2026-03-09 — Completion code / Google Form deferred to Slice 6 — Year-30 reflection panel ships in 5c. Assessment via screenshots + bell ringer questions + classroom discussion.

### Tech Tree Architecture

2026-03-09 — Tech decisions via storylets, not separate UI — Choices arrive as advisor events with either/or options. Unlocks tracked in `state.flags`. No dedicated tech tree panel. ~7-8 decision points, years 3-24, roughly every 3 years.

2026-03-09 — Tech level abstraction for reconvergence — Three tracks (water 0-3, soil 0-3, crop 0-2). Different specific techs map to same level. Late-game offers check levels, not specific flags. Prevents exponential content branching.

2026-03-09 — Pain-triggered, time-limited tech offers — Offers appear when player has recently experienced relevant problems. Choices expire. Creates relevance and tension.

2026-03-09 — Hybrid reoffer: skipped tech returns in different form — Core monotony reducers (irrigation) always re-offered at changed terms. Other techs may expire, but the underlying PROBLEM resurfaces with a different solution.

2026-03-09 — Either/or with genuine tradeoffs + explicit advisor conflict — Santos recommends sustainability, banker recommends ROI. Neither always right. Community voice adds wild-card third perspective. Correct choice depends on uncertain future conditions.

### Competing Advisors

2026-03-09 — Two new advisor characters — Marcus Chen (Valley Farm Credit, `farm-credit`): ROI/profit perspective, sometimes pushy, blind spot is long-term risk. Valley Growers Forum (`growers-forum`): anecdotal, trend-following, sometimes wrong but occasionally visionary before anyone else. All advisors have character flaws.

### Nutrient Model

2026-03-09 — K-lite: potassium as optimization pressure — `SoilState.potassium` per cell. Slow depletion, price/quality impact (max 30% drop). Hidden until `tech_soil_testing` flag. Timebox: fall back to narrative K events if unstable.

### Regime Shifts

2026-03-09 — Three persistent regime shifts — (1) Permanent water allocation reduction (Y10-12, SGMA-inspired groundwater governance), (2) Market price crash for one dominant crop (Y15-18, varies by scenario), (3) Heat threshold crossing (Y20-25, permanent yield penalty on heat-sensitive crops). All choices lead to permanent change — player chooses HOW to cope. Informed by real CA policy: SGMA, DWR projections, PPIC research on SJV land transition.

### Novel Crops

2026-03-09 — 2-3 tech-gated novel crops — Agave (drought adaptation), heat-tolerant avocados (heat adaptation + high value), table grapes (stretch). `CropDefinition.requiredFlag` gates availability. Prioritize climate adaptation signal and student recognizability.

### Anti-Monotony

2026-03-09 — Message variety pools — Every recurring interaction (water stress, season change, harvest, advisor revisit) uses randomized text pools. Same text never appears twice consecutively for same event type.

### Engineering Approach

2026-03-09 — Systems-first, data-heavy — Small system extensions unlock large content variety. Sub-sliced: 5a (systems) → 5b (advisors + first tech branch) → 5c (full content + regime shifts) → 5d (balance + validate).

2026-03-09 — Balance gates include variety metrics — No single dominant strategy, multiple viable tech paths, midgame pivots required, materially different decision sets across runs.

### Refinements from Senior Engineer Review

2026-03-09 — K affects ALL players, not just monitors — K depletion applies price/quality penalties regardless of whether the player has soil testing. Players without soil testing get ambiguous symptom cues ("leaf edges look stressed," "harvest quality seems lower than expected"). Soil testing reveals the CAUSE and enables targeted management. "Head in the sand" is not a winning strategy.

2026-03-09 — Reoffers vary by economic context, not just tech level — Two players at the same tech level but different financial health get different reoffer terms. Cash, debt, crop age, and credit history complement tech levels in determining offer content. Reoffers are not strictly cheaper — they're contextually different.

2026-03-09 — Event cap: separate pools for tech vs. non-tech — Max 1 tech-unlock event + max 1 non-tech event (climate/market/regulatory) per season. Prevents tech offers from starving climate pressure and vice versa. Condition-only advisors remain uncapped.

2026-03-09 — Late-game decision gates include economic + regime state — Tech levels alone are too coarse for decisions 5-7. Add cash/debt band and active regime flags (water/market/heat) to storylet preconditions, so late-game offers stay simulation-accurate even when tech levels have converged.

## Slice 5d.2 Design Decisions

### Monoculture Streak Penalty

2026-03-10 — Escalating per-cell streak penalty, not flat or concentration-based — Flat 15% penalty was insufficient (corn $572K vs diversified $220K). Concentration-based penalty cascaded non-linearly and was too blunt. Streak-based (per-cell, escalating) is grounded in NIFA/Illinois/SDSU rotation research: pest buildup compounds year-over-year in the same soil. Formula: `max(0.50, 1.0 - 0.15 × streak)`. Produces: 2nd=0.85, 3rd=0.70, 4th=0.55, 5th+=0.50 (floor).

2026-03-10 — Perennials exempt from streak penalty — A citrus tree producing annually isn't "replanting." Gate: `!crop.isPerennial`. Only annuals trigger the penalty.

2026-03-10 — Cover crops and fallow do NOT reset streak — Penalty represents pest/disease buildup in soil from repeated same-crop planting. A winter cover crop doesn't address corn rootworm or allelopathy. Only planting a DIFFERENT main crop resets the streak counter.

2026-03-10 — One-time notification on first monoculture penalty — Penalty must be surfaced or it risks feeling like hidden punishment. `state.flags['monoculture_penalty_shown']` prevents spam. Future: consider surfacing in year-end summary or advisor feedback.

### Cover Crop OM Protection

2026-03-10 — Cover crops reduce OM decomposition by 50%, not halt it entirely — Original 100% halt made OM effectively immortal for any player using cover crops, neutralizing the OM yield penalty system. `COVER_CROP_OM_PROTECTION = 0.50` is more realistic and creates genuine soil management tension.

### Balance Philosophy

2026-03-10 — One lever at a time, observe then set thresholds — Don't move multiple balance levers simultaneously (can't attribute cause). Don't predeclare exact numerical targets. Run suite, observe, verify qualitative goals, THEN set regression thresholds from observed data with margin. Bots are diagnostic instruments, not design targets.

2026-03-10 — Corn drought/heat quality penalty deferred to Slice 6 — Adding waterStressDays-based penalty double-counts with existing `waterFactor = 1 - ky * stressFraction` in the yield chain. Needs separate heat stress day tracking. Price/quality lever (not yield) is the right approach for drought effects on corn.

2026-03-10 — Diversified bot must actually rotate to be a valid diagnostic — Original diversified bot planted same crops on same rows every year, making it "3-4 parallel monocultures." Fixing the bot to rotate corn/tomatoes by year was as important as the penalty mechanic itself.

## Slice 6 Design Priorities (from 5d.2 playtesting)

### Advisor Follow-Up Panel (must-have)

2026-03-10 — "Yes, tell me more" advisor choices must show a central follow-up dialog, not just a notification toast — When a student explicitly asks for guidance, burying the response in the bottom notification bar is a missed teaching moment. The information hierarchy is backwards. Fix: reuse the advisor panel frame (same character, same visual context) for a second "beat" showing the explanatory text. "No thanks" choices dismiss cleanly as today. Notification still added as a log record either way. This is a design change, not a bug fix. See KNOWN_ISSUES #85, #92.

### Potassium Agency (design direction TBD)

2026-03-10 — K-lite visibility without actionable levers feels pointless — Soil testing tech unlocks potassium display, but students have no legible cause-and-effect loop. Two candidate directions: (A) add K fertilizer purchase, (B) make K's price penalty more visible at harvest so rotation becomes the implicit lever. Option B is pedagogically richer — connects to rotation/monoculture theme without new mechanics. Decision deferred to Slice 6 planning. See KNOWN_ISSUES #93.

### Late-Game Stakes (design direction TBD)

2026-03-10 — Successful diversified runs need foreshadowed catastrophe, not random punishment — Margin erosion alone doesn't create drama. Insurance/catastrophe layer with foreshadowing and mitigation choices is the right next lever. Candidates: crop insurance, pest/disease total loss events, community-rumor foreshadowing, mutual aid narrative choices. Connects to pellagra case study (monoculture vulnerability). See KNOWN_ISSUES #94, #95, #96.

### Content Pacing

2026-03-10 — Avocado unlock timing and Forum content gaps are pacing problems, not mechanic bugs — Avocado arrives too late (~Y20) for its 4-year establishment to matter. Forum has one storylet and then vanishes. Both need Slice 7 content work. See KNOWN_ISSUES #94, #95.

## Slice 6 Design Decisions

### Scoring System (6d)

2026-03-13 — 5-category weighted composite scoring — Financial stability (30%), soil health (20%), crop diversity (20%), climate adaptation (20%), consistency (10%). Raw scores normalized to 0-100, weighted sum produces total 0-100. Tier thresholds: Thriving ≥80, Stable ≥60, Struggling ≥40, Failed <40. Categories designed to reward resilient sustainable farming, not just maximum cash.

2026-03-13 — Completion code is human-readable, not encoded — Format: `PREFIX-SCORE-YYEARS-SCENARIO` (e.g., `NEAL-78-Y30-GW`). Screenshot-friendly backup artifact. Not a security mechanism — Google Sign-In authentication makes tamper-detection redundant. Originally planned as encoded/decodeable Google Form workflow, simplified after auth implementation.

2026-03-13 — Google Identity Services for result submission — @dtechhs.org students authenticate via Google Sign-In. Results POST to backend spreadsheet. Only school domain accounts accepted. Completion code serves as human-readable backup for students without Google access.

### Endgame Payoff (6e)

2026-03-14 — Derived metrics over tracked state — `estimateHumanFoodServings()` computes from existing `yearSnapshots.cropCounts` at display time. No new state fields, no save migration, works for all existing saves including in-progress classroom runs. Uses `cellCount × yieldPotential × humanServingsPerUnit` as a rough proxy — explicitly labeled as "estimated" throughout. The corn-vs-diversified contrast is dramatic regardless of precision.

2026-03-14 — Epilogue tone: warm, reflective, literary — King of Dragon Pass epilogue feel, shorter and anchored to simulation outcome. Not melodramatic, not jokey, not teacher-lecture. "This farm has a history now" → "here's what that history means." Four tiers × five scenarios × bankruptcy override = distinct narrative text. Lesson implicit in narrative; report card carries the explicit educational layer.

2026-03-14 — Advisor farewell alignment is deterministic from score components — Each advisor maps to exactly one score component: Santos→soil.raw, Chen→financial.raw, NWS→adaptation.raw, Forum→consistency.raw. Most aligned = met advisor with highest mapped score. Most contrasting = lowest (gap ≥20 required). Max 2 farewells. Skip section entirely when total advisor interactions < 2. Farewell text is static authored strings (16 variants: 4 advisors × 2 roles × 2 tiers), not generated prose.

2026-03-14 — Human food servings as secondary impact metric, not scored — Positioned after epilogue, before score table. Not part of the formal resilience score. Connects to "Food for All" unit theme. Three-way display: positive servings (celebratory), grew feed crops (silage corn contextual message), zero production (reflective). Never guilt-trippy or preachy.

2026-03-14 — EndgamePanel extracted from AutoPausePanel — Receives `{ state: GameState }` and derives everything internally (score, epilogue, hints, farewells, food servings). All existing `data-testid` values preserved for backward compatibility. AutoPausePanel delegates to `<EndgamePanel>` for bankruptcy/year_30 cases.

2026-03-14 — Graceful art fallback via onError — All image references (title hero, endgame art, event illustrations) use `onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}`. Entire slice functional without art files. Art is additive, not blocking.

2026-03-14 — Event illustrations on high-impact storylets only — Optional `illustrationId` field on Storylet type. Only 4 storylets get illustrations (heatwave, water restriction, rootworm, orchard disease) — pivotal moments that benefit from visual impact. EventPanel renders illustration above event title when present.

2026-03-14 — Per-category hints limited to max 2 weakest — Only categories where `raw < 60` are eligible. Returns the 2 weakest (by raw score), not just any 2 under 60. Each hint is one sentence: metric + implication + one lever. Uses actual player numbers where helpful (e.g., "Your soil OM averaged 1.2%"). Empty array if all categories ≥ 60 (strong player gets no unsolicited advice).
