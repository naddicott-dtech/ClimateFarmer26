# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ClimateFarmer26 is a browser-based educational simulation game where students role-play as California farmers across 30 years, making season-by-season decisions as climate impacts challenge their operations. 100% client-side, hosted on GitHub Pages, targeting Chromebooks.

**Status: Slice 7d complete ("Avocado Timing + UI Polish").** Slices 1-7d complete. 7d: separated avocado research from heat regime (early proactive Y10-14 $600, late catchup post-regime $800 with 90-day foreshadow), settings gear dropdown fix, forum thread formatting, scrollable event panels. 7c: soil crisis escalation, cover crop upgrade, insurance exit. 7a-7b: transparency + Forum/Santos content. `SAVE_VERSION = '9.0.0'`.

## Workflow Rules

Non-negotiable. Override any default AI coding behavior.

- **Blueprint first** — Produce a plan (user flows, data model, error handling, unknowns) and get Neal's approval before coding. Use plan mode.
- **TDD** — Write tests before implementation. Unit tests for engine logic, acceptance tests in SPEC.md.
- **`data-testid` on all interactive elements** — Descriptive kebab-case (e.g., `plant-corn-button`, `field-cell-3-7`). Enables Playwright and AI test agents.
- **Thin vertical slices** — Ship smallest end-to-end version first. Never build weeks of untested code.
- **Stop the line** — If something breaks, fix it before continuing. Every change must build and pass tests.
- **No guessing** — Missing info → ask Neal or label a TODO. Never invent requirements.
- **Proof, not promises** — Show it runs, show it works, show expected outputs.
- **Review your own output** — Second pass for spec compliance, edge cases, and "is this what Neal wanted?"
- **No UI stubs** — If a feature appears in the interface, it must work. Prefer fewer complete features over half-implemented ones.
- **Boring tech** — Well-known frameworks, common solutions. Novel architecture is a risk multiplier.
- **Neal controls git** — No commits, pushes, or branches without explicit request.

## Commands

```bash
npm run dev          # Dev server (http://localhost:5173)
npm run build        # Type-check + production build → dist/
npm run preview      # Serve production build (http://localhost:4173)
npm test             # Unit tests (vitest run)
npm run test:watch   # Unit tests in watch mode
npm run test:browser # Playwright browser tests (builds first)
npm run test:all     # Unit + browser tests
npx vitest run tests/engine/game.test.ts  # Single test file
npx vitest run -t "plants a crop"         # Tests matching pattern
```

**Deploy build:** After `npm run build`, copy output to docs/ for GitHub Pages:
```bash
rm -rf docs && cp -r dist docs
```

## Architecture

**Stack:** Preact + @preact/signals + TypeScript strict + Vite + Vitest + Playwright + CSS Modules

**Three-layer architecture:**

1. **Engine** (`src/engine/`) — Pure TypeScript, zero UI deps. Headless-testable.
   - `types.ts` — `GameState` root type, `Command` discriminated union, all constants
   - `game.ts` — `createInitialState()`, `processCommand()`, `simulateTick()`, `harvestCell()`, `pickMessage()`
   - `tech-levels.ts` — `getTechLevel()` reconvergence (water/soil/crop tracks 0-3)
   - `calendar.ts` — Day↔calendar. `STARTING_DAY=59` (March 1)
   - `weather.ts` — Deterministic daily weather from scenario + seeded RNG
   - `rng.ts` — Mulberry32 seeded PRNG
   - `scoring.ts` — `computeScore()`, `generateEpilogue()`, `generateCategoryHints()`, `generateAdvisorFarewells()`, `estimateHumanFoodServings()`
   - `events/` — Storylet system: `types.ts` (19 condition types, 10 effect types, optional `illustrationId`), `selector.ts` (seasonal draw + per-tick evaluation), `effects.ts`

2. **Adapter** (`src/adapter/`) — Bridges engine↔UI with Preact Signals.
   - `signals.ts` — `_liveState` (mutable) → `publishState()` via `structuredClone` → reactive `gameState` signal. `requestAnimationFrame` game loop, 12 ticks/sec × speed.
   - `observer.ts` — AI test agent affordances: `getBlockingState()`, `getActionState()`, `fastForwardUntilBlocked()`, `fastForwardDays()`
   - Debug hooks: `window.__gameDebug` — `setCash`, `setDay`, `setFlag`, `triggerEvent`, `getState`, `getBlockingState`, `fastForward`, `fastForwardUntilBlocked`, `fastForwardDays`, `getNotifications`, `dismissAllNotifications`, `getActionState`, `selectCell`, `setAutoPausePlanting`, `getPreferences`, etc.

3. **UI** (`src/ui/`) — Preact components + CSS Modules. Components: App, GameScreen, NewGameScreen, TopBar, FarmGrid, FarmCell, SidePanel, CropMenu, AutoPausePanel, EndgamePanel, NotificationBar, ConfirmDialog, Tutorial, EventPanel

**Data files** (`src/data/`): `crops.ts` (9 crops with yield curves, K uptake, heat sensitivity, `requiredFlag` gating, `humanServingsPerUnit`), `cover-crops.ts`, `scenarios.ts` (5 climate scenarios with `marketCrashTargetCropId`), `events.ts` (57 storylets: seasonal draw + condition-only advisors/tech/regime, 19 with `illustrationId`)

**Save system** (`src/save/storage.ts`): localStorage with corruption detection + V1→V9 migration chain. Auto-save on season change. Manual saves keyed by "Year N Season".

**Key patterns:**
- Command pattern for all player actions
- Seeded PRNG (separate weather RNG and event RNG)
- `structuredClone` for signal reactivity
- Storylet pattern for events/advisors (preconditions, foreshadowing, cooldowns)
- Fog-of-war via `state.flags` (chill hours, tech unlocks)
- Tech gating: `CropDefinition.requiredFlag`, `getTechLevel()` reconvergence
- Every outcome explains *why* it happened (cause-and-effect transparency)

## Project Documentation

These are living documents. **Update them when behavior changes** — stale docs are worse than no docs.

- `README.md` — How to install, run, and develop
- `SPEC.md` — Acceptance tests and requirements
- `ARCHITECTURE.md` — Full system design and data model
- `DECISIONS.md` — Decision log with rationale
- `KNOWN_ISSUES.md` — Bugs, limitations, technical debt
- `SeniorSoftwareEngineer.md` — Separate reviewer agent instructions (exclude from code review context)

## Codebase Exploration Tools

**jcodemunch MCP** — Use the local index (`local/ClimateFarmer26`) as default. Re-index after significant changes:
```
mcp__jcodemunch__index_folder(path="/Users/naddicott/ClimateFarmer26", incremental=true)
```

| Task | Tool |
|------|------|
| File symbols/signatures | `get_file_outline` |
| Find functions by name | `search_symbols` |
| Find references/usage | `Grep` or `search_text` |
| Cross-cutting concerns | `Grep` (regex + context lines) |
| Project structure | `get_repo_outline` / `get_file_tree` |
| Get function source | `get_symbol` |
| Deep multi-query research | `Agent` (subagent_type=Explore) |

Note: jcodemunch can't extract symbols from some files (data arrays, JSX, tests) — use `Grep` for those. `search_symbols` searches metadata only, not function bodies.

## Guardrails

- No server-side infrastructure (100% client-side, GitHub Pages)
- No storing sensitive student data
- No new dependencies without discussion
- Target hardware: Chromebooks (~$400 education models, 4-8GB RAM)
- Do not implement Slice 7+ features (insurance/credit, solar lease, glossary, automation policies) without explicit approval
