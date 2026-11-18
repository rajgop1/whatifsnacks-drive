// MARS ROVER world: a seeded heightfield (rolling plains, dune seas with gentle windward slopes and steep slip faces, dark basalt patches, one big ramp dune,
// a long canyon with a rim lip and banded walls), streamed 64 m chunks around the rover, a custom terrain shader (flat facets, warm sun, soft brown shadows,
// thin dusty haze), a butterscotch sky dome with a pale-blue glow round the small Sun, swirling dust devils, wind-blown dust streaks, tyre tracks, and the art:
// the six-wheeled rover with the hoodie mascot, our lander, snack crates, the flag, an old tiny rover with its airbag lander, and the Olympus Mons sign-post.
// Everything is built from primitives and canvases: our own cartoon designs (no real mission patches or logos). Structure copied from moon_world.js.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { bakeColored, M4, makeRng } from '../util.js';
import { mascotParts } from '../models.js';

export const G = 3.71;                       // Mars surface gravity, m/s²
export const CURVE = 1 / (2 * 900);          // stylised curvature (toy planet, R = 900 m; the real Mars is 3,390 km)
export const CHUNK = 64, GRID = 5;
const TAU = Math.PI * 2;
const TAIL = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';
export const U = { uCurve: { value: CURVE }, uFogD: { value: 0.0042 }, uFogC: { value: new THREE.Color(1.0, 0.47, 0.2) }, uStorm: { value: 0 }, uT: { value: 0 } };   // shared uniforms

// ---------------------------------------------------------------- noise
export function hash(ix, iz, s) { let h = Math.imul(ix | 0, 374761393) ^ Math.imul(iz | 0, 668265263) ^ Math.imul(s | 0, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
export function vn(x, z, s) {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz, s), b = hash(ix + 1, iz, s), c = hash(ix, iz + 1, s), d = hash(ix + 1, iz + 1, s);
  return (a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz) * 2 - 1;
}
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- the seeded world: layout first (lander, crates, ramp dune, canyon, eggs, devils), then terrain around it
export class World {
  constructor(seed) {
    this.seed = seed | 0; const r = makeRng(2000 + (seed | 0) * 7919);
    const az = (this.az = r() * TAU), at = (ang, d) => ({ x: Math.sin(az + ang) * d, z: Math.cos(az + ang) * d });
    // the canyon: a long trench whose near rim passes ~200 m from the lander
    const caz = az + 1.22; this.cn = { x: Math.sin(caz), z: Math.cos(caz) }; this.ct = { x: Math.cos(caz), z: -Math.sin(caz) }; this.cD = 165; this.cW = 92; this.cDepth = 34;
    const rim = (along, s) => { const d = this.cD + this.wob(along) + s; return { x: this.cn.x * d + this.ct.x * along, z: this.cn.z * d + this.ct.z * along }; };
    // six crates: dunes, two on the canyon rim, dunes again, back toward the lander
    const c0 = at(-0.1 + (r() - 0.5) * 0.1, 92), c1 = at(0.5 + (r() - 0.5) * 0.12, 124), c2 = rim(-30, -11), c3 = rim(30, -11), c4 = at(2.2 + (r() - 0.5) * 0.14, 124), c5 = at(2.9 + (r() - 0.5) * 0.12, 82);
    this.crates = [c0, c1, c2, c3, c4, c5].map((p) => ({ x: p.x, z: p.z, y: 0 }));
    // the ramp dune on the way to the first crate (windward slope toward the lander, slip face beyond the brink)
    this.start = { x: Math.sin(az + 0.9) * 6, z: Math.cos(az + 0.9) * 6 }; const sx = c0.x - this.start.x, sz = c0.z - this.start.z, L0 = Math.hypot(sx, sz), dx = sx / L0, dz = sz / L0;
    this.ramp = { x: this.start.x + dx * 46, z: this.start.z + dz * 46, dx, dz, H: 3.6, L: 22, F: 6.5, W: 12 };
    // off-route easter eggs: the old tiny rover with its airbag lander, and the Olympus Mons sign-post
    const ov = at(-1.25 + (r() - 0.5) * 0.25, 150), sg = at(3.85 + (r() - 0.5) * 0.25, 128);
    this.oldRover = { x: ov.x, z: ov.z, yaw: r() * TAU }; this.sign = { x: sg.x, z: sg.z, yaw: Math.atan2(-sg.x, -sg.z) };   // the sign faces the lander
    this.flagAt = { x: Math.sin(az + 2.3) * 7.5, z: Math.cos(az + 2.3) * 7.5 };
    // dust devils wander round homes between crates
    this.devHome = [[c0, c1], [c1, c2], [c4, c5]].map(([a, b], k) => ({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, ph: k * 2.1 + r() }));
    this.keep = [[0, 0, 40], ...this.crates.map((c) => [c.x, c.z, 12]), [this.ramp.x, this.ramp.z, 30], [ov.x, ov.z, 16], [sg.x, sg.z, 12]];
    const pts = [this.start, ...this.crates, this.flagAt]; this.segs = pts.slice(1).map((p, i) => [pts[i].x, pts[i].z, p.x, p.z]);   // boulders stay off the crate-to-crate lines
    this.o = { rock: 0, crest: 0, wall: 0 };
    for (const c of this.crates) c.y = this.h(c.x, c.z);
  }
  wob(along) { return 10 * vn(along / 110, 0.5, this.seed + 5); }
  cs(x, z) { const along = x * this.ct.x + z * this.ct.z; return x * this.cn.x + z * this.cn.z - this.cD - this.wob(along); }   // signed distance past the near canyon rim
  // terrain height at (x, z). o (optional) receives rock / dune-crest / canyon-wall weights for the colours
  h(x, z, o) {
    const s = this.seed; let y = 2.4 * vn(x / 160, z / 160, s) + 0.85 * vn(x / 50, z / 50, s + 1) + 0.06 * vn(x / 7, z / 7, s + 2);
    // dunes: transverse ridges across the wind, asymmetric (long windward rise, short steep slip face), only inside dune-sea patches
    const m = sstep(-0.15, 0.45, vn(x / 150, z / 150, s + 6)), ph = (x * 0.8 + z * 0.6) / 26 + 0.9 * vn(x / 70, z / 70, s + 7), f = ph - Math.floor(ph);
    const prof = f < 0.8 ? sstep(0, 0.8, f) : 1 - sstep(0.8, 1, f); y += 1.3 * m * prof;
    // the big ramp dune
    const R = this.ramp, ru = (x - R.x) * R.dx + (z - R.z) * R.dz, rv = Math.abs((x - R.x) * R.dz - (z - R.z) * R.dx); let rp = 0;
    if (ru > -R.L && ru < R.F && rv < R.W * 1.5) { rp = (ru < 0 ? Math.pow((ru + R.L) / R.L, 2.2) : 1 - sstep(0, R.F, ru)) * (1 - sstep(R.W * 0.55, R.W * 1.5, rv)); }
    const d = Math.hypot(x, z), fl = sstep(14, 40, d); y = y * fl + R.H * rp;
    // the canyon: a lip on the near rim, steep banded walls, a floor, the far wall back up
    const c = this.cs(x, z); let wall = 0;
    if (c > -12) {
      y += 0.8 * Math.exp(-(((c + 3) / 2.6) ** 2));
      if (c > 0) { const k = sstep(0, 16, c) * (1 - sstep(this.cW - 18, this.cW, c)); const band = k + 0.05 * Math.sin(k * TAU * 3); y -= this.cDepth * band; wall = k > 0.02 && k < 0.98 ? 1 : 0.35 * k; }
    }
    if (o) { o.rock = (1 - m) * fl; o.crest = m * (f > 0.7 && f < 0.86 ? 1 : 0) * fl + rp * 0.5; o.wall = wall; o.ramp = rp; }
    return y;
  }
  devil(k, t, out) { const H = this.devHome[k]; out.x = H.x + 16 * Math.sin(t * 0.21 + H.ph); out.z = H.z + 13 * Math.sin(t * 0.15 + H.ph * 2); return out; }
}

// ---------------------------------------------------------------- terrain chunks (a pool of GRID² meshes rebuilt in place)
export const NC = 24;
const TV = `uniform float uCurve; attribute vec3 tint; attribute float sh; varying vec3 vW, vC; varying float vSh, vD;
  void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vC = tint; vSh = sh; vec2 d = w.xz - cameraPosition.xz; vD = length(d); w.y -= dot(d, d) * uCurve; gl_Position = projectionMatrix * viewMatrix * w; }`;
const TF = `uniform vec3 uSun, uSunCol, uAmb, uSky, uFogC; uniform vec4 uCast[${NC}]; uniform float uFar, uFogD; varying vec3 vW, vC; varying float vSh, vD;
  void main(){ vec3 N = normalize(cross(dFdx(vW), dFdy(vW))); if (N.y < 0.0) N = -N;
    float nl = max(dot(N, uSun), 0.0), s = smoothstep(0.25, 0.75, vSh);
    for (int i = 0; i < ${NC}; i++) { vec4 c = uCast[i]; vec3 oc = c.xyz - vW; float b = dot(oc, uSun); if (b > 0.0) { float d2 = dot(oc, oc) - b * b, r2 = c.w * c.w; s *= mix(0.25, 1.0, smoothstep(r2 * 0.7, r2, d2)); } }
    vec3 col = vC * (uSunCol * nl * mix(0.3, 1.0, s) + uAmb + uSky * (0.5 + 0.5 * N.y));
    float f = 1.0 - exp(-vD * uFogD); f = max(f, smoothstep(uFar * 0.6, uFar, vD));
    col = mix(col, uFogC, f);
    gl_FragColor = vec4(col, 1.0);${TAIL}}`;

export class Terrain {
  constructor(scene, world, tier, sunDir) {
    this.w = world; this.sun = sunDir; this.seg = tier === 'low' ? 20 : tier === 'high' ? 36 : 30; const S = this.seg, n = (S + 1) * (S + 1);
    this.casts = Array.from({ length: NC }, () => new THREE.Vector4(0, -9999, 0, 0.01));
    this.U = { uSun: { value: sunDir }, uSunCol: { value: new THREE.Color(1.5, 1.3, 1.08) }, uAmb: { value: new THREE.Color(0.2, 0.13, 0.1) }, uSky: { value: new THREE.Color(0.3, 0.2, 0.15) },
      uCast: { value: this.casts }, uFar: { value: CHUNK * 2.05 }, uCurve: U.uCurve, uFogD: U.uFogD, uFogC: U.uFogC };
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
    this.hs = new Float32Array((S + 3) * (S + 3)); this.ccx = 1e9; this.ccz = 1e9;
    const bg = new THREE.DodecahedronGeometry(1, 0); const pp = bg.attributes.position; for (let i = 0; i < pp.count; i++) pp.setY(i, pp.getY(i) * 0.7);
    this.rockMat = curve(new THREE.MeshLambertMaterial({ color: 0x6a4436, flatShading: true }));
    this.rocks = new THREE.InstancedMesh(bg, this.rockMat, GRID * GRID * 6); this.rocks.frustumCulled = false; scene.add(this.rocks);
    this.o3 = new THREE.Object3D(); this.zero = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < this.rocks.count; i++) this.rocks.setMatrixAt(i, this.zero);
  }
  key(cx, cz) { return cx * 4099 + cz; }
  update(px, pz, budget = 2) {
    const ccx = Math.floor(px / CHUNK), ccz = Math.floor(pz / CHUNK), H = (GRID - 1) / 2;
    if (ccx !== this.ccx || ccz !== this.ccz) {
      this.ccx = ccx; this.ccz = ccz;
      for (const c of this.chunks) c.want = Math.abs(c.cx - ccx) <= H && Math.abs(c.cz - ccz) <= H;
      for (let a = -H; a <= H; a++) for (let b = -H; b <= H; b++) {
        const cx = ccx + a, cz = ccz + b, have = this.map.get(this.key(cx, cz)); if (have && have.want) continue;
        const c = this.chunks.find((q) => !q.want); if (!c) continue;
        this.map.delete(this.key(c.cx, c.cz)); c.cx = cx; c.cz = cz; c.want = true; c.dirty = true; c.m.visible = false; this.map.set(this.key(cx, cz), c);
      }
    }
    let n = 0; for (const c of this.chunks) { if (!c.dirty) continue; if (n >= budget) break; this.build(c); n++; }
    if (n) this.rocks.instanceMatrix.needsUpdate = true;
  }
  reset(px, pz) { this.ccx = 1e9; this.chunks.forEach((c, i) => { c.want = false; c.cx = 1e9 + i; }); this.map.clear(); this.update(px, pz, Infinity); }
  build(c) {
    const S = this.seg, st = CHUNK / S, x0 = c.cx * CHUNK, z0 = c.cz * CHUNK, w = this.w, o = w.o, hs = this.hs, W = S + 3;
    for (let j = -1; j <= S + 1; j++) for (let i = -1; i <= S + 1; i++) hs[(j + 1) * W + i + 1] = w.h(x0 + i * st, z0 + j * st);
    const P = c.g.attributes.position.array, T = c.g.attributes.tint.array, SH = c.g.attributes.sh.array, L = this.sun, tanE = L.y / Math.hypot(L.x, L.z), lx = L.x / Math.hypot(L.x, L.z), lz = L.z / Math.hypot(L.x, L.z);
    let ymin = 1e9, ymax = -1e9;
    for (let j = 0; j <= S; j++) for (let i = 0; i <= S; i++) {
      const v = j * (S + 1) + i, x = x0 + i * st, z = z0 + j * st, y = hs[(j + 1) * W + i + 1]; w.h(x, z, o);
      P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z; if (y < ymin) ymin = y; if (y > ymax) ymax = y;
      // butterscotch sand, paler crests, darker basalt where the dunes thin out, red-orange bands down the canyon walls
      const n1 = vn(x / 21, z / 21, w.seed + 9) * 0.5 + 0.5, sp = hash(Math.floor(x / 2), Math.floor(z / 2), w.seed + 11) > 0.94 ? -0.06 : 0, rk = o.rock * sstep(0.1, 0.6, vn(x / 34, z / 34, w.seed + 12) * 0.5 + 0.5);
      let r = 0.9 + 0.1 * n1 + 0.1 * o.crest + sp, g = 0.46 + 0.07 * n1 + 0.1 * o.crest + sp, b = 0.21 + 0.04 * n1 + 0.06 * o.crest + sp;
      r += (0.36 - r) * rk * 0.85; g += (0.22 - g) * rk * 0.85; b += (0.18 - b) * rk * 0.85;
      if (o.wall > 0) { const bd = Math.sin(y * 0.9) > 0.2 ? 1 : 0.78; r += (0.72 * bd - r) * o.wall; g += (0.34 * bd - g) * o.wall; b += (0.2 * bd - b) * o.wall; }
      T[v * 3] = r; T[v * 3 + 1] = g; T[v * 3 + 2] = b;
      const nx = hs[(j + 1) * W + i] - hs[(j + 1) * W + i + 2], nz = hs[j * W + i + 1] - hs[(j + 2) * W + i + 1], nd = (nx * L.x + 2 * st * L.y + nz * L.z) / Math.hypot(nx, 2 * st, nz);
      let lit = nd > 0.02 ? 1 : 0;
      if (lit) for (const d of MARCH) { if (w.h(x + lx * d, z + lz * d) > y + 0.25 + d * tanE) { lit = 0; break; } }
      SH[v] = lit;
    }
    const nB = Math.floor(hash(c.cx, c.cz, w.seed + 21) * 6.9); c.nr = 0; const base = this.chunks.indexOf(c) * 6;
    for (let k = 0; k < 6; k++) {
      let on = k < nB; const bx = x0 + hash(c.cx, c.cz, w.seed + 30 + k) * CHUNK, bz = z0 + hash(c.cx, c.cz, w.seed + 40 + k) * CHUNK, big = hash(c.cx, c.cz, w.seed + 50 + k);
      const r = big > 0.92 ? 1.8 + big * 0.7 : 0.3 + Math.pow(hash(c.cx, c.cz, w.seed + 60 + k), 2) * 1.1;
      if (on) for (const q of w.keep) { const dx = bx - q[0], dz = bz - q[1]; if (dx * dx + dz * dz < (q[2] * 0.6 + r) ** 2) { on = false; break; } }
      if (on && w.cs(bx, bz) > -4) on = false;
      if (on) for (const s of w.segs) { const ex = s[2] - s[0], ez = s[3] - s[1], q = Math.max(0, Math.min(1, ((bx - s[0]) * ex + (bz - s[1]) * ez) / (ex * ex + ez * ez))); if (Math.hypot(bx - s[0] - ex * q, bz - s[1] - ez * q) < 6 + r) { on = false; break; } }   // nothing in the canyon (and the rim lip stays clear)
      if (!on) { this.rocks.setMatrixAt(base + k, this.zero); continue; }
      const by = w.h(bx, bz) - r * 0.25, R = c.rocks, i4 = c.nr * 4; R[i4] = bx; R[i4 + 1] = by; R[i4 + 2] = bz; R[i4 + 3] = r; c.nr++;
      const o3 = this.o3; o3.position.set(bx, by, bz); o3.rotation.set(big * 3, hash(c.cx, c.cz, k) * 6, big * 2); o3.scale.set(r, r, r * (0.8 + big * 0.4)); o3.updateMatrix(); this.rocks.setMatrixAt(base + k, o3.matrix);
    }
    const g = c.g; for (const k of ['position', 'tint', 'sh']) g.attributes[k].needsUpdate = true;
    g.boundingBox.min.set(x0, ymin, z0); g.boundingBox.max.set(x0 + CHUNK, ymax, z0 + CHUNK); g.boundingBox.getBoundingSphere(g.boundingSphere); g.boundingSphere.radius += 12;
    c.dirty = false; c.m.visible = true;
  }
  near(x, z, fn) { const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const c = this.map.get(this.key(cx + a, cz + b)); if (!c || c.dirty) continue; for (let k = 0; k < c.nr; k++) fn(c.rocks[k * 4], c.rocks[k * 4 + 1], c.rocks[k * 4 + 2], c.rocks[k * 4 + 3]); } }
}
const MARCH = [1.5, 3, 5, 8, 12, 17, 24, 32];

// curve(mat): bend a built-in material's vertices down with distance from the camera (the toy-planet horizon). Fog still works (mvPosition is set).
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
  mat.customProgramCacheKey = () => 'mars-curve'; return mat;
}

// ---------------------------------------------------------------- our own post chain: a higher bloom threshold than js/post.js (a bright sky must not bloom), a warm dusty grade
export function makeMarsPost(renderer, scene, camera, tier) {
  if (tier === 'low') return { render() { renderer.render(scene, camera); }, setSize() {}, uniforms: null, dispose() {} };
  const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }), comp = new EffectComposer(renderer, rt);
  comp.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), tier === 'high' ? 0.5 : 0.42, 0.5, 2.2); comp.addPass(bloom);
  comp.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) }, sun: { value: new THREE.Vector2(0.5, 0.6) }, sunVis: { value: 1 }, hit: { value: 0 }, storm: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time, sunVis, hit, storm; uniform vec2 res, sun; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec2 d = vUv - 0.5; float r2 = dot(d,d);
        vec2 off = d * (0.0012 + 0.008 * r2 + 0.02 * hit);
        vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
        float l = dot(c, vec3(0.299,0.587,0.114));
        c = mix(c, c * vec3(0.92,0.88,1.06), smoothstep(0.45, 0.0, l));
        c = (c - 0.5) * 1.06 + 0.5; c = mix(vec3(dot(c,vec3(0.299,0.587,0.114))), c, 1.08);
        vec2 ds = (vUv - sun) * vec2(res.x / res.y, 1.0); c += vec3(0.75,0.85,1.0) * exp(-length(ds) * 7.0) * 0.07 * sunVis;
        c *= mix(0.68, 1.0, smoothstep(0.85, 0.2, length(d) * 1.2));
        c += (h(vUv * res + time * 61.0) - 0.5) * (0.03 + 0.03 * storm);
        c = mix(c, vec3(1.0, 0.35, 0.2), hit * 0.15 * smoothstep(0.1, 0.4, r2));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  comp.addPass(grade);
  return {
    uniforms: grade.uniforms,
    render() { comp.render(); },
    setSize(w, h, pr) { comp.setPixelRatio(pr); comp.setSize(w, h); grade.uniforms.res.value.set(w * pr, h * pr); bloom.resolution.set(w * pr / 2, h * pr / 2); },
    dispose() { bloom.dispose(); comp.dispose(); rt.dispose(); },
  };
}

// ---------------------------------------------------------------- art
const CREAM = 0xf3e6d0, CORAL = 0xff6b57, NAVY = 0x1f2756, SUN = 0xffd84d, DARK = 0x2a2d3c, STEEL = 0xb9bfd0, TYRE = 0x4a3c40, TEAL = 0x4fd1c5;

export const WHEELS = [[1.08, 1.25], [-1.08, 1.25], [1.14, 0], [-1.14, 0], [1.08, -1.25], [-1.08, -1.25]];   // front pair, middle pair, rear pair (x, z)
// the rover: root at the ground contact centre, nose +z. mats = { body, glass }. Rocker legs, six chunky wheels, a solar deck, the hoodie mascot in a bubble seat, a dish and a snack crate.
export function makeRover(mats) {
  const body = [
    [new THREE.BoxGeometry(1.55, 0.42, 2.5), CREAM, M4(0, 1.02, 0)],                                    // tub
    [new THREE.BoxGeometry(1.6, 0.12, 2.55), CORAL, M4(0, 0.84, 0)],                                    // coral skirt
    [new THREE.BoxGeometry(1.4, 0.3, 0.3), CORAL, M4(0, 1.0, 1.34)],                                    // bumper
    [new THREE.SphereGeometry(0.11, 10, 8), SUN, M4(-0.45, 1.05, 1.5)], [new THREE.SphereGeometry(0.11, 10, 8), SUN, M4(0.45, 1.05, 1.5)],   // headlights
    [new THREE.BoxGeometry(2.3, 0.06, 1.05), 0x3a5aa8, M4(0, 1.3, -0.55)],                                  // the solar deck (wider than the tub)
    [new THREE.BoxGeometry(0.75, 0.1, 0.62), CREAM, M4(0, 1.3, 0.55)],                                  // seat
    [new THREE.BoxGeometry(0.75, 0.55, 0.1), CORAL, M4(0, 1.55, 0.22, 0.1)],                            // seat back
    [new THREE.CylinderGeometry(0.035, 0.035, 0.5, 6), DARK, M4(0, 1.45, 1.0, -0.6)], [new THREE.TorusGeometry(0.17, 0.04, 6, 16), SUN, M4(0, 1.62, 0.9, -0.9)],   // steering
    [new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6), STEEL, M4(0.8, 2.05, -0.05)], [new THREE.SphereGeometry(0.42, 14, 8, 0, TAU, 0, 1.0), 0xf4f4f8, M4(0.8, 2.75, -0.05, -0.7, 0.4, 0)],   // dish mast + dish
    [new THREE.SphereGeometry(0.08, 8, 6), CORAL, M4(0.8, 2.8, 0.1)],
  ];
  for (let k = -2; k <= 2; k++) body.push([new THREE.BoxGeometry(0.03, 0.065, 1.0), TEAL, M4(k * 0.44, 1.31, -0.55)]);   // panel cells
  // rocker-bogie legs (visual): a bar along each side from the front to the rear wheel, with a knee over the middle one
  for (const sx of [-1, 1]) { body.push([new THREE.BoxGeometry(0.1, 0.12, 2.6), STEEL, M4(sx * 0.95, 0.72, 0)], [new THREE.BoxGeometry(0.12, 0.35, 0.12), STEEL, M4(sx * 0.95, 0.85, 0)]); for (const z of [1.25, 0, -1.25]) body.push([new THREE.BoxGeometry(0.08, 0.3, 0.08), STEEL, M4(sx * 1.05, 0.6, z)]); }
  // the snack crate on the back
  body.push([new THREE.BoxGeometry(0.95, 0.55, 0.7), CORAL, M4(0, 1.62, -0.75)], [new THREE.BoxGeometry(0.99, 0.09, 0.74), CREAM, M4(0, 1.92, -0.75)],
    [new THREE.BoxGeometry(0.12, 0.57, 0.74), SUN, M4(-0.24, 1.62, -0.75)], [new THREE.BoxGeometry(0.12, 0.57, 0.74), SUN, M4(0.24, 1.62, -0.75)]);
  const root = new THREE.Group(), chassis = new THREE.Group(); root.add(chassis);
  chassis.add(new THREE.Mesh(bakeColored(body), mats.body));
  const mp = mascotParts(0xff6b57); mp.leg.dispose();
  const kid = new THREE.Group(); kid.position.set(0, 0.72, 0.5); kid.scale.setScalar(0.6); chassis.add(kid);
  kid.add(new THREE.Mesh(mp.torso, mats.body));
  const arms = []; for (const sx of [-1, 1]) { const p = new THREE.Group(); p.position.set(sx * 0.33, 1.38, 0); p.rotation.set(-1.15, 0, sx * 0.1); p.add(new THREE.Mesh(mp.arm, mats.body)); kid.add(p); arms.push(p); }
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.46, 18, 12), mats.glass); helmet.position.set(0, 1.78, 0.02); kid.add(helmet);
  const wp = [[new THREE.CylinderGeometry(0.42, 0.42, 0.36, 16), TYRE, M4(0, 0, 0, 0, 0, Math.PI / 2)], [new THREE.CylinderGeometry(0.2, 0.2, 0.38, 12), SUN, M4(0, 0, 0, 0, 0, Math.PI / 2)], [new THREE.CylinderGeometry(0.07, 0.07, 0.42, 8), CORAL, M4(0, 0, 0, 0, 0, Math.PI / 2)]];
  for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; wp.push([new THREE.BoxGeometry(0.38, 0.07, 0.13), 0x2a2228, M4(0, Math.cos(a) * 0.43, Math.sin(a) * 0.43, a)]); }
  const wg = bakeColored(wp), wheels = [];
  for (const [x, z] of WHEELS) { const piv = new THREE.Group(); piv.position.set(x, 0.42, z); const spin = new THREE.Mesh(wg, mats.body); piv.add(spin); root.add(piv); wheels.push({ piv, spin, x, z }); }
  return { root, chassis, wheels, arms, kid, helmet };
}

// our lander: a squat cream dome on three legs with a coral band, a glowing window, a ramp down, and its striped parachute lying flat beside it. Origin on the ground.
export function landerGeometry() {
  const p = [[new THREE.CylinderGeometry(2.4, 2.6, 1.4, 12), CREAM, M4(0, 2.2, 0)], [new THREE.CylinderGeometry(2.62, 2.62, 0.3, 12), CORAL, M4(0, 1.55, 0)], [new THREE.SphereGeometry(2.4, 16, 8, 0, TAU, 0, Math.PI / 2), CREAM, M4(0, 2.9, 0)],
    [new THREE.CylinderGeometry(0.06, 0.06, 1.4, 6), STEEL, M4(-0.9, 5.6, 0.4)], [new THREE.SphereGeometry(0.5, 12, 6, 0, TAU, 0, 1.0), 0xf4f4f8, M4(-0.9, 6.3, 0.4, 0.5)], [new THREE.SphereGeometry(0.12, 8, 6), SUN, M4(-0.9, 6.35, 0.6)],
    [new THREE.BoxGeometry(1.3, 0.1, 3.2), STEEL, M4(0, 0.75, 3.6, 0.42)]];   // ramp
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + 0.5, cx = Math.sin(a), cz = Math.cos(a); p.push([new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), STEEL, M4(cx * 2.6, 1.0, cz * 2.6, cz * 0.45, 0, -cx * 0.45)], [new THREE.CylinderGeometry(0.6, 0.66, 0.16, 12), STEEL, M4(cx * 3.1, 0.08, cz * 3.1)]); }
  for (let k = 0; k < 8; k++) p.push([new THREE.CircleGeometry(4.2, 3, k / 8 * TAU, TAU / 8), k % 2 ? CORAL : CREAM, M4(-7.5, 0.12, -3.5, -Math.PI / 2)]);   // the parachute, flat on the sand
  return bakeColored(p);
}
export function landerWindowGeometry() { return bakeColored([[new THREE.CircleGeometry(0.5, 16), 0xffffff, M4(0, 2.3, 2.52, -0.05)]]); }
// the old tiny rover (about 65 cm long, like the very first one) and its petal lander with saggy airbags
export function oldRoverGeometry() {
  const p = [[new THREE.BoxGeometry(0.48, 0.16, 0.65), 0xb0aaa4, M4(0, 0.3, 0)], [new THREE.BoxGeometry(0.5, 0.02, 0.6), 0x3b4a7a, M4(0, 0.39, 0)], [new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), STEEL, M4(0.15, 0.52, -0.2)]];
  for (const z of [0.25, 0, -0.25]) for (const x of [-0.28, 0.28]) p.push([new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10), 0x6a6460, M4(x, 0.08, z, 0, 0, Math.PI / 2)]);
  // the lander, 4 m away: a low triangle base, three open petals, deflated airbag lumps
  const L = (x, z, ...r) => M4(x + 4, 0, z, ...r);
  p.push([new THREE.CylinderGeometry(0.7, 0.8, 0.45, 3), 0xc8c0b4, L(0, 0)]);
  for (let k = 0; k < 3; k++) { const a = k * TAU / 3, cx = Math.sin(a), cz = Math.cos(a), m = M4(4 + cx * 1.2, 0.12, cz * 1.2, 0, a, 0); p.push([new THREE.BoxGeometry(1.0, 0.06, 1.1), 0x8a8680, m], [new THREE.BoxGeometry(0.85, 0.02, 0.9), 0x3b4a7a, M4(4 + cx * 1.2, 0.16, cz * 1.2, 0, a, 0)]);
    for (let j = 0; j < 3; j++) p.push([new THREE.SphereGeometry(0.42, 8, 6), 0xe0d8c8, M4(4 + Math.sin(a + 1 + j * 0.3) * 1.9, 0.18, Math.cos(a + 1 + j * 0.3) * 1.9, 0, 0, 0, 1, 0.4, 1)]); }
  p.push([new THREE.CylinderGeometry(0.02, 0.02, 1.0, 5), STEEL, L(0.2, 0, 0, 0, 0)]);
  return bakeColored(p);
}
// the Olympus Mons sign-post: a post, an arrow board, and a tiny pebble "mountain" beside it with its own small card
export function makeSign(mat) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#1f2756'; g.beginPath(); g.moveTo(8, 10); g.lineTo(206, 10); g.lineTo(250, 64); g.lineTo(206, 118); g.lineTo(8, 118); g.closePath(); g.fill();
  g.strokeStyle = '#ffd84d'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#ffd84d'; g.font = '900 34px Montserrat, sans-serif'; g.textAlign = 'center'; g.fillText('OLYMPUS', 116, 52); g.fillText('MONS', 116, 88);
  g.fillStyle = '#fff4e6'; g.font = '900 17px Montserrat, sans-serif'; g.fillText('22 KM TALL · THAT WAY', 116, 110);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const c2 = document.createElement('canvas'); c2.width = 128; c2.height = 64; const g2 = c2.getContext('2d'); g2.fillStyle = '#fff4e6'; g2.fillRect(0, 0, 128, 64); g2.fillStyle = '#1f2756'; g2.font = '900 18px Montserrat, sans-serif'; g2.textAlign = 'center'; g2.fillText('NOT THIS', 64, 28); g2.fillText('ONE', 64, 52);
  const t2 = new THREE.CanvasTexture(c2); t2.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(bakeColored([[new THREE.CylinderGeometry(0.08, 0.1, 3.0, 6), 0x8a6a4a, M4(0, 1.5, 0)], [new THREE.ConeGeometry(1.0, 0.9, 7), 0x7a4a36, M4(2.2, 0.4, 0.5)], [new THREE.CylinderGeometry(0.03, 0.03, 0.9, 4), 0x8a6a4a, M4(2.9, 0.45, 1.0)]]), mat));
  const lm = (map) => curve(new THREE.MeshLambertMaterial({ map, emissive: 0x302018, side: THREE.FrontSide }));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), lm(t)); board.position.set(0.9, 2.45, 0.06); grp.add(board);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), lm(t)); back.position.set(0.9, 2.45, -0.06); back.rotation.y = Math.PI; grp.add(back);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), lm(t2)); card.position.set(2.9, 0.95, 1.02); grp.add(card);
  return { group: grp, tex: [t, t2] };
}
export function crateGeometry() {
  return bakeColored([[new THREE.BoxGeometry(1.3, 1.0, 1.0), CORAL], [new THREE.BoxGeometry(1.36, 0.16, 1.06), CREAM, M4(0, 0.55, 0)], [new THREE.BoxGeometry(0.16, 1.04, 1.04), SUN, M4(-0.38, 0, 0)], [new THREE.BoxGeometry(0.16, 1.04, 1.04), SUN, M4(0.38, 0, 0)],
    [new THREE.BoxGeometry(0.5, 0.3, 0.02), CREAM, M4(0, 0.05, 0.51)]]);
}
// the flag: a pole and a navy cloth with a sun-yellow star mark (our own design). On Mars there is a little wind, so the cloth ripples (the mode moves it).
export function makeFlag(mat) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 80; const g = c.getContext('2d');
  g.fillStyle = '#1f2756'; g.fillRect(0, 0, 128, 80); g.fillStyle = '#ff6b57'; g.fillRect(0, 62, 128, 18); g.fillStyle = '#ffd84d';
  g.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 11 : 26; g.lineTo(64 + Math.cos(a) * r, 32 + Math.sin(a) * r); } g.closePath(); g.fill();
  g.fillStyle = '#fff4e6'; g.font = '900 11px Montserrat, sans-serif'; g.textAlign = 'center'; g.fillText('SNACK BASE', 64, 75);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const grp = new THREE.Group(); grp.add(new THREE.Mesh(bakeColored([[new THREE.CylinderGeometry(0.035, 0.035, 2.6, 6), STEEL, M4(0, 1.3, 0)], [new THREE.SphereGeometry(0.06, 8, 6), SUN, M4(0, 2.62, 0)]]), mat));
  const cl = new THREE.PlaneGeometry(1.15, 0.72, 8, 2); cl.translate(0.6, 0, 0); const base = Float32Array.from(cl.attributes.position.array);
  const cloth = new THREE.Mesh(cl, curve(new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide, emissive: 0x222233 }))); cloth.position.set(0, 2.17, 0); grp.add(cloth);
  const wave = (time, k) => { const p = cl.attributes.position.array; for (let i = 0; i < p.length; i += 3) { const x = base[i]; p[i + 2] = Math.sin(x * 5 - time * 4) * 0.07 * x * k; p[i + 1] = base[i + 1] - x * x * 0.08 * (1 - k); } cl.attributes.position.needsUpdate = true; };
  return { group: grp, tex: t, wave };
}
// the sky: a dome that follows the camera: butterscotch overhead, paler at the horizon, a pale-blue glow round the small Sun (a Mars sunset), darkened by the storm
export function makeSky(scene, sunDir) {
  const mat = new THREE.ShaderMaterial({ uniforms: { uSun: { value: sunDir }, uFogC: U.uFogC, uStorm: U.uStorm }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uSun, uFogC; uniform float uStorm; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float h = max(d.y, 0.0), s = max(dot(d, uSun), 0.0);
        vec3 zen = vec3(0.56, 0.24, 0.09), col = mix(uFogC, zen, pow(h, 0.5));
        col = mix(col, vec3(0.32, 0.58, 1.3), pow(s, 40.0) * 0.85 * (1.0 - 0.6 * uStorm));   // the blue sunset glow
        col += vec3(0.9, 1.0, 1.15) * pow(s, 160.0) * (1.0 - uStorm) + vec3(3.2, 3.0, 2.7) * smoothstep(0.99955, 0.9998, s) * (1.0 - 0.85 * uStorm);   // the small Sun
        col = mix(col, uFogC, uStorm * 0.85);
        gl_FragColor = vec4(col, 1.0);${TAIL}}` });
  const m = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), mat); m.frustumCulled = false; m.renderOrder = -10; scene.add(m); return m;
}
// a tall beam over the current target (curved, fog-free so it shows through the storm)
export function makeBeam() {
  const geo = new THREE.CylinderGeometry(0.55, 0.55, 70, 12, 1, true); geo.translate(0, 35, 0);
  const mat = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(2.2, 1.7, 0.5) }, uA: { value: 1 }, uCurve: U.uCurve }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'uniform float uCurve; varying float vY; void main(){ vY = position.y / 70.0; vec4 w = modelMatrix * vec4(position, 1.0); vec2 d = w.xz - cameraPosition.xz; w.y -= dot(d, d) * uCurve; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 uCol; uniform float uA; varying float vY; void main(){ gl_FragColor = vec4(uCol * uA * pow(1.0 - vY, 2.0) * 0.2, 1.0); }' });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 8; return m;
}
// a dust devil: a tall tapered open tube with swirling bands, thicker at the centre, fading to the top and into the haze
export function devilGeometry() { const g = new THREE.CylinderGeometry(5.5, 1.2, 40, 24, 12, true); g.translate(0, 20, 0); return g; }
export function devilMaterial() {
  return new THREE.ShaderMaterial({ uniforms: { uT: U.uT, uCurve: U.uCurve, uFogC: U.uFogC, uFogD: U.uFogD, uA: { value: 1 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `uniform float uCurve, uT; varying vec2 vUv; varying float vF, vD; varying vec3 vN, vV;
      void main(){ vUv = uv; vec3 p = position; float k = p.y / 40.0; p.x += sin(uT * 1.3 + k * 4.0) * k * 3.0; p.z += cos(uT * 1.1 + k * 3.0) * k * 2.5;
        vec4 w = modelMatrix * vec4(p, 1.0); vec2 d = w.xz - cameraPosition.xz; vD = length(d); w.y -= dot(d, d) * uCurve;
        vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `uniform float uT, uFogD, uA; uniform vec3 uFogC; varying vec2 vUv; varying float vD; varying vec3 vN, vV;
      void main(){ float sw = sin((vUv.x * 6.2832 * 3.0) + vUv.y * 14.0 - uT * 7.0) * 0.5 + 0.5, sw2 = sin(vUv.x * 6.2832 * 7.0 - vUv.y * 22.0 - uT * 11.0) * 0.5 + 0.5;
        float a = (0.35 + 0.45 * sw + 0.2 * sw2) * pow(1.0 - vUv.y, 0.7) * smoothstep(0.0, 0.06, vUv.y) * pow(abs(dot(vN, vV)), 0.8) * 0.55 * uA;
        vec3 col = mix(vec3(1.0, 0.62, 0.36), vec3(1.25, 0.86, 0.56), sw); col = mix(col, uFogC, 1.0 - exp(-vD * uFogD * 0.7));
        gl_FragColor = vec4(col, a * (1.0 - smoothstep(170.0, 230.0, vD)));${TAIL}}` });
}
// wind-blown dust streaks: thin quads that drift with the wind inside a box round the camera (all motion in the shader, one draw call)
export function makeStreaks(n) {
  const base = new Float32Array(n * 4 * 3), cor = new Float32Array(n * 4 * 2), r = makeRng(41), idx = [];
  for (let i = 0; i < n; i++) { const x = r() * 120, y = r() * 120, z = r() * 120; for (let k = 0; k < 4; k++) { base.set([x, y, z], (i * 4 + k) * 3); cor.set([k & 1, k & 2 ? 1 : -1], (i * 4 + k) * 2); } const o = i * 4; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(base, 3)); g.setAttribute('cor', new THREE.BufferAttribute(cor, 2)); g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({ uniforms: { uT: U.uT, uWind: { value: new THREE.Vector3(6, 0, 2) }, uA: { value: 0.3 }, uLen: { value: 2.5 } }, transparent: true, depthWrite: false,
    vertexShader: `uniform float uT, uLen; uniform vec3 uWind; attribute vec2 cor; varying float vA;
      void main(){ vec3 p = mod(position + uWind * uT * (0.8 + 0.4 * fract(position.x * 7.13)) - cameraPosition, 120.0) - 60.0; p.y = (position.y / 120.0) * 9.0 - 3.0;
        vec3 dir = normalize(uWind + vec3(0.0001)); vec3 w = cameraPosition + p + dir * cor.x * uLen;
        vec4 mv = viewMatrix * vec4(w, 1.0); vec3 dv = (viewMatrix * vec4(dir, 0.0)).xyz; vec2 pp = normalize(vec2(-dv.y, dv.x) + vec2(0.0, 0.0001)); mv.xy += pp * cor.y * 0.03;
        float dist = length(p); vA = (1.0 - abs(cor.x * 2.0 - 1.0)) * smoothstep(60.0, 25.0, dist) * smoothstep(1.5, 5.0, dist); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: 'uniform float uA; varying float vA; void main(){ gl_FragColor = vec4(1.25, 0.88, 0.6, vA * uA); }' });
  const m = new THREE.Mesh(g, mat); m.frustumCulled = false; m.renderOrder = 7; return m;
}
// a tyre-track mark: a short flat quad with a chevron tread (alpha map)
export function trackMaterial() {
  const c = document.createElement('canvas'); c.width = 32; c.height = 64; const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 32, 64); g.fillStyle = '#fff';
  for (let y = -8; y < 64; y += 12) { g.beginPath(); g.moveTo(0, y); g.lineTo(16, y + 6); g.lineTo(32, y); g.lineTo(32, y + 6); g.lineTo(16, y + 12); g.lineTo(0, y + 6); g.closePath(); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  return { mat: curve(new THREE.MeshBasicMaterial({ color: 0x4a2414, alphaMap: t, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })), tex: t };
}
