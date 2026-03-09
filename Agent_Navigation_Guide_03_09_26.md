# Climate Farmer — Agent Navigation Guide
Purpose: reliable UI navigation for AI/QA agents. Navigation only, not gameplay strategy.
Verified against: regression runs 1–3 (2026-03).

---

## 1. Start Flow

```
newgame-player-id   ← text input; see §1.1 below
newgame-start       ← "Start New Game" button
tutorial-skip       ← dismisses tutorial overlay (may not appear every run)
```

**§1.1 Player ID input — React gotcha**
Simple `input.value = 'X'; input.dispatchEvent(new Event('input'))` is insufficient; React validation fires but `newgame-start` stays blocked. Use the native setter:
```js
const inp = document.querySelector('[data-testid="newgame-player-id"]');
Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  .set.call(inp, 'QA-1');
inp.dispatchEvent(new Event('input', { bubbles: true }));
```
Or type directly via automation keyboard actions.

**Return to title (in-game)**
Clicking "New Game" shows a bare modal: "Return to title screen? Your game is auto-saved at each season boundary." — Cancel / **Confirm** (text-matched buttons, no testid). Confirm to proceed.

---

## 2. Debug API (`window.__gameDebug`)

```
getState()                 mutable live reference — call publish() after mutation
publish()                  triggers UI re-render after direct state mutation
setFlag(flagId, bool)      confirmed: tech_crop_agave, tech_drip_irrigation
setCash / setDebt / setTotalLoansReceived / setScenario
setDay(n)                  sets calendar day + season/month (no intermediate ticks simulated)
                           DOES affect planting-window gating — use to bypass seasonal locks
fastForward(n)             ← see §2.1
triggerEvent(storyletId)
```

**§2.1 fastForward — critical correction**
`fastForward(1)` does **not** advance 1 tick. It runs the simulation forward until the next autopause event (crop harvest, year-end, heatwave advisory, etc.), which is typically **150–250 game days** per call. Cash deltas measured across two `fastForward(1)` calls are not comparable because run durations differ.

For single-event granularity: set state, click `speed-play`, `await` a fixed real-time interval, click `speed-pause`.

**§2.2 activeEffects mutation**
Pushing to `s.activeEffects` after `getState()` + `publish()` correctly stores the entry in state (visible via subsequent `getState()`). However, `irrigation_cost_modifier` effectType is not wired to the drip irrigation cost function — `s.irrigationCostMultiplier` remains 1 regardless. Treat custom effect injection as unimplemented for irrigation cost in current build.

---

## 3. Speed Controls

```
speed-pause    0×
speed-play     1×
speed-fast     2×
speed-fastest  4×
```

- Speed is set to 0 after every auto-pause. Must click a speed button to resume.
- `play-prompt` (`data-testid="play-prompt"`) appears in the topbar centerGroup when paused. **Known active bug:** inserting play-prompt into centerGroup expands it from 159px → 320px, shifting speed controls ~80px left. Recovers on resume.

---

## 4. Grid

- 8×8, 64 cells. Container: `role="grid"`.
- Cells: `data-testid="farm-cell-{row}-{col}"` (0-indexed). `role="gridcell"`.

---

## 5. Plant / Harvest / Water

**Click a cell first** — most single-cell and row/col actions only render after a cell is selected.

### Planting flow (two-step)
```
1. action-plant          ← "Plant…" button in single-cell ACTIONS panel
2. menu-crop-<cropId>    ← individual crop button in the submenu
```
Known `menu-crop-*` ids: `processing-tomatoes`, `silage-corn`, `winter-wheat`, `sorghum`,
`almonds`, `pistachios`, `citrus-navels`, `agave` (requires `tech_crop_agave` flag).

Locked crops are absent from the DOM entirely — they do not appear disabled.

### Bulk actions (after cell selected)
```
action-plant-all-<cropId>
action-plant-row-<row>-<cropId>
action-plant-col-<col>-<cropId>
action-harvest-all
action-harvest-row-<row>
action-harvest-col-<col>
action-water-all
action-water-row-<row>
action-water-col-<col>
```

### Summer lockout
In Summer months all annual crop planting is unavailable. `action-plant` disappears; side panel shows "No crops available this season." Use `setDay(450)` (≈ Spring Year 2) to re-enable planting window.

---

## 6. Dialog Handling

### Auto-pause panels
```
autopause-panel              root element of any autopause overlay
autopause-action-primary     green primary action button (e.g. "Harvest Field", "Continue")
```
Dismiss any autopause with:
```js
document.querySelector('[data-testid="autopause-action-primary"]')?.click();
```
For "Harvest Time!" — clicking primary auto-harvests. Use text-matched "Continue" button to skip harvest:
```js
[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Continue')?.click();
```

### Plant confirm dialogs
Long-maturation crops (agave, almonds, pistachios, citrus) show a bare modal with **Cancel** / **Confirm** text buttons. No `confirm-dialog` / `confirm-accept` testids observed in current build. Use text matching:
```js
[...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Confirm')?.click();
```

### Other overlay testids (carry-forward from prior doc — unverified in current runs)
`event-panel`, `advisor-panel`, `loan-panel`, `gameover-panel`, `year30-panel`, `year30-new-game`

---

## 7. Year-End

Year-end auto-pause fires via `autopause-panel`. Primary button text is typically "Continue to Year N+1" — clickable via `autopause-action-primary` or text match.

---

## 8. Save / Load

- Auto-save key: `climateFarmer_autosave`
- Manual saves: `climateFarmer_save_*`
- "Continue Saved Game" validates auto-save integrity before rendering.
- Avoid full page reloads mid-run — JS context (including any in-memory log arrays) is lost.

---

## 9. Quick Reference

```
newgame-player-id        Player ID input (see §1.1 for React input method)
newgame-start            Start New Game
tutorial-skip            Skip tutorial
farm-cell-{r}-{c}        Grid cell (0-indexed)
speed-pause / speed-play / speed-fast / speed-fastest
action-plant             Single-cell plant button (cell must be selected)
menu-crop-{cropId}       Crop option in plant submenu
action-plant-all-{id}    Bulk plant entire field
action-plant-row-{r}-{id}
action-plant-col-{c}-{id}
action-harvest-all
action-water-all
autopause-panel          Any autopause overlay root
autopause-action-primary Primary action button on autopause
topbar-cash              Cash display
topbar-date              Date display
topbar-debt              Debt display (conditional)
play-prompt              Paused-state prompt in centerGroup (see §3 bug note)
```

---

## 10. Minimal Automation Skeleton

```javascript
if (window._cfHandler) clearInterval(window._cfHandler);
window._cfHandler = setInterval(() => {
  // 1) Resolve confirm dialogs (text-matched — no confirm-dialog testid in current build)
  const confirmBtn = [...document.querySelectorAll('button')]
    .find(b => b.textContent.trim() === 'Confirm' && b.offsetParent);
  if (confirmBtn) { confirmBtn.click(); return; }

  // 2) Resolve auto-pause overlays
  const primary = document.querySelector('[data-testid="autopause-action-primary"]');
  if (primary) { primary.click(); return; }

  // 3) Fallback: any alertdialog
  const dialogs = [...document.querySelectorAll('[role="alertdialog"]')];
  for (const d of dialogs) {
    const btns = [...d.querySelectorAll('button')];
    if (!btns.length) continue;
    const preferred = btns.find(b =>
      /Continue|Good to Know|Accept|Show Me/.test(b.textContent.trim())
    );
    (preferred || btns[btns.length - 1]).click();
  }

  // 4) Keep running
  document.querySelector('[data-testid="speed-fastest"]')?.click();
}, 400);
```
Stop: `clearInterval(window._cfHandler);`

---

## 11. Known Issues / Caveats

| Issue | Detail |
|-------|--------|
| `fastForward(n)` ≠ n ticks | Runs to next autopause (~150–250 days). Use speed-play + timed wait for per-event granularity. |
| Player ID input React bug | JS value assignment bypasses React state; use native setter or keyboard input. |
| play-prompt topbar drift | ~80px speed-control shift during autopause states. Active bug. |
| `confirm-dialog` testid | Not present in current build. Use text-matched button approach. |
| `irrigation_cost_modifier` in activeEffects | Not applied to irrigation cost function. `irrigationCostMultiplier` stays 1 regardless. |
| `setDay()` scope | Moves calendar + season (affects planting windows). Does not simulate intermediate growth/weather. |
| Summer planting lockout | Annual crop planting unavailable in Summer. Use `setDay()` to reach Spring/Fall. |
| Agave post-unlock copy | Plot detail shows "Requires technology unlock to plant" even after unlock. |
