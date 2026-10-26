// Record a live wallpaper to MP4 (frame-exact, piped into ffmpeg) or grab still frames.
//
//   node record.js <page> [--size 1920x1080] [--secs 12] [--fps 30] [--seed 7] [--query theme=light] [--out file.mp4]
//   node record.js <page> --stills 2,6,10      # PNG snapshots at those seconds instead of a video
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const page = args[0];
const opt = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : def;
};
const [w, h] = opt('size', '1920x1080').split('x').map(Number);
const secs = +opt('secs', 12);
const fps = +opt('fps', 30);
const seed = opt('seed', '7');
const query = opt('query', '');
const stills = opt('stills', '');
const tag = [page, query.replace(/[=&]/g, '-'), `${w}x${h}`].filter(Boolean).join('-');
const outDir = path.join(__dirname, 'output', 'live');
fs.mkdirSync(outDir, { recursive: true });
const out = opt('out', path.join(outDir, `${tag}.mp4`));

(async () => {
  const browser = await chromium.launch();
  const tab = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const url = `file://${path.join(__dirname, 'live', page + '.html')}?record&seed=${seed}${query ? '&' + query : ''}`;
  await tab.goto(url);
  await tab.waitForFunction(() => window.__live);
  const grab = () => tab.evaluate(() => window.__live.canvas.toDataURL('image/png').split(',')[1]);

  if (stills) {
    let t = 0;
    for (const s of stills.split(',').map(Number)) {
      while (t < s - 1e-9) {
        const dt = Math.min(1 / fps, s - t);
        await tab.evaluate((d) => window.__live.advance(d), dt);
        t += dt;
      }
      const file = path.join(outDir, `${tag}-t${s}.png`);
      fs.writeFileSync(file, Buffer.from(await grab(), 'base64'));
      console.log(file);
    }
  } else {
    const ff = spawn('ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-i', '-',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-preset', 'slow', '-movflags', '+faststart', out,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const total = Math.round(secs * fps);
    for (let i = 0; i < total; i++) {
      await tab.evaluate((d) => window.__live.advance(d), 1 / fps);
      if (!ff.stdin.write(Buffer.from(await grab(), 'base64'))) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end();
    await new Promise((r) => ff.on('close', r));
    console.log(out);
  }
  await browser.close();
})();
