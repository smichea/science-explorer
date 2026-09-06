import { createExplorer, expect, openHudControls, test } from './helpers';

test.describe('earlier years as foundations', () => {
  test('a 15-year-old explorer starts in Seconde: horizon, recommended route and flight', async ({
    page,
  }) => {
    await createExplorer(page, { name: 'Léa', age: 15 });
    const confirmation = page.getByTestId('horizon-confirmation');
    await expect(confirmation).toContainText('Seconde');
    await expect(confirmation).toContainText('Première');
    await page.goto('universe');
    // Every destination of the three years is ahead: far more than the Terminale slice alone.
    const start = page.getByTestId('tour-start-panel');
    await expect(start).toContainText(/destinations/);
    const count = Number((await start.textContent())?.match(/(\d+) destinations/)?.[1] ?? 0);
    expect(count).toBeGreaterThan(50);
    await start.click();
    const card = page.getByTestId('tour-card');
    await page.getByTestId('tour-next').click();
    await expect(card).toHaveAttribute('data-step-kind', 'leg');
    await expect(card).toContainText('Seconde');
    await page.getByTestId('tour-exit').click();
    // The stage filters offer Seconde and Première.
    await openHudControls(page);
    await page.getByTestId('atlas-filter').selectOption('seconde');
    await expect(page).toHaveURL(/filter=seconde/);
  });

  test('a Terminale explorer sees the foundations below and flies them only on request', async ({
    page,
  }) => {
    await createExplorer(page);
    await page.goto('universe');
    const start = page.getByTestId('tour-start-panel');
    await expect(start).toContainText(/31 destinations/);
    await start.click();
    const card = page.getByTestId('tour-card');
    await page.getByTestId('tour-include-foundations').check();
    await expect(card).toHaveAttribute('data-step-kind', 'intro');
    await page.getByTestId('tour-next').click();
    await expect(card).toContainText('Seconde');
    await page.getByTestId('tour-exit').click();
    await expect(start).not.toContainText(/31 destinations/);
    // A destination taught in Seconde and again in Terminale opens at its Terminale depth.
    await page.goto('concept/concept.function');
    await expect(page.getByTestId('follow-lesson')).toHaveAttribute('href', /depth=2/);
  });
});
