import { expect, test } from '@playwright/test';

// Use Chromium's software WebGL backend for repeatable headless rendering.
test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });

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
    await expect(page.getByTestId('atlas-3d')).toHaveAttribute('data-detail', 'universe');
    await expect(page.locator('.atlas-label--node:visible')).toHaveCount(0);
    await page.locator('.atlas-label--world').filter({ hasText: 'Mathématiques' }).click();
    await expect(page.getByTestId('atlas-3d')).toHaveAttribute('data-detail', 'world');
    await expect(page.locator('.atlas-label--node:visible')).toHaveCount(0);
    const region = page.locator('.atlas-label--region').filter({ hasText: 'Fonctions et analyse' });
    await expect(region).toBeVisible();
    await region.click();
    await expect(page).toHaveURL(/region\/region\.math\.functions_analysis/);
    await expect(page.getByTestId('atlas-3d')).toHaveAttribute('data-detail', 'region');
    await expect(page.locator('.atlas-label--node:visible').first()).toBeVisible();
    await page.goto('concept/tool.derivative');
    await expect(page.locator('.atlas-label.is-selected')).toContainText('Dérivée');
    // The scene occupies only the area left visible by the panel, so its centre is the visible centre.
    const canvas = (await page.getByTestId('atlas-3d').locator('canvas').boundingBox())!;
    const panel = (await page.getByTestId('atlas-panel').boundingBox())!;
    expect(canvas.x + canvas.width).toBeLessThanOrEqual(panel.x + 1);
    // The primary drag can pan instead of orbiting; the choice survives a reload.
    await page.getByTestId('drag-pan').click();
    await expect(page.getByTestId('drag-pan')).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.getByTestId('drag-pan')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('drag-rotate')).toHaveAttribute('aria-pressed', 'false');
    // Select a destination that is actually visible in its region. Labels outside the
    // camera frustum are detached by CSS2DRenderer rather than kept as hidden DOM targets.
    await page.goto('region/region.math.functions_analysis');
    const destination = page.locator('.atlas-label--node:visible').first();
    await expect(destination).toBeVisible();
    const destinationId = await destination.getAttribute('data-id');
    await destination.click();
    await expect(page).toHaveURL((url) => url.pathname.endsWith(`/concept/${destinationId}`));
    await page.getByRole('button', { name: /Vue d’ensemble/ }).click();
    await expect(page).toHaveURL(/universe/);
  });
});
