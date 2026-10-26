// Shoal — koi made of ASCII glyph tiles swimming over a faint grid.
// Params: ?theme=light for the monochrome shark-on-paper look, ?fish=N to set the count.
function createShoal({ w, h, rng, params }) {
  const light = params.get('theme') === 'light';
  const { noise2 } = makeNoise(rng);
  const cs = Math.max(7, Math.round(Math.min(w, h) / 100));
  const cols = Math.ceil(w / cs);
  const rows = Math.ceil(h / cs);
  const GLYPHS = '.:;+tox%S8X#@';

  const theme = light
    ? {
        bg: '#f3f3f1', grid: 'rgba(0,0,0,0.045)', dust: '60,60,66', inkDark: '#1d1f24', inkLight: '#f6f6f4',
        palettes: [
          ['#8d929b', '#3f434b'], ['#b9bdc4', '#6b7079'], ['#5d626b', '#a9adb5'], ['#9aa0a8', '#2f3238'],
        ],
      }
    : {
        bg: '#0d0d0e', grid: 'rgba(255,255,255,0.045)', dust: '235,225,210', inkDark: '#1b1412', inkLight: '#f1e8dc',
        palettes: [
          ['#c9573f', '#e8dfd2'], // koi: terracotta + cream
          ['#b39445', '#6f6a3a'], // gold + olive
          ['#ded7cc', '#a3483a'], // cream + rust
          ['#e07a5f', '#8f3527'], // ember
          ['#9c9389', '#d8cfc2'], // stone
        ],
      };

  // Static backdrop: paper/ink + grid, rendered once.
  const back = document.createElement('canvas');
  back.width = w;
  back.height = h;
  const bctx = back.getContext('2d');
  bctx.fillStyle = theme.bg;
  bctx.fillRect(0, 0, w, h);
  bctx.strokeStyle = theme.grid;
  bctx.lineWidth = 1;
  bctx.beginPath();
  for (let c = 0; c <= cols; c++) {
    bctx.moveTo(c * cs + 0.5, 0);
    bctx.lineTo(c * cs + 0.5, h);
  }
  for (let r = 0; r <= rows; r++) {
    bctx.moveTo(0, r * cs + 0.5);
    bctx.lineTo(w, r * cs + 0.5);
  }
  bctx.stroke();
  if (!light) vignette(bctx, w, h, 0.55);

  const count = +params.get('fish') || Math.max(3, Math.round((cols * rows) / 3900));
  const fish = [];
  for (let i = 0; i < count; i++) fish.push(spawn(i, true));

  function spawn(id, anywhere) {
    const L = 20 + rng() * 20;
    let x, y, heading;
    if (anywhere) {
      x = rng() * w;
      y = rng() * h;
      heading = rng() * Math.PI * 2;
    } else {
      // Enter from a random edge, aimed roughly at the middle.
      const side = Math.floor(rng() * 4);
      x = side === 0 ? -L * cs : side === 1 ? w + L * cs : rng() * w;
      y = side === 2 ? -L * cs : side === 3 ? h + L * cs : rng() * h;
      heading = Math.atan2(h / 2 - y, w / 2 - x) + (rng() - 0.5);
    }
    return {
      id, x, y, heading, L, W: L * (0.16 + rng() * 0.04),
      base: 5.5 + rng() * 3.5, speed: 0, phase: rng() * 10,
      pal: theme.palettes[Math.floor(rng() * theme.palettes.length)],
      hist: [{ x, y }],
    };
  }

  const dust = Array.from({ length: Math.round(cols * rows * 0.006) }, () => ({
    c: Math.floor(rng() * cols), r: Math.floor(rng() * rows), p: rng() * 10, s: 0.3 + rng() * 0.8,
  }));
  const bubbles = [];
  let now = 0;

  // Half-width of the body (in cells) at s in [0,1] from head to tail tip.
  function halfW(s, W) {
    const body = s < 0.88 ? W * Math.pow(Math.sin(Math.PI * Math.min(1, (s + 0.05) / 0.93)), 0.7) * (1 - 0.5 * s) : 0;
    const tail = s > 0.8 ? W * 0.95 * Math.pow((s - 0.8) / 0.2, 1.1) : 0;
    return Math.max(body, tail);
  }

  const N = 28;
  function spine(f, t) {
    const ds = (f.L * cs) / (N - 1);
    const pts = [[f.x, f.y]];
    let px = f.x, py = f.y, need = ds, i = f.hist.length - 1;
    while (pts.length < N) {
      if (i < 0) {
        // Not enough history yet: continue straight back.
        const a = pts[pts.length - 1];
        const b = pts.length > 1 ? pts[pts.length - 2] : [a[0] + Math.cos(f.heading), a[1] + Math.sin(f.heading)];
        const len = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
        pts.push([a[0] + ((a[0] - b[0]) / len) * ds, a[1] + ((a[1] - b[1]) / len) * ds]);
        continue;
      }
      const q = f.hist[i];
      const d = Math.hypot(q.x - px, q.y - py);
      if (d >= need) {
        px += ((q.x - px) * need) / d;
        py += ((q.y - py) * need) / d;
        pts.push([px, py]);
        need = ds;
      } else {
        need -= d;
        px = q.x;
        py = q.y;
        i--;
      }
    }
    // Normals + swimming undulation that grows toward the tail.
    const out = [];
    for (let k = 0; k < N; k++) {
      const a = pts[Math.max(0, k - 1)];
      const b = pts[Math.min(N - 1, k + 1)];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const nx = -(b[1] - a[1]) / len;
      const ny = (b[0] - a[0]) / len;
      const s = k / (N - 1);
      const wig = f.W * cs * 0.28 * Math.pow(s, 1.5) * Math.sin(s * 7 - t * (3 + f.speed * 0.9) + f.phase);
      out.push({ x: pts[k][0] + nx * wig, y: pts[k][1] + ny * wig, nx, ny, s });
    }
    return out;
  }

  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  function update(dt, t, input) {
    for (let i = 0; i < fish.length; i++) {
      let f = fish[i];
      // Each fish chases its own slowly wandering target point.
      const tx = w * (0.5 + 0.7 * noise2(t * 0.04 + f.id * 7.3, 1.3));
      const ty = h * (0.5 + 0.7 * noise2(5.1, t * 0.04 + f.id * 3.1));
      let vx = tx - f.x, vy = ty - f.y;
      const vl = Math.hypot(vx, vy) || 1;
      vx /= vl;
      vy /= vl;
      // Keep some personal space so the shoal spreads out instead of knotting together.
      for (const o of fish) {
        if (o === f) continue;
        const dx = f.x - o.x, dy = f.y - o.y;
        const d = Math.hypot(dx, dy) || 1;
        const room = (f.L + o.L) * cs * 0.7;
        if (d < room) {
          vx += (dx / d) * 2 * (1 - d / room);
          vy += (dy / d) * 2 * (1 - d / room);
        }
      }
      let desired = Math.atan2(vy, vx) + noise2(t * 0.35, f.id * 11) * 0.5;
      let speed = f.base * (0.7 + 0.6 * (noise2(t * 0.3, f.id + 50) + 0.5));
      if (input.active) {
        const dx = f.x - input.x, dy = f.y - input.y;
        const d = Math.hypot(dx, dy);
        if (d < cs * 20) {
          desired = Math.atan2(dy, dx);
          speed *= 1 + 2 * (1 - d / (cs * 20));
        }
      }
      f.speed += (speed - f.speed) * Math.min(1, dt * 2);
      const turn = (input.active ? 1.6 : 0.65) * dt;
      f.heading += Math.max(-turn, Math.min(turn, wrap(desired - f.heading)));
      f.x += Math.cos(f.heading) * f.speed * cs * dt;
      f.y += Math.sin(f.heading) * f.speed * cs * dt;

      const last = f.hist[f.hist.length - 1];
      if (Math.hypot(f.x - last.x, f.y - last.y) > cs * 0.25) {
        f.hist.push({ x: f.x, y: f.y });
        if (f.hist.length > (f.L / 0.25) * 1.4) f.hist.shift();
      }
      if (rng() < dt * 1.5) {
        const tail = f.hist[Math.max(0, f.hist.length - Math.round(f.L / 0.25))];
        bubbles.push({ x: tail.x, y: tail.y, vx: (rng() - 0.5) * cs, vy: -cs * (0.5 + rng()), life: 1 });
      }
      const m = f.L * cs * 2;
      if (f.x < -m || f.x > w + m || f.y < -m || f.y > h + m) fish[i] = spawn(f.id, false);
    }
    if (rng() < dt * 0.7) {
      const f = fish[Math.floor(rng() * fish.length)];
      ripples.push({ x: rng() < 0.5 ? f.x : rng() * w, y: rng() < 0.5 ? f.y : rng() * h, age: 0, life: 2.5 + rng() * 1.5 });
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      ripples[i].age += dt;
      if (ripples[i].age > ripples[i].life) ripples.splice(i, 1);
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt * 0.35;
      if (b.life <= 0) bubbles.splice(i, 1);
    }
    now = t;
  }

  // Per-frame cell buffers
  const depth = new Float32Array(cols * rows);
  const owner = new Int16Array(cols * rows);
  const sv = new Float32Array(cols * rows);
  const lat = new Float32Array(cols * rows);
  const ang = new Float32Array(cols * rows);
  const nxA = new Float32Array(cols * rows);
  const nyA = new Float32Array(cols * rows);
  const gap = Math.max(1, Math.round(cs * 0.09));

  // Glyph that best draws a line at angle a (screen space, y down).
  function rayGlyph(a) {
    const k = Math.round(((a % Math.PI) + Math.PI) % Math.PI / (Math.PI / 4)) % 4;
    return ['-', '\\', '|', '/'][k];
  }

  // Water ripples: rings of dots that expand and fade.
  const ripples = [];
  const spineCache = {};

  function draw(ctx) {
    const t = now;
    ctx.drawImage(back, 0, 0);
    ctx.font = `${Math.round(cs * 0.74)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (const d of dust) {
      const a = Math.max(0, Math.sin(t * d.s + d.p)) * 0.28;
      if (a < 0.02) continue;
      ctx.fillStyle = `rgba(${theme.dust},${a})`;
      ctx.fillText(d.p > 5 ? '.' : ':', d.c * cs + cs / 2, d.r * cs + cs / 2);
    }
    for (const b of bubbles) {
      ctx.fillStyle = `rgba(${theme.dust},${b.life * 0.5})`;
      ctx.fillText(b.life > 0.6 ? 'o' : '.', Math.floor(b.x / cs) * cs + cs / 2, Math.floor(b.y / cs) * cs + cs / 2);
    }

    depth.fill(0);
    owner.fill(-1);
    const eyes = [];
    fish.forEach((f, fi) => {
      const sp = spine(f, t);
      spineCache[f.id] = sp;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of sp) {
        x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
      }
      const pad = (f.W * 1.3 + 2) * cs;
      const c0 = Math.max(0, Math.floor((x0 - pad) / cs)), c1 = Math.min(cols - 1, Math.floor((x1 + pad) / cs));
      const r0 = Math.max(0, Math.floor((y0 - pad) / cs)), r1 = Math.min(rows - 1, Math.floor((y1 + pad) / cs));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const px = c * cs + cs / 2, py = r * cs + cs / 2;
          let best = Infinity, bs = 0, side = 0, seg = sp[0];
          for (let k = 0; k < N - 1; k++) {
            const a = sp[k], b = sp[k + 1];
            const ex = b.x - a.x, ey = b.y - a.y;
            const l2 = ex * ex + ey * ey || 1;
            const u = Math.max(0, Math.min(1, ((px - a.x) * ex + (py - a.y) * ey) / l2));
            const qx = a.x + ex * u - px, qy = a.y + ey * u - py;
            const d2 = qx * qx + qy * qy;
            if (d2 < best) {
              best = d2;
              bs = a.s + (b.s - a.s) * u;
              side = -(qx * a.nx + qy * a.ny);
              seg = a;
            }
          }
          const d = Math.sqrt(best);
          const half = halfW(bs, f.W) * cs;
          const idx = r * cols + c;
          // Tangent (head -> tail) of the nearest spine segment
          const tang = Math.atan2(-seg.nx, seg.ny);
          if (d < half) {
            const dep = 1 - d / half;
            if (dep > depth[idx]) {
              depth[idx] = dep;
              owner[idx] = fi;
              sv[idx] = bs;
              lat[idx] = side / (f.W * cs);
              ang[idx] = tang;
              nxA[idx] = seg.nx;
              nyA[idx] = seg.ny;
            }
          } else if (owner[idx] < 0) {
            // Pectoral fins: a flapping fringe of ray glyphs just behind the head.
            const fin = bs > 0.18 && bs < 0.42 ? Math.sin(((bs - 0.18) / 0.24) * Math.PI) : 0;
            const finW = fin * f.W * cs * (0.45 + 0.25 * Math.sin(t * 5 + f.phase));
            if (d < half + finW) {
              const fade = 1 - (d - half) / (finW + 1);
              ctx.fillStyle = rgba(f.pal[0], 0.25 + 0.3 * fade);
              ctx.fillRect(c * cs + gap * 2, r * cs + gap * 2, cs - gap * 4, cs - gap * 4);
              ctx.fillStyle = rgba(f.pal[0], 0.9);
              ctx.fillText(rayGlyph(tang + Math.sign(side) * 1.0), px, py);
              continue;
            }
            if (d > half + cs * 1.6) continue;
            // Halo: sparse dots that make the silhouette feel like it dissolves into the grid.
            const fade = 1 - (d - half) / (cs * 1.6);
            if (hash3(c, r, Math.floor(t * 4)) < 0.3 * fade) {
              ctx.fillStyle = rgba(f.pal[0], 0.55 * fade);
              ctx.fillText(hash3(r, c) < 0.5 ? '.' : ':', px, py);
            }
          }
        }
      }
      // Eyes sit just behind the snout on both sides.
      const e = sp[2];
      const off = halfW(e.s, f.W) * cs * 0.55;
      eyes.push([e.x + e.nx * off, e.y + e.ny * off, fi], [e.x - e.nx * off, e.y - e.ny * off, fi]);
    });

    const eyeCells = new Set(eyes.map(([x, y]) => Math.floor(y / cs) * cols + Math.floor(x / cs)));

    // Drop shadow on the "pond floor": every body cell darkens the cell one step down-right.
    ctx.fillStyle = light ? 'rgba(0,0,0,0.07)' : 'rgba(0,0,0,0.45)';
    for (let idx = 0; idx < owner.length; idx++) {
      if (owner[idx] < 0) continue;
      const c = idx % cols, r = (idx / cols) | 0;
      ctx.fillRect((c + 1) * cs + gap, (r + 1) * cs + gap, cs - gap * 2, cs - gap * 2);
    }

    const LX = -0.55, LY = -0.83; // light from the top-left
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const fi = owner[idx];
        if (fi < 0) continue;
        const f = fish[fi];
        const dep = depth[idx];
        const s = sv[idx], l = lat[idx];
        const px = c * cs, py = r * cs;
        const isEye = eyeCells.has(idx);
        const tail = s > 0.86;
        const head = s < 0.17;
        const dorsal = !head && !tail && Math.abs(l) < 0.1 && s < 0.8;
        const gill = Math.abs(s - 0.19) * f.L < 0.5 && dep > 0.15;

        // Pattern lives in fish-local coordinates so the patches travel with the body.
        const patch = noise2(s * f.L * 0.16 + f.id * 13.7, l * 1.4 + f.id * 3.3) > 0.12;
        let tile = isEye ? (light ? '#1d1f24' : '#1b1412') : patch ? f.pal[1] : f.pal[0];

        // Rounded-body lighting: the side facing the light is brighter, the far side and rim darker.
        const facing = (nxA[idx] * LX + nyA[idx] * LY) * Math.sign(l || 1);
        let k = (0.72 + 0.34 * Math.sqrt(dep)) * (1 + 0.22 * facing * Math.min(1, Math.abs(l) * 2.2));
        if (head) k *= 0.93;
        if (dorsal) k *= 0.82;
        k *= 0.95 + hash3(c, r, 3) * 0.1;
        const rgbT = hexToRgb(tile).map((v) => Math.min(255, v * (isEye ? 1 : k)));
        const alpha = tail ? 0.25 + dep * 0.5 : 0.35 + 0.65 * Math.pow(dep, 0.45);
        ctx.fillStyle = rgb(rgbT, alpha);
        ctx.fillRect(px + gap, py + gap, cs - gap * 2, cs - gap * 2);
        // Specular glint along the lit flank
        if (!tail && facing > 0.4 && dep > 0.35 && dep < 0.65 && hash3(c, r, Math.floor(t * 2)) < 0.25) {
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          ctx.fillRect(px + gap, py + gap, cs - gap * 2, (cs - gap * 2) * 0.35);
        }

        let g;
        if (isEye) g = 'o';
        else if (tail) g = rayGlyph(ang[idx] + l * 0.9); // fin rays fan out from the peduncle
        else if (gill) g = l > 0 ? ')' : '(';
        else if (dorsal) g = hash3(c, r) < 0.5 ? '=' : '#';
        else if (dep < 0.28) g = GLYPHS[Math.floor((dep / 0.28) * 4 + hash3(c, r) * 1.5)];
        else if (hash3(c, r, Math.floor(t * 6 + fi)) < 0.05) g = GLYPHS[Math.floor(hash3(r, c, t * 6) * GLYPHS.length)];
        else if (!head) {
          // Scales: offset rows of ( ) pairs laid out along the body
          const row = Math.floor(l * f.W * 1.6 + 0.5);
          const along = s * f.L * 0.75 + (row & 1) * 0.5;
          g = along - Math.floor(along) < 0.5 ? '(' : ')';
          if (hash3(c, r, 9) < 0.18) g = 'o';
        } else g = GLYPHS[Math.min(GLYPHS.length - 1, Math.floor((dep * 0.8 + hash3(c, r) * 0.25) * GLYPHS.length))];

        const lum = rgbT[0] * 0.3 + rgbT[1] * 0.59 + rgbT[2] * 0.11;
        ctx.fillStyle = lum > 140 ? rgba(theme.inkDark, 0.78) : rgba(theme.inkLight, isEye ? 0.95 : 0.82);
        ctx.fillText(g, px + cs / 2, py + cs / 2 + gap * 0.3);
      }
    }

    // Barbels: two thin whiskers trailing from the snout
    if (!light) {
      fish.forEach((f) => {
        const sp = spineCache[f.id];
        if (!sp || f.pal[0] === '#9c9389') return;
        const head = sp[0], dx = head.x - sp[1].x, dy = head.y - sp[1].y;
        const dl = Math.hypot(dx, dy) || 1;
        for (const sideSign of [-1, 1]) {
          for (let i = 1; i <= 4; i++) {
            const sway = Math.sin(t * 3 + f.phase + i * 0.6) * 0.4;
            const fx = head.x + (dx / dl) * cs * 0.4 * i - head.nx * sideSign * cs * (0.5 + i * 0.45 + sway);
            const fy = head.y + (dy / dl) * cs * 0.4 * i - head.ny * sideSign * cs * (0.5 + i * 0.45 + sway);
            const cc = Math.floor(fx / cs), rr = Math.floor(fy / cs);
            if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || owner[rr * cols + cc] >= 0) continue;
            ctx.fillStyle = rgba(f.pal[0], 0.7 - i * 0.12);
            ctx.fillText(i < 3 ? '~' : '`', cc * cs + cs / 2, rr * cs + cs / 2);
          }
        }
      });
    }

    // Ripples
    for (const rp of ripples) {
      const rad = rp.age * cs * 4.5;
      const a = (1 - rp.age / rp.life) * 0.4;
      const n = Math.max(8, Math.floor((rad / cs) * 5));
      const seen = new Set();
      ctx.fillStyle = `rgba(${theme.dust},${a})`;
      for (let i = 0; i < n; i++) {
        const th = (i / n) * Math.PI * 2;
        const cc = Math.floor((rp.x + Math.cos(th) * rad) / cs), rr = Math.floor((rp.y + Math.sin(th) * rad * 0.8) / cs);
        const key = rr * cols + cc;
        if (seen.has(key) || cc < 0 || rr < 0 || cc >= cols || rr >= rows || owner[key] >= 0) continue;
        seen.add(key);
        ctx.fillText(rp.age < 0.8 ? 'o' : '.', cc * cs + cs / 2, rr * cs + cs / 2);
      }
    }
  }

  return { update, draw };
}
