// Render every static wallpaper to JPG at desktop and phone sizes.
// Usage: node render-static.js [--ascii [rows]] [piece ...]
//   --ascii renders the glyph versions (default 150 glyph rows) into output/static/ascii/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SIZES = {
  desktop: [3840, 2160],
  phone: [1290, 2796],
};

(async () => {
  const args = process.argv.slice(2);
  let ascii = 0;
  const i = args.indexOf('--ascii');
  if (i >= 0) {
    ascii = /^\d+$/.test(args[i + 1] || '') ? +args.splice(i + 1, 1)[0] : 150;
    args.splice(i, 1);
  }
  const outDir = path.join(__dirname, 'output', 'static', ascii ? 'ascii' : '');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('file://' + path.join(__dirname, 'static', 'index.html'));

  const all = await page.evaluate(() => Object.keys(WALLPAPERS));
  const pieces = args.length ? args : all;

  for (const piece of pieces) {
    for (const [name, [w, h]] of Object.entries(SIZES)) {
      const t0 = Date.now();
      const dataUrl = await page.evaluate(([p, w, h, a]) => render(p, w, h, a), [piece, w, h, ascii]);
      const file = path.join(outDir, `${piece}-${name}.jpg`);
      fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
      console.log(`${file}  ${w}x${h}  ${Date.now() - t0}ms`);
    }
  }
  await browser.close();
})();
