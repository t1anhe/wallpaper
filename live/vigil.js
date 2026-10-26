// Vigil — night over an empty field. A half-built tower stands at its edge with a crane beside it,
// and the red warning lights on the roof and the jib tip blink slowly, on and off, all night.
// Wind moves through the grass and the safety netting; the crane weathervanes almost imperceptibly;
// far away a town glows on the horizon and, once in a while, a car's lights slide past.
// Rendered as ASCII by default (?ascii=0 for the plain version, ?res=<glyph rows>).
function createVigil({ w, h, rng }) {
  const { noise2 } = makeNoise(rng);
  const u = Math.min(w, h);
  const portrait = h > w;
  const TAU = Math.PI * 2;
  const hy = Math.round(h * (portrait ? 0.7 : 0.74)); // horizon
  const lw = (k) => Math.max(1, u * k);
  const H = hexToRgb;
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  let now = 0;

  // ---------- the site ----------
  const B = { floors: portrait ? 16 : 14, bays: 5 };
  B.H = h * (portrait ? 0.36 : 0.44);
  B.W = u * (portrait ? 0.34 : 0.22);
  B.x = w * (portrait ? 0.4 : 0.6);
  B.left = B.x - B.W / 2;
  B.base = hy + u * 0.012;
  B.fh = B.H / B.floors;
  const topMissing = Array.from({ length: B.bays + 1 }, () => rng() < 0.45);
  const walls = Array.from({ length: 5 }, () => Array.from({ length: B.bays }, () => rng() < 0.75));
  const C = { x: B.left + B.W + u * 0.075, H: B.H * 1.3, jib: u * (portrait ? 0.4 : 0.5), cjib: u * 0.14, mw: u * 0.022, phase: rng() * 10 };
  C.base = B.base;
  C.top = C.base - C.H;

  // ---------- sky and distance ----------
  const stars = Array.from({ length: Math.round((w * hy) / 9000) }, () => ({
    x: rng() * w, y: rng() * hy * 0.8, a: 0.15 + rng() * 0.35, p: rng() * 10, s: 0.2 + rng() * 0.6,
  }));
  const town = Array.from({ length: 30 }, () => ({
    x: w * (portrait ? 0.03 : 0.05) + rng() * w * (portrait ? 0.22 : 0.2), y: hy - rng() * u * 0.006,
    c: rng() < 0.75 ? '#ffc98a' : '#e8eef8', a: 0.3 + rng() * 0.5, p: rng() * 10,
  }));
  const clouds = Array.from({ length: 3 }, () => ({ x: rng() * w, y: hy * (0.15 + rng() * 0.45), len: u * (0.4 + rng() * 0.5), v: u * (0.004 + rng() * 0.004) }));
  let car = null, nextCar = 6;

  // Field drawn per pixel: grass brightness rolls with the wind, finer toward the horizon
  const fieldH = h - hy;
  let fieldImg = null;
  const GRASS_LO = H('#090d0a'), GRASS_HI = H('#1c261d');

  function update(dt, t) {
    now = t;
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x - c.len > w) c.x = -c.len;
    }
    if (!car && t > nextCar) {
      car = { x: w + u * 0.05, v: u * (0.02 + rng() * 0.015) };
    }
    if (car && (car.x -= car.v * dt) < -u * 0.05) {
      car = null;
      nextCar = t + 18 + rng() * 25;
    }
  }

  // Obstruction light: a quick rise, a short hold, a slow fade, then dark
  function beacon(t, off) {
    const p = (((t + off) % 2.6) + 2.6) % 2.6 / 2.6;
    if (p < 0.05) return p / 0.05;
    if (p < 0.24) return 1;
    if (p < 0.46) return 1 - (p - 0.24) / 0.22;
    return 0;
  }

  function sky(ctx, k) {
    const g = ctx.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, rgb(H('#03060d').map((v) => v * k)));
    g.addColorStop(0.7, rgb(H('#0a1020').map((v) => v * k)));
    g.addColorStop(1, rgb(H('#1d2536').map((v) => v * k)));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, hy + 1);
    // the town's glow on the low cloud base
    const tg = ctx.createRadialGradient(w * (portrait ? 0.14 : 0.15), hy, 0, w * (portrait ? 0.14 : 0.15), hy, u * 0.5);
    tg.addColorStop(0, `rgba(${Math.round(80 * k)},${Math.round(58 * k)},${Math.round(56 * k)},0.6)`);
    tg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = tg;
    ctx.fillRect(0, 0, w, hy + 1);
  }

  function backdrop(ctx) {
    sky(ctx, 0.45);
    ctx.fillStyle = '#040605';
    ctx.fillRect(0, hy, w, h - hy);
  }

  function drawField(ctx, t) {
    if (!fieldImg) fieldImg = ctx.createImageData(w, fieldH);
    const d = fieldImg.data;
    for (let y = 0; y < fieldH; y += 3) {
      const z = y / fieldH;
      const sc = 1 / (0.12 + z);
      for (let x = 0; x < w; x += 3) {
        const v = noise2(x * 0.004 * sc - t * 0.12, (y + 3) * 0.035 * sc) + 0.5;
        const c = lerp(GRASS_LO, GRASS_HI, Math.max(0, Math.min(1, v * (0.35 + 0.65 * z))));
        for (let yy = y; yy < Math.min(y + 3, fieldH); yy++) {
          for (let xx = x; xx < Math.min(x + 3, w); xx++) {
            const i = (yy * w + xx) * 4;
            d[i] = c[0];
            d[i + 1] = c[1];
            d[i + 2] = c[2];
            d[i + 3] = 255;
          }
        }
      }
    }
    ctx.putImageData(fieldImg, 0, hy);
  }

  function drawBuilding(ctx, t) {
    const { left, W, base, fh, floors, bays } = B;
    const bay = W / bays, colW = Math.max(2, bay * 0.09), slab = Math.max(2, fh * 0.13);
    const CONC = '#4a5568', DARK = '#171d26', VOID = '#06080b';
    // Brick infill and dark window openings on the lower floors
    for (let f = 0; f < walls.length; f++) {
      for (let b = 0; b < bays; b++) {
        if (!walls[f][b]) continue;
        const x0 = left + b * bay, y0 = base - (f + 1) * fh;
        ctx.fillStyle = DARK;
        ctx.fillRect(x0, y0, bay, fh);
        ctx.fillStyle = VOID;
        ctx.fillRect(x0 + bay * 0.3, y0 + fh * 0.3, bay * 0.4, fh * 0.45);
      }
    }
    ctx.fillStyle = CONC;
    // Floor slabs (the top one only half poured)
    for (let f = 1; f <= floors; f++) {
      const y = base - f * fh;
      const wd = f === floors ? W * 0.55 : W;
      ctx.fillRect(left - bay * 0.08, y, wd + bay * 0.16, slab);
    }
    // Columns, some stopping a floor short, with rebar sticking out of their tops
    for (let i = 0; i <= bays; i++) {
      const x = left + i * bay - colW / 2;
      const top = base - (topMissing[i] ? floors - 1 : floors) * fh;
      ctx.fillStyle = CONC;
      ctx.fillRect(x, top, colW, base - top);
      ctx.strokeStyle = '#5a6476';
      ctx.lineWidth = lw(0.0012);
      for (let r = 0; r < 3; r++) {
        ctx.beginPath();
        ctx.moveTo(x + colW * (0.2 + r * 0.3), top);
        ctx.lineTo(x + colW * (0.2 + r * 0.3) + Math.sin(r + i) * colW * 0.3, top - fh * 0.38);
        ctx.stroke();
      }
    }
    // Scaffolding and a safety net on the left face, breathing with the wind
    const sx0 = left - bay * 0.55, sx1 = left - bay * 0.1, f0 = 2, f1 = Math.round(floors * 0.75);
    ctx.strokeStyle = '#2c3442';
    ctx.lineWidth = lw(0.0012);
    ctx.beginPath();
    for (const x of [sx0, sx1]) {
      ctx.moveTo(x, base);
      ctx.lineTo(x, base - f1 * fh);
    }
    for (let f = 0; f <= f1; f++) {
      ctx.moveTo(sx0, base - f * fh);
      ctx.lineTo(sx1, base - f * fh);
    }
    ctx.stroke();
    const strips = 6;
    for (let s = 0; s < strips; s++) {
      const a = 0.35 + 0.25 * (noise2(t * 0.35 + s * 0.7, 3.1) + 0.5);
      ctx.fillStyle = `rgba(28,52,40,${a})`;
      ctx.fillRect(sx0 + ((sx1 - sx0) * s) / strips, base - f1 * fh, (sx1 - sx0) / strips + 1, (f1 - f0) * fh);
    }
  }

  function drawCrane(ctx, t) {
    const { x, base, top, mw } = C;
    // It weathervanes in the wind: the jib swings very slowly, foreshortening as it turns
    const slew = Math.cos(0.5 * Math.sin(t * 0.012 + C.phase) + 0.15 * noise2(t * 0.02, C.phase));
    const jib = C.jib * slew, cjib = C.cjib * slew;
    const STEEL = '#3a4250';
    ctx.strokeStyle = STEEL;
    ctx.lineWidth = lw(0.0016);
    ctx.beginPath();
    // Mast: two rails and a zigzag of bracing
    for (const dx of [-mw / 2, mw / 2]) {
      ctx.moveTo(x + dx, base);
      ctx.lineTo(x + dx, top);
    }
    let zig = 1;
    for (let y = base; y > top + mw; y -= mw) {
      ctx.moveTo(x - (mw / 2) * zig, y);
      ctx.lineTo(x + (mw / 2) * zig, y - mw);
      zig = -zig;
    }
    // Jib (to the left) and counter-jib (to the right) as shallow trusses
    const jt = top - mw * 0.9;
    ctx.moveTo(x, top);
    ctx.lineTo(x - jib, top);
    ctx.moveTo(x, jt);
    ctx.lineTo(x - jib * 0.97, top - mw * 0.25);
    const n = Math.max(4, Math.round(Math.abs(jib) / mw));
    for (let i = 0; i < n; i++) {
      const xa = x - (jib * i) / n, xb = x - (jib * (i + 1)) / n;
      const ya = jt + ((top - mw * 0.25 - jt) * i) / n;
      ctx.moveTo(xa, i % 2 ? top : ya);
      ctx.lineTo(xb, i % 2 ? ya : top);
    }
    ctx.moveTo(x, top);
    ctx.lineTo(x + cjib, top);
    ctx.moveTo(x, jt);
    ctx.lineTo(x + cjib, top - mw * 0.4);
    // Tower head and its tie bars
    const apex = top - C.H * 0.11;
    ctx.moveTo(x - mw / 2, top);
    ctx.lineTo(x, apex);
    ctx.lineTo(x + mw / 2, top);
    ctx.moveTo(x, apex);
    ctx.lineTo(x - jib * 0.62, top - mw * 0.5);
    ctx.moveTo(x, apex);
    ctx.lineTo(x + cjib * 0.95, top - mw * 0.4);
    ctx.stroke();
    // Cab, counterweight, trolley, cable and hook
    ctx.fillStyle = '#262d38';
    ctx.fillRect(x + mw * 0.5, top + mw * 0.2, mw * 1.1, mw * 1.1);
    ctx.fillRect(x + cjib * 0.72, top - mw * 0.2, Math.max(2, cjib * 0.25), mw * 1.4);
    const tx = x - jib * 0.58, sway = Math.sin(t * 0.7) * u * 0.004 + noise2(t * 0.3, 7) * u * 0.004;
    const hookY = top + C.H * 0.42;
    ctx.strokeStyle = '#4a5260';
    ctx.lineWidth = lw(0.001);
    ctx.beginPath();
    ctx.moveTo(tx, top);
    ctx.lineTo(tx + sway, hookY);
    ctx.stroke();
    ctx.fillStyle = '#3a4250';
    ctx.fillRect(tx + sway - mw * 0.35, hookY, mw * 0.7, mw * 0.6);
    return [[x, apex - mw * 0.2, 0], [x - jib, top - mw * 0.1, 0.35]];
  }

  function draw(ctx, layered) {
    const t = now;
    if (layered) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = 0.5;
      sky(ctx, 1);
      ctx.globalAlpha = 1;
    } else {
      sky(ctx, 1);
    }
    for (const s of stars) {
      const a = s.a * (0.6 + 0.4 * Math.sin(t * s.s + s.p));
      ctx.fillStyle = `rgba(220,228,245,${a})`;
      ctx.fillRect(s.x, s.y, lw(0.002), lw(0.002));
    }
    for (const c of clouds) {
      const g = ctx.createLinearGradient(c.x - c.len / 2, 0, c.x + c.len / 2, 0);
      g.addColorStop(0, 'rgba(48,56,74,0)');
      g.addColorStop(0.5, 'rgba(48,56,74,0.35)');
      g.addColorStop(1, 'rgba(48,56,74,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.len / 2, u * 0.012, 0, 0, TAU);
      ctx.fill();
    }
    drawField(ctx, t);

    // The town, far off on the horizon, and the odd car on the road in front of it
    for (const l of town) {
      ctx.fillStyle = rgba(l.c, l.a * (0.75 + 0.25 * Math.sin(t * 0.8 + l.p)));
      ctx.fillRect(l.x, l.y - lw(0.0015), lw(0.0022), lw(0.0022));
    }
    if (car) {
      const fade = Math.min(1, Math.min(car.x, w - car.x) / (u * 0.15));
      ctx.fillStyle = `rgba(255,244,220,${0.85 * fade})`;
      ctx.fillRect(car.x, hy + u * 0.004, lw(0.003), lw(0.0022));
      ctx.fillRect(car.x + lw(0.006), hy + u * 0.004, lw(0.003), lw(0.0022));
    }

    // Site: mounds of earth, the hoarding, the tower and the crane
    ctx.fillStyle = '#0d110f';
    ctx.beginPath();
    ctx.ellipse(B.left - u * 0.08, B.base + u * 0.004, u * 0.06, u * 0.016, 0, Math.PI, 0);
    ctx.ellipse(C.x + u * 0.1, B.base + u * 0.006, u * 0.045, u * 0.012, 0, Math.PI, 0);
    ctx.fill();
    drawBuilding(ctx, t);
    const lights = drawCrane(ctx, t);
    lights.push([B.left + B.W * 0.27, B.base - B.floors * B.fh - u * 0.006, 0.12]);
    const fx0 = B.left - u * 0.16, fx1 = C.x + u * 0.16, fy = B.base + u * 0.022, fhh = u * 0.018;
    ctx.fillStyle = 'rgba(18,22,28,0.85)';
    ctx.fillRect(fx0, fy - fhh, fx1 - fx0, fhh);
    ctx.fillStyle = '#262d38';
    ctx.fillRect(fx0, fy - fhh, fx1 - fx0, lw(0.0015));
    for (let x = fx0; x <= fx1; x += u * 0.03) ctx.fillRect(x, fy - fhh, lw(0.0015), fhh);

    // Red warning lights: tint the steel around them, then the glow itself
    ctx.globalCompositeOperation = 'source-atop';
    for (const [lx, ly, off] of lights) {
      const k = beacon(t, off);
      if (k <= 0.01) continue;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, u * 0.09);
      g.addColorStop(0, `rgba(255,60,40,${0.45 * k})`);
      g.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lx - u * 0.09, ly - u * 0.09, u * 0.18, u * 0.18);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const [lx, ly, off] of lights) {
      const k = beacon(t, off);
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, u * 0.035);
      g.addColorStop(0, `rgba(255,50,30,${0.45 * k})`);
      g.addColorStop(1, 'rgba(255,50,30,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lx - u * 0.035, ly - u * 0.035, u * 0.07, u * 0.07);
      ctx.fillStyle = `rgba(255,${Math.round(70 + 120 * k)},${Math.round(50 + 90 * k)},${0.25 + 0.75 * k})`;
      ctx.beginPath();
      ctx.arc(lx, ly, lw(0.0045), 0, TAU);
      ctx.fill();
    }
  }

  return { update, draw, drawBackground: backdrop };
}
createVigil.ascii = true;
createVigil.asciiRes = 160;
