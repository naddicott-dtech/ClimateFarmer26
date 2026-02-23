# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ClimateFarmer26 is a browser-based educational simulation game where students role-play as California farmers across multiple years, making season-by-season strategic decisions as climate impacts challenge their operations. A successful playthrough teaches diversification, water conservation, and forward-thinking agricultural practices. The student experience should be pleasant and focused on key decisions — many systems run on autopilot until the student opts into manual control.

**Status: Slice 1 complete.** Core farming loop (plant → grow → harvest → economy) fully implemented and tested. 105 unit tests, 38 Playwright browser tests, all passing.

## Workflow Rules

These are non-negotiable. They override any default AI coding behavior.

### No code without an approved blueprint
Before any feature work, produce a plan covering: user flows, data model, screens/endpoints, error handling, security basics, and a list of unknowns. Neal approves before coding begins. Use plan mode.

### TDD is non-negotiable
Write tests before implementation. Acceptance tests ("When I do X, I should see Y") define the contract in SPEC.md. Unit tests for simulation logic are written before the code they test. No exceptions.

### All interactive UI elements must have data-testid attributes
Every clickable, typeable, or otherwise interactive DOM element gets a descriptive `data-testid` (e.g., `data-testid="plant-corn-button"`, `data-testid="field-cell-3-7"`). This enables automated testing by headless browsers and AI test agents. Semantic, intuitive naming — a tester reading the test IDs should understand the UI without seeing it.

### Build in thin vertical slices
Ship the smallest end-to-end version first. Then add one slice per change. Never build "weeks of code" that gets tested at the end.

### Every change must build, run, and pass tests
If something breaks, the next action is **fix it** — not continue building features. This is the stop-the-line rule.

### No guessing — uncertainty must be explicit
If information is missing (game rules, UI copy, business logic, API details), **ask Neal or label a TODO**. Never invent requirements or fill gaps with assumptions.

### Provide proof, not promises
Every completed piece of work needs: a way to run it, a way to verify it works, and expected outputs. "It works" without evidence is not done.

### Review your own output
After producing code, do a second pass checking: spec compliance, missing edge cases, security issues, and "does this actually do what Neal wanted?"

### Prefer boring, mainstream tech
Use well-known frameworks, starter kits, and deployment paths. Novel architecture is a risk multiplier. When in doubt, pick the most common solution.

### Neal controls git
Do not commit, push, or create branches/PRs unless Neal explicitly asks. This folder may not even have a git repo initialized.

## Commands

```bash
npm run dev          # Dev server (http://localhost:5173)
npm run build        # Type-check + production build (tsc -b && vite build)
npm run preview      # Serve production build (http://localhost:4173)
npm test             # Unit tests (vitest run) — 105 tests
npm run test:watch   # Unit tests in watch mode
npm run test:browser # Playwright browser tests — 38 tests (builds first)
npm run test:all     # Unit + browser tests
npx vitest run tests/engine/game.test.ts  # Run a single test file
npx vitest run -t "plants a crop"         # Run tests matching a name pattern
```

## Architecture (Slice 1)

**Stack:** Preact + @preact/signals + TypeScript strict + Vite + Vitest + Playwright + CSS Modules

**Three-layer architecture:**

1. **Engine** (`src/engine/`) — Pure TypeScript, zero UI deps. All game logic lives here. Testable headlessly.
   - `types.ts` — All game state types and constants. `GameState` is the root type.
   - `game.ts` — Core: `createInitialState()`, `processCommand()`, `simulateTick()`. Commands are discriminated unions (`Command` type).
   - `calendar.ts` — Day↔calendar conversion. Game starts at `STARTING_DAY=59` (March 1).
   - `weather.ts` — Deterministic daily weather from `ClimateScenario` + seeded RNG.
   - `rng.ts` — Mulberry32 seeded PRNG with save/restore state.

2. **Adapter** (`src/adapter/signals.ts`) — Bridges engine↔UI with Preact Signals.
   - `_liveState` is mutable (engine mutates it). `publishState()` creates a `structuredClone` for the reactive `gameState` signal.
   - Game loop: `requestAnimationFrame`-based, 12 ticks/sec × speed multiplier.
   - All player actions go through `dispatch()` → `processCommand()`.

3. **UI** (`src/ui/`) — Preact components + CSS Modules. Reads computed signals, calls adapter functions.
   - Components: App, GameScreen, NewGameScreen, TopBar, FarmGrid, FarmCell, SidePanel, CropMenu, AutoPausePanel, NotificationBar, ConfirmDialog, Tutorial

**Data files** (`src/data/`): `crops.ts` (3 crops), `scenario.ts` (30-year climate scenario)

**Save system** (`src/save/storage.ts`): localStorage with corruption detection, auto-save on season change

**Key patterns:**
- Command pattern for all player actions (discriminated union `Command` type)
- Seeded PRNG for deterministic simulation (Mulberry32)
- `structuredClone` for signal reactivity (engine mutates, adapter clones)
- Every interactive element has `data-testid` for Playwright

## Project Memory

These files are the project's living documentation. Update them as work progresses:

- `README.md` — How to install, run, and develop
- `SPEC.md` — Acceptance tests and requirements (the "contract")
- `ARCHITECTURE.md` — System design, data model, tech stack decisions
- `DECISIONS.md` — Log of key decisions and their rationale
- `KNOWN_ISSUES.md` — Bugs, limitations, and technical debt

## Architecture Principles

These come from post-mortem analysis of the previous attempt and research on well-built simulation games. Reference material in `reference/`.

- **Engine/UI separation is mandatory.** The simulation engine must run headlessly with zero UI dependencies. All game logic testable without a browser.
- **Command pattern for all player actions.** UI emits command objects; engine validates and executes. No direct state mutation from UI. Enables testing and deterministic replay.
- **Data-driven content.** Crops, technologies, events, and economic parameters live in data files (JSON), not hardcoded in logic.
- **Deterministic simulation.** Seeded RNG so that identical inputs produce identical outputs. Enables reproducible test scenarios and "replay a student's broken game" debugging.
- **Storylet pattern for events.** Climate/market events are independent chunks with preconditions, not a giant if-else tree. The engine selects events based on current game state.
- **No stubs in the UI.** If a feature appears in the interface, it must work. Prefer fewer complete features over many half-implemented ones.
- **Bulk actions from day one.** Students must never click 100 times for routine work. Row/column/field-level actions are mandatory, not stretch goals.
- **Cause-and-effect transparency.** Every outcome the student sees must explain *why* it happened in plain language.

## Files to Exclude from Code Review Context

- `SeniorSoftwareEngineer.md` — Role instructions and notes for a separate reviewer agent. Not part of the codebase.

## Guardrails

This section will grow as the project takes shape. Current rules:

- No server-side infrastructure beyond what's absolutely necessary (favor client-side logic)
- No storing sensitive student data
- Allowed integrations TBD (e.g., Google Sheets, Supabase) — do not add without approval
- Do not add dependencies without discussing them first
- Target hardware: Chromebooks. Performance budgets will be defined during architecture phase.
- No new mechanics until the core loop (plant → grow → harvest → money → next season) is fully working and tested.
