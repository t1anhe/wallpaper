// Bloom — a lit window at night, buried in white blossoms, rendered like a cross-stitch.
// The scene is drawn at one pixel per stitch, snapped to a fixed set of thread colours,
// then scaled up under an aida-cloth texture. Vines are grown fresh on every load.
// Params: ?res=<stitches across the short side, default 150>
function createBloom({ w, h, rng, params }) {
  const { noise2, fbm } = makeNoise(rng);
  const mk = (cw, ch) => {
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    return c;
  };
  const sm = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const rampRGB = (stops, t) => {
    t = Math.min(1, Math.max(0, t)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(t));
    return lerp(stops[i], stops[i + 1], t - i);
  };

  const THREADS = [
    '#111a19', '#162322', '#1c2b29', '#223431', // night
    '#1b3226', '#22402f', '#2d5237', '#3b6743', '#517f55', '#6e9a69', // leaves
    '#4b5650', '#6c7771', '#8a928c', '#a8afa9', '#c5cac4', '#dfe3dd', '#f1f2ed', '#ffffff', // greys & whites
    '#ecc6a3', '#d59872', // blossom centres
    '#fff0b4', '#f7cb5d', '#ea9b3d', '#b7612d', '#723b24', '#4a2a22', // lamplight
  ];
  const S = makeStitch(w, h, +params.get('res') || 150, THREADS);
  const { cs, cols, rows } = S;
  const sx = S.ctx;
  const portrait = rows > cols;

  // ---------- layout (all in stitches) ----------
  const F = Math.round(Math.min(cols * 0.66, rows * (portrait ? 0.42 : 0.6)));
  const fx = Math.round(portrait ? cols * 0.53 - F / 2 : cols * 0.36 - F / 2);
  const fy = Math.round(portrait ? rows * 0.43 : rows * 0.52 - F * 0.45);
  const X = (a) => fx + a * F;
  const Y = (b) => fy + b * F;
  const glass = { x0: Math.round(X(0.24)), y0: Math.round(Y(0.15)), x1: Math.round(X(0.66)), y1: Math.round(Y(0.8)) };
  const gw = glass.x1 - glass.x0, gh = glass.y1 - glass.y0;
  const mid = Math.round((glass.x0 + glass.x1) / 2);
  const bar = Math.round(glass.y0 + gh * 0.46);
  const barW = Math.max(1, Math.round(F * 0.022));
  const glowC = { x: mid, y: glass.y0 + (bar - glass.y0) * 0.58 };

  // ---------- static layer: night foliage, distant blossoms, the window casing ----------
  const stat = mk(cols, rows);
  const st = stat.getContext('2d');
  {
    const img = st.createImageData(cols, rows);
    const A = hexToRgb('#1b2928'), B = hexToRgb('#0f1716'), LEAF = hexToRgb('#1f3a2b'), LIT = hexToRgb('#2b4b35');
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let c = lerp(A, B, Math.min(1, (y / rows) * 0.7 + (x / cols) * 0.3));
        const mass = fbm(x * 0.035 + 3, y * 0.035, 4);
        if (mass > -0.04) {
          c = lerp(c, LEAF, sm(-0.04, 0.22, mass));
          const leafy = noise2(x * 0.28, y * 0.28);
          if (leafy > 0.25) c = lerp(c, LIT, sm(0.25, 0.6, leafy) * sm(0, 0.3, mass));
        }
        const i = (y * cols + x) * 4;
        img.data[i] = c[0];
        img.data[i + 1] = c[1];
        img.data[i + 2] = c[2];
        img.data[i + 3] = 255;
      }
    }
    st.putImageData(img, 0, 0);
    // Faint blossoms deep in the dark
    for (let i = 0; i < (cols * rows) / 180; i++) {
      const x = rng() * cols, y = rng() * rows;
      if (fbm(x * 0.035 + 3, y * 0.035, 4) < 0) continue;
      st.fillStyle = `rgba(110,124,116,${0.25 + rng() * 0.35})`;
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        st.beginPath();
        st.arc(x + Math.cos(a) * 0.9, y + Math.sin(a) * 0.9, 0.7, 0, Math.PI * 2);
        st.fill();
      }
    }

    // Window casing
    st.fillStyle = '#c3c8c1';
    st.fillRect(X(0), Y(0), F, F * 0.9);
    let g = st.createLinearGradient(X(0), 0, X(1), 0);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.38)');
    st.fillStyle = g;
    st.fillRect(X(0), Y(0), F, F * 0.9);
    st.fillStyle = 'rgba(0,0,0,0.45)';
    st.fillRect(X(0), Y(0), F, F * 0.1);
    st.fillStyle = '#e6e9e3'; // sunlit left pillar
    st.fillRect(X(0.02), Y(0.07), F * 0.13, F * 0.8);
    g = st.createLinearGradient(0, Y(0.09), 0, Y(0.84));
    g.addColorStop(0, '#5d655f');
    g.addColorStop(1, '#8a928b');
    st.fillStyle = g; // deep recess around the glass
    st.fillRect(X(0.15), Y(0.09), F * 0.57, F * 0.75);
    st.fillStyle = '#a2a9a2';
    st.fillRect(X(0.66), Y(0.12), F * 0.06, F * 0.7);
    // Sill: bright top face, grey front, shadow beneath
    st.fillStyle = '#eef0eb';
    st.beginPath();
    st.moveTo(X(-0.05), Y(0.84));
    st.lineTo(X(1.03), Y(0.84));
    st.lineTo(X(0.99), Y(0.93));
    st.lineTo(X(-0.01), Y(0.93));
    st.fill();
    st.fillStyle = '#a5aba4';
    st.fillRect(X(-0.01), Y(0.93), F, F * 0.05);
    st.fillStyle = 'rgba(0,0,0,0.45)';
    st.fillRect(X(0), Y(0.98), F, F * 0.04);
  }

  // ---------- vines ----------
  const strands = [];
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  function grow(x, y, ang, len, bias, depth, amp0) {
    const pts = [];
    let a = ang;
    for (let i = 0; i < len; i++) {
      pts.push([x, y, a]);
      a += noise2(x * 0.05 + depth * 7, y * 0.05) * 0.22 + (rng() - 0.5) * 0.12 + wrap(bias - a) * 0.035;
      x += Math.cos(a) * 0.9;
      y += Math.sin(a) * 0.9;
    }
    const s = { pts, phase: rng() * 10, amp0, depth, gust: 0 };
    strands.push(s);
    if (depth < 2) {
      for (let i = 6; i < len - 6; i += 5 + Math.floor(rng() * 9)) {
        if (rng() > 0.55) continue;
        const side = rng() < 0.5 ? -1 : 1;
        grow(pts[i][0], pts[i][1], pts[i][2] + side * (0.5 + rng() * 0.8), Math.round(len * (0.25 + rng() * 0.35)),
          pts[i][2] + side * 0.9 + 0.5, depth + 1, amp0 + i * 0.012);
      }
    }
  }
  const up = -Math.PI / 2;
  const roots = [
    [X(0.02), Y(0.9), up - 0.3, 2.3, up + 0.7],
    [X(0.1), Y(0.04), -0.3, 1.9, up + 0.9],
    [cols + 2, -2, 2.3, 1.7, Math.atan2(Y(0.1) + 2, X(0.6) - cols)],
    [X(0.95), Y(0.4), up + 0.6, 1.4, up + 0.8],
    [X(0.45), Y(0.88), Math.PI - 0.3, 0.9, Math.PI * 0.75],
    [X(0.75), Y(0.88), 0.3, 0.8, Math.PI * 0.3],
    [X(-0.25), Y(1.35), up + 0.2, 1.1, up + 0.4],
    [X(0.3), Y(0.05), up, 1.5, up + 0.5],
  ];
  if (!portrait) roots.push([X(1.0), Y(0.1), -0.1, 2.2, 0.15], [X(1.1), Y(0.85), up + 0.4, 1.6, -0.3], [cols * 0.85, -2, 2, 1.4, 1.9]);
  for (const [x, y, a, len, bias] of roots) grow(x, y, a, Math.round(len * F * 0.8), bias, 0, 0.1);

  // Blossoms cluster around the window and along a diagonal sweep to the top-right.
  const density = (x, y) => {
    const dw = Math.hypot((x - X(0.45)) / F, (y - Y(0.35)) / F);
    const ax = X(0.5), ay = Y(0.2), bx = cols, by = 0;
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)));
    const db = Math.hypot(x - (ax + (bx - ax) * t), y - (ay + (by - ay) * t)) / F;
    return Math.min(1, 0.1 + 0.75 * Math.exp(-dw * dw * 1.6) + 0.6 * Math.exp(-db * db * 10));
  };

  // Sprites (one pixel per stitch): blossoms and leaves in a few sizes, angles and tones.
  const flowerSprites = [];
  for (const size of [1.5, 2, 2.6]) {
    for (const rot of [0, 0.63]) {
      for (const tone of ['#f7f7f2', '#cdd2cb']) {
        const S = Math.ceil(size * 2.4) + 2;
        const c = mk(S, S), x = c.getContext('2d');
        for (let k = 0; k < 5; k++) {
          const a = rot + (k / 5) * Math.PI * 2;
          x.fillStyle = Math.sin(a) > 0.3 ? (tone === '#f7f7f2' ? '#e2e5df' : '#b4bab3') : tone;
          x.beginPath();
          x.arc(S / 2 + Math.cos(a) * size * 0.58, S / 2 + Math.sin(a) * size * 0.58, size * 0.5, 0, Math.PI * 2);
          x.fill();
        }
        x.fillStyle = tone === '#f7f7f2' ? '#e8b78c' : '#b98a6b';
        x.beginPath();
        x.arc(S / 2, S / 2, size * 0.32, 0, Math.PI * 2);
        x.fill();
        flowerSprites.push({ c, S, bright: tone === '#f7f7f2' });
      }
    }
  }
  const LEAVES = ['#22402f', '#2d5237', '#3b6743', '#517f55'];
  const leafSprite = new Map();
  const getLeaf = (rotB, col, len) => {
    const k = `${rotB}|${col}|${len}`;
    if (leafSprite.has(k)) return leafSprite.get(k);
    const S = len + 3;
    const c = mk(S, S), x = c.getContext('2d');
    x.fillStyle = LEAVES[col];
    x.beginPath();
    x.ellipse(S / 2, S / 2, len / 2, 0.75, (rotB / 8) * Math.PI, 0, Math.PI * 2);
    x.fill();
    const v = { c, S };
    leafSprite.set(k, v);
    return v;
  };

  const flowers = [], leaves = [];
  strands.forEach((s, si) => {
    s.pts.forEach(([x, y, a], i) => {
      if (i % 3 === 0 && rng() < 0.5) {
        const side = rng() < 0.5 ? -1 : 1, off = 0.8 + rng() * 1.2;
        const rot = a + side * (0.6 + rng() * 0.5);
        leaves.push({
          si, i, ox: -Math.sin(a) * side * off, oy: Math.cos(a) * side * off,
          spr: getLeaf(((Math.round((rot / Math.PI) * 8) % 8) + 8) % 8, Math.floor(rng() * LEAVES.length), 2 + Math.floor(rng() * 3)),
        });
      }
      const d = density(x, y);
      const overGlass = x > glass.x0 + 2 && x < glass.x1 - 2 && y > glass.y0 + 2 && y < glass.y1 - 2;
      if (i % 5 === 0 && rng() < d * (overGlass ? 0.12 : 0.5)) {
        const n = 1 + Math.floor(rng() * 3.5 * d);
        for (let k = 0; k < n; k++) {
          const lit = Math.hypot(x - glowC.x, y - glowC.y) < F * (0.7 + rng() * 0.5);
          const sizeIdx = Math.floor(rng() * 3), rotIdx = Math.floor(rng() * 2);
          flowers.push({
            si, i, ox: (rng() - 0.5) * 5, oy: (rng() - 0.5) * 5,
            spr: flowerSprites[sizeIdx * 4 + rotIdx * 2 + (lit || rng() < 0.6 ? 0 : 1)],
          });
        }
      }
    });
  });
  // Front-most blossoms last
  flowers.sort((a, b) => a.spr.S - b.spr.S);

  // ---------- render targets ----------
  const glassImg = sx.createImageData(gw, gh);
  const GLOW = ['#141f1b', '#4a2a22', '#8a4526', '#d07f35', '#f3b850', '#ffe9a6', '#fffbe6'].map(hexToRgb);
  const DARKG = hexToRgb('#131d1a'), LACE = hexToRgb('#5f6a64');
  // ---------- animation ----------
  let now = 0, flick = 1, px = -1e9, py = -1e9;
  const petals = [];
  const pos = (e) => {
    const s = strands[e.si];
    const [x, y] = s.pts[e.i];
    const a = Math.min(1.8, s.amp0 + e.i * 0.012);
    let ex = x + e.ox + s.gust * a, ey = y + e.oy + Math.abs(s.gust) * a * 0.25;
    const d = Math.hypot(ex - px, ey - py);
    if (d < 14) {
      const k = (1 - d / 14) * 2.5;
      ex += ((ex - px) / (d || 1)) * k;
      ey += ((ey - py) / (d || 1)) * k;
    }
    return [ex, ey];
  };

  function update(dt, t, input) {
    now = t;
    flick = 0.88 + 0.12 * noise2(t * 2.2, 0.5) + 0.04 * Math.sin(t * 13);
    for (const s of strands) s.gust = Math.sin(t * 0.8 + s.phase) * 0.45 + noise2(t * 0.25, s.phase) * 1.1;
    px = input.active ? input.x / cs : -1e9;
    py = input.active ? input.y / cs : -1e9;
    if (flowers.length && rng() < dt * 1.6) {
      const [x, y] = pos(flowers[Math.floor(rng() * flowers.length)]);
      petals.push({ x, y, age: 0, p: rng() * 10, v: 2.5 + rng() * 2.5 });
    }
    for (let i = petals.length - 1; i >= 0; i--) {
      const p = petals[i];
      p.age += dt;
      p.y += p.v * dt;
      p.x += (Math.sin(p.age * 2.2 + p.p) * 1.6 + 0.4) * dt;
      if (p.y > rows + 2) petals.splice(i, 1);
    }
  }

  function draw(ctx) {
    const t = now;
    sx.globalCompositeOperation = 'source-over';
    sx.drawImage(stat, 0, 0);

    // Glass: lamplight flickering behind the upper panes, a lace curtain below
    for (let y = 0; y < gh; y++) {
      for (let x = 0; x < gw; x++) {
        const u = glass.x0 + x + 0.5, v = glass.y0 + y + 0.5;
        let c;
        if (v < bar) {
          const d = Math.hypot((u - glowC.x) / (gw * 0.46), (v - glowC.y) / ((bar - glass.y0) * 0.8));
          const flame = fbm(u * 0.16, v * 0.16 - t * 0.5, 3);
          c = rampRGB(GLOW, ((1 - d) * 1.25 + flame * 0.55) * flick);
        } else {
          const pane = u < mid ? glass.x0 + gw * 0.25 : glass.x0 + gw * 0.75;
          const dx = u - pane, dy = (v - (bar + gh * 0.27)) * 1.1, rr = Math.hypot(dx, dy);
          // Doily: scalloped rings broken into petals, fading out toward the pane edges
          const lace = rr < gw * 0.21 && Math.sin(rr * 2.3) * Math.cos(Math.atan2(dy, dx) * 7 + rr * 0.4) > 0.3;
          const spill = Math.max(0, 1 - (v - bar) / (gh * 0.4)) * 0.18 * flick;
          c = lerp(lace ? LACE : DARKG, GLOW[3], spill);
        }
        const i = (y * gw + x) * 4;
        glassImg.data[i] = c[0];
        glassImg.data[i + 1] = c[1];
        glassImg.data[i + 2] = c[2];
        glassImg.data[i + 3] = 255;
      }
    }
    sx.putImageData(glassImg, glass.x0, glass.y0);
    sx.fillStyle = '#0f1613';
    sx.fillRect(mid - (barW >> 1), glass.y0, barW, gh);
    sx.fillRect(glass.x0, bar, gw, barW);
    sx.strokeStyle = '#0d1411';
    sx.lineWidth = 1;
    sx.strokeRect(glass.x0 + 0.5, glass.y0 + 0.5, gw - 1, gh - 1);

    // Stems, leaves, blossoms
    sx.strokeStyle = '#2a4630';
    sx.lineWidth = 0.8;
    sx.beginPath();
    for (const s of strands) {
      for (let i = 0; i < s.pts.length; i += 2) {
        const [x, y] = pos({ si: strands.indexOf(s), i, ox: 0, oy: 0 });
        i === 0 ? sx.moveTo(x, y) : sx.lineTo(x, y);
      }
    }
    sx.stroke();
    for (const l of leaves) {
      const [x, y] = pos(l);
      sx.drawImage(l.spr.c, x - l.spr.S / 2, y - l.spr.S / 2);
    }
    for (const f of flowers) {
      const [x, y] = pos(f);
      sx.drawImage(f.spr.c, x - f.spr.S / 2, y - f.spr.S / 2);
    }

    // A moth circling the lamplight
    const mx = glowC.x + noise2(t * 0.9, 3) * F * 0.45, my = glowC.y + noise2(5, t * 0.9) * F * 0.3 - F * 0.05;
    sx.fillStyle = '#d8cfb6';
    const flap = Math.sin(t * 30) > 0 ? 1 : 0;
    sx.fillRect(Math.round(mx) - flap, Math.round(my), 1 + flap * 2, 1);

    for (const p of petals) {
      sx.fillStyle = `rgba(244,244,238,${Math.min(1, p.age * 2)})`;
      sx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }

    // Warm spill from the window and a soft vignette
    sx.globalCompositeOperation = 'lighter';
    let g = sx.createRadialGradient(glowC.x, glowC.y + F * 0.2, 0, glowC.x, glowC.y + F * 0.2, F * 0.8);
    g.addColorStop(0, `rgba(255,160,70,${0.16 * flick})`);
    g.addColorStop(1, 'rgba(255,160,70,0)');
    sx.fillStyle = g;
    sx.fillRect(0, 0, cols, rows);
    sx.globalCompositeOperation = 'source-over';
    g = sx.createRadialGradient(cols / 2, rows / 2, Math.min(cols, rows) * 0.35, cols / 2, rows / 2, Math.hypot(cols, rows) * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.5)');
    sx.fillStyle = g;
    sx.fillRect(0, 0, cols, rows);

    S.render(ctx);
  }

  return { update, draw };
}
