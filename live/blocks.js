// Procedural 16x16 block textures in a Minecraft-ish style.
// Blocks.get(kind, hex, shade, frame) returns a cached canvas; draw it scaled with smoothing off.
const Blocks = (() => {
  const cache = new Map();
  const SOLID = new Set([
    'smooth', 'stone', 'dirt', 'grass', 'snow', 'sand', 'ore', 'cobble', 'mossy', 'plank',
    'log', 'brick', 'wool', 'glowstone', 'roof', 'door',
  ]);
  const DIRT = [134, 96, 67];
  const STONE = [125, 125, 125];

  function seedOf(str) {
    let h = 2166136261;
    for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
    return h >>> 0;
  }

  // Smooth 16x16 value noise built from a coarse random lattice (tiles seamlessly).
  function lattice(r, n = 4) {
    const g = Array.from({ length: n * n }, () => r());
    return (x, y) => {
      const fx = (x / 16) * n, fy = (y / 16) * n;
      const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const at = (i, j) => g[((j + n) % n) * n + ((i + n) % n)];
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx;
      const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      return a + (b - a) * ty;
    };
  }

  const GEN = {
    smooth(px, r) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, 0.92 + r() * 0.14);
    },
    stone(px, r, f, base) {
      const v = lattice(r);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, 0.82 + 0.26 * v(x, y) + r() * 0.07, 255, base);
      // hairline cracks
      for (let c = 0; c < 2; c++) {
        let x = Math.floor(r() * 16), y = Math.floor(r() * 16);
        for (let i = 0; i < 5; i++) {
          px(x & 15, y & 15, 0.66, 255, base);
          x += r() < 0.5 ? 1 : 0;
          y += r() < 0.6 ? 1 : 0;
        }
      }
    },
    dirt(px, r, f, base) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, 0.84 + r() * 0.2, 255, base);
      for (let i = 0; i < 7; i++) {
        const x = Math.floor(r() * 15), y = Math.floor(r() * 15), k = r() < 0.5 ? 1.22 : 0.68;
        px(x, y, k, 255, base);
        if (r() < 0.6) px(x + 1, y, k * 0.95, 255, base);
      }
    },
    grass(px, r, f, base) {
      GEN.dirt(px, r, f, DIRT);
      for (let x = 0; x < 16; x++) {
        const d = 3 + (r() < 0.5 ? 1 : 0) + (r() < 0.2 ? 2 : 0);
        for (let y = 0; y < d; y++) px(x, y, (y === d - 1 ? 0.72 : 0.86) + r() * 0.24, 255, base);
      }
    },
    snow(px, r, f, base) {
      GEN.stone(px, r, f, STONE);
      for (let x = 0; x < 16; x++) {
        const d = 5 + (r() < 0.5 ? 1 : 0) + (r() < 0.25 ? 2 : 0);
        for (let y = 0; y < d; y++) px(x, y, (y === d - 1 ? 0.85 : 0.95) + r() * 0.06, 255, base);
      }
    },
    sand(px, r) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const q = r();
          px(x, y, q < 0.06 ? 1.15 : q < 0.12 ? 0.8 : 0.92 + r() * 0.12);
        }
      }
    },
    ore(px, r, f, base) {
      GEN.stone(px, r, f, STONE);
      for (let c = 0; c < 4; c++) {
        const ox = 1 + Math.floor(r() * 12), oy = 1 + Math.floor(r() * 12);
        const cells = [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1], [1, 2]].filter(() => r() < 0.75);
        for (const [dx, dy] of cells) px(ox + dx, oy + dy, dx + dy === 0 ? 1.25 : 0.85 + r() * 0.2);
      }
    },
    cobble(px, r, f, base, mossy) {
      const pts = Array.from({ length: 7 }, () => [r() * 16, r() * 16, 0.82 + r() * 0.32]);
      const moss = lattice(r, 3);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          let d1 = 1e9, d2 = 1e9, tone = 1;
          for (const [qx, qy, k] of pts) {
            for (const ox of [-16, 0, 16]) for (const oy of [-16, 0, 16]) {
              const d = Math.hypot(x - qx - ox, y - qy - oy);
              if (d < d1) { d2 = d1; d1 = d; tone = k; } else if (d < d2) d2 = d;
            }
          }
          const edge = d2 - d1 < 1.1;
          if (mossy && moss(x, y) > 0.55 && r() < 0.85) px(x, y, 0.8 + r() * 0.3, 255, [92, 128, 58]);
          else px(x, y, edge ? 0.55 : tone * (0.92 + r() * 0.12) * (d1 < 1.5 ? 1.08 : 1));
        }
      }
    },
    mossy(px, r, f, base) {
      GEN.cobble(px, r, f, base, true);
    },
    plank(px, r) {
      const seams = [0, 1, 2, 3].map(() => 2 + Math.floor(r() * 12));
      const tone = [0, 1, 2, 3].map(() => 0.9 + r() * 0.16);
      for (let y = 0; y < 16; y++) {
        const row = y >> 2;
        for (let x = 0; x < 16; x++) {
          let k = tone[row] * (0.94 + r() * 0.09);
          if (r() < 0.1) k *= 0.86;
          if (y % 4 === 3) k *= 0.6;
          if (x === seams[row]) k *= 0.68;
          if ((x === seams[row] + 1 || x === seams[row] - 2) && y % 4 === 1) k *= 0.72; // nail heads
          px(x, y, k);
        }
      }
    },
    log(px, r) {
      const col = Array.from({ length: 16 }, () => 0.86 + r() * 0.18);
      for (let x = 0; x < 16; x++) {
        const groove = x % 4 === 0 || r() < 0.08;
        for (let y = 0; y < 16; y++) px(x, y, (groove ? 0.62 : col[x]) * (0.95 + r() * 0.08));
      }
    },
    leaves(px, r) {
      const v = lattice(r, 4);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if (r() < 0.13) { px(x, y, 0, 0); continue; }
          px(x, y, 0.62 + 0.45 * v(x, y) + r() * 0.15);
        }
      }
    },
    glass(px, r) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const border = x === 0 || y === 0 || x === 15 || y === 15;
          const streak = (x + y === 6 && x > 1 && x < 5) || (x + y === 24 && x > 10 && x < 14);
          px(x, y, border ? 1.15 : streak ? 1.35 : 1, border || streak ? 255 : 90);
        }
      }
    },
    window(px, r, f, base) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const frame = x < 2 || y < 2 || x > 13 || y > 13 || x === 7 || x === 8 || y === 7 || y === 8;
          if (frame) px(x, y, 0.9 + r() * 0.1, 255, [92, 62, 36]);
          else px(x, y, 0.85 + 0.3 * (1 - y / 16) + r() * 0.05, 255, base);
        }
      }
    },
    brick(px, r) {
      const tones = Array.from({ length: 16 }, () => 0.85 + r() * 0.25);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const row = y >> 2, off = row % 2 ? 4 : 0;
          const mortar = y % 4 === 3 || (x + off) % 8 === 7;
          if (mortar) px(x, y, 1, 255, [170, 160, 150].map((v) => v * (0.85 + r() * 0.1)));
          else px(x, y, tones[row * 2 + (((x + off) >> 3) & 1)] * (0.95 + r() * 0.08));
        }
      }
    },
    roof(px, r) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const row = y >> 2, off = row % 2 ? 2 : 0;
          const lip = y % 4 === 3, gap = (x + off) % 4 === 0;
          px(x, y, lip ? 0.55 : gap ? 0.78 : 0.95 + r() * 0.12);
        }
      }
    },
    door(px, r) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          let k = 0.9 + r() * 0.1;
          if (x === 0 || x === 15 || x === 7) k = 0.6;
          if (x === 12 && (y === 8 || y === 9)) k = 1.6;
          px(x, y, k);
        }
      }
    },
    water(px, r, f) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const wave = Math.sin((x + f * 2) * 0.7 + y * 1.4) + Math.sin((x - f) * 0.4 - y * 0.6);
          px(x, y, (y === 0 ? 1.3 : 0.86) + wave * 0.06 + r() * 0.03, 215);
        }
      }
    },
    waterfall(px, r, f) {
      const off = Array.from({ length: 16 }, () => Math.floor(r() * 16));
      const tone = Array.from({ length: 16 }, () => 0.85 + r() * 0.15);
      for (let x = 0; x < 16; x++) {
        for (let y = 0; y < 16; y++) {
          const streak = (y - f * 4 + off[x] + 64) % 9 < 2;
          px(x, y, tone[x] * (streak ? 1.32 : 0.95), 225);
        }
      }
    },
    wool(px, r) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, 0.92 + 0.05 * ((x + y) % 2) + r() * 0.04);
    },
    glowstone(px, r) {
      const v = lattice(r, 5);
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const q = v(x, y);
          px(x, y, q > 0.62 ? 1.25 : q < 0.3 ? 0.62 : 0.95 + r() * 0.1);
        }
      }
    },
    lantern(px, r, f, base) {
      const IRON = [58, 58, 68];
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          if ((y === 1 || y === 2) && (x === 7 || x === 8)) px(x, y, 1, 255, IRON);
          else if (y >= 3 && y <= 14 && x >= 4 && x <= 11) {
            const frame = y === 3 || y === 14 || x === 4 || x === 11;
            if (frame) px(x, y, 1, 255, IRON);
            else px(x, y, 1.05 + 0.25 * (1 - Math.abs(y - 9) / 6) + r() * 0.05);
          } else px(x, y, 0, 0);
        }
      }
    },
    flower(px, r, f, base) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, 0, 0);
      for (let y = 8; y < 16; y++) px(7 + (y % 3 === 0 ? 1 : 0), y, 0.9, 255, [60, 130, 40]);
      px(9, 11, 1, 255, [70, 150, 45]);
      px(10, 10, 1, 255, [70, 150, 45]);
      for (const [dx, dy] of [[0, -2], [-2, 0], [2, 0], [0, 2], [-1, -1], [1, -1], [-1, 1], [1, 1]]) px(7 + dx, 6 + dy, 0.9 + r() * 0.2);
      px(7, 6, 1, 255, [250, 220, 70]);
    },
    tallgrass(px, r, f, base) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, 0, 0);
      for (let b = 0; b < 6; b++) {
        let x = 2 + Math.floor(r() * 12);
        const top = 4 + Math.floor(r() * 9);
        for (let y = 15; y >= top; y--) {
          px(x, y, 0.75 + (15 - y) * 0.03 + r() * 0.1);
          if (r() < 0.2) x = Math.max(0, Math.min(15, x + (r() < 0.5 ? -1 : 1)));
        }
      }
    },
    roots(px, r, f, base) {
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(x, y, 0, 0);
      for (let b = 0; b < 3; b++) {
        let x = 2 + Math.floor(r() * 12);
        const len = 6 + Math.floor(r() * 10);
        for (let y = 0; y < len; y++) {
          px(x, y, 0.8 + r() * 0.3);
          if (r() < 0.3) x = Math.max(0, Math.min(15, x + (r() < 0.5 ? -1 : 1)));
        }
      }
    },
    fence(px, r) {
      for (let y = 0; y < 16; y++) {
        for (let x = 0; x < 16; x++) {
          const post = x >= 6 && x <= 9;
          px(x, y, post ? (x === 6 ? 1.1 : x === 9 ? 0.75 : 0.95) * (0.95 + r() * 0.08) : 0, post ? 255 : 0);
        }
      }
    },
  };

  function get(kind, hex, shade = 1, frame = 0) {
    const key = `${kind}|${hex}|${shade}|${frame}`;
    let c = cache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 16;
    const cx = c.getContext('2d');
    const img = cx.createImageData(16, 16);
    const d = img.data;
    const r = mulberry32(seedOf(`${kind}|${hex}|${shade}`)); // same grain across animation frames
    const base = hexToRgb(hex);
    const px = (x, y, k, a = 255, col = base) => {
      const i = (y * 16 + x) * 4;
      d[i] = col[0] * k * shade;
      d[i + 1] = col[1] * k * shade;
      d[i + 2] = col[2] * k * shade;
      d[i + 3] = a;
    };
    (GEN[kind] || GEN.smooth)(px, r, frame, base);
    if (SOLID.has(kind)) {
      // Bevel: light top/left rim, dark bottom/right rim
      for (let i = 0; i < 16; i++) {
        for (const [x, y, k] of [[i, 0, 1.1], [0, i, 1.06], [i, 15, 0.78], [15, i, 0.84]]) {
          const j = (y * 16 + x) * 4;
          d[j] *= k;
          d[j + 1] *= k;
          d[j + 2] *= k;
        }
      }
    }
    cx.putImageData(img, 0, 0);
    cache.set(key, c);
    return c;
  }

  return { get };
})();
