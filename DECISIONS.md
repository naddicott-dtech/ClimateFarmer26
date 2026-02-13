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

2026-02-12 — Variable-speed simulation (not turn-based) — Pausable real-time: 0x/0.5x/1x/2x/4x. Auto-pause for events. ~30 sec per year at 1x. Inspired by RimWorld/Factorio, not Civilization.

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
