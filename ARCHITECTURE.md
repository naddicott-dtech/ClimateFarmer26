# ARCHITECTURE.md — Technical Design Document (Draft)

> **Status: DRAFT — Under discussion. Not approved for implementation.**
> Cross-references: `reference/SIMULATION_PATTERNS.md`, `reference/BackgroundDeepResearch.md`

## 1. Overview

**ClimateFarmer26** is a browser-based educational simulation game set in California's San Joaquin Valley. Students role-play as farmers over 30 in-game years, making strategic decisions about crops, technology, and land use as climate change reshapes agriculture. The game runs entirely client-side and targets Chromebook hardware.

**Design philosophy:** Small number of well-built *systems* that operate on a large amount of *data*. Adding a new crop or event should require a JSON entry, not new code.

## 2. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Language | TypeScript (strict mode) | Type safety for complex game state |
| UI Framework | Preact | React API, ~3KB, Chromebook-friendly |
| UI State | Preact Signals (`@preact/signals`) | Lightweight reactivity, no extra library |
| Build Tool | Vite | Fast builds, pairs with Vitest |
| Unit Tests | Vitest | Fast headless TDD for simulation engine |
| Browser Tests | Playwright | Chromium-based, data-testid support |
| CSS | CSS Modules | Scoped, zero runtime cost |
| Hosting | GitHub Pages | Free static hosting |
| Result Reporting | Completion code → Google Form | Zero server dependency |

## 3. Performance Budget

### Target Hardware: 2023 Education Chromebook (~$400)
- **CPU:** Intel N100/N200 or Celeron N4500 (low single-thread performance)
- **RAM:** 4–8 GB total (Chrome OS + browser tabs consume ~2 GB; our game gets ~500 MB–1 GB)
- **Display:** 1366x768 (common) to 1920x1080
- **GPU:** Integrated (Intel UHD or equivalent)
- **Context:** Students likely have 3–5 other tabs open (Google Classroom, Docs, etc.)

### Budgets
| Metric | Target | Hard Limit |
|--------|--------|------------|
| Simulation tick (1 day) | ≤2 ms | ≤4 ms |
| DOM render update | ≤8 ms | ≤16 ms (60fps) |
| Total frame budget | ≤12 ms | ≤33 ms (30fps) |
| JS bundle (gzipped) | ≤100 KB | ≤200 KB |
| Memory (runtime heap) | ≤50 MB | ≤100 MB |
| Initial page load | ≤2 seconds | ≤4 seconds |
| Largest Contentful Paint | ≤1.5 seconds | ≤3 seconds |

### Performance Design Rules
- **2D graphics only.** No WebGL, no 3D rendering. CSS + DOM + optional small canvas overlays for visual effects (weather animations).
- **64-cell grid = 64 DOM elements.** Trivial for any browser. No virtual scrolling needed.
- **Simulation ticks are pure math.** No DOM access, no allocation-heavy operations in the hot path.
- **Batch DOM updates.** Simulation runs N ticks, then UI reads final state once per animation frame.
- **No per-tick object allocation.** Reuse structures. Avoid creating temporary objects in the simulation loop.
- **Decouple sim rate from render rate.** At 4x speed (48 ticks/sec), the engine runs ~2 ticks per frame at 30fps. UI renders once per frame, not per tick.

## 4. Architecture Layers

Following the **State → Systems → Presentation** pattern from proven simulation games (Factorio, Civ IV, RimWorld):

```
┌─────────────────────────────────────┐
│          PRESENTATION (UI)          │  Preact components + CSS Modules
│  Renders state. Emits commands.     │  Knows nothing about game rules.
│  All interactive elements have      │
│  data-testid attributes.            │
├─────────────────────────────────────┤
│          ADAPTER LAYER              │  Preact Signals that expose
│  Bridges engine state → UI state.   │  engine state reactively.
│  Translates UI actions → commands.  │
├─────────────────────────────────────┤
│          SYSTEMS (Engine)           │  Pure TypeScript. Zero DOM deps.
│  Game rules. Processes commands.    │  Fully testable headlessly.
│  Advances simulation ticks.         │  Deterministic with seeded RNG.
│  Evaluates event/storylet triggers. │
├─────────────────────────────────────┤
│          STATE (Data)               │  Plain TypeScript objects/arrays.
│  Farm grid, economy, soil, weather, │  Serializable (for save/load).
│  tech tree, event history.          │  Single source of truth.
├─────────────────────────────────────┤
│          CONTENT (JSON)             │  Crop definitions, event pools,
│  Data files loaded at startup.      │  climate scenarios, advisor
│  No game logic in data files.       │  dialogue, tech descriptions.
└─────────────────────────────────────┘
```

### Key boundary rules:
- **UI → Engine:** Only via Command objects (e.g., `PlantCropCommand`, `BuyTechCommand`). Never direct state mutation.
- **Engine → UI:** Only via readable state (Signals). Engine never touches DOM.
- **Content → Engine:** Engine reads JSON data files. Content files contain parameters, never logic.
- **Engine is headless-testable.** All game logic can run in Vitest without a browser.

## 5. Core Systems

### 5.1 Simulation Clock

The game runs on a **variable-speed tick loop** inspired by Factorio/RimWorld:

- **Internal time unit:** 1 tick = 1 in-game day
- **Speed settings:** Paused (0x), Slow (0.5x), Normal (1x), Fast (2x), Fast-Forward (4x)
- **Target pacing at 1x:** ~1 in-game year per 30 real seconds → ~12 ticks per real second
- **Auto-pause triggers:** Events requiring player decision, empty fields needing planting, advisor interrupts, harvest-ready notifications, critical warnings
- **Manual pause:** Player can pause anytime
- **Headless mode:** Unlimited tick rate (for automated testing)

```
Game Loop (per animation frame):
  1. Calculate how many ticks to simulate this frame (based on speed + elapsed time)
  2. For each tick:
     a. Advance calendar (day → month → season → year)
     b. Run weather system (read from scenario)
     c. Run crop growth system (GDD accumulation, water balance)
     d. Run soil system (nutrient cycling, erosion, OM changes)
     e. Run event selector (check storylet preconditions)
     f. Process automation policies
     g. Run economy system (daily costs like irrigation energy)
     h. Check interrupt conditions (auto-pause triggers)
     i. If interrupt triggered → break, set paused, queue notification
  3. Push final state to UI (Signals update → Preact re-renders)
```

### 5.2 Command System

All player actions flow through a command queue (Command Pattern):

```typescript
// Discriminated union — each command type is fully typed. Adding a new
// command type causes compile errors everywhere it isn't handled yet.
type Command =
  | { type: "PLANT_CROP"; day: number; row: number; col: number; cropId: string }
  | { type: "HARVEST"; day: number; row: number; col: number }
  | { type: "HARVEST_BULK"; day: number; scope: "all" | "row" | "col"; index?: number }
  | { type: "PLANT_BULK"; day: number; scope: "all" | "row" | "col"; index?: number; cropId: string }
  | { type: "WATER"; day: number; scope: "all" | "row" | "col" | "cell"; row?: number; col?: number }
  | { type: "BUY_TECH"; day: number; techId: string; tier: number }
  | { type: "SET_AUTOMATION"; day: number; scope: "cell" | "row" | "col" | "farm"; policy: AutomationPolicy; row?: number; col?: number }
  | { type: "RESPOND_EVENT"; day: number; eventId: string; choiceId: string }
  | { type: "BUY_INSURANCE"; day: number }
  | { type: "TAKE_LOAN"; day: number; amount: number }
  | { type: "SET_COVER_CROP"; day: number; row: number; col: number; coverCropId: string | null }
  | { type: "SET_SPEED"; day: number; speed: 0 | 0.5 | 1 | 2 | 4 };
```

The engine validates each command before execution (Do you have enough cash? Is the cell empty? Is the tech available?). Invalid commands are rejected with a typed reason. The discriminated union ensures exhaustive handling — the TypeScript compiler flags any unhandled command type.

**Note on scope:** The full discriminated union is defined here for architectural completeness. Slice 1 implements only: `PLANT_CROP`, `PLANT_BULK`, `HARVEST`, `HARVEST_BULK`, `WATER`, and `SET_SPEED`. Other command variants are added in the slice where their system is built.

**Benefits:**
- **Testability:** Issue a sequence of commands in headless tests to reproduce any game state
- **Determinism:** Same scenario seed + same commands = identical game state (enables automated balance testing)
- **AI test agents:** Headless tests issue commands, not DOM clicks
- **Type safety:** No `unknown` payloads; every command's data is checked at compile time

### 5.3 Climate Scenario System

Climate is **pre-rendered as seasonal parameters, not daily entries.** Each scenario defines 30 years of seasonal climate profiles. The engine generates daily weather deterministically from these parameters using the scenario's seeded RNG. This keeps scenario files small (~5-10 KB each) while producing realistic day-to-day variability.

```typescript
interface ClimateScenario {
  id: string;
  name: string;                        // e.g., "Gradual Warming"
  description: string;                 // post-game reveal
  seed: number;                        // RNG seed for daily weather generation
  years: YearClimate[];                // 30 entries
  metadata: {
    droughtYears: number[];            // for balance testing
    floodYears: number[];
    heatwaveYears: number[];
    severityRating: number;            // 1-5 difficulty
  };
}

interface YearClimate {
  year: number;                        // 1-30
  seasons: {
    spring: SeasonParams;
    summer: SeasonParams;
    fall: SeasonParams;
    winter: SeasonParams;
  };
  events: ScenarioEvent[];            // specific triggered events this year
  chillHours: number;                  // accumulated winter chill (affects perennials)
  waterAllocation: number;             // 0-1 fraction of normal allocation
}

interface SeasonParams {
  avgTempHigh: number;                 // °F
  avgTempLow: number;                  // °F
  tempVariance: number;                // daily deviation range
  precipProbability: number;           // 0-1 chance of rain any given day
  precipIntensity: number;             // inches when it rains
  avgET0: number;                      // reference evapotranspiration
  heatwaveProbability: number;         // 0-1 chance of multi-day heat event
  frostProbability: number;            // 0-1 chance of frost event
  windAvg: number;                     // mph average (for erosion/fire risk)
}
```

**Daily weather generation:** Each tick, the engine generates that day's weather from the current season's parameters using the scenario seed. Same seed + same parameters = identical daily weather on every run. This is how determinism is maintained without storing 10,950 daily entries.

**Data size budget:** 30 years x 4 seasons x ~10 params = ~1,200 numbers + events. At ~10 KB per scenario, 8 scenarios = ~80 KB total. Well within bundle limits. Scenarios can be bundled or lazy-loaded on game start.

**Scenario selection:** On new game, pick randomly from scenarios the student hasn't played recently (tracked in localStorage). Students cannot predict which scenario they'll get.

**Scenario pool for Classroom-Ready Build:** 5–8 scenarios covering a range:
- Gradual warming (manageable with adaptation)
- Early severe drought (tests early-game resilience)
- Whiplash pattern (drought-flood-drought cycles)
- Late-game heat escalation (manageable early, harsh later)
- Relatively mild (to allow some students to succeed more easily)

**Balance testing:** Automated headless tests run generic strategies against ALL scenarios. A corn monoculture should fail in drought-heavy scenarios. A well-diversified adaptive strategy should survive most.

### 5.4 Event / Storylet System

The unified system that drives **narrative events, tech tree progression, advisor appearances, and the solar lease storyline.** Inspired by King of Dragon Pass.

```typescript
interface Storylet {
  id: string;
  type: "climate" | "market" | "tech_unlock" | "advisor" | "solar" | "regulatory";
  preconditions: Condition[];        // ALL must be true to be eligible
  priority: number;                  // higher = more likely to be selected
  cooldownDays: number;              // minimum days before this can fire again
  foreshadowing?: Foreshadowing;     // optional early warning signal
  choices: Choice[];                 // what the player can do
  autoResolve?: Resolution;          // what happens if player ignores / time expires
  tags: string[];                    // for filtering/categorization
}

interface Condition {
  type: "state_check" | "calendar" | "random" | "scenario_trigger";
  // Examples:
  // { type: "state_check", field: "economy.cash", op: "<", value: 10000 }
  // { type: "calendar", season: "spring" }
  // { type: "state_check", field: "farm.cropFailures5yr", op: ">=", value: 2 }
  // { type: "scenario_trigger", eventId: "drought_2031" }
}

interface Foreshadowing {
  signal: string;                    // narrative text shown to player
  daysBeforeEvent: number;           // how far in advance
  reliability: number;               // 0-1; <1 means sometimes a false alarm
  advisorSource?: string;            // which advisor delivers this signal
}

interface Choice {
  id: string;
  label: string;                     // what the player sees
  cost?: number;                     // cash cost
  effects: Effect[];                 // what happens
  unlocks?: string[];                // tech tree nodes revealed
  advisorRecommends?: string;        // which advisor recommends this
}
```

**The event loop each tick:**
1. Gather all storylets whose preconditions are met
2. Remove any on cooldown
3. Check foreshadowing: if an event is N days away and has foreshadowing, emit the signal now
4. If multiple events are eligible, select by priority (with weighted randomness)
5. If selected event requires player input → auto-pause, show event panel
6. If auto-resolve → apply effects silently (or with notification)

**Tech tree integration:** A `tech_unlock` storylet fires when the player encounters a problem (e.g., fruit drop → zinc deficiency). The choices include investment options that reveal new branches. The tech tree VIEW is a retrospective visualization of which `tech_unlock` storylets have fired and how the player responded.

**Solar lease integration:** A multi-storylet chain:
1. `solar_option` — precondition: low cash OR frequent crop failures. The landman offers an option agreement.
2. `solar_proceed` — precondition: solar option accepted AND random chance (permits approved). Construction begins.
3. `solar_operations` — precondition: construction complete. Steady income begins.
4. `solar_agrivoltaics` — precondition: solar operations active AND tech knowledge. Player can negotiate dual-use.

### 5.5 Farm Grid

8x8 grid (64 cells). Each cell has independent state:

```typescript
interface Cell {
  row: number;                       // 0-7
  col: number;                       // 0-7
  crop: CropInstance | null;         // what's planted
  soil: SoilState;                   // nutrients, OM, water
  status: "farmable" | "solar_option" | "solar_construction" | "solar_active";
  coverCrop: CoverCropType | null;   // off-season choice
  automationPolicy: AutomationPolicy | null; // e.g., "replant_same"
}

interface CropInstance {
  cropId: string;                    // references crop definition JSON
  plantedDay: number;                // when planted
  gddAccumulated: number;           // growth progress
  waterStressDays: number;           // cumulative stress
  nutrientStress: NutrientStress;    // N, K, Zn deficiency tracking
  growthStage: "seedling" | "vegetative" | "flowering" | "mature" | "harvestable" | "overripe";
  isPerennial: boolean;
  perennialAge?: number;             // years since establishment
  perennialEstablished?: boolean;    // producing fruit yet?
}

interface SoilState {
  nitrogen: number;                  // lbs/acre equivalent
  potassium: number;                 // lbs/acre equivalent
  zinc: number;                      // ppm equivalent (micronutrient)
  organicMatter: number;             // percentage (affects water retention + nutrient release)
  moisture: number;                  // current water level
  moistureCapacity: number;          // max water (function of OM)
  erosionRisk: number;               // 0-1 based on cover and practices
}
```

**Bulk operations:** "Plant All," "Plant Row N," "Plant Column N," "Harvest All," "Water All," and equivalents. Each translates to multiple commands issued atomically.

### 5.6 Nutrient & Soil System

Three-tier nutrient model (N → K → Zn) with detection gated by tech investment:

| Nutrient | Role | Visibility Without Tech | With Tech |
|----------|------|------------------------|-----------|
| **Nitrogen (N)** | Yield volume ("gas pedal") | Narrative hints: "crops look pale" | Exact levels, drone heatmap, VRA prescriptions |
| **Potassium (K)** | Quality/defense | Ambiguous hints: "leaf edges look scorched" (could be drought) | Hyperspectral distinction, specific treatment options |
| **Zinc (Zn)** | Critical checkpoint (fruit set) | Surprise event: "fruit dropping off trees" (too late this year) | Historical data analysis, preventive application |

**Daily soil update per cell:**
```
N(t+1) = N(t) + fertilizer_applied + legume_fixation + OM_mineralization
         - crop_uptake - leaching_loss
K(t+1) = K(t) + fertilizer_applied - crop_removal    (slower cycling)
Zn(t+1) = Zn(t) + amendment_applied - crop_removal   (very slow cycling)
OM(t+1) = OM(t) + residue_input + compost - decomposition_rate * OM(t)
moisture(t+1) = moisture(t) + irrigation + rain - ET - drainage
moistureCapacity = base_capacity + OM_bonus           (per 1% OM ≈ +0.8in)
```

**Over-application consequences:** Excess N → regulatory fine event (nitrate leaching). This teaches that more fertilizer is not always better.

### 5.7 Crop System

Crops are **data-driven definitions** loaded from JSON. The engine processes them generically:

```typescript
interface CropDefinition {
  id: string;
  name: string;
  type: "annual" | "perennial";
  category: "current" | "future";

  // Growth
  gddBase: number;                   // base temperature (°F)
  gddToMaturity: number;             // GDD sum needed
  plantingWindow: { startMonth: number; endMonth: number };
  harvestWindow?: { startMonth: number; endMonth: number };

  // Water
  waterUsePerDay: number;            // inches (at full Kc)
  cropCoefficients: { stage: string; kc: number }[];
  ky: number;                        // yield response to water stress

  // Nutrients
  nitrogenUptake: number;            // lbs/acre at full yield
  potassiumUptake: number;
  zincSensitivity: number;           // 0-1; higher = more vulnerable to Zn deficiency

  // Economics
  yieldPotential: number;
  yieldUnit: string;
  basePrice: number;
  priceVolatility: number;           // 0-1
  laborHoursPerAcre: number;
  seedCostPerAcre: number;

  // Perennial-specific
  yearsToEstablish?: number;
  productiveLifespan?: number;
  removalCost?: number;
  chillHoursRequired?: number;

  // Cover crop interactions
  canDoubleCrop?: boolean;
  doubleCropWith?: string[];         // crop IDs that can follow this

  // Descriptions (for Glossary)
  shortDescription: string;
  glossaryEntry: string;             // detailed educational content
  realWorldNotes: string;            // ties to actual CA agriculture
}
```

**Yield calculation at harvest:**
```
baseYield = yieldPotential
waterFactor = 1 - ky * (1 - ETactual/ETfull)
nitrogenFactor = min(1, soilN / nitrogenUptake)
potassiumFactor = min(1, soilK / potassiumUptake)  // affects quality/price, not volume
zincFactor = if soilZn < threshold AND flowering → catastrophic loss (0.1-0.3)
             else 1.0
climateFactor = heatStressPenalty * frostPenalty * smokeePenalty

actualYield = baseYield * waterFactor * nitrogenFactor * zincFactor * climateFactor
actualPrice = basePrice * potassiumFactor * marketConditions
revenue = actualYield * actualPrice
```

### 5.8 Economy System

```typescript
interface EconomyState {
  cash: number;
  debt: number;
  creditRating: number;              // affects loan terms; degrades with missed payments
  insurancePremiumRate: number;      // increases with claims history
  insuranceActive: boolean;
  loanInterestRate: number;          // function of credit rating
  totalClaimsHistory: number;        // affects insurability
  yearlyRevenue: number;             // tracking
  yearlyExpenses: number;            // tracking
}
```

**Bankruptcy:** Cash + available credit < 0.
- **First bankruptcy:** Bank offers emergency loan (high interest, secured against future crops). Credit rating drops. Student can recover.
- **Repeated bankruptcy / maxed credit:** Game over. Forced to sell farm.
- **Graceful end:** Reach year 30 → retirement event with final score.

**Insurance:** Premium rate increases with claim history. After too many claims, insurance becomes unavailable ("uninsurable"). This creates real consequences for repeated climate losses without adaptation.

### 5.9 Advisor System

4 advisor characters, each a made-up person with a real-world-grounded role:

| Advisor | Role | Reliability | Trigger Pattern |
|---------|------|-------------|-----------------|
| County Extension Agent | Crops, soil, tech recommendations | High (almost always correct) | Soil health drops, crop failures, new tech available |
| Financial Advisor / Banker | Loans, insurance, investment | High for facts, debatable for strategy | Financial stress, tax season, high cash, insurance renewal |
| Weather Service / Local News | Forecasts, extreme event warnings | Medium (sometimes wrong — false alarms) | Seasonal forecasts, approaching events, foreshadowing |
| Farming Community (online/co-op) | Tips, market gossip, anecdotes | Low-Medium (sometimes right, sometimes noise) | Random/periodic, market rumors, peer experience |

Advisors appear as **game-pausing overlay panels** with character portrait, dialogue, and 2–3 choices. Advisor appearances are storylets in the event system — same mechanism, tagged as `type: "advisor"`.

### 5.10 Glossary / Information Index

An in-game reference that students can open at any time (pauses game while reading):

- **Hyperlinked from game UI:** Crop names, nutrient indicators, event descriptions, tech items all link to glossary entries.
- **Content:** Educational explanations of farming concepts, ecology, climate science, economics. Written in student-friendly language with real-world context.
- **Structure:** Alphabetical + categorized (Crops, Soil & Nutrients, Climate, Technology, Economics).
- **Progressive disclosure:** Glossary entries for tech/crops the student hasn't encountered yet are hidden or grayed out (matches fog-of-war tech tree).
- **Data-driven:** Glossary content lives in JSON alongside the game content it describes.

### 5.11 Automation System

Players can set **policies** per cell, row, column, or whole farm:

```typescript
interface AutomationPolicy {
  action: "replant_same" | "replant_crop" | "harvest_when_ready" | "water_when_dry" | "apply_cover_crop";
  cropId?: string;                   // for "replant_crop"
  coverCropId?: string;              // for "apply_cover_crop"
  threshold?: number;                // for "water_when_dry" — soil moisture trigger
}
```

Automations execute during normal/fast-forward time without pausing. They generate commands that the engine validates normally (sufficient cash, crop available, etc.). If an automation fails (not enough cash to replant), it fires a notification.

**Early game:** Limited automation available (forces manual learning).
**Late game:** Full automation unlocked through tech tree events, enabling fast-forward play.

### 5.12 Save / Resume

Game state is serialized to **localStorage** as JSON. No command log is stored (undo/rewind is not supported — this keeps saves small and predictable).

```typescript
interface SaveGame {
  version: string;                   // schema version for migration
  scenarioId: string;                // which climate scenario
  currentDay: number;                // in-game day (0–10949)
  farmGrid: CellSnapshot[];         // 64 cells: crop, soil, status
  economy: EconomyState;            // cash, debt, credit, insurance
  techTree: TechNodeSnapshot[];     // discovered/purchased nodes
  advisorLog: AdvisorLogEntry[];    // key advisor interactions (for retrospective)
  eventsOccurred: string[];         // IDs of past events (prevent repeats)
  eventsInProgress: EventProgress[];// multi-phase events (e.g., solar lease)
  recentScenarios: string[];        // IDs of recently played scenarios
  playerId: string;                 // teacher-assigned ID or chosen nickname (see Privacy)
  timestamp: number;                // real-world save time
}
```

**localStorage budget:**
- Chrome/ChromeOS limit: ~5–10 MB per origin
- Estimated save size: ~20–30 KB (64 cells x ~200 bytes + economy/tech/events ~5 KB + metadata)
- At 30 KB per save, we could store ~150+ saves before hitting limits
- Auto-save keeps only the latest auto-save (overwrites each season); manual saves are separate slots
- If localStorage is unavailable or full, warn the player and offer to export save as a downloadable JSON file

**Auto-save:** Every season transition (4x per year), overwriting the previous auto-save.
**Manual save:** Player can save to named slots. Limit to 3 manual slots.
**Resume:** On page load, detect existing save and offer to continue or start new game.
**Completion code:** Generated from final game state at year 30 (or bankruptcy). Contains player ID, score metrics, scenario ID, encoded + checksummed. Pre-fills a Google Form URL.

## 6. Data Files Structure

All game content lives in JSON files under a `data/` directory:

```
data/
  crops/
    current.json        # 7 current San Joaquin Valley crops
    future.json         # 5 future/adaptive crops
    cover-crops.json    # cover crop options
  scenarios/
    gradual-warming.json
    early-drought.json
    whiplash.json
    late-escalation.json
    mild.json
  events/
    climate-events.json
    market-events.json
    tech-unlock-events.json
    advisor-events.json
    solar-lease-chain.json
    regulatory-events.json
  advisors/
    characters.json     # advisor names, portraits, personalities
  glossary/
    entries.json        # educational content
  economy/
    base-costs.json     # seed, labor, water, equipment costs
    tech-costs.json     # prices for upgrades/investments
```

**Schema validation:** All JSON files validated against TypeScript interfaces at build time (or with Zod schemas at load time). Malformed data files fail fast with clear errors.

## 7. UI Layout (Conceptual)

```
┌─────────────────────────────────────────────────────┐
│ [Season Icon] March Year 3    [⏸ ▶ ▶▶ ▶▶▶]  $42,300│  ← Top Bar
│ Upcoming: Corn harvest (2 weeks) | Advisor tip avail │
├──────────────────────────┬──────────────────────────┤
│                          │  [Soil Health] ████░░ 67 │  ← Side Panel
│   ┌──┬──┬──┬──┬──┬──┬──┬──┐  │  [Water Supply] ███████ 89│
│   │🌽│🌽│🌽│🌽│🍅│🍅│🍅│🍅│  │  [N] ██████░░ 72          │
│   ├──┼──┼──┼──┼──┼──┼──┼──┤  │  [K] █████░░░ 58          │
│   │🌽│🌽│🌽│🌽│🍅│🍅│🍅│🍅│  │  [Zn] ??? (no monitoring)│
│   ├──┼──┼──┼──┼──┼──┼──┼──┤  │                          │
│   │🌾│🌾│🌾│🌾│░░│░░│░░│░░│  │  ──── Advisors ────      │
│   ├──┼──┼──┼──┼──┼──┼──┼──┤  │  💬 Extension Agent (1)   │
│   │🌾│🌾│🌾│🌾│░░│░░│░░│░░│  │                          │
│   ├──┼──┼──┼──┼──┼──┼──┼──┤  │  ──── Actions ────       │
│   │🌰│🌰│🌰│🌰│🌰│🌰│🌰│🌰│  │  [Plant...] [Harvest All]│
│   ├──┼──┼──┼──┼──┼──┼──┼──┤  │  [Water All] [Tech Tree]  │
│   │🌰│🌰│🌰│🌰│🌰│🌰│🌰│🌰│  │  [Glossary] [Save]       │
│   ├──┼──┼──┼──┼──┼──┼──┼──┤  │                          │
│   │🌰│🌰│🌰│🌰│🌰│🌰│🌰│🌰│  │  ──── Selected Cell ──── │
│   └──┴──┴──┴──┴──┴──┴──┴──┘  │  Row 5, Col 3: Almonds   │
│          8x8 Farm Grid       │  Year 4/25, Producing     │
│                              │  Growth: ████████ 100%    │
│                              │  Soil N: 45  K: 62  Zn: ? │
├──────────────────────────────┴──────────────────────────┤
│ 📰 "Your tomato leaves look a bit pale this season."    │  ← Notification Bar
│    [Learn more →]  [Dismiss]                            │
└─────────────────────────────────────────────────────────┘
```

All grid cells, buttons, panels, and interactive elements have `data-testid` attributes.

## 8. Crop Roster (Classroom-Ready Build)

### Current San Joaquin Valley Crops
| Crop | Type | Strategic Role | Key Mechanic |
|------|------|---------------|-------------|
| Processing Tomatoes | Annual | High-value, heavy N feeder | Rotation essential; depletes soil fast |
| Silage Corn | Annual | Reliable feed crop | Can double-crop with winter forage |
| Grapes | Perennial | High-value, versatile | Heat-sensitive >105°F; smoke taint risk from wildfires |
| Almonds | Perennial | Current king, highest value | Water-intensive; needs chill hours (declining with climate) |
| Pistachios | Perennial | Climate-adapted nut | Salt/drought tolerant; the natural replacement for almonds |
| Citrus (Navels) | Perennial | Stable, moderate value | Benefits from warming (fewer frosts); needs irrigation |
| Stone Fruit (Peaches) | Perennial | High value, high labor | Needs chill hours; labor-intensive harvest |

### Future / Adaptive Crops (unlocked via tech tree events)
| Crop | Type | Strategic Role | Unlock Trigger |
|------|------|---------------|---------------|
| Agave | Perennial | Ultra-drought-tolerant | Severe drought + extension agent recommendation |
| Heat-tolerant Avocados | Perennial | High-value subtropical | Temperature trend crosses threshold + market event |
| Opuntia (Prickly Pear) | Perennial | Multi-use desert crop | Drought conditions + community tip |
| Winter Wheat/Triticale | Annual | Dryland fallback | Water allocation cut + extension agent |
| Guayule | Perennial | Low-water industrial (rubber) | Multiple water crises + research investment |

### Cover Crops / Off-Season Strategies
| Option | N Effect | Erosion Effect | OM Effect | Notes |
|--------|----------|---------------|-----------|-------|
| Legume cover (Clover/Vetch) | +50-100 lbs/ac | -50% | +0.1%/yr | Best for N-depleted fields |
| Mustard | neutral | -40% | +0.05%/yr | Breaks hardpan, pest suppression |
| Resident vegetation (managed) | neutral | -30% | +0.03%/yr | Free; just mow |
| Bare / clean cultivation | none | none | -0.05%/yr | Cheapest short-term; worst long-term |
| Winter cash crop (double-crop) | varies | -20% | neutral | Revenue but delays spring planting |

## 9. Key Design Patterns Applied

| Pattern | From | How We Use It |
|---------|------|--------------|
| **Data-Driven Design** | Civ IV, RimWorld, Factorio | All crops, events, advisors, techs defined in JSON. Engine is generic. |
| **Command Pattern** | StarCraft, Factorio | All player actions are command objects. Enables testing, deterministic runs, and type-safe validation. |
| **Deterministic Simulation** | Factorio | Seeded RNG. Same scenario + same commands = identical result. |
| **Storylet System** | King of Dragon Pass, Crusader Kings | Events, tech unlocks, advisors all use the same precondition-based selection system. |
| **Layered Architecture** | All major sims | State → Systems → Presentation with strict boundaries. |
| **Fog of War (Tech Tree)** | 4X games | Students don't see the full tech tree. Problems reveal branches. Retrospective view fills in over time. |

## 10. Privacy & Student Data

### Principle: Minimize data collection. No PII required by the app.

- **Player identity:** Students enter a "Player ID" — a teacher-assigned code (e.g., "Period3-14") or a self-chosen nickname. **Real names are never required.** The field label should say "Player ID" not "Name." However, **students may still enter identifiable information** (e.g., their actual name as a nickname). The app cannot prevent this, so teachers should instruct students to use assigned codes.
- **localStorage:** All save data stays on the student's device. Nothing is transmitted anywhere unless the student voluntarily submits a completion code.
- **Completion code:** Contains the Player ID, score metrics, and scenario ID. The student manually submits this via Google Form — it's their action to click the link.
- **Google Form:** The teacher controls the form and its data retention. The form may ask for real names separately (teacher's decision, outside our app). Our app never collects or stores real names.
- **No analytics, no tracking, no cookies** beyond localStorage for save data.
- **Regulatory note:** This app is *designed* to avoid collecting PII: it requires no accounts, stores data only on-device, and transmits nothing without explicit student action. However, **we do not assert legal compliance with COPPA, FERPA, or any other regulation.** Schools deploying this should review it under their own data governance policies. Neal should consult with his school's IT/privacy office before classroom use if required by district policy.

## 11. `data-testid` Naming Convention

All interactive DOM elements get `data-testid` attributes following this standard:

**Format:** `{area}-{element}-{qualifier}` in kebab-case.

| Area | Examples |
|------|---------|
| `farm` | `farm-cell-3-7`, `farm-grid`, `farm-row-header-3` |
| `action` | `action-plant-all`, `action-harvest-row-2`, `action-water-all` |
| `speed` | `speed-pause`, `speed-play`, `speed-fast`, `speed-fastest` |
| `topbar` | `topbar-date`, `topbar-cash`, `topbar-season-icon` |
| `sidebar` | `sidebar-soil-n`, `sidebar-soil-k`, `sidebar-water-supply` |
| `advisor` | `advisor-panel-extension`, `advisor-choice-1`, `advisor-dismiss` |
| `event` | `event-panel`, `event-choice-accept`, `event-choice-decline` |
| `glossary` | `glossary-open`, `glossary-entry-nitrogen`, `glossary-close` |
| `menu` | `menu-crop-tomatoes`, `menu-crop-almonds`, `menu-cancel` |
| `save` | `save-button`, `save-slot-1`, `save-resume`, `save-new-game` |
| `tech` | `tech-tree-view`, `tech-node-drip-irrigation` |
| `notify` | `notify-bar`, `notify-dismiss`, `notify-learn-more` |

**Rules:**
- Grid cells use `farm-cell-{row}-{col}` (zero-indexed).
- Crop-specific buttons use the crop's JSON `id` as qualifier.
- All test IDs must be stable across sessions (no generated/random IDs).
- A tester reading the IDs should understand the UI without seeing it.

## 12. Testing Strategy

### Layer 1: Engine Unit Tests (Vitest — fast, headless)
- Crop growth math: "Corn planted day 100 with daily GDD=20 reaches maturity by day 240"
- Water balance: "Field with 2in moisture, 0.2in ET, no rain → 1.8in moisture next day"
- Nutrient cycling: "Tomato crop removes 200lbs N; soil N drops from 250 to 50"
- Economy: "Harvesting 100 bu sorghum at $6 on 4 cells adds $2,400 to cash"
- Event preconditions: "Storylet with condition cash<5000 fires when cash is 4999, not when 5001"
- Command validation: "PlantCrop command rejected when cell is occupied"
- Determinism: "Two runs with same seed + same commands produce identical state at day 1000"

### Layer 2: Scenario Balance Tests (Vitest — headless, automated strategies)
- "Corn monoculture strategy goes bankrupt in ≥60% of drought-heavy scenarios"
- "Diversified adaptive strategy survives ≥80% of all scenarios"
- "Every scenario has at least one viable strategy path (no unwinnable scenarios)"
- "Tech tree events offer necessary unlocks before bankruptcy is inevitable"
- "At least one advisor gives a useful warning before every major crisis"

### Layer 3: Browser Integration Tests (Playwright — Chromium)
- "Click cell (3,4) → Plant menu appears with available crops"
- "Click 'Plant All' with corn selected → all 64 cells show corn indicator"
- "Speed set to 4x → calendar advances visibly → auto-pauses on event"
- "Glossary link on 'Nitrogen' opens glossary panel; game is paused"
- "Save game, reload page, resume → game state matches"
- "Complete 30-year game → completion code generated → Google Form link works"

### Layer 4: Performance Tests (Vitest + Playwright)
- "Simulation tick completes in <4ms on reference hardware"
- "64-cell DOM update completes in <16ms"
- "Running at 4x speed maintains 30fps"
- "Page load to interactive in <4 seconds on throttled connection"

### Layer 5: Playability Tests (Manual / AI Agent)
- "A student can complete one in-game year without instructor rescue"
- "All routine operations (plant, harvest, water) achievable in ≤3 clicks"
- "Every event explains what happened and why in plain language"
- "Every advisor recommendation is traceable in retrospect"

## 13. Development Slicing (Proposed)

The full architecture above describes the complete Classroom-Ready Build. Development should proceed in vertical slices, each fully working and testable before the next begins. **No slice ships with stubs.**

### Slice 1: Core Farm Loop
The thinnest playable game. A student can plant crops, watch them grow, harvest, and see money change. Time flows. Weather matters.

**Includes:**
- 8x8 grid with bulk operations (plant all/row/col, harvest all/row/col, water all/row/col)
- 3 annual crops only (Processing Tomatoes, Silage Corn, Winter Wheat)
- Time controls (pause, 1x, 2x, 4x) with calendar display
- Daily simulation: weather from 1 scenario, GDD accumulation, water balance
- Nitrogen tracking (single nutrient — the most visible and educational)
- Simple economy: cash, planting costs, harvest revenue, irrigation costs
- Basic UI: grid, top bar, side panel, cell detail, notification bar
- Save/resume (localStorage)
- All data-testid attributes in place
- Baseline accessibility: all controls keyboard-navigable (Tab/Enter/Space), ARIA labels on interactive elements, visible focus indicators. This is a classroom product — accessibility is baked in from the start, not bolted on later.
- 3-step tooltip tutorial with Skip + Don't show again (see SPEC.md DD-3)
- Auto-pause system: harvest ready, water stress, bankruptcy, year-end (see SPEC.md §3.6)
- Overripe crop lifecycle: 30-day grace period with linear yield decay (see SPEC.md DD-4)
- Full engine unit tests + Playwright browser tests

**Does NOT include:** Events, advisors, tech tree, perennials, automation, glossary, solar lease, K/Zn nutrients, cover crops, completion code. These are not stubbed — they simply don't exist yet.

**Acceptance gate:** A student can play through 5 in-game years, planting and harvesting annual crops, and their cash balance reflects realistic costs/revenues. Save/resume works. All controls are keyboard-accessible. All tests pass. Runs at 30fps on Chromebook.

### Slice 2: Events & Perennials
The game becomes strategic. Things happen that require decisions. Long-term investments become possible.

**Adds:** Storylet/event system, 3-5 climate events, foreshadowing, 1 advisor (extension agent), perennial crop lifecycle (almonds + pistachios), basic notifications.

### Slice 3: Depth & Discovery
The fog-of-war tech tree, full nutrient model, and the rest of the crop roster.

**Adds:** K + Zn nutrients, tech tree (event-driven unlocks), remaining advisors, cover crops, all 12 crops, more events, more scenarios.

### Slice 4: Classroom Polish
Everything needed to hand this to students with confidence.

**Adds:** Automation policies, glossary, solar lease event chain, completion code + Google Form, all 5-8 scenarios, balance testing suite, final UI polish.

## 14. Open Questions

### Resolved for Slice 1 (see SPEC.md — Locked Design Decisions)
- [x] Starting conditions: $50,000 cash, Spring Year 1 Day 1, all 64 plots empty, 100 lbs/acre N, 2.0% OM, 4.0in moisture, paused on launch.
- [x] Tutorial: 3-step tooltip tour with Skip + Don't show again. All elements have data-testid for AI testers.
- [x] Watering model: Manual ~14-day dose with first-per-season auto-pause at 25% moisture.
- [x] Bulk operations: Round down to complete rows when cash is insufficient; confirmation dialog.
- [x] Overripe crops: Auto-pause at harvestable → 30-day grace period → linear yield decay → rot.
- [x] Bankruptcy: Cash ≤ $0 = game over in Slice 1 (no credit/loans until Slice 2).
- [ ] Performance test setup: how do we simulate Chromebook performance in CI? (Chrome DevTools throttling profile) — deferred to implementation

### Blocking for Slice 2 (must decide before that slice)
- [ ] Loan terms and credit rating mechanics (needed when events can cause financial stress)
- [ ] Insurance pricing model (base rate, claim multiplier, uninsurable threshold)
- [ ] Advisor character names, portraits, and personality details

### Deferrable (decide during later slices)
- [ ] Scoring formula for retirement (Slice 4 — endgame feature)
- [ ] Irrigation upgrade specifics and costs (Slice 3 — tech tree detail)
- [ ] Climate scenario data: need to generate/curate 5-8 30-year seasonal parameter sets (Slice 3-4)
- [ ] Farm expansion / neighbor buyout event (likely v2, not Classroom-Ready Build)
- [ ] Agrivoltaics detail level in solar lease chain (Slice 4)
- [ ] Market price model: static base + event modifiers is sufficient for Slice 1-2; full supply/demand is likely overkill
- [ ] Advanced accessibility: colorblind modes, full screen reader support (Slice 3-4; baseline keyboard nav + ARIA labels are in Slice 1)
- [ ] Sound / music (defer — nice to have, not essential for classroom use)
