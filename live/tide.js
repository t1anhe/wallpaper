// Tide — a beach seen from straight above on a bright day, set in type.
// Swells roll in from the open water, break over a sandbar into lines of foam and run up the sand in
// thin sheets that slide back, leaving it dark and glossy for a moment. The water goes from clear
// turquoise over the sand to deep blue, light ripples across the bottom, and the sun glitters on the
// ripples, thickest towards the sun. Someone walked along the beach earlier. Moving the pointer over
// the water stirs rings.
//
// Every character means something: the sand is dots and commas, the water tildes and dashes, the
// foam bubbles (o O @), the glitter stars. The scene is a WebGL fragment shader evaluated once per
// character cell; a second pass sets each cell's glyph from a font atlas, all on the GPU.
// Time enters the shader only as phases wrapped on the CPU, so it stays smooth however long it runs.
// ?ascii=0 renders the plain picture instead, ?res=<cells across the short side> sets the type size.
function createTide({ w, h, rng, params }) {
  const portrait = h > w;
  const TAU = Math.PI * 2;
  const glyphMode = params.get('ascii') !== '0';
  // The plain picture renders at most ~3.5M pixels and is scaled up; type is always set at full size
  const rs = glyphMode ? 1 : Math.min(1, Math.sqrt(3.5e6 / (w * h)));
  const rw = Math.round(w * rs), rh = Math.round(h * rs);
  const glc = document.createElement('canvas');
  glc.width = rw;
  glc.height = rh;
  const gl = glc.getContext('webgl', { antialias: false, preserveDrawingBuffer: true });
  if (!gl) {
    return {
      update() {},
      draw(ctx) {
        const g = ctx.createLinearGradient(0, h, w, 0);
        g.addColorStop(0, '#e9dcc0');
        g.addColorStop(0.35, '#8fe0d4');
        g.addColorStop(1, '#0d5f92');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      },
    };
  }

  // ---------- the type: cells taller than wide, like a terminal ----------
  const ch = Math.min(rw, rh) / (+params.get('res') || 110);
  const cw = ch * 0.6;
  const cols = Math.ceil(rw / cw), rows = Math.ceil(rh / ch);
  // Glyph indices are fixed: the scene shader picks them by number
  const GLYPHS = " .,:;'`-~=+*oO@0^_%";

  const SCENE = `
precision highp float;
uniform vec2 uO;        // where the mean waterline crosses, render pixels (y up)
uniform float uMpp;     // metres per render pixel
uniform vec2 uN;        // seaward, unit, screen space
uniform float uWave;    // wave phase in waves, wrapped at 256
uniform vec4 uR[8];     // ripples: direction, wavenumber, slope amplitude
uniform float uRp[8];   // ripple phases, radians
uniform float uC[5];    // caustic phases, radians
uniform vec2 uDrift;    // slow wandering offset for foam and glints, metres
uniform vec3 uSun;      // towards the sun
uniform vec3 uCam;      // the camera above the beach, metres
uniform vec4 uRing[6];  // pointer rings: position (m), age (s), strength
uniform vec2 uCellPx;   // glyph mode: size of a character cell, render pixels
uniform vec2 uRes;

const float T = 7.0;    // seconds between waves

float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 h22(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3. - 2. * f);
  return mix(mix(h2(i), h2(i + vec2(1., 0.)), u.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1., 1.)), u.x), u.y);
}
float fbm(vec2 p) {
  float s = 0., a = .5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= .5; }
  return s;
}
// Distance to the wall between the two nearest cells: small along bubble walls
float lace(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float d1 = 8., d2 = 8.;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 r = g + h22(i + g) * .9 + .05 - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return sqrt(d2) - sqrt(d1);
}
// Light focused by the moving surface onto the sandy bottom. The pattern tiles every 2 pi; it is
// evaluated far from the origin, where it is well behaved
float caustic(vec2 q) {
  vec2 p = mod(q, 6.2832) - 250.;
  vec2 i = p;
  float c = 1.;
  for (int n = 0; n < 5; n++) {
    float t = uC[n];
    i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
    c += 1. / length(vec2(p.x / (sin(i.x + t) / .005), p.y / (cos(i.y + t) / .005)));
  }
  c /= 5.;
  c = 1.17 - pow(c, 1.4);
  c = clamp(pow(abs(c), 8.), 0., 1.);
  return c == c ? c : 0.;
}
vec3 waterColour(float d) {
  vec3 c = mix(vec3(.62, .95, .9), vec3(.28, .86, .86), smoothstep(0., .7, d));
  c = mix(c, vec3(.06, .69, .79), smoothstep(.5, 1.7, d));
  c = mix(c, vec3(.03, .50, .72), smoothstep(1.5, 3.4, d));
  c = mix(c, vec3(.02, .31, .57), smoothstep(3., 6.5, d));
  return c;
}
// Foam from an amount f: solid where thick, a ragged lace of bubble walls where thin
float foamOf(float f, vec2 p) {
  vec2 wp = p + 1.2 * vec2(fbm(p * .35 + 3.), fbm(p * .35 + 9.)) + uDrift * .4;
  float brk = fbm(p * .6 + uDrift) - .5;
  float net = 1. - smoothstep(.02, .16, lace(wp * 2.2));
  return max(smoothstep(.55, .9, f + .45 * brk), net * smoothstep(.1, .5, f + .35 * brk) * .85);
}

// Slope of the water surface: wind ripples, the pointer's rings, a fine glitter of facets
vec2 slope(vec2 q) {
  vec2 g = vec2(0.);
  for (int i = 0; i < 8; i++) g += uR[i].xy * uR[i].w * cos(dot(uR[i].xy, q) * uR[i].z - uRp[i]);
  for (int i = 0; i < 6; i++) {
    vec4 r = uRing[i];
    if (r.w <= 0.) continue;
    vec2 d = q - r.xy;
    float l = length(d) + 1e-4, s = l - r.z * 1.4;
    g += d / l * r.w * sin(s * 9.) * exp(-s * s / .5) * exp(-r.z / 2.5);
  }
  return g + .07 * (vec2(vnoise(q * 9. + uDrift * 4.), vnoise(q * 9. + 31. - uDrift * 4.)) - .5);
}

// What lies at a point: its colour, and what it is made of for the type
vec3 col; float mat, foam, glint, grain, detail;
// mat: 0 dry sand, 1 damp sand, 2 a footprint, 3 thin water over sand, 4 open water
void scene(vec2 px, vec2 cellId) {
  vec2 q = (px - uO) * uMpp;   // metres
  vec2 tng = vec2(-uN.y, uN.x);
  float ys = dot(q, tng);
  // The mean waterline wanders a little along the beach
  float x = dot(q, uN) - (2.2 * sin(ys * .05 + 1.3) + 3. * (fbm(vec2(ys * .025, 4.2)) - .5));

  // The bottom deepens offshore, with a sandbar where the waves break
  float depth = x > 0. ? max(0., .04 * x + .0016 * x * x - .45 * exp(-pow((x - 24.) / 5., 2.))) : 0.;

  // Waves: phase from the travel time to shore, so they slow and crowd together as the water shoals
  float bend = .06 * sin(ys * .035 + 2.) + .05 * (fbm(vec2(ys * .02, 9.)) - .5);
  float ph = uWave + 3. * sqrt(max(x, 0.) + .5) / T + bend;
  float k = floor(ph), since = fract(ph) * T;   // which wave last passed here, and how long ago
  float hk = (.55 + .45 * h1(mod(k, 256.) * 1.7)) * (.8 + .2 * sin(k * .9));
  float xb = 20. + 10. * hk;                    // where this wave broke

  // Up on the sand: the latest wave rushes up, slows, then slides back
  float ph0 = uWave + 3. * sqrt(.5) / T + bend;
  float k0 = floor(ph0), q0 = fract(ph0);
  float h0 = (.55 + .45 * h1(mod(k0, 256.) * 1.7)) * (.8 + .2 * sin(k0 * .9));
  float R = 1.5 + 5.5 * h0 * (.75 + .25 * h1(k0 * 3.1));
  float wl;
  if (q0 < .36) { wl = -R * (1. - pow(1. - q0 / .36, 2.4)); }
  else { float u = (q0 - .36) / .64; wl = -R * (1. - smoothstep(0., 1., u)) + .4 * u * u; }
  wl += .9 * (fbm(vec2(ys * .3, mod(k0, 256.) * 7.3)) - .5) * smoothstep(0., .25, q0);
  bool covered = x > wl || k > k0;

  // Foam: the breaking lip, the whitewater behind each broken wave, and what it leaves floating
  float c = sqrt(max(x, 0.) + .5) / 1.5;
  vec2 fq = vec2(since * c + mod(k, 64.) * 13.1, ys);
  float broke = smoothstep(xb, xb - 5., x);
  float white = broke * (exp(-since / 1.3) + .3 * exp(-since / 5.)) * hk;
  float lip = (1. - broke) * smoothstep(xb + 14., xb, x) * exp(-since / .12) * .8;
  float surf = (white + lip) * smoothstep(-.5, 1., x);
  foam = foamOf(surf, fq);
  // The edge of the swash, and the bore's foam spreading up the slope
  vec2 sq = vec2(x - wl, ys);
  float edge = covered ? exp(-(x - wl) / (q0 < .36 ? .8 : .35)) : 0.;
  float sheet = covered && x < 4. ? .5 * exp(-q0 * T / 2.) : 0.;
  foam = max(foam, foamOf(edge * .95 + sheet, sq + vec2(0., 3.)));
  // A thin line of bubbles left where the wave reached, fading as it sinks into the sand
  float strand = covered ? 0. : smoothstep(.36, .5, q0) * (1. - smoothstep(.5, 1., q0)) * exp(-abs(x + R) / .3);
  foam = max(foam, foamOf(strand * .7, q * 1.3));

  // Sand: dry and pale up the beach, darker where damp, wet where the water just left
  vec3 dry = vec3(.93, .85, .70), wet = vec3(.77, .67, .54);
  grain = h2(cellId + 7.);
  float ripple = sin(dot(q, vec2(.3, 1.)) * 9. + 3. * fbm(q * .3)) * smoothstep(-3., -8., x);
  float damp = .4 * smoothstep(-10., -2., x);
  float soaked = x > -R - .3 ? 1. : 0.;
  vec3 sand = mix(dry, wet, max(damp, soaked)) * (1. + (grain - .5) * .05 + ripple * .025);
  mat = max(damp, soaked) > .3 ? 1. : 0.;
  detail = ripple;
  // Footprints wandering along the beach, a step every 0.7 m
  float fx = x + 8.5 + 1.2 * sin(ys * .07);
  float stepN = floor(ys / .7), side = mod(stepN, 2.) * 2. - 1.;
  vec2 fp = vec2(fx - side * .16, ys - (stepN + .5) * .7) / vec2(.06, .14);
  float print = smoothstep(1., .6, length(fp)) * step(.12, h1(stepN + 40.));
  sand *= 1. - .16 * print;
  if (print > .5) mat = 2.;
  // Dried weed and shells along the high-water line
  float wrack = exp(-pow(x + 11. + .8 * sin(ys * .1), 2.) / .8);
  sand *= 1. - .35 * step(.93, h2(floor(q * 14.))) * wrack;
  sand = mix(sand, vec3(.98, .96, .92), step(.997, h2(floor(q * 6.) + 3.)) * smoothstep(-2., -6., x));

  // Water depth here: the sea, or the thin sheet of the swash
  float dw = covered ? depth + .03 + .12 * smoothstep(wl, wl + 4., x) * (1. - step(0., x)) : 0.;
  float vis = exp(-dw * 1.7);
  float cz = smoothstep(6., .3, dw) * smoothstep(0., .2, dw);
  float cau = caustic(q * 1.6) * cz;
  vec3 bottom = vec3(.84, .79, .68) * (.88 + .5 * cau);
  col = covered ? mix(waterColour(dw), bottom * vec3(.8, .99, .97) + vec3(0., .03, .04), vis) : sand;
  // The thin sheet running up the beach shines
  if (covered && x < 0.) col += vec3(.1, .13, .14) * smoothstep(wl, wl + 1.5, x);
  if (covered) { mat = dw < .45 ? 3. : 4.; detail = cau; }
  // Aerated water behind the breakers glows paler
  col = mix(col, vec3(.72, .95, .94), clamp(surf, 0., 1.) * .35);

  // The surface: ripples and facets, plus the swell's long slope
  vec2 swell = uN * .05 * sin(fract(ph) * 6.2832) * smoothstep(xb - 4., xb + 10., x);
  vec2 g = slope(q) + swell;
  float calm = covered ? smoothstep(0., .4, dw) : 0.;
  vec3 n = normalize(vec3(-g * calm, 1.));
  vec3 V = normalize(uCam - vec3(q, 0.));
  vec3 H = normalize(uSun + V);
  float nh = max(dot(n, H), 0.);
  float fres = .02 + .98 * pow(1. - max(dot(n, V), 0.), 5.);
  col += vec3(.75, .88, 1.) * fres * .35 * calm;
  if (covered && mat > 3.5) detail = clamp(fres * 6. + dot(n.xy, uN) * 2., -1., 1.);
  // Gloss on the sand the backwash has just uncovered
  if (!covered) col += vec3(.7, .82, .9) * .22 * exp(-(wl - x) / 1.2) * soaked;
  col = mix(col, vec3(.97, .98, .97) * (.9 + .1 * dot(n, uSun)), foam);
  // Sun glitter: needle-sharp in the picture, broader in type, where a cell can only sample one point
#ifdef GLYPHS
  // Look at three points across the cell, keep the brightest
  vec2 cq = uCellPx * uMpp * .33;
  for (int i = 0; i < 2; i++) {
    vec2 o = i == 0 ? vec2(cq.x, cq.y) : vec2(-cq.x, -cq.y * .5);
    nh = max(nh, max(dot(normalize(vec3(-(slope(q + o) + swell) * calm, 1.)), H), 0.));
  }
  glint = pow(nh, 220.) * calm * (1. - foam);
#else
  glint = (pow(nh, 2500.) * 3. + pow(nh, 220.) * .05) * calm * (1. - foam);
  col += vec3(1., .97, .9) * glint;
#endif
  // A soft fall-off at the edges
  vec2 v = px / uRes - .5;
  col *= 1. - .18 * dot(v, v);
  col = pow(clamp(col, 0., 1.), vec3(1.05));
}

#ifdef GLYPHS
// Choose this cell's character and how it is inked. style 0: light marks on a darker ground;
// 1: dark marks (grains, bubble outlines); 2: glitter
void main() {
  vec2 cell = floor(gl_FragCoord.xy);
  scene((cell + .5) * uCellPx, cell);
  float gi = 0., style = 0.;
  float r = grain;
  if (glint > .5) { gi = 11.; style = 2.; }                              // *
  else if (glint > .2) { gi = 10.; style = 2.; }                         // +
  else if (glint > .08) { gi = 5.; style = 2.; }                         // '
  else if (foam > .82) { gi = r < .5 ? 14. : 15.; style = 1.; }          // @ 0: thick foam
  else if (foam > .55) { gi = r < .6 ? 13. : 12.; style = 1.; }          // O o
  else if (foam > .25) { gi = r < .5 ? 12. : 3.; style = 2.; }           // o : scattered bubbles
  else if (mat > 3.5) {
    // Open water: tildes and dashes from the ripples' shading
    float d = detail + (r - .5) * .5;
    gi = d > .55 ? 9. : d > .05 ? 8. : d > -.3 ? (r < .25 ? 7. : r < .6 ? 1. : 0.) : 0.;
  } else if (mat > 2.5) {
    // Thin water over sand: the ripples of light on the bottom show through
    gi = detail > .65 ? 8. : detail > .45 ? 7. : r < .1 ? 3. : r < .28 ? 1. : 0.;
  } else if (mat > 1.5) { gi = 4.; style = 1.; }                         // ; a footprint
  else if (mat > .5) { gi = r < .4 ? 2. : r < .7 ? 1. : 0.; style = 1.; } // damp sand
  else {
    // Dry sand: grains, gathered into the wind ripples
    float d = detail * .5 + .5;
    gi = r < .25 + .3 * d ? 1. : r < .45 + .3 * d ? 2. : r < .6 + .25 * d ? 6. : r < .7 ? 3. : 0.;
    style = r > .82 ? 1. : 0.;
  }
  gl_FragColor = vec4(col, (style * 32. + gi) / 255.);
}
#else
void main() {
  scene(gl_FragCoord.xy, floor(gl_FragCoord.xy));
  gl_FragColor = vec4(col, 1.);
}
#endif
`;

  const TYPE = `
precision mediump float;
uniform sampler2D uScene, uAtlas;
uniform vec2 uGrid;    // columns, rows
uniform vec2 uCellPx;  // cell size, render pixels
uniform float uNG;     // glyphs in the atlas
void main() {
  vec2 cf = gl_FragCoord.xy / uCellPx;
  vec2 cell = floor(cf), f = fract(cf);
  vec4 s = texture2D(uScene, (cell + .5) / uGrid);
  float code = floor(s.a * 255. + .5);
  float style = floor(code / 32.), g = code - style * 32.;
  float m = texture2D(uAtlas, vec2((g + f.x) / uNG, 1. - f.y)).a;
  // The ground blends smoothly from cell to cell; only the marks are per cell
  vec2 b = cf - .5, b0 = floor(b), bf = fract(b);
  vec3 c00 = texture2D(uScene, (b0 + .5) / uGrid).rgb, c10 = texture2D(uScene, (b0 + vec2(1.5, .5)) / uGrid).rgb;
  vec3 c01 = texture2D(uScene, (b0 + vec2(.5, 1.5)) / uGrid).rgb, c11 = texture2D(uScene, (b0 + 1.5) / uGrid).rgb;
  vec3 bg = mix(mix(c00, c10, bf.x), mix(c01, c11, bf.x), bf.y) * .8;
  vec3 c = s.rgb, fg;
  if (style < .5) fg = min(c * 1.45 + .08, 1.);
  else if (style < 1.5) fg = c * vec3(.6, .67, .74);
  else fg = vec3(1., .98, .9);
  gl_FragColor = vec4(mix(bg, fg, m), 1.);
}`;

  function program(fs) {
    const pr = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, 'attribute vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }'], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(pr, s);
    }
    gl.bindAttribLocation(pr, 0, 'p');
    gl.linkProgram(pr);
    const u = (n) => gl.getUniformLocation(pr, n);
    return { pr, u };
  }
  const scene = program((glyphMode ? '#define GLYPHS\n' : '') + SCENE);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  const texture = (src, wd, ht, filter) => {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    if (src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, wd, ht, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };
  let type = null, sceneTex = null, fb = null;
  if (glyphMode) {
    // White glyphs on transparent, one cell each, at the size they are drawn
    const aw = Math.max(2, Math.round(cw)), ah = Math.max(2, Math.round(ch));
    const atlas = document.createElement('canvas');
    atlas.width = aw * GLYPHS.length;
    atlas.height = ah;
    const ax = atlas.getContext('2d');
    ax.fillStyle = '#fff';
    ax.font = `${Math.round(ah * 0.86)}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    ax.textAlign = 'center';
    ax.textBaseline = 'middle';
    [...GLYPHS].forEach((g, i) => ax.fillText(g, i * aw + aw / 2, ah / 2 + ah * 0.04));
    type = program(TYPE);
    gl.activeTexture(gl.TEXTURE1);
    texture(atlas, 0, 0, gl.LINEAR);
    gl.activeTexture(gl.TEXTURE0);
    sceneTex = texture(null, cols, rows, gl.NEAREST);
    fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(type.pr);
    gl.uniform1i(type.u('uScene'), 0);
    gl.uniform1i(type.u('uAtlas'), 1);
    gl.uniform2f(type.u('uGrid'), cols, rows);
    gl.uniform2f(type.u('uCellPx'), cw, ch);
    gl.uniform1f(type.u('uNG'), GLYPHS.length);
  }

  // ---------- the beach: sand lower left (bottom on a phone), the sea opening to the upper right ----------
  const mpp = 50 / Math.max(rw, rh);
  const N = portrait ? [0.24, 0.97] : [0.876, 0.482];
  const O = portrait ? [rw * 0.5, rh * 0.34] : [rw * 0.33, rh * 0.42];
  // The camera hangs 70 m over the middle of the picture; the sun is high, out over the sea
  const cam = [(rw / 2 - O[0]) * mpp, (rh / 2 - O[1]) * mpp, 70];
  const sunH = portrait ? [0.3, 0.95] : [0.75, 0.66];
  const el = 1.05;
  const sl = Math.hypot(...sunH);
  const sun = [(sunH[0] / sl) * Math.cos(el), (sunH[1] / sl) * Math.cos(el), Math.sin(el)];
  const U = scene.u;
  gl.useProgram(scene.pr);
  gl.uniform2f(U('uO'), O[0], O[1]);
  gl.uniform1f(U('uMpp'), mpp);
  gl.uniform2f(U('uN'), N[0], N[1]);
  gl.uniform3f(U('uSun'), ...sun);
  gl.uniform3f(U('uCam'), ...cam);
  gl.uniform2f(U('uCellPx'), cw, ch);
  gl.uniform2f(U('uRes'), rw, rh);

  // Wind ripples, mostly running onshore
  const ripples = Array.from({ length: 8 }, () => {
    const a = Math.atan2(-N[1], -N[0]) + (rng() - 0.5) * 1.6;
    const lambda = 0.35 + Math.pow(rng(), 1.5) * 2.2;
    const kk = TAU / lambda;
    return { d: [Math.cos(a), Math.sin(a)], k: kk, s: 0.05 + rng() * 0.05, w: Math.sqrt(9.8 * kk) * 0.6, p: rng() * TAU };
  });
  gl.uniform4fv(U('uR'), new Float32Array(ripples.flatMap((r) => [r.d[0], r.d[1], r.k, r.s])));
  const ripPh = new Float32Array(8), caPh = new Float32Array(5);
  const rings = [];
  const ringData = new Float32Array(24);
  let now = 0, lastRing = -1, lastX = null, lastY = null;
  const waveStart = rng() * 256;

  function update(dt, t, input) {
    now = t;
    for (const r of rings) r.age += dt;
    while (rings.length && rings[0].age > 6) rings.shift();
    // The pointer stirs rings where it moves
    if (input && input.active) {
      const x = input.x * rs, y = (h - input.y) * rs;
      if (lastX !== null && Math.hypot(x - lastX, y - lastY) > 6 && t - lastRing > 0.18) {
        rings.push({ x: (x - O[0]) * mpp, y: (y - O[1]) * mpp, age: 0, s: 0.12 });
        if (rings.length > 6) rings.shift();
        lastRing = t;
      }
      lastX = x;
      lastY = y;
    } else lastX = null;
  }

  function draw(ctx) {
    const t = now;
    gl.useProgram(scene.pr);
    gl.uniform1f(U('uWave'), (waveStart + t / 7) % 256);
    ripples.forEach((r, i) => (ripPh[i] = (r.w * t + r.p) % TAU));
    gl.uniform1fv(U('uRp'), ripPh);
    for (let n = 0; n < 5; n++) caPh[n] = (t * 0.55 * (1 - 3.5 / (n + 1))) % TAU;
    gl.uniform1fv(U('uC'), caPh);
    const a = (t / 900) * TAU;
    gl.uniform2f(U('uDrift'), Math.cos(a) * 12, Math.sin(a) * 12);
    ringData.fill(0);
    rings.forEach((r, i) => ringData.set([r.x, r.y, r.age, r.s], i * 4));
    gl.uniform4fv(U('uRing'), ringData);
    if (glyphMode) {
      // One scene sample per cell, then the type
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.viewport(0, 0, cols, rows);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, rw, rh);
      gl.useProgram(type.pr);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
    } else gl.viewport(0, 0, rw, rh);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(glc, 0, 0, w, h);
  }

  return { update, draw };
}
