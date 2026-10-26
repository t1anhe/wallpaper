// Leviathan — a blue whale passing through the deep, in glyphs.
// The dark is complete. Now and then a whale comes through it, drawn in the light of the plankton
// flaring where water slides along its skin: the long pointed head, the flipper, the slender back with
// its small fin set far behind, and the flukes, whose slow strokes shed swirls of light into a wake
// that hangs in the water after it has gone. The body itself stays dark; only the small glowing
// creatures living on its skin hint at it, twinkling in lines along the mouth and the grooves of the
// throat, in a ring round the eye, in clusters on the head and the flipper. Then the dark comes back. On a phone the whale dives or rises through the picture instead of crossing it.
// Moving the pointer stirs the plankton.
//
// The swimming follows how whales move: the flukes beat up and down; a wave runs back along the body,
// growing towards the tail; the flukes trail the tail stock's angle; the head nods against the stroke;
// each stroke heaves the body and gives a little surge of speed; and the path wanders slowly.
// Rendered as ASCII by default (?ascii=0 for the plain version, ?res=<glyph rows>).
function createLeviathan({ w, h, rng, params }) {
  const { noise2 } = makeNoise(rng);
  const u = Math.min(w, h);
  const portrait = h > w;
  const TAU = Math.PI * 2;
  const lw = (k) => Math.max(1, u * k);
  // In glyphs the scene is sampled about three pixels to a character: small lights must fill a cell
  const glyphs = params.get('ascii') !== '0';
  let now = 0;

  // ---------- the whale, in body units: s from the tip of the snout (0) back to the fluke notch (1), y dorsal ----------
  // Half-heights above and below the spine: the long tapering head, the slender body, the tail stock
  // narrowing to the flukes
  const PROFILE = [
    [0, 0.004, 0.004], [0.03, 0.017, 0.024], [0.08, 0.034, 0.045], [0.15, 0.05, 0.062], [0.22, 0.06, 0.073],
    [0.3, 0.068, 0.079], [0.4, 0.071, 0.077], [0.5, 0.069, 0.069], [0.6, 0.063, 0.057], [0.7, 0.055, 0.045],
    [0.76, 0.049, 0.038], [0.82, 0.04, 0.03], [0.88, 0.028, 0.022], [0.94, 0.017, 0.014], [1, 0.009, 0.008],
  ];
  function profile(s) {
    let i = 0;
    while (i < PROFILE.length - 2 && PROFILE[i + 1][0] < s) i++;
    const [s0, t0, b0] = PROFILE[i], [s1, t1, b1] = PROFILE[i + 1];
    const f = Math.max(0, Math.min(1, (s - s0) / (s1 - s0)));
    const e = f * f * (3 - 2 * f);
    // The small dorsal fin, set far back
    const fin = s > 0.72 && s < 0.8 ? 0.022 * Math.pow(Math.sin(((s - 0.72) / 0.08) * Math.PI), 0.7) * (1 - (s - 0.72) / 0.12) : 0;
    return [t0 + (t1 - t0) * e + fin, b0 + (b1 - b0) * e];
  }

  // ---------- passes: the whale comes through, then the dark for a while ----------
  let whale = null, nextPass = 0;
  const PRESIM = 5; // seconds simulated before the first frame
  function startPass(first) {
    const dir = rng() < 0.5 ? 1 : -1;
    const L = first ? (portrait ? h * 0.5 : w * 0.7) : portrait ? h * (0.42 + rng() * 0.2) : w * (0.5 + rng() * 0.4);
    // Heading: across the picture, or down / up through it on a phone, a little off straight
    const th = portrait ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) + (rng() - 0.5) * 0.12 : (dir > 0 ? 0 : Math.PI) + (rng() - 0.5) * 0.14;
    const span = portrait ? h : w;
    const cross = portrait ? w * (0.44 + rng() * 0.12) : h * (0.38 + rng() * 0.24);
    const enter = -u * 0.05;
    const travel = span + L * 1.2 + u * 0.1;
    const f = [Math.cos(th), Math.sin(th)];
    const head = portrait ? [cross, dir > 0 ? enter : h - enter] : [dir > 0 ? enter : w - enter, cross];
    whale = {
      L, th0: th, th, dir, head, left: travel, side: portrait ? (rng() < 0.5 ? 1 : -1) : 0,
      // About 50-70 s to cross; a stroke every 4-5 s
      v: travel / (50 + rng() * 20), beat: TAU / (4 + rng()), ph: rng() * TAU, wander: rng() * 10,
    };
    if (first) {
      // Begin with the whole whale in the picture (after the few seconds simulated before the first frame)
      const k = (span + L) / 2 - enter - whale.v * PRESIM;
      whale.head = [head[0] + f[0] * k, head[1] + f[1] * k];
      whale.left -= k;
    }
  }
  // Frame of the whale at the moment: forward along the heading, dorsal up on the screen when crossing
  function frame(W) {
    const f = [Math.cos(W.th), Math.sin(W.th)];
    let d = [f[1], -f[0]];
    if (W.side ? W.side < 0 : d[1] > 0) d = [-d[0], -d[1]];
    return { f, d };
  }

  // The body's motion at time t: a travelling wave that grows towards the tail, the head nodding against it
  const AMP = (s) => 0.006 + 0.05 * Math.pow(s, 2.4);
  const bend = (s, t) => AMP(s) * Math.sin(whale.beat * t + whale.ph - 3.6 * s) - 0.005 * Math.sin(whale.beat * t + whale.ph + 0.5);
  let F = { f: [1, 0], d: [0, -1] };
  const toWorld = (s, y) => [whale.head[0] - F.f[0] * s * whale.L + F.d[0] * y * whale.L, whale.head[1] - F.f[1] * s * whale.L + F.d[1] * y * whale.L];
  function edge(s, side, t, off = 0) {
    const [top, bot] = profile(s);
    return toWorld(s, bend(s, t) + (side > 0 ? top + off : -bot - off));
  }
  // The flukes trail the tail stock: their angle follows its slope a quarter beat late, overshooting
  function fluke(t) {
    const e = 0.02, lag = (0.25 * TAU) / whale.beat;
    const slope = (bend(1, t - lag) - bend(1 - e, t - lag)) / e;
    const a = Math.atan(slope * 1.8);
    const y1 = bend(1, t);
    return { a, tip: toWorld(1 + 0.09 * Math.cos(a), y1 + 0.09 * Math.sin(a)), y1 };
  }
  // The flipper, held back and down, sculling a little
  function flipper(t) {
    const fa = -2.6 + 0.08 * Math.sin(whale.beat * t + whale.ph + 1.2);
    const root = [0.27, bend(0.27, t) - profile(0.27)[1] * 0.55];
    const D = [-Math.cos(fa), Math.sin(fa)];
    return (r, o) => toWorld(root[0] + D[0] * r - D[1] * o, root[1] + D[1] * r + D[0] * o);
  }
  function flipperPath(ctx, t) {
    const fp = flipper(t);
    // Root on the flank, a long slender blade swept back to a point
    const a = fp(0, -0.014), b = fp(0.01, 0.01);
    ctx.moveTo(a[0], a[1]);
    ctx.bezierCurveTo(...fp(0.05, -0.02), ...fp(0.11, -0.008), ...fp(0.125, 0));
    ctx.bezierCurveTo(...fp(0.1, 0.008), ...fp(0.04, 0.014), b[0], b[1]);
  }
  function bodyPath(ctx, t) {
    ctx.beginPath();
    const n = 60;
    for (let i = 0; i <= n; i++) {
      const p = edge(i / n, 1, t);
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    }
    const fk = fluke(t);
    const m1 = toWorld(1 + 0.05 * Math.cos(fk.a), fk.y1 + 0.05 * Math.sin(fk.a) + 0.012);
    ctx.quadraticCurveTo(m1[0], m1[1], fk.tip[0], fk.tip[1]);
    const m2 = toWorld(1 + 0.045 * Math.cos(fk.a), fk.y1 + 0.045 * Math.sin(fk.a) - 0.01);
    const back = edge(1, -1, t);
    ctx.quadraticCurveTo(m2[0], m2[1], back[0], back[1]);
    for (let i = n; i >= 0; i--) {
      const p = edge(i / n, -1, t);
      ctx.lineTo(p[0], p[1]);
    }
    const nose = toWorld(-0.006, bend(0, t) - 0.002);
    const top = edge(0, 1, t);
    ctx.quadraticCurveTo(nose[0], nose[1], top[0], top[1]);
    ctx.closePath();
    flipperPath(ctx, t);
    ctx.closePath();
  }

  // ---------- light: plankton flaring along the whale's skin, and in its wake ----------
  // Points flare where the outline is at this moment and stay put in the water, fading, so the outline
  // is redrawn continuously as the whale slides past; off the flukes they spin away in the wake.
  const lights = []; // { x, y, vx, vy, spin, age, life, a }
  const snow = Array.from({ length: Math.round((w * h) / 9000) }, () => ({
    x: rng() * w, y: rng() * h, s: 1 + rng() * 1.2, v: 0.004 + rng() * 0.01, p: rng() * 10, a: rng() < 0.25 ? 0.09 + rng() * 0.07 : 0.035,
  }));
  let nextFlash = 8, lastPX = null, lastPY = null, lastFluke = null;
  // How brightly the water glows along the body: the snout pushes hardest, then the flipper and flukes
  const glowAt = (s) => 0.32 + 0.4 * Math.exp(-s / 0.06) + 0.3 * Math.exp(-(((s - 0.27) / 0.04) ** 2)) + 0.25 * s * s;

  function update(dt, t, input) {
    now = t;
    for (const s of snow) {
      s.y += s.v * u * dt;
      s.x += Math.sin(t * 0.3 + s.p) * u * 0.002 * dt;
      if (s.y > h + 4) { s.y = -4; s.x = rng() * w; }
    }
    if (!whale && t > nextPass) startPass(false);
    if (whale) {
      const W = whale;
      // The path wanders a little; each stroke gives a small surge
      W.th = W.th0 + 0.06 * Math.sin(t * 0.045 + W.wander) + 0.025 * Math.sin(t * 0.11 + W.wander * 2);
      F = frame(W);
      const surge = 1 + 0.12 * Math.sin(2 * (W.beat * t + W.ph) - 0.8);
      const heave = 0.006 * W.L * W.beat * Math.cos(W.beat * t + W.ph - 1.4) * dt;
      const step = W.v * surge * dt;
      W.head = [W.head[0] + F.f[0] * step + F.d[0] * heave, W.head[1] + F.f[1] * step + F.d[1] * heave];
      W.left -= step;
      // Light along the outline: a steady number of points per unit of length
      const per = (W.L / u) * 1400 * dt;
      for (let k = 0; k < per; k++) {
        const s = rng();
        if (rng() > glowAt(s) / 1.0) continue;
        const side = rng() < 0.55 ? 1 : -1;
        const [x, y] = edge(s, side, t, 0.003 + rng() * 0.008);
        lights.push({ x, y, vx: 0, vy: 0, spin: 0, age: 0, life: 0.6 + rng() * 0.8, a: Math.min(1, glowAt(s)) * (0.6 + rng() * 0.4) });
      }
      // The front of the head and the flipper's edge, outlined too
      for (let k = 0; k < per * 0.02; k++) {
        const v = rng();
        const top = edge(0, 1, t), bot = edge(0, -1, t), nose = toWorld(-0.006, bend(0, t) - 0.002);
        const q = (1 - v) * (1 - v), r = 2 * (1 - v) * v, z = v * v;
        lights.push({ x: q * bot[0] + r * nose[0] + z * top[0], y: q * bot[1] + r * nose[1] + z * top[1], vx: 0, vy: 0, spin: 0, age: 0, life: 0.6 + rng() * 0.8, a: 0.6 });
      }
      const fp = flipper(t);
      for (let k = 0; k < per * 0.05; k++) {
        const [x, y] = fp(rng() * 0.12, (rng() - 0.5) * 0.024);
        lights.push({ x, y, vx: 0, vy: 0, spin: 0, age: 0, life: 0.5 + rng() * 0.6, a: 0.55 });
      }
      // Each stroke of the flukes sheds light that spins off into the wake
      const fk = fluke(t);
      if (lastFluke) {
        const sweep = Math.hypot(fk.tip[0] - lastFluke[0], fk.tip[1] - lastFluke[1]) / dt;
        const n = (sweep / u) * 260 * dt;
        for (let k = 0; k < n; k++) {
          const f = rng();
          const x = lastFluke[0] + (fk.tip[0] - lastFluke[0]) * f, y = lastFluke[1] + (fk.tip[1] - lastFluke[1]) * f;
          const sp = u * (0.004 + rng() * 0.014), a = rng() * TAU;
          lights.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, spin: (rng() < 0.5 ? -1 : 1) * (0.4 + rng() * 0.8), age: 0, life: 3 + rng() * 4, a: 0.35 + rng() * 0.35 });
        }
      }
      lastFluke = fk.tip;
      if (W.left < 0) {
        whale = null;
        lastFluke = null;
        nextPass = t + 14 + rng() * 18;
      }
    }
    // The pointer stirs the plankton too
    if (input && input.active) {
      if (lastPX !== null) {
        const d = Math.hypot(input.x - lastPX, input.y - lastPY);
        for (let k = 0; k < Math.min(6, d / (u * 0.015)); k++) {
          const f = rng();
          lights.push({ x: lastPX + (input.x - lastPX) * f + (rng() - 0.5) * u * 0.03, y: lastPY + (input.y - lastPY) * f + (rng() - 0.5) * u * 0.03, vx: 0, vy: 0, spin: 0, age: 0, life: 1 + rng(), a: 0.5 });
        }
      }
      lastPX = input.x;
      lastPY = input.y;
    } else lastPX = null;
    // A rare, faint flicker somewhere far off
    if (t > nextFlash) {
      const cx = w * (0.1 + rng() * 0.8), cy = h * (0.1 + rng() * 0.8);
      for (let k = 0; k < 3 + Math.floor(rng() * 4); k++) {
        lights.push({ x: cx + (rng() - 0.5) * u * 0.04, y: cy + (rng() - 0.5) * u * 0.04, vx: 0, vy: 0, spin: 0, age: -rng() * 0.6, life: 1.6 + rng(), a: 0.3 });
      }
      nextFlash = t + 10 + rng() * 14;
    }
    for (let i = lights.length - 1; i >= 0; i--) {
      const p = lights[i];
      p.age += dt;
      if (p.age > p.life) {
        lights.splice(i, 1);
        continue;
      }
      if (p.vx || p.vy) {
        // Wake: slowing, curling round
        const k = Math.pow(0.6, dt), c = Math.cos(p.spin * dt), s = Math.sin(p.spin * dt);
        const vx = (p.vx * c - p.vy * s) * k, vy = (p.vx * s + p.vy * c) * k;
        p.vx = vx;
        p.vy = vy;
        p.x += vx * dt;
        p.y += vy * dt;
      }
    }
  }

  // Flare quickly, fade slowly
  const env = (p) => (p.age < 0 ? 0 : Math.min(1, p.age / 0.06) * Math.pow(1 - p.age / p.life, 1.4) * p.a);

  function backdrop(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#01070d');
    g.addColorStop(1, '#000206');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  // A soft halo, drawn once and stamped under every point of light
  const halo = document.createElement('canvas');
  const HR = Math.max(4, Math.round(u * 0.012));
  halo.width = halo.height = HR * 2;
  {
    const x = halo.getContext('2d');
    const g = x.createRadialGradient(HR, HR, 0, HR, HR, HR);
    g.addColorStop(0, 'rgba(110,230,255,0.35)');
    g.addColorStop(1, 'rgba(110,230,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, HR * 2, HR * 2);
  }

  // The faint glow of the water sliding along the skin: a line around the body, brightest at the snout,
  // flickering along its length
  function drawSheath(ctx, t) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgb(110,225,250)';
    const n = 90;
    for (const side of [1, -1]) {
      const pts = [];
      for (let i = 0; i <= n; i++) pts.push(edge(i / n, side, t, 0.002));
      for (const [width, k] of [[0.01, 0.16], [0.0038, 1]]) {
        ctx.lineWidth = lw(width);
        for (let i = 1; i <= n; i++) {
          const s = i / n;
          ctx.globalAlpha = k * Math.min(1, 0.3 + 0.45 * glowAt(s)) * (0.7 + 0.3 * noise2(s * 9 + side * 5, t * 0.8));
          ctx.beginPath();
          ctx.moveTo(pts[i - 1][0], pts[i - 1][1]);
          ctx.lineTo(pts[i][0], pts[i][1]);
          ctx.stroke();
        }
      }
    }
    ctx.lineWidth = lw(0.003);
    // The front of the head, the flukes and the flipper
    ctx.globalAlpha = 0.75;
    const top = edge(0, 1, t, 0.002), bot = edge(0, -1, t, 0.002), nose = toWorld(-0.006, bend(0, t) - 0.002);
    ctx.beginPath();
    ctx.moveTo(bot[0], bot[1]);
    ctx.quadraticCurveTo(nose[0], nose[1], top[0], top[1]);
    ctx.stroke();
    ctx.globalAlpha = 0.45;
    const fk = fluke(t), a = edge(1, 1, t), b = edge(1, -1, t);
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(fk.tip[0], fk.tip[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.stroke();
    ctx.beginPath();
    flipperPath(ctx, t);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Small glowing creatures living on the skin, the only sign of the body in the dark. Each sits at a
  // fixed place on the whale (body units) and twinkles slowly on its own.
  const riders = [];
  const rider = (place, a) => riders.push({ place, a, p: rng() * TAU, v: 0.4 + rng() * 0.9 });
  // Along the mouth, from the tip of the snout back to below the eye
  for (let i = 0; i < 26; i++) {
    const s = 0.01 + (i / 25) * 0.2 + (rng() - 0.5) * 0.006;
    if (rng() < 0.8) rider({ s, y: -0.004 - 0.016 * Math.sin((s / 0.214) * Math.PI * 0.85) }, 0.55 + rng() * 0.35);
  }
  // In the long grooves of the throat, sparse, fading towards the navel
  for (let k = 0; k < 8; k++) {
    const s0 = 0.04 + k * 0.012, s1 = 0.48 - k * 0.018, depth = 0.25 + k * 0.08;
    for (let i = 0; i < 14; i++) {
      const s = s0 + rng() * (s1 - s0);
      if (rng() < 0.35 + 0.5 * (1 - (s - s0) / (s1 - s0))) rider({ s, groove: depth, s0 }, 0.3 + rng() * 0.35);
    }
  }
  // A ring round the eye
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    rider({ s: 0.232 + Math.cos(a) * 0.006, y: -0.001 + Math.sin(a) * 0.0045 }, 0.7);
  }
  // Clusters on the head (behind the blowhole, along the rostrum) and scattered over the back
  for (const [cs, cy, n] of [[0.07, 0.6, 7], [0.13, 0.8, 9], [0.2, 0.85, 6], [0.42, 0.5, 5], [0.58, 0.3, 4]]) {
    for (let i = 0; i < n; i++) rider({ s: cs + (rng() - 0.5) * 0.03, f: cy + (rng() - 0.5) * 0.3 }, 0.35 + rng() * 0.4);
  }
  for (let i = 0; i < 22; i++) rider({ s: 0.25 + rng() * 0.6, f: rng() * 1.6 - 0.6 }, 0.15 + rng() * 0.25);
  // Along the leading edge of the flipper and on its tip
  for (let i = 0; i < 12; i++) rider({ flip: [0.01 + rng() * 0.115, -0.012 + rng() * 0.008] }, 0.4 + rng() * 0.4);

  function riderAt(r, t) {
    const q = r.place;
    if (q.flip) return flipper(t)(q.flip[0], q.flip[1]);
    let y;
    if (q.groove !== undefined) y = -profile(q.s)[1] * (1 - q.groove * Math.sin(Math.min(1, (q.s - q.s0) / 0.06) * Math.PI / 2));
    else if (q.f !== undefined) y = q.f > 0 ? q.f * profile(q.s)[0] : q.f * profile(q.s)[1];
    else y = q.y;
    return toWorld(q.s, bend(q.s, t) + y);
  }
  function drawRiders(ctx, t) {
    const dot = glyphs ? 2.6 : lw(0.0022), hs = glyphs ? 0.8 : 0.6;
    for (const r of riders) {
      const a = Math.min(1, r.a * (glyphs ? 1.35 : 1)) * (0.45 + 0.55 * Math.max(0, Math.sin(t * r.v + r.p)));
      if (a < 0.04) continue;
      const [x, y] = riderAt(r, t);
      ctx.globalAlpha = a * 0.8;
      ctx.drawImage(halo, x - HR * hs, y - HR * hs, HR * 2 * hs, HR * 2 * hs);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgb(190,250,240)';
      ctx.fillRect(x - dot / 2, y - dot / 2, dot, dot);
    }
    ctx.globalAlpha = 1;
  }

  // Begin with the whale in the picture and a little history behind it
  startPass(true);
  for (let i = 0; i < PRESIM * 30; i++) update(1 / 30, i / 30, null);

  function draw(ctx, layered) {
    if (layered) ctx.clearRect(0, 0, w, h);
    else backdrop(ctx);
    // Marine snow, almost invisible
    for (const s of snow) {
      ctx.fillStyle = `rgba(190,225,240,${s.a})`;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    // The body blots out the snow behind it
    if (whale) {
      if (layered) ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = layered ? '#000' : '#01050a';
      bodyPath(ctx, now);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalCompositeOperation = 'lighter';
    if (whale) drawSheath(ctx, now);
    if (whale) drawRiders(ctx, now);
    const dot = lw(0.0032);
    for (const p of lights) {
      const a = env(p);
      if (a < 0.02) continue;
      ctx.globalAlpha = a;
      ctx.drawImage(halo, p.x - HR, p.y - HR);
      ctx.fillStyle = 'rgb(200,250,255)';
      ctx.fillRect(p.x - dot / 2, p.y - dot / 2, dot, dot);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  return { update, draw, drawBackground: backdrop };
}
createLeviathan.ascii = true;
createLeviathan.asciiRes = 170;
