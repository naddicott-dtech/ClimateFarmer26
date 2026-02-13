# Simulation Game Architecture Patterns — Reference

Source: Post-mortem research on well-architected simulation games.

## Gold Standard Examples

### Civilization IV — Split-Language Architecture
- C++ engine (performance), Python scripting (logic/UI), XML data (content)
- Key lesson: never hardcode content. Crops, events, techs belong in data files.

### King of Dragon Pass — Storylet System
- Pool of independent narrative events, each with trigger preconditions
- A "Selector" evaluates game state and picks the best-matching event
- Key lesson: decouple story from state. Small independent narrative chunks > giant if-else trees.

### Factorio — Deterministic Lockstep
- Fully deterministic simulation. Seeded RNG + same inputs = identical results.
- Data-oriented design for performance (contiguous arrays, cache-friendly).
- Key lesson: determinism enables replay, testing, and debugging. Memory layout matters for performance.

### RimWorld — Behavior Trees (Job/Toil)
- AI decisions broken into ThinkTree → Job → Toils (atomic micro-states)
- Interruptible at any toil boundary
- Key lesson: break behaviors into tiny, interruptible atomic states.

## Recurring Design Patterns

1. **Data-Driven Design** — Code defines behaviors, data files define content (JSON/XML). Used by Civ IV, RimWorld, Factorio.

2. **Entity-Component-System (ECS)** — Compose entities from independent data components instead of deep inheritance trees. Solves diamond problem, cache-friendly.

3. **Command Pattern** — UI creates command objects, engine validates and executes. Enables undo/redo, replay, multiplayer, and testability.

4. **Deterministic Lockstep** — Simulation advances in discrete ticks with seeded RNG. Enables replay files, automated testing, and multiplayer sync.

5. **Storylet/Quality-Based Narrative** — Pool of events with preconditions. Engine selects based on current game state. Produces emergent storytelling.

## Applicability to ClimateFarmer26

Most relevant patterns (in priority order):
1. **Data-Driven Design** — crops, events, techs as JSON data files
2. **Command Pattern** — UI emits commands, engine validates (enables testing + replay)
3. **Deterministic Lockstep** — seeded RNG for reproducible scenarios and testing
4. **Storylet System** — climate events triggered by game state conditions
5. **Layered Architecture** — State → Systems → Presentation (strict separation)
