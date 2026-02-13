# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ClimateFarmer26 is a browser-based educational simulation game where students role-play as California farmers across multiple years, making season-by-season strategic decisions as climate impacts challenge their operations. A successful playthrough teaches diversification, water conservation, and forward-thinking agricultural practices. The student experience should be pleasant and focused on key decisions — many systems run on autopilot until the student opts into manual control.

**Status: Pre-development.** Tech stack decided. Architecture draft (ARCHITECTURE.md) under review. No code until blueprint is approved by Neal.

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
