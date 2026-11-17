// Small shared helpers: a seeded RNG, math, canvas textures.
import * as THREE from 'three';

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const damp = (a, b, k, dt) => b + (a - b) * Math.exp(-k * dt);   // frame-rate independent ease toward b
export const wrapAngle = (a) => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };

export function makeRng(seed = 1) {
  let s = seed >>> 0;
  const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  return r;
}
export const rng = makeRng(20261117);

export function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function tex(c, { repeat = true, srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso; return t;
}
export function radial(size, stops) {
  const c = canvas(size), g = c.getContext('2d'), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [a, col] of stops) gr.addColorStop(a, col);
  g.fillStyle = gr; g.fillRect(0, 0, size, size); return c;
}
// A tileable normal map from summed sine octaves (used by water and wet roads).
export function noiseNormal(size = 256, strength = 4, r = makeRng(7)) {
  const c = canvas(size), g = c.getContext('2d'), im = g.createImageData(size, size), h = new Float32Array(size * size);
  for (const [f, a] of [[2, 1], [5, 0.5], [11, 0.25], [23, 0.12]]) {
    const p = [r() * 9, r() * 9, r() * 9, r() * 9];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const u = x / size * TAU * f, v = y / size * TAU * f; h[y * size + x] += a * Math.sin(u + p[0] + Math.sin(v + p[1])) * Math.cos(v + p[2] + Math.cos(u + p[3])); }
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x, dx = h[y * size + (x + 1) % size] - h[y * size + (x + size - 1) % size], dy = h[((y + 1) % size) * size + x] - h[((y + size - 1) % size) * size + x];
    const nx = -dx * strength, ny = -dy * strength, l = Math.hypot(nx, ny, 1);
    im.data[i * 4] = (nx / l * 0.5 + 0.5) * 255; im.data[i * 4 + 1] = (ny / l * 0.5 + 0.5) * 255; im.data[i * 4 + 2] = (1 / l * 0.5 + 0.5) * 255; im.data[i * 4 + 3] = 255;
  }
  g.putImageData(im, 0, 0); return tex(c, { srgb: false });
}

// Geometry builder that collects boxes/prisms with world-scale UVs and per-vertex colors, then emits one BufferGeometry.
export class GeoBuilder {
  constructor() { this.P = []; this.N = []; this.U = []; this.C = []; this.I = []; }
  get count() { return this.P.length / 3; }
  quad(a, b, c, d, n, uvs, col, colTop = col) {
    const o = this.count;
    for (const [p, uv, cc] of [[a, uvs[0], col], [b, uvs[1], col], [c, uvs[2], colTop], [d, uvs[3], colTop]]) { this.P.push(p[0], p[1], p[2]); this.N.push(n[0], n[1], n[2]); this.U.push(uv[0], uv[1]); this.C.push(cc[0], cc[1], cc[2]); }
    this.I.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
  // Axis-aligned box. uw/uh = metres per texture tile; ao darkens the bottom of the walls. roofUV = a fixed texel for the top.
  box(x0, x1, y0, y1, z0, z1, col, { uw = 24, uh = 56, ao = 0.65, roofUV = [0.004, 0.004], roofCol = null, u0 = 0, v0 = 0, bottom = false } = {}) {
    const h = y1 - y0, bc = [col[0] * ao, col[1] * ao, col[2] * ao], vb = v0 + y0 / uh, vt = v0 + y1 / uh;
    const side = (a, b, n, len, s) => this.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [b[0], y1, b[1]], [a[0], y1, a[1]], n, [[u0 + s, vb], [u0 + s + len / uw, vb], [u0 + s + len / uw, vt], [u0 + s, vt]], [bc[0] * n[3], bc[1] * n[3], bc[2] * n[3]], [col[0] * n[3], col[1] * n[3], col[2] * n[3]]);
    const W = x1 - x0, D = z1 - z0;
    side([x0, z1], [x1, z1], [0, 0, 1, 0.95], W, 0);
    side([x1, z1], [x1, z0], [1, 0, 0, 0.8], D, W / uw);
    side([x1, z0], [x0, z0], [0, 0, -1, 0.62], W, (W + D) / uw);
    side([x0, z0], [x0, z1], [-1, 0, 0, 0.72], D, (2 * W + D) / uw);
    const rc = roofCol || [col[0] * 0.55, col[1] * 0.55, col[2] * 0.58];
    this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0, 1], [roofUV, roofUV, roofUV, roofUV], rc);
    if (bottom) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0], [roofUV, roofUV, roofUV, roofUV], rc);
    void h; void D;
  }
  // Vertical n-gon prism (round towers).
  prism(cx, cz, r, y0, y1, n, col, { uw = 24, uh = 56, ao = 0.65, roofUV = [0.004, 0.004], rot = 0 } = {}) {
    const seg = TAU * r / n;
    for (let i = 0; i < n; i++) {
      const a0 = rot + i / n * TAU, a1 = rot + (i + 1) / n * TAU, am = (a0 + a1) / 2;
      const p0 = [cx + Math.cos(a0) * r, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r];
      const n3 = [Math.cos(am), 0, Math.sin(am)], sh = 0.68 + 0.27 * Math.max(0, Math.cos(am - 0.6));
      const c = [col[0] * sh, col[1] * sh, col[2] * sh], cb = [c[0] * ao, c[1] * ao, c[2] * ao];
      this.quad([p1[0], y0, p1[1]], [p0[0], y0, p0[1]], [p0[0], y1, p0[1]], [p1[0], y1, p1[1]], n3, [[i * seg / uw, y0 / uh], [(i + 1) * seg / uw, y0 / uh], [(i + 1) * seg / uw, y1 / uh], [i * seg / uw, y1 / uh]], cb, c);
    }
    const o = this.count, rc = [col[0] * 0.5, col[1] * 0.5, col[2] * 0.55];
    this.P.push(cx, y1, cz); this.N.push(0, 1, 0); this.U.push(...roofUV); this.C.push(...rc);
    for (let i = 0; i <= n; i++) { const a = rot + i / n * TAU; this.P.push(cx + Math.cos(a) * r, y1, cz + Math.sin(a) * r); this.N.push(0, 1, 0); this.U.push(...roofUV); this.C.push(...rc); }
    for (let i = 0; i < n; i++) this.I.push(o, o + 2 + i, o + 1 + i);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.P, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.U, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.C, 3));
    g.setIndex(this.I); g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
}

// Bake a group of meshes (each with its own color) into one geometry with vertex colors. Used for cars, props, characters.
export function bakeColored(parts) {
  const geos = [];
  for (const [geo, color, matrix] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    const n = g.attributes.position.count, c = new Float32Array(n * 3), col = new THREE.Color(color);
    for (let i = 0; i < n; i++) { c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k);
    geos.push(g);
  }
  return mergeSimple(geos);
}
function mergeSimple(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.computeBoundingSphere(); return g;
}
export const M4 = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));
