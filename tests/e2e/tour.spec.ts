import { createExplorer, expect, expectNoHorizontalScroll, test } from './helpers';

/** Advances the flight until a step of the given kind is shown (bounded). */
async function nextUntil(page: import('@playwright/test').Page, kind: string, max = 40) {
  const card = page.getByTestId('tour-card');
  for (let i = 0; i < max; i++) {
    if ((await card.getAttribute('data-step-kind')) === kind) return;
    await page.getByTestId('tour-next').click();
  }
  throw new Error(`no step of kind ${kind} within ${max} steps`);
}

test.describe('bird’s-eye flight', () => {
  test('flies over the remaining programme along the routes, with authored transitions', async ({
    page,
  }) => {
    await createExplorer(page);
    await page.goto('universe');
    const start = page.getByTestId('tour-start-panel');
    await expect(start).toContainText(/32 destinations/);
    await start.click();

    const card = page.getByTestId('tour-card');
    await expect(card).toBeVisible();
    await expect(card).toHaveAttribute('data-step-kind', 'intro');
    await expect(card).toContainText(/Étape 1 sur/);
    await expect(card).toContainText(/Bienvenue à bord/);
    // The URL never changes during a flight.
    await expect(page).toHaveURL(/\/universe$/);

    await page.getByTestId('tour-next').click();
    await expect(card).toHaveAttribute('data-step-kind', 'leg');
    await expect(card).toContainText('Premier voyage');
    await page.getByTestId('tour-next').click();
    await expect(card).toHaveAttribute('data-step-kind', 'stop');
    await expect(card.getByRole('heading', { level: 1 })).toHaveText('Fonction');
    await expect(card).toContainText(/Une fonction associe/);
    // The map follows: the current stop is marked, the leg is drawn as a white path.
    await expect(
      page.locator('[data-testid="atlas-2d"] a[data-node-id="concept.function"]')
    ).toHaveAttribute('aria-current', 'true');
    await expect(page.locator('[data-testid="atlas-2d"] line[stroke="#ffffff"]')).toHaveCount(5);

    // Moving on to the second route shows its transition sentence before its stops.
    await page.getByTestId('tour-next').click();
    await nextUntil(page, 'leg');
    await expect(card.getByTestId('tour-transition')).toContainText(
      /Remontons maintenant le temps/
    );
    await expect(card).toContainText('Galilée à Padoue');

    // Opening the full lesson leaves the flight and navigates to the concept page.
    await page.getByTestId('tour-next').click();
    await expect(card).toHaveAttribute('data-step-kind', 'stop');
    await page.getByTestId('tour-open').click();
    await expect(page).toHaveURL(/\/concept\/period\.galileo_padua_1592_1610/);
    await expect(page.getByTestId('tour-card')).toHaveCount(0);
    await expect(page.getByTestId('concept-panel')).toBeVisible();

    // Leaving the flight restores the universe panel.
    await page.goto('universe');
    await page.getByTestId('tour-start-panel').click();
    await expect(page.getByTestId('tour-card')).toBeVisible();
    await page.getByTestId('tour-exit').click();
    await expect(page.getByTestId('tour-card')).toHaveCount(0);
    await expect(page.getByTestId('universe-panel')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('advances by itself, can pause, and remembers the voice preference', async ({ page }) => {
    test.skip(test.info().project.name !== 'desktop', 'timing checked once, on desktop');
    await createExplorer(page);
    await page.goto('universe');
    await page.getByTestId('tour-start').click();
    const card = page.getByTestId('tour-card');
    await expect(card).toHaveAttribute('data-step-index', '0');
    // No voice in the test browser: the next step comes after the estimated reading time.
    await expect(card).toHaveAttribute('data-step-index', '1', { timeout: 40_000 });
    await page.getByTestId('tour-toggle').click();
    await expect(page.getByTestId('tour-toggle')).toContainText(/Reprendre/);
    await page.waitForTimeout(1500);
    await expect(card).toHaveAttribute('data-step-index', '1');
    await expect(page.getByTestId('tour-voice')).toHaveAttribute('aria-pressed', 'false');
    const prefs = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('science-explorer.ui-preferences') ?? '{}')
    );
    expect(prefs.tourVoice).toBe(false);
  });

  test('skips what is already practised and can include it again', async ({ page }) => {
    test.skip(test.info().project.name === 'tablet', 'covered on desktop and phone');
    await createExplorer(page);
    // Practising the derivative through a solved exercise removes it from the remaining programme.
    await page.goto('mission/mission.galileo.inclined_plane');
    await page.click('[data-testid="start-variant-terminale"]');
    await page.goto('universe');
    await page.getByTestId('tour-start-panel').click();
    const card = page.getByTestId('tour-card');
    await page.getByTestId('tour-include-done').check();
    await expect(card).toHaveAttribute('data-step-index', '0');
    await expect(page.getByTestId('tour-include-done')).toBeChecked();
    await page.getByTestId('tour-exit').click();
    await expectNoHorizontalScroll(page);
  });
});
