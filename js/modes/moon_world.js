// MOON BUGGY world: a seeded heightfield (rolling plains, ridges, craters with rims and bowls), streamed 64 m chunks around the buggy, a custom terrain shader
// (flat-shaded facets, low hard sunlight, black shadows: per-vertex terrain shadow marched toward the sun at build time plus analytic sphere shadows from boulders,
// the buggy and the props), a stylised small-planet curve (everything bends down with distance, so the horizon sits close and the chunk edge is hidden),
// and the art: the buggy with the hoodie mascot, the lander, snack crates, the flag, the 1969 descent stage, the old rover, Earth, Sun and stars.
// Everything is built from primitives and canvases. Our own cartoon designs (no real mission patches or logos).
import * as THREE from 'three';
import { bakeColored, M4, makeRng } from '../util.js';
import { mascotParts } from '../models.js';

export const G = 1.62;                       // lunar surface gravity, m/s²
export const CURVE = 1 / (2 * 700);          // stylised curvature: y drops d²/(2R), R = 700 m (the real Moon is 1,737 km; ours is a toy planet)
export const CHUNK = 64, GRID = 5;           // chunk size (m), chunks across the streamed window
const TAU = Math.PI * 2;
const TAIL = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';
export const U = { uCurve: { value: CURVE } };   // shared by every curved material

// ---------------------------------------------------------------- noise
function hash(ix, iz, s) { let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vn(x, z, s) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, s), b = hash(ix + 1, iz, s), c = hash(ix, iz + 1, s), d = hash(ix + 1, iz + 1, s);
  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- the seeded world: layout first (lander, crates, bonus crater, eggs), then terrain that keeps clear of it
export class World {
  constructor(seed) {
    this.seed = seed | 0; const r = makeRng(1000 + (seed | 0) * 7919);
    this.earthAz = r() * TAU;   // world bearing of Earth (x = sin, z = cos)
    const ex = Math.sin(this.earthAz), ez = Math.cos(this.earthAz), at = (ang, d) => ({ x: Math.sin(this.earthAz + ang) * d, z: Math.cos(this.earthAz + ang) * d });
    this.earthXZ = { x: ex, z: ez };
    // a loop of six crates that leaves toward Earth and curls back to the lander (the flag is planted there at the end)
    const A = [-0.12, 0.4, 0.95, 1.65, 2.45, 3.2], D = [100, 150, 180, 170, 150, 105];
    this.crates = A.map((a, i) => { const p = at(a + (r() - 0.5) * 0.16, D[i] + (r() - 0.5) * 16); return { x: p.x, z: p.z, y: 0 }; });
    const bc = at(-0.06, 52); this.bonus = { x: bc.x, z: bc.z, r: 17, D: 4.6, rim: 2.4 };   // the jump crater on the way to the first crate
    const st = at(-1.35 + (r() - 0.5) * 0.3, 175), rv = at(1.25 + (r() - 0.5) * 0.3, 230);
    this.stage = { x: st.x, z: st.z, yaw: r() * TAU }; this.rover = { x: rv.x, z: rv.z, yaw: r() * TAU };
    this.flagAt = { x: Math.sin(this.earthAz + 2.3) * 7, z: Math.cos(this.earthAz + 2.3) * 7 };
    this.keep = [[0, 0, 46], ...this.crates.map((c) => [c.x, c.z, 16]), [bc.x, bc.z, 44], [st.x, st.z, 22], [rv.x, rv.z, 20]];   // no random craters near these
    this.cells = new Map(); this.cellsS = new Map(); this.o = { rim: 0, bowl: 0 };
    for (const c of this.crates) c.y = this.h(c.x, c.z);
  }
  crater(ix, iz, small) {   // cached per cell; null when the cell has none
    const map = small ? this.cellsS : this.cells, key = ix * 131071 + iz; let c = map.get(key); if (c !== undefined) return c;
    const s = this.seed * 31 + (small ? 7 : 3), C = small ? 30 : 90; c = null;
    if (hash(ix, iz, s) < (small ? 0.4 : 0.55)) {
      const rr = small ? 1.6 + 4.5 * hash(ix, iz, s + 1) : 7 + 24 * Math.pow(hash(ix, iz, s + 1), 1.6), x = (ix + 0.2 + 0.6 * hash(ix, iz, s + 2)) * C, z = (iz + 0.2 + 0.6 * hash(ix, iz, s + 3)) * C;
      let ok = true; for (const k of this.keep) { const dx = x - k[0], dz = z - k[1]; if (dx * dx + dz * dz < (k[2] + rr * (small ? 0.5 : 1.6)) ** 2) { ok = false; break; } }
      if (ok) c = { x, z, r: rr, D: rr * (small ? 0.3 : 0.24), rim: rr * (small ? 0.09 : 0.075) };
    }
    map.set(key, c); return c;
  }
  // terrain height at (x, z). o (optional) receives rim / bowl weights for the regolith colours
  h(x, z, o) {
    let y = 3.4 * vn(x / 170, z / 170, this.seed) + 1.15 * vn(x / 52, z / 52, this.seed + 1) + 0.07 * vn(x / 8, z / 8, this.seed + 2);
    const rd = 1 - Math.abs(vn(x / 300, z / 300, this.seed + 4)); y += 4.2 * rd * rd * rd * rd;
    let rim = 0, bowl = 0;
    const add = (c) => {
      const dx = x - c.x, dz = z - c.z, d2 = dx * dx + dz * dz, R2 = c.r * c.r; if (d2 > R2 * 5.3) return;
      const q = Math.sqrt(d2 / R2);
      if (q < 1) { const e = (1 - q) / 0.2; y += c.D * (q * q - 1) + c.rim * Math.exp(-e * e); bowl = Math.max(bowl, 1 - q); rim = Math.max(rim, Math.exp(-e * e)); }
      else { const e = (q - 1) / 0.45; const w = Math.exp(-e * e); y += c.rim * w; rim = Math.max(rim, w * 0.8); }
    };
    for (let k = 0; k < 2; k++) {
      const small = k === 1, C = small ? 30 : 90, ix = Math.floor(x / C), iz = Math.floor(z / C);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = this.crater(ix + a, iz + b, small); if (c) add(c); }
    }
    add(this.bonus);
    const d = Math.hypot(x, z), f = sstep(12, 38, d); y *= f;   // the landing site is flat
    if (o) { o.rim = rim * f; o.bowl = bowl * f; }
    return y;
  }
}

// ---------------------------------------------------------------- terrain chunks (a pool of GRID² meshes rebuilt in place as the buggy moves)
export const NC = 28;   // shadow casters the terrain shader tests (spheres)
const TV = `uniform float uCurve; attribute vec3 tint; attribute float sh; varying vec3 vW, vC; varying float vSh, vD;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vC = tint; vSh = sh; vec2 d = w.xz - cameraPosition.xz; vD = length(d); w.y -= dot(d, d) * uCurve; gl_Position = projectionMatrix * viewMatrix * w; }`;
const TF = `uniform vec3 uSun, uSunCol, uAmb, uEarthDir, uEarthCol; uniform vec4 uCast[${NC}]; uniform float uFar; varying vec3 vW, vC; varying float vSh, vD;
  void main(){ vec3 N = normalize(cross(dFdx(vW), dFdy(vW))); if (N.y < 0.0) N = -N;
    float nl = max(dot(N, uSun), 0.0), s = smoothstep(0.25, 0.75, vSh);
    for (int i = 0; i < ${NC}; i++) { vec4 c = uCast[i]; vec3 oc = c.xyz - vW; float b = dot(oc, uSun); if (b > 0.0) { float d2 = dot(oc, oc) - b * b, r2 = c.w * c.w; s *= smoothstep(r2 * 0.8, r2, d2); } }
    vec3 col = vC * (uSunCol * nl * s + uAmb + uEarthCol * max(dot(N, uEarthDir), 0.0));
    col *= 1.0 - smoothstep(uFar * 0.72, uFar, vD);
    gl_FragColor = vec4(col, 1.0);${TAIL}}`;

export class Terrain {
  constructor(scene, world, tier, sunDir) {
    this.w = world; this.sun = sunDir; this.seg = tier === 'low' ? 20 : tier === 'high' ? 36 : 30; const S = this.seg, n = (S + 1) * (S + 1);
    this.casts = Array.from({ length: NC }, () => new THREE.Vector4(0, -9999, 0, 0.01));
    this.U = { uSun: { value: sunDir }, uSunCol: { value: new THREE.Color(1.55, 1.42, 1.25) }, uAmb: { value: new THREE.Color(0.05, 0.055, 0.08) }, uEarthDir: { value: new THREE.Vector3(0, 0.3, 1).normalize() },
      uEarthCol: { value: new THREE.Color(0.05, 0.08, 0.14) }, uCast: { value: this.casts }, uFar: { value: CHUNK * 2.05 }, uCurve: U.uCurve };
    this.mat = new THREE.ShaderMaterial({ uniforms: this.U, vertexShader: TV, fragmentShader: TF });
    const idx = []; for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const a = j * (S + 1) + i, b = a + 1, c = a + S + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const index = new THREE.BufferAttribute(new Uint16Array(idx), 1);
    this.chunks = []; this.map = new Map();
    for (let k = 0; k < GRID * GRID; k++) {
      const g = new THREE.BufferGeometry(); g.setIndex(index);
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('tint', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('sh', new THREE.BufferAttribute(new Float32Array(n), 1));
      g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), CHUNK); g.boundingBox = new THREE.Box3();
      const m = new THREE.Mesh(g, this.mat); m.visible = false; m.renderOrder = -2; scene.add(m);
      this.chunks.push({ m, g, cx: 1e9, cz: 1e9, want: false, dirty: false, rocks: new Float32Array(6 * 4), nr: 0 });
    }
    this.hs = new Float32Array((S + 3) * (S + 3));   // the chunk's heights with a one-cell apron (for normals)
    this.ccx = 1e9; this.ccz = 1e9;
    // boulders: one instanced mesh, six slots per chunk
    const bg = new THREE.IcosahedronGeometry(1, 0); const pp = bg.attributes.position; for (let i = 0; i < pp.count; i++) pp.setY(i, pp.getY(i) * 0.72);
    this.rockMat = curve(new THREE.MeshLambertMaterial({ color: 0x8c8790, flatShading: true }));
    this.rocks = new THREE.InstancedMesh(bg, this.rockMat, GRID * GRID * 6); this.rocks.frustumCulled = false; scene.add(this.rocks);
    this.o3 = new THREE.Object3D(); this.zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < this.rocks.count; i++) this.rocks.setMatrixAt(i, this.zero);
  }
  key(cx, cz) { return cx * 4099 + cz; }
  // move the window; build at most `budget` chunks now (Infinity on a reset)
  update(px, pz, budget = 2) {
    const ccx = Math.floor(px / CHUNK), ccz = Math.floor(pz / CHUNK), H = (GRID - 1) / 2;
    if (ccx !== this.ccx || ccz !== this.ccz) {
      this.ccx = ccx; this.ccz = ccz;
      for (const c of this.chunks) c.want = Math.abs(c.cx - ccx) <= H && Math.abs(c.cz - ccz) <= H;
      for (let a = -H; a <= H; a++) for (let b = -H; b <= H; b++) {
        const cx = ccx + a, cz = ccz + b, have = this.map.get(this.key(cx, cz)); if (have && have.want) continue;
        const c = this.chunks.find((q) => !q.want); if (!c) continue;   // ponytail: linear scan of 25 on a chunk crossing only
        this.map.delete(this.key(c.cx, c.cz)); c.cx = cx; c.cz = cz; c.want = true; c.dirty = true; c.m.visible = false; this.map.set(this.key(cx, cz), c);
      }
    }
    let n = 0; for (const c of this.chunks) { if (!c.dirty) continue; if (n >= budget) break; this.build(c); n++; }
    if (n) this.rocks.instanceMatrix.needsUpdate = true;
  }
  reset(px, pz) { this.ccx = 1e9; for (const c of this.chunks) { c.want = false; c.cx = 1e9 + this.chunks.indexOf(c); } this.map.clear(); this.update(px, pz, Infinity); }
  build(c) {
    const S = this.seg, st = CHUNK / S, x0 = c.cx * CHUNK, z0 = c.cz * CHUNK, w = this.w, o = w.o, hs = this.hs, W = S + 3;
    for (let j = -1; j <= S + 1; j++) for (let i = -1; i <= S + 1; i++) hs[(j + 1) * W + i + 1] = w.h(x0 + i * st, z0 + j * st);
    const P = c.g.attributes.position.array, T = c.g.attributes.tint.array, SH = c.g.attributes.sh.array, L = this.sun, tanE = L.y / Math.hypot(L.x, L.z), lx = L.x / Math.hypot(L.x, L.z), lz = L.z / Math.hypot(L.x, L.z);
    let ymin = 1e9, ymax = -1e9;
    for (let j = 0; j <= S; j++) for (let i = 0; i <= S; i++) {
      const v = j * (S + 1) + i, x = x0 + i * st, z = z0 + j * st, y = hs[(j + 1) * W + i + 1]; w.h(x, z, o);
      P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z; if (y < ymin) ymin = y; if (y > ymax) ymax = y;
      // regolith: grey with a warm-cool drift, bright ejecta on rims, darker old bowls, a few pale speckles
      const n1 = vn(x / 23, z / 23, w.seed + 9) * 0.5 + 0.5, sp = hash(Math.floor(x / 2), Math.floor(z / 2), w.seed + 11) > 0.93 ? 0.08 : 0;
      const g = 0.4 + 0.12 * n1 + 0.2 * o.rim - 0.1 * o.bowl + sp; T[v * 3] = g * 1.02; T[v * 3 + 1] = g * 0.99; T[v * 3 + 2] = g * 0.97 + 0.02 * (1 - n1);
      // terrain shadow: facing away from the sun, or a ridge/rim between this point and the sun
      const nx = hs[(j + 1) * W + i] - hs[(j + 1) * W + i + 2], nz = hs[j * W + i + 1] - hs[(j + 2) * W + i + 1], nd = (nx * L.x + 2 * st * L.y + nz * L.z) / Math.hypot(nx, 2 * st, nz);
      let lit = nd > 0.02 ? 1 : 0;
      if (lit) for (const d of MARCH) { if (w.h(x + lx * d, z + lz * d) > y + 0.25 + d * tanE) { lit = 0; break; } }
      SH[v] = lit;
    }
    // boulders (deterministic per chunk; none near the layout spots)
    const nB = Math.floor(hash(c.cx, c.cz, w.seed + 21) * 6.9); c.nr = 0; const base = this.chunks.indexOf(c) * 6;
    for (let k = 0; k < 6; k++) {
      let on = k < nB; const bx = x0 + hash(c.cx, c.cz, w.seed + 30 + k) * CHUNK, bz = z0 + hash(c.cx, c.cz, w.seed + 40 + k) * CHUNK, big = hash(c.cx, c.cz, w.seed + 50 + k);
      const r = big > 0.92 ? 2.2 + big * 0.8 : 0.35 + Math.pow(hash(c.cx, c.cz, w.seed + 60 + k), 2) * 1.3;
      if (on) for (const q of w.keep) { const dx = bx - q[0], dz = bz - q[1]; if (dx * dx + dz * dz < (q[2] * 0.5 + r) ** 2) { on = false; break; } }
      if (!on) { this.rocks.setMatrixAt(base + k, this.zero); continue; }
      const by = w.h(bx, bz) - r * 0.25, R = c.rocks, i4 = c.nr * 4; R[i4] = bx; R[i4 + 1] = by; R[i4 + 2] = bz; R[i4 + 3] = r; c.nr++;
      const o3 = this.o3; o3.position.set(bx, by, bz); o3.rotation.set(big * 3, hash(c.cx, c.cz, k) * 6, big * 2); o3.scale.set(r, r, r * (0.8 + big * 0.4)); o3.updateMatrix(); this.rocks.setMatrixAt(base + k, o3.matrix);
    }
    const g = c.g; for (const k of ['position', 'tint', 'sh']) g.attributes[k].needsUpdate = true;
    g.boundingBox.min.set(x0, ymin, z0); g.boundingBox.max.set(x0 + CHUNK, ymax, z0 + CHUNK); g.boundingBox.getBoundingSphere(g.boundingSphere); g.boundingSphere.radius += 12;   // the curve drops far chunks a little
    c.dirty = false; c.m.visible = true;
  }
  // boulders near (x, z): calls fn(x, y, z, r) for each one in the 3x3 chunks around
  near(x, z, fn) { const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = this.map.get(this.key(cx + a, cz + b)); if (!c || c.dirty) continue; for (let k = 0; k < c.nr; k++) fn(c.rocks[k * 4], c.rocks[k * 4 + 1], c.rocks[k * 4 + 2], c.rocks[k * 4 + 3]); } }
}
const MARCH = [1.5, 3, 5, 8, 12, 17, 24, 32];

// curve(mat): bend a built-in material's vertices down with distance from the camera (the toy-planet horizon). World positions used for lighting stay flat.
export function curve(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uCurve = U.uCurve;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uCurve;').replace('#include <project_vertex>', `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_INSTANCING
mvPosition = instanceMatrix * mvPosition;
#endif
vec4 cwp = modelMatrix * mvPosition; vec2 cdd = cwp.xz - cameraPosition.xz; cwp.y -= dot(cdd, cdd) * uCurve;
mvPosition = viewMatrix * cwp;
gl_Position = projectionMatrix * mvPosition;`);
  };
  mat.customProgramCacheKey = () => 'moon-curve'; return mat;
}

// ---------------------------------------------------------------- art
const CREAM = 0xf3e6d0, CORAL = 0xff6b57, NAVY = 0x1f2756, SUN = 0xffd84d, DARK = 0x2a2d3c, STEEL = 0xb9bfd0, GOLD = 0xffb347, TYRE = 0x34323c;

// the buggy: root at the ground contact centre, nose +z. Returns parts for animation. mats = { body, glass } (pass curved ones in the mode, plain ones in the preview)
export function makeBuggy(mats) {
  const body = [
    [new THREE.BoxGeometry(1.5, 0.2, 3.0), NAVY, M4(0, 0.62, 0)],                                       // deck
    [new THREE.BoxGeometry(1.62, 0.32, 0.5), CORAL, M4(0, 0.74, 1.45)],                                // front bumper / nose
    [new THREE.BoxGeometry(1.2, 0.22, 0.7), CREAM, M4(0, 0.85, 1.05, -0.25)],                          // dash
    [new THREE.BoxGeometry(0.75, 0.12, 0.62), CREAM, M4(0, 0.79, -0.1)],                               // seat
    [new THREE.BoxGeometry(0.75, 0.62, 0.12), CORAL, M4(0, 1.08, -0.42, 0.12)],                        // seat back
    [new THREE.BoxGeometry(1.62, 0.2, 0.42), CREAM, M4(0, 0.72, -1.4)],                                // rear rail
    [new THREE.CylinderGeometry(0.035, 0.035, 0.55, 6), DARK, M4(0, 1.0, 0.68, -0.6)],                 // steering column
    [new THREE.TorusGeometry(0.2, 0.04, 6, 16), SUN, M4(0, 1.18, 0.55, -0.9)],                          // steering wheel
    [new THREE.CylinderGeometry(0.035, 0.035, 2.0, 6), STEEL, M4(-0.62, 1.6, 0.85, 0, 0, 0)],            // antenna mast
    [new THREE.ConeGeometry(0.5, 0.22, 12, 1, true), 0xf4f4f8, M4(-0.62, 2.62, 0.85, -0.5)],            // the umbrella dish
    [new THREE.SphereGeometry(0.07, 8, 6), CORAL, M4(-0.62, 2.62, 0.85)],
  ];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) body.push([new THREE.CylinderGeometry(0.62, 0.62, 0.44, 14, 1, true, -Math.PI / 2, Math.PI), sz > 0 ? CREAM : CORAL, M4(sx * 0.95, 0.52, sz * 1.15, 0, 0, Math.PI / 2)]);   // fenders
  for (const sx of [-1, 1]) body.push([new THREE.TorusGeometry(0.62, 0.045, 6, 18, Math.PI), STEEL, M4(sx * 0.42, 0.72, -0.55, 0, Math.PI / 2, 0)]);   // roll hoops
  // the snack crate on the back: coral box, sun straps, cream lid
  body.push([new THREE.BoxGeometry(1.0, 0.62, 0.72), CORAL, M4(0, 1.03, -1.05)], [new THREE.BoxGeometry(1.04, 0.1, 0.76), CREAM, M4(0, 1.38, -1.05)],
    [new THREE.BoxGeometry(0.12, 0.64, 0.76), SUN, M4(-0.25, 1.03, -1.05)], [new THREE.BoxGeometry(0.12, 0.64, 0.76), SUN, M4(0.25, 1.03, -1.05)]);
  const root = new THREE.Group(), chassis = new THREE.Group(); root.add(chassis);
  chassis.add(new THREE.Mesh(bakeColored(body), mats.body));
  // the hoodie mascot in the seat (torso + head from the shared rig; arms reach the wheel), in a clear bubble helmet
  const mp = mascotParts(0xff6b57); mp.leg.dispose();
  const kid = new THREE.Group(); kid.position.set(0, 0.2, -0.12); kid.scale.setScalar(0.62); chassis.add(kid);
  kid.add(new THREE.Mesh(mp.torso, mats.body));
  const arms = []; for (const sx of [-1, 1]) { const p = new THREE.Group(); p.position.set(sx * 0.33, 1.38, 0); p.rotation.set(-1.15, 0, sx * 0.1); p.add(new THREE.Mesh(mp.arm, mats.body)); kid.add(p); arms.push(p); }
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 12), mats.glass); helmet.position.set(0, 1.78, 0.02); kid.add(helmet);
  // wheels: a chunky tyre with tread lugs and a sun-yellow hub; pivots so the front pair steers
  const wp = [[new THREE.CylinderGeometry(0.45, 0.45, 0.34, 18), TYRE, M4(0, 0, 0, 0, 0, Math.PI / 2)], [new THREE.CylinderGeometry(0.22, 0.22, 0.36, 12), SUN, M4(0, 0, 0, 0, 0, Math.PI / 2)], [new THREE.CylinderGeometry(0.08, 0.08, 0.4, 8), CORAL, M4(0, 0, 0, 0, 0, Math.PI / 2)]];
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; wp.push([new THREE.BoxGeometry(0.36, 0.08, 0.16), 0x24222a, M4(0, Math.cos(a) * 0.46, Math.sin(a) * 0.46, a)]); }
  const wg = bakeColored(wp), wheels = [];
  for (const [x, z] of WHEELS) { const piv = new THREE.Group(); piv.position.set(x, 0.45, z); const spin = new THREE.Mesh(wg, mats.body); piv.add(spin); root.add(piv); wheels.push({ piv, spin, x, z }); }
  return { root, chassis, wheels, arms, kid, helmet };
}
export const WHEELS = [[0.95, 1.15], [-0.95, 1.15], [0.95, -1.15], [-0.95, -1.15]];   // front pair first (x, z)

// the lander you start from: gold-foil base on four splayed legs, a cream cabin with a coral band, a window and a dish. Origin on the ground, ~7 m tall.
export function landerGeometry() {
  const p = [[new THREE.CylinderGeometry(2.2, 2.2, 1.7, 8), GOLD, M4(0, 2.55, 0)], [new THREE.CylinderGeometry(2.25, 2.25, 0.12, 8), 0xe09a30, M4(0, 3.4, 0)],
    [new THREE.CylinderGeometry(1.55, 1.75, 1.7, 10), CREAM, M4(0, 4.3, 0)], [new THREE.CylinderGeometry(1.6, 1.6, 0.28, 10), CORAL, M4(0, 4.0, 0)], [new THREE.SphereGeometry(1.55, 14, 8, 0, TAU, 0, Math.PI / 2), CREAM, M4(0, 5.15, 0)],
    [new THREE.CylinderGeometry(0.06, 0.06, 1.2, 6), STEEL, M4(0.6, 6.6, -0.4)], [new THREE.ConeGeometry(0.55, 0.25, 12, 1, true), 0xf4f4f8, M4(0.6, 7.2, -0.4, 0.4)],
    [new THREE.CylinderGeometry(0.75, 1.0, 0.7, 12, 1, true), DARK, M4(0, 1.4, 0)]];
  for (let k = 0; k < 4; k++) {
    const a = k * TAU / 4 + TAU / 8, cx = Math.sin(a), cz = Math.cos(a), x0 = cx * 1.8, z0 = cz * 1.8, x1 = cx * 4.0, z1 = cz * 4.0, L = Math.hypot(x1 - x0, 0.25 - 2.4, z1 - z0);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(x0, 2.4, z0), new THREE.Vector3(x1, 0.25, z1), new THREE.Vector3(0, 1, 0)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    m.setPosition((x0 + x1) / 2, (2.4 + 0.25) / 2, (z0 + z1) / 2); p.push([new THREE.CylinderGeometry(0.1, 0.1, L, 6), STEEL, m]);
    p.push([new THREE.CylinderGeometry(0.55, 0.62, 0.16, 12), STEEL, M4(x1, 0.1, z1)]);
  }
  for (let k = 0; k < 6; k++) p.push([new THREE.BoxGeometry(0.5, 0.06, 0.1), STEEL, M4(Math.sin(TAU / 8) * 2.6, 0.5 + k * 0.32, Math.cos(TAU / 8) * 2.6 + 0.0, 0, TAU / 8, 0)]);   // ladder rungs on one leg
  return bakeColored(p);
}
export function landerWindowGeometry() { return bakeColored([[new THREE.CircleGeometry(0.42, 16), 0xffffff, M4(0, 4.45, 1.7, -0.06)]]); }
// the 1969-style descent stage (no cabin), dusty
export function stageGeometry() {
  const p = [[new THREE.CylinderGeometry(1.9, 1.9, 1.5, 8), 0xd9a050, M4(0, 2.2, 0)], [new THREE.CylinderGeometry(1.95, 1.95, 0.1, 8), 0xb48040, M4(0, 2.98, 0)], [new THREE.CylinderGeometry(0.6, 0.85, 0.6, 10, 1, true), DARK, M4(0, 1.2, 0)]];
  for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + TAU / 8, cx = Math.sin(a), cz = Math.cos(a); p.push([new THREE.CylinderGeometry(0.08, 0.08, 3.0, 6), 0xa0a4b0, M4(cx * 2.6, 1.2, cz * 2.6, cz * 0.62, 0, -cx * 0.62)], [new THREE.CylinderGeometry(0.45, 0.5, 0.12, 10), 0xa0a4b0, M4(cx * 3.5, 0.06, cz * 3.5)]); }
  // a small flag lying on the ground (blown over at liftoff), generic white cloth
  p.push([new THREE.CylinderGeometry(0.03, 0.03, 2.4, 5), STEEL, M4(5.0, 0.08, 1.0, 0, 0.3, Math.PI / 2)], [new THREE.BoxGeometry(0.9, 0.03, 0.6), 0xe8e4dc, M4(5.6, 0.1, 1.2, 0, 0.3, 0)]);
  return bakeColored(p);
}
// the old rover left behind: a grey frame, four mesh wheels, two seats, a dish
export function roverGeometry() {
  const p = [[new THREE.BoxGeometry(1.6, 0.12, 2.6), 0x9a9ea8, M4(0, 0.7, 0)], [new THREE.BoxGeometry(0.6, 0.4, 0.5), 0x6a6e78, M4(-0.35, 0.95, -0.1)], [new THREE.BoxGeometry(0.6, 0.4, 0.5), 0x6a6e78, M4(0.35, 0.95, -0.1)],
    [new THREE.BoxGeometry(1.2, 0.35, 0.6), 0xc8ccd6, M4(0, 0.95, 1.0)], [new THREE.CylinderGeometry(0.03, 0.03, 1.4, 5), STEEL, M4(0.5, 1.6, 1.1)], [new THREE.ConeGeometry(0.45, 0.2, 12, 1, true), 0xdcdce4, M4(0.5, 2.3, 1.1, -0.4)]];
  for (const [x, z] of [[0.9, 1.1], [-0.9, 1.1], [0.9, -1.1], [-0.9, -1.1]]) p.push([new THREE.TorusGeometry(0.4, 0.07, 6, 16), 0x7a7e88, M4(x, 0.42, z, 0, Math.PI / 2, 0)], [new THREE.CylinderGeometry(0.12, 0.12, 0.22, 8), 0x50545e, M4(x, 0.42, z, 0, 0, Math.PI / 2)]);
  return bakeColored(p);
}
// a snack crate (about 1.4 m): white = tinted by the instance colour (coral body), sun bands, cream lid
export function crateGeometry() {
  return bakeColored([[new THREE.BoxGeometry(1.3, 1.0, 1.0), CORAL], [new THREE.BoxGeometry(1.36, 0.16, 1.06), CREAM, M4(0, 0.55, 0)], [new THREE.BoxGeometry(0.16, 1.04, 1.04), SUN, M4(-0.38, 0, 0)], [new THREE.BoxGeometry(0.16, 1.04, 1.04), SUN, M4(0.38, 0, 0)],
    [new THREE.BoxGeometry(0.5, 0.3, 0.02), CREAM, M4(0, 0.05, 0.51)]]);
}
// the flag: a pole, a top rod (no wind up here) and a navy cloth with a sun-yellow star-and-snack mark (our own design). Origin at the foot.
export function makeFlag(mat) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 80; const g = c.getContext('2d');
  g.fillStyle = '#1f2756'; g.fillRect(0, 0, 128, 80); g.fillStyle = '#ff6b57'; g.fillRect(0, 62, 128, 18); g.fillStyle = '#ffd84d';
  g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 11 : 26; g.lineTo(64 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.closePath(); g.fill();
  g.fillStyle = '#fff4e6'; g.font = '900 11px Montserrat, sans-serif'; g.textAlign = 'center'; g.fillText('SNACK BASE', 64, 75);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group(); grp.add(new THREE.Mesh(bakeColored([[new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6), STEEL, M4(0, 1.3, 0)], [new THREE.CylinderGeometry(0.025, 0.025, 1.2, 5), STEEL, M4(0.6, 2.55, 0, 0, 0, Math.PI / 2)], [new THREE.SphereGeometry(0.06, 8, 6), SUN, M4(0, 2.62, 0)]]), mat));
  const cl = new THREE.PlaneGeometry(1.15, 0.72, 6, 1); const pp = cl.attributes.position; for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin(pp.getX(i) * 5) * 0.04);   // a fixed ripple, it never waves
  const cloth = new THREE.Mesh(cl, curve(new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide, emissive: 0x222233 }))); cloth.position.set(0.6, 2.17, 0); grp.add(cloth);
  return { group: grp, tex: t };
}
// the sky: stars (one Points), the Sun (glow sprite) and Earth (lit sphere + rim glow). All follow the camera.
export function makeSky(scene, tier) {
  const n = tier === 'low' ? 700 : 1500, r = makeRng(77), P = new Float32Array(n * 3), C = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = r() * 1.15 - 0.15, a = r() * TAU, s = Math.sqrt(1 - u * u); P[i * 3] = Math.cos(a) * s * 1500; P[i * 3 + 1] = u * 1500; P[i * 3 + 2] = Math.sin(a) * s * 1500; const b = 0.35 + Math.pow(r(), 3) * 1.6, w = r(); C[i * 3] = b * (0.9 + w * 0.1); C[i * 3 + 1] = b * 0.95; C[i * 3 + 2] = b * (1.0 + (1 - w) * 0.15); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(P, 3)); sg.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: tier === 'low' ? 1.6 : 2.0, sizeAttenuation: false, vertexColors: true, toneMapped: false, depthWrite: false, transparent: true, fog: false }));
  stars.frustumCulled = false; stars.renderOrder = -10; scene.add(stars);
  const glow = (stops, s = 128) => { const c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); for (const [a, col] of stops) gr.addColorStop(a, col); g.fillStyle = gr; g.fillRect(0, 0, s, s); const t = new THREE.CanvasTexture(c); return t; };
  const sunTex = glow([[0, 'rgba(255,255,255,1)'], [0.09, 'rgba(255,250,235,1)'], [0.13, 'rgba(255,220,160,0.5)'], [0.4, 'rgba(255,170,90,0.12)'], [1, 'rgba(255,140,60,0)']]);
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, color: new THREE.Color(4.5, 4.0, 3.2), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, transparent: true })); sun.scale.setScalar(260); sun.renderOrder = -9; scene.add(sun);
  // Earth: blue oceans, our own blobby continents, cloud swirls (a canvas map), lit by the Sun so it shows a phase
  const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d'), rr = makeRng(5);
  g.fillStyle = '#2a6fd6'; g.fillRect(0, 0, 512, 256);
  for (let k = 0; k < 14; k++) { const x = rr() * 512, y = 50 + rr() * 156, s = 18 + rr() * 46; g.fillStyle = rr() < 0.6 ? '#4caf5a' : '#c9a35c'; g.beginPath(); for (let a = 0; a < 12; a++) { const q = a / 12 * TAU, rad = s * (0.6 + rr() * 0.5); g.lineTo(x + Math.cos(q) * rad * 1.4, y + Math.sin(q) * rad); } g.closePath(); g.fill(); }
  g.fillStyle = '#f4f8ff'; g.fillRect(0, 0, 512, 16); g.fillRect(0, 240, 512, 16);
  g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineCap = 'round'; for (let k = 0; k < 26; k++) { g.lineWidth = 3 + rr() * 7; const x = rr() * 512, y = 20 + rr() * 216; g.beginPath(); g.arc(x, y, 10 + rr() * 30, rr() * 6, rr() * 6 + 1.5 + rr() * 2); g.stroke(); }
  const et = new THREE.CanvasTexture(c); et.colorSpace = THREE.SRGBColorSpace;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(70, 40, 24), new THREE.MeshLambertMaterial({ map: et, color: new THREE.Color(2.4, 2.4, 2.6), emissive: new THREE.Color(0.012, 0.02, 0.05) })); earth.renderOrder = -8; scene.add(earth);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow([[0, 'rgba(120,180,255,0)'], [0.62, 'rgba(120,180,255,0)'], [0.7, 'rgba(140,200,255,0.55)'], [0.78, 'rgba(110,170,255,0.18)'], [1, 'rgba(90,150,255,0)']]), color: new THREE.Color(1.6, 1.8, 2.2), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false }));
  halo.scale.setScalar(70 * 2 / 0.7); halo.renderOrder = -7; scene.add(halo);
  return { stars, sun, earth, halo, tex: [sunTex, et] };
}
// a glow texture for crates, the target beacon and egg glints
export function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
// a tall beam over the current target (curved like the ground so it stands on it)
export function makeBeam() {
  const geo = new THREE.CylinderGeometry(0.55, 0.55, 60, 12, 1, true); geo.translate(0, 30, 0);
  const mat = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(2.2, 1.7, 0.5) }, uA: { value: 1 }, uCurve: U.uCurve }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'uniform float uCurve; varying float vY; void main(){ vY = position.y / 60.0; vec4 w = modelMatrix * vec4(position, 1.0); vec2 d = w.xz - cameraPosition.xz; w.y -= dot(d, d) * uCurve; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 uCol; uniform float uA; varying float vY; void main(){ gl_FragColor = vec4(uCol * uA * pow(1.0 - vY, 2.0) * 0.22, 1.0); }' });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 8; return m;
}
// footprints by the old stage: flattened dark ovals (instanced), placed on the ground by the mode
export function footGeometry() { const g = new THREE.CircleGeometry(0.16, 10); g.rotateX(-Math.PI / 2); g.scale(1, 1, 2); return g; }
