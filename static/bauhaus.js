// Bauhaus — a quilt of geometric tiles on warm paper.
WALLPAPERS.bauhaus = {
  title: 'Bauhaus',
  seed: 1919,
  draw(ctx, w, h, rng) {
    const paper = '#f2eadb';
    const palette = ['#d9603b', '#e8b04b', '#2a6f6b', '#1d2a44', '#e9a7a0', '#f2eadb'];
    const pick = (exclude) => {
      let c;
      do c = palette[Math.floor(rng() * palette.length)];
      while (c === exclude);
      return c;
    };

    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, w, h);

    const cols = w > h ? 12 : 6;
    const s = Math.ceil(w / cols);
    const rows = Math.ceil(h / s);
    const oy = (h - rows * s) / 2;

    const shapes = [
      // quarter circle anchored in a corner
      (x, y, c) => {
        const corner = Math.floor(rng() * 4);
        const cx = x + (corner & 1 ? s : 0);
        const cy = y + (corner & 2 ? s : 0);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, s, (corner * Math.PI) / 2, (corner * Math.PI) / 2 + Math.PI * 2);
        ctx.fill();
      },
      // half circle on an edge
      (x, y, c) => {
        const r = Math.floor(rng() * 4);
        ctx.save();
        ctx.translate(x + s / 2, y + s / 2);
        ctx.rotate((r * Math.PI) / 2);
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(0, s / 2, s / 2, Math.PI, 0);
        ctx.fill();
        ctx.restore();
      },
      // full circle with optional inner dot
      (x, y, c, bg) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x + s / 2, y + s / 2, s * 0.38, 0, Math.PI * 2);
        ctx.fill();
        if (rng() < 0.5) {
          ctx.fillStyle = pick(c);
          ctx.beginPath();
          ctx.arc(x + s / 2, y + s / 2, s * 0.14, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      // diagonal triangle
      (x, y, c) => {
        const flip = rng() < 0.5;
        ctx.fillStyle = c;
        ctx.beginPath();
        if (flip) {
          ctx.moveTo(x, y);
          ctx.lineTo(x + s, y);
          ctx.lineTo(x, y + s);
        } else {
          ctx.moveTo(x + s, y);
          ctx.lineTo(x + s, y + s);
          ctx.lineTo(x, y + s);
        }
        ctx.fill();
      },
      // stripes
      (x, y, c) => {
        const n = 4;
        const vertical = rng() < 0.5;
        ctx.fillStyle = c;
        for (let i = 0; i < n; i++) {
          const o = (i * s) / n + s / (n * 4);
          if (vertical) ctx.fillRect(x + o, y, s / (n * 2), s);
          else ctx.fillRect(x, y + o, s, s / (n * 2));
        }
      },
      // concentric arcs (rainbow)
      (x, y, c, bg) => {
        const corner = Math.floor(rng() * 4);
        const cx = x + (corner & 1 ? s : 0);
        const cy = y + (corner & 2 ? s : 0);
        const cols = [c, bg, pick(c), bg];
        for (let i = 0; i < 4; i++) {
          ctx.fillStyle = cols[i];
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, s * (1 - i * 0.25), 0, Math.PI * 2);
          ctx.fill();
        }
      },
    ];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * s;
        const y = oy + r * s;
        const bg = rng() < 0.55 ? paper : pick(paper);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, s, s);
        ctx.clip();
        ctx.fillStyle = bg;
        ctx.fillRect(x, y, s, s);
        if (rng() < 0.9) shapes[Math.floor(rng() * shapes.length)](x, y, pick(bg), bg);
        ctx.restore();
      }
    }

    // Print-like texture: slight paper tint + heavy grain
    ctx.fillStyle = 'rgba(120,90,40,0.05)';
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, rng, 22);
  },
};
