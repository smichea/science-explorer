import { completeGalileoMission, createExplorer, expect, test } from './helpers';

test.describe('backpack and application layer', () => {
  test.beforeEach(() => {
    test.skip(
      test.info().project.name !== 'desktop',
      'the full mission run is driven once, on the desktop profile'
    );
  });

  test('completing the mission updates coverage, mastery and the application routes', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await createExplorer(page);
    await completeGalileoMission(page);
    const summary = page.getByTestId('mission-complete');
    await expect(summary).toContainText('Dérivée');
    await page.getByTestId('return-to-map').click();
    await expect(page).toHaveURL(
      /concept\/tool\.derivative\?layer=applications&tool=tool\.derivative/
    );
    const solid = page.locator(
      '[data-testid="atlas-2d"] line[stroke="#5ee6a8"]:not([stroke-dasharray])'
    );
    const dashed = page.locator(
      '[data-testid="atlas-2d"] line[stroke="#5ee6a8"][stroke-dasharray]'
    );
    await expect(solid).toHaveCount(4);
    await expect(dashed).toHaveCount(4);

    await page.goto('backpack');
    const tool = page.locator('[data-testid="backpack-tool"][data-tool-id="tool.derivative"]');
    await expect(tool.getByTestId('coverage')).toContainText('4 / 8');
    await expect(tool.getByTestId('coverage')).toContainText(/\d+\s?%/);
    await expect(tool.getByTestId('mastery')).toContainText(
      /Confiance : (en construction|faible|solide)/
    );
    await expect(tool.getByTestId('mastery')).toContainText('Reconnaissance');
    await expect(tool.getByTestId('mastery')).toContainText('Transfert');
    await expect(tool).toContainText('Décroissance radioactive');

    // The guide can inspect the evidence behind the scores.
    await page.goto('guide/progress');
    const table = page.getByTestId('guide-progress');
    await expect(table).toContainText('Dérivée');
    await table.getByRole('button', { name: 'Plus' }).first().click();
    await expect(table).toContainText('tool_selected_for_model');

    // The journal records the completed mission.
    await page.goto('journal');
    await expect(page.getByTestId('journal')).toContainText(/Mission terminée/);
  });
});
