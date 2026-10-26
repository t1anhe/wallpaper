// Isle — a floating voxel island with a cabin, trees, a pond and a waterfall spilling into the sky.
// Runs a full day/night cycle: sunsets, stars, a moon, and lanterns that light the blocks around them.
// Rendered as ASCII by default (?ascii=0 for the plain block version, ?res=<glyph rows>).
// Params: ?time=day | sunset | night | cycle (default)   ?day=<seconds per full cycle, default 120>
function createIsle({ w, h, rng, params }) {
  const { noise2, fbm } = makeNoise(rng);
  const portrait = h > w;
  const bs = Math.max(8, Math.floor(Math.min(w, h) / (portrait ? 46 : 54)));
  const cols = Math.ceil(w / bs);
  const rows = Math.ceil(h / bs);
  const dayLen = +params.get('day') || 120;
  const fixed = { day: 0.22, sunset: 0.47, night: 0.72 }[params.get('time')];

  const C = {
    grass: ['#6aaa3c', '#62a238', '#73b143'], dirt: '#86603f', stone: ['#7d7d7d', '#858585', '#767676'],
    sand: '#dbcf8e', snow: '#f2f5f7', cobble: '#8a8a8a', log: '#6b5132', leaves: ['#4f8f2f', '#5b9a35', '#447f29'],
    plank: '#b08954', door: '#7a5a35', roof: '#8e3b2e', brick: '#9c4f3a', glow: '#f4c55a', lantern: '#ffcf6b',
    water: '#3f76e4', window: '#ffcf7a', flower: ['#e8443a', '#f2d43b', '#c46be0', '#f4f4f4', '#ff8fb1'],
    ore: [['#2b2b2b', 0.5], ['#d8af93', 0.25], ['#c8271e', 0.12], ['#f5d33a', 0.08], ['#5fe0d6', 0.05]],
  };
  const any = (a) => (Array.isArray(a) ? a[Math.floor(rng() * a.length)] : a);
  const pickOre = () => {
    let x = rng();
    for (const [c, p] of C.ore) if ((x -= p) <= 0) return c;
    return C.ore[0][0];
  };

  // ---------- world generation ----------
  const world = new Map();
  const key = (x, y) => y * cols + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < cols && y < rows;
  const set = (x, y, kind, color, extra = {}) => {
    if (!inside(x, y)) return;
    world.set(key(x, y), { x, y, kind, color, shade: [0.9, 0.97, 1.04][Math.floor(rng() * 3)], depth: 0, ...extra });
  };
  const at = (x, y) => world.get(key(x, y));

  const ic = Math.floor(cols / 2);
  const halfW = Math.floor(cols * (portrait ? 0.44 : 0.3));
  const sr = Math.floor(rows * (portrait ? 0.5 : 0.52));
  const depthMax = Math.floor(rows * (portrait ? 0.18 : 0.27));
  const side = rng() < 0.5 ? -1 : 1; // which side the mountain sits on
  const mx = Math.round(side * halfW * 0.55);
  const hx = Math.round(-side * halfW * 0.2); // cabin
  const px0 = Math.round(-side * halfW * 0.62) - 3; // pond start
  const top = {}, bot = {};

  for (let x = -halfW; x <= halfW; x++) {
    const e = 1 - (x / halfW) ** 2;
    let hgt = 1.5 + 2.2 * fbm(x * 0.07 + 3, 0.5, 3) +
      9 * Math.exp(-(((x - mx) / (halfW * 0.22)) ** 2)) * (0.85 + 0.3 * noise2(x * 0.3, 2));
    hgt *= Math.sqrt(e);
    let t = sr - Math.round(hgt);
    if (Math.abs(x - hx) <= 5) t = sr - 2; // flat yard for the cabin
    if (x >= px0 && x <= px0 + 6) t = sr - 1; // pond basin
    let b = sr + Math.round(depthMax * Math.pow(e, 0.9) * (0.7 + 0.5 * (fbm(x * 0.12, 7, 3) + 0.5)));
    if (rng() < 0.2) b += 1 + Math.floor(rng() * 3); // stalactites
    top[x] = t;
    bot[x] = Math.max(b, t + 1);
  }

  const lights = [];
  for (let x = -halfW; x <= halfW; x++) {
    const gx = ic + x, t = top[x], b = bot[x];
    const peak = t < sr - 7, rocky = t < sr - 5;
    const pond = x > px0 && x < px0 + 6;
    const rim = x === px0 || x === px0 + 6;
    for (let y = t; y <= b; y++) {
      const d = y - t, fromBot = b - y;
      let kind, color;
      if (pond && d < 2) { kind = 'water'; color = C.water; }
      else if ((pond && d === 2) || (rim && d < 2)) { kind = 'sand'; color = C.sand; }
      else if (d === 0) {
        if (peak) { kind = 'snow'; color = C.snow; }
        else if (rocky && rng() < 0.6) { kind = 'stone'; color = any(C.stone); }
        else { kind = 'grass'; color = any(C.grass); }
      } else if (d <= 2 + (noise2(x * 0.3, y * 0.3) > 0 ? 1 : 0) && !rocky) { kind = 'dirt'; color = C.dirt; }
      else if (fromBot <= 1) { kind = rng() < 0.5 ? 'cobble' : 'mossy'; color = C.cobble; }
      else if (fromBot <= 3 && rng() < 0.015) { kind = 'glowstone'; color = C.glow; }
      else if (d > 3 && rng() < 0.06 + d * 0.004) { kind = 'ore'; color = pickOre(); }
      else if (noise2(x * 0.25 + 9, y * 0.25) > 0.35) { kind = 'dirt'; color = C.dirt; }
      else { kind = 'stone'; color = any(C.stone); }
      set(gx, y, kind, color, { depth: d });
      if (kind === 'glowstone') lights.push({ x: gx, y, r: 3, c: [255, 196, 90], k: 0.55 });
    }
    // Hanging roots and vines under the island
    if (rng() < 0.35) {
      const len = 1 + Math.floor(rng() * 3);
      for (let i = 1; i <= len; i++) set(gx, b + i, i === len || rng() < 0.5 ? 'roots' : 'leaves', i === len ? '#5a4128' : any(C.leaves), { deco: true });
    }
  }

  // Trees
  const occupied = new Set();
  for (let x = px0 - 1; x <= px0 + 7; x++) occupied.add(x);
  for (let x = hx - 6; x <= hx + 6; x++) occupied.add(x);
  const treeSpots = [];
  for (let tries = 0; tries < 60 && treeSpots.length < (portrait ? 3 : 4); tries++) {
    const x = Math.round((rng() * 2 - 1) * halfW * 0.85);
    if (occupied.has(x) || top[x] < sr - 6 || treeSpots.some((s) => Math.abs(s - x) < 6)) continue;
    treeSpots.push(x);
  }
  const leafCells = [];
  for (const x of treeSpots) {
    occupied.add(x);
    const gx = ic + x, t = top[x];
    const th = 4 + Math.floor(rng() * 3);
    for (let i = 1; i <= th; i++) set(gx, t - i, 'log', C.log);
    const R = 2 + (rng() < 0.5 ? 1 : 0);
    const cy = t - th;
    for (let dy = -R - 1; dy <= R; dy++) {
      for (let dx = -R - 1; dx <= R + 1; dx++) {
        if (Math.hypot(dx, dy * 1.25) > R + 0.6 - rng() * 0.7 || (dx === 0 && dy > 0)) continue;
        set(gx + dx, cy + dy, 'leaves', any(C.leaves), { deco: true });
        leafCells.push([gx + dx, cy + dy]);
      }
    }
  }

  // Cabin
  const L = top[hx];
  const cgx = ic + hx;
  for (let y = L - 4; y <= L - 1; y++) {
    for (let dx = -3; dx <= 3; dx++) set(cgx + dx, y, Math.abs(dx) === 3 ? 'log' : 'plank', Math.abs(dx) === 3 ? C.log : C.plank, { deco: true });
  }
  set(cgx - 1, L - 1, 'door', C.door, { deco: true });
  set(cgx - 1, L - 2, 'door', C.door, { deco: true });
  set(cgx + 1, L - 3, 'window', C.window, { deco: true });
  set(cgx + 2, L - 3, 'window', C.window, { deco: true });
  lights.push({ x: cgx + 1.5, y: L - 3, r: 6, c: [255, 190, 100], k: 1, window: true });
  for (let i = 0; i < 4; i++) for (let dx = -4 + i; dx <= 4 - i; dx++) set(cgx + dx, L - 5 - i, 'roof', C.roof, { deco: true });
  set(cgx + 2, L - 7, 'brick', C.brick, { deco: true });
  set(cgx + 2, L - 8, 'brick', C.brick, { deco: true });
  const chimney = { x: (cgx + 2.5) * bs, y: (L - 8) * bs };

  // Lanterns on fence posts: one by the cabin, one by the pond
  for (const x of [hx + 5, px0 + 7]) {
    if (x < -halfW || x > halfW) continue;
    const gx = ic + x, t = top[x];
    set(gx, t - 1, 'fence', C.log, { deco: true });
    set(gx, t - 2, 'lantern', C.lantern, { deco: true });
    lights.push({ x: gx, y: t - 2, r: 5.5, c: [255, 200, 110], k: 1 });
  }

  // Flowers and grass tufts
  for (let x = -halfW + 1; x < halfW; x++) {
    if (occupied.has(x) || at(ic + x, top[x])?.kind !== 'grass' || at(ic + x, top[x] - 1)) continue;
    const q = rng();
    if (q < 0.18) set(ic + x, top[x] - 1, 'flower', any(C.flower), { deco: true });
    else if (q < 0.5) set(ic + x, top[x] - 1, 'tallgrass', any(C.grass), { deco: true });
  }

  // Waterfall over the mountain-side edge
  const fx = side * halfW;
  const fall = { x: ic + fx + side, y0: top[fx] + 1, bottom: bot[fx] };
  set(ic + fx, top[fx], 'water', C.water);

  // ---------- static layer: every block that doesn't animate, baked once ----------
  const ANIM = new Set(['water']);
  const stat = document.createElement('canvas');
  stat.width = w;
  stat.height = h;
  const sctx = stat.getContext('2d');
  sctx.imageSmoothingEnabled = false;
  for (const b of world.values()) {
    if (ANIM.has(b.kind)) continue;
    sctx.drawImage(Blocks.get(b.kind, b.color, b.shade), b.x * bs, b.y * bs, bs, bs);
    // Ambient occlusion: deeper blocks sit in shadow
    const ao = b.deco ? 0 : Math.min(0.5, b.depth * 0.04);
    if (ao > 0) {
      sctx.fillStyle = `rgba(0,0,0,${ao})`;
      sctx.fillRect(b.x * bs, b.y * bs, bs, bs);
    }
  }
  const waterCells = [...world.values()].filter((b) => b.kind === 'water');

  // ---------- sky decor ----------
  const stars = Array.from({ length: Math.round(cols * rows * 0.02) }, () => ({
    x: Math.floor(rng() * cols * 2), y: Math.floor(rng() * rows * 1.4), p: rng() * 10, s: rng() < 0.15 ? 2 : 1,
  }));
  const clouds = Array.from({ length: portrait ? 6 : 8 }, (_, i) => {
    const cw = 6 + Math.floor(rng() * 11), ch = 2 + Math.floor(rng() * 2);
    const cells = [];
    for (let x = 0; x < cw; x++) {
      const e = 1 - ((x - cw / 2) / (cw / 2)) ** 2;
      const hgt = Math.max(1, Math.round(ch * (0.4 + e * 0.8) + (rng() - 0.5)));
      for (let y = 0; y < hgt; y++) cells.push([x, ch - y]);
    }
    return {
      cells, x: rng() * w, y: (0.06 + rng() * (i % 3 === 0 ? 0.75 : 0.4)) * h,
      v: (0.15 + rng() * 0.35) * bs, front: i % 4 === 3, wide: cw * bs,
    };
  });
  const debris = Array.from({ length: 16 }, () => {
    const a = Math.PI * (0.05 + rng() * 0.9);
    const rr = 1.05 + rng() * 0.35;
    return {
      x: (ic + Math.cos(a) * halfW * rr * (rng() < 0.5 ? 1 : -1)) * bs,
      y: (sr + Math.sin(a) * depthMax * rr) * bs,
      s: 0.4 + rng() * 0.5, p: rng() * 10,
      kind: any(['dirt', 'stone', 'cobble', 'grass']),
    };
  });
  const smoke = [], leaves = [];
  const flies = Array.from({ length: 16 }, () => {
    const anchor = rng() < 0.5 && treeSpots.length ? ic + any(treeSpots) : ic + px0 + 3;
    return { ax: anchor, ay: sr - 4 - rng() * 4, p: rng() * 100 };
  });

  // Small canvases scaled up with smoothing off: sky gradient and the block lightmap.
  const skyC = document.createElement('canvas');
  skyC.width = cols;
  skyC.height = rows;
  const skyX = skyC.getContext('2d');
  const skyImg = skyX.createImageData(cols, rows);
  const lightC = document.createElement('canvas');
  lightC.width = cols;
  lightC.height = rows;
  const lightX = lightC.getContext('2d');
  const lightImg = lightX.createImageData(cols, rows);
  const worldC = document.createElement('canvas');
  worldC.width = w;
  worldC.height = h;
  const wctx = worldC.getContext('2d');
  wctx.imageSmoothingEnabled = false;

  const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const smooth = (e0, e1, x) => {
    const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
    return t * t * (3 - 2 * t);
  };
  const H = (hex) => hexToRgb(hex);

  let now = 0, par = { x: 0, y: 0 };
  function update(dt, t, input) {
    now = t;
    const tx = input.active ? (input.x / w - 0.5) : 0, ty = input.active ? (input.y / h - 0.5) : 0;
    par.x += (tx - par.x) * Math.min(1, dt * 2);
    par.y += (ty - par.y) * Math.min(1, dt * 2);
    for (const c of clouds) {
      c.x += c.v * dt * (c.front ? 1.6 : 1);
      if (c.x > w + bs * 4) c.x = -c.wide - bs * 4;
    }
    if (rng() < dt * 4) smoke.push({ x: chimney.x, y: chimney.y, age: 0, vx: (0.2 + rng() * 0.3) * bs, s: 0.3 + rng() * 0.2 });
    for (let i = smoke.length - 1; i >= 0; i--) {
      const s = smoke[i];
      s.age += dt;
      s.x += s.vx * dt;
      s.y -= bs * 0.9 * dt;
      if (s.age > 4) smoke.splice(i, 1);
    }
    if (leafCells.length && rng() < dt * 0.5) {
      const [lx, ly] = any(leafCells);
      leaves.push({ x: (lx + 0.5) * bs, y: (ly + 0.5) * bs, age: 0, p: rng() * 10, c: any(C.leaves) });
    }
    for (let i = leaves.length - 1; i >= 0; i--) {
      const l = leaves[i];
      l.age += dt;
      l.y += bs * 0.9 * dt;
      l.x += Math.sin(l.age * 2 + l.p) * bs * 0.8 * dt + bs * 0.2 * dt;
      if (l.age > 14) leaves.splice(i, 1);
    }
  }

  function sky() {
    const tod = fixed !== undefined ? fixed : (0.4 + now / dayLen) % 1;
    const sunH = Math.sin(tod * Math.PI * 2);
    const day = smooth(-0.12, 0.3, sunH);
    return { tod, sunH, day, night: 1 - day, dusk: Math.exp(-(((sunH - 0.03) / 0.18) ** 2)) };
  }

  // Sky gradient (per block row, lightly dithered); k dims it when it sits behind the ASCII layer.
  function paintSky(ctx, { day, dusk }, k) {
    const top0 = lerp(lerp(H('#060914'), H('#4a8fd6'), day), H('#33306e'), dusk * 0.7);
    const hor0 = lerp(lerp(H('#18264a'), H('#c4e6f5'), day), H('#ff8547'), Math.min(1, dusk * 1.1));
    const mid0 = lerp(lerp(top0, hor0, 0.5), H('#d95c7c'), dusk * 0.75);
    for (let y = 0; y < rows; y++) {
      const v = y / rows;
      const c = v < 0.35 ? lerp(top0, mid0, v / 0.35) : v < 0.7 ? lerp(mid0, hor0, (v - 0.35) / 0.35) : lerp(hor0, top0, (v - 0.7) * 0.6);
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4, n = (hash3(x, y, 77) - 0.5) * 6;
        skyImg.data[i] = (c[0] + n) * k;
        skyImg.data[i + 1] = (c[1] + n) * k;
        skyImg.data[i + 2] = (c[2] + n) * k;
        skyImg.data[i + 3] = 255;
      }
    }
    skyX.putImageData(skyImg, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(skyC, 0, 0, cols * bs, rows * bs);
  }

  function orbGlow(ctx, ox, oy, z, isMoon) {
    const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, z * 3);
    g.addColorStop(0, isMoon ? 'rgba(200,215,255,0.22)' : 'rgba(255,230,160,0.45)');
    g.addColorStop(1, 'rgba(255,230,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(ox - z * 3, oy - z * 3, z * 6, z * 6);
  }

  // In ASCII mode the sky stays a dim, smooth backdrop (with glyph stars and soft glows)
  // and only the scene above it becomes glyphs.
  function drawBackground(ctx) {
    const sk = sky();
    paintSky(ctx, sk, 0.4 + 0.2 * sk.day);
    for (const [phase, moon] of [[sk.tod, false], [(sk.tod + 0.5) % 1, true]]) {
      const a = phase * Math.PI * 2;
      if (Math.sin(a) < -0.15) continue;
      orbGlow(ctx, Math.round((w / 2 - Math.cos(a) * w * 0.44) / bs) * bs, Math.round((h * 0.64 - Math.sin(a) * h * 0.52) / bs) * bs, bs * 4, moon);
    }
    if (sk.night > 0.05) {
      ctx.font = `${Math.round(bs * 0.6)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const s of stars) {
        const a = sk.night * (0.35 + 0.65 * Math.sin(now * 1.3 + s.p) ** 2);
        const sx = ((s.x * bs * 0.5 - par.x * bs * 2) % w + w) % w, sy = s.y * bs * 0.5;
        if (sy > h * 0.75) continue;
        ctx.fillStyle = `rgba(255,250,235,${a})`;
        ctx.fillText(s.s > 1 ? '*' : a > 0.6 ? '+' : '.', sx, sy);
      }
    }
  }

  function draw(ctx, layered) {
    const t = now;
    const sk = sky();
    const { tod, day, night, dusk } = sk;
    if (layered) ctx.clearRect(0, 0, w, h);
    else paintSky(ctx, sk, 1);

    // Stars
    if (!layered && night > 0.05) {
      for (const s of stars) {
        const a = night * (0.4 + 0.6 * Math.sin(t * 1.3 + s.p) ** 2);
        const sx = ((s.x * bs * 0.5 - par.x * bs * 2) % w + w) % w, sy = s.y * bs * 0.5;
        if (sy > h * 0.75) continue;
        ctx.fillStyle = `rgba(255,250,235,${a})`;
        const z = Math.max(2, Math.round(bs * 0.15)) * s.s;
        ctx.fillRect(Math.round(sx), Math.round(sy), z, z);
      }
    }

    // Sun and moon on a shared arc, snapped to the block grid
    const orb = (phase, colA, colB, isMoon) => {
      const a = phase * Math.PI * 2;
      const ox = Math.round((w / 2 - Math.cos(a) * w * 0.44) / bs) * bs;
      const oy = Math.round((h * 0.64 - Math.sin(a) * h * 0.52) / bs) * bs;
      if (Math.sin(a) < -0.15) return;
      const z = bs * 4;
      if (!layered) orbGlow(ctx, ox, oy, z, isMoon);
      ctx.fillStyle = colB;
      ctx.fillRect(ox - z / 2 - bs / 2, oy - z / 2 - bs / 2, z + bs, z + bs);
      ctx.fillStyle = colA;
      ctx.fillRect(ox - z / 2, oy - z / 2, z, z);
      if (isMoon) {
        ctx.fillStyle = 'rgba(120,130,160,0.5)';
        ctx.fillRect(ox - bs * 1.2, oy - bs, bs, bs);
        ctx.fillRect(ox + bs * 0.4, oy + bs * 0.5, bs * 0.8, bs * 0.8);
      }
    };
    orb(tod, '#fff6c4', 'rgba(255,214,107,0.6)', false);
    orb((tod + 0.5) % 1, '#e8ebf2', 'rgba(200,210,235,0.35)', true);

    // Clouds
    const cloudCol = lerp(lerp(H('#2a3350'), H('#ffffff'), day), H('#ffb48a'), dusk * 0.6).map((v) => Math.round(v / 12) * 12);
    const cloudHex = '#' + cloudCol.map((v) => Math.min(255, v).toString(16).padStart(2, '0')).join('');
    const drawClouds = (front) => {
      const tex = Blocks.get('wool', cloudHex, 1);
      ctx.globalAlpha = front ? 0.55 : 0.9;
      for (const c of clouds) {
        if (c.front !== front) continue;
        const ox = Math.round(c.x - par.x * bs * (front ? 6 : 2)), oy = Math.round(c.y);
        for (const [x, y] of c.cells) ctx.drawImage(tex, ox + x * bs, oy + y * bs, bs, bs);
      }
      ctx.globalAlpha = 1;
    };
    drawClouds(false);

    // ---- world layer ----
    wctx.clearRect(0, 0, w, h);
    wctx.drawImage(stat, 0, 0);
    const frame = Math.floor(t * 6) % 8;
    for (const b of waterCells) wctx.drawImage(Blocks.get('water', b.color, 1, (frame + b.x) % 8), b.x * bs, b.y * bs, bs, bs);
    // Waterfall: falls past the island and fades into the sky below
    for (let y = fall.y0; y < rows; y++) {
      const fade = y <= fall.bottom ? 1 : Math.max(0, 1 - (y - fall.bottom) / (rows * 0.3));
      if (fade <= 0) break;
      wctx.globalAlpha = fade;
      wctx.drawImage(Blocks.get('waterfall', C.water, 1, (frame + 8 - (y % 8)) % 8), fall.x * bs, y * bs, bs, bs);
    }
    wctx.globalAlpha = 1;
    for (const s of smoke) {
      const z = bs * (s.s + s.age * 0.18);
      wctx.fillStyle = `rgba(${night > 0.5 ? '90,90,100' : '200,200,205'},${0.55 * (1 - s.age / 4)})`;
      wctx.fillRect(Math.round(s.x - z / 2), Math.round(s.y - z / 2), Math.round(z), Math.round(z));
    }

    // Warm wash at golden hour
    wctx.globalCompositeOperation = 'source-atop';
    if (dusk > 0.02) {
      wctx.fillStyle = `rgba(255,120,60,${0.26 * dusk})`;
      wctx.fillRect(0, 0, w, h);
    }
    // Block lightmap: night darkness minus light from lanterns, the window and glowstone
    const dark = night * (layered ? 0.6 : 0.72);
    const flick = 0.92 + 0.08 * Math.sin(t * 9) * Math.sin(t * 5.3);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        let lit = 0, lr = 0, lg = 0, lb = 0;
        for (const L of lights) {
          const d = Math.hypot(x - L.x, y - L.y);
          if (d > L.r) continue;
          const k = Math.pow(1 - d / L.r, 1.4) * L.k * flick;
          lit += k;
          lr += L.c[0] * k;
          lg += L.c[1] * k;
          lb += L.c[2] * k;
        }
        const i = (y * cols + x) * 4;
        const a = dark * (1 - Math.min(1, lit));
        const warm = Math.min(1, lit) * night * 0.35;
        // Mix "night blue" darkness with a warm light tint into one overlay pixel
        const tot = a + warm || 1;
        lightImg.data[i] = (12 * a + (lr / (lit || 1)) * warm) / tot;
        lightImg.data[i + 1] = (16 * a + (lg / (lit || 1)) * warm) / tot;
        lightImg.data[i + 2] = (38 * a + (lb / (lit || 1)) * warm) / tot;
        lightImg.data[i + 3] = Math.min(255, (a + warm) * 255);
      }
    }
    lightX.putImageData(lightImg, 0, 0);
    wctx.drawImage(lightC, 0, 0, cols * bs, rows * bs);
    wctx.globalCompositeOperation = 'source-over';

    const bob = Math.round(Math.sin(t * 0.6) * bs * 0.3);
    // Debris behind the island
    for (const d of debris) {
      const z = bs * d.s;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(Blocks.get(d.kind, d.kind === 'grass' ? C.grass[0] : d.kind === 'dirt' ? C.dirt : C.cobble, 0.9),
        Math.round(d.x - par.x * bs), Math.round(d.y + Math.sin(t * 0.8 + d.p) * bs * 0.5), z, z);
      ctx.fillStyle = `rgba(10,14,35,${night * 0.6})`;
      ctx.fillRect(Math.round(d.x - par.x * bs), Math.round(d.y + Math.sin(t * 0.8 + d.p) * bs * 0.5), z, z);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(worldC, 0, bob);

    // Glows (additive) at night
    if (night > 0.05) {
      ctx.globalCompositeOperation = 'lighter';
      // (ASCII mode skips the halos: the lightmap already warms the blocks, and halos smear into glyph blobs)
      for (const L of layered ? [] : lights) {
        const x = (L.x + 0.5) * bs, y = (L.y + 0.5) * bs + bob;
        const r = bs * L.r * 0.9;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(${L.c.join(',')},${0.35 * night * flick})`);
        g.addColorStop(1, `rgba(${L.c.join(',')},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // Fireflies
      for (const f of flies) {
        const fx2 = (f.ax + 3 * noise2(t * 0.15, f.p)) * bs, fy2 = (f.ay + 2 * noise2(f.p, t * 0.15)) * bs + bob;
        const a = night * Math.max(0, Math.sin(t * 2 + f.p)) * 0.9;
        const z = Math.max(2, Math.round(bs * 0.22));
        ctx.fillStyle = `rgba(220,255,120,${a})`;
        ctx.fillRect(Math.round(fx2), Math.round(fy2), z, z);
        ctx.fillStyle = `rgba(220,255,120,${a * 0.15})`;
        ctx.fillRect(Math.round(fx2 - z), Math.round(fy2 - z), z * 3, z * 3);
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    // Falling leaves
    for (const l of leaves) {
      const z = Math.max(2, Math.round(bs * 0.3));
      ctx.fillStyle = rgba(l.c, Math.min(1, (14 - l.age) / 3) * (1 - night * 0.6));
      ctx.fillRect(Math.round(l.x), Math.round(l.y + bob), z, z);
    }
    drawClouds(true);
  }

  return { update, draw, drawBackground };
}
createIsle.ascii = true;
