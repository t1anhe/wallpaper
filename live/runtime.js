// Full-screen canvas runtime shared by the live wallpapers.
//
// A piece is a factory: create({ w, h, dpr, rng, params }) -> { update(dt, t, input), draw(ctx) }.
// A factory may set create.ascii = true to be rendered through the ASCII layer by default (see makeAscii);
// it then draws at reduced resolution, since the scene is only sampled once per glyph cell.
// The runtime owns the canvas, devicePixelRatio, resizing, pointer input and the clock.
// With ?record in the URL the RAF loop is off and frames are driven by window.__live (see record.js).
const Live = {
  start(create) {
    const params = new URLSearchParams(location.search);
    const recording = params.has('record');
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const input = { x: -1e9, y: -1e9, active: false };
    let piece, ascii = null, t = 0, dpr = 1, scale = 1;

    function build() {
      dpr = recording ? 1 : Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(window.innerWidth * dpr);
      const h = Math.round(window.innerHeight * dpr);
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      const seed = +params.get('seed') || Math.floor(Math.random() * 1e9);
      // ASCII mode: on when the piece asks for it, overridable with ?ascii=0 / ?ascii=1; ?res sets glyph rows.
      const a = params.get('ascii');
      ascii = (a === null ? create.ascii : a !== '0') ? makeAscii(w, h, +params.get('res') || create.asciiRes || 150) : null;
      scale = ascii ? ascii.scale : 1;
      const pw = ascii ? ascii.src.width : w, ph = ascii ? ascii.src.height : h;
      piece = create({ w: pw, h: ph, dpr: dpr / scale, rng: mulberry32(seed), params });
    }

    const STEP = 1 / 60;
    function advance(dt) {
      // Fixed sub-steps keep simulations stable regardless of frame rate.
      let left = Math.min(dt, 0.25);
      while (left > 1e-6) {
        const d = Math.min(STEP, left);
        t += d;
        piece.update(d, t, input);
        left -= d;
      }
      if (ascii) {
        // Pieces with a backdrop paint it straight onto the screen and draw the rest transparent.
        const layered = !!piece.drawBackground;
        if (layered) {
          ctx.save();
          ctx.scale(scale, scale);
          piece.drawBackground(ctx);
          ctx.restore();
        }
        piece.draw(ascii.ctx, layered);
        ascii.render(ctx);
      } else piece.draw(ctx);
    }

    window.addEventListener('pointermove', (e) => {
      input.x = (e.clientX * dpr) / scale;
      input.y = (e.clientY * dpr) / scale;
      input.active = true;
    });
    document.addEventListener('pointerleave', () => (input.active = false));
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(build, 150);
    });

    build();

    if (recording) {
      window.__live = { advance, canvas };
      return;
    }
    let last = performance.now();
    function loop(now) {
      advance((now - last) / 1000);
      last = now;
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  },
};

// ASCII post-process: the piece paints a normal frame into `src`, which is sampled per cell into
// coloured glyphs. Glyphs come from a pre-rendered white atlas and are tinted in one composite pass,
// so even very fine grids stay fast.
function makeAscii(w, h, density) {
  const cs = Math.max(5, Math.round(Math.min(w, h) / density));
  const cols = Math.ceil(w / cs), rows = Math.ceil(h / cs);
  const mk = (cw, ch) => {
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    return c;
  };
  // Scene resolution: ~3 source pixels per glyph cell is plenty for sampling.
  const scale = Math.max(1, cs / 3);
  const src = mk(Math.ceil(w / scale), Math.ceil(h / scale));
  const small = mk(cols, rows);
  const sm = small.getContext('2d', { willReadFrequently: true });
  sm.imageSmoothingQuality = 'high';
  const bg = mk(cols, rows), fg = mk(cols, rows);
  const bgX = bg.getContext('2d'), fgX = fg.getContext('2d');
  const bgImg = bgX.createImageData(cols, rows), fgImg = fgX.createImageData(cols, rows);
  const glyphs = mk(cols * cs, rows * cs);
  const gX = glyphs.getContext('2d');

  // Sparse -> dense. The last four are edge strokes picked by gradient direction.
  const RAMP = " .'`,:;-~^\"!i><+_?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  const EDGES = '-\\|/';
  const atlas = mk((RAMP.length + EDGES.length) * cs, cs);
  const aX = atlas.getContext('2d');
  aX.fillStyle = '#fff';
  aX.font = `${Math.round(cs * 1.05)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  aX.textAlign = 'center';
  aX.textBaseline = 'middle';
  [...RAMP, ...EDGES].forEach((ch, i) => aX.fillText(ch, i * cs + cs / 2, cs / 2 + cs * 0.06));
  const lum = new Float32Array(cols * rows);
  // White glyph mask, updated only where a cell's glyph changes; tinted into `colored` each frame.
  const prev = new Int16Array(cols * rows).fill(-2);
  const colored = mk(cols * cs, rows * cs);
  const cX = colored.getContext('2d');

  function render(ctx) {
    sm.globalCompositeOperation = 'copy'; // replace last frame, so transparent areas stay transparent
    sm.drawImage(src, 0, 0, cols, rows);
    const d = sm.getImageData(0, 0, cols, rows).data;
    for (let i = 0, j = 0; i < lum.length; i++, j += 4) {
      // Partly transparent cells (sky, glows, haze) become sparse coloured glyphs with no tile behind
      // them; glyph density falls off faster than alpha so they read as lighter texture.
      const a = d[j + 3] / 255;
      lum[i] = a < 0.1 ? -1 : (d[j] * 0.3 + d[j + 1] * 0.59 + d[j + 2] * 0.11) * a * Math.min(1, a * 1.6);
      const tile = Math.max(0, Math.min(1, (a - 0.5) * 2));
      bgImg.data[j] = d[j] * 0.36;
      bgImg.data[j + 1] = d[j + 1] * 0.36;
      bgImg.data[j + 2] = d[j + 2] * 0.36;
      bgImg.data[j + 3] = tile * 255;
      // Lift dark colours so their glyphs stay legible without losing hue
      const lift = Math.min(2.4, Math.max(1.15, 170 / (Math.max(d[j], d[j + 1], d[j + 2]) + 1))) * Math.min(1, a * 2);
      // ...and push saturation a little, since thin glyph strokes read greyer than solid colour
      const L = d[j] * 0.3 + d[j + 1] * 0.59 + d[j + 2] * 0.11;
      fgImg.data[j] = (L + (d[j] - L) * 1.4) * lift + 14;
      fgImg.data[j + 1] = (L + (d[j + 1] - L) * 1.4) * lift + 14;
      fgImg.data[j + 2] = (L + (d[j + 2] - L) * 1.4) * lift + 14;
      fgImg.data[j + 3] = 255;
    }
    bgX.putImageData(bgImg, 0, 0);
    fgX.putImageData(fgImg, 0, 0);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const l = lum[i];
        let g = -1; // -1: transparent, let the backdrop show through
        if (l >= 0) {
          const gx = lum[i + (x < cols - 1 ? 1 : 0)] - lum[i - (x > 0 ? 1 : 0)];
          const gy = lum[i + (y < rows - 1 ? cols : 0)] - lum[i - (y > 0 ? cols : 0)];
          if (gx * gx + gy * gy > 2200 && lum[i - 1] >= 0 && lum[i + 1] >= 0) {
            // Strong edge: stroke along it (perpendicular to the gradient)
            const a = Math.atan2(gy, gx) + Math.PI / 2;
            g = RAMP.length + (Math.round(((a % Math.PI) + Math.PI) % Math.PI / (Math.PI / 4)) % 4);
          } else {
            g = Math.min(RAMP.length - 1, 1 + Math.floor(Math.pow(l / 256, 0.8) * (RAMP.length - 1)));
          }
        }
        if (g === prev[i]) continue;
        prev[i] = g;
        gX.clearRect(x * cs, y * cs, cs, cs);
        if (g >= 0) gX.drawImage(atlas, g * cs, 0, cs, cs, x * cs, y * cs, cs, cs);
      }
    }
    cX.globalCompositeOperation = 'copy';
    cX.drawImage(glyphs, 0, 0);
    cX.globalCompositeOperation = 'source-in';
    cX.imageSmoothingEnabled = false;
    cX.drawImage(fg, 0, 0, cols * cs, rows * cs);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(bg, 0, 0, cols * cs, rows * cs);
    ctx.drawImage(colored, 0, 0);
  }

  return { src, ctx: src.getContext('2d'), render, scale };
}

// Cross-stitch post-process: the piece paints at one pixel per stitch into `ctx` (cols x rows);
// render() snaps every stitch to the nearest thread colour (with a little fixed speckle, like
// a hand-charted pattern) and scales it up under an aida-cloth texture.
function makeStitch(w, h, density, threads, grain = 16) {
  const cs = Math.max(3, Math.round(Math.min(w, h) / density));
  const cols = Math.ceil(w / cs), rows = Math.ceil(h / cs);
  const mk = (cw, ch) => {
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    return c;
  };
  const scene = mk(cols, rows);
  const sx = scene.getContext('2d', { willReadFrequently: true });
  const pal = threads.map(hexToRgb);
  const quant = mk(cols, rows);
  const qx = quant.getContext('2d');
  const qImg = qx.createImageData(cols, rows);
  const cache = new Int16Array(32768).fill(-1);
  const speckle = new Float32Array(cols * rows).map((_, i) => (hash3(i % cols, (i / cols) | 0, 5) - 0.5) * grain);

  function nearest(r, g, b) {
    const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let k = cache[key];
    if (k >= 0) return k;
    let best = 1e9;
    for (let i = 0; i < pal.length; i++) {
      const dr = r - pal[i][0], dg = g - pal[i][1], db = b - pal[i][2];
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < best) { best = d; k = i; }
    }
    cache[key] = k;
    return k;
  }

  // Aida cloth: one tile per stitch with a soft X and a dark weave line.
  const tile = mk(cs, cs);
  {
    const x = tile.getContext('2d');
    if (cs >= 5) {
      x.lineWidth = Math.max(1, cs * 0.2);
      x.strokeStyle = 'rgba(0,0,0,0.12)';
      x.beginPath();
      x.moveTo(1, 1.6); x.lineTo(cs - 1.6, cs - 1);
      x.moveTo(cs - 1, 1.6); x.lineTo(1.6, cs - 1);
      x.stroke();
      x.strokeStyle = 'rgba(255,255,255,0.08)';
      x.beginPath();
      x.moveTo(1, 1); x.lineTo(cs - 2, cs - 2);
      x.moveTo(cs - 1, 1); x.lineTo(2, cs - 2);
      x.stroke();
    }
    x.fillStyle = 'rgba(0,0,0,0.3)';
    x.fillRect(cs - 1, 0, 1, cs);
    x.fillRect(0, cs - 1, cs, 1);
    x.fillStyle = 'rgba(255,255,255,0.06)';
    x.fillRect(0, 0, cs, 1);
    x.fillRect(0, 0, 1, cs);
  }
  let cloth = null;

  function render(ctx) {
    const d = sx.getImageData(0, 0, cols, rows).data;
    const q = qImg.data;
    for (let i = 0, j = 0; i < speckle.length; i++, j += 4) {
      const n = speckle[i];
      const k = nearest(
        Math.max(0, Math.min(255, d[j] + n)) | 0,
        Math.max(0, Math.min(255, d[j + 1] + n)) | 0,
        Math.max(0, Math.min(255, d[j + 2] + n)) | 0
      );
      q[j] = pal[k][0];
      q[j + 1] = pal[k][1];
      q[j + 2] = pal[k][2];
      q[j + 3] = 255;
    }
    qx.putImageData(qImg, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(quant, 0, 0, cols * cs, rows * cs);
    cloth = cloth || ctx.createPattern(tile, 'repeat');
    ctx.fillStyle = cloth;
    ctx.fillRect(0, 0, w, h);
  }

  return { cs, cols, rows, ctx: sx, render };
}

// Cheap integer hash -> [0, 1). Stable per cell, so flicker and textures don't shimmer randomly.
function hash3(a, b, c = 0) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
