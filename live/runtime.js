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
      // Hosts (e.g. the Mac app) can freeze the scene by setting window.LIVE_PAUSED
      if (!window.LIVE_PAUSED) advance((now - last) / 1000);
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

// Typeset post-process (WebGL): the piece paints an ordinary picture into `ctx`, in screen
// coordinates, and render(out) sets it in type on paper. Each character cell takes the colour under
// it and either a stroke (- \ | /) along an edge running through it, or a glyph from the density
// ramp by how much ink its colour carries against the paper; a wash of the colour stays under the
// type (taken from the picture at twice the cell resolution, so edges stay crisp), and colours lighter
// than the paper show as bare, brighter paper. Cells are taller than wide, like a terminal; `res` is
// the number of cells across the short side of the screen. Returns null when WebGL is unavailable.
function makeTypeset(w, h, { res = 110, paper = [0.95, 0.9, 0.8], ramp = ' .:-=+*#%@', wash = 0.35, ink = 0.8, bold = false } = {}) {
  const glc = document.createElement('canvas');
  glc.width = w;
  glc.height = h;
  const gl = glc.getContext('webgl', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  const ch = Math.min(w, h) / res, cw = ch * 0.6;
  const cols = Math.ceil(w / cw), rows = Math.ceil(h / ch);
  const SUB = 2; // source pixels per cell, each way
  const src = document.createElement('canvas');
  src.width = cols * SUB;
  src.height = rows * SUB;
  const ctx = src.getContext('2d');
  ctx.setTransform(src.width / w, 0, 0, src.height / h, 0, 0);
  const GLYPHS = ramp + '-\\|/';
  const NR = ramp.length.toFixed(1);

  const CELL = `
precision mediump float;
uniform sampler2D uSrc;
uniform vec2 uGrid;
uniform vec3 uPaper;
float lum(vec3 c) { return dot(c, vec3(.3, .59, .11)); }
// Average colour of a cell; the source canvas runs top-down, cells bottom-up
vec3 cellColour(vec2 c) {
  vec2 b = vec2(c.x, uGrid.y - 1. - c.y) * ${SUB}.;
  vec2 s = uGrid * ${SUB}.;
  return (texture2D(uSrc, (b + vec2(.5, .5)) / s).rgb + texture2D(uSrc, (b + vec2(1.5, .5)) / s).rgb
        + texture2D(uSrc, (b + vec2(.5, 1.5)) / s).rgb + texture2D(uSrc, (b + vec2(1.5, 1.5)) / s).rgb) * .25;
}
void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  vec3 m = cellColour(cell);
  vec3 cl = cellColour(cell - vec2(1., 0.)), cr = cellColour(cell + vec2(1., 0.));
  vec3 cu = cellColour(cell + vec2(0., 1.)), cd = cellColour(cell - vec2(0., 1.));
  float Lp = lum(uPaper), L = lum(m);
  float ll = lum(cl), lr = lum(cr), lu = lum(cu), ld = lum(cd);
  // Gradient on screen (y down); an edge runs along (-gy, gx)
  float gx = lr - ll, gy = ld - lu;
  float ink = clamp((Lp - L) / Lp, 0., 1.);
  vec3 dark = m;
  float dl = L;
  if (ll < dl) { dark = cl; dl = ll; }
  if (lr < dl) { dark = cr; dl = lr; }
  if (lu < dl) { dark = cu; dl = lu; }
  if (ld < dl) { dark = cd; dl = ld; }
  float g;
  vec3 c = m;
  if (length(vec2(gx, gy)) > .14 && (Lp - dl) / Lp > .15) {
    float a = mod(atan(gx, -gy), 3.14159);
    g = ${NR} + mod(floor(a / .7854 + .5), 4.);
    c = dark;
  } else {
    float h = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
    g = floor(clamp(pow(ink, .8) + (h - .5) * .08, 0., .999) * ${NR});
  }
  gl_FragColor = vec4(c, g / 255.);
}`;

  const TYPE = `
precision mediump float;
uniform sampler2D uCells, uAtlas, uSrc;
uniform vec2 uGrid, uCellPx, uSize;
uniform float uNG, uWash, uInk;
uniform vec3 uPaper;
float lum(vec3 c) { return dot(c, vec3(.3, .59, .11)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  vec2 cf = gl_FragCoord.xy / uCellPx;
  vec2 cell = floor(cf), f = fract(cf);
  vec4 s = texture2D(uCells, (cell + .5) / uGrid);
  float g = floor(s.a * 255. + .5);
  float m = texture2D(uAtlas, vec2((g + f.x) / uNG, 1. - f.y)).a;
  // The wash under the type, straight from the picture
  vec3 cb = texture2D(uSrc, vec2(gl_FragCoord.x / uSize.x, 1. - gl_FragCoord.y / uSize.y)).rgb;
  float Lp = lum(uPaper), Lb = lum(cb);
  // Paper: a faint grain, a little darker towards the edges
  vec2 uv = gl_FragCoord.xy / (uGrid * uCellPx) - .5;
  vec3 paper = uPaper * (1. - .1 * dot(uv, uv)) * (1. + (hash(floor(gl_FragCoord.xy * .5)) - .5) * .025);
  vec3 bg = mix(paper, cb, max(uWash * clamp((Lp - Lb) / Lp, 0., 1.), clamp((Lb - Lp) * 4., 0., .85)));
  gl_FragColor = vec4(mix(bg, s.rgb * uInk, m), 1.);
}`;

  function program(fs) {
    const pr = gl.createProgram();
    for (const [type, code] of [[gl.VERTEX_SHADER, 'attribute vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }'], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, code);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(pr, s);
    }
    gl.bindAttribLocation(pr, 0, 'p');
    gl.linkProgram(pr);
    return { pr, u: (n) => gl.getUniformLocation(pr, n) };
  }
  const texture = (unit, filter) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // Units: 0 the painted picture, 1 the cells, 2 the glyph atlas
  const srcTex = texture(0, gl.LINEAR);
  const cellTex = texture(1, gl.NEAREST);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cols, rows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, cellTex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  const aw = Math.max(2, Math.round(cw)), ah = Math.max(2, Math.round(ch));
  const atlas = document.createElement('canvas');
  atlas.width = aw * GLYPHS.length;
  atlas.height = ah;
  const ax = atlas.getContext('2d');
  ax.fillStyle = '#fff';
  ax.font = `${bold ? 'bold ' : ''}${Math.round(ah * 0.86)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
  ax.textAlign = 'center';
  ax.textBaseline = 'middle';
  [...GLYPHS].forEach((g, i) => ax.fillText(g, i * aw + aw / 2, ah / 2 + ah * 0.04));
  texture(2, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);

  const cell = program(CELL), type = program(TYPE);
  gl.useProgram(cell.pr);
  gl.uniform1i(cell.u('uSrc'), 0);
  gl.uniform2f(cell.u('uGrid'), cols, rows);
  gl.uniform3f(cell.u('uPaper'), ...paper);
  gl.useProgram(type.pr);
  gl.uniform1i(type.u('uCells'), 1);
  gl.uniform1i(type.u('uAtlas'), 2);
  gl.uniform1i(type.u('uSrc'), 0);
  gl.uniform2f(type.u('uSize'), w, h);
  gl.uniform2f(type.u('uGrid'), cols, rows);
  gl.uniform2f(type.u('uCellPx'), cw, ch);
  gl.uniform1f(type.u('uNG'), GLYPHS.length);
  gl.uniform1f(type.u('uWash'), wash);
  gl.uniform1f(type.u('uInk'), ink);
  gl.uniform3f(type.u('uPaper'), ...paper);

  function render(out) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.viewport(0, 0, cols, rows);
    gl.useProgram(cell.pr);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, w, h);
    gl.useProgram(type.pr);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    out.drawImage(glc, 0, 0);
  }

  return { ctx, render };
}
