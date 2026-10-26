// Kanagawa — after Hokusai's Great Wave off Kanagawa (c. 1831), set in type on paper.
// A great wave rears over the left of the picture; its crest breaks into claws of foam that throw
// spray across the sky like snow, and under its curl, far off, stands Mount Fuji. Boats ride the swell
// and a small wave in front echoes the mountain. The wave breathes, its claws flicker, the boats rise
// and fall, clouds drift.
// The picture is drawn with Canvas 2D and set in type by makeTypeset: strokes follow the edges, so the
// wave's lines come out as runs of / \ | -, inked in Prussian blue on cream paper.
// ?ascii=0 shows the picture itself, ?res=<cells across the short side> sets the type size.
function createKanagawa({ w, h, rng, params }) {
  const { noise2 } = makeNoise(rng);
  const portrait = h > w;
  const TAU = Math.PI * 2;
  const PAPER = [0.94, 0.89, 0.78];
  const typeset = params.get('ascii') !== '0' ? makeTypeset(w, h, { res: +params.get('res') || 110, paper: PAPER, ramp: " .':;!+*x%#@", wash: 0.62, ink: 0.68, bold: true }) : null;

  // Prussian blue and indigo, a paler blue, foam, the boats' pale wood
  const DEEP = '#123a6c', MID = '#2763a0', PALE = '#7db0d8', FOAM = '#fbf7ec', WOOD = '#e4cc92', INK = '#1a2a3c';

  // ---------- layout: everything in design units, U pixels each ----------
  // Landscape: the wave fills the left, Fuji sits under its curl towards the middle, a swell on the right.
  // Phone: the wave spans the width below an open sky, Fuji under the curl.
  const U = portrait ? w : h;
  const ox = portrait ? 0 : (w - 1.78 * h) / 2;
  const oy = portrait ? h * 0.24 : 0;
  const X = (x) => ox + x * U, Y = (y) => oy + y * U;
  const HORIZON = 0.77;
  const BOTTOM = Math.max(1.12, (h - oy) / U + 0.05); // bottom edge of the picture, in units
  const FUJI = portrait ? { x: 0.8, hgt: 0.13, half: 0.17 } : { x: 1.2, hgt: 0.16, half: 0.22 };
  const RIGHT = portrait ? 1.05 : (w - ox) / U + 0.05; // right edge of the picture, in units

  const bez = (s, t) => {
    const u = 1 - t;
    return [0, 1].map((k) => u * u * u * s[0][k] + 3 * u * u * t * s[1][k] + 3 * u * t * t * s[2][k] + t * t * t * s[3][k]);
  };
  const bezD = (s, t) => {
    const u = 1 - t;
    return [0, 1].map((k) => 3 * u * u * (s[1][k] - s[0][k]) + 6 * u * t * (s[2][k] - s[1][k]) + 3 * t * t * (s[3][k] - s[2][k]));
  };
  function trace(ctx, segs, move = true) {
    segs.forEach((s, i) => {
      if (i === 0 && move) ctx.moveTo(X(s[0][0]), Y(s[0][1]));
      ctx.bezierCurveTo(X(s[1][0]), Y(s[1][1]), X(s[2][0]), Y(s[2][1]), X(s[3][0]), Y(s[3][1]));
    });
  }

  // ---------- the great wave ----------
  const WAVE = {
    back: [[-0.12, BOTTOM], [-0.02, 0.62], [0.25, 0.12], [0.55, 0.1]],
    lip: [[0.55, 0.1], [0.72, 0.04], [0.88, 0.12], [0.93, 0.26]],
    tip: [[0.93, 0.26], [0.96, 0.34], [0.92, 0.4], [0.86, 0.4]],
    under: [[0.86, 0.4], [0.84, 0.32], [0.8, 0.27], [0.74, 0.27]],
    barrel: [[0.74, 0.27], [0.66, 0.28], [0.63, 0.38], [0.66, 0.5]],
    face: [[0.66, 0.5], [0.7, 0.62], [0.82, 0.8], [1.02, 0.88]],
    trough: [[1.02, 0.88], [1.1, 0.9], [1.2, 0.95], [1.3, BOTTOM]],
  };
  // The wave breathes: the crest lifts and the lip reaches out and draws back. A smooth field over the
  // plane, so segments that share an end point stay joined.
  function shape(t) {
    const lift = Math.sin(t * 0.55), reach = Math.sin(t * 0.55 + 0.9);
    const move = ([x, y]) => {
      const crest = Math.max(0, 1 - y / 0.55);
      const lip = Math.min(1, Math.max(0, (x - 0.5) / 0.4)) * crest;
      return [x + 0.018 * reach * lip, y - 0.012 * lift * crest + 0.008 * reach * lip];
    };
    const out = {};
    for (const k in WAVE) out[k] = WAVE[k].map(move);
    return out;
  }
  // Where the claws sit along the crest: irregular gaps, fixed for the life of the wave
  const CLAWS = [];
  for (let f = 0.14; f < 1; f += 0.035 + rng() * 0.05) CLAWS.push({ f, big: 0.5 + rng() * 0.8, seed: rng() * 50 });
  // Points along the crest (at fractions fs, 0 = top, 1 = the tip), with outward normal and direction of travel
  function crestPoints(wv, n, fs) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const f = fs ? fs[i] : 0.12 + (0.88 * i) / (n - 1);
      const [seg, t] = f < 0.72 ? [wv.lip, f / 0.72] : [wv.tip, ((f - 0.72) / 0.28) * 0.85];
      const p = bez(seg, t), d = bezD(seg, t);
      const l = Math.hypot(d[0], d[1]);
      pts.push({ p, t: [d[0] / l, d[1] / l], n: [d[1] / l, -d[0] / l], f });
    }
    return pts;
  }
  // One claw of foam: a hooked finger reaching out and curling towards the wave's travel, with two
  // smaller fingers at its tip
  function claw(ctx, p, n, tn, len, curl, lw, seed = 0) {
    // A finger: out from the base, bending over towards the travel, ending in a hooked point
    const finger = (base, nn, tt, l, k) => {
      const q = (a, b) => [base[0] + nn[0] * a + tt[0] * b, base[1] + nn[1] * a + tt[1] * b];
      const a0 = q(0, -l * 0.3), a1 = q(0, l * 0.22);
      const tip = q(l * 0.75, l * k);
      const c0 = q(l * 1.15, -l * 0.1), c1 = q(l * 0.55, l * k * 0.75);
      ctx.moveTo(X(a0[0]), Y(a0[1]));
      ctx.quadraticCurveTo(X(c0[0]), Y(c0[1]), X(tip[0]), Y(tip[1]));
      ctx.quadraticCurveTo(X(c1[0]), Y(c1[1]), X(a1[0]), Y(a1[1]));
      ctx.closePath();
    };
    ctx.beginPath();
    finger(p, n, tn, len, curl);
    // Smaller fingers along its back, each turned and sized a little differently
    for (let j = 0; j < 3; j++) {
      const r = hash3(seed * 7 + j, 3), along = 0.25 + j * 0.22;
      const turn = -0.5 + r * 0.7;
      const c = Math.cos(turn), s = Math.sin(turn);
      const nn = [n[0] * c - tn[0] * s, n[1] * c - tn[1] * s], tt = [tn[0] * c + n[0] * s, tn[1] * c + n[1] * s];
      const base = [p[0] + n[0] * len * along * 0.9 - tn[0] * len * 0.05, p[1] + n[1] * len * along * 0.9 - tn[1] * len * 0.05];
      finger(base, nn, tt, len * (0.3 + r * 0.25), curl * 1.2);
    }
    ctx.fillStyle = FOAM;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = DEEP;
    ctx.stroke();

  }

  // ---------- spray, thrown from the claws, drifting down across the sky like snow ----------
  const spray = [];
  let sprayAcc = 0;

  // ---------- the boats: long and narrow, rowers bent over the oars ----------
  const BOATS = portrait
    ? [{ x: 0.6, y: 0.93, len: 0.36, ang: -0.22, ph: 0.3, front: true }, { x: 0.2, y: 1.0, len: 0.3, ang: 0.3, ph: 2.1, front: false }, { x: 0.5, y: 1.16, len: 0.4, ang: 0.1, ph: 1.2, near: true }]
    : [{ x: 0.98, y: 0.9, len: 0.38, ang: -0.24, ph: 0.3, front: true }, { x: 1.52, y: 0.8, len: 0.32, ang: -0.32, ph: 1.7, front: true }, { x: 0.3, y: 0.9, len: 0.3, ang: 0.32, ph: 2.6, front: false }];
  function drawBoat(ctx, b, t) {
    const bob = 0.012 * Math.sin(t * 1.05 + b.ph), rock = 0.05 * Math.sin(t * 1.05 + b.ph + 1.2);
    const a = b.ang + rock, ca = Math.cos(a), sa = Math.sin(a);
    const at = (u, v) => [b.x + (u * ca - v * sa) * b.len, b.y + bob + (u * sa + v * ca) * b.len];
    // Hull: a long sliver, the bow raised
    const hull = [[-0.5, -0.02], [0.5, -0.07], [0.42, 0.02], [-0.42, 0.035]].map(([u, v]) => at(u, v));
    ctx.beginPath();
    ctx.moveTo(X(hull[0][0]), Y(hull[0][1]));
    ctx.lineTo(X(hull[1][0]), Y(hull[1][1]));
    const c = at(0.1, 0.07);
    ctx.quadraticCurveTo(X(hull[2][0]), Y(hull[2][1]), X(c[0]), Y(c[1]));
    ctx.quadraticCurveTo(X(hull[3][0]), Y(hull[3][1]), X(hull[0][0]), Y(hull[0][1]));
    ctx.fillStyle = WOOD;
    ctx.fill();
    ctx.lineWidth = U * 0.003;
    ctx.strokeStyle = INK;
    ctx.stroke();
    // Rowers: a row of dark backs
    ctx.fillStyle = DEEP;
    for (let i = 0; i < 8; i++) {
      const p = at(-0.33 + i * 0.085, -0.045);
      ctx.beginPath();
      ctx.ellipse(X(p[0]), Y(p[1]), U * 0.008, U * 0.011, a, 0, TAU);
      ctx.fill();
    }
  }

  // A wave seen side on: body, a paler band and white crest along its top edge, and a few claws
  function smallWave(ctx, segs, t, seed, clawN, cap = 0) {
    ctx.save();
    ctx.beginPath();
    trace(ctx, segs);
    ctx.closePath();
    ctx.fillStyle = MID;
    ctx.fill();
    ctx.clip();
    ctx.beginPath();
    trace(ctx, segs.slice(0, 2));
    ctx.lineWidth = U * 0.05;
    ctx.strokeStyle = PALE;
    ctx.stroke();
    ctx.lineWidth = U * 0.018;
    ctx.strokeStyle = FOAM;
    ctx.stroke();
    if (cap) {
      // Foam over the peak, its lower edge ragged
      const top = segs[0][3];
      ctx.beginPath();
      ctx.moveTo(X(top[0] - 0.2), Y(top[1] - 0.05));
      ctx.lineTo(X(top[0] + 0.2), Y(top[1] - 0.05));
      for (let i = 0; i <= 10; i++) {
        const u = 0.16 - (i / 10) * 0.32;
        ctx.lineTo(X(top[0] + u), Y(top[1] + cap * (i % 2 ? 1 : 0.6) * (1 - Math.abs(u) * 2.2)));
      }
      ctx.closePath();
      ctx.fillStyle = FOAM;
      ctx.fill();
    }
    ctx.restore();
    for (let i = 0; i < clawN; i++) {
      const f = (i + 0.5) / clawN;
      const [seg, tt] = f < 0.5 ? [segs[0], 0.55 + f * 0.9] : [segs[1], (f - 0.5) * 0.9];
      const p = bez(seg, tt), d = bezD(seg, tt), l = Math.hypot(d[0], d[1]);
      const len = 0.016 * (0.8 + 0.4 * (noise2(i * 3.1 + seed, t * 0.9) + 0.5));
      claw(ctx, p, [d[1] / l, -d[0] / l], [d[0] / l, d[1] / l], len, 0.5, U * 0.0022);
    }
  }

  // ---------- clouds: long low bands drifting slowly ----------
  const clouds = Array.from({ length: 3 }, (_, i) => ({
    x: rng() * 2, y: portrait ? -0.12 + i * 0.07 : 0.3 + i * 0.07, len: 0.5 + rng() * 0.4, v: 0.004 + rng() * 0.004,
  }));

  let now = 0;
  function update(dt, t) {
    now = t;
    for (const c of clouds) {
      c.x -= c.v * dt;
      if (c.x + c.len < (-ox / U)) c.x = RIGHT + 0.1;
    }
    // Spray: a few drops a second from the claws, thrown out and falling slowly
    const wv = shape(t);
    sprayAcc += dt * 26;
    const pts = crestPoints(wv, 24);
    while (sprayAcc > 1) {
      sprayAcc -= 1;
      const c = pts[Math.floor(Math.pow(rng(), 0.6) * pts.length)];
      const sp = 0.03 + rng() * 0.05;
      spray.push({ x: c.p[0] + c.n[0] * 0.03, y: c.p[1] + c.n[1] * 0.03, vx: c.n[0] * sp + 0.03, vy: c.n[1] * sp - 0.01, life: 0, max: 3 + rng() * 4, r: 0.003 + rng() * 0.004 });
    }
    for (let i = spray.length - 1; i >= 0; i--) {
      const s = spray[i];
      s.life += dt;
      s.vy += 0.012 * dt;
      s.vx *= Math.pow(0.8, dt);
      s.x += s.vx * dt + noise2(s.y * 8, t * 0.3) * 0.004 * dt;
      s.y += s.vy * dt;
      if (s.life > s.max || s.y > HORIZON + 0.1) spray.splice(i, 1);
    }
  }

  function draw(ctx0) {
    const t = now;
    const ctx = typeset ? typeset.ctx : ctx0;
    // Paper and sky: a dusky band along the top, cream below
    ctx.fillStyle = rgb(PAPER.map((v) => v * 255));
    ctx.fillRect(0, 0, w, h);
    const sg = ctx.createLinearGradient(0, 0, 0, h * (portrait ? 0.22 : 0.32));
    sg.addColorStop(0, 'rgba(120,108,88,0.75)');
    sg.addColorStop(1, 'rgba(120,108,88,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, h * 0.35);
    for (const c of clouds) {
      const g = ctx.createLinearGradient(X(c.x), 0, X(c.x + c.len), 0);
      g.addColorStop(0, 'rgba(170,160,140,0)');
      g.addColorStop(0.5, 'rgba(170,160,140,0.55)');
      g.addColorStop(1, 'rgba(170,160,140,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(X(c.x + c.len / 2), Y(c.y), (c.len / 2) * U, U * 0.018, 0, 0, TAU);
      ctx.fill();
    }

    // The far sea, with lines of swell
    ctx.fillStyle = PALE;
    ctx.fillRect(0, Y(HORIZON), w, h - Y(HORIZON));
    ctx.strokeStyle = MID;
    ctx.lineWidth = U * 0.003;
    for (let k = 0; k < 14; k++) {
      const y = HORIZON + 0.006 + k * k * 0.0016;
      ctx.beginPath();
      for (let x = -ox / U; x <= RIGHT; x += 0.02) {
        const yy = y + 0.004 * Math.sin(x * 30 + k * 1.7 + t * 0.6);
        x === -ox / U ? ctx.moveTo(X(x), Y(yy)) : ctx.lineTo(X(x), Y(yy));
      }
      ctx.stroke();
    }

    // Mount Fuji: slopes curving in, snow on the peak, dark streaks below it
    const f = FUJI;
    const fp = (u, v) => [X(f.x + u * f.half), Y(HORIZON - v * f.hgt)];
    ctx.beginPath();
    ctx.moveTo(...fp(-1, 0));
    ctx.quadraticCurveTo(...fp(-0.45, 0.3), ...fp(-0.1, 1));
    ctx.lineTo(...fp(0.1, 1));
    ctx.quadraticCurveTo(...fp(0.45, 0.3), ...fp(1, 0));
    ctx.closePath();
    ctx.fillStyle = '#56708c';
    ctx.fill();
    ctx.lineWidth = U * 0.003;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(...fp(-0.1, 1));
    ctx.lineTo(...fp(0.1, 1));
    for (let i = 0; i <= 8; i++) {
      const u = 0.27 - (i / 8) * 0.54;
      ctx.lineTo(...fp(u, i % 2 ? 0.66 : 0.56));
    }
    ctx.closePath();
    ctx.fillStyle = FOAM;
    ctx.fill();
    ctx.stroke();

    // The swell on the right, with its boat
    {
      const hump = portrait
        ? [[[0.78, BOTTOM], [0.82, 0.98], [0.92, 0.9], [1.1, 0.86]], [[1.1, 0.86], [1.2, 0.86], [1.2, 1.0], [1.2, BOTTOM]]]
        : [[[0.98, BOTTOM], [1.05, 0.95], [1.3, 0.84], [1.55, 0.79]], [[1.55, 0.79], [1.75, 0.74], [RIGHT, 0.7], [RIGHT, BOTTOM]]];
      const sw = 0.008 * Math.sin(t * 0.8 + 1);
      smallWave(ctx, hump.map((s) => s.map(([x, y]) => [x, y + sw * (y < 1 ? 1 : 0)])), t, 7, portrait ? 6 : 12);
    }
    for (const b of BOATS) if (b.x > 1.3) drawBoat(ctx, b, t);

    // The great wave
    const wv = shape(t);
    const body = [wv.back, wv.lip, wv.tip, wv.under, wv.barrel, wv.face, wv.trough];
    ctx.save();
    ctx.beginPath();
    trace(ctx, body);
    ctx.lineTo(X(-0.12), Y(BOTTOM));
    ctx.closePath();
    ctx.fillStyle = DEEP;
    ctx.fill();
    ctx.clip();
    // Lines of water sweeping up into the crest, drifting slowly inward
    const drift = (t * 0.012) % 0.045;
    ctx.lineCap = 'round';
    for (let k = 0; k < 16; k++) {
      const d = 0.03 + k * 0.045 + drift;
      ctx.beginPath();
      trace(ctx, [wv.back, wv.lip, wv.tip].map((s) => s.map(([x, y]) => [x + d * 0.35, y + d])));
      ctx.lineWidth = U * (k < 3 ? 0.009 : 0.006);
      ctx.strokeStyle = k < 2 ? PALE : MID;
      ctx.stroke();
    }
    // Along the crest: a pale band, then the white of the breaking water
    ctx.beginPath();
    trace(ctx, [wv.lip, wv.tip, wv.under]);
    ctx.lineWidth = U * 0.07;
    ctx.strokeStyle = MID;
    ctx.stroke();
    ctx.lineWidth = U * 0.036;
    ctx.strokeStyle = PALE;
    ctx.stroke();
    ctx.lineWidth = U * 0.016;
    ctx.strokeStyle = FOAM;
    ctx.stroke();
    // Veins of foam running down the face
    ctx.strokeStyle = FOAM;
    ctx.lineWidth = U * 0.004;
    for (let k = 0; k < 3; k++) {
      const d = 0.06 + k * 0.09;
      ctx.beginPath();
      trace(ctx, [wv.barrel, wv.face].map((s) => s.map(([x, y]) => [x - d * 0.6, y + d * 0.2])));
      ctx.stroke();
    }
    ctx.restore();
    ctx.beginPath();
    trace(ctx, body.slice(0, 6));
    ctx.lineWidth = U * 0.003;
    ctx.strokeStyle = INK;
    ctx.stroke();
    // The claws, flickering: small near the top of the crest, largest where the lip hangs over
    crestPoints(wv, CLAWS.length, CLAWS.map((c) => c.f)).forEach((c, i) => {
      const k = CLAWS[i];
      const len = (0.016 + 0.05 * Math.pow(Math.sin(Math.PI * Math.min(1, c.f * 1.15)), 1.5)) * k.big * (0.75 + 0.5 * (noise2(k.seed, t * 0.7) + 0.5));
      claw(ctx, c.p, c.n, c.t, len, 0.9, U * 0.0025, i);
    });
    for (const b of BOATS) if (b.x <= 1.3 && b.front && !b.near) drawBoat(ctx, b, t);

    // The small wave in front, shaped like the mountain, and a boat half hidden behind it
    for (const b of BOATS) if (!b.front && !b.near) drawBoat(ctx, b, t);
    const rise = 0.015 * Math.sin(t * 0.9);
    const fw = portrait
      ? [[[0.18, 1.14], [0.3, 1.02], [0.36, 0.9], [0.42, 0.87 - rise]], [[0.42, 0.87 - rise], [0.5, 0.9], [0.58, 1.02], [0.7, 1.14]]]
      : [[[0.26, 1.14], [0.38, 1.0], [0.45, 0.84], [0.52, 0.8 - rise]], [[0.52, 0.8 - rise], [0.6, 0.84], [0.68, 1.0], [0.82, 1.14]]];
    smallWave(ctx, fw, t, 3, 9, 0.09);
    if (portrait) {
      const sw = 0.01 * Math.sin(t * 0.7 + 2);
      smallWave(ctx, [[[-0.1, BOTTOM], [-0.05, 1.22], [0.3, 1.1 + sw], [0.6, 1.14 + sw]], [[0.6, 1.14 + sw], [0.85, 1.18], [1.0, 1.06 - sw], [1.12, BOTTOM]]], t, 11, 10);
      for (const b of BOATS) if (b.near) drawBoat(ctx, b, t);
    }

    // Spray
    ctx.fillStyle = '#a9c3d6';
    for (const s of spray) {
      const a = Math.min(1, s.life * 3) * Math.min(1, (s.max - s.life) / 1.5);
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(X(s.x), Y(s.y), s.r * U, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (typeset) typeset.render(ctx0);
  }

  return { update, draw };
}
