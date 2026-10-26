// Vista — a vast mountain valley at blue hour, stitched like a cross-stitch.
// Alpenglow on the peaks, the Milky Way, a mirror lake with a lantern boat drifting across,
// a lakeside village, a waterfall, rolling mist, shooting stars and birds.
// Params: ?res=<stitches across the short side, default 150>
function createVista({ w, h, rng, params }) {
  const { noise2, fbm } = makeNoise(rng);
  const THREADS = [
    '#070b1f', '#0d1330', '#141b44', '#1d2457', '#2a2c66', '#3b3478', '#4d3d84', '#6a4a8c', // sky
    '#8a5791', '#a8608f', '#c46a7a', '#dd7f72', '#f0a06a', '#f6c48a', '#fbe3b8', // horizon glow
    '#ffffff', '#e9e6f5', '#c9c6e6', '#a9a6d6', // stars, snow
    '#262b4f', '#323863', '#3f4475', '#555a8a', '#6f6f9f', '#8f93bf', '#b7b3d6', // mountains
    '#e3c7d8', '#f3c9cf', '#7a5a7a', '#5a4766', // alpenglow, lit rock
    '#05080c', '#0b1116', '#121a22', '#18222c', '#1f2a36', '#152129', // silhouettes
    '#ffd27a', '#ffb347', '#ff8c3a', '#d8f07a', // lamplight, fireflies
  ];
  const S = makeStitch(w, h, +params.get('res') || 150, THREADS, 14);
  const C = S.cols, R = S.rows;
  const sx = S.ctx;
  const portrait = R > C;
  const U = Math.min(R * 0.78, C * 0.75);
  const waterY = Math.round(R * (portrait ? 0.62 : 0.64));
  const H = hexToRgb;
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const sm = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  const ramp = (stops, t) => {
    t = Math.min(1, Math.max(0, t)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(t));
    return lerp(stops[i], stops[i + 1], t - i);
  };
  const mk = (cw, ch) => {
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    return c;
  };
  const put = (img, x, y, c, a = 1) => {
    const i = (y * img.width + x) * 4;
    img.data[i] = c[0];
    img.data[i + 1] = c[1];
    img.data[i + 2] = c[2];
    img.data[i + 3] = a * 255;
  };

  // ---------- sky: gradient, afterglow, Milky Way, stars, crescent moon ----------
  const SKY = ['#0a0f2b', '#151c47', '#2a2a66', '#4a3a7e', '#7a4c8c', '#b65f86', '#e07f78', '#f4a873'].map(H);
  const sunX = C * (portrait ? 0.3 : 0.22);
  const moon = { x: C * (portrait ? 0.74 : 0.8), y: waterY * (portrait ? 0.2 : 0.16), r: Math.max(3, U * 0.035) };
  const mw = portrait
    ? { x0: C * 0.05, y0: waterY * 0.95, x1: C * 0.95, y1: -R * 0.05 }
    : { x0: -C * 0.05, y0: waterY * 0.8, x1: C * 1.05, y1: -R * 0.05 };
  const mwLen = Math.hypot(mw.x1 - mw.x0, mw.y1 - mw.y0);
  const bw = U * 0.15;
  const skyC = mk(C, waterY);
  const skyImg = skyC.getContext('2d').createImageData(C, waterY);
  const twinkles = [];
  for (let y = 0; y < waterY; y++) {
    for (let x = 0; x < C; x++) {
      const v = y / waterY;
      let c = ramp(SKY, Math.pow(v, 1.7));
      const glow = Math.exp(-(((x - sunX) / (C * 0.38)) ** 2)) * Math.exp(-(waterY - y) / (U * 0.2));
      c = lerp(c, H('#f6b07a'), glow * 0.55);
      // Milky Way: a soft band with clumpy light and dark dust lanes
      const d = Math.abs((mw.y1 - mw.y0) * x - (mw.x1 - mw.x0) * y + mw.x1 * mw.y0 - mw.y1 * mw.x0) / mwLen;
      const core = Math.exp(-((d / bw) ** 2)) * (1 - sm(0.55, 0.95, v));
      const cloud = 0.45 + fbm(x * 0.045, y * 0.045, 4) * 1.2;
      const dust = sm(0.02, 0.22, fbm(x * 0.09 + 20, y * 0.09, 3)) * Math.exp(-((d / (bw * 0.45)) ** 2));
      const band = Math.max(0, core * cloud * (1 - dust * 0.85));
      c = lerp(c, H('#c9c6e6'), Math.min(0.6, band * 0.5));
      // Crescent moon with a faint halo
      const dm = Math.hypot(x - moon.x, y - moon.y);
      const lit = dm < moon.r && Math.hypot(x - moon.x - moon.r * 0.5, y - moon.y + moon.r * 0.25) > moon.r * 0.92;
      if (lit) c = H('#f6efd6');
      else c = lerp(c, H('#8f93bf'), Math.max(0, 1 - dm / (moon.r * 4)) * 0.25);
      // Stars, denser in the band and fading into the afterglow
      const p = (0.006 + 0.07 * core) * (1 - sm(0.5, 0.9, v));
      if (!lit && rng() < p) {
        const b = 0.45 + rng() * 0.55;
        const sc = rng() < 0.15 ? H('#f6c48a') : rng() < 0.3 ? H('#c9c6e6') : H('#ffffff');
        c = lerp(c, sc, b);
        if (b > 0.85) twinkles.push({ x, y, c: sc, p: rng() * 10, s: 0.8 + rng() * 2 });
      }
      put(skyImg, x, y, c);
    }
  }
  skyC.getContext('2d').putImageData(skyImg, 0, 0);

  // ---------- mountains: alpenglow range, mid range, shore hills, village ----------
  const peakX = C * (portrait ? 0.58 : 0.62);
  const topFar = (x) => {
    const r1 = 1 - Math.abs(noise2(x * 0.018, 1.7));
    const r2 = 1 - Math.abs(noise2(x * 0.05, 4.2));
    let p = Math.pow(r1, 2.2) * 0.65 + Math.pow(r2, 2) * 0.22 + noise2(x * 0.25, 9) * 0.02;
    p += 0.4 * Math.exp(-(((x - peakX) / (C * (portrait ? 0.2 : 0.11))) ** 2));
    return waterY - U * (0.09 + 0.33 * Math.min(1.05, p));
  };
  const topMid = (x) => waterY - U * (0.04 + 0.12 * (fbm(x * 0.03 + 5, 2.1, 4) + 0.5));
  const shoreL = C * (portrait ? 0.14 : 0.1), shoreR = C * (portrait ? 0.8 : 0.74);
  const nearMask = (x) => Math.max(sm(shoreL, shoreL - C * 0.08, x), sm(shoreR, shoreR + C * 0.08, x));
  const topNear = (x) => waterY - U * (0.01 + 0.06 * (fbm(x * 0.06 + 9, 7, 3) + 0.5)) * nearMask(x);
  const wfX = Math.round(C * (portrait ? 0.68 : 0.7));

  const mtC = mk(C, waterY);
  const mtImg = mtC.getContext('2d').createImageData(C, waterY);
  const far = Float32Array.from({ length: C + 2 }, (_, i) => topFar(i - 1));
  const farAt = (x) => far[Math.max(0, Math.min(C + 1, Math.round(x) + 1))];
  for (let x = 0; x < C; x++) {
    const tf = far[x + 1], tm = topMid(x), tn = topNear(x);
    for (let y = Math.max(0, Math.floor(Math.min(tf, tm, tn))); y < waterY; y++) {
      const alt = (waterY - y) / U;
      let c = null;
      if (y >= tn && nearMask(x) > 0.05) {
        c = lerp(H('#121a22'), H('#18222c'), hash3(x, y, 3) * 0.6);
      } else if (y >= tm) {
        // Mid range: shadowed, forested at the foot, with the waterfall's cliff channel
        const jit = noise2(x * 0.08, y * 0.1) * (y - tm) * 0.5;
        const slope = topMid(x + 1 + jit) - topMid(x - 1 + jit);
        c = lerp(H('#262b4f'), H('#3f4475'), sm(0.3, -0.5, slope) * 0.8);
        if (alt < 0.07 && hash3(x, y, 4) < 0.55) c = lerp(c, H('#1f2a36'), 0.7);
        if (Math.abs(x - wfX) < 2 && y > tm + 1) c = H('#1d2457');
        c = lerp(c, H('#4d4f86'), 0.35 * (1 - sm(0, 0.12, alt)));
      } else if (y >= tf) {
        // Far range: ridge shading carried down the faces, snow above a ragged line
        const depth = y - tf;
        const jit = noise2(x * 0.05, y * 0.08) * depth * 0.6;
        const slope = farAt(x + 1 + jit) - farAt(x - 1 + jit);
        const lit = sm(0.4, -0.6, slope);
        const snowLine = 0.19 + noise2(x * 0.08, y * 0.08) * 0.05;
        const streak = noise2(x * 0.35, y * 0.06) > -0.25 ? 1 : 0.35;
        const snow = sm(snowLine, snowLine + 0.05, alt) * streak;
        const glow = sm(0.24, 0.4, alt);
        const snowC = lerp(lerp(H('#6f6f9f'), H('#b7b3d6'), lit), H('#f3c9cf'), glow * lit);
        const rockC = lerp(H('#2f3260'), lerp(H('#5a4766'), H('#7a5a7a'), glow), lit * 0.55);
        c = lerp(rockC, snowC, snow);
        c = lerp(c, H('#4f4c84'), 0.6 * (1 - sm(0.02, 0.2, alt)));
      }
      if (c) put(mtImg, x, y, c);
    }
  }
  // Village on the left shore: dark houses, a church spire, windows that light up
  const windows = [];
  {
    let x = Math.round(shoreL + C * 0.01);
    const end = Math.round(shoreL + C * (portrait ? 0.3 : 0.2));
    let spire = false;
    while (x < end) {
      const hw = 3 + Math.floor(rng() * 3), hh = 2 + Math.floor(rng() * 3);
      const base = waterY - 1;
      const tall = !spire && x > shoreL + C * 0.06;
      for (let dx = 0; dx < hw; dx++) {
        for (let dy = 0; dy < hh; dy++) put(mtImg, x + dx, base - dy, H('#141a28'));
        const roof = Math.min(dx, hw - 1 - dx) + 1;
        for (let r = 0; r < roof; r++) put(mtImg, x + dx, base - hh - r, H('#101622'));
      }
      if (tall) {
        spire = true;
        const sxp = x + (hw >> 1);
        for (let dy = 0; dy < hh + 8; dy++) put(mtImg, sxp, base - dy, H('#101622'));
      }
      for (let k = 0; k < 1 + (hw > 3 ? 1 : 0); k++) {
        if (rng() < 0.85) windows.push({ x: x + 1 + k * 2, y: base - Math.floor(hh / 2), p: rng() * 50 });
      }
      x += hw + Math.floor(rng() * 2);
    }
  }
  mtC.getContext('2d').putImageData(mtImg, 0, 0);

  // ---------- foreground: pine silhouettes framing the view, a rocky shore ----------
  const fgC = mk(C, R);
  const fg = fgC.getContext('2d');
  fg.fillStyle = '#070b10';
  const pine = (px, base, ht, wd) => {
    fg.fillRect(Math.round(px), Math.round(base - ht * 0.15), 1, Math.round(ht * 0.15) + 1);
    for (let i = 0; i < ht * 0.9; i++) {
      const y = base - ht * 0.12 - i;
      const tier = (i % Math.max(3, Math.round(ht / 6))) / Math.max(3, Math.round(ht / 6));
      const half = (1 - i / (ht * 0.9)) * wd * (0.55 + 0.45 * tier) + (rng() - 0.5);
      fg.fillRect(Math.round(px - half), Math.round(y), Math.max(1, Math.round(half * 2) + 1), 1);
    }
  };
  const fgBase = R + 2;
  for (const [x0, x1, hMax] of [[-0.04, portrait ? 0.2 : 0.13, 0.55], [portrait ? 0.82 : 0.87, 1.04, 0.62]]) {
    for (let i = 0; i < (portrait ? 5 : 7); i++) {
      const px = C * (x0 + rng() * (x1 - x0));
      const edge = Math.min(Math.abs(px / C - x0), Math.abs(px / C - x1)) / (x1 - x0);
      const ht = (R - waterY) * 0.5 + U * hMax * (0.45 + rng() * 0.55) * (1 - edge * 0.6);
      pine(px, fgBase, ht, ht * 0.22);
    }
  }
  fg.beginPath();
  fg.moveTo(0, R);
  for (let x = 0; x <= C; x++) fg.lineTo(x, R - (portrait ? 0.025 : 0.035) * R - (fbm(x * 0.08, 3, 3) + 0.5) * R * 0.03);
  fg.lineTo(C, R);
  fg.fill();
  // Rim light from the sky on the silhouettes' upper-left edges
  {
    const img = fg.getImageData(0, 0, C, R);
    const out = fg.createImageData(C, R);
    out.data.set(img.data);
    for (let y = 1; y < R; y++) {
      for (let x = 1; x < C; x++) {
        const i = (y * C + x) * 4;
        if (img.data[i + 3] && (!img.data[i - 4 + 3] || !img.data[i - C * 4 + 3]) && hash3(x, y, 8) < 0.7) {
          out.data[i] = 31; out.data[i + 1] = 42; out.data[i + 2] = 64;
        }
      }
    }
    fg.putImageData(out, 0, 0);
  }

  // ---------- dynamic layers ----------
  const lakeH = R - waterY;
  const lakeImg = sx.createImageData(C, lakeH);
  const mistY0 = Math.max(0, Math.round(waterY - U * 0.07)), mistH = Math.round(U * 0.11);
  const mistC = mk(C, mistH);
  const mistX = mistC.getContext('2d');
  const mistImg = mistX.createImageData(C, mistH);
  const LAKE = H('#141d48');
  const clouds = Array.from({ length: portrait ? 4 : 5 }, () => ({
    x: rng() * C, y: waterY * (0.1 + rng() * 0.3), len: Math.min(C * 0.16, U * 0.25) * (0.5 + rng() * 0.6), th: 1.2 + rng() * 1.4, v: 0.25 + rng() * 0.5,
  }));
  const flies = Array.from({ length: 12 }, () => ({ x: rng() * C, y: R - rng() * lakeH * 0.35, p: rng() * 50 }));
  let shooting = null, nextShot = 3, flock = null, nextFlock = 6;
  let now = 0;

  function update(dt, t) {
    now = t;
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x - c.len > C) c.x = -c.len;
    }
    if (!shooting && t > nextShot) {
      const a = Math.PI * (0.78 + rng() * 0.12);
      shooting = { x: C * (0.3 + rng() * 0.7), y: waterY * rng() * 0.45, dx: Math.cos(a), dy: Math.sin(a), age: 0 };
      nextShot = t + 5 + rng() * 9;
    }
    if (shooting && (shooting.age += dt) > 0.7) shooting = null;
    if (!flock && t > nextFlock) {
      const n = 5 + Math.floor(rng() * 5);
      flock = { x: C + 6, y: waterY * (0.35 + rng() * 0.3), birds: Array.from({ length: n }, (_, i) => [(i % 2 ? 1 : -1) * Math.ceil(i / 2) * 1.5, Math.ceil(i / 2) * 2.2, rng() * 6]) };
      nextFlock = t + 18 + rng() * 16;
    }
    if (flock && (flock.x -= dt * 7) < -20) flock = null;
  }

  function draw(ctx) {
    const t = now;
    sx.globalAlpha = 1;
    sx.drawImage(skyC, 0, 0);
    for (const s of twinkles) {
      const k = 0.5 + 0.5 * Math.sin(t * s.s + s.p);
      sx.fillStyle = `rgba(${s.c.join(',')},${k})`;
      sx.fillRect(s.x, s.y, 1, 1);
      if (k > 0.92 && s.s > 2.3) {
        sx.fillStyle = `rgba(${s.c.join(',')},0.35)`;
        sx.fillRect(s.x - 1, s.y, 3, 1);
        sx.fillRect(s.x, s.y - 1, 1, 3);
      }
    }
    if (shooting) {
      const s = shooting, head = s.age * 90;
      for (let i = 0; i < 12; i++) {
        const d = head - i * 1.2;
        if (d < 0) break;
        sx.fillStyle = `rgba(255,255,255,${(1 - i / 12) * (1 - s.age / 0.7)})`;
        sx.fillRect(Math.round(s.x + s.dx * d), Math.round(s.y + s.dy * d), 1, 1);
      }
    }
    // Thin strata clouds catching the afterglow underneath
    for (const c of clouds) {
      for (let k = 0; k < 5; k++) {
        const cx = c.x - c.len * 0.5 + k * c.len * 0.25, cy = c.y - Math.sin((k / 4) * Math.PI) * c.th * 0.8;
        sx.fillStyle = 'rgba(122,76,140,0.35)';
        sx.beginPath();
        sx.ellipse(cx, cy, c.len * 0.35, c.th, 0, 0, Math.PI * 2);
        sx.fill();
        sx.fillStyle = 'rgba(224,127,120,0.28)';
        sx.beginPath();
        sx.ellipse(cx + 1, cy + c.th * 0.6, c.len * 0.3, c.th * 0.5, 0, 0, Math.PI * 2);
        sx.fill();
      }
    }
    if (flock) {
      sx.fillStyle = '#121633';
      for (const [bx, by, ph] of flock.birds) {
        const x = Math.round(flock.x + Math.abs(bx) * 1.2), y = Math.round(flock.y + by * 0.5 + bx * 0.3);
        const up = Math.sin(t * 7 + ph) > 0 ? 1 : 0;
        sx.fillRect(x, y, 1, 1);
        sx.fillRect(x - 1, y - up, 1, 1);
        sx.fillRect(x + 1, y - up, 1, 1);
      }
    }
    sx.drawImage(mtC, 0, 0);

    // Waterfall
    for (let y = Math.round(topMid(wfX)) + 2; y < waterY; y++) {
      for (let dx = 0; dx < 2; dx++) {
        const streak = ((y - t * 16 + hash3(wfX + dx, 0, 2) * 8) % 6 + 6) % 6 < 2;
        sx.fillStyle = streak ? '#e9e6f5' : '#8f93bf';
        sx.fillRect(wfX - 1 + dx, y, 1, 1);
      }
    }
    // Village windows, a few switching on and off through the evening
    for (const wd of windows) {
      const on = hash3(wd.x, Math.floor((t + wd.p) / 9), 1) < 0.8;
      if (!on) continue;
      sx.fillStyle = Math.sin(t * 3 + wd.p) > 0.6 ? '#ffb347' : '#ffd27a';
      sx.fillRect(wd.x, wd.y, 1, 1);
    }

    // Mist rolling along the foot of the mountains
    for (let y = 0; y < mistH; y++) {
      const band = Math.sin((y / mistH) * Math.PI);
      for (let x = 0; x < C; x++) {
        const m = fbm(x * 0.03 - t * 0.05, (y + mistY0) * 0.14 + t * 0.01, 3);
        const wfMist = Math.exp(-(((x - wfX) / 4) ** 2)) * 0.5;
        const a = band * (sm(-0.1, 0.35, m) * 0.55 + wfMist);
        const i = (y * C + x) * 4;
        mistImg.data[i] = 150;
        mistImg.data[i + 1] = 146;
        mistImg.data[i + 2] = 196;
        mistImg.data[i + 3] = Math.min(1, a) * 255;
      }
    }
    mistX.putImageData(mistImg, 0, 0);
    sx.drawImage(mistC, 0, mistY0);

    // Mirror lake: rows reflect the scene above, wobbling more toward the viewer
    const src = sx.getImageData(0, 0, C, waterY).data;
    for (let y = 0; y < lakeH; y++) {
      const sy = Math.max(0, waterY - 1 - Math.floor(y * (portrait ? 0.75 : 1)));
      const amp = 0.4 + y * 0.05;
      for (let x = 0; x < C; x++) {
        const ox = Math.round(noise2(x * 0.06, y * 0.35 - t * 0.7) * amp * 1.6);
        const xx = Math.max(0, Math.min(C - 1, x + ox));
        const i = (sy * C + xx) * 4;
        let r = src[i] * 0.72 + LAKE[0] * 0.28, g = src[i + 1] * 0.72 + LAKE[1] * 0.28, b = src[i + 2] * 0.72 + LAKE[2] * 0.28;
        if (noise2(x * 0.45, y * 1.3 - t * 1.1) > 0.62 && y < lakeH * 0.7) { r += 45; g += 45; b += 55; }
        const j = (y * C + x) * 4;
        lakeImg.data[j] = r;
        lakeImg.data[j + 1] = g;
        lakeImg.data[j + 2] = b;
        lakeImg.data[j + 3] = 255;
      }
    }
    sx.putImageData(lakeImg, 0, waterY);
    sx.fillStyle = 'rgba(160,150,200,0.35)';
    sx.fillRect(0, waterY, C, 1);

    // Lamplight trails on the water
    for (const wd of windows) {
      if (hash3(wd.x, Math.floor((t + wd.p) / 9), 1) >= 0.8) continue;
      const len = 3 + (wd.x % 5);
      for (let k = 1; k <= len; k++) {
        sx.fillStyle = `rgba(255,190,100,${0.6 * (1 - k / (len + 1))})`;
        sx.fillRect(wd.x + Math.round(noise2(k * 0.7, t * 1.5 + wd.x) * 1.2), waterY + (waterY - 1 - wd.y) + k, 1, 1);
      }
    }

    // A lantern boat crossing the lake, trailing a wake
    const span = C + 30;
    const bx = ((t * 1.1) % span) - 15, by = waterY + Math.round(lakeH * 0.32);
    for (let k = 1; k < 18; k++) {
      sx.fillStyle = `rgba(150,150,210,${0.3 * (1 - k / 18)})`;
      sx.fillRect(Math.round(bx - 3 - k), by + 1 + Math.round(k * 0.25), 1, 1);
      sx.fillRect(Math.round(bx - 3 - k), by + 1 - Math.round(k * 0.12), 1, 1);
    }
    sx.fillStyle = '#0b1018';
    sx.fillRect(Math.round(bx - 4), by, 8, 1);
    sx.fillRect(Math.round(bx - 3), by - 1, 6, 1);
    sx.fillRect(Math.round(bx - 1), by - 3, 1, 2);
    const lf = 0.8 + 0.2 * Math.sin(t * 9);
    sx.fillStyle = `rgba(255,210,122,${lf})`;
    sx.fillRect(Math.round(bx + 3), by - 2, 1, 1);
    for (let k = 1; k < 7; k++) {
      sx.fillStyle = `rgba(255,190,100,${0.55 * lf * (1 - k / 7)})`;
      sx.fillRect(Math.round(bx + 3 + noise2(k, t * 2) * 1.2), by + k, 1, 1);
    }

    sx.drawImage(fgC, 0, 0);
    for (const f of flies) {
      const a = Math.max(0, Math.sin(t * 1.7 + f.p));
      if (a < 0.1) continue;
      sx.fillStyle = `rgba(216,240,122,${a})`;
      sx.fillRect(Math.round(f.x + noise2(t * 0.2, f.p) * 6), Math.round(f.y + noise2(f.p, t * 0.2) * 3), 1, 1);
    }
    S.render(ctx);
  }

  return { update, draw };
}
