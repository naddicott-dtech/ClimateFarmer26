# KNOWN_ISSUES.md

## Pre-Development (Planning Phase)

### Resolved from Senior Engineer Review (2026-02-12)

1. **Climate data size** — Original design stored 10,950 daily weather entries per scenario (~500KB-1MB each). Revised to seasonal parameters + procedural daily generation (~10KB each). Resolved in ARCHITECTURE.md §5.3.

2. **Command type safety** — Original `Command` interface used `payload: unknown`, defeating TypeScript safety. Revised to discriminated union with fully-typed command variants. Resolved in ARCHITECTURE.md §5.2.

3. **localStorage bloat** — Original save included full command log (unbounded growth). Revised to state-snapshot-only saves (~20-30KB). No undo/rewind. localStorage budget: 5-10MB available, well within limits. Resolved in ARCHITECTURE.md §5.12.

4. **Privacy/student data** — Original design stored "studentName" in save and completion code. Revised to "playerId" (teacher-assigned code or nickname). App does not require PII, but cannot prevent students from entering identifiable info as their Player ID — teachers should instruct use of assigned codes. Added privacy section to ARCHITECTURE.md §10.

5. **Doc drift (lettuce)** — Test example referenced lettuce, which isn't in the San Joaquin Valley crop roster. Fixed to sorghum.

6. **Undo references** — Stale references to undo/replay capability removed after decision to not support undo (saves are snapshots, not command logs).

7. **Open question categorization** — Split into blocking-for-Slice-1, blocking-for-Slice-2, and deferrable. Added in ARCHITECTURE.md §14.

8. **Scope risk / slicing** — Added explicit Slice 1-4 breakdown in ARCHITECTURE.md §13, defining what's in each slice and what the acceptance gate is.

9. **data-testid naming convention** — Added standard in ARCHITECTURE.md §11.

### Resolved from SPEC.md Senior Engineer Review (2026-02-12)

10. **Conflicting performance criteria** — SPEC.md stated tick ≤4ms AND 48 ticks/frame ≤16ms (which implies ≤0.33ms/tick). The "48 ticks per frame" math was wrong: at 4x speed (48 ticks/sec) and 30fps, there are ~2 ticks per frame, not 48. Fixed in SPEC.md §9.2 and ARCHITECTURE.md §3.

11. **Ambiguous either/or acceptance tests** — Several tests said "either X or Y" which blocks deterministic implementation. Each resolved to a single behavior: disabled buttons with tooltips (not messages). Resolved in SPEC.md §2.2, §2.4.

12. **Watering pacing math inconsistent** — Original claimed "every 2-3 real-time seconds" but calculated "week in ~0.6s." Resolved by switching to 14-day water dose with first-per-season auto-pause at 25% moisture. Resolved in SPEC.md DD-5.

13. **OM "display-only" contradiction** — Section said "display only" but tested simulation changes (OM decrease, moisture capacity effect). Clarified: OM is fully simulated by the engine, but no Slice 1 player actions control it directly. It's "passively simulated," not "display only." Resolved in SPEC.md §4.5.

14. **Bankruptcy behavior ambiguous** — Three sections described slightly different conditions. Unified: cash ≤ $0 = game over in Slice 1 (no credit, no loans until Slice 2). Resolved in SPEC.md §5.4.

15. **DD-4 title mislabeled** — "What happens to crops in wrong season" was actually about overripe behavior. Retitled and resolved as 30-day grace period with linear yield decay. Resolved in SPEC.md DD-4, §3.7.

### Resolved from Slice 1 Implementation Review (2026-02-12)

16. **Harvest auto-pause never triggers** — Condition checked `harvestable && overripeDaysRemaining === 30` but overripeDaysRemaining is -1 when crop first reaches harvestable. Fixed to trigger on `growthStage === 'harvestable'`.

17. **Auto-pause priority order** — Events were displayed in insertion order, not urgency order. Added `AUTO_PAUSE_PRIORITY` map and stable sort in `simulateTick`.

18. **Plant/Water Field skips confirmation** — Affordable field-scope bulk ops executed immediately without confirmation. SPEC requires confirmation always. Fixed.

19. **Column bulk actions missing** — SidePanel only had row-scope buttons. Added Plant/Harvest/Water Column buttons per SPEC §2.3/§2.5/§2.6.

20. **Manual save to named slot** — Only auto-save existed. Added named slots keyed by "Year N Season", title screen load/delete menu.

21. **hasSaveData() false positive** — Returned true for manual-only saves, showing misleading "Continue" button. Fixed to only check auto-save.

22. **DD-1 complete rows counted partial rows** — Partial plant offers included partially-filled rows. Fixed to require all cells in a row to be empty.

23. **Missing data-testids** — Added conditional testids for gameover-panel, year30-panel, autopause-dismiss, save-new-game per SPEC §11.

24. **RNG continuity in warmup** — `createInitialState` warmup only called `generateDailyWeather`, not `updateExtremeEvents`, causing RNG state drift. Fixed to call both.

25. **Event probability under-targeting** — Linear `p/90` approximation under-targets by ~28% at p=0.4. Replaced with exact formula `1-(1-p)^(1/90)`.

26. **Streak test gap** — Only checked `maxStreak >= 3`, not all streaks. Fixed to validate `minStreak >= 3`.

27. **Bulk ops bypass processCommand** — Affordable-path confirm callbacks called engine functions directly, skipping validation. Fixed to route through `processCommand`.

28. **Duplicate testids on crop buttons** — Per-crop buttons shared testids. Fixed by including cropId: `action-plant-all-{cropId}`.

29. **Unsafe cast in warmup** — `warmup as GameState` was brittle. Extracted `ExtremeEventState` interface.

### Resolved from Slice 2a Senior Engineer Review (2026-02-24)

31. **HIGH: Event/advisor dismiss deadlocks activeEvent** — Dismissing event/advisor auto-pause overlay called `handleDismissAutoPause()` without clearing `activeEvent`, permanently blocking all future events (evaluateEvents returns null when activeEvent is set). Fixed: `dismissAutoPause` now detects event/advisor reason and clears activeEvent, logging as `__dismissed__`.

32. **HIGH: Foreshadowing fires same tick as event** — `evaluateEvents` created foreshadowing and fired the event in the same evaluation pass, defeating the purpose of advance warnings. Fixed: complete foreshadowing lifecycle — when conditions pass, foreshadow is created but event is NOT eligible to fire. Event becomes eligible only when `totalDay >= eventFiresOnDay`. False alarms expire silently at `eventFiresOnDay`.

33. **MEDIUM: Irrigation cost multiplier not in affordability checks** — `processWater` used base `IRRIGATION_COST_PER_CELL` for affordability but `executeWater` applied the event-driven cost multiplier, allowing watering when the player couldn't actually afford it. Fixed: `processWater` now applies `getIrrigationCostMultiplier()` in all affordability calculations. Adapter's water confirmation dialog also updated.

34. **LOW: Event RNG warmup no-op loop** — Empty for-loop with misleading comment about future consistency. Removed loop, added clear comment explaining why no event RNG warmup is needed.

35. **TAKE_LOAN guard** — `TAKE_LOAN` command was valid at any time (only checked `totalLoansReceived`). Fixed: now requires active `loan_offer` in `autoPauseQueue`, preventing command from being dispatched outside the loan offer flow.

### Resolved from Slice 2a Senior Engineer Review Round 2 (2026-02-24)

36. **MEDIUM: Foreshadowed events dropped on maturity day** — When multiple events matured on the same tick, all mature foreshadows were dismissed before weighted selection. If a foreshadowed event lost the random roll, its foreshadow was gone permanently. Fixed: foreshadowed events now fire with guaranteed priority (the player was warned, so the event must follow through). Only one fires per tick; others stay pending for subsequent ticks.

37. **LOW: Migration fallback used hardcoded event RNG seed** — `migrateV1ToV2` set `eventRngState = 42` for v1 saves. Fixed: now derives seed from `SLICE_1_SCENARIO.seed + EVENT_RNG_SEED_OFFSET` to match what `createInitialState` would produce.

### Resolved from Slice 2a Review Round 3 (2026-02-24)

38. **MEDIUM: False-alarm foreshadow churn** — Dismissed false-alarm foreshadows were immediately re-created on the same tick because Phase 2 saw no pending foreshadow for the storylet. Fixed: Phase 2 now skips storylets with foreshadows dismissed on the current day (`eventFiresOnDay === totalDay`).

39. **Loan panel browser test unskipped** — Added `window.__gameDebug` hook (setCash, setDay, setDebt, triggerEvent, etc.) for Playwright state injection. Loan tests now force `cash=0` directly, enabling 3 new browser tests: panel appears, accept adds debt, decline ends game. Removed `test.skip`.

40. **HIGH: Flaky event panel browser tests** — Event panel tests relied on `dismissAutoPausesUntil` waiting for natural RNG-driven events (probabilistic timing). Failed 1/5 under stress. Fixed: `triggerEvent` debug hook injects events directly, making event panel structure/interaction tests deterministic. Foreshadow test kept as natural-flow (tests the whole pipeline). Stress-tested 30/30 passes.

### Resolved from Slice 2c Senior Engineer Review (2026-02-25)

41. **MEDIUM: "Apply Nitrogen Fertilizer" advisor choice was a no-op** — The `advisor-soil-nitrogen` storylet's "buy fertilizer" choice had `modify_cash: -400` but no effect on soil nitrogen. Students paid $400 for nothing. Fixed: added `modify_nitrogen_all` effect type to the effect system. Buy-fertilizer choice now applies +60 nitrogen to all cells, clamped to [0, 200].

42. **MEDIUM: Manual-save migration not surfaced in Load Game list** — `readSave()` had V1→V2→V3 migration, but `listManualSaves()` used `validateSave()` (exact version match only). Old-version manual saves were invisible in the Load Game menu despite being loadable. Fixed: `listManualSaves()` now uses the same migration chain as `readSave()`.

43. **LOW: Chill accumulation ~1.1% under target** — Dormancy entry day did an early `return` before the accumulation block, so 89/90 dormancy days accumulated chill. Over a winter with 800 target chill hours, the actual total was ~791. Fixed: removed early return; dormancy entry day now falls through to the accumulation block.

44. **LOW (hygiene): playwright-report tracked in git** — Generated `playwright-report/` and `test-results/` directories were not in `.gitignore`. Fixed: added both to `.gitignore`.

### Deferred — Accepted for Slice 1

30. **Deep save validation** — Nested field tampering (e.g., modifying crop.gddAccumulated inside a valid grid structure) is not caught by `validateSave()`. Acceptable risk for classroom use — students are not adversarial. Could add deep schema validation in a future slice if needed.

### Deferred from Slice 2 → Slice 3

- **Stretch events (tomato-market-surge, groundwater-pumping-ban)** — Designed during Sub-Slice 2c but deferred per Neal's pre-flight feedback. Canonical specs (not yet in code):
  - **Tomato Market Surge:** type=market, conditions: not winter + year 2+ + 10% random, priority 45, cooldown 365 days. Single choice: Acknowledge → tomato price ×1.4 for 60 days (per SPEC.md §19.1).
  - **Groundwater Pumping Ban:** type=regulatory, conditions: summer + year 5+ + 12% random, priority 55, cooldown 730 days. Choices: Comply (no irrigation 30 days) OR Buy surface water rights ($1,000) (per SPEC.md §19.2).
  - Low implementation effort — event data structure and effect types already exist.
- **Perennial decline phase** — Trees should lose productivity after peak years (ARCHITECTURE.md §5.7). Currently binary yield (0 during establishment, 1.0 after establishment forever). Need age-dependent yield curve with decline.
- **Age-based yield curves** — Real orchards ramp up production over years 1-6, peak, then decline. Currently a step function (0 → 1.0 at establishment).
- **Tech tree** — Fog-of-war event-driven tech unlocks (ARCHITECTURE.md §5.4). Not started. Needed for crop visibility gating, irrigation upgrades, nutrient monitoring.
- **Remaining 3 advisors** — Financial Advisor/Banker (loans, insurance, investment), Weather Service (forecasts, sometimes wrong), Farming Community (tips, gossip, unreliable). See ARCHITECTURE.md §5.9.
- **Insurance / credit systems** — Credit rating, variable loan rates, insurance premiums that increase with claims. Only a one-time emergency loan exists currently.
- **K + Zn nutrients** — Only nitrogen is modeled. Potassium (quality/defense) and Zinc (critical checkpoint) are in ARCHITECTURE.md §5.6 but not implemented.
- **Cover crops** — Off-season strategies (legume, mustard, resident vegetation) that affect N/erosion/OM. See ARCHITECTURE.md §8.
- **Additional crops** — 7 more crops from the 12-crop roster: Grapes, Citrus, Stone Fruit, Agave, Heat-tolerant Avocados, Opuntia, Guayule. See ARCHITECTURE.md §8.
- **Additional climate scenarios** — Only 1 scenario exists ("Slice 1 Baseline"). Need 5-8 for classroom use to prevent students from memorizing the weather track.

### Deferred to Slice 4 / Later Discussion

- **Automation policies** — Replant-same, harvest-when-ready, water-when-dry. Unlocked via tech tree.
- **Glossary / Information Index** — In-game educational reference with progressive disclosure.
- **Solar lease event chain** — Multi-phase storylet (option → construction → operations → agrivoltaics).
- **Completion code + Google Form** — End-of-game reporting for teacher assessment.
- **Advanced accessibility** (colorblind modes, full screen reader support) — Baseline keyboard nav + ARIA in Slice 1.
- **Sound / music** — Not essential for classroom use.
- **Farm expansion (neighbor buyout)** — Likely v2, not Classroom-Ready Build.
- **README.md** — Not yet created. App is fully runnable (`npm run dev`, `npm test`, `npm run build`). Defer until closer to classroom deployment.
