// Rasterises static/icons/icon.svg into the PNG sizes required by the web manifest.
const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '..', 'static', 'icons', 'icon.svg'), 'utf8');
  const browser = await chromium.launch();
  for (const [size, name, pad] of [
    [192, 'icon-192.png', 0],
    [512, 'icon-512.png', 0],
    [512, 'icon-maskable-512.png', 0.12],
  ]) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1,
    });
    const inner = Math.round(size * (1 - 2 * pad));
    await page.setContent(
      `<html><body style="margin:0;background:${pad ? '#0b1020' : 'transparent'};display:grid;place-items:center;width:${size}px;height:${size}px"><div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`
    );
    await page.screenshot({
      path: path.join(__dirname, '..', 'static', 'icons', name),
      omitBackground: !pad,
    });
    await page.close();
  }
  await browser.close();
  console.log('icons written');
})();
