// Dunes — layered hills dissolving into a peach sunset haze.
WALLPAPERS.dunes = {
  title: 'Dunes',
  seed: 42,
  draw(ctx, w, h, rng) {
    const { fbm } = makeNoise(rng);
    const portrait = h > w;

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#2b1d4a');
    sky.addColorStop(0.3, '#8a3f6b');
    sky.addColorStop(0.52, '#f08a6c');
    sky.addColorStop(0.68, '#ffd3a1');
    sky.addColorStop(1, '#ffe9cf');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Sun with halo
    const sx = w * (portrait ? 0.5 : 0.62);
    const sy = h * (portrait ? 0.5 : 0.47);
    const sr = Math.min(w, h) * (portrait ? 0.16 : 0.11);
    const halo = ctx.createRadialGradient(sx, sy, sr * 0.8, sx, sy, sr * 6);
    halo.addColorStop(0, 'rgba(255,224,170,0.75)');
    halo.addColorStop(0.3, 'rgba(255,170,130,0.25)');
    halo.addColorStop(1, 'rgba(255,150,120,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    const disc = ctx.createLinearGradient(0, sy - sr, 0, sy + sr);
    disc.addColorStop(0, '#fff6d8');
    disc.addColorStop(1, '#ffc58a');
    ctx.fillStyle = disc;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();

    // Thin horizontal clouds sliding across the sun
    for (let i = 0; i < 9; i++) {
      const cy = h * (0.18 + rng() * 0.38);
      const cw = w * (0.2 + rng() * 0.5);
      const cx = rng() * w - cw * 0.3;
      const ch = Math.min(w, h) * (0.004 + rng() * 0.01);
      const g = ctx.createLinearGradient(cx, 0, cx + cw, 0);
      const c = cy < h * 0.35 ? '255,170,180' : '255,220,190';
      g.addColorStop(0, `rgba(${c},0)`);
      g.addColorStop(0.5, `rgba(${c},${0.35 + rng() * 0.35})`);
      g.addColorStop(1, `rgba(${c},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx + cw / 2, cy, cw / 2, ch, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dune layers, far (hazy) to near (deep plum)
    const layers = 8;
    const far = '#f5b49a';
    const near = '#1e1233';
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1);
      const base = h * (0.56 + Math.pow(t, 1.15) * 0.4);
      const amp = h * (0.03 + t * 0.07);
      const freq = 1.2 + t * 1.6;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 3) {
        const n = fbm((x / w) * freq + i * 3.7, i * 1.9, 4, 2, 0.42);
        ctx.lineTo(x, base - amp * (n + 0.5));
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const top = base - amp;
      const g = ctx.createLinearGradient(0, top, 0, top + h * 0.2);
      const c = ramp([far, '#d4707a', '#7a3a6e', near], t);
      g.addColorStop(0, c);
      g.addColorStop(1, ramp([far, '#d4707a', '#7a3a6e', near], Math.min(1, t + 0.18)));
      ctx.fillStyle = g;
      ctx.fill();

      // Rim light on each crest
      ctx.strokeStyle = `rgba(255,214,170,${0.35 * (1 - t) + 0.05})`;
      ctx.lineWidth = Math.max(1, Math.min(w, h) * 0.0012);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 3) {
        const n = fbm((x / w) * freq + i * 3.7, i * 1.9, 4, 2, 0.42);
        const y = base - amp * (n + 0.5);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    grain(ctx, w, h, rng, 12);
  },
};
