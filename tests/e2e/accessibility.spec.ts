import { createExplorer, expect, test } from './helpers';

test.describe('accessibility', () => {
  test('the list view is keyboard navigable and selection is announced', async ({ page }) => {
    await createExplorer(page);
    await page.goto('universe?view=list');
    const link = page.locator('[data-testid="destination-list"] a[data-node-id="tool.derivative"]');
    await link.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/concept\/tool\.derivative/);
    await expect(
      page.getByTestId('concept-panel').getByRole('heading', { level: 1 })
    ).toContainText('Dérivée');
    await page.goto('universe');
    await page.getByTestId('atlas-search').fill('Galil');
    await page.getByRole('listbox').getByRole('option').first().click();
    await expect(page.locator('.app-live')).toContainText(/Sélection/);
  });

  test('destination states are conveyed by text, not colour alone', async ({ page }) => {
    await createExplorer(page);
    // Seen from another destination, the gradient (MP) still lacks the derivative: the map says so in words.
    await page.goto('concept/concept.function?view=2d');
    const node = page.locator('[data-testid="atlas-2d"] a[data-node-id="tool.gradient"]');
    await expect(node).toHaveAttribute('aria-label', /Prérequis essentiels manquants/);
    await expect(node).toHaveAttribute('data-state', 'missing_essential');
    // The concept page names the missing tools instead of showing a lock.
    await page.goto('concept/tool.gradient?view=2d');
    await expect(node).toHaveAttribute('data-state', 'missing_essential');
    await expect(page.getByTestId('route-options')).toContainText('Essentiels');
    await expect(page.getByTestId('route-options')).toContainText('Dérivée');
    await expect(page.getByTestId('node-status')).toContainText('⊘');
  });

  test('skip link and landmarks are present', async ({ page }) => {
    await createExplorer(page);
    await page.goto('backpack');
    await expect(page.locator('a.skip-link')).toHaveAttribute('href', '#main');
    await expect(page.locator('main#main')).toBeVisible();
    await expect(page.getByRole('navigation', { name: /Menu/ })).toBeVisible();
  });
});
