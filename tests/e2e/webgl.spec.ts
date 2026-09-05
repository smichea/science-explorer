import { expect, test } from '@playwright/test';

test.describe('3D atlas', () => {
  test.beforeEach(() => {
    test.skip(
      test.info().project.name !== 'desktop',
      'WebGL smoke test runs on the desktop profile'
    );
  });

  test('renders the atlas with worlds, regions and labels, and frames the selected node', async ({
    page,
  }) => {
    await page.goto('welcome');
    await page.getByRole('button', { name: 'Français' }).first().click();
    const hasWebgl = await page.evaluate(
      () => !!document.createElement('canvas').getContext('webgl2')
    );
    test.skip(!hasWebgl, 'WebGL is not available in this browser');
    await page.fill('#name', 'Paul');
    await page.fill('#age', '17');
    await page.click('[data-testid="enter-universe"]');
    await page.click('[data-testid="open-map"]');
    await expect(page.getByTestId('atlas-3d').locator('canvas')).toBeVisible();
    await expect(page.locator('.atlas-label--world')).toHaveCount(3);
    await expect(page.locator('.atlas-label').filter({ hasText: 'Mathématiques' })).toBeVisible();
    await page.goto('concept/tool.derivative');
    await expect(page.locator('.atlas-label.is-selected')).toContainText('Dérivée');
    await page
      .locator('.atlas-label--node .atlas-label__text', { hasText: /^Fonction$/ })
      .locator('..')
      .dispatchEvent('pointerup');
    await expect(page).toHaveURL(/concept\/concept\.function/);
    await page.getByRole('button', { name: /Vue d’ensemble/ }).click();
    await expect(page).toHaveURL(/universe/);
  });
});
