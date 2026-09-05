import {
  continueStep,
  createExplorer,
  currentStepId,
  expect,
  expectNoHorizontalScroll,
  solveExercise,
  test,
} from './helpers';

test.describe('historical mission', () => {
  test.beforeEach(async ({ page }) => {
    await createExplorer(page);
  });

  test('identifies place, time and scientist, asks for a prediction before the simulation and resumes after a reload', async ({
    page,
  }) => {
    await page.goto('mission/mission.galileo.inclined_plane');
    const player = page.getByTestId('mission-player');
    await expect(player).toContainText('Padoue');
    await expect(player).toContainText(/vers 1604/);
    await expect(player).toContainText('Galilée');
    await page.click('[data-testid="start-variant-terminale"]');
    expect(await currentStepId(page)).toBe('arrival');
    await expect(page.getByTestId('mission-progress')).toContainText('1');
    await continueStep(page);
    await continueStep(page);
    await continueStep(page);
    expect(await currentStepId(page)).toBe('hypothesis');
    await expect(page.getByTestId('mission-continue')).toBeDisabled();
    await page.click('[data-choice-id="speed_time"]');
    await expect(page.getByTestId('step-choice')).toContainText(/enregistrée/);
    await continueStep(page);
    expect(await currentStepId(page)).toBe('prediction');
    await expect(page.getByTestId('simulation')).toHaveCount(0);
    await page.fill('[data-input-id="ratio_2"]', '4');
    await page.fill('[data-input-id="ratio_3"]', '9');
    await page.click('[data-testid="step-inputs"] button[type=submit]');
    await continueStep(page);
    expect(await currentStepId(page)).toBe('observe');
    await expect(page.getByTestId('simulation')).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.click('[data-testid="clock-mark-1"]');
    await page.click('[data-testid="clock-mark-2"]');
    await expect(page.getByTestId('mission-continue')).toBeDisabled();
    await page.click('[data-testid="clock-mark-3"]');
    await page.click('[data-testid="sim-step"]');
    await continueStep(page);
    expect(await currentStepId(page)).toBe('graph_construction');

    await page.reload();
    await expect(page.getByTestId('mission-step')).toHaveAttribute(
      'data-step-id',
      'graph_construction'
    );
    await expect(page.getByTestId('mission-progress')).toContainText('7');
    // A second start never creates a second session: the concept page offers to resume.
    await page.goto('concept/mission.galileo.inclined_plane');
    await expect(page.getByTestId('start-mission')).toContainText(/Reprendre/);
  });

  test('checks numeric answers with a French decimal comma and credits autonomy after a hint', async ({
    page,
  }) => {
    await page.goto('mission/mission.galileo.inclined_plane');
    await page.click('[data-testid="start-variant-terminale"]');
    for (let i = 0; i < 3; i++) await continueStep(page);
    await page.click('[data-choice-id="speed_time"]');
    await continueStep(page);
    await page.fill('[data-input-id="ratio_2"]', '4');
    await page.fill('[data-input-id="ratio_3"]', '9');
    await page.click('[data-testid="step-inputs"] button[type=submit]');
    await continueStep(page);
    for (const k of [1, 2, 3]) await page.click(`[data-testid="clock-mark-${k}"]`);
    await continueStep(page);
    await solveExercise(page, 'exercise.galileo.graph_linearise');
    const ratio = page.locator('[data-exercise-id="exercise.galileo.ratio_distances"]');
    await ratio.getByRole('button', { name: /indice/i }).click();
    await expect(ratio).toContainText(/Autonomie créditée : 0.8/);
    await ratio.locator('[data-testid="numeric-input"]').fill('3,9');
    await ratio.locator('[data-testid="check-answer"]').click();
    await expect(ratio.locator('[data-testid="exercise-feedback"]')).toContainText('Correct');
    await expect(page.getByTestId('mission-continue')).toBeEnabled();
  });

  test('the discovery variant skips the optional steps', async ({ page }) => {
    await page.goto('mission/mission.galileo.inclined_plane');
    await page.click('[data-testid="start-variant-discovery"]');
    await expect(page.getByTestId('mission-progress')).toContainText('10');
  });
});
