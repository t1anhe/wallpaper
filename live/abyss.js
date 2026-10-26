// Abyss — the deep sea, far below the reach of sunlight, in glyphs.
// One jellyfish drifts alone through the dark, its tentacles trailing the path it swam; marine snow
// only shows where its light catches it; now and then something flickers far away.
// Moving the pointer stirs the water and the plankton flash faintly where it passes.
// Rendered as ASCII by default (?ascii=0 for the plain version, ?res=<glyph rows>).
function createAbyss({ w, h, rng, params }) {
  const { noise2 } = makeNoise(rng);
  const u = Math.min(w, h);
  const TAU = Math.PI * 2;
  const lw = (k) => Math.max(1, u * k);
  let now = 0;

  const makeJelly = (r, c, core, far) => ({
    x: w * (0.35 + rng() * 0.3), y: h * (0.4 + rng() * 0.2), vx: 0, vy: 0, tilt: 0,
    r, c, core, far, rate: 1.4 + rng() * 0.4, phase: rng() * TAU, n: 9, len: r * 6, seed: rng() * 100,
    trail: [],
  });
  const jelly = makeJelly(u * 0.075, '#8fe9ff', '#f0fdff', false);
  const distant = makeJelly(u * 0.02, '#a59bff', '#e9e6ff', true);
  distant.x = w * (rng() < 0.5 ? 0.18 : 0.82);
  distant.y = h * 0.3;
  const snow = Array.from({ length: Math.round((w * h) / 7000) }, () => ({
    x: rng() * w, y: rng() * h, s: 1 + rng() * 1.4, v: 0.006 + rng() * 0.012, p: rng() * 10, a: rng() < 0.3 ? 0.14 + rng() * 0.12 : 0.05,
  }));
  const sparks = [];
  let nextFlash = 5, lastPX = null, lastPY = null;

  function swim(j, dt, t, input) {
    const p = Math.max(0, Math.sin(t * j.rate + j.phase));
    // Each contraction pushes the bell along its axis; between beats it sinks and drifts.
    const lo = h * 0.25, hi = h * 0.72;
    const lift = j.y > hi ? 1.6 : j.y < lo ? 0.4 : 1;
    j.vy += (-p * u * 0.11 * lift + u * 0.02) * dt;
    j.vx += (noise2(t * 0.03, j.seed) * u * 0.05 - (j.x - w / 2) * 0.004) * dt;
    if (input.active && !j.far) {
      const dx = j.x - input.x, dy = j.y - input.y, d = Math.hypot(dx, dy);
      if (d < u * 0.3) j.vx += (dx / (d || 1)) * u * 0.08 * (1 - d / (u * 0.3)) * dt;
    }
    j.vx *= Math.pow(0.4, dt);
    j.vy *= Math.pow(0.35, dt);
    const k = j.far ? 0.35 : 1;
    j.x += j.vx * dt * k;
    j.y += j.vy * dt * k;
    j.tilt += (Math.atan2(j.vx, Math.max(u * 0.02, -j.vy + u * 0.03)) * 0.6 - j.tilt) * Math.min(1, dt * 1.5);
    j.trail.unshift([j.x, j.y]);
    if (j.trail.length > 150) j.trail.pop();
  }

  function update(dt, t, input) {
    now = t;
    swim(jelly, dt, t, input);
    swim(distant, dt, t, { active: false });
    for (const s of snow) {
      s.y += s.v * u * dt;
      s.x += Math.sin(t * 0.3 + s.p) * u * 0.003 * dt;
      if (s.y > h + 4) { s.y = -4; s.x = rng() * w; }
    }
    if (input.active) {
      if (lastPX !== null) {
        const d = Math.hypot(input.x - lastPX, input.y - lastPY);
        for (let k = 0; k < Math.min(6, d / (u * 0.015)); k++) {
          const f = rng();
          sparks.push({ x: lastPX + (input.x - lastPX) * f + (rng() - 0.5) * u * 0.03, y: lastPY + (input.y - lastPY) * f + (rng() - 0.5) * u * 0.03, age: 0, life: 1 + rng(), a: 0.5 });
        }
      }
      lastPX = input.x;
      lastPY = input.y;
    }
    // A rare, faint flicker somewhere far off
    if (t > nextFlash) {
      const cx = w * (0.1 + rng() * 0.8), cy = h * (0.1 + rng() * 0.8);
      for (let k = 0; k < 4 + Math.floor(rng() * 5); k++) {
        sparks.push({ x: cx + (rng() - 0.5) * u * 0.05, y: cy + (rng() - 0.5) * u * 0.05, age: -rng() * 0.6, life: 1.6 + rng(), a: 0.35 });
      }
      nextFlash = t + 6 + rng() * 9;
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      if (s.age > s.life) sparks.splice(i, 1);
    }
  }

  function backdrop(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#020a11');
    g.addColorStop(1, '#010308');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function glow(ctx, x, y, r, c, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(c, a));
    g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function drawJelly(ctx, j, t) {
    const p = Math.max(0, Math.sin(t * j.rate + j.phase));
    const bw = j.r * (1 - 0.2 * p), bh = j.r * (0.8 + 0.16 * p);
    const { x, y, tilt } = j;
    ctx.globalAlpha = j.far ? 0.45 : 1;
    glow(ctx, x, y, j.r * 3.2, j.c, 0.2);

    // Tentacles hang from the rim and follow the path the bell has already swum
    const cos = Math.cos(tilt), sin = Math.sin(tilt);
    const at = (lag) => j.trail[Math.min(j.trail.length - 1, Math.floor(lag))] || [x, y];
    ctx.lineCap = 'round';
    for (let k = 0; k < j.n; k++) {
      const ax = (k / (j.n - 1) - 0.5) * bw * 1.7;
      ctx.beginPath();
      for (let s = 0; s <= 22; s++) {
        const f = s / 22;
        const [hx, hy] = at(f * 140);
        const drop = f * j.len * 0.45 * (1 - 0.15 * p);
        const wave = Math.sin(f * 6 - t * 1.2 + k * 1.3) * j.r * 0.25 * f;
        const px = hx + ax * cos * (1 - f * 0.4) + wave - sin * drop * 0.3;
        const py = hy + ax * sin + drop;
        s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.strokeStyle = rgba(j.c, 0.45);
      ctx.lineWidth = lw(0.0025);
      ctx.stroke();
    }
    // Oral arms: a few frilled ribbons, shorter and brighter
    for (let k = 0; k < 4; k++) {
      const ax = (k - 1.5) * bw * 0.18;
      ctx.beginPath();
      for (let s = 0; s <= 14; s++) {
        const f = s / 14;
        const [hx, hy] = at(f * 60);
        const px = hx + ax + Math.sin(f * 8 - t * 1.6 + k * 2) * j.r * 0.12;
        const py = hy + f * j.len * 0.3;
        s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.strokeStyle = rgba(j.core, 0.55);
      ctx.lineWidth = lw(0.007);
      ctx.stroke();
    }

    // Bell: a dome with a scalloped rim, tilted into its direction of travel
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    const g = ctx.createRadialGradient(0, -bh * 0.35, bh * 0.1, 0, 0, bw * 1.05);
    g.addColorStop(0, rgba(j.core, 0.95));
    g.addColorStop(0.55, rgba(j.c, 0.75));
    g.addColorStop(1, rgba(j.c, 0.3));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, bw, bh, 0, Math.PI, 0);
    const lobes = 10;
    for (let k = 0; k < lobes; k++) {
      const xa = bw - (k * 2 * bw) / lobes, xb = xa - (2 * bw) / lobes;
      ctx.quadraticCurveTo((xa + xb) / 2, bh * 0.18, xb, 0);
    }
    ctx.fill();
    ctx.strokeStyle = rgba(j.core, 0.85);
    ctx.lineWidth = lw(0.003);
    ctx.beginPath();
    ctx.ellipse(0, 0, bw, bh, 0, Math.PI, 0);
    ctx.stroke();
    ctx.strokeStyle = rgba(j.core, 0.8);
    ctx.lineWidth = lw(0.005);
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.arc((k - 1.5) * bw * 0.3, -bh * 0.35, bw * 0.11, Math.PI * 0.1, Math.PI * 0.9);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function draw(ctx, layered) {
    const t = now;
    if (layered) ctx.clearRect(0, 0, w, h);
    else backdrop(ctx);

    // Marine snow: nearly invisible, except where the jellyfish's light falls on it
    for (const s of snow) {
      const d = Math.hypot(s.x - jelly.x, s.y - jelly.y) / (jelly.r * 7);
      const a = s.a + 0.75 * Math.exp(-d * d);
      if (a < 0.05) continue;
      ctx.fillStyle = `rgba(200,235,245,${Math.min(1, a)})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    for (const s of sparks) {
      if (s.age < 0) continue;
      const a = Math.sin((s.age / s.life) * Math.PI) * s.a;
      ctx.fillStyle = `rgba(130,235,255,${a})`;
      ctx.fillRect(s.x, s.y, lw(0.004), lw(0.004));
    }
    drawJelly(ctx, distant, t);
    drawJelly(ctx, jelly, t);
  }

  return { update, draw, drawBackground: backdrop };
}
createAbyss.ascii = true;
createAbyss.asciiRes = 160;
