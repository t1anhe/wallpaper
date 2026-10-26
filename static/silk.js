// Silk — thousands of particles tracing a noise flow field, like threads of light.
WALLPAPERS.silk = {
  title: 'Silk',
  seed: 2026,
  asciiGain: 4,
  asciiBlack: 14,
  draw(ctx, w, h, rng) {
    const { fbm } = makeNoise(rng);
    const u = Math.min(w, h) / 2160;

    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#0c0a14');
    bg.addColorStop(1, '#14101f');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    const palette = ['#f4c27a', '#f08a6c', '#e85d75', '#f7e3c6', '#9b7bd4'];
    const scale = 1.6 / Math.max(w, h);
    const count = Math.round(9000 * (w * h) / (3840 * 2160));
    const steps = 260;
    const stepLen = 3 * u;

    ctx.lineCap = 'round';
    ctx.globalCompositeOperation = 'lighter';
    for (let p = 0; p < count; p++) {
      let x = rng() * w;
      let y = rng() * h;
      // Colour follows position so the field reads as soft bands, not confetti
      const band = fbm(x * scale * 0.6 + 40, y * scale * 0.6, 2) + 0.5;
      const color = ramp(palette, band + (rng() - 0.5) * 0.15);
      ctx.strokeStyle = color.replace(/,1\)$/, `,${0.05 + rng() * 0.06})`);
      ctx.lineWidth = (0.6 + rng() * 1.2) * u;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < steps; s++) {
        const a = fbm(x * scale, y * scale, 3) * Math.PI * 4;
        x += Math.cos(a) * stepLen;
        y += Math.sin(a) * stepLen;
        if (x < -10 || x > w + 10 || y < -10 || y > h + 10) break;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';

    vignette(ctx, w, h, 0.6);
    grain(ctx, w, h, rng, 8);
  },
};
