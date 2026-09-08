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
    // Aged 15: the function opens at its Seconde depth (a Terminale explorer follows depth 2).
    await createExplorer(page, { age: 15 });
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

  test('the Première tools answer to the learner: circle, field, levels, molecule, energies', async ({
    page,
  }) => {
    test.skip(test.info().project.name !== 'desktop', 'checked once, on desktop');
    await createExplorer(page, { name: 'Nour', age: 16 });
    /** Clicks the tool tabs until the shown tool has the wanted kind. */
    const showTool = async (kind: string) => {
      const tabs = page.locator('[data-testid^="lesson-tab-"]');
      for (let i = 0; i < (await tabs.count()); i++) {
        if ((await page.getByTestId('lesson-tool').getAttribute('data-tool')) === kind) return;
        await tabs.nth(i).click();
      }
      await expect(page.getByTestId('lesson-tool')).toHaveAttribute('data-tool', kind);
    };
    // The unit circle follows the keyboard: a step of π/12 changes the angle.
    await page.goto('lesson/tool.trigonometric_functions');
    await nextUntil(page, 'play');
    await showTool('unit_circle');
    const circle = page.getByTestId('unit-circle-tool');
    const angleBefore = await circle.getAttribute('data-angle');
    await circle.locator('svg').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(circle).not.toHaveAttribute('data-angle', angleBefore ?? '');
    await expect(page.getByTestId('unit-circle-reading')).toContainText(/cos/i);
    // The field is read at the marker: dragging it changes the reading.
    await page.goto('lesson/concept.field');
    await nextUntil(page, 'play');
    await showTool('vector_field');
    const field = page.getByTestId('vector-field-tool');
    const readingBefore = await page.getByTestId('vector-field-reading').innerText();
    const box = await field.locator('svg').first().boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3, { steps: 6 });
      await page.mouse.up();
    }
    await expect(page.getByTestId('vector-field-reading')).not.toHaveText(readingBefore);
    // Two clicked levels give the photon exchanged, with its wavelength in nanometres.
    await page.goto('lesson/model.photon');
    await nextUntil(page, 'play');
    await showTool('energy_levels');
    const levels = page.locator('[data-testid^="level-"]');
    await levels.nth(0).click();
    await levels.nth(2).click();
    await expect(page.getByTestId('energy-levels-reading')).toContainText('nm');
    // A clicked atom shows its electrons and its octet.
    await page.goto('lesson/model.lewis_structure');
    await nextUntil(page, 'play');
    await showTool('molecule');
    await page.locator('[data-testid^="atom-"]').first().click();
    await expect(page.getByTestId('molecule-atom')).toContainText(/octet|duet/i);
    await expect(page.getByTestId('molecule-reading')).toContainText(/H₂O|H2O/);
    // The motion simulations now show their energies.
    await page.goto('lesson/law.newton_second');
    await nextUntil(page, 'play');
    await showTool('simulation');
    await expect(page.getByTestId('sim-energy-graph')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('the Seconde tools answer to the learner: series, reaction, periodic table, optics', async ({
    page,
  }) => {
    test.skip(test.info().project.name !== 'desktop', 'checked once, on desktop');
    await createExplorer(page, { age: 15 });
    // A statistical series recomputes its summary when the learner edits the values.
    await page.goto('lesson/tool.descriptive_statistics');
    await nextUntil(page, 'play');
    await page.getByTestId('data-values').fill('2 ; 4 ; 4 ; 4 ; 5 ; 5 ; 7 ; 9');
    await expect(page.getByTestId('data-tool')).toHaveAttribute('data-count', '8');
    await expect(page.getByTestId('data-reading')).toContainText('4,5');
    // An extent table follows the extent slider and names the limiting reactant.
    await page.goto('lesson/model.chemical_reaction');
    await nextUntil(page, 'play');
    await expect(page.getByTestId('reaction-reading')).toContainText(/limitant|stœchiométrique/);
    await page.getByTestId('reaction-extent').fill('0');
    await expect(page.getByTestId('reaction-tool')).toHaveAttribute('data-extent', '0');
    // The periodic table opens the card of the clicked element.
    await page.goto('lesson/model.atom');
    await nextUntil(page, 'play');
    await page.getByTestId('element-Na').click();
    await expect(page.getByTestId('element-info')).toContainText('Sodium');
    await expect(page.getByTestId('element-info')).toContainText('3s¹');
    // Refraction follows the incidence slider.
    await page.goto('lesson/law.snell_descartes');
    await nextUntil(page, 'play');
    await expect(page.getByTestId('optics-tool')).toHaveAttribute('data-mode', 'refraction');
    await page.getByTestId('plotter-param-i').fill('60');
    await expect(page.getByTestId('optics-reading')).toContainText('60');
    await expectNoHorizontalScroll(page);
  });

  test('the Terminale tools answer to the learner: space, area, binomial, Doppler, pH', async ({
    page,
  }) => {
    test.skip(test.info().project.name !== 'desktop', 'checked once, on desktop');
    await createExplorer(page);
    /** Clicks the tool tabs until the shown tool has the wanted kind. */
    const showTool = async (kind: string) => {
      const tabs = page.locator('[data-testid^="lesson-tab-"]');
      for (let i = 0; i < (await tabs.count()); i++) {
        if ((await page.getByTestId('lesson-tool').getAttribute('data-tool')) === kind) return;
        await tabs.nth(i).click();
      }
      await expect(page.getByTestId('lesson-tool')).toHaveAttribute('data-tool', kind);
    };
    // Space turns rather than drags: the azimuth slider moves the whole figure.
    await page.goto('lesson/tool.space_geometry');
    await nextUntil(page, 'play');
    await showTool('space');
    await expect(page.getByTestId('space-tool')).toBeVisible();
    await page.getByTestId('space-azimuth').fill('90');
    await expect(page.getByTestId('space-dot')).toContainText(/orthogonaux/);
    // The area under the curve reads out its integral, and its Riemann sum where one is drawn.
    await page.goto('lesson/tool.integral');
    await nextUntil(page, 'play');
    await showTool('plotter');
    await expect(page.getByTestId('plotter-area').first()).toBeVisible();
    await page.goto('lesson/tool.algorithmics?depth=3');
    await nextUntil(page, 'play');
    await showTool('plotter');
    await expect(page.getByTestId('plotter-area').first()).toContainText(/Riemann/i);
    // The binomial law fills its own table: no value has to be listed by hand.
    await page.goto('lesson/concept.binomial_law');
    await nextUntil(page, 'play');
    await showTool('random');
    await expect(page.getByTestId('random-law')).toBeVisible();
    await expect(page.getByTestId('random-variable')).toContainText(/E =/);
    // The wavefronts of a moving source, and the frequency heard.
    await page.goto('lesson/phenomenon.doppler');
    await nextUntil(page, 'play');
    await showTool('wave');
    await expect(page.getByTestId('doppler-scene')).toBeVisible();
    await expect(page.getByTestId('wave-reading')).toContainText(/perçue/);
    // A pH cursor names the species that predominates at that pH.
    await page.goto('lesson/model.acid_base');
    await nextUntil(page, 'play');
    await showTool('acid_base');
    // The lesson drives the pH through its own parameter, so the tool shows no second cursor.
    await page.getByTestId('plotter-param-p').fill('2');
    await expect(page.getByTestId('acid-base-reading')).toContainText(/prédomine/);
    await expectNoHorizontalScroll(page);
  });

  test('the Terminale simulations: an orbit with its areal speed, a heated body', async ({
    page,
  }) => {
    test.skip(test.info().project.name !== 'desktop', 'checked once, on desktop');
    await createExplorer(page);
    // The orbit prints its elements and draws the areal speed that Kepler's second law flattens.
    await page.goto('lesson/model.gravitational_motion');
    await nextUntil(page, 'play');
    await expect(page.getByTestId('orbit-elements')).toContainText(/T²\/a³/);
    await expect(page.getByTestId('sim-areal-graph')).toBeVisible();
    await expect(page.getByTestId('sim-energy-graph')).toBeVisible();
    // A body heated while it loses heat: the first-order engine now graphs the energy balance.
    await page.goto('lesson/law.first_principle');
    await nextUntil(page, 'play');
    await expect(page.getByTestId('sim-heat-graph')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
