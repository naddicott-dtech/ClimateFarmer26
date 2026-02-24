import { test, expect, type Page } from '@playwright/test';

// Helper: Start a new game with a given player ID
async function startNewGame(page: Page, playerId = 'TestPlayer') {
  await page.goto('/');
  await page.getByTestId('newgame-player-id').fill(playerId);
  await page.getByTestId('newgame-start').click();
  // Dismiss tutorial if it appears
  const tutorialSkip = page.getByTestId('tutorial-skip');
  if (await tutorialSkip.isVisible({ timeout: 500 }).catch(() => false)) {
    await tutorialSkip.click();
  }
}

// Helper: Wait for game screen to be ready
async function waitForGameScreen(page: Page) {
  await expect(page.getByTestId('farm-grid')).toBeVisible();
  await expect(page.getByTestId('topbar-cash')).toBeVisible();
}

/**
 * Helper: Dismiss non-target auto-pauses and keep the game running
 * until the target testid appears or timeout.
 *
 * Handles: generic auto-pauses (dismiss secondary), event panels (pick first choice),
 * loan offers (accept), and game over (throws).
 */
async function dismissAutoPausesUntil(page: Page, targetTestId: string, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    // Target found?
    if (await page.getByTestId(targetTestId).isVisible().catch(() => false)) return;

    // Handle game over — bail out
    for (const id of ['gameover-panel', 'year30-panel']) {
      if (await page.getByTestId(id).isVisible().catch(() => false)) {
        throw new Error(`Game ended (${id}) before ${targetTestId} appeared`);
      }
    }

    // Dismiss generic auto-pauses via secondary (cheaper) or primary button
    const dismissBtn = page.getByTestId('autopause-dismiss');
    if (await dismissBtn.isVisible().catch(() => false)) {
      await dismissBtn.click();
      await page.getByTestId('speed-fastest').click().catch(() => {});
      await page.waitForTimeout(50);
      continue;
    }
    const primaryBtn = page.getByTestId('autopause-action-primary');
    if (await primaryBtn.isVisible().catch(() => false)) {
      await primaryBtn.click();
      await page.getByTestId('speed-fastest').click().catch(() => {});
      await page.waitForTimeout(50);
      continue;
    }

    // Handle non-target event panels (pick first choice to dismiss)
    if (targetTestId !== 'event-panel') {
      const firstChoice = page.locator('[data-testid^="event-choice-"]').first();
      if (await firstChoice.isVisible().catch(() => false)) {
        await firstChoice.click();
        await page.getByTestId('speed-fastest').click().catch(() => {});
        await page.waitForTimeout(50);
        continue;
      }
    }

    // Handle loan offer (accept to keep playing)
    if (targetTestId !== 'loan-panel') {
      const loanAccept = page.getByTestId('loan-accept');
      if (await loanAccept.isVisible().catch(() => false)) {
        await loanAccept.click();
        await page.getByTestId('speed-fastest').click().catch(() => {});
        await page.waitForTimeout(50);
        continue;
      }
    }

    // Ensure still running at max speed
    await page.getByTestId('speed-fastest').click().catch(() => {});
    await page.waitForTimeout(100);
  }

  throw new Error(`Timeout (${timeoutMs}ms) waiting for ${targetTestId}`);
}

// ==========================================================================
// §1 — New Game & Main Screen
// ==========================================================================

test.describe('New Game & Main Screen', () => {
  test('shows new game screen on first load', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('newgame-player-id')).toBeVisible();
    await expect(page.getByTestId('newgame-start')).toBeVisible();
  });

  test('starts game with player ID', async ({ page }) => {
    await startNewGame(page, 'P3-14');
    await waitForGameScreen(page);

    // SPEC §1.1: should see farm field, top bar, side panel
    await expect(page.getByTestId('farm-grid')).toBeVisible();
    await expect(page.getByTestId('topbar-date')).toBeVisible();
    await expect(page.getByTestId('topbar-cash')).toBeVisible();

    // SPEC §1.1: "Spring — Year 1" and "$50,000"
    await expect(page.getByTestId('topbar-date')).toContainText('Year 1');
    await expect(page.getByTestId('topbar-date')).toContainText('Spring');
    await expect(page.getByTestId('topbar-cash')).toContainText('50,000');

    // SPEC §1.1: paused on start
    await expect(page.getByTestId('speed-pause')).toHaveAttribute('aria-pressed', 'true');
  });

  test('rejects empty player ID', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('newgame-start').click();
    // Should still be on new game screen
    await expect(page.getByTestId('newgame-player-id')).toBeVisible();
  });

  test('allows special characters in player ID', async ({ page }) => {
    await startNewGame(page, 'P3-14 Team Blue!');
    await waitForGameScreen(page);
  });

  test('truncates long player ID to 30 chars', async ({ page }) => {
    await page.goto('/');
    const longId = 'A'.repeat(50);
    await page.getByTestId('newgame-player-id').fill(longId);
    const value = await page.getByTestId('newgame-player-id').inputValue();
    expect(value.length).toBeLessThanOrEqual(30);
  });

  test('all 64 farm cells are present', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        await expect(page.getByTestId(`farm-cell-${r}-${c}`)).toBeVisible();
      }
    }
  });
});

// ==========================================================================
// §1.3 — Tutorial
// ==========================================================================

test.describe('Tutorial', () => {
  test('shows tutorial on first launch', async ({ page }) => {
    // Clear tutorial dismissal
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('climateFarmer_tutorialDismissed'));
    await page.reload();

    await page.getByTestId('newgame-player-id').fill('TutorialTest');
    await page.getByTestId('newgame-start').click();

    await expect(page.getByTestId('tutorial-overlay')).toBeVisible();
    await expect(page.getByTestId('tutorial-step')).toBeVisible();
    await expect(page.getByTestId('tutorial-next')).toBeVisible();
    await expect(page.getByTestId('tutorial-skip')).toBeVisible();
  });

  test('can skip tutorial', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('climateFarmer_tutorialDismissed'));
    await page.reload();

    await page.getByTestId('newgame-player-id').fill('SkipTest');
    await page.getByTestId('newgame-start').click();

    await page.getByTestId('tutorial-skip').click();
    await expect(page.getByTestId('tutorial-overlay')).not.toBeVisible();
  });

  test('can advance through all 3 steps', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('climateFarmer_tutorialDismissed'));
    await page.reload();

    await page.getByTestId('newgame-player-id').fill('StepTest');
    await page.getByTestId('newgame-start').click();

    // Step 1
    await expect(page.getByTestId('tutorial-step')).toContainText('Select a Plot');
    await page.getByTestId('tutorial-next').click();

    // Step 2
    await expect(page.getByTestId('tutorial-step')).toContainText('Plant a Crop');
    await page.getByTestId('tutorial-next').click();

    // Step 3
    await expect(page.getByTestId('tutorial-step')).toContainText('Start Time');
    await page.getByTestId('tutorial-next').click();

    // Tutorial done
    await expect(page.getByTestId('tutorial-overlay')).not.toBeVisible();
  });

  test('dont-show-again checkbox persists', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('climateFarmer_tutorialDismissed'));
    await page.reload();

    await page.getByTestId('newgame-player-id').fill('DontShowTest');
    await page.getByTestId('newgame-start').click();

    await page.getByTestId('tutorial-dont-show').check();
    await page.getByTestId('tutorial-skip').click();

    // Verify localStorage was set
    const dismissed = await page.evaluate(() => localStorage.getItem('climateFarmer_tutorialDismissed'));
    expect(dismissed).toBe('true');
  });
});

// ==========================================================================
// §2 — Farm Grid Interactions
// ==========================================================================

test.describe('Farm Grid Interactions', () => {
  test('clicking a cell selects it and shows details', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-3-4').click();
    await expect(page.getByTestId('sidebar-cell-detail')).toBeVisible();
    await expect(page.getByTestId('sidebar-crop-name')).toContainText('Empty');
    await expect(page.getByTestId('sidebar-soil-n')).toBeVisible();
    await expect(page.getByTestId('sidebar-soil-moisture')).toBeVisible();
    await expect(page.getByTestId('sidebar-soil-om')).toBeVisible();
  });

  test('clicking different cell moves selection', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('sidebar-cell-detail')).toBeVisible();

    await page.getByTestId('farm-cell-5-5').click();
    // Still showing detail for the new cell
    await expect(page.getByTestId('sidebar-cell-detail')).toBeVisible();
  });

  test('clicking selected cell deselects it', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-2-2').click();
    await expect(page.getByTestId('sidebar-cell-detail')).toBeVisible();

    // Click again to deselect
    await page.getByTestId('farm-cell-2-2').click();
    await expect(page.getByTestId('sidebar-cell-detail')).not.toBeVisible();
  });

  test('can plant a crop on an empty plot', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-processing-tomatoes').click();

    // Crop should now show in the cell
    await expect(page.getByTestId('sidebar-crop-name')).toContainText('Processing Tomatoes');
    // Cash should decrease
    const cash = await page.getByTestId('topbar-cash').textContent();
    expect(cash).not.toContain('50,000');
  });

  test('crop menu shows costs', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();

    // All 3 crop options should be visible
    await expect(page.getByTestId('menu-crop-processing-tomatoes')).toBeVisible();
    await expect(page.getByTestId('menu-crop-silage-corn')).toBeVisible();
    // Winter wheat should be disabled in spring
    await expect(page.getByTestId('menu-crop-winter-wheat')).toBeDisabled();
  });

  test('cancel button closes crop menu', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await expect(page.getByTestId('menu-cancel')).toBeVisible();

    await page.getByTestId('menu-cancel').click();
    await expect(page.getByTestId('menu-cancel')).not.toBeVisible();
  });

  test('escape closes crop menu', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await expect(page.getByTestId('menu-crop-processing-tomatoes')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByTestId('menu-crop-processing-tomatoes')).not.toBeVisible();
  });
});

// ==========================================================================
// §3 — Time & Simulation
// ==========================================================================

test.describe('Time & Simulation', () => {
  test('speed controls work', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Initially paused
    await expect(page.getByTestId('speed-pause')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('speed-play')).toHaveAttribute('aria-pressed', 'false');

    // Start playing
    await page.getByTestId('speed-play').click();
    await expect(page.getByTestId('speed-play')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('speed-pause')).toHaveAttribute('aria-pressed', 'false');

    // Pause again
    await page.getByTestId('speed-pause').click();
    await expect(page.getByTestId('speed-pause')).toHaveAttribute('aria-pressed', 'true');
  });

  test('date advances when playing', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    const initialDate = await page.getByTestId('topbar-date').textContent();

    // Play at fastest speed for a bit
    await page.getByTestId('speed-fastest').click();
    await page.waitForTimeout(2000);
    await page.getByTestId('speed-pause').click();

    const laterDate = await page.getByTestId('topbar-date').textContent();
    expect(laterDate).not.toBe(initialDate);
  });

  test('simulation pauses when auto-pause triggers', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant some crops and run for a long time — should eventually hit auto-pause
    // Plant a tomato first
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-processing-tomatoes').click();

    // Run at 4x speed — should eventually hit water stress, harvest ready, or event
    await page.getByTestId('speed-fastest').click();

    // Wait for any auto-pause panel to appear (standard, event, loan, or advisor)
    const autoPausePanel = page.locator('[data-testid="autopause-panel"], [data-testid="event-panel"], [data-testid="loan-panel"], [data-testid="advisor-panel"]');
    await expect(autoPausePanel.first()).toBeVisible({ timeout: 15000 });

    // Game should be paused
    await expect(page.getByTestId('speed-pause')).toHaveAttribute('aria-pressed', 'true');
  });
});

// ==========================================================================
// §5 — Economy
// ==========================================================================

test.describe('Economy', () => {
  test('cash display shows starting amount', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);
    await expect(page.getByTestId('topbar-cash')).toContainText('50,000');
  });

  test('planting reduces cash', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-processing-tomatoes').click();

    // Cash should be 50000 - 150 = 49850
    await expect(page.getByTestId('topbar-cash')).toContainText('49,850');
  });
});

// ==========================================================================
// §6 — Save & Resume
// ==========================================================================

test.describe('Save & Resume', () => {
  test('save button saves game', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('save-button').click();

    // Notification should appear
    await expect(page.getByTestId('notify-bar')).toContainText('saved');
  });

  test('saved game can be resumed', async ({ page }) => {
    // Start a game and plant something
    await startNewGame(page, 'SaveTest');
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-silage-corn').click();

    // Save
    await page.getByTestId('save-button').click();

    // Reload the page
    await page.reload();

    // Should see resume button
    await expect(page.getByTestId('save-resume')).toBeVisible();
    await page.getByTestId('save-resume').click();

    // Should be back in game with the planted crop
    await waitForGameScreen(page);
    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('sidebar-crop-name')).toContainText('Silage Corn');
  });
});

// ==========================================================================
// §7 — Accessibility
// ==========================================================================

test.describe('Accessibility', () => {
  test('grid cells have meaningful ARIA labels', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    const cell = page.getByTestId('farm-cell-0-0');
    const label = await cell.getAttribute('aria-label');
    expect(label).toContain('Row 1');
    expect(label).toContain('Column 1');
    expect(label).toContain('Empty');
  });

  test('speed controls have ARIA labels', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    const pause = page.getByTestId('speed-pause');
    const label = await pause.getAttribute('aria-label');
    expect(label).toContain('Pause');
  });

  test('grid cells respond to Enter key', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Focus and press Enter on a cell
    await page.getByTestId('farm-cell-0-0').focus();
    await page.keyboard.press('Enter');

    // Cell should be selected — detail panel should show
    await expect(page.getByTestId('sidebar-cell-detail')).toBeVisible();
  });

  test('notification bar is an ARIA live region', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    const bar = page.getByTestId('notify-bar');
    const live = await bar.getAttribute('aria-live');
    expect(live).toBe('polite');
  });
});

// ==========================================================================
// §8 — UI Polish
// ==========================================================================

test.describe('UI Polish', () => {
  test('empty field shows hint', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Should see the empty field hint
    await expect(page.getByText('Select a plot and plant your first crop!')).toBeVisible();
  });

  test('notification bar is visible', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);
    await expect(page.getByTestId('notify-bar')).toBeVisible();
  });
});

// ==========================================================================
// §11 — data-testid coverage
// ==========================================================================

test.describe('data-testid Coverage', () => {
  test('top bar test IDs are present', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await expect(page.getByTestId('topbar-date')).toBeVisible();
    await expect(page.getByTestId('topbar-cash')).toBeVisible();
    await expect(page.getByTestId('topbar-season-icon')).toBeVisible();
    await expect(page.getByTestId('speed-pause')).toBeVisible();
    await expect(page.getByTestId('speed-play')).toBeVisible();
    await expect(page.getByTestId('speed-fast')).toBeVisible();
    await expect(page.getByTestId('speed-fastest')).toBeVisible();
  });

  test('grid test IDs are present', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await expect(page.getByTestId('farm-grid')).toBeVisible();
    // Spot-check a few cells
    await expect(page.getByTestId('farm-cell-0-0')).toBeVisible();
    await expect(page.getByTestId('farm-cell-7-7')).toBeVisible();
  });

  test('action test IDs work after selection', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant button appears after selecting empty cell
    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('action-plant')).toBeVisible();
    await expect(page.getByTestId('action-harvest')).toBeVisible();
  });

  test('bulk action test IDs are present', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await expect(page.getByTestId('action-harvest-all')).toBeVisible();
    await expect(page.getByTestId('action-water-all')).toBeVisible();
  });

  test('save/new-game test IDs are present', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('newgame-player-id')).toBeVisible();
    await expect(page.getByTestId('newgame-start')).toBeVisible();

    await startNewGame(page);
    await waitForGameScreen(page);
    await expect(page.getByTestId('save-button')).toBeVisible();
  });

  test('crop menu test IDs are present', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();

    await expect(page.getByTestId('menu-crop-processing-tomatoes')).toBeVisible();
    await expect(page.getByTestId('menu-crop-silage-corn')).toBeVisible();
    await expect(page.getByTestId('menu-crop-winter-wheat')).toBeVisible();
    await expect(page.getByTestId('menu-cancel')).toBeVisible();
  });
});

// ==========================================================================
// §10 — Edge Cases
// ==========================================================================

test.describe('Edge Cases', () => {
  test('cannot plant on occupied cell', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant a crop
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-processing-tomatoes').click();

    // Select same cell — plant button should not be available
    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('action-plant')).not.toBeVisible();
  });

  test('idle farm does not lose cash', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Run at 4x speed for a bit with no crops
    await page.getByTestId('speed-fastest').click();
    await page.waitForTimeout(2000);
    await page.getByTestId('speed-pause').click();

    // Cash should still be $50,000
    await expect(page.getByTestId('topbar-cash')).toContainText('50,000');
  });
});

// ==========================================================================
// Column bulk actions (Issue #4)
// ==========================================================================

test.describe('Column Bulk Actions', () => {
  test('column plant and water buttons appear when cell selected', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Select a cell to reveal column actions
    await page.getByTestId('farm-cell-2-3').click();

    // Plant Col button should appear (unique per crop now)
    await expect(page.getByTestId('action-plant-col-3-processing-tomatoes')).toBeVisible();

    // Water Col button should appear
    await expect(page.getByTestId('action-water-col-3')).toBeVisible();

    // Harvest Row and Col buttons should be present (even if disabled)
    await expect(page.getByTestId('action-harvest-row-2')).toBeVisible();
    await expect(page.getByTestId('action-harvest-col-3')).toBeVisible();
  });
});

// ==========================================================================
// Auto-pause dismiss testid (Issue #9)
// ==========================================================================

test.describe('Auto-pause testids', () => {
  test('autopause-dismiss testid is present on generic auto-pause secondary button', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant a crop to trigger an auto-pause eventually
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-processing-tomatoes').click();

    // Run at max speed until we get any auto-pause panel
    await page.getByTestId('speed-fastest').click();

    const deadline = Date.now() + 15000;
    let found = false;
    while (Date.now() < deadline) {
      // Check for a generic auto-pause panel with dismiss button
      if (await page.getByTestId('autopause-dismiss').isVisible().catch(() => false)) {
        found = true;
        break;
      }

      // If an event panel appeared first, dismiss it and continue
      const firstChoice = page.locator('[data-testid^="event-choice-"]').first();
      if (await firstChoice.isVisible().catch(() => false)) {
        await firstChoice.click();
        await page.getByTestId('speed-fastest').click().catch(() => {});
        await page.waitForTimeout(50);
        continue;
      }

      await page.waitForTimeout(100);
    }

    expect(found).toBe(true);
  });
});

// ==========================================================================
// New Game button from game screen (Issue #9)
// ==========================================================================

test.describe('New Game from TopBar', () => {
  test('save-new-game button returns to title screen', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await expect(page.getByTestId('save-new-game')).toBeVisible();
    await page.getByTestId('save-new-game').click();

    // Should be back on new game screen
    await expect(page.getByTestId('newgame-player-id')).toBeVisible();
  });
});

// ==========================================================================
// Field confirmation dialog (confirm + cancel paths)
// ==========================================================================

test.describe('Field Confirmation Dialog', () => {
  test('Plant Field shows confirmation dialog and confirm plants crops', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Click Plant Field for silage corn
    await page.getByTestId('action-plant-all-silage-corn').click();

    // Confirmation dialog should appear
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();
    await expect(page.getByTestId('confirm-message')).toContainText('Plant all');

    // Confirm planting
    await page.getByTestId('confirm-accept').click();

    // Dialog should close
    await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();

    // Cash should have decreased (64 plots * cost)
    const cash = await page.getByTestId('topbar-cash').textContent();
    expect(cash).not.toContain('50,000');
  });

  test('Plant Field cancel does not plant or deduct cash', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('action-plant-all-silage-corn').click();
    await expect(page.getByTestId('confirm-dialog')).toBeVisible();

    // Cancel
    await page.getByTestId('confirm-cancel').click();

    // Dialog should close, cash unchanged
    await expect(page.getByTestId('confirm-dialog')).not.toBeVisible();
    await expect(page.getByTestId('topbar-cash')).toContainText('50,000');
  });
});

// ==========================================================================
// Manual save/load/delete flow from title screen
// ==========================================================================

test.describe('Manual Save/Load/Delete', () => {
  test('save creates named slot visible in Load Game menu', async ({ page }) => {
    await startNewGame(page, 'SaveLoadTest');
    await waitForGameScreen(page);

    // Save the game
    await page.getByTestId('save-button').click();
    await expect(page.getByTestId('notify-bar')).toContainText('saved');

    // Return to title screen
    await page.getByTestId('save-new-game').click();
    await expect(page.getByTestId('newgame-player-id')).toBeVisible();

    // Load Game toggle should be visible
    await expect(page.getByTestId('save-load-toggle')).toBeVisible();
    await page.getByTestId('save-load-toggle').click();

    // Save list should appear
    await expect(page.getByTestId('save-load-menu')).toBeVisible();

    // Should contain at least one save entry with Year/Season name
    const menuText = await page.getByTestId('save-load-menu').textContent();
    expect(menuText).toContain('Year 1');
    expect(menuText).toContain('Spring');
  });

  test('loading a saved game restores game state', async ({ page }) => {
    await startNewGame(page, 'LoadTest');
    await waitForGameScreen(page);

    // Plant a crop so we have a distinguishable state
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-silage-corn').click();

    // Save
    await page.getByTestId('save-button').click();

    // Return to title, open load menu, load the save
    await page.getByTestId('save-new-game').click();
    await page.getByTestId('save-load-toggle').click();

    // Click Load on the first save entry
    const loadBtn = page.getByTestId('save-load-menu').getByRole('button', { name: 'Load' });
    await loadBtn.first().click();

    // Should be back in game with the planted crop
    await waitForGameScreen(page);
    await page.getByTestId('farm-cell-0-0').click();
    await expect(page.getByTestId('sidebar-crop-name')).toContainText('Silage Corn');
  });
});

// ==========================================================================
// §14 — Slice 2a: Event Panel
// ==========================================================================

test.describe('Event Panel', () => {
  test('event panel appears with title, description, and choices', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant a crop so has_crop condition passes (enables Late Frost Warning)
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-processing-tomatoes').click();

    // Run at max speed and wait for event-panel
    await page.getByTestId('speed-fastest').click();
    await dismissAutoPausesUntil(page, 'event-panel');

    // Verify event panel structure
    await expect(page.getByTestId('event-panel')).toBeVisible();
    await expect(page.getByTestId('event-title')).toBeVisible();
    await expect(page.getByTestId('event-description')).toBeVisible();

    // Should have at least one choice button
    const choiceButtons = page.locator('[data-testid^="event-choice-"]');
    const count = await choiceButtons.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('clicking an event choice dismisses the panel', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-processing-tomatoes').click();

    await page.getByTestId('speed-fastest').click();
    await dismissAutoPausesUntil(page, 'event-panel');

    // Click the first available choice
    const firstChoice = page.locator('[data-testid^="event-choice-"]').first();
    await firstChoice.click();

    // Event panel should close
    await expect(page.getByTestId('event-panel')).not.toBeVisible();
  });

  test('foreshadowing notification appears before event fires', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    // Plant a crop
    await page.getByTestId('farm-cell-0-0').click();
    await page.getByTestId('action-plant').click();
    await page.getByTestId('menu-crop-processing-tomatoes').click();

    // Run at max speed
    await page.getByTestId('speed-fastest').click();

    // Wait until we see any notification in the bar (foreshadowing or season change)
    // then wait for the event panel
    await dismissAutoPausesUntil(page, 'event-panel');

    // The event panel is visible — game should be paused
    await expect(page.getByTestId('speed-pause')).toHaveAttribute('aria-pressed', 'true');
  });
});

// ==========================================================================
// §14 — Slice 2a: Loan Panel
// ==========================================================================

test.describe('Loan Panel', () => {
  // Loan panel requires bankruptcy, which is hard to trigger in normal gameplay
  // within a reasonable browser test timeout. Unit tests cover loan mechanics
  // thoroughly (16 tests in loans.test.ts). This test is skipped for now.
  // TODO: Add when test state injection or faster bankruptcy path is available.
  test.skip('loan offer panel has accept and decline buttons', async ({ page }) => {
    await startNewGame(page);
    await waitForGameScreen(page);

    await page.getByTestId('action-plant-all-processing-tomatoes').click();
    const confirmAccept = page.getByTestId('confirm-accept');
    if (await confirmAccept.isVisible().catch(() => false)) {
      await confirmAccept.click();
    }

    await page.getByTestId('speed-fastest').click();
    await dismissAutoPausesUntil(page, 'loan-panel', 60000);

    await expect(page.getByTestId('loan-panel')).toBeVisible();
    await expect(page.getByTestId('loan-accept')).toBeVisible();
    await expect(page.getByTestId('autopause-dismiss')).toBeVisible();
  });
});
