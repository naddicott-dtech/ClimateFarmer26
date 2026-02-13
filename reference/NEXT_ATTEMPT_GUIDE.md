# California Climate Farmer — What to Salvage + Better Plan for a Fresh Start

Audience: Science teacher planning a classroom-ready farm/ecology simulation.

## 1) What is worth salvaging from this repo

Even though the project is frustrating right now, several ideas are genuinely useful:

1. **Core simulation separated from UI (good architectural instinct).**
   - The project's design intent to keep a headless simulation engine and separate browser UI is exactly the right direction for simulation games.
2. **Data-driven content files.**
   - Crops, technologies, and events are structured as independent modules. This is a solid pattern for future balancing and curriculum customization.
3. **Automated strategy testing concept.**
   - A test harness that runs "farmer strategies" in bulk is a smart way to tune economics and detect broken systems.
4. **Clear educational intent.**
   - The documentation keeps focus on climate adaptation, sustainability tradeoffs, and ecology outcomes (soil/water/technology).
5. **Research-backed formulas already gathered.**
   - The TDD contains a useful shortlist of agronomy/economics formulas to migrate into a cleaner v2.

## 2) What went wrong (in plain language)

### A. Playability was treated as "later"
A simulation for students lives or dies on usability. The docs themselves admit bulk actions are crucial, but this remained unfinished.

### B. Balancing happened before game-loop correctness was fully locked
There is still at least one critical state bug pattern in the loop (season-day state is incremented but not initialized in constructor), which can quietly break season logic and anything tied to season transitions.

### C. Too many mechanics were declared, too few were completed
Many major systems are listed as planned (labor, water rights, nutrient cycles, rotation, etc.). That is okay for roadmap docs, but if the Classroom-Ready Build shipped with major stubs, classroom play suffers.

### D. Test framework existed, but success criteria were not "human fun + clarity"
The test harness checks survivability and balances, but there was no hard release gate for "a human can play this without tedious clicking."

## 3) "Words of wisdom" for your next coding AI agent

Use this as a strict brief to avoid over-engineered but unplayable output:

1. **"No new feature without a playable user path."**
   - Every PR must include the exact clicks a student can do in <2 minutes.
2. **"Freeze architecture early, freeze mechanics narrowly."**
   - Build only one complete loop first: plant → wait/grow → harvest → money change → next season.
3. **"Definition of Done includes UX, not just logic."**
   - A mechanic is not done unless it is understandable in UI and can be used at classroom pace.
4. **"Balance after correctness."**
   - Do not tune economics until time/season/event state transitions are fully tested.
5. **"Prefer vertical slices over wide stubs."**
   - One fully working crop system beats five half-implemented systems.
6. **"Guardrails over genius."**
   - Require invariants/tests for core states: date progression, economy updates, and event resolution.
7. **"If a player must click 100 times for routine work, UX is failing."**
   - Bulk actions and clear action modes are mandatory, not stretch goals.
8. **"Use deterministic test seeds before random balancing."**
   - Randomness is valuable later; reproducibility is essential first.

## 4) Tried-and-true simulation patterns (inspired by mature strategy games)

You do **not** need Civ-scale complexity to use Civ-like discipline.

1. **Layered model (State → Systems → Presentation).**
   - State: pure data.
   - Systems: rules that mutate state (economy, climate, growth).
   - Presentation: UI rendering only.

2. **Turn/phase pipeline with invariants.**
   - Example phases: player actions → simulation tick → events → scoring → render.
   - Add assertions after each phase (no NaN values, balances finite, dates valid).

3. **Single source of truth for rules.**
   - Crop and tech effects should be data + pure functions, not split logic in UI and engine.

4. **AI/autoplay as first-class test client.**
   - Keep strategy bots, but use them for regression checks, not as proof of classroom UX.

5. **Scenario-based acceptance tests.**
   - "Drought year scenario," "subsidy policy scenario," etc., each with expected outcomes.

6. **Readable feedback loops.**
   - Players should always know *why* money, yield, or soil changed ("because heatwave + low irrigation").

## 5) A practical fresh-start plan (teacher-friendly)

### Phase 1 — 2-week "Playable Core" (no extras)
- 3 crops only.
- 1 water mechanic.
- 1 soil health meter.
- 3 events (drought, price drop, subsidy).
- Bulk actions from day one.
- End-of-season summary panel explaining outcomes.

### Phase 2 — Validation for classroom use
- 5–10 student playtests (short sessions).
- Track confusion points and click-fatigue.
- Require "students can complete one in-game year without instructor rescue."

### Phase 3 — Depth expansion
- Add tech tree and richer economics only after phase-1 metrics pass.
- Add one subsystem at a time with tests + UI explanation.

## 6) Suggested non-negotiable release checklist for future AI work

- [ ] Can start game and perform full crop cycle without errors.
- [ ] Bulk plant/irrigate/harvest works on row, column, and whole field.
- [ ] Date/season/year progression is tested.
- [ ] Event effects are visible and explained.
- [ ] Economy cannot silently produce invalid numbers.
- [ ] At least one deterministic simulation test suite passes in CI.
- [ ] One human playability script (manual QA) passes.

## 7) "Prompt contract" you can paste to future coding agents

> Build only a **classroom-playable vertical slice**. Prioritize stability, clarity, and reduced clicks over extra mechanics. Do not ship stubbed systems in the UI. A feature is done only if: (1) deterministic tests pass, (2) a student can use it without hidden controls, and (3) the game explains cause/effect of outcomes in plain language.

## 8) Gold standard vs. last attempt (planning visualization)

Use this table as a pre-build architecture checkpoint. If a row in the right column is still true, do not expand scope yet.

| Area | Gold standard pattern (from major sim games) | Last attempt pattern (what happened here) | Risk to classroom use | Next-attempt decision gate |
|---|---|---|---|---|
| Core architecture | **Engine/UI separation** with strict boundaries (state/systems/presentation). | Separation existed in concept, but gameplay quality still depended on incomplete UI workflows. | Students cannot complete routine tasks quickly. | Do not add new mechanics until full farm loop is smooth in UI. |
| Content modeling | **Data-driven content** (units/crops/tech/events in data files, not hardcoded). | Strong start on data modules. | Moderate (good salvage point). | Keep this pattern and add schema validation for content files. |
| Command flow | **Command pattern** (UI emits commands; engine validates/applies). | UI actions largely call simulation methods directly. | Harder to support undo/replay and robust input validation. | Introduce command queue for all player actions before adding complexity. |
| Tick processing | **Deterministic turn/tick pipeline** with seeded randomness. | Tick loop exists, but deterministic controls are not first-class. | Harder to debug classroom issues and reproduce bugs. | Require seeded runs and repeatable scenario tests before balancing passes. |
| Story/events | **Storylet/condition-driven events** (small event chunks + selector). | Event system present, but pedagogical clarity and trigger explainability are uneven. | Students may not understand "why this happened." | Every event must display trigger + effect in plain language. |
| Feature scope | **Vertical slice first** (small but complete). | Broad roadmap with several major systems still not implemented. | High confusion and "half-feature" user experience. | Freeze to 3 crops + 3 events + complete UX before adding subsystems. |
| Performance discipline | **Data-oriented thinking** for hot loops (especially mobile/lower-end devices). | Usability and architecture improved in places, but no explicit Chromebook performance budget/gates. | Lag/stutter can derail class time. | Define hard budgets (tick ms, memory, FPS) and test on low-end profile. |
| Testing truth source | **Automated + human playability gates** both required. | Headless strategy tests existed; human UX gate was not strict enough. | "Passes tests but not playable" outcome. | Add mandatory classroom play script to release checklist. |

## 9) Chromebook-first architecture guidance (for one-farm scope)

You are absolutely right to prioritize optimization early, even with smaller scope. A stable 30+ FPS and responsive UI on school hardware is a design choice, not a final polish step.

### A. Set performance budgets at project start
- **Simulation tick budget:** target ≤ 4 ms average on low-end Chromebook profile.
- **Render budget:** target ≤ 12 ms average (for smooth ~60 FPS when possible, acceptable fallback 30 FPS).
- **Memory budget:** keep active runtime well below typical tab pressure limits (avoid large transient allocations each tick).

### B. Prefer simple data layouts in hot paths
- Keep per-cell state in compact, predictable structures.
- Avoid repeatedly creating temporary objects inside the main update loop.
- Batch updates where possible (e.g., update all cells, then apply queued visual changes).

### C. Decouple simulation rate from render rate
- Run simulation at fixed ticks (e.g., 5–10 ticks/sec for your classroom game).
- Render independently with `requestAnimationFrame`.
- If device slows down, preserve simulation correctness first, then degrade visuals gracefully.

### D. Use command queue + validation
- UI should issue commands (`Plant`, `Irrigate`, `HarvestBulk`), not mutate state directly.
- Engine validates commands in one place; this prevents hidden desync bugs and simplifies replay/testing.

### E. Add deterministic replay early
- Seeded RNG + command log = reproducible sessions.
- This is invaluable when a student reports "my farm broke" and you need to replay exactly what happened.

### F. Optimize for low-click classroom flow
- Bulk row/column/field actions are mandatory from day one.
- Add keyboard shortcuts and clear mode indicators.
- End each season with a short explanation panel: "What changed and why."

### G. Minimum "ready for students" technical gate
- Passes deterministic scenario tests.
- Passes 20-minute manual play script on Chromebook without lag spikes that disrupt play.
- No blocking UI bugs in core loop (plant/irrigate/harvest/next season).
