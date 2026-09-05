import { createExplorer, expect, expectNoHorizontalScroll, test } from './helpers';

const ROUTES = [
  'universe',
  'concept/tool.derivative',
  'concept/mission.galileo.inclined_plane',
  'mission/mission.galileo.inclined_plane',
  'backpack',
  'journal',
  'timeline',
  'settings',
  'guide/progress',
  'studio/graph',
];

test.describe('responsive layout', () => {
  test('every page fits the viewport without horizontal scrolling', async ({ page }, info) => {
    await createExplorer(page);
    for (const route of ROUTES) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalScroll(page);
      await page.screenshot({
        path: info.outputPath(`${route.replace(/[/?=.]/g, '_')}.png`),
        fullPage: false,
      });
    }
  });

  test('the navigation sits at the bottom on phones and at the top elsewhere', async ({
    page,
  }, info) => {
    await createExplorer(page);
    await page.goto('backpack');
    const nav = page.locator('nav.appnav');
    await expect(nav).toBeVisible();
    const box = (await nav.boundingBox())!;
    const viewport = page.viewportSize()!;
    if (info.project.name === 'phone')
      expect(box.y + box.height).toBeGreaterThan(viewport.height - 2);
    else expect(box.y).toBeLessThan(10);
    for (const link of await nav.locator('a').all()) {
      const b = await link.boundingBox();
      if (b) expect(b.height, 'touch target').toBeGreaterThanOrEqual(40);
    }
  });

  test('the concept panel opens as a sheet on phones and can expand', async ({ page }, info) => {
    test.skip(info.project.name !== 'phone');
    await createExplorer(page);
    await page.goto('concept/tool.derivative');
    const panel = page.getByTestId('atlas-panel');
    const before = (await panel.boundingBox())!;
    expect(before.height).toBeLessThan(page.viewportSize()!.height * 0.6);
    await panel.getByRole('button').first().click();
    await page.waitForTimeout(400);
    const after = (await panel.boundingBox())!;
    expect(after.height).toBeGreaterThan(before.height);
    await expectNoHorizontalScroll(page);
  });
});
