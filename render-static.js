// Render every wallpaper to PNG at desktop and phone sizes.
// Usage: node render.js [piece ...]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SIZES = {
  desktop: [3840, 2160],
  phone: [1290, 2796],
};

(async () => {
  const outDir = path.join(__dirname, 'output', 'static');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.join(__dirname, 'static', 'index.html'));

  const all = await page.evaluate(() => Object.keys(WALLPAPERS));
  const pieces = process.argv.length > 2 ? process.argv.slice(2) : all;

  for (const piece of pieces) {
    for (const [name, [w, h]] of Object.entries(SIZES)) {
      const t0 = Date.now();
      const dataUrl = await page.evaluate(([p, w, h]) => render(p, w, h), [piece, w, h]);
      const file = path.join(outDir, `${piece}-${name}.jpg`);
      fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
      console.log(`${file}  ${w}x${h}  ${Date.now() - t0}ms`);
    }
  }
  await browser.close();
})();
