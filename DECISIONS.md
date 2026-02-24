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

2026-02-12 — Result reporting via completion code + Google Form — Zero server dependency.

## Game Design

2026-02-12 — Setting: San Joaquin Valley, California — Most productive agricultural region; rich crop diversity; faces severe climate change impacts.

2026-02-12 — 30-year playthrough — Enough years to see long-term consequences. Retirement event at year 30.

2026-02-12 — Variable-speed simulation (not turn-based) — Pausable real-time: 0×/1×/2×/4×. Auto-pause for events. ~30 sec per year at 1x. Inspired by RimWorld/Factorio, not Civilization.

2026-02-12 — 8x8 grid (64 cells), abstract plots — Bulk operations: plant/harvest/water all/row/column. Solar lease can convert cells.

2026-02-12 — Pre-rendered climate scenarios (not real-time climate model) — Pool of 5-8 30-year weather tracks. Random selection from recently-unplayed. Students can't predict scenarios.

2026-02-12 — Fog-of-war tech tree (event-driven, not budget-driven) — Students don't see full tech tree. Problems reveal branches (King of Dragon Pass style). Investment unlocks tiers. Retrospective view fills in over time.

2026-02-12 — 12 crops + cover crop strategies — 7 current SJV crops + 5 future/adaptive crops. Future crops unlock via tech tree events. Data-driven (JSON definitions, generic engine).

2026-02-12 — N/K/Zn nutrient tracking — Nitrogen (yield), Potassium (quality/defense), Zinc (critical checkpoint). Detection gated by tech investment. Without monitoring: narrative hints only.

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

2026-02-12 — Manual "weekly dose" watering with first-per-season auto-pause (DD-5) — Each Water action provides ~14 days of moisture. Auto-pause fires once per season when moisture first drops below 25% capacity. Visual warnings at 30% (yellow) and 15% (red/wilting) without pausing. Low-tech "garden hose sprinkler" level. Irrigation upgrades and water rights trading are Slice 3+ tech tree.

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
