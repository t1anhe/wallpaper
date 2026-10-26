// Vigil — a construction site out on open farmland, at night. A long half-built tower and its crane fill
// the lower left of the picture, and the red warning lights on the roof and the crane blink slowly, on and
// off, all night. Beyond them the fields open out: a country road where now and then a car passes, a belt
// of trees, woods dark on the horizon with a town's glow behind them, wind moving over the crops.
//
// Everything is a small 3D world seen from a window across the way, a little above the tower's roof.
// The tower and the crane fill the lower left of the picture; to the right the fields open out to a belt
// of trees and the dark line of the woods. The tower frame is ray-cast once, the fields are mapped onto
// the ground plane once; the crane, cars and lights move.
// Rendered as ASCII by default (?ascii=0 for the plain version, ?res=<glyph rows>).
function createVigil({ w, h, rng }) {
  const { noise2, fbm } = makeNoise(rng);
  const u = Math.min(w, h);
  const portrait = h > w;
  const TAU = Math.PI * 2;
  const hy = Math.round(h * (portrait ? 0.22 : 0.26)); // horizon = eye level
  const lw = (k) => Math.max(1, u * k);
  const H = hexToRgb;
  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const mk = (cw, ch) => {
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    return c;
  };
  let now = 0;

  // ---------- world (metres): X right, Y up, Z away from the viewer ----------
  // A long slab block, twelve bays long and four deep
  const NX = 12, NZ = 4, BAY = 4.8, FH = 3.2, FLOORS = 14;
  const W = NX * BAY, D = NZ * BAY, TOP = FLOORS * FH;
  // The camera: a window across the way, a little above the roof (higher on a phone), looking past
  // the tower's near corner so its long face runs off to the left
  const yaw = 0.45, eye = TOP + (portrait ? 17 : 12);
  const fwd = [-Math.sin(yaw), 0, Math.cos(yaw)], right = [Math.cos(yaw), 0, Math.sin(yaw)];
  const cam = [W + 30, eye, -75];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // Frame it so the roof's near corner sits just below the middle of the screen, left of centre
  const corner = [W - cam[0], TOP - cam[1], -cam[2]];
  const F = ((h * (portrait ? 0.45 : 0.5) - hy) * dot(corner, fwd)) / (eye - TOP);
  const sx0 = w * (portrait ? 0.62 : 0.52) - (F * dot(corner, right)) / dot(corner, fwd);
  function project(p) {
    const d = [p[0] - cam[0], p[1] - cam[1], p[2] - cam[2]];
    const z = dot(d, fwd);
    return [sx0 + (F * dot(d, right)) / z, hy - (F * d[1]) / z, z];
  }

  // The country road behind the site, at a slight angle to the view
  const roadP = [cam[0] + fwd[0] * 170, 0, cam[2] + fwd[2] * 170];
  const rAng = Math.atan2(right[2], right[0]) - 0.12;
  const rd = [Math.cos(rAng), Math.sin(rAng)], rn = [-rd[1], rd[0]];
  const toRoad = (X, Z) => {
    const dx = X - roadP[0], dz = Z - roadP[2];
    return [dx * rd[0] + dz * rd[1], dx * rn[0] + dz * rn[1]];
  };
  const nearSide = Math.sign(toRoad(cam[0], cam[2])[1]);
  const roadPoint = (a, b, y = 0) => [roadP[0] + rd[0] * a + rn[0] * b, y, roadP[2] + rd[1] * a + rn[1] * b];
  // Where the line `b` metres off the road crosses X
  const alongAt = (X, b) => (X - roadP[0] - rn[0] * b) / rd[0];
  // The site: from the front of the tower back to a fence along the road, gate and cabin by the road
  const SITE_X0 = -14, SITE_X1 = W + 30, SITE_Z0 = -40, BACK = nearSide * 9;
  const backL = roadPoint(alongAt(SITE_X0, BACK), BACK), backR = roadPoint(alongAt(SITE_X1, BACK), BACK);
  const gateA = alongAt(W + 12, BACK);
  const gate = roadPoint(gateA, BACK), gateFoot = roadPoint(gateA, nearSide * 3.3);

  // Frame: columns (a few stop a floor short), slabs (the top one half poured), brick infill below
  const boxes = [];
  const colTop = [];
  for (let i = 0; i <= NX; i++) {
    for (let j = 0; j <= NZ; j++) {
      const top = rng() < 0.4 ? TOP - FH : TOP;
      colTop.push([i * BAY, top, j * BAY]);
      boxes.push({ a: [i * BAY - 0.32, 0, j * BAY - 0.32], b: [i * BAY + 0.32, top, j * BAY + 0.32], kind: 0 });
    }
  }
  for (let f = 1; f <= FLOORS; f++) {
    const xr = f === FLOORS ? W * 0.55 : W;
    boxes.push({ a: [-0.45, f * FH - 0.34, -0.45], b: [xr + 0.45, f * FH, D + 0.45], kind: 0 });
  }
  // Infill climbs higher at the far end, where work started
  for (let i = 0; i < NX; i++) {
    const top = 4 + Math.round((1 - i / NX) * 4 + rng() * 2);
    for (let f = 1; f < top; f++) {
      if (rng() < 0.8) boxes.push({ a: [i * BAY, f * FH, -0.12], b: [(i + 1) * BAY, (f + 1) * FH, 0.12], kind: 1 });
    }
  }
  for (let f = 1; f < 5; f++) {
    for (let j = 0; j < NZ; j++) {
      if (rng() < 0.75) boxes.push({ a: [W - 0.12, f * FH, j * BAY], b: [W + 0.12, (f + 1) * FH, (j + 1) * BAY], kind: 1 });
    }
  }

  // The watchman's cabin by the gate; materials stacked on a few slabs and out in the yard
  const cab = roadPoint(gateA + 8, nearSide * 15);
  boxes.push({ a: [cab[0] - 3.2, 0, cab[2] - 1.3], b: [cab[0] + 3.2, 2.7, cab[2] + 1.3], kind: 2 });
  for (const [x, f, z, sx, sy, sz] of [[W - 4.2, 5, 0.9, 1.2, 0.8, 1.0], [2.2, 7, 1.4, 3.6, 0.35, 0.6], [W - 2.4, 9, 2.2, 1.1, 0.9, 1.1], [6.5, 4, 0.9, 1.2, 0.7, 1.0], [W * 0.5, 11, 1.1, 1.3, 0.8, 1.2], [W * 0.3, 12, 2.0, 3.4, 0.3, 0.7]]) {
    boxes.push({ a: [x, f * FH, z], b: [x + sx, f * FH + sy, z + sz], kind: 3 });
  }
  for (const [da, db, sx, sy, sz] of [[-6, 20, 4, 1.1, 2.4], [-12, 24, 2.4, 1.6, 2.4], [-3, 30, 6, 0.6, 1.4], [4, 26, 2.4, 1.2, 2.4]]) {
    const q = roadPoint(gateA + da, nearSide * db);
    boxes.push({ a: [q[0], 0, q[2]], b: [q[0] + sx, sy, q[2] + sz], kind: 3 });
  }

  // Ray-cast the frame once into its own layer
  const LIGHT = (() => { const l = [-0.45, 0.55, -0.7], n = Math.hypot(...l); return l.map((v) => v / n); })();
  const CONC = H('#6d7a90'), BRICK = H('#3d3438'), HOLE = H('#06080b'), CABIN = H('#2c3644'), WOOD = H('#5a4632'), LAMP = H('#d9a866');
  const frame = mk(w, h);
  {
    const fx = frame.getContext('2d');
    // Each box's screen footprint, binned into tiles so a pixel only tests the boxes that can cover it
    const TS = 24, tw = Math.ceil(w / TS), th = Math.ceil(h / TS);
    const tiles = Array.from({ length: tw * th }, () => []);
    let x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (const bx of boxes) {
      let bx0 = w, bx1 = 0, by0 = h, by1 = 0;
      for (const x of [bx.a[0], bx.b[0]]) for (const y of [bx.a[1], bx.b[1]]) for (const z of [bx.a[2], bx.b[2]]) {
        const [sx, sy] = project([x, y, z]);
        bx0 = Math.min(bx0, sx); bx1 = Math.max(bx1, sx); by0 = Math.min(by0, sy); by1 = Math.max(by1, sy);
      }
      x0 = Math.min(x0, bx0); x1 = Math.max(x1, bx1); y0 = Math.min(y0, by0); y1 = Math.max(y1, by1);
      for (let ty = Math.max(0, Math.floor(by0 / TS)); ty <= Math.min(th - 1, Math.floor(by1 / TS)); ty++) {
        for (let tx = Math.max(0, Math.floor(bx0 / TS)); tx <= Math.min(tw - 1, Math.floor(bx1 / TS)); tx++) tiles[ty * tw + tx].push(bx);
      }
    }
    x0 = Math.max(0, Math.floor(x0)); x1 = Math.min(w - 1, Math.ceil(x1));
    y0 = Math.max(0, Math.floor(y0)); y1 = Math.min(h - 1, Math.ceil(y1));
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    const img = fx.createImageData(bw, bh);
    const up = [0, 1, 0];
    for (let py = 0; py < bh; py++) {
      for (let px = 0; px < bw; px++) {
        const ax = (x0 + px + 0.5 - sx0) / F, ay = -(y0 + py + 0.5 - hy) / F;
        const d = [right[0] * ax + fwd[0], up[1] * ay, right[2] * ax + fwd[2]];
        const dl = Math.hypot(d[0], d[1], d[2]);
        d[0] /= dl; d[1] /= dl; d[2] /= dl;
        let best = 1e9, hit = null, axis = 0, sign = 0;
        for (const bx of tiles[Math.floor((y0 + py) / TS) * tw + Math.floor((x0 + px) / TS)]) {
          let tmin = 0, tmax = 1e9, ax2 = -1, sg = 0, miss = false;
          for (let k = 0; k < 3; k++) {
            const inv = 1 / d[k];
            let t0 = (bx.a[k] - cam[k]) * inv, t1 = (bx.b[k] - cam[k]) * inv, s = -1;
            if (t0 > t1) { const tt = t0; t0 = t1; t1 = tt; s = 1; }
            if (t0 > tmin) { tmin = t0; ax2 = k; sg = s; }
            if (t1 < tmax) tmax = t1;
            if (tmax < tmin) { miss = true; break; }
          }
          if (!miss && ax2 >= 0 && tmin < best) { best = tmin; hit = bx; axis = ax2; sign = sg; }
        }
        if (!hit) continue;
        const p = [cam[0] + d[0] * best, cam[1] + d[1] * best, cam[2] + d[2] * best];
        const n = [0, 0, 0];
        n[axis] = sign;
        const lit = Math.max(0, dot(n, LIGHT));
        let k = 0.22 + 0.95 * lit;
        if (n[1] < 0) k *= 0.75; // slab undersides
        // Deep inside the frame it is darker
        if (p[0] > 0.6 && p[0] < W - 0.6 && p[2] > 0.6 && p[2] < D - 0.6) k *= 0.5;
        // A touch of highlight along the arrises
        const o1 = (axis + 1) % 3, o2 = (axis + 2) % 3;
        const edge = Math.min(p[o1] - hit.a[o1], hit.b[o1] - p[o1], p[o2] - hit.a[o2], hit.b[o2] - p[o2]);
        if (edge < 0.16) k *= 1.25;
        let col = CONC;
        if (hit.kind === 2) {
          // The cabin: its window glows, everything else is dark painted steel
          const along = (p[0] - hit.a[0]) / (hit.b[0] - hit.a[0]), v = p[1] / (hit.b[1] - hit.a[1]);
          const lit = axis === 2 && along > 0.55 && along < 0.85 && v > 0.42 && v < 0.75;
          col = lit ? LAMP : CABIN;
          if (lit) k = 0.8;
        } else if (hit.kind === 3) {
          col = WOOD;
        } else if (hit.kind === 1) {
          // Brick infill with a window opening in the middle of each bay
          const along = axis === 2 ? (p[0] % BAY) / BAY : (p[2] % BAY) / BAY;
          const v = (p[1] % FH) / FH;
          col = along > 0.3 && along < 0.7 && v > 0.3 && v < 0.75 ? HOLE : BRICK;
        }
        const i = (py * bw + px) * 4;
        img.data[i] = col[0] * k;
        img.data[i + 1] = col[1] * k;
        img.data[i + 2] = col[2] * k;
        img.data[i + 3] = 255;
      }
    }
    fx.putImageData(img, x0, y0);
    // Rebar sticking out of the column tops
    fx.strokeStyle = '#6a7486';
    fx.lineWidth = lw(0.0011);
    fx.beginPath();
    for (const [x, top, z] of colTop) {
      for (let r = -1; r <= 1; r++) {
        const a = project([x + r * 0.15, top, z]), b = project([x + r * 0.15 + r * 0.12, top + 1.3, z + 0.1]);
        fx.moveTo(a[0], a[1]);
        fx.lineTo(b[0], b[1]);
      }
    }
    fx.stroke();

    const ln = (a, b) => {
      const p = project(a), q = project(b);
      fx.moveTo(p[0], p[1]);
      fx.lineTo(q[0], q[1]);
    };
    const poly = (pts, fill) => {
      fx.fillStyle = fill;
      fx.beginPath();
      pts.map(project).forEach(([x, y], i) => (i ? fx.lineTo(x, y) : fx.moveTo(x, y)));
      fx.closePath();
      fx.fill();
    };
    // Shoring props under the two freshest slabs, along the faces we see
    fx.strokeStyle = '#7b6c58';
    fx.lineWidth = lw(0.0008);
    fx.beginPath();
    for (const f of [FLOORS - 2, FLOORS - 1]) {
      const xmax = f === FLOORS - 1 ? W * 0.55 : W;
      for (let x = 0.9; x < xmax - 0.5; x += 1.2) ln([x, f * FH, 0.8], [x, (f + 1) * FH - 0.34, 0.8]);
      if (f < FLOORS - 1) for (let z = 0.9; z < D - 0.5; z += 1.2) ln([W - 0.8, f * FH, z], [W - 0.8, (f + 1) * FH - 0.34, z]);
    }
    fx.stroke();
    // Timber formwork hanging off the edge of the half-poured top slab
    poly([[0, TOP - 0.34, -0.5], [W * 0.55, TOP - 0.34, -0.5], [W * 0.55, TOP - 1.1, -0.5], [0, TOP - 1.1, -0.5]], '#4b3c2d');
    // Construction hoist on the dark face: a lattice mast and a cage parked halfway up
    const hz = D * 0.55, hx = W + 1.3;
    fx.strokeStyle = '#4b5462';
    fx.lineWidth = lw(0.0009);
    fx.beginPath();
    for (const dz of [-0.6, 0.6]) ln([hx, 0, hz + dz], [hx, TOP + 4, hz + dz]);
    for (let y = 0, k = 0; y < TOP + 3; y += 1.5, k++) ln([hx, y, hz + (k % 2 ? -0.6 : 0.6)], [hx, y + 1.5, hz + (k % 2 ? 0.6 : -0.6)]);
    fx.stroke();
    poly([[hx + 1.6, 6 * FH, hz - 1.4], [hx + 1.6, 6 * FH, hz + 1.4], [hx + 1.6, 6 * FH + 2.6, hz + 1.4], [hx + 1.6, 6 * FH + 2.6, hz - 1.4]], '#3a4250');
    // A parked excavator: tracks, body, cab, and its arm folded down to the ground
    const E = roadPoint(gateA - 20, nearSide * 22);
    poly([[E[0] - 2.6, 0, E[2]], [E[0] + 2.6, 0, E[2]], [E[0] + 2.4, 1, E[2]], [E[0] - 2.4, 1, E[2]]], '#1b1d1b');
    poly([[E[0] - 2, 1, E[2] + 0.2], [E[0] + 1.6, 1, E[2] + 0.2], [E[0] + 1.6, 2.4, E[2] + 0.2], [E[0] - 2, 2.4, E[2] + 0.2]], '#2c2b22');
    poly([[E[0] - 2, 2.4, E[2] + 0.3], [E[0] - 0.6, 2.4, E[2] + 0.3], [E[0] - 0.6, 3.9, E[2] + 0.3], [E[0] - 1.8, 3.9, E[2] + 0.3]], '#2c2b22');
    fx.strokeStyle = '#2c2b22';
    for (const [a, b, wd] of [[[E[0] - 0.4, 2.2, E[2]], [E[0] - 3.8, 5.6, E[2]], 0.55], [[E[0] - 3.8, 5.6, E[2]], [E[0] - 6.2, 1.2, E[2]], 0.4]]) {
      fx.lineWidth = Math.max(1, (F * wd) / project(a)[2]);
      fx.beginPath();
      ln(a, b);
      fx.stroke();
    }
    poly([[E[0] - 6.8, 1.4, E[2]], [E[0] - 5.4, 1.4, E[2]], [E[0] - 6, 0, E[2]]], '#24231c');
  }

  // ---------- the land: fields, a country road, the site's bare earth, woods ----------
  const sm = (e0, e1, x) => {
    const k = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return k * k * (3 - 2 * k);
  };
  const HAZE = [20, 26, 38];
  const CROP = [
    [[19, 17, 15], [27, 24, 20]], // ploughed soil
    [[13, 18, 15], [19, 26, 21]], // young crop in rows
    [[24, 23, 18], [29, 27, 21]], // stubble
    [[14, 18, 15], [18, 23, 19]], // grass
  ];
  // Colour of the ground at world (X, Z), seen from `dist` metres away
  function ground(X, Z, dist) {
    const [a, b] = toRoad(X, Z);
    const fade = 1 - sm(60, 320, dist);
    const n = noise2(X * 0.06, Z * 0.06) * 0.12;
    let c, crop = false;
    const ab = Math.abs(b);
    if (ab < 3.3) {
      c = [22, 23, 26];
      if (ab > 3.0) c = lerp(c, [52, 52, 48], fade);
      if (ab < 0.13 && ((a % 10) + 10) % 10 < 4) c = lerp(c, [74, 74, 66], fade);
    } else if (ab < 5) {
      c = [27, 28, 23];
    } else {
      // Access track to the gate
      const gx = gateFoot[0] - gate[0], gz = gateFoot[2] - gate[2], gl = gx * gx + gz * gz;
      const f = Math.max(0, Math.min(1, ((X - gate[0]) * gx + (Z - gate[2]) * gz) / gl));
      const dTrack = Math.hypot(X - gate[0] - gx * f, Z - gate[2] - gz * f);
      if (dTrack < 1.9) {
        c = [34, 31, 26];
        if (Math.abs(dTrack - 0.9) < 0.22) c = lerp(c, [44, 40, 34], fade);
      } else if (X > SITE_X0 && X < SITE_X1 && Z > SITE_Z0 && b * nearSide > 9) {
        c = lerp([28, 26, 22], [36, 33, 28], noise2(X * 0.15, Z * 0.15) + 0.5); // bare earth of the site
      } else {
        // Fields: road-aligned parcels, staggered, with dark hedgerows between
        const side = Math.sign(b);
        const bb = ab - 5;
        const ib = Math.floor(bb / 46);
        const aa = a + hash3(ib, side, 4) * 70;
        const ia = Math.floor(aa / 70);
        const fa = aa - ia * 70, fb = bb - ib * 46;
        if (fa < 1.6 || fb < 1.4) {
          c = [8, 11, 9];
        } else {
          const type = Math.floor(hash3(ia, ib * side, 7) * 4);
          crop = true;
          const along = hash3(ia, ib, 9) < 0.5 ? a : b;
          const rows = type < 2 ? 0.5 + 0.5 * Math.sin((along / 1.4) * Math.PI * 2) : 0.5;
          const [c0, c1] = CROP[type];
          c = lerp(c0, c1, Math.max(0, Math.min(1, 0.5 + (rows - 0.5) * fade + n)));
        }
      }
    }
    return [lerp(c, HAZE, sm(120, 1500, dist) * 0.9), crop];
  }

  // Ground layer: every pixel below the horizon mapped back onto the ground plane, once
  const step = w > 1600 ? 2 : 1;
  const groundLayer = mk(w, h);
  const sheenCells = [];
  const SH = 4; // sheen grid, in pixels
  {
    const gx = groundLayer.getContext('2d');
    const img = gx.createImageData(w, h - hy);
    for (let py = hy; py < h; py += step) {
      const ay = -(py + 0.5 - hy) / F;
      const t = cam[1] / -ay;
      for (let px = 0; px < w; px += step) {
        const ax = (px + 0.5 - sx0) / F;
        const X = cam[0] + (right[0] * ax + fwd[0]) * t, Z = cam[2] + (right[2] * ax + fwd[2]) * t;
        const dist = t * Math.hypot(right[0] * ax + fwd[0], right[2] * ax + fwd[2]);
        const [c] = ground(X, Z, dist);
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
      const ay = -(py + SH / 2 - hy) / F;
      const t = cam[1] / -ay;
      for (let px = 0; px < w; px += SH) {
        const ax = (px + SH / 2 - sx0) / F;
        const X = cam[0] + (right[0] * ax + fwd[0]) * t, Z = cam[2] + (right[2] * ax + fwd[2]) * t;
        const dist = t * Math.hypot(right[0] * ax + fwd[0], right[2] * ax + fwd[2]);
        if (ground(X, Z, dist)[1]) sheenCells.push([px / SH, (py - hy) / SH, X, Z, 1 - sm(200, 1200, dist)]);
      }
    }
  }
  const sheen = mk(Math.ceil(w / SH), Math.ceil((h - hy) / SH));
  const sheenX = sheen.getContext('2d');
  const sheenImg = sheenX.createImageData(sheen.width, sheen.height);

  // Far layer: the forest along the horizon, and a few woods out in the fields
  const farLayer = mk(w, h);
  {
    const fx = farLayer.getContext('2d');
    fx.fillStyle = 'rgb(10,13,17)';
    fx.beginPath();
    fx.moveTo(0, hy + u * 0.006);
    for (let x = 0; x <= w; x += 2) {
      const top = hy - u * (0.008 + 0.018 * (fbm(x / u * 2.5, 1.2, 3) + 0.5) + 0.006 * Math.abs(noise2(x / u * 45, 3)));
      fx.lineTo(x, top);
    }
    fx.lineTo(w, hy + u * 0.006);
    fx.fill();
    const trees = [];
    for (const [d, x, n] of [[430, -170, 70], [680, 160, 90], [320, 250, 45], [900, -40, 80]]) {
      const c = [cam[0] + fwd[0] * d + right[0] * x, cam[2] + fwd[2] * d + right[2] * x];
      for (let i = 0; i < n; i++) {
        const a = rng() * TAU, r = Math.sqrt(rng());
        trees.push([c[0] + Math.cos(a) * r * 55, c[1] + Math.sin(a) * r * 28, 3.5 + rng() * 2.5, 7 + rng() * 3]);
      }
    }
    // A shelter belt along a field edge beyond the road: two staggered rows, with the odd gap
    for (let a = -260; a < 700; a += 4.5 + rng() * 2) {
      if (noise2(a * 0.02, 5.5) < -0.28) continue;
      for (const row of [0, 4]) {
        const q = roadPoint(a + row * 0.6 + rng(), -nearSide * (88 + row + rng() * 2));
        trees.push([q[0], q[2], 3 + rng() * 2.2, 8 + rng() * 4]);
      }
    }
    trees
      .map(([X, Z, r, y]) => [project([X, y, Z]), project([X, 0, Z]), r])
      .filter(([p]) => p[2] > 1)
      .sort((p, q) => q[0][2] - p[0][2])
      .forEach(([p, base, r]) => {
        const rx = (F * r) / p[2];
        fx.fillStyle = 'rgb(12,17,14)';
        fx.fillRect(p[0] - Math.max(1, rx * 0.12), p[1], Math.max(1, rx * 0.24), base[1] - p[1]);
        fx.beginPath();
        fx.ellipse(p[0], p[1], rx, rx * 1.15, 0, 0, TAU);
        fx.fill();
      });
  }

  // Power poles along the near side of the road, wires sagging between them
  const poleLayer = mk(w, h);
  {
    const px = poleLayer.getContext('2d');
    const poles = [];
    for (let a = -900; a <= 900; a += 45) {
      const p = roadPoint(a, nearSide * 6.5);
      const q = project(p);
      if (q[2] > 8 && q[0] > -w * 0.3 && q[0] < w * 1.3) poles.push([a, p, q[2]]);
    }
    poles.sort((p, q) => q[2] - p[2]);
    const arm = (a, s, y) => roadPoint(a, nearSide * 6.5 + s, y);
    for (const [a, p, z] of poles) {
      px.strokeStyle = '#1b2129';
      px.lineWidth = Math.max(1, (F * 0.3) / z);
      px.beginPath();
      const b0 = project(p), b1 = project([p[0], 10, p[2]]);
      px.moveTo(b0[0], b0[1]);
      px.lineTo(b1[0], b1[1]);
      const l = project(arm(a, -1.2, 9.2)), r = project(arm(a, 1.2, 9.2));
      px.moveTo(l[0], l[1]);
      px.lineTo(r[0], r[1]);
      px.stroke();
      px.strokeStyle = 'rgba(62,72,90,0.85)';
      px.lineWidth = lw(0.0007);
      px.beginPath();
      for (const sOff of [-1.1, 0, 1.1]) {
        for (let k = 0; k <= 16; k++) {
          const f = k / 16;
          const y = (sOff === 0 ? 10 : 9.2) - Math.sin(f * Math.PI) * 1.0;
          const pt = project(arm(a + 45 * f, sOff, y));
          if (pt[2] < 1) continue;
          k ? px.lineTo(pt[0], pt[1]) : px.moveTo(pt[0], pt[1]);
        }
      }
      px.stroke();
    }
  }

  const cars = [];
  let nextCarAt = 1, firstCar = true;
  let plane = null, nextPlane = 14;

  // The crane stands between us and the tower: its mast runs down the left edge of the picture with
  // the cab near the top, and its flat-top jib reaches out over the roof
  const zm = portrait ? 70 : 55;
  const mx = ((w * (portrait ? 0.1 : 0.095) - sx0) * zm) / F;
  const M = [cam[0] + fwd[0] * zm + right[0] * mx, 0, cam[2] + fwd[2] * zm + right[2] * mx];
  const MH = eye + ((hy - h * (portrait ? 0.08 : 0.1)) * zm) / F, MS = 2, CJIB = 16;
  const aim = [W * 0.8, 0, D * 0.5];
  const jibAim = Math.atan2(aim[2] - M[2], aim[0] - M[0]);
  const JIB = Math.hypot(aim[0] - M[0], aim[2] - M[2]) + 8;
  const cranePhase = rng() * 10;

  // ---------- sky and distance ----------
  const stars = Array.from({ length: Math.round((w * hy) / 9000) }, () => ({
    x: rng() * w, y: rng() * hy * 0.8, a: 0.15 + rng() * 0.35, p: rng() * 10, s: 0.2 + rng() * 0.6,
  }));
  const townX = w * (portrait ? 0.12 : 0.15);
  const town = Array.from({ length: 30 }, () => ({
    x: townX + (rng() - 0.5) * w * (portrait ? 0.22 : 0.2), y: hy - rng() * u * 0.006,
    c: rng() < 0.75 ? '#ffc98a' : '#e8eef8', a: 0.3 + rng() * 0.5, p: rng() * 10,
  }));
  const clouds = Array.from({ length: 3 }, () => ({ x: rng() * w, y: hy * (0.15 + rng() * 0.45), len: u * (0.4 + rng() * 0.5), v: u * (0.004 + rng() * 0.004) }));

  function update(dt, t) {
    now = t;
    for (const c of clouds) {
      c.x += c.v * dt;
      if (c.x - c.len > w) c.x = -c.len;
    }
    if (!plane && t > nextPlane) plane = { x: -u * 0.05, y: hy * (0.12 + rng() * 0.2), v: u * 0.012 };
    if (plane && (plane.x += plane.v * dt) > w + u * 0.05) {
      plane = null;
      nextPlane = t + 50 + rng() * 40;
    }
    // Now and then a car along the road, either way
    if (t > nextCarAt) {
      const dir = rng() < 0.5 ? 1 : -1;
      cars.push({ a: -dir * (firstCar ? 160 : 750), dir, v: 13 + rng() * 7, lane: -dir * nearSide * 1.6, truck: rng() < 0.25 });
      firstCar = false;
      nextCarAt = t + 9 + rng() * 16;
    }
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      c.a += c.dir * c.v * dt;
      if (c.a * c.dir > 760) cars.splice(i, 1);
    }
  }

  // Obstruction light: a quick rise, a short hold, a slow fade, then dark
  function beacon(t, off) {
    const p = ((((t + off) % 2.6) + 2.6) % 2.6) / 2.6;
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
    const tg = ctx.createRadialGradient(townX, hy, 0, townX, hy, u * 0.5);
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

  // Wind over the crops: soft bands of sheen drifting across the fields
  function drawSheen(ctx, t) {
    const d = sheenImg.data;
    d.fill(0);
    for (const [cx, cy, X, Z, k] of sheenCells) {
      const v = noise2(X * 0.012 - t * 0.35, Z * 0.012 + t * 0.1) - 0.12;
      if (v <= 0) continue;
      const i = (cy * sheen.width + cx) * 4;
      d[i] = 150;
      d[i + 1] = 170;
      d[i + 2] = 140;
      d[i + 3] = Math.min(255, v * k * 120);
    }
    sheenX.putImageData(sheenImg, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(sheen, 0, hy, sheen.width * SH, sheen.height * SH);
  }

  // A car on the road: dark body, headlights throwing a pool of light ahead, red tail lights
  function drawCar(ctx, c) {
    const L = c.truck ? 3.6 : 2.2, Wd = c.truck ? 1.2 : 0.9, Ht = c.truck ? 3 : 1.4;
    const at = (along, lat, y) => roadPoint(c.a + c.dir * along, c.lane + lat, y);
    const mid = project(at(0, 0, 0));
    if (mid[2] < 5 || mid[0] < -w * 0.2 || mid[0] > w * 1.2) return;
    // Beam on the tarmac
    const b0 = project(at(L, 0, 0)), b1 = project(at(L + 32, 0, 0));
    const g = ctx.createLinearGradient(b0[0], b0[1], b1[0], b1[1]);
    g.addColorStop(0, 'rgba(255,236,190,0.42)');
    g.addColorStop(1, 'rgba(255,236,190,0)');
    ctx.fillStyle = g;
    quad(ctx, [at(L, -Wd, 0.02), at(L, Wd, 0.02), at(L + 32, Wd + 4.5, 0.02), at(L + 32, -Wd - 4.5, 0.02)]);
    // Body
    ctx.fillStyle = c.truck ? '#20252d' : '#181c22';
    quad(ctx, [at(-L, -Wd, 0.3), at(L, -Wd, 0.3), at(L, -Wd, Ht), at(-L, -Wd, Ht)]);
    quad(ctx, [at(-L, Wd, 0.3), at(L, Wd, 0.3), at(L, Wd, Ht), at(-L, Wd, Ht)]);
    quad(ctx, [at(-L, -Wd, Ht), at(L, -Wd, Ht), at(L, Wd, Ht), at(-L, Wd, Ht)]);
    const r = Math.max(1.2, (F * 0.18) / mid[2]);
    for (const s of [-0.7, 0.7]) {
      const hl = project(at(L, s * Wd, 0.75)), tl = project(at(-L, s * Wd, 0.85));
      ctx.fillStyle = 'rgba(255,248,225,1)';
      ctx.fillRect(hl[0] - r, hl[1] - r, r * 2, r * 2);
      ctx.fillStyle = 'rgba(255,40,30,0.95)';
      ctx.fillRect(tl[0] - r * 0.8, tl[1] - r * 0.8, r * 1.6, r * 1.6);
    }
  }

  const line = (ctx, a, b) => {
    const p = project(a), q = project(b);
    ctx.moveTo(p[0], p[1]);
    ctx.lineTo(q[0], q[1]);
  };
  const quad = (ctx, pts) => {
    ctx.beginPath();
    pts.map(project).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
  };

  // Scaffold and safety net on the lit face, breathing with the wind
  function drawScaffold(ctx, t) {
    const z = -1.4, x1 = W * 0.45, f0 = 2, f1 = Math.round(FLOORS * 0.7);
    ctx.strokeStyle = '#323b4a';
    ctx.lineWidth = lw(0.0011);
    ctx.beginPath();
    for (let x = 0; x <= x1 + 0.01; x += 2.4) line(ctx, [x, 0, z], [x, f1 * FH, z]);
    for (let f = 0; f <= f1; f++) line(ctx, [0, f * FH, z], [x1, f * FH, z]);
    ctx.stroke();
    const strips = 6;
    for (let s = 0; s < strips; s++) {
      const a = 0.3 + 0.25 * (noise2(t * 0.35 + s * 0.7, 3.1) + 0.5);
      ctx.fillStyle = `rgba(30,58,44,${a})`;
      const xa = (x1 * s) / strips, xb = (x1 * (s + 1)) / strips + 0.05;
      quad(ctx, [[xa, f0 * FH, z - 0.1], [xb, f0 * FH, z - 0.1], [xb, f1 * FH, z - 0.1], [xa, f1 * FH, z - 0.1]]);
    }
  }

  // Scaffold with cross bracing up the dark face, by the near corner
  function drawSideScaffold(ctx) {
    const x = W + 1.4, z1 = D * 0.45;
    ctx.strokeStyle = '#323b4a';
    ctx.lineWidth = lw(0.0011);
    ctx.beginPath();
    for (const z of [0, z1 / 2, z1]) line(ctx, [x, 0, z], [x, TOP - FH, z]);
    for (let f = 0; f < FLOORS - 1; f++) {
      line(ctx, [x, f * FH, 0], [x, f * FH, z1]);
      line(ctx, [x, f * FH, 0], [x, (f + 1) * FH, z1 / 2]);
      line(ctx, [x, (f + 1) * FH, 0], [x, f * FH, z1 / 2]);
      line(ctx, [x, f * FH, z1 / 2], [x, (f + 1) * FH, z1]);
      line(ctx, [x, (f + 1) * FH, z1 / 2], [x, f * FH, z1]);
    }
    ctx.stroke();
  }

  function drawHoarding(ctx) {
    const g0 = roadPoint(gateA - 3, BACK), g1 = roadPoint(gateA + 3, BACK);
    const runs = [[[SITE_X1, SITE_Z0], [backR[0], backR[2]]], [[backR[0], backR[2]], [g1[0], g1[2]]], [[g0[0], g0[2]], [backL[0], backL[2]]]];
    ctx.fillStyle = 'rgba(16,20,26,0.9)';
    for (const [[ax, az], [bx, bz]] of runs) quad(ctx, [[ax, 0, az], [bx, 0, bz], [bx, 2.2, bz], [ax, 2.2, az]]);
    ctx.strokeStyle = '#262d38';
    ctx.lineWidth = lw(0.0011);
    ctx.beginPath();
    for (const [[ax, az], [bx, bz]] of runs) {
      line(ctx, [ax, 2.2, az], [bx, 2.2, bz]);
      const n = Math.round(Math.hypot(bx - ax, bz - az) / 3);
      for (let i = 0; i <= n; i++) {
        const f = i / n;
        line(ctx, [ax + (bx - ax) * f, 0, az + (bz - az) * f], [ax + (bx - ax) * f, 2.2, az + (bz - az) * f]);
      }
    }
    ctx.stroke();
  }

  // A box drawn as the faces that face us, shaded like the frame. o is a corner, ex/ey/ez its edges
  function solid(ctx, o, ex, ey, ez, base) {
    const P = (i, j, k) => [0, 1, 2].map((n) => o[n] + ex[n] * i + ey[n] * j + ez[n] * k);
    const faces = [
      [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0], ez, -1], [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1], ez, 1],
      [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0], ex, -1], [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0], ex, 1],
      [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1], ey, 1], [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1], ey, -1],
    ];
    for (const [a, b, c, d, axis, sg] of faces) {
      const n = axis.map((v) => v * sg), nl = Math.hypot(...n);
      const pa = P(...a);
      if (dot(n, [cam[0] - pa[0], cam[1] - pa[1], cam[2] - pa[2]]) <= 0) continue;
      const k = 0.3 + 0.8 * Math.max(0, dot(n, LIGHT) / nl);
      ctx.fillStyle = rgb(base.map((v) => v * k));
      quad(ctx, [pa, P(...b), P(...c), P(...d)]);
    }
  }

  // The crane, slewing slowly; returns its light positions
  function drawCrane(ctx, t) {
    const s = jibAim + 0.12 * Math.sin(t * 0.012 + cranePhase) + 0.05 * noise2(t * 0.02, cranePhase);
    const dir = [Math.cos(s), 0, Math.sin(s)], side = [-dir[2], 0, dir[0]];
    const at = (along, lat, y) => [M[0] + dir[0] * along + side[0] * lat, y, M[2] + dir[2] * along + side[2] * lat];
    const thick = (m, p) => Math.max(1, (F * m) / project(p)[2]);
    const c = MS / 2;
    const corners = [[-c, -c], [c, -c], [c, c], [-c, c]];
    ctx.strokeStyle = '#4a5463';
    // Mast: four corner posts, then rungs and diagonals on the two faces we see
    ctx.lineWidth = thick(0.2, [M[0], eye, M[2]]);
    ctx.beginPath();
    for (const [dx, dz] of corners) line(ctx, [M[0] + dx, 0, M[2] + dz], [M[0] + dx, MH - 1.2, M[2] + dz]);
    ctx.stroke();
    ctx.lineWidth = thick(0.09, [M[0], eye, M[2]]);
    ctx.beginPath();
    for (let y = 0, k = 0; y < MH - MS - 1.2; y += MS, k++) {
      const a = k % 2 ? -c : c;
      line(ctx, [M[0] - c, y, M[2] - c], [M[0] + c, y, M[2] - c]);
      line(ctx, [M[0] + c, y, M[2] - c], [M[0] + c, y, M[2] + c]);
      line(ctx, [M[0] + a, y, M[2] - c], [M[0] - a, y + MS, M[2] - c]);
      line(ctx, [M[0] + c, y, M[2] + a], [M[0] + c, y + MS, M[2] - a]);
    }
    ctx.stroke();
    // Slewing ring and turntable on top of the mast
    solid(ctx, at(-1.6, -1.6, MH - 1.2), dir.map((v) => v * 3.2), [0, 1.2, 0], side.map((v) => v * 3.2), [52, 60, 72]);
    // Jib: a flat-top truss, two bottom chords and a top chord tapering towards the tip, with diagonals
    ctx.lineWidth = thick(0.13, at(JIB * 0.4, 0, MH));
    ctx.beginPath();
    line(ctx, at(-CJIB, -0.9, MH), at(JIB, -0.4, MH));
    line(ctx, at(-CJIB, 0.9, MH), at(JIB, 0.4, MH));
    line(ctx, at(0, 0, MH + 1.8), at(JIB, 0, MH + 0.8));
    ctx.stroke();
    ctx.lineWidth = thick(0.07, at(JIB * 0.4, 0, MH));
    ctx.beginPath();
    const n = 26;
    for (let i = 0; i < n; i++) {
      const a = (JIB * i) / n, b = (JIB * (i + 1)) / n;
      const ya = MH + 1.8 - (1.0 * i) / n, yb = MH + 1.8 - (1.0 * (i + 1)) / n;
      const la = 0.9 - (0.5 * i) / n, lb = 0.9 - (0.5 * (i + 1)) / n;
      line(ctx, at(a, 0, ya), at(b, i % 2 ? lb : -lb, MH));
      line(ctx, at(b, i % 2 ? lb : -lb, MH), at(b, 0, yb));
      line(ctx, at(a, -la, MH), at(a, la, MH));
    }
    // Counter-jib rails and their walkway
    for (let a = 0; a > -CJIB; a -= 2) line(ctx, at(a, -0.9, MH), at(a, 0.9, MH));
    ctx.stroke();
    // Counterweights at the back, then the operator's cab hung off the turntable, a dim pane in front
    solid(ctx, at(-CJIB + 0.4, -1.1, MH - 3.4), dir.map((v) => v * 3.4), [0, 3.4, 0], side.map((v) => v * 2.2), [40, 44, 50]);
    solid(ctx, at(0.6, -3, MH - 3.6), dir.map((v) => v * 2.4), [0, 2.6, 0], side.map((v) => v * 1.9), [58, 66, 78]);
    ctx.fillStyle = 'rgba(120,150,170,0.28)';
    quad(ctx, [at(1, -3.01, MH - 2.4), at(2.6, -3.01, MH - 2.4), at(2.6, -3.01, MH - 1.2), at(1, -3.01, MH - 1.2)]);
    // Trolley, cable and hook, swaying a little
    const trolley = at(JIB * 0.74, 0, MH);
    const sway = Math.sin(t * 0.7) * 0.4 + noise2(t * 0.3, 7) * 0.4;
    const hook = [trolley[0] + sway, TOP + 5, trolley[2]];
    ctx.fillStyle = '#4a5463';
    quad(ctx, [at(JIB * 0.74 - 0.8, 0, MH - 0.1), at(JIB * 0.74 + 0.8, 0, MH - 0.1), at(JIB * 0.74 + 0.8, 0, MH - 0.6), at(JIB * 0.74 - 0.8, 0, MH - 0.6)]);
    ctx.strokeStyle = '#59626f';
    ctx.lineWidth = lw(0.0009);
    ctx.beginPath();
    for (const o of [-0.25, 0.25]) line(ctx, [trolley[0] + o, MH - 0.5, trolley[2]], [hook[0] + o, hook[1], hook[2]]);
    ctx.stroke();
    ctx.fillStyle = '#46505f';
    quad(ctx, [[hook[0] - 0.6, hook[1], hook[2]], [hook[0] + 0.6, hook[1], hook[2]], [hook[0] + 0.6, hook[1] - 1.2, hook[2]], [hook[0] - 0.6, hook[1] - 1.2, hook[2]]]);
    // A short pole on the turntable carries the top light
    const pole = [M[0], MH + 2.6, M[2]];
    ctx.strokeStyle = '#4a5463';
    ctx.lineWidth = thick(0.08, pole);
    ctx.beginPath();
    line(ctx, [M[0], MH, M[2]], pole);
    ctx.stroke();
    return [[...project([pole[0], pole[1] + 0.2, pole[2]]), 0], [...project(at(JIB, 0, MH + 0.9)), 0.35]];
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
    for (const l of town) {
      ctx.fillStyle = rgba(l.c, l.a * (0.75 + 0.25 * Math.sin(t * 0.8 + l.p)));
      ctx.fillRect(l.x, l.y - lw(0.0015), lw(0.0022), lw(0.0022));
    }
    ctx.drawImage(groundLayer, 0, 0);
    ctx.drawImage(farLayer, 0, 0);
    drawSheen(ctx, t);

    if (plane) {
      const blink = Math.sin(t * 6) > 0.6;
      ctx.fillStyle = 'rgba(230,236,250,0.8)';
      ctx.fillRect(plane.x, plane.y, lw(0.0025), lw(0.0025));
      if (blink) {
        ctx.fillStyle = 'rgba(255,70,60,0.9)';
        ctx.fillRect(plane.x - lw(0.006), plane.y, lw(0.0025), lw(0.0025));
      }
    }
    ctx.drawImage(poleLayer, 0, 0);
    for (const c of cars) drawCar(ctx, c);
    drawHoarding(ctx);
    ctx.drawImage(frame, 0, 0);
    // A bare bulb left burning inside the ninth floor, warming the concrete around it
    const bulb = project([W * 0.7, 9 * FH + 2.3, D * 0.3]);
    const flick = 0.85 + 0.15 * noise2(t * 3, 1.7);
    ctx.globalCompositeOperation = 'source-atop';
    let g = ctx.createRadialGradient(bulb[0], bulb[1], 0, bulb[0], bulb[1], u * 0.06);
    g.addColorStop(0, `rgba(255,190,110,${0.5 * flick})`);
    g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(bulb[0] - u * 0.06, bulb[1] - u * 0.06, u * 0.12, u * 0.12);
    ctx.globalCompositeOperation = 'source-over';
    g = ctx.createRadialGradient(bulb[0], bulb[1], 0, bulb[0], bulb[1], u * 0.014);
    g.addColorStop(0, `rgba(255,214,150,${0.9 * flick})`);
    g.addColorStop(1, 'rgba(255,214,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(bulb[0] - u * 0.014, bulb[1] - u * 0.014, u * 0.028, u * 0.028);
    drawScaffold(ctx, t);
    drawSideScaffold(ctx);
    const lights = drawCrane(ctx, t);
    lights.push([...project([W, TOP + 0.6, 0]), 0.12]);

    // Red warning lights: tint the steel and concrete around them, then the glow itself
    ctx.globalCompositeOperation = 'source-atop';
    for (const [lx, ly, , off] of lights) {
      const k = beacon(t, off);
      if (k <= 0.01) continue;
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, u * 0.09);
      g.addColorStop(0, `rgba(255,60,40,${0.45 * k})`);
      g.addColorStop(1, 'rgba(255,60,40,0)');
      ctx.fillStyle = g;
      ctx.fillRect(lx - u * 0.09, ly - u * 0.09, u * 0.18, u * 0.18);
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const [lx, ly, , off] of lights) {
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
createVigil.asciiRes = 190;
