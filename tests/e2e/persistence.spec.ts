import { BASE, createExplorer, expect, test } from './helpers';

test.describe('local persistence, offline and transfer', () => {
  test('restores the explorer after closing and reopening, and works offline once installed', async ({
    page,
    context,
  }) => {
    await createExplorer(page);
    await page.goto('concept/concept.function');
    await expect(page.getByTestId('concept-panel')).toContainText('Fonction');

    const reopened = await context.newPage();
    await reopened.goto('welcome');
    await expect(reopened.getByRole('heading', { name: /Bon retour, Paul/ })).toBeVisible();
    await expect(reopened.getByText(/Dernière visite : Fonction/)).toBeVisible();

    // Wait for the service worker to install and cache the shell, then go offline.
    await reopened.goto('universe');
    await reopened.waitForFunction(
      async (base) => {
        if (!('serviceWorker' in navigator)) return true;
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration?.active || !navigator.serviceWorker.controller) return false;
        return !!(await caches.match(`${base}/404.html`));
      },
      BASE,
      { timeout: 30_000 }
    );
    await context.setOffline(true);
    await reopened.goto('journal');
    await expect(reopened.getByTestId('journal')).toBeVisible();
    await expect(reopened.getByText(/Hors ligne/)).toBeVisible();
    await context.setOffline(false);
  });

  test('exports progress and restores it as a separate explorer', async ({ page, context }) => {
    await createExplorer(page);
    await page.goto('mission/mission.galileo.inclined_plane');
    await page.click('[data-testid="start-variant-terminale"]');
    await page.getByTestId('mission-continue').click();
    await page.goto('settings');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('export-button').click(),
    ]);
    const path = await download.path();
    expect(path).toBeTruthy();

    const other = await context.newPage();
    await other.goto('welcome?new=1');
    await other.fill('#name', 'Guide');
    await other.fill('#age', '45');
    await other.click('[data-testid="enter-universe"]');
    await other.goto('settings');
    await other.setInputFiles('[data-testid="import-file"]', path!);
    const preview = other.getByTestId('import-preview');
    await expect(preview).toContainText('Paul');
    await expect(preview).toContainText(/1 sessions de mission/);
    await other.getByTestId('import-create').click();
    await expect(other.getByText(/Import terminé/)).toBeVisible();
    await other.goto('profiles');
    await expect(other.getByRole('listitem').filter({ hasText: 'Paul' })).toHaveCount(2);
    await other.goto('guide/progress');
    await expect(other.getByTestId('guide-progress')).toContainText(/Galilée/);
  });
});
