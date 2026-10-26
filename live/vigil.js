// Vigil — a construction site out on the farmland at night, seen from a high window across the fields.
// A half-built tower stands in the moonlight beside its crane. Sodium lamps on the site light its lower
// floors from below, warm against the cold fields, and higher up it fades into a dark frame against the
// sky, where the red warning lights on the roof and the crane blink slowly, on and off, all night.
// In the workers' huts a few windows are still lit. Behind the site a country road lined with poplars
// crosses the fields, and now and then a car's lights slide along it between the trees.
//
// It is a small 3D world. The site is ray-cast once, lit by the moon, the sky and the lamps with real
// shadows (the open frame throws a lattice of shadow across the field); the ground is mapped and lit
// once; the crane, the cars, the clouds and the lights move.
// Rendered as ASCII by default (?ascii=0 for the plain version, ?res=<glyph rows>).
function createVigil({ w, h, rng }) {
  const { noise2, fbm } = makeNoise(rng);
  const u = Math.min(w, h);
  const portrait = h > w;
  const TAU = Math.PI * 2;
  const lw = (k) => Math.max(1, u * k);
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const sm = (e0, e1, x) => {
    const k = clamp01((x - e0) / (e1 - e0));
    return k * k * (3 - 2 * k);
  };
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a) => {
    const l = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / l, a[1] / l, a[2] / l];
  };
  const mk = (cw, ch) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cw));
    c.height = Math.max(1, Math.round(ch));
    return c;
  };
  let now = 0;

  // ---------- camera: a window 22 m up, looking out over the fields. X right, Y up, Z away ----------
  const EYE = 22;
  const hy = Math.round(h * (portrait ? 0.62 : 0.6)); // horizon = eye level
  const F = h * (portrait ? 1.08 : 1.9);
  const sx0 = w * (portrait ? 0.6 : 0.36);
  const project = (p) => [sx0 + (F * p[0]) / p[2], hy - (F * (p[1] - EYE)) / p[2], p[2]];

  // ---------- light ----------
  const MOON = norm([0.62, 0.55, 0.42]); // towards the moon: high on the right, out of frame
  const MOON_C = [0.13, 0.155, 0.21];
  const SKY_C = [0.035, 0.045, 0.075]; // fill from the whole sky
  const SODIUM = [1, 0.5, 0.18];
  const EXPOSE = 5;
  const tone = (v) => 255 * (1 - Math.exp(-v * EXPOSE));

  // ---------- the site, in its own frame: x along the long face, z into the building ----------
  const NX = 10, NZ = 3, BAY = 4.8, FH = 3.2, FLOORS = 16;
  const W = NX * BAY, D = NZ * BAY, TOP = FLOORS * FH;
  const TH = -0.3; // the long face turns away to the left
  const ux = [Math.cos(TH), 0, Math.sin(TH)], uz = [-Math.sin(TH), 0, Math.cos(TH)];
  const B = [-44, 0, 200];
  const L2W = (x, y, z) => [B[0] + ux[0] * x + uz[0] * z, y, B[2] + ux[2] * x + uz[2] * z];
  const toLocal = (p) => {
    const dx = p[0] - B[0], dz = p[2] - B[2];
    return [dx * ux[0] + dz * ux[2], p[1], dx * uz[0] + dz * uz[2]];
  };
  const dirLocal = (d) => [d[0] * ux[0] + d[2] * ux[2], d[1], d[0] * uz[0] + d[2] * uz[2]];
  const MOON_L = dirLocal(MOON);
  const CAM_L = toLocal([0, EYE, 0]);

  const boxes = [];
  const box = (a, b, kind, alb) => boxes.push({ a, b, kind, alb: alb || [0.58, 0.58, 0.6].map((v) => v * (0.92 + rng() * 0.12)) });
  // Slabs first: they shadow the most, so shadow rays stop early. The top one is half poured.
  for (let f = 1; f <= FLOORS; f++) box([-0.4, f * FH - 0.3, -0.4], [(f === FLOORS ? W * 0.55 : W) + 0.4, f * FH, D + 0.4], 0);
  // The lift and stair core, poured ahead of the floors, stands above the roof
  const core = { a: [W * 0.42, 0, D * 0.3], b: [W * 0.42 + 6.4, TOP + 3.6, D * 0.3 + 7] };
  box(core.a, core.b, 5, [0.5, 0.51, 0.54]);
  // Columns; on the top floor some are still a storey short
  const colTop = [];
  for (let i = 0; i <= NX; i++) {
    for (let j = 0; j <= NZ; j++) {
      const top = i * BAY > W * 0.55 && rng() < 0.45 ? TOP - FH : TOP;
      colTop.push([i * BAY, top, j * BAY]);
      box([i * BAY - 0.3, 0, j * BAY - 0.3], [i * BAY + 0.3, top, j * BAY + 0.3], 0);
    }
  }
  // Brick infill on the lowest floors, with window openings
  for (let f = 0; f < 3; f++) {
    for (let i = 0; i < NX; i++) if (rng() < 0.75) box([i * BAY, f * FH, -0.12], [(i + 1) * BAY, (f + 1) * FH - 0.3, 0.12], 1, [0.5, 0.3, 0.23]);
    for (let j = 0; j < NZ; j++) if (rng() < 0.75) box([W - 0.12, f * FH, j * BAY], [W + 0.12, (f + 1) * FH - 0.3, (j + 1) * BAY], 1, [0.5, 0.3, 0.23]);
  }
  // Formwork boards along the edge of the half-poured slab
  box([0, TOP - 1.1, -0.62], [W * 0.55, TOP - 0.3, -0.45], 3, [0.5, 0.38, 0.24]);
  // The fence of blue steel hoarding, with the gate on the side towards the road
  const FX0 = -8, FX1 = W + 18, FZ0 = -30, FZ1 = D + 10, FH2 = 2.4;
  const BLUE = [0.14, 0.3, 0.56];
  box([FX0, 0, FZ0 - 0.15], [FX1, FH2, FZ0], 4, BLUE);
  box([FX0 - 0.15, 0, FZ0], [FX0, FH2, FZ1], 4, BLUE);
  box([FX0, 0, FZ1], [FX1, FH2, FZ1 + 0.15], 4, BLUE);
  box([FX1, 0, FZ0], [FX1 + 0.15, FH2, -26], 4, BLUE);
  box([FX1, 0, -20], [FX1 + 0.15, FH2, FZ1], 4, BLUE);
  // Two-storey prefab huts where the workers sleep, the watchman's cabin by the gate
  box([W * 0.45, 0, -25], [W * 0.45 + 21.6, 6, -19], 7, [0.7, 0.7, 0.68]);
  box([W + 12, 0, -26.5], [W + 15.5, 2.7, -24], 2, [0.42, 0.44, 0.47]);
  // Materials: timber, a site container, a rebar stack, and a few loads up on the slabs
  box([4, 0, -9], [10, 0.8, -7.8], 3, [0.5, 0.38, 0.24]);
  box([W * 0.12, 0, -22], [W * 0.12 + 6, 2.6, -19.6], 6, [0.42, 0.2, 0.12]);
  box([W + 3, 0, 4], [W + 12, 0.5, 5.5], 0);
  for (const [x, f, z, sx, sy, sz] of [[W - 4.2, 5, 0.9, 1.2, 0.8, 1.0], [2.2, 7, 1.4, 3.6, 0.35, 0.6], [W - 2.4, 9, 2.2, 1.1, 0.9, 1.1], [W * 0.3, 12, 2.0, 3.4, 0.3, 0.7]]) {
    box([x, f * FH, z], [x + sx, f * FH + sy, z + sz], 3, [0.5, 0.38, 0.24]);
  }
  // Everything above fits in one box: shadow rays that miss it can stop at once
  const ALL = { a: [Infinity, Infinity, Infinity], b: [-Infinity, -Infinity, -Infinity] };
  for (const bx of boxes) for (let k = 0; k < 3; k++) {
    ALL.a[k] = Math.min(ALL.a[k], bx.a[k]);
    ALL.b[k] = Math.max(ALL.b[k], bx.b[k]);
  }

  // Sodium lamps on poles in front of the tower, and one bare bulb left burning on the ninth floor
  const LAMPS = [
    { p: [14, 10, -11], c: SODIUM, P: 105 },
    { p: [W + 7, 9, -4], c: SODIUM, P: 85 },
    { p: [W * 0.7, 9 * FH + 2.4, D * 0.45], c: [1, 0.7, 0.38], P: 5, near: 14 },
  ];

  // Slab test of a ray against a box; returns the entry distance or -1
  function hitBox(bx, o, inv, t0, t1) {
    for (let k = 0; k < 3; k++) {
      let a = (bx.a[k] - o[k]) * inv[k], b = (bx.b[k] - o[k]) * inv[k];
      if (a > b) { const t = a; a = b; b = t; }
      if (a > t0) t0 = a;
      if (b < t1) t1 = b;
      if (t1 < t0) return -1;
    }
    return t0;
  }
  const invOf = (d) => [1 / (d[0] || 1e-9), 1 / (d[1] || 1e-9), 1 / (d[2] || 1e-9)];
  function blocked(o, d, maxT) {
    const inv = invOf(d);
    if (hitBox(ALL, o, inv, 0, maxT) < 0) return false;
    for (const bx of boxes) if (hitBox(bx, o, inv, 1e-3, maxT) >= 0) return true;
    return false;
  }
  // Light arriving at local point p with normal n: sky, moon and lamps, each shadowed by the site
  function lightAt(p, n, ao) {
    const amb = (0.6 + 0.4 * n[1]) * ao;
    let r = SKY_C[0] * amb, g = SKY_C[1] * amb, b = SKY_C[2] * amb;
    const o = [p[0] + n[0] * 0.03, p[1] + n[1] * 0.03, p[2] + n[2] * 0.03];
    const md = dot(n, MOON_L);
    if (md > 0 && !blocked(o, MOON_L, 500)) {
      r += MOON_C[0] * md;
      g += MOON_C[1] * md;
      b += MOON_C[2] * md;
    }
    for (const L of LAMPS) {
      const v = [L.p[0] - o[0], L.p[1] - o[1], L.p[2] - o[2]];
      const d2 = dot(v, v), d = Math.sqrt(d2);
      if (L.near && d > L.near) continue;
      const nd = dot(n, v) / d;
      if (nd <= 0) continue;
      const k = (L.P * nd) / (d2 + 6);
      if (k < 0.003 || blocked(o, [v[0] / d, v[1] / d, v[2] / d], d - 0.2)) continue;
      r += L.c[0] * k;
      g += L.c[1] * k;
      b += L.c[2] * k;
    }
    return [r, g, b];
  }

  // Colour of a ray hit: material and pattern, emissive windows, then light
  const HUT_WARM = [255, 196, 120], HUT_COOL = [196, 228, 255];
  function shade(bx, p, axis, sign) {
    const n = [0, 0, 0];
    n[axis] = sign;
    let alb = bx.alb;
    const k = bx.kind;
    const along = axis === 2 ? p[0] : p[2];
    if (k === 1) {
      // Brick, with a window opening in each bay looking into the dark
      const a = (((along % BAY) + BAY) % BAY) / BAY, v = (p[1] % FH) / FH;
      if (axis !== 1 && a > 0.3 && a < 0.7 && v > 0.28 && v < 0.72) return [3, 4, 6];
    } else if (k === 4) {
      // Ribbed steel sheet, with a pale band along the top
      alb = p[1] > FH2 - 0.35 ? [0.55, 0.56, 0.58] : alb.map((c) => c * (((along * 5) | 0) % 2 ? 0.8 : 1));
    } else if (k === 7) {
      if (axis === 1) alb = [0.15, 0.28, 0.52]; // blue roof sheets
      else if (axis === 2 && sign < 0) {
        const x = p[0] - bx.a[0], room = Math.floor(x / 3.6), a = (x % 3.6) / 3.6;
        const storey = Math.floor(p[1] / 3), v = (p[1] % 3) / 3;
        if (v < 0.06) alb = alb.map((c) => c * 0.45); // walkway along the upper floor
        if (a > 0.32 && a < 0.62 && v > 0.36 && v < 0.74) {
          const lit = hash3(room, storey, 3);
          if (lit < 0.3) return lit < 0.18 ? HUT_WARM : HUT_COOL;
          return [7, 9, 13];
        }
      }
    } else if (k === 2 && axis === 2 && sign < 0) {
      const a = (p[0] - bx.a[0]) / (bx.b[0] - bx.a[0]);
      if (a > 0.2 && a < 0.62 && p[1] > 1.1 && p[1] < 2) return [205, 235, 255];
    } else if (k === 6) {
      alb = alb.map((c) => c * (((along * 3) | 0) % 2 ? 0.82 : 1));
    } else if (k === 5 && p[1] % FH < 0.08) {
      alb = alb.map((c) => c * 0.7); // formwork joints on the core
    }
    // Deep inside the frame the sky barely reaches
    const inside = (k === 0 || k === 5) && p[0] > 0.7 && p[0] < W - 0.7 && p[2] > 0.7 && p[2] < D - 0.7;
    const L = lightAt(p, n, inside ? 0.3 : 1);
    let c = [tone(alb[0] * L[0]), tone(alb[1] * L[1]), tone(alb[2] * L[2])];
    // A touch of light catching the arrises
    const o1 = (axis + 1) % 3, o2 = (axis + 2) % 3;
    const edge = Math.min(p[o1] - bx.a[o1], bx.b[o1] - p[o1], p[o2] - bx.a[o2], bx.b[o2] - p[o2]);
    if (edge < 0.12 && k !== 4) c = c.map((v) => v * 1.2);
    return c;
  }

  // ---------- ray-cast the site once into its own layer (half resolution on very large screens) ----------
  const FS = w > 2200 ? 0.5 : 1;
  const frame = mk(w * FS, h * FS);
  {
    const fw = frame.width, fh = frame.height;
    const fx = frame.getContext('2d');
    // Each box's screen footprint, binned into tiles, so a pixel only tests the boxes that can cover it
    const TS = 16, tw = Math.ceil(fw / TS), th = Math.ceil(fh / TS);
    const tiles = Array.from({ length: tw * th }, () => []);
    let x0 = fw, x1 = 0, y0 = fh, y1 = 0;
    for (const bx of boxes) {
      let bx0 = Infinity, bx1 = -Infinity, by0 = Infinity, by1 = -Infinity;
      for (const x of [bx.a[0], bx.b[0]]) for (const y of [bx.a[1], bx.b[1]]) for (const z of [bx.a[2], bx.b[2]]) {
        const [sx, sy] = project(L2W(x, y, z));
        bx0 = Math.min(bx0, sx * FS); bx1 = Math.max(bx1, sx * FS); by0 = Math.min(by0, sy * FS); by1 = Math.max(by1, sy * FS);
      }
      x0 = Math.min(x0, bx0); x1 = Math.max(x1, bx1); y0 = Math.min(y0, by0); y1 = Math.max(y1, by1);
      for (let ty = Math.max(0, Math.floor(by0 / TS)); ty <= Math.min(th - 1, Math.floor(by1 / TS)); ty++) {
        for (let tx = Math.max(0, Math.floor(bx0 / TS)); tx <= Math.min(tw - 1, Math.floor(bx1 / TS)); tx++) tiles[ty * tw + tx].push(bx);
      }
    }
    x0 = Math.max(0, Math.floor(x0)); x1 = Math.min(fw - 1, Math.ceil(x1));
    y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(fh - 1, Math.ceil(y1));
    if (x1 >= x0 && y1 >= y0) {
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      const img = fx.createImageData(bw, bh);
      for (let py = 0; py < bh; py++) {
        for (let px = 0; px < bw; px++) {
          const list = tiles[Math.floor((y0 + py) / TS) * tw + Math.floor((x0 + px) / TS)];
          if (!list.length) continue;
          const sx = (x0 + px + 0.5) / FS, sy = (y0 + py + 0.5) / FS;
          const d = dirLocal(norm([(sx - sx0) / F, (hy - sy) / F, 1]));
          const inv = invOf(d);
          let best = 1e9, hit = null, axis = 0, sign = 0;
          for (const bx of list) {
            let t0 = 0, t1 = best, ax = -1, sg = 0, miss = false;
            for (let k = 0; k < 3; k++) {
              let a = (bx.a[k] - CAM_L[k]) * inv[k], b = (bx.b[k] - CAM_L[k]) * inv[k], s = -1;
              if (a > b) { const t = a; a = b; b = t; s = 1; }
              if (a > t0) { t0 = a; ax = k; sg = s; }
              if (b < t1) t1 = b;
              if (t1 < t0) { miss = true; break; }
            }
            if (!miss && ax >= 0 && t0 < best) { best = t0; hit = bx; axis = ax; sign = sg; }
          }
          if (!hit) continue;
          const p = [CAM_L[0] + d[0] * best, CAM_L[1] + d[1] * best, CAM_L[2] + d[2] * best];
          const c = shade(hit, p, axis, sign);
          const i = (py * bw + px) * 4;
          img.data[i] = c[0];
          img.data[i + 1] = c[1];
          img.data[i + 2] = c[2];
          img.data[i + 3] = 255;
        }
      }
      fx.putImageData(img, x0, y0);
    }
    fx.setTransform(FS, 0, 0, FS, 0, 0);
    const P = (x, y, z) => project(L2W(x, y, z));
    const ln = (a, b) => {
      const p = P(...a), q = P(...b);
      fx.moveTo(p[0], p[1]);
      fx.lineTo(q[0], q[1]);
    };
    // Rebar sticking out of the column tops, catching the moon
    fx.strokeStyle = 'rgba(120,134,160,0.8)';
    fx.lineWidth = lw(0.0008);
    fx.beginPath();
    for (const [x, top, z] of colTop) for (let r = -1; r <= 1; r++) ln([x + r * 0.14, top, z], [x + r * 0.26, top + 1.3, z + 0.08]);
    fx.stroke();
    // Construction hoist up the long face: a lattice mast and its cage parked low, lit from below
    const hx = W * 0.82, hz = -1.4;
    const bottom = P(hx, 0, hz), top = P(hx, TOP + 3, hz);
    const g = fx.createLinearGradient(0, bottom[1], 0, top[1]);
    g.addColorStop(0, 'rgba(190,120,60,0.95)');
    g.addColorStop(0.35, 'rgba(80,66,58,0.9)');
    g.addColorStop(1, 'rgba(46,54,70,0.9)');
    fx.strokeStyle = g;
    fx.lineWidth = lw(0.0009);
    fx.beginPath();
    for (const dx of [-0.6, 0.6]) ln([hx + dx, 0, hz], [hx + dx, TOP + 3, hz]);
    for (let y = 0, k = 0; y < TOP + 2; y += 1.5, k++) ln([hx + (k % 2 ? -0.6 : 0.6), y, hz], [hx + (k % 2 ? 0.6 : -0.6), y + 1.5, hz]);
    fx.stroke();
    fx.fillStyle = 'rgb(70,52,40)';
    fx.beginPath();
    [[hx - 1.5, 3.6], [hx + 1.5, 3.6], [hx + 1.5, 6.2], [hx - 1.5, 6.2]].forEach(([x, y], i) => {
      const q = P(x, y, hz - 1.6);
      i ? fx.lineTo(q[0], q[1]) : fx.moveTo(q[0], q[1]);
    });
    fx.fill();
    // Lamp poles
    fx.strokeStyle = 'rgb(28,26,26)';
    for (const L of LAMPS.slice(0, 2)) {
      const a = P(L.p[0], 0, L.p[2]), b = P(...L.p);
      fx.lineWidth = Math.max(1, (F * 0.25) / b[2]);
      fx.beginPath();
      fx.moveTo(a[0], a[1]);
      fx.lineTo(b[0], b[1]);
      fx.stroke();
    }
  }

  // ---------- the road: across the fields behind the site, a little nearer on the right ----------
  const RD = norm([1, 0, -0.14]), RN = [-RD[2], 0, RD[0]]; // along the road, and away from us
  const R0 = [0, 0, 310];
  const roadPoint = (a, b, y = 0) => [R0[0] + RD[0] * a + RN[0] * b, y, R0[2] + RD[2] * a + RN[2] * b];
  const toRoad = (X, Z) => {
    const dx = X - R0[0], dz = Z - R0[2];
    return [dx * RD[0] + dz * RD[2], dx * RN[0] + dz * RN[2]];
  };
  // The gate, and the track from it to the road
  const gate = L2W(FX1, 0, -23);
  const gateRoad = toRoad(gate[0], gate[2]);
  const gateFoot = roadPoint(gateRoad[0], 0);

  // ---------- the ground: fields under the moon, the site's bare earth, the road ----------
  const HAZE = [28, 35, 50];
  const SHADE_FIELD = [
    [[0.13, 0.12, 0.1], [0.2, 0.18, 0.15]], // ploughed
    [[0.08, 0.13, 0.08], [0.13, 0.19, 0.12]], // young crop in rows
    [[0.2, 0.19, 0.15], [0.24, 0.22, 0.17]], // stubble
    [[0.12, 0.15, 0.11], [0.15, 0.18, 0.13]], // grass
  ];
  function groundAt(X, Z, dist) {
    const [a, b] = toRoad(X, Z);
    const ab = Math.abs(b);
    const n = noise2(X * 0.05, Z * 0.05) * 0.15;
    if (ab < 3.2) {
      if (ab > 2.9 && ab < 3.05) return [[0.32, 0.32, 0.3], 0];
      if (ab < 0.08 && ((a % 12) + 12) % 12 < 5) return [[0.36, 0.36, 0.33], 0];
      return [[0.075, 0.075, 0.08], 0];
    }
    if (ab < 4.5) return [[0.17, 0.16, 0.14], 0];
    if (ab < 9.5) return [[0.11 + n * 0.3, 0.14 + n * 0.3, 0.1], 0];
    // Track from the gate
    const tx = gateFoot[0] - gate[0], tz = gateFoot[2] - gate[2], tl = tx * tx + tz * tz;
    const f = clamp01(((X - gate[0]) * tx + (Z - gate[2]) * tz) / tl);
    if (Math.hypot(X - gate[0] - tx * f, Z - gate[2] - tz * f) < 2.2) return [[0.22, 0.2, 0.17], 0];
    const l = toLocal([X, 0, Z]);
    if (l[0] > FX0 && l[0] < FX1 && l[2] > FZ0 && l[2] < FZ1) {
      const e = 0.22 + 0.08 * noise2(X * 0.2, Z * 0.2);
      return [[e, e * 0.88, e * 0.74], 0];
    }
    // Fields: parcels aligned to the road, staggered, with dark ditches between
    const side = b > 0 ? 1 : -1;
    const bb = ab - 9.5, ib = Math.floor(bb / 42);
    const aa = a + hash3(ib, side, 4) * 64, ia = Math.floor(aa / 64);
    const fa = aa - ia * 64, fb = bb - ib * 42;
    if (fa < 1 || fb < 0.9) return [[0.08, 0.09, 0.08], 0];
    const type = Math.floor(hash3(ia, ib * side, 7) * 4);
    const along = hash3(ia, ib, 9) < 0.5 ? a : b;
    const fade = 1 - sm(60, 260, dist);
    const rows = type < 2 ? 0.5 + 0.3 * Math.sin((along / 1.3) * TAU) * fade : 0.5 + n;
    const [c0, c1] = SHADE_FIELD[type];
    const broad = 0.82 + 0.36 * (fbm(X * 0.004, Z * 0.004, 3) + 0.5);
    return [lerp(c0, c1, clamp01(rows + n)).map((v) => v * broad), 1];
  }

  const step = w > 1600 ? 2 : 1;
  const groundLayer = mk(w, h);
  const sheenCells = [];
  const SH = 4;
  {
    const gx = groundLayer.getContext('2d');
    const img = gx.createImageData(w, h - hy);
    const UP = [0, 1, 0];
    for (let py = hy; py < h; py += step) {
      const ay = (py + step / 2 - hy) / F;
      const t = EYE / ay;
      for (let px = 0; px < w; px += step) {
        const X = ((px + step / 2 - sx0) / F) * t, Z = t;
        const dist = Math.hypot(X, Z, EYE);
        const [alb] = groundAt(X, Z, dist);
        const L = lightAt(toLocal([X, 0, Z]), UP, 1);
        let c = [tone(alb[0] * L[0]), tone(alb[1] * L[1]), tone(alb[2] * L[2])];
        c = lerp(c, HAZE, sm(150, 2600, dist) * 0.92);
        for (let yy = py; yy < Math.min(py + step, h); yy++) {
          for (let xx = px; xx < Math.min(px + step, w); xx++) {
            const i = ((yy - hy) * w + xx) * 4;
            img.data[i] = c[0];
            img.data[i + 1] = c[1];
            img.data[i + 2] = c[2];
            img.data[i + 3] = 255;
          }
        }
      }
    }
    gx.putImageData(img, 0, hy);
    for (let py = hy; py < h; py += SH) {
      const t = EYE / ((py + SH / 2 - hy) / F);
      for (let px = 0; px < w; px += SH) {
        const X = ((px + SH / 2 - sx0) / F) * t;
        if (groundAt(X, t, t)[1]) sheenCells.push([px / SH, (py - hy) / SH, X, t, 1 - sm(150, 1400, t)]);
      }
    }
  }
  const sheen = mk(Math.ceil(w / SH), Math.ceil((h - hy) / SH));
  const sheenX = sheen.getContext('2d');
  const sheenImg = sheenX.createImageData(sheen.width, sheen.height);

  // ---------- poplars along the road, their moon shadows laid across the ground ----------
  const ACROSS = norm([-MOON[2], 0, MOON[0]]); // horizontal, square to the moonlight
  const poplars = [];
  for (let a = -1800; a < 2400; a += 7 + rng() * 4) {
    if (noise2(a * 0.01, 3.3) < -0.25) continue;
    for (const side of [-1, 1]) {
      if (rng() < 0.06) continue;
      poplars.push({ side, base: roadPoint(a + rng() * 1.5, side * (6.6 + rng() * 0.8)), H: 15 + rng() * 4, R: 1.3 + rng() * 0.5, c0: 2.5 + rng() * 1.5, s: rng() * 50 });
    }
  }
  // Half-width of a poplar's crown at height fraction f: narrow, tallest in the middle, a little ragged
  const crown = (t, f) => t.R * Math.pow(Math.sin(Math.PI * Math.min(1, 0.04 + f * 0.96)), 0.55) * (1 + 0.2 * noise2(t.s + f * 5, 1.7));
  {
    const gx = groundLayer.getContext('2d');
    gx.globalCompositeOperation = 'multiply';
    gx.fillStyle = 'rgb(108,108,116)';
    const toGround = (q) => [q[0] - (MOON[0] * q[1]) / MOON[1], 0, q[2] - (MOON[2] * q[1]) / MOON[1]];
    for (const t of poplars) {
      const pts = [];
      for (let i = 0; i <= 10; i++) {
        const f = i / 10, y = t.c0 + (t.H - t.c0) * f, r = crown(t, f);
        pts.push(toGround([t.base[0] + ACROSS[0] * r, y, t.base[2] + ACROSS[2] * r]));
      }
      for (let i = 10; i >= 0; i--) {
        const f = i / 10, y = t.c0 + (t.H - t.c0) * f, r = crown(t, f);
        pts.push(toGround([t.base[0] - ACROSS[0] * r, y, t.base[2] - ACROSS[2] * r]));
      }
      pts.push(t.base);
      const sp = pts.map(project);
      if (sp.some((q) => q[2] < 2)) continue;
      gx.beginPath();
      sp.forEach(([x, y], i) => (i ? gx.lineTo(x, Math.max(hy, y)) : gx.moveTo(x, Math.max(hy, y))));
      gx.fill();
    }
    gx.globalCompositeOperation = 'source-over';
  }
  function drawPoplars(ctx, side) {
    const list = poplars.filter((t) => t.side === side).map((t) => [t, project(t.base)]).filter(([, p]) => p[2] > 3);
    list.sort((a, b) => b[1][2] - a[1][2]);
    for (const [t, p] of list) {
      const s = F / p[2];
      if (p[0] < -t.R * s * 3 || p[0] > w + t.R * s * 3) continue;
      const haze = sm(150, 2200, p[2]) * 0.85;
      const dark = lerp([6, 8, 11], HAZE, haze), lit = lerp([30, 37, 52], HAZE, haze);
      ctx.fillStyle = rgb(dark);
      ctx.fillRect(p[0] - Math.max(0.5, 0.15 * s), p[1] - t.c0 * s, Math.max(1, 0.3 * s), t.c0 * s);
      const g = ctx.createLinearGradient(p[0] - t.R * s, 0, p[0] + t.R * s, 0);
      g.addColorStop(0, rgb(dark));
      g.addColorStop(0.55, rgb(dark));
      g.addColorStop(1, rgb(lit));
      ctx.fillStyle = g;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const f = i / 12;
        ctx.lineTo(p[0] + crown(t, f) * s, p[1] - (t.c0 + (t.H - t.c0) * f) * s);
      }
      for (let i = 12; i >= 0; i--) {
        const f = i / 12;
        ctx.lineTo(p[0] - crown(t, f) * s, p[1] - (t.c0 + (t.H - t.c0) * f) * s);
      }
      ctx.fill();
    }
  }

  // ---------- the far distance: woods on the horizon, a town's glow, farm lights, mist ----------
  const townX = w * (portrait ? 0.86 : 0.52);
  const farLayer = mk(w, h);
  {
    const fx = farLayer.getContext('2d');
    // Woods along the horizon
    fx.fillStyle = 'rgb(16,20,30)';
    fx.beginPath();
    fx.moveTo(0, hy + u * 0.004);
    for (let x = 0; x <= w; x += 2) fx.lineTo(x, hy - u * (0.004 + 0.011 * (fbm((x / u) * 2.5, 1.2, 3) + 0.5) + 0.004 * Math.abs(noise2((x / u) * 40, 3))));
    fx.lineTo(w, hy + u * 0.004);
    fx.fill();
    // A few copses out in the fields
    const trees = [];
    for (const [z, x, n] of [[520, -260, 40], [760, 120, 50], [420, 300, 30], [1100, -60, 60]]) {
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU, r = Math.sqrt(rng());
        trees.push([x + Math.cos(a) * r * 50, z + Math.sin(a) * r * 22, 3.5 + rng() * 2.5, 7 + rng() * 4]);
      }
    }
    trees.sort((p, q) => q[1] - p[1]).forEach(([X, Z, r, y]) => {
      const p = project([X, y, Z]), b = project([X, 0, Z]);
      fx.fillStyle = rgb(lerp([9, 12, 15], HAZE, sm(150, 2600, Z) * 0.8));
      const rx = (F * r) / Z;
      fx.fillRect(p[0] - Math.max(0.5, rx * 0.1), p[1], Math.max(1, rx * 0.2), b[1] - p[1]);
      fx.beginPath();
      fx.ellipse(p[0], p[1], rx, rx * 1.1, 0, 0, TAU);
      fx.fill();
    });
    // Mist lying on the fields towards the horizon
    const g = fx.createLinearGradient(0, hy - u * 0.03, 0, hy + u * 0.12);
    g.addColorStop(0, 'rgba(40,48,66,0)');
    g.addColorStop(0.3, 'rgba(40,48,66,0.4)');
    g.addColorStop(1, 'rgba(40,48,66,0)');
    fx.fillStyle = g;
    fx.fillRect(0, hy - u * 0.03, w, u * 0.15);
    // The town: a line of tiny lights under its glow; and farmhouse lights scattered far out
    for (let i = 0; i < 40; i++) {
      const x = townX + (rng() - 0.5) * u * 0.35 * (1 - rng() * 0.5), y = hy - rng() * u * 0.004;
      fx.fillStyle = rgb(rng() < 0.7 ? [255, 190, 120] : [220, 230, 250], 0.25 + rng() * 0.5);
      fx.fillRect(x, y, lw(0.0018), lw(0.0018));
    }
    for (let i = 0; i < 9; i++) {
      const Z = 450 + rng() * 2000, X = (rng() - 0.5) * Z * 1.6;
      const p = project([X, 3, Z]);
      if (p[0] < 0 || p[0] > w) continue;
      const r = lw(0.006);
      const lg = fx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r);
      lg.addColorStop(0, 'rgba(255,200,130,0.7)');
      lg.addColorStop(0.25, 'rgba(255,200,130,0.25)');
      lg.addColorStop(1, 'rgba(255,200,130,0)');
      fx.fillStyle = lg;
      fx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2);
    }
  }

  // ---------- mist lying low over the fields: one band far off, one around the foot of the site ----------
  const mists = [[hy - u * 0.01, u * 0.1, 0.22, 0], [project(L2W(W / 2, 0, -12))[1] - u * 0.05, u * 0.09, 0.16, 1]].map(([y, mh, a, warm], k) => {
    const c = mk(w * 1.5, mh);
    const cx = c.getContext('2d');
    const img = cx.createImageData(c.width, c.height);
    for (let py = 0; py < c.height; py++) {
      const v = Math.sin((py / c.height) * Math.PI);
      for (let px = 0; px < c.width; px++) {
        // Wraps seamlessly: the noise is sampled on a circle
        const ang = (px / c.width) * TAU;
        const nn = fbm(Math.cos(ang) * 3 + k * 9, Math.sin(ang) * 3 + (py / c.height) * 0.6, 4) + 0.5;
        const i = (py * c.width + px) * 4;
        img.data[i] = warm ? 120 : 70;
        img.data[i + 1] = warm ? 96 : 82;
        img.data[i + 2] = warm ? 90 : 108;
        img.data[i + 3] = 255 * a * v * v * clamp01(nn * 1.6 - 0.25);
      }
    }
    cx.putImageData(img, 0, 0);
    return { c, y, v: u * (0.004 + k * 0.003) };
  });
  function drawMist(ctx, t, k) {
    const m = mists[k];
    const x = -((t * m.v) % m.c.width);
    ctx.drawImage(m.c, x, m.y);
    ctx.drawImage(m.c, x + m.c.width, m.y);
  }

  // ---------- the sky ----------
  const skyLayer = mk(w, hy + 2);
  {
    const sx = skyLayer.getContext('2d');
    const g = sx.createLinearGradient(0, 0, 0, hy);
    g.addColorStop(0, 'rgb(5,8,17)');
    g.addColorStop(0.55, 'rgb(12,18,34)');
    g.addColorStop(1, 'rgb(34,42,60)');
    sx.fillStyle = g;
    sx.fillRect(0, 0, w, hy + 2);
    // Moonlight washing the sky on the right, out of frame
    const R = Math.max(w, h) * 0.9;
    const mg = sx.createRadialGradient(w * 1.08, -h * 0.05, 0, w * 1.08, -h * 0.05, R);
    mg.addColorStop(0, 'rgba(110,130,170,0.4)');
    mg.addColorStop(1, 'rgba(110,130,170,0)');
    sx.fillStyle = mg;
    sx.fillRect(0, 0, w, hy + 2);
    // The town's sodium glow on the horizon
    sx.save();
    sx.translate(townX, hy);
    sx.scale(1, 0.45);
    const tg = sx.createRadialGradient(0, 0, 0, 0, 0, u * 0.45);
    tg.addColorStop(0, 'rgba(120,84,62,0.5)');
    tg.addColorStop(1, 'rgba(120,84,62,0)');
    sx.fillStyle = tg;
    sx.fillRect(-u * 0.45, -u * 0.45, u * 0.9, u * 0.45);
    sx.restore();
  }
  const stars = Array.from({ length: Math.round((w * hy) / 16000) }, () => ({
    x: rng() * w, y: Math.pow(rng(), 1.4) * hy * 0.85, a: 0.12 + rng() * 0.4, p: rng() * 10, s: 0.3 + rng() * 0.8,
  }));
  // Long thin streaks of cloud, lit by the moon, drifting slowly
  const clouds = Array.from({ length: 3 }, (_, k) => {
    const len = u * (0.6 + rng() * 0.6), th = u * (0.008 + rng() * 0.008);
    const c = mk(len, th * 8);
    const cx = c.getContext('2d');
    for (let i = 0; i < 18; i++) {
      const r = th * (0.8 + rng() * 1.2), sx = 6 + rng() * 8;
      const x = r * sx + rng() * (len - 2 * r * sx), y = th * 4 + (rng() - 0.5) * th * 2;
      cx.save();
      cx.translate(x, y);
      cx.scale(sx, 1);
      const g = cx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, 'rgba(118,134,168,0.16)');
      g.addColorStop(1, 'rgba(70,82,110,0)');
      cx.fillStyle = g;
      cx.fillRect(-r, -r, r * 2, r * 2);
      cx.restore();
    }
    return { c, x: rng() * w, y: hy * (0.12 + 0.22 * k + rng() * 0.1), v: u * (0.002 + rng() * 0.002) };
  });

  // ---------- the crane: beside the tower, its jib reaching out over the fields ----------
  const M = L2W(W + 4.5, 0, D * 0.55);
  const MH = 62, MS = 2, JIB = 58, CJIB = 17;
  const cranePhase = rng() * 10;
  function drawCrane(ctx, t) {
    const s = 0.1 + 0.08 * Math.sin(t * 0.011 + cranePhase) + 0.03 * noise2(t * 0.02, cranePhase);
    const dir = [Math.cos(s), 0, Math.sin(s)], side = [-dir[2], 0, dir[0]];
    const at = (along, lat, y) => [M[0] + dir[0] * along + side[0] * lat, y, M[2] + dir[2] * along + side[2] * lat];
    const line = (a, b) => {
      const p = project(a), q = project(b);
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
    };
    const c = MS / 2;
    const base = project(M), head = project([M[0], MH, M[2]]);
    // Steel: lit warm by the lamps at the foot, cold and dim higher up
    const g = ctx.createLinearGradient(0, base[1], 0, head[1]);
    g.addColorStop(0, 'rgb(190,124,70)');
    g.addColorStop(0.22, 'rgb(96,86,84)');
    g.addColorStop(0.5, 'rgb(70,80,100)');
    g.addColorStop(1, 'rgb(84,96,120)');
    ctx.strokeStyle = g;
    ctx.lineWidth = Math.max(1.5, (F * 0.16) / base[2]);
    ctx.beginPath();
    for (const [dx, dz] of [[-c, -c], [c, -c], [c, c], [-c, c]]) line([M[0] + dx, 0, M[2] + dz], [M[0] + dx, MH, M[2] + dz]);
    for (let y = 0, k = 0; y < MH - MS; y += MS, k++) {
      const a = k % 2 ? -c : c;
      line([M[0] + a, y, M[2] - c], [M[0] - a, y + MS, M[2] - c]);
      line([M[0] - c, y, M[2] + a], [M[0] - c, y + MS, M[2] - a]);
    }
    ctx.stroke();
    ctx.strokeStyle = 'rgb(84,96,120)';
    ctx.lineWidth = Math.max(1.2, (F * 0.11) / head[2]);
    ctx.beginPath();
    // Jib: a triangular truss, two bottom chords and a top chord, with diagonals
    line(at(0, -0.8, MH), at(JIB, -0.4, MH));
    line(at(0, 0.8, MH), at(JIB, 0.4, MH));
    line(at(0, 0, MH + 1.6), at(JIB * 0.97, 0, MH + 0.35));
    const n = 24;
    for (let i = 0; i < n; i++) {
      const a = (JIB * i) / n, b = (JIB * (i + 1)) / n;
      const ya = MH + 1.6 - (1.25 * i) / n, yb = MH + 1.6 - (1.25 * (i + 1)) / n;
      line(at(a, 0, ya), at(b, i % 2 ? 0.6 : -0.6, MH));
      line(at(b, i % 2 ? 0.6 : -0.6, MH), at(b, 0, yb));
    }
    // Counter-jib, the tower head and its tie bars
    line(at(0, -0.8, MH), at(-CJIB, -0.8, MH));
    line(at(0, 0.8, MH), at(-CJIB, 0.8, MH));
    const apex = [M[0], MH + 9, M[2]];
    for (const [dx, dz] of [[-c, -c], [c, -c], [c, c], [-c, c]]) line([M[0] + dx, MH, M[2] + dz], apex);
    line(apex, at(JIB * 0.62, 0, MH + 0.9));
    line(apex, at(-CJIB, 0, MH + 0.3));
    ctx.stroke();
    // Counterweights and the operator's cab
    const quad = (pts, fill) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      pts.map(project).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.fill();
    };
    quad([at(-CJIB + 4, -1, MH), at(-CJIB, -1, MH), at(-CJIB, -1, MH - 3.2), at(-CJIB + 4, -1, MH - 3.2)], 'rgb(30,35,46)');
    quad([[M[0] + c, MH - 3, M[2] - c - 0.1], [M[0] + c + 2.2, MH - 3, M[2] - c - 0.1], [M[0] + c + 2.2, MH - 0.4, M[2] - c - 0.1], [M[0] + c, MH - 0.4, M[2] - c - 0.1]], 'rgb(38,45,58)');
    // Trolley, cable and hook, swaying a little
    const trolley = at(JIB * 0.55, 0, MH);
    const sway = Math.sin(t * 0.6) * 0.4 + noise2(t * 0.25, 7) * 0.4;
    const hook = [trolley[0] + sway, MH * 0.62, trolley[2]];
    ctx.strokeStyle = 'rgba(70,80,100,0.9)';
    ctx.lineWidth = lw(0.0007);
    ctx.beginPath();
    line(trolley, hook);
    ctx.stroke();
    quad([[hook[0] - 0.5, hook[1], hook[2]], [hook[0] + 0.5, hook[1], hook[2]], [hook[0] + 0.5, hook[1] - 1.1, hook[2]], [hook[0] - 0.5, hook[1] - 1.1, hook[2]]], 'rgb(52,62,80)');
    return [[...project([apex[0], apex[1] + 0.4, apex[2]]), 0.25, 0.7], [...project(at(JIB, 0, MH + 0.5)), 0.25, 0.6]];
  }

  // ---------- moving things ----------
  const cars = [];
  let nextCar = 0, firstCar = true;
  let plane = null, nextPlane = 18;
  const moths = Array.from({ length: 7 }, () => ({ p: rng() * 10, r: 0.4 + rng() * 0.8, s: 0.8 + rng() * 1.6 }));

  function update(dt, t) {
    now = t;
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x > w) c.x = -c.c.width;
    }
    if (!plane && t > nextPlane) plane = { x: w + u * 0.05, y: hy * (0.15 + rng() * 0.25), v: -u * 0.01 };
    if (plane && (plane.x += plane.v * dt) < -u * 0.05) {
      plane = null;
      nextPlane = t + 60 + rng() * 50;
    }
    // Now and then a car along the road, either way, keeping to the right
    if (t > nextCar) {
      const dir = firstCar || rng() < 0.5 ? -1 : 1;
      cars.push({ a: firstCar ? 230 : -dir * 420, dir, v: 16 + rng() * 6, lane: -dir * 1.6, truck: rng() < 0.2 });
      firstCar = false;
      nextCar = t + 12 + rng() * 22;
    }
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      c.a += c.dir * c.v * dt;
      if (c.a * c.dir > 480) cars.splice(i, 1);
    }
  }

  // Obstruction light: a quick rise, a hold, a slow fade, then dark
  function beacon(t, off) {
    const p = ((((t + off) % 2.4) + 2.4) % 2.4) / 2.4;
    if (p < 0.04) return p / 0.04;
    if (p < 0.3) return 1;
    if (p < 0.5) return 1 - (p - 0.3) / 0.2;
    return 0;
  }

  function quadFill(ctx, pts) {
    ctx.beginPath();
    pts.map(project).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  }

  // A car: headlights throwing light down the road ahead, a dark body, red tail lights
  function drawCar(ctx, c) {
    const L = c.truck ? 3.6 : 2.2, Wd = c.truck ? 1.2 : 0.9, Ht = c.truck ? 3 : 1.4;
    const at = (along, lat, y) => roadPoint(c.a + c.dir * along, c.lane + lat, y);
    const mid = project(at(0, 0, 0));
    if (mid[2] < 4 || mid[0] < -w * 0.2 || mid[0] > w * 1.2) return;
    const fade = 1 - sm(500, 1700, mid[2]) * 0.7;
    ctx.globalCompositeOperation = 'lighter';
    const b0 = project(at(L, 0, 0)), b1 = project(at(L + 40, 0, 0));
    const g = ctx.createLinearGradient(b0[0], b0[1], b1[0], b1[1]);
    g.addColorStop(0, `rgba(255,232,180,${0.32 * fade})`);
    g.addColorStop(1, 'rgba(255,232,180,0)');
    ctx.fillStyle = g;
    quadFill(ctx, [at(L, -Wd, 0.02), at(L, Wd, 0.02), at(L + 40, Wd + 6, 0.02), at(L + 40, -Wd - 6, 0.02)]);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'rgb(14,16,20)';
    quadFill(ctx, [at(-L, -Wd, 0.3), at(L, -Wd, 0.3), at(L, -Wd, Ht), at(-L, -Wd, Ht)]);
    quadFill(ctx, [at(-L, Wd, 0.3), at(L, Wd, 0.3), at(L, Wd, Ht), at(-L, Wd, Ht)]);
    quadFill(ctx, [at(-L, -Wd, Ht), at(L, -Wd, Ht), at(L, Wd, Ht), at(-L, Wd, Ht)]);
    const r = Math.max(1, (F * 0.16) / mid[2]);
    for (const s of [-0.7, 0.7]) {
      const hl = project(at(L, s * Wd, 0.75)), tl = project(at(-L, s * Wd, 0.85));
      const gr = Math.max(r * 6, u * 0.012);
      const hg = ctx.createRadialGradient(hl[0], hl[1], 0, hl[0], hl[1], gr);
      hg.addColorStop(0, `rgba(255,244,220,${0.3 * fade})`);
      hg.addColorStop(1, 'rgba(255,244,220,0)');
      ctx.fillStyle = hg;
      ctx.fillRect(hl[0] - gr, hl[1] - gr, gr * 2, gr * 2);
      ctx.fillStyle = `rgba(255,248,228,${fade})`;
      ctx.fillRect(hl[0] - r, hl[1] - r, r * 2, r * 2);
      const tr = Math.max(r * 4, u * 0.006);
      const tg = ctx.createRadialGradient(tl[0], tl[1], 0, tl[0], tl[1], tr);
      tg.addColorStop(0, `rgba(255,40,30,${0.4 * fade})`);
      tg.addColorStop(1, 'rgba(255,40,30,0)');
      ctx.fillStyle = tg;
      ctx.fillRect(tl[0] - tr, tl[1] - tr, tr * 2, tr * 2);
      ctx.fillStyle = `rgba(255,40,30,${0.9 * fade})`;
      ctx.fillRect(tl[0] - r * 0.8, tl[1] - r * 0.8, r * 1.6, r * 1.6);
    }
  }

  function glow(ctx, x, y, r, rgbStr, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgbStr},${a})`);
    g.addColorStop(0.25, `rgba(${rgbStr},${a * 0.35})`);
    g.addColorStop(1, `rgba(${rgbStr},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // Wind over the crops: soft bands of moonlit sheen drifting across the fields
  function drawSheen(ctx, t) {
    const d = sheenImg.data;
    d.fill(0);
    for (const [cx, cy, X, Z, k] of sheenCells) {
      const v = noise2(X * 0.012 - t * 0.3, Z * 0.012 + t * 0.08) - 0.15;
      if (v <= 0) continue;
      const i = (cy * sheen.width + cx) * 4;
      d[i] = 150;
      d[i + 1] = 168;
      d[i + 2] = 200;
      d[i + 3] = Math.min(255, v * k * 70);
    }
    sheenX.putImageData(sheenImg, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sheen, 0, hy, sheen.width * SH, sheen.height * SH);
  }

  // Red light from a beacon, landing only on the concrete and steel around it
  const tint = mk(u * 0.2, u * 0.2);
  const tintX = tint.getContext('2d');
  function tintFrame(ctx, x, y, k) {
    const R = tint.width / 2;
    tintX.globalCompositeOperation = 'copy';
    tintX.drawImage(frame, (x - R) * FS, (y - R) * FS, R * 2 * FS, R * 2 * FS, 0, 0, R * 2, R * 2);
    tintX.globalCompositeOperation = 'source-in';
    const g = tintX.createRadialGradient(R, R, 0, R, R, R);
    g.addColorStop(0, `rgba(255,40,24,${0.38 * k})`);
    g.addColorStop(0.3, `rgba(255,40,24,${0.12 * k})`);
    g.addColorStop(1, 'rgba(255,40,24,0)');
    tintX.fillStyle = g;
    tintX.fillRect(0, 0, R * 2, R * 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(tint, x - R, y - R);
    ctx.globalCompositeOperation = 'source-over';
  }

  const roofBeacon = project(L2W((core.a[0] + core.b[0]) / 2, core.b[1] + 0.4, core.a[2]));
  const cornerBeacon = project(L2W(W, TOP + 0.5, 0));
  const lampScreen = LAMPS.map((L) => project(L2W(...L.p)));

  function drawSky(ctx, t, skyAlpha = 1) {
    ctx.globalAlpha = skyAlpha;
    ctx.drawImage(skyLayer, 0, 0);
    ctx.globalAlpha = 1;
    const ss = skyAlpha < 1 ? 2.2 : lw(0.0016);
    for (const s of stars) {
      ctx.fillStyle = `rgba(220,228,245,${Math.min(1, s.a * (skyAlpha < 1 ? 2 : 1)) * (0.6 + 0.4 * Math.sin(t * s.s + s.p))})`;
      ctx.fillRect(s.x, s.y, ss, ss);
    }
    for (const c of clouds) ctx.drawImage(c.c, c.x, c.y);
    if (plane) {
      ctx.fillStyle = 'rgba(230,236,250,0.7)';
      ctx.fillRect(plane.x, plane.y, lw(0.002), lw(0.002));
      if (Math.sin(t * 6) > 0.6) {
        ctx.fillStyle = 'rgba(255,70,60,0.9)';
        ctx.fillRect(plane.x + lw(0.005), plane.y, lw(0.002), lw(0.002));
      }
    }
  }

  function backdrop(ctx) {
    ctx.drawImage(skyLayer, 0, 0);
    ctx.globalAlpha = 0.45;
    ctx.drawImage(groundLayer, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, w, h);
  }

  function draw(ctx, layered) {
    const t = now;
    if (layered) {
      ctx.clearRect(0, 0, w, h);
      drawSky(ctx, t, 0.22);
    } else drawSky(ctx, t);
    ctx.drawImage(groundLayer, 0, 0);
    drawSheen(ctx, t);
    ctx.drawImage(farLayer, 0, 0);
    drawMist(ctx, t, 0);
    drawPoplars(ctx, 1);
    for (const c of cars) drawCar(ctx, c);
    drawPoplars(ctx, -1);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(frame, 0, 0, w, h);
    drawMist(ctx, t, 1);

    // The lamps: a hot core and a wide halo in the damp air, a few moths circling
    ctx.globalCompositeOperation = 'lighter';
    lampScreen.slice(0, 2).forEach(([x, y], i) => {
      const fl = 0.95 + 0.05 * noise2(t * 4, i * 3);
      glow(ctx, x, y, u * 0.13, '255,150,70', 0.2 * fl);
      glow(ctx, x, y, u * 0.016, '255,214,160', 0.95 * fl);
      for (const m of moths) {
        const a = t * m.s + m.p + i;
        const mx = x + Math.cos(a) * u * 0.012 * m.r + noise2(t * 0.8, m.p) * u * 0.006;
        const my = y + Math.sin(a * 1.3) * u * 0.008 * m.r;
        ctx.fillStyle = 'rgba(255,220,170,0.6)';
        ctx.fillRect(mx, my, lw(0.0012), lw(0.0012));
      }
    });
    const [bx, by] = lampScreen[2];
    glow(ctx, bx, by, u * 0.012, '255,200,130', 0.8 * (0.85 + 0.15 * noise2(t * 3, 1.7)));
    ctx.globalCompositeOperation = 'source-over';

    const lights = drawCrane(ctx, t);
    lights.push([roofBeacon[0], roofBeacon[1], 0, 0, 1], [cornerBeacon[0], cornerBeacon[1], 0, 0, 0.6]);

    // Red warning lights: their light on the frame around them, a halo, then the lamp itself
    for (const [lx, ly, , off, size] of lights) {
      const k = beacon(t, off);
      if (k > 0.01 && size === 1) tintFrame(ctx, lx, ly, k);
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, lx, ly, u * 0.05 * size, '255,40,26', 0.45 * k);
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(255,${Math.round(60 + 140 * k)},${Math.round(50 + 110 * k)},${0.2 + 0.8 * k})`;
      ctx.beginPath();
      ctx.arc(lx, ly, lw(0.0028 + 0.0012 * size), 0, TAU);
      ctx.fill();
    }
    vignette(ctx, w, h, 0.45, '2,3,6');
  }

  return { update, draw, drawBackground: backdrop };
}
createVigil.ascii = true;
createVigil.asciiRes = 190;
