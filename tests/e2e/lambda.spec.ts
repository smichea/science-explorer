import { test, expect, createExplorer, expectNoHorizontalScroll, solveExercise } from './helpers';
import { test as motionTest } from '@playwright/test';

test('draws terms, chooses a strategy, reduces, undoes and preserves free variables', async ({
  page,
}) => {
  await createExplorer(page);
  await page.goto('lambda');
  await expect(page.getByTestId('lambda-drawing')).toBeVisible();
  await page.getByTestId('lambda-strategy').selectOption('applicative');
  await page.getByTestId('lambda-play').click();
  await expect(page.getByTestId('lambda-status')).toContainText('Forme normale');
  await expect(page.getByTestId('lambda-step-count')).toHaveText('3');
  await page.getByTestId('lambda-undo').click();
  await expect(page.getByTestId('lambda-step-count')).toHaveText('2');
  await page.getByRole('button', { name: 'Recommencer', exact: true }).click();
  await page.getByTestId('lambda-strategy').selectOption('normal');
  await page.getByTestId('lambda-play').click();
  await expect(page.getByTestId('lambda-status')).toContainText('Forme normale');
  await expect(page.getByTestId('lambda-step-count')).toHaveText('4');
  await page.getByLabel('Exemples', { exact: true }).selectOption('capture');
  await page.getByTestId('lambda-step').click();
  await expect(page.getByTestId('lambda-current')).toHaveText("λy'. y");
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByTestId('lambda-status')).toContainText('Normal form');
  await page.getByTestId('lambda-input').fill('(λx.)');
  await page.getByTestId('lambda-draw').click();
  await expect(page.getByTestId('lambda-error')).toContainText('Incomplete');
  await expect(page.getByTestId('lambda-current')).toHaveText("λy'. y");
  await expectNoHorizontalScroll(page);
});

motionTest(
  'shows actual animated substitution and automatically stops an observed loop',
  async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'science-explorer.ui-preferences',
        JSON.stringify({
          performanceMode: '2d',
          reducedMotion: false,
          textScale: 1,
          mapView: '2d',
          tourVoice: false,
        })
      );
    });
    await createExplorer(page);
    await page.goto('lambda');
    await page.getByLabel('Exemples', { exact: true }).selectOption('copy');
    await page.getByTestId('lambda-step').click();
    await expect(page.getByTestId('lambda-diagram-tool')).toHaveAttribute(
      'data-phase',
      'highlight'
    );
    await expect(page.getByTestId('lambda-diagram-tool')).toHaveAttribute(
      'data-phase',
      'substitute'
    );
    await expect(page.getByTestId('lambda-step-count')).toHaveText('1');
    await page.getByLabel('Exemples', { exact: true }).selectOption('omega');
    await page.getByTestId('lambda-play').click();
    await expect(page.getByTestId('lambda-status')).toContainText('déjà rencontré');
    await expect(page.getByTestId('lambda-step-count')).toHaveText('1');
  }
);

test('rotates the 3D reduction graph, preserves parallel edges and loops, and distinguishes frontiers', async ({
  page,
}) => {
  await createExplorer(page);
  await page.goto('lambda?view=graph');
  await expect(page.getByTestId('lambda-graph-3d')).toBeVisible();
  const canvas = page.getByTestId('lambda-graph-3d');
  const before = await canvas.getAttribute('data-azimuth');
  await canvas.focus();
  await page.keyboard.press('ArrowRight');
  expect(await canvas.getAttribute('data-azimuth')).not.toBe(before);
  await page.getByLabel('Exemples', { exact: true }).selectOption('omega');
  await expect(page.getByTestId('lambda-graph-node')).toHaveCount(1);
  await expect(page.getByTestId('lambda-graph-edge')).toHaveCount(1);
  await page.getByTestId('lambda-spatial-edge').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('lambda-trail')).toContainText('0 → 0');
  await page.getByLabel('Exemples', { exact: true }).selectOption('escape');
  await page.locator('[data-testid="lambda-follow-edge"][data-path="a"]').click();
  await page.locator('[data-testid="lambda-follow-edge"][data-path=""]').click();
  await expect(page.getByTestId('lambda-graph-term')).toHaveText('λb. b');
  await page.getByTestId('lambda-graph-input').fill('(λx. x) ((λy. y) (λz. z))');
  await page.getByTestId('lambda-explore').click();
  await expect(page.locator('[data-testid="lambda-graph-edge"][data-from="0"]')).toHaveCount(2);
  await page.getByLabel('Profondeur d’exploration').fill('1');
  await page.getByTestId('lambda-explore').click();
  await expect(page.getByTestId('lambda-graph-status')).toContainText('Vue partielle');
  await expectNoHorizontalScroll(page);
});

test('the two authored lessons are reachable, follow their diagrams and record corrected exercises', async ({
  page,
}) => {
  await createExplorer(page);
  await page.goto('lesson/concept.lambda_calculus');
  await expect(page.getByTestId('lambda-current')).toHaveText('λx. x');
  await page.getByTestId('lesson-next').click();
  await expect(page.getByTestId('lambda-current')).toHaveText('(λx. x) (λz. z)');
  for (let i = 0; i < 5; i++) await page.getByTestId('lesson-next').click();
  await solveExercise(page, 'exercise.lambda.copy');
  await solveExercise(page, 'exercise.lambda.shadow');
  await solveExercise(page, 'exercise.lambda.capture');
  await page.getByTestId('lesson-next').click();
  await expect(page.getByTestId('lesson-finished')).toBeVisible();
  await page.getByTestId('lesson-next-lesson').click();
  await expect(page).toHaveURL(/lesson\/concept.lambda_reduction_paths/);
  await expect(page.getByTestId('lambda-graph-3d')).toBeVisible();
});
