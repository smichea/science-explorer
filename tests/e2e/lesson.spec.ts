import { createExplorer, expect, expectNoHorizontalScroll, test } from './helpers';

/** Advances the lesson until a step of the given kind (bounded). */
async function nextUntil(page: import('@playwright/test').Page, kind: string, max = 12) {
  const player = page.getByTestId('lesson-player');
  for (let i = 0; i < max; i++) {
    if ((await player.getAttribute('data-step-kind')) === kind) return;
    await page.getByTestId('lesson-next').click();
  }
  throw new Error(`no step of kind ${kind} within ${max} steps`);
}

test.describe('narrated lessons', () => {
  test('follows a lesson: slides with a plotter, free play, typed exercises', async ({ page }) => {
    await createExplorer(page);
    await page.goto('concept/concept.function');
    await page.getByTestId('follow-lesson').click();
    await expect(page).toHaveURL(/\/lesson\/concept\.function$/);
    const player = page.getByTestId('lesson-player');
    await expect(player).toHaveAttribute('data-step-kind', 'slide');
    await expect(page.getByTestId('lesson-text')).toContainText('Une fonction associe');
    // The curve appears while the second sentence is read (timed pacing: no voice in the test browser).
    await expect(page.getByTestId('plotter')).toHaveAttribute('data-curves', '1', {
      timeout: 20_000,
    });

    // The free play draws the learner's own function.
    await nextUntil(page, 'play');
    await page.getByTestId('plotter-expression').fill('x^3-2*x');
    await expect(page.locator('[data-testid="plotter"] path[data-curve-id="custom"]')).toHaveCount(
      1
    );

    // Exercises with typed answers are checked and counted.
    await page.getByTestId('lesson-next').click();
    await expect(player).toHaveAttribute('data-step-kind', 'exercises');
    const first = page.locator('[data-exercise-id="exercise.function.image"]');
    await first.locator('[data-testid="numeric-input"]').fill('13');
    await first.locator('[data-testid="check-answer"]').click();
    await expect(first.locator('[data-testid="exercise-feedback"]')).toContainText(/Correct/);
    await expect(page.getByTestId('lesson-exercises-done')).toContainText('1 / 3');
    await expectNoHorizontalScroll(page);

    await page.getByTestId('lesson-next').click();
    await expect(page.getByTestId('lesson-finished')).toBeVisible();
    await expect(page.getByTestId('lesson-next-lesson')).toContainText('Courbe représentative');
  });

  test('every kind of tool answers to the learner: vectors, slope field, tabs', async ({
    page,
  }) => {
    test.skip(test.info().project.name !== 'desktop', 'checked once, on desktop');
    await createExplorer(page);
    // The vector lesson shows the sum as the second slide names it.
    await page.goto('lesson/tool.vector');
    await expect(page.getByTestId('vectors-tool')).toHaveAttribute('data-vectors', '1');
    await nextUntil(page, 'play');
    await expect(page.getByTestId('vectors-tool')).toHaveAttribute('data-vectors', '3');
    await expect(page.getByTestId('vectors-readout')).toContainText('u + v');
    // A slope field accepts an initial condition on click during the free play.
    await page.goto('lesson/tool.ode_first_order');
    await nextUntil(page, 'play');
    const field = page.getByTestId('slope-field-tool');
    await expect(field).toHaveAttribute('data-solutions', '3');
    const box = (await field.boundingBox())!;
    await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.45);
    await expect(field).toHaveAttribute('data-solutions', '4');
    // A lesson with two tools offers tabs during the free play.
    await page.goto('lesson/model.rc_circuit');
    await nextUntil(page, 'play');
    await expect(page.getByTestId('lesson-tool')).toHaveAttribute('data-tool', 'slope_field');
    await page.getByTestId('lesson-tab-simulation').click();
    await expect(page.getByTestId('lesson-tool')).toHaveAttribute('data-tool', 'simulation');
    await expect(page.getByTestId('simulation')).toBeVisible();
    // A dimension table lets the learner rebuild a derived quantity.
    await page.goto('lesson/concept.dimension_unit');
    await nextUntil(page, 'play');
    await expect(page.getByTestId('dimensions-builder')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
