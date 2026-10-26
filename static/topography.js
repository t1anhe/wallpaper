// Topography — hypsometric contour map of an imaginary island chain.
WALLPAPERS.topography = {
  title: 'Topography',
  seed: 314,
  draw(ctx, w, h, rng) {
    const { fbm } = makeNoise(rng);
    const u = Math.min(w, h) / 2160;
    const cell = Math.max(3, Math.round(5 * u));
    const gw = Math.ceil(w / cell) + 1;
    const gh = Math.ceil(h / cell) + 1;
    const scale = 2.6 / Math.max(w, h);

    // Height field with domain warping for organic coastlines
    const field = new Float32Array(gw * gh);
    for (let j = 0; j < gh; j++) {
      for (let i = 0; i < gw; i++) {
        const x = i * cell * scale;
        const y = j * cell * scale;
        const wx = fbm(x + 5.2, y + 1.3, 3);
        const wy = fbm(x + 1.7, y + 9.2, 3);
        field[j * gw + i] = fbm(x + wx * 1.4, y + wy * 1.4, 6) + 0.5;
      }
    }

    // Banded fill (water -> lowland -> highland), drawn per cell
    const bands = 22;
    const stops = ['#0b1f2a', '#123744', '#1d5a5a', '#3e7d68', '#8aa978', '#d8cf9c', '#efe6c8'];
    const img = ctx.createImageData(w, h);
    const colorCache = [];
    for (let b = 0; b <= bands; b++) {
      const m = ramp(stops, b / bands).match(/\d+/g).map(Number);
      colorCache.push(m);
    }
    for (let y = 0; y < h; y++) {
      const fj = y / cell;
      const j = Math.floor(fj);
      const ty = fj - j;
      for (let x = 0; x < w; x++) {
        const fi = x / cell;
        const i = Math.floor(fi);
        const tx = fi - i;
        const a = field[j * gw + i];
        const b = field[j * gw + i + 1];
        const c = field[(j + 1) * gw + i];
        const d = field[(j + 1) * gw + i + 1];
        const v = (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
        const band = Math.max(0, Math.min(bands, Math.floor(v * bands)));
        const col = colorCache[band];
        const k = (y * w + x) * 4;
        img.data[k] = col[0];
        img.data[k + 1] = col[1];
        img.data[k + 2] = col[2];
        img.data[k + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Marching squares contour lines
    const levels = bands * 2;
    const edge = (v0, v1, t) => (t - v0) / (v1 - v0);
    for (let l = 1; l < levels; l++) {
      const t = l / levels;
      const major = l % 4 === 0;
      ctx.strokeStyle = t < 0.36 ? `rgba(160,220,230,${major ? 0.3 : 0.12})` : `rgba(20,30,25,${major ? 0.45 : 0.2})`;
      ctx.lineWidth = (major ? 2.2 : 1) * u;
      ctx.beginPath();
      for (let j = 0; j < gh - 1; j++) {
        for (let i = 0; i < gw - 1; i++) {
          const a = field[j * gw + i];
          const b = field[j * gw + i + 1];
          const c = field[(j + 1) * gw + i + 1];
          const d = field[(j + 1) * gw + i];
          const idx = (a > t ? 8 : 0) | (b > t ? 4 : 0) | (c > t ? 2 : 0) | (d > t ? 1 : 0);
          if (idx === 0 || idx === 15) continue;
          const x = i * cell;
          const y = j * cell;
          const top = [x + cell * edge(a, b, t), y];
          const right = [x + cell, y + cell * edge(b, c, t)];
          const bottom = [x + cell * edge(d, c, t), y + cell];
          const left = [x, y + cell * edge(a, d, t)];
          const segs = {
            1: [[left, bottom]], 2: [[bottom, right]], 3: [[left, right]], 4: [[top, right]],
            5: [[left, top], [bottom, right]], 6: [[top, bottom]], 7: [[left, top]], 8: [[left, top]],
            9: [[top, bottom]], 10: [[left, bottom], [top, right]], 11: [[top, right]], 12: [[left, right]],
            13: [[bottom, right]], 14: [[left, bottom]],
          }[idx];
          for (const [p, q] of segs) {
            ctx.moveTo(p[0], p[1]);
            ctx.lineTo(q[0], q[1]);
          }
        }
      }
      ctx.stroke();
    }

    vignette(ctx, w, h, 0.45, '5,15,20');
    grain(ctx, w, h, rng, 10);
  },
};
