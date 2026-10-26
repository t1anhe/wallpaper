// Aurora — northern lights curtains over a starry polar night.
WALLPAPERS.aurora = {
  title: 'Aurora',
  seed: 7,
  asciiGain: 2.2,
  asciiBlack: 10,
  draw(ctx, w, h, rng) {
    const { noise2, fbm } = makeNoise(rng);
    const u = Math.min(w, h) / 2160;

    // Night sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#02030b');
    sky.addColorStop(0.55, '#06122a');
    sky.addColorStop(1, '#0b2a3d');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Stars
    for (let i = 0; i < (w * h) / 2600; i++) {
      const x = rng() * w;
      const y = rng() * h * 0.85;
      const r = Math.pow(rng(), 6) * 2.4 * u + 0.4 * u;
      ctx.fillStyle = `rgba(230,240,255,${0.25 + rng() * 0.7})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // Aurora curtains: thin vertical strokes whose base follows a noise curve.
    ctx.globalCompositeOperation = 'lighter';
    const ribbons = [
      { y: 0.42, amp: 0.16, len: 0.42, hue: ['#2bffb1', '#17c3b2', '#6a4cff'], a: 0.05, k: 0 },
      { y: 0.5, amp: 0.12, len: 0.3, hue: ['#7dffcf', '#1fd1a5', '#2a6bff'], a: 0.06, k: 10 },
      { y: 0.34, amp: 0.1, len: 0.25, hue: ['#b6ff8a', '#3cf0a0', '#c04cff'], a: 0.035, k: 20 },
    ];
    const step = Math.max(1, Math.round(1.5 * u));
    for (const rb of ribbons) {
      for (let x = 0; x < w; x += step) {
        const nx = x / w;
        const base = h * (rb.y + rb.amp * fbm(nx * 2.2, rb.k, 4));
        const intensity = Math.pow(Math.max(0, 0.5 + noise2(nx * 6, rb.k + 3) * 0.9), 1.6);
        const len = h * rb.len * (0.6 + 0.6 * (fbm(nx * 9, rb.k + 7, 3) + 0.5));
        if (intensity <= 0.01) continue;
        const g = ctx.createLinearGradient(0, base, 0, base - len);
        g.addColorStop(0, rgba(rb.hue[0], 0));
        g.addColorStop(0.04, rgba(rb.hue[0], rb.a * intensity * 2.2));
        g.addColorStop(0.35, rgba(rb.hue[1], rb.a * intensity));
        g.addColorStop(1, rgba(rb.hue[2], 0));
        ctx.fillStyle = g;
        ctx.fillRect(x, base - len, step, len);
      }
    }

    // Soft glow over the whole curtain
    const glow = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.max(w, h) * 0.6);
    glow.addColorStop(0, 'rgba(40,200,150,0.12)');
    glow.addColorStop(1, 'rgba(40,200,150,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';

    // Mountain silhouettes with a sliver of reflected light on the snow
    const ranges = [
      { base: 0.8, amp: 0.12, color: '#0a1a2b', f: 3 },
      { base: 0.86, amp: 0.08, color: '#06111d', f: 5 },
      { base: 0.93, amp: 0.05, color: '#02070e', f: 8 },
    ];
    ranges.forEach((m, i) => {
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) {
        const n = fbm((x / w) * m.f + i * 13, i * 5.1, 6);
        const ridge = 1 - Math.abs(n * 2);
        ctx.lineTo(x, h * (m.base - m.amp * ridge));
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const g = ctx.createLinearGradient(0, h * (m.base - m.amp), 0, h);
      g.addColorStop(0, i === 0 ? '#1c3b4f' : m.color);
      g.addColorStop(0.25, m.color);
      g.addColorStop(1, '#010308');
      ctx.fillStyle = g;
      ctx.fill();
    });

    vignette(ctx, w, h, 0.55);
    grain(ctx, w, h, rng, 9);
  },
};
