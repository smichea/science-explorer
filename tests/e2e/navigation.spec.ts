import { createExplorer, expect, expectNoHorizontalScroll, openHudControls, test } from './helpers';

test.describe('universe navigation', () => {
  test.beforeEach(async ({ page }) => {
    await createExplorer(page);
  });

  test('switching language keeps the selection, the URL and the progress', async ({ page }) => {
    await page.goto('concept/tool.derivative');
    await expect(page.getByTestId('concept-panel')).toContainText('Dérivée');
    const before = page.url();
    await page
      .getByRole('button', { name: /^(EN|English)$/ })
      .first()
      .click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByTestId('concept-panel')).toContainText('Derivative');
    expect(page.url()).toBe(before);
    await expect(page.locator('[data-testid="atlas-2d"] a[aria-current="true"]')).toHaveAttribute(
      'data-node-id',
      'tool.derivative'
    );
    await page
      .getByRole('button', { name: /^(FR|Français)$/ })
      .first()
      .click();
    await expect(page.getByTestId('concept-panel')).toContainText('Dérivée');
  });

  test('an MP destination shows prerequisite routes instead of a lock', async ({ page }) => {
    await page.goto('concept/tool.gradient');
    const options = page.getByTestId('route-options');
    await expect(options).toBeVisible();
    await expect(options).toContainText(/interrompue/);
    await expect(options).toContainText('Dérivée');
    await expect(options.getByRole('link', { name: /route recommandée/ })).toBeVisible();
    await expect(options.getByRole('button', { name: /plus tard/ })).toBeVisible();
    await expect(page.getByTestId('concept-panel')).not.toContainText('🔒');
    await options.getByRole('button', { name: /plus tard/ }).click();
    await expect(options.getByRole('button', { name: /Retirer/ })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('search, filters, layers and the list view select the same canonical nodes', async ({
    page,
  }) => {
    await page.goto('universe');
    await page.getByTestId('atlas-search').fill('Galil');
    await page
      .getByRole('option', { name: /Galilée/ })
      .first()
      .click();
    await expect(page).toHaveURL(
      /concept\/(mission\.galileo\.inclined_plane|person\.galileo_galilei)/
    );
    await page.goto('universe?view=list');
    await expect(page.getByTestId('destination-list')).toBeVisible();
    await page
      .locator('[data-testid="destination-list"] a[data-node-id="concept.function"]')
      .click();
    await expect(page).toHaveURL(/concept\/concept\.function/);
    await expect(page.getByTestId('concept-panel')).toContainText('Fonction');
    await openHudControls(page);
    await page.getByTestId('atlas-layer').selectOption('history');
    await expect(page).toHaveURL(/layer=history/);
    await openHudControls(page);
    await page.getByTestId('atlas-filter').selectOption('mp');
    await expect(page).toHaveURL(/filter=mp/);
  });

  test('worlds and regions have their own accessible pages', async ({ page }) => {
    await page.goto('world/world.physics');
    await expect(page.getByTestId('world-panel')).toContainText('Physique');
    await page.goto('region/region.chemistry.kinetics');
    await expect(page.getByTestId('region-panel')).toContainText('Cinétique');
    await page.goto('region/region.physics.quantum');
    await expect(page.getByTestId('region-panel')).toContainText(/pas encore de destination/);
  });
});
