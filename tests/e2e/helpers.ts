import { expect, test as base, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ExerciseDefinition } from '../../src/lib/content-schema';

/**
 * Every journey runs on the 2D map with reduced motion, so the tests never depend on WebGL.
 * The WebGL smoke test opts out by using the plain Playwright `test`.
 */
export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(() => {
      window.localStorage.setItem(
        'science-explorer.ui-preferences',
        JSON.stringify({
          performanceMode: '2d',
          reducedMotion: true,
          textScale: 1,
          mapView: '2d',
          tourVoice: false,
        })
      );
    });
    await use(context);
  },
});
export { expect };

export const BASE = process.env.BASE_PATH ?? '';

export async function createExplorer(
  page: Page,
  options: { name?: string; age?: number; locale?: 'fr' | 'en' } = {}
) {
  const { name = 'Paul', age = 17, locale = 'fr' } = options;
  await page.goto('welcome');
  // The welcome page shows the language switch twice (header and form): both drive the same state.
  await page
    .getByRole('button', { name: locale === 'en' ? 'English' : 'Français' })
    .first()
    .click();
  await page.fill('#name', name);
  await page.fill('#age', String(age));
  await page.click('[data-testid="enter-universe"]');
  await expect(page.getByTestId('horizon-confirmation')).toBeVisible();
}

export async function openMap(page: Page) {
  await page.click('[data-testid="open-map"]');
  await expect(page).toHaveURL(/\/universe/);
}

const here = dirname(fileURLToPath(import.meta.url));
export const exercises: ExerciseDefinition[] = JSON.parse(
  readFileSync(join(here, '..', '..', 'static', 'content', 'core-0.1.0', 'exercises.json'), 'utf8')
);
export const exerciseById = (id: string) => exercises.find((e) => e.id === id)!;

/** Answers one exercise correctly through the UI (any type). */
export async function solveExercise(page: Page, id: string) {
  const ex = exerciseById(id);
  const root = page.locator(`[data-exercise-id="${id}"]`);
  await expect(root).toBeVisible();
  switch (ex.type) {
    case 'numeric': {
      await root.locator('[data-testid="numeric-input"]').fill(String(ex.numeric!.value));
      if (ex.numeric!.unit)
        await root.locator('[data-testid="unit-select"]').selectOption(ex.numeric!.unit);
      await root.locator('[data-testid="check-answer"]').click();
      break;
    }
    case 'choice': {
      for (const c of ex.choice!.choices.filter((c) => c.correct))
        await root.locator(`input[data-choice-id="${c.id}"]`).check();
      if (ex.choice!.requireReasoning)
        await root
          .locator('[data-testid="reasoning-input"]')
          .fill(
            'Parce que la vitesse de variation est le taux instantané, limite des taux moyens.'
          );
      await root.locator('[data-testid="check-answer"]').click();
      break;
    }
    case 'ordering': {
      const target = ex.ordering!.correctOrder;
      // Selection sort with the "move up" buttons.
      for (let i = 0; i < target.length; i++) {
        for (let guard = 0; guard < target.length; guard++) {
          const current = await root.locator('.ordering li .ordering__text').allTextContents();
          const ids = current.map(
            (text) =>
              ex.ordering!.items.find((it) => it.text.fr === text || it.text.en === text)!.id
          );
          const pos = ids.indexOf(target[i]);
          if (pos === i) break;
          await root.locator('.ordering li').nth(pos).getByRole('button').first().click();
        }
      }
      await root.locator('[data-testid="check-answer"]').click();
      break;
    }
    case 'symbolic': {
      await root.locator('[data-testid="symbolic-input"]').fill(ex.symbolic!.accepted[0]);
      await root.locator('[data-testid="check-answer"]').click();
      break;
    }
    case 'free_explanation': {
      await root
        .locator('[data-testid="explanation-input"]')
        .fill(
          'La dérivée est la limite du taux de variation quand la durée tend vers zéro : elle donne la vitesse à un instant, ce que Galilée ne pouvait pas écrire.'
        );
      await root.getByRole('button', { name: /Envoyer|Submit/ }).click();
      return;
    }
  }
  await expect(root.locator('[data-testid="exercise-feedback"]')).toContainText(/Correct/);
}

export async function continueStep(page: Page) {
  const button = page.getByTestId('mission-continue');
  await expect(button).toBeEnabled();
  await button.click();
}

export async function currentStepId(page: Page): Promise<string> {
  return (await page.getByTestId('mission-step').getAttribute('data-step-id')) ?? '';
}

/** Drives the whole Galileo mission (Terminale variant) to completion. */
export async function completeGalileoMission(page: Page) {
  await page.goto('mission/mission.galileo.inclined_plane');
  await page.click('[data-testid="start-variant-terminale"]');
  await expect(page.getByTestId('mission-step')).toHaveAttribute('data-step-id', 'arrival');
  await continueStep(page); // arrival
  await continueStep(page); // role
  await continueStep(page); // question
  await page.click('[data-choice-id="speed_time"]');
  await continueStep(page); // hypothesis
  await page.fill('[data-input-id="ratio_2"]', '4');
  await page.fill('[data-input-id="ratio_3"]', '9');
  await page.click('[data-testid="step-inputs"] button[type=submit]');
  await continueStep(page); // prediction
  await page.click('[data-testid="clock-mark-1"]');
  await page.click('[data-testid="clock-mark-2"]');
  await page.click('[data-testid="clock-mark-3"]');
  await continueStep(page); // observe
  await solveExercise(page, 'exercise.galileo.graph_linearise');
  await solveExercise(page, 'exercise.galileo.ratio_distances');
  await continueStep(page); // graph_construction
  await solveExercise(page, 'exercise.galileo.instantaneous_need');
  await continueStep(page); // need_for_tool
  for (const id of [
    'exercise.workshop.difference_quotient',
    'exercise.workshop.limit_value',
    'exercise.workshop.tangent_reading',
    'exercise.workshop.power_rule',
    'exercise.workshop.method_order',
  ])
    await solveExercise(page, id);
  await continueStep(page); // workshop
  await page.click('[data-tool-id="tool.derivative"]');
  for (const id of [
    'exercise.return.speed_definition',
    'exercise.return.velocity_value',
    'exercise.return.free_fall_extrapolation',
  ])
    await solveExercise(page, id);
  await continueStep(page); // return_calculation
  await page.click('[data-tool-id="tool.derivative"]');
  for (const id of ['exercise.transfer.rc_model', 'exercise.transfer.rc_rate'])
    await solveExercise(page, id);
  await continueStep(page); // transfer_rc
  await page.click('[data-tool-id="tool.derivative"]');
  for (const id of ['exercise.transfer.kinetics_rate', 'exercise.transfer.classify_rate_processes'])
    await solveExercise(page, id);
  await continueStep(page); // transfer_kinetics
  await continueStep(page); // debrief
  await solveExercise(page, 'exercise.debrief.reflection');
  await continueStep(page); // reflection
  await expect(page.getByTestId('mission-step')).toHaveAttribute('data-step-id', 'map_return');
  await continueStep(page); // map_return
  await expect(page.getByTestId('mission-complete')).toBeVisible();
}

/** On phones the filter and layer controls sit behind a toggle in the HUD. */
export async function openHudControls(page: Page) {
  const toggle = page.getByRole('button', { name: /Filtre|Filter/ });
  if ((await toggle.isVisible()) && !(await page.getByTestId('atlas-layer').isVisible()))
    await toggle.click();
}

export async function expectNoHorizontalScroll(page: Page) {
  const [scrollWidth, clientWidth] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ]);
  expect(scrollWidth, 'no horizontal page scroll').toBeLessThanOrEqual(clientWidth + 1);
}
