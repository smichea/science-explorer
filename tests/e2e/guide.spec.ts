import { continueStep, createExplorer, expect, test } from './helpers';

test.describe('guide mode', () => {
  test('protects guide pages with a local PIN, shows timing and prompts, and records notes', async ({
    page,
    context,
  }) => {
    await createExplorer(page);
    await page.goto('mission/mission.galileo.inclined_plane');
    await page.click('[data-testid="start-variant-terminale"]');
    await continueStep(page);

    await page.goto('settings');
    await page.getByTestId('pin-input').fill('1234');
    await page.getByRole('button', { name: /Définir le code/ }).click();
    await expect(page.getByRole('button', { name: /Retirer le code/ })).toBeVisible();

    // The guide who just set the code stays unlocked in this tab; a new tab asks for the code.
    await page.goto('guide/progress');
    await expect(page.getByTestId('guide-progress')).toBeVisible();
    const learnerTab = await context.newPage();
    await learnerTab.goto('guide/progress');
    await expect(learnerTab.getByTestId('guide-unlock')).toBeVisible();
    await learnerTab.getByTestId('guide-pin').fill('0000');
    await learnerTab.getByRole('button', { name: /Déverrouiller/ }).click();
    await expect(learnerTab.getByRole('alert')).toContainText(/incorrect/);
    await learnerTab.getByTestId('guide-pin').fill('1234');
    await learnerTab.getByRole('button', { name: /Déverrouiller/ }).click();
    await expect(learnerTab.getByTestId('guide-progress')).toBeVisible();
    await learnerTab.close();

    await page
      .getByRole('link', { name: /Ouvrir la vue guide/ })
      .first()
      .click();
    const session = page.getByTestId('guide-session');
    await expect(session).toContainText(/Total : 76 min/);
    await expect(session).toContainText(/Questions orales/);
    await session.getByRole('button', { name: /Retenir les indices/ }).click();
    await expect(session.getByRole('button', { name: /Retenir les indices/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await session.getByRole('button', { name: /Sauter cette étape/ }).click();
    await expect(session).toContainText(/sautée/);
    await page
      .getByTestId('guide-note')
      .fill('Paul a bien compris la différence entre vitesse moyenne et instantanée.');
    await page.getByRole('button', { name: /Enregistrer la note/ }).click();
    await page.goto('journal');
    await expect(page.getByTestId('journal')).toContainText('vitesse moyenne et instantanée');

    await page.goto('guide/planner');
    await expect(page.getByTestId('guide-planner')).toContainText(/Galilée/);
  });
});
