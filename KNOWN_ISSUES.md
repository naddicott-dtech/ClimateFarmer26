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

### Deferred — Accepted for Slice 1

30. **Deep save validation** — Nested field tampering (e.g., modifying crop.gddAccumulated inside a valid grid structure) is not caught by `validateSave()`. Acceptable risk for classroom use — students are not adversarial. Could add deep schema validation in a future slice if needed.

### Deferred to Later Discussion

- **Advanced accessibility** (colorblind modes, full screen reader support) — Deferrable to Slice 3-4. Baseline accessibility (keyboard navigation, ARIA labels, focus indicators) is in Slice 1.
- **Sound / music** — Not essential for classroom use. Defer.
- **Farm expansion (neighbor buyout)** — Likely v2, not Classroom-Ready Build.
- **README.md** — Not yet created. App is fully runnable (`npm run dev`, `npm test`, `npm run build`). Defer until closer to classroom deployment.
