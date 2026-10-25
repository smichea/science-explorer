import { expect, test, type Page } from '@playwright/test';
import { createExplorer } from './helpers';

declare global {
  interface Window {
    spoken: { text: string; lang: string }[];
    finishSpeech: () => void;
  }
}

// Observe what the app sends to the browser voice without depending on an installed voice.
test.beforeEach(async ({ page }) => {
  test.skip(test.info().project.name !== 'desktop', 'voice integration checked once');
  await page.addInitScript(() => {
    localStorage.setItem(
      'science-explorer.ui-preferences',
      JSON.stringify({ performanceMode: '2d', reducedMotion: true, mapView: '2d', voice: true })
    );
    window.spoken = [];
    let pending: SpeechSynthesisUtterance | null = null;
    window.finishSpeech = () => pending?.dispatchEvent(new Event('end'));
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        getVoices: () => [],
        addEventListener: () => {},
        cancel: () => {
          pending?.dispatchEvent(new Event('error'));
          pending = null;
        },
        speak: (utterance: SpeechSynthesisUtterance) => {
          window.spoken.push({ text: utterance.text, lang: utterance.lang });
          // Keep this sentence active until the learner navigates or stops it.
          pending = utterance;
        },
      },
    });
  });
});

async function spokenText(page: Page) {
  return page.evaluate(() => window.spoken.map((utterance) => utterance.text).join(' '));
}

for (const locale of ['fr', 'en'] as const) {
  test(`reads the actual lambda lesson in ${locale}, including after an offline reload`, async ({
    page,
    context,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await createExplorer(page, { locale });
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.goto('lesson/concept.lambda_calculus');
    await expect(page.getByTestId('lesson-player')).toBeVisible();
    await page.waitForFunction(async () => !!(await caches.match(location.href)));
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('lesson-player')).toBeVisible();
    for (let i = 0; i < 5; i++) await page.getByTestId('lesson-next').click();
    await expect(page.getByTestId('lesson-player')).toHaveAttribute('data-step-kind', 'play');
    await expect
      .poll(() => spokenText(page))
      .toContain(
        locale === 'fr' ? 'lambda f point lambda x point' : 'lambda f period lambda x period'
      );
    expect(await spokenText(page)).not.toMatch(/\b(formule|formula)\b/);
    expect(await page.evaluate(() => window.spoken.at(-1)?.lang)).toBe(
      locale === 'fr' ? 'fr-FR' : 'en-GB'
    );
    expect(errors).toEqual([]);
  });
}

test.describe('shared reader', () => {
  test.use({ serviceWorkers: 'block' });

  test('the same mathematical reader serves destination overviews and guided tours', async ({
    page,
  }) => {
    // Existing overviews are mostly plain prose. Supply authored math through the content API
    // to exercise both callers, without exporting application internals to the browser test.
    await page.route('**/content/*/graph.json', async (route) => {
      const response = await route.fetch();
      const graph = await response.json();
      const node = graph.nodes.find((entry: { id: string }) => entry.id === 'concept.function');
      node.overview.fr = String.raw`On lit $x^2$, $\frac{1}{2}$ et $u_{n+1}=2u_n$.`;
      await route.fulfill({ response, json: graph });
    });
    await createExplorer(page);
    await page.goto('concept/concept.function');
    await expect.poll(() => spokenText(page)).toContain('x au carré');
    expect(await spokenText(page)).toContain('un-demi');
    expect(await spokenText(page)).toContain('u indice n plus 1 égale 2 u indice n');

    await page.goto('universe');
    await page.getByTestId('tour-start').click();
    await page.getByTestId('tour-next').click();
    await page.getByTestId('tour-next').click();
    await expect(page.getByTestId('tour-card')).toHaveAttribute('data-step-kind', 'stop');
    await expect.poll(() => spokenText(page)).toContain('Fonction.');
    await page.evaluate(() => window.finishSpeech());
    await expect.poll(() => spokenText(page)).toContain('x au carré');
    expect(await spokenText(page)).toContain('un-demi');
    expect(await spokenText(page)).toContain('u indice n plus 1 égale 2 u indice n');
  });
});
