import { createExplorer, expect, expectNoHorizontalScroll, openMap, test } from './helpers';

test.describe('onboarding and horizon', () => {
  test('creates Paul, 17, in French without any account and highlights Terminale → MPSI → MP', async ({
    page,
  }) => {
    await page.goto('welcome');
    await expect(page.getByText(/Pas de compte|No account/)).toBeVisible();
    await expectNoHorizontalScroll(page);
    await createExplorer(page, { name: 'Paul', age: 17, locale: 'fr' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    const confirmation = page.getByTestId('horizon-confirmation');
    await expect(confirmation).toContainText('Terminale');
    await expect(confirmation).toContainText('MPSI');
    await expect(confirmation).toContainText('MP (');
    await expect(confirmation).toContainText(/pas une restriction/);
    const index = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('science-explorer.profile-index') ?? '{}')
    );
    expect(index.profiles?.[0]?.name).toBe('Paul');
    expect(index.profiles?.[0]?.age).toBe(17);
    await openMap(page);
    await expect(page.getByTestId('universe-panel')).toBeVisible();
    await expect(page.getByTestId('atlas-2d')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('rejects an empty name or an impossible age', async ({ page }) => {
    await page.goto('welcome');
    await page.fill('#age', '3');
    await page.click('[data-testid="enter-universe"]');
    await expect(page.locator('#name-error')).toBeVisible();
    await expect(page.locator('#age-error')).toBeVisible();
  });

  test('welcomes a returning explorer with resume options', async ({ page }) => {
    await createExplorer(page, { name: 'Paul', age: 17 });
    await openMap(page);
    await page.goto('welcome');
    await expect(page.getByRole('heading', { name: /Bon retour, Paul/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Reprendre/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /Changer/ })).toBeVisible();
  });

  test('English onboarding shows the same geography', async ({ page }) => {
    await createExplorer(page, { name: 'Ada', age: 18, locale: 'en' });
    await expect(page.getByTestId('horizon-confirmation')).toContainText('MPSI');
    await openMap(page);
    await expect(page.getByTestId('universe-panel')).toContainText('Mathematics');
    await expect(
      page.locator('[data-testid="atlas-2d"] .label--world', { hasText: 'Physics' })
    ).toHaveCount(1);
  });
});
