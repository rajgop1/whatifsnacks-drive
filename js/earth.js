// Space scene for the rocket ride: a stylised Earth below the camera, atmosphere rim, stars, a small Moon and a stylised space station.
// Contract (agreed with the game session):
//   const space = new SpaceScene(scene, { tier: 'low' | 'medium' | 'high', sun: THREE.Vector3 /* unit, toward the sun */ });
//   space.show(true | false)               // adds / removes everything (hidden by default); the first show(true) builds the textures
//   space.update(altKm, camera, dt)        // altKm 0..420; the camera must be a direct child of the scene (or the scene root); far plane 40000
//   space.makeISS()                        // THREE.Group about 30 units wide; userData.dock is the docking port Object3D (faces -z)
//   space.dispose()
// Extra (optional): space.prepare() builds the textures ahead of time (call it while idle, it costs about 100 to 700 ms by tier);
//   space.pitchFollow (0..1, default 0.5) how much of the camera pitch the planet follows; 1 = glued to the screen, 0 = fixed to the world;
//   space.gain (default 1.7) overall brightness of the planet and its rim (the game tone-maps at exposure 0.55, so raw colours are pushed up);
//   space.info = { rho, dist, surface, earthFade, spaceFade } is refreshed on every update (debugging / aiming the game's own clouds).
// Art direction: the planet is placed (not simulated). Its apparent size is solved every frame from the altitude so the limb sits where we want it on
// the screen: almost flat at 20 km, a clear curve at 100 km, the lower ~55% of the screen at 408 km. Radius 5600, centre distance at most about 15000.
// No network, no external images. Colours are HDR (raw values above 1) because the game's post chain tone-maps at exposure 0.55.
import * as THREE from 'three';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };

const R_EARTH = 5600;              // world units (the contract allows 6000)
const CLOUD_H = 0.0075;            // cloud shell above the surface, as a fraction of the radius (the camera is always above it)
const ATMO_R = 1.3;                // atmosphere shell radius (fraction of the planet radius); the glow itself is computed from the view ray
const RHO_MIN = 18 * D2R, RHO_MAX = 80 * D2R;   // angular radius of the planet seen from the camera: smaller = more curve, larger = flatter
const STAR_R = 30000, DOME_R = 36000, MOON_R = 26000;

// ---------------------------------------------------------------- where the limb should sit on the screen, by altitude
// [alt km, limb height at the screen centre (-1 bottom .. +1 top), how far the limb falls toward the screen edge (fraction of the screen height)]
const LOOK = [[15, -0.58, 0.002], [20, -0.5, 0.004], [40, -0.38, 0.012], [100, -0.24, 0.05], [200, -0.08, 0.09], [408, 0.1, 0.135]];
function look(alt) {
  if (alt <= LOOK[0][0]) return [LOOK[0][1], LOOK[0][2]];
  for (let i = 1; i < LOOK.length; i++) if (alt <= LOOK[i][0]) { const a = LOOK[i - 1], b = LOOK[i], k = ss(a[0], b[0], alt); return [lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }
  const e = LOOK[LOOK.length - 1]; return [e[1], e[2]];
}
// the limb is the circle of angular radius rho round the planet's centre direction (beta below the view axis); this is its screen height at screen-plane x
function limbY(rho, beta, x) {
  const cb = Math.cos(beta), sb = Math.sin(beta), cr = Math.cos(rho), kk = 1 + x * x; let lo = -4, hi = 4;
  for (let i = 0; i < 24; i++) { const y = (lo + hi) / 2; if (cb - y * sb - cr * Math.sqrt(kk + y * y) > 0) lo = y; else hi = y; }   // F falls as y rises
  return (lo + hi) / 2;
}
// solve the planet's angular radius so the limb has the wanted height at the centre and the wanted fall-off at the screen edge
function solveRho(apexNdc, drop, tanHalf, aspect) {
  const ya = apexNdc * tanHalf, thetaA = Math.atan(ya), xe = aspect * tanHalf; let lo = RHO_MIN, hi = RHO_MAX;
  for (let i = 0; i < 16; i++) {
    const rho = (lo + hi) / 2, d = (ya - limbY(rho, rho - thetaA, xe)) / (2 * tanHalf);
    if (d > drop) lo = rho; else hi = rho;   // too curved: a bigger (flatter) planet
  }
  const rho = (lo + hi) / 2; return { rho, beta: rho - thetaA };
}

// ---------------------------------------------------------------- procedural noise (value noise on the sphere, so the texture tiles and has no seam)
const PERM = (() => { const p = new Uint8Array(512), a = []; let s = 90210; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; for (let i = 0; i < 256; i++) a.push(i); for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } for (let i = 0; i < 512; i++) p[i] = a[i & 255]; return p; })();
function vn(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), fx = x - xi, fy = y - yi, fz = z - zi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const X = xi & 255, Y = yi & 255, Z = zi & 255, a = PERM[X] + Y, b = PERM[X + 1] + Y, aa = PERM[a] + Z, ab = PERM[a + 1] + Z, ba = PERM[b] + Z, bb = PERM[b + 1] + Z;
  const x00 = PERM[aa] + u * (PERM[ba] - PERM[aa]), x10 = PERM[ab] + u * (PERM[bb] - PERM[ab]), x01 = PERM[aa + 1] + u * (PERM[ba + 1] - PERM[aa + 1]), x11 = PERM[ab + 1] + u * (PERM[bb + 1] - PERM[ab + 1]);
  const y0 = x00 + v * (x10 - x00), y1 = x01 + v * (x11 - x01); return (y0 + w * (y1 - y0)) / 255;
}
function fbm(x, y, z, oct, off) { let a = 0, amp = 0.5, f = 1, n = 0; for (let o = 0; o < oct; o++) { a += amp * vn(x * f + off + o * 17.3, y * f + off * 0.7 + o * 9.1, z * f + off * 1.3 + o * 5.7); n += amp; f *= 2.03; amp *= 0.5; } return a / n; }

// a few storms the cloud swirls wrap around (lat, lon in degrees)
const STORMS = [[22, -60, 1], [-28, 80, -1], [48, 150, 1], [-52, -130, -1]].map(([la, lo, dir]) => { const c = Math.cos(la * D2R); return { x: Math.sin(lo * D2R) * c, y: Math.sin(la * D2R), z: Math.cos(lo * D2R) * c, dir }; });

// R = elevation, G = cloud density, B = moisture (all 0..1); the shader turns them into ocean, land, ice, lights and cloud. Returns { tex, sea }.
function buildMap(tier) {
  const W = { low: 512, medium: 1024, high: 2048 }[tier], H = W / 2, gw = W / 2, gh = gw / 2;   // generated at half size, the canvas upscales it smoothly
  const el = new Float32Array(gw * gh), cl = new Float32Array(gw * gh), mo = new Float32Array(gw * gh);
  for (let y = 0; y < gh; y++) {
    const lat = (0.5 - (y + 0.5) / gh) * Math.PI, cy = Math.cos(lat), sy = Math.sin(lat), belt = 0.62 + 0.45 * Math.exp(-(((Math.abs(lat) - 0.9) / 0.26) ** 2)) - 0.3 * Math.exp(-(((Math.abs(lat) - 0.42) / 0.16) ** 2));
    for (let x = 0; x < gw; x++) {
      const lon = ((x + 0.5) / gw - 0.5) * TAU, px = Math.sin(lon) * cy, pz = Math.cos(lon) * cy, py = sy, i = y * gw + x;
      el[i] = fbm(px * 1.35, py * 1.35, pz * 1.35, 5, 3.1) * 0.8 + fbm(px * 0.7, py * 0.7, pz * 0.7, 2, 11.9) * 0.2;
      mo[i] = fbm(px * 2.2, py * 2.2, pz * 2.2, 3, 27.4);
      // the cloud domain gets twisted round each storm centre, then a warped fbm with the latitude belts on top
      let qx = px, qy = py, qz = pz;
      for (const s of STORMS) {
        const dt = qx * s.x + qy * s.y + qz * s.z; if (dt < 0.35) continue; const d = Math.acos(Math.min(1, dt)), a = s.dir * 3.4 * Math.exp(-(d * d) / 0.1), ca = Math.cos(a), sa = Math.sin(a);
        const cxp = s.y * qz - s.z * qy, cyp = s.z * qx - s.x * qz, czp = s.x * qy - s.y * qx, k = dt * (1 - ca);   // Rodrigues rotation about the storm axis
        qx = qx * ca + cxp * sa + s.x * k; qy = qy * ca + cyp * sa + s.y * k; qz = qz * ca + czp * sa + s.z * k;
      }
      const wv = fbm(qx * 1.6, qy * 1.6, qz * 1.6, 3, 41.7), c = fbm(qx * 2.6 + wv * 0.9, qy * 2.6 + wv * 0.9, qz * 2.6 + wv * 0.9, 4, 7.7) * belt;
      cl[i] = clamp((c - 0.36) / 0.2);
    }
  }
  // stretch the elevation to 0..1 and put the sea level at the 69th percentile (about 31% land)
  let mn = 9, mx = -9; for (let i = 0; i < el.length; i++) { if (el[i] < mn) mn = el[i]; if (el[i] > mx) mx = el[i]; }
  const bins = new Uint32Array(256), img = new ImageData(gw, gh), d = img.data;
  for (let i = 0; i < el.length; i++) { const e = (el[i] - mn) / (mx - mn); el[i] = e; bins[Math.min(255, Math.floor(e * 256))]++; }
  let acc = 0, sea = 0.5; for (let b = 0; b < 256; b++) { acc += bins[b]; if (acc >= el.length * 0.69) { sea = (b + 1) / 256; break; } }
  for (let i = 0, j = 0; i < el.length; i++, j += 4) { d[j] = el[i] * 255; d[j + 1] = cl[i] * 255; d[j + 2] = clamp((mo[i] - 0.25) / 0.5) * 255; d[j + 3] = 255; }
  const small = document.createElement('canvas'); small.width = gw; small.height = gh; small.getContext('2d').putImageData(img, 0, 0);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const g = cv.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'; g.drawImage(small, 0, 0, W, H);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.NoColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.ClampToEdgeWrapping; tex.anisotropy = 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex, sea };
}

// ---------------------------------------------------------------- shaders
const TAIL = '#include <tonemapping_fragment>\n#include <colorspace_fragment>';
const SURF_V = 'varying vec3 vN; varying vec3 vW; varying vec3 vL; void main(){ vL = position; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const COMMON = `uniform sampler2D tMap; uniform vec3 uSun; uniform float uSea, uFade, uGain; varying vec3 vN; varying vec3 vW; varying vec3 vL;
  const float PI = 3.14159265;
  float hash21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  vec4 sampleMap(out vec2 uv, out float lat){ vec3 n = normalize(vL); lat = asin(clamp(n.y, -1.0, 1.0)); float lon = atan(n.x, n.z + 1e-7); uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);
    vec2 dx = dFdx(uv), dy = dFdy(uv); dx.x -= floor(dx.x + 0.5); dy.x -= floor(dy.x + 0.5); return textureGrad(tMap, uv, dx, dy); }`;
const SURF_F = `${COMMON}
  uniform float uCloudRot, uBake, uShadow;
  void main(){
    vec2 uv; float lat; vec4 t = sampleMap(uv, lat); float h = t.r, cl = t.g, mo = t.b;
    vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
    float fw = fwidth(h) * 1.5 + 0.0035, land = smoothstep(uSea - fw, uSea + fw, h), deep = clamp((uSea - h) / 0.28, 0.0, 1.0), elev = clamp((h - uSea) / (1.0 - uSea) * 2.0, 0.0, 1.0);
    vec3 ocean = mix(vec3(0.07, 0.55, 0.72), vec3(0.012, 0.07, 0.30), pow(deep, 0.55));
    vec3 lc = mix(vec3(0.88, 0.66, 0.36), vec3(0.15, 0.52, 0.20), smoothstep(0.30, 0.62, mo)); lc = mix(lc, vec3(0.46, 0.38, 0.27), smoothstep(0.5, 0.85, elev));
    vec3 alb = mix(ocean, lc, land);
    float ice = smoothstep(1.13, 1.29, abs(lat) + (mo - 0.5) * 0.14) + land * smoothstep(0.86, 0.97, elev); ice = clamp(ice, 0.0, 1.0); alb = mix(alb, vec3(0.93, 0.96, 1.0), ice);
    float dl = dot(N, uSun), day = smoothstep(-0.10, 0.32, dl), term = exp(-pow(dl / 0.13, 2.0));
    vec3 sunC = vec3(1.0, 0.80, 0.60);
    vec3 col = alb * (vec3(0.03, 0.045, 0.12) * (1.0 - day) + sunC * (0.16 + 0.95 * max(dl, 0.0)) * day);
    // cloud shadows (the cloud shell turns slower than the ground) or, on the low tier, the clouds themselves
    vec2 uv2 = uv + vec2(uCloudRot / (2.0 * PI), 0.0); float c2 = texture(tMap, uv2).g;
    col *= 1.0 - uShadow * 0.35 * c2 * day;
    // city lights on the night side: dots on the lowland, denser near the coast
    float dens = land * smoothstep(0.45, 0.7, mo) * (1.0 - smoothstep(0.3, 0.8, elev)) * (0.35 + 0.65 * (1.0 - smoothstep(0.0, 0.12, h - uSea))) * (1.0 - ice);
    float dot_ = step(1.0 - 0.16 * dens, hash21(floor(uv * vec2(720.0, 360.0)))); col += vec3(1.0, 0.68, 0.28) * dot_ * (1.0 - day) * 1.3;
    col += term * mix(vec3(0.9, 0.3, 0.45), vec3(1.0, 0.5, 0.22), land) * 0.30;
    vec3 Hh = normalize(uSun + V); float glint = pow(max(dot(Hh, N), 0.0), 70.0) * (1.0 - land) * (1.0 - ice) * day; col += vec3(1.0, 0.72, 0.45) * glint * 1.6;
    if (uBake > 0.5) { vec3 cc = mix(vec3(0.07, 0.09, 0.2), vec3(1.0, 0.92, 0.86) * (0.3 + 0.85 * max(dl, 0.0)), day) + term * vec3(1.0, 0.5, 0.3) * 0.3; col = mix(col, cc, cl * 0.78); }
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0); col += fres * mix(vec3(0.16, 0.34, 1.0), vec3(1.0, 0.5, 0.25), smoothstep(-0.25, 0.55, dl)) * 0.7;
    gl_FragColor = vec4(col * uGain, uFade);
    ${TAIL}
  }`;
const CLOUD_F = `${COMMON}
  void main(){
    vec2 uv; float lat; vec4 t = sampleMap(uv, lat); float cl = t.g;
    vec3 N = normalize(vN), V = normalize(cameraPosition - vW); float dl = dot(N, uSun), day = smoothstep(-0.10, 0.32, dl), term = exp(-pow(dl / 0.13, 2.0));
    vec3 cc = mix(vec3(0.07, 0.09, 0.2), vec3(1.0, 0.92, 0.86) * (0.3 + 0.85 * max(dl, 0.0)), day) + term * vec3(1.0, 0.5, 0.3) * 0.3;
    float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5); cc += rim * vec3(0.2, 0.3, 0.8) * 0.25;
    gl_FragColor = vec4(cc * uGain, clamp(cl * 0.85, 0.0, 1.0) * uFade);
    ${TAIL}
  }`;
const ATMO_V = 'varying vec3 vW; varying vec3 vC; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vC = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const ATMO_F = `uniform vec3 uSun; uniform float uR, uH, uFade, uGain; varying vec3 vW; varying vec3 vC;
  void main(){
    vec3 V = normalize(vW - cameraPosition), oc = vC - cameraPosition; float tca = dot(oc, V); vec3 pc = cameraPosition + V * tca - vC; float len = length(pc), b = len / uR;   // closest approach of this view ray to the planet centre, in planet radii
    float g = b > 1.0 ? exp(-(b - 1.0) / uH) : 0.0; g *= smoothstep(0.0, 0.002, b - 1.0 + 0.002);
    vec3 pn = pc / max(len, 1e-4); float lw = clamp(dot(pn, uSun) + 0.25, 0.0, 1.3), sd = max(dot(V, uSun), 0.0);
    vec3 c = vec3(0.2, 0.42, 1.0) * 0.55 + vec3(1.0, 0.3, 0.55) * 0.12 + vec3(1.0, 0.5, 0.22) * lw * 1.0 + vec3(1.0, 0.78, 0.5) * pow(sd, 40.0) * 0.8;
    gl_FragColor = vec4(c * g * uFade * uGain, 1.0);
    ${TAIL}
  }`;
const DOME_V = 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const DOME_F = `uniform vec3 uSun; uniform float uFade; varying vec3 vD;
  void main(){
    float s = max(dot(vD, uSun), 0.0); vec3 c = mix(vec3(0.004, 0.005, 0.02), vec3(0.02, 0.016, 0.07), 0.5 + 0.5 * vD.y);
    float bq = dot(vD, normalize(vec3(0.35, 0.8, -0.48))) / 0.2; c += exp(-bq * bq) * vec3(0.05, 0.025, 0.1);   // a faint milky band
    c += vec3(0.45, 0.14, 0.34) * pow(s, 24.0) * 0.28 + vec3(1.0, 0.5, 0.26) * pow(s, 140.0) * 0.55;
    gl_FragColor = vec4(c * 1.4, uFade);
    ${TAIL}
  }`;
const MOON_F = `uniform sampler2D tMoon; uniform vec3 uSun; uniform float uFade; varying vec3 vN; varying vec3 vW; varying vec3 vL;
  void main(){ vec3 n = normalize(vL); vec2 uv = vec2(atan(n.x, n.z) / 6.2831853 + 0.5, asin(clamp(n.y, -1.0, 1.0)) / 3.1415927 + 0.5);
    float dl = dot(normalize(vN), uSun), lit = smoothstep(-0.05, 0.5, dl); vec3 c = texture2D(tMoon, uv).rgb * (0.05 + 1.8 * lit) * vec3(1.0, 0.95, 0.88);
    gl_FragColor = vec4(c, uFade);
    ${TAIL}
  }`;

function dotTexture() { const c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c); }
function moonTexture() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#c4bfb6'; g.fillRect(0, 0, 256, 128);
  let s = 4242; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 46; i++) { const x = rnd() * 256, y = 12 + rnd() * 104, r = 3 + rnd() * rnd() * 16, gr = g.createRadialGradient(x, y, r * 0.2, x, y, r); gr.addColorStop(0, 'rgba(96,92,88,0.55)'); gr.addColorStop(0.8, 'rgba(120,116,110,0.35)'); gr.addColorStop(1, 'rgba(230,226,218,0.0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
  for (let i = 0; i < 5; i++) { const x = rnd() * 256, y = 20 + rnd() * 88, r = 14 + rnd() * 24; g.fillStyle = 'rgba(110,108,112,0.35)'; g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, TAU); g.fill(); }   // dark maria
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t;
}

// ---------------------------------------------------------------- the scene
export class SpaceScene {
  constructor(scene, { tier = 'medium', sun } = {}) {
    this.scene = scene; this.tier = tier; this.sun = sun ? sun : new THREE.Vector3(-0.6, 0.085, -0.8).normalize(); this.sun.normalize();
    this.pitchFollow = 0.5; this.gain = 1.7; this.info = { rho: 0, dist: 0, surface: 0, earthFade: 0, spaceFade: 0 };
    this.root = new THREE.Group(); this.root.name = 'SpaceScene'; this._shown = false; this._built = false; this._res = []; this._t = 0; this._spin = 0; this._cloudSpin = 0;
  }
  _track(o) { this._res.push(o); return o; }
  prepare() {
    if (this._built) return this; this._built = true; const T = this.tier, low = T === 'low', sunU = { value: this.sun };
    const seg = { low: [48, 32], medium: [64, 48], high: [96, 64] }[T], { tex, sea } = buildMap(T); this._track(tex); this.mapTex = tex;
    const mk = (o) => this._track(new THREE.ShaderMaterial({ transparent: true, fog: false, ...o }));
    // the follower: sits on the camera, turns with its yaw (and part of its pitch), so the planet stays put on the screen
    this.pivot = new THREE.Group(); this.root.add(this.pivot); this.planetRoot = new THREE.Group(); this.pivot.add(this.planetRoot);
    this.tilt = new THREE.Group(); this.tilt.rotation.z = 0.41; this.planetRoot.add(this.tilt);
    this.U = { uSun: sunU, uFade: { value: 0 }, uGain: { value: this.gain } };
    this.surfU = { tMap: { value: tex }, uSea: { value: sea }, uCloudRot: { value: 0 }, uBake: { value: low ? 1 : 0 }, uShadow: { value: low ? 0 : 1 }, ...this.U };
    this.planet = new THREE.Mesh(this._track(new THREE.SphereGeometry(1, seg[0], seg[1])), mk({ uniforms: this.surfU, vertexShader: SURF_V, fragmentShader: SURF_F, depthWrite: true }));
    this.planet.renderOrder = 0; this.planet.frustumCulled = false; this.tilt.add(this.planet);
    if (!low) {   // the cloud shell: slightly bigger, turns slower
      this.clouds = new THREE.Mesh(this.planet.geometry, mk({ uniforms: { tMap: { value: tex }, uSea: { value: sea }, ...this.U }, vertexShader: SURF_V, fragmentShader: CLOUD_F, depthWrite: false }));
      this.clouds.renderOrder = 1; this.clouds.frustumCulled = false; this.tilt.add(this.clouds);
    }
    this.atmoU = { uR: { value: R_EARTH }, uH: { value: 0.012 }, ...this.U };
    this.atmo = new THREE.Mesh(this._track(new THREE.SphereGeometry(1, 64, 32)), mk({ uniforms: this.atmoU, vertexShader: ATMO_V, fragmentShader: ATMO_F, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.atmo.renderOrder = 2; this.atmo.frustumCulled = false; this.atmo.scale.setScalar(R_EARTH * ATMO_R); this.planetRoot.add(this.atmo);
    this.planet.scale.setScalar(R_EARTH); if (this.clouds) this.clouds.scale.setScalar(R_EARTH * (1 + CLOUD_H));
    // space backdrop, stars and the Moon (all fade in with the altitude)
    this.sky = new THREE.Group(); this.root.add(this.sky);
    this.domeU = { uSun: sunU, uFade: { value: 0 } };
    this.dome = new THREE.Mesh(this._track(new THREE.SphereGeometry(DOME_R, 24, 16)), mk({ uniforms: this.domeU, vertexShader: DOME_V, fragmentShader: DOME_F, side: THREE.BackSide, depthWrite: false })); this.dome.renderOrder = -10; this.dome.frustumCulled = false; this.sky.add(this.dome);
    const n = { low: 700, medium: 1600, high: 3000 }[T], pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let s = 777; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < n; i++) { const z = 2 * rnd() - 1, a = rnd() * TAU, r = Math.sqrt(1 - z * z), b = 0.35 + 1.3 * Math.pow(rnd(), 5), tint = rnd(); pos.set([Math.cos(a) * r * STAR_R, z * STAR_R, Math.sin(a) * r * STAR_R], i * 3); col.set([b * (tint > 0.78 ? 1.15 : 0.9), b * 0.9, b * (tint < 0.3 ? 1.3 : 1.02)], i * 3); }
    const sg = this._track(new THREE.BufferGeometry()); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.starMat = this._track(new THREE.PointsMaterial({ size: low ? 2.2 : 2.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, fog: false, map: this._track(dotTexture()), opacity: 0 }));
    this.stars = new THREE.Points(sg, this.starMat); this.stars.renderOrder = -9; this.stars.frustumCulled = false; this.sky.add(this.stars);
    this.moonU = { tMoon: { value: this._track(moonTexture()) }, uSun: sunU, uFade: { value: 0 } };
    this.moon = new THREE.Mesh(this._track(new THREE.SphereGeometry(MOON_R * 0.035, 32, 20)), mk({ uniforms: this.moonU, vertexShader: SURF_V, fragmentShader: MOON_F, depthWrite: false }));
    this.moon.position.set(-0.22, 0.3, -0.93).normalize().multiplyScalar(MOON_R); this.moon.renderOrder = -8; this.moon.frustumCulled = false; this.pivot.add(this.moon);   // upper left of the view, follows the camera like the planet
    return this;
  }
  show(on) {
    if (on && !this._built) this.prepare();
    if (on && !this._shown) { this.scene.add(this.root); this._shown = true; } else if (!on && this._shown) { this.scene.remove(this.root); this._shown = false; }
    return this;
  }
  update(altKm, camera, dt = 1 / 60) {
    if (!this._shown) return;
    const alt = clamp(altKm, 0, 420), earthFade = ss(15, 40, alt), spaceFade = ss(30, 70, alt), domeFade = ss(25, 65, alt);
    this.pivot.position.copy(camera.position); this.sky.position.copy(camera.position);
    this.planetRoot.visible = earthFade > 0.003; this.dome.visible = domeFade > 0.003; this.stars.visible = this.moon.visible = spaceFade > 0.003;
    this.starMat.opacity = spaceFade; this.moonU.uFade.value = spaceFade; this.domeU.uFade.value = domeFade; this.U.uFade.value = earthFade; this.U.uGain.value = this.gain;
    // the camera's yaw and pitch from its forward vector (roll is ignored)
    const q = camera.quaternion, fx = -2 * (q.x * q.z + q.w * q.y), fy = -2 * (q.y * q.z - q.w * q.x), fz = -(1 - 2 * (q.x * q.x + q.y * q.y)), pitch = Math.asin(clamp(fy, -1, 1)), yaw = Math.atan2(-fx, -fz);
    this.pivot.rotation.set(pitch * this.pitchFollow, yaw, 0, 'YXZ');
    this._t += dt; this._spin += dt * 0.014; this._cloudSpin += dt * 0.0075;
    this.tilt.rotation.y = 0; this.planet.rotation.y = this._spin; if (this.clouds) this.clouds.rotation.y = this._cloudSpin;
    this.surfU.uCloudRot.value = this._cloudSpin - this._spin;
    if (!this.planetRoot.visible) { this.info.earthFade = 0; this.info.spaceFade = spaceFade; return; }
    // place the planet: its apparent size and position come from where the limb should sit on this screen
    const tanHalf = Math.tan(camera.fov * D2R / 2), [apex, drop] = look(alt), { rho, beta } = solveRho(apex, drop, tanHalf, camera.aspect), dist = R_EARTH / Math.sin(rho);
    this.planetRoot.position.set(0, -dist * Math.sin(beta), -dist * Math.cos(beta));
    this.atmoU.uH.value = clamp(lerp(0.35, 0.75, alt / 420) * D2R / Math.tan(rho), 0.003, 0.03);   // keep the rim about half a degree thick on screen
    Object.assign(this.info, { rho: rho / D2R, dist, surface: dist - R_EARTH, earthFade, spaceFade });
  }
  // a stylised station about 30 units wide: white truss along x, gold solar arrays, white radiators, modules along z, a docking port facing -z
  makeISS() {
    const g = new THREE.Group(); g.name = 'ISS'; const std = (o) => this._track(new THREE.MeshStandardMaterial({ metalness: 0.25, roughness: 0.55, ...o }));
    const white = std({ color: 0xe8e8ee, emissive: 0x30343c }), grey = std({ color: 0x9aa0ac, emissive: 0x20242c }), dark = std({ color: 0x3a3f4c, emissive: 0x101218 }), rad = std({ color: 0xf4f4f8, emissive: 0x383c44, roughness: 0.8 });
    const cell = document.createElement('canvas'); cell.width = 64; cell.height = 128; const cg = cell.getContext('2d'); cg.fillStyle = '#d9a63c'; cg.fillRect(0, 0, 64, 128); cg.strokeStyle = 'rgba(60,30,10,0.75)'; cg.lineWidth = 2;
    for (let x = 0; x <= 64; x += 16) { cg.beginPath(); cg.moveTo(x, 0); cg.lineTo(x, 128); cg.stroke(); } for (let y = 0; y <= 128; y += 16) { cg.beginPath(); cg.moveTo(0, y); cg.lineTo(64, y); cg.stroke(); }
    const ct = this._track(new THREE.CanvasTexture(cell)); ct.colorSpace = THREE.SRGBColorSpace; const gold = std({ color: 0xffffff, map: ct, emissive: 0x5a3c10, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.4 });
    const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(this._track(new THREE.BoxGeometry(w, h, d)), m); o.position.set(x, y, z); g.add(o); return o; };
    const cyl = (r, len, m, x, y, z, axis = 'z') => { const o = new THREE.Mesh(this._track(new THREE.CylinderGeometry(r, r, len, 20)), m); if (axis === 'z') o.rotation.x = Math.PI / 2; else if (axis === 'x') o.rotation.z = Math.PI / 2; o.position.set(x, y, z); g.add(o); return o; };
    box(28, 0.8, 0.8, white);                                        // the main truss
    cyl(1.35, 7, white, 0, 0, 1.5); cyl(1.2, 5.5, grey, 0, 0, 7.6); cyl(1.1, 4.5, white, 0, 0, -3.4);   // central modules along z
    cyl(0.9, 6, grey, 0, 1.6, 2.2, 'x'); cyl(0.55, 2.6, white, 0, -1.8, 1.0);   // a node across the top and a small module below
    box(1.4, 1.4, 1.4, dark, 0, 0, 0);                              // the truss joint
    for (const sx of [-1, 1]) {
      for (const [x, w] of [[13, 3.2], [8.2, 3.2]]) { box(w, 0.08, 10.5, gold, sx * x, 0, 6.2); box(w, 0.08, 10.5, gold, sx * x, 0, -6.2); box(0.5, 0.5, 1.6, dark, sx * x, 0, 0); }   // four big arrays, each two blades
      box(0.12, 3.4, 6, rad, sx * 3.6, 0.9, -2.4);                    // radiators
    }
    const port = new THREE.Group(); port.position.set(0, 0, -6.4); const ring = new THREE.Mesh(this._track(new THREE.TorusGeometry(0.95, 0.14, 8, 24)), std({ color: 0xffffff, emissive: 0x555a66 })); port.add(ring);
    const cone = new THREE.Mesh(this._track(new THREE.CylinderGeometry(0.7, 1.0, 1.1, 20)), grey); cone.rotation.x = Math.PI / 2; cone.position.z = 0.55; port.add(cone);
    const lamp = this._track(new THREE.MeshBasicMaterial({ color: 0x7dffc8 })); for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(this._track(new THREE.SphereGeometry(0.1, 8, 6)), lamp); const a = i * Math.PI / 2; l.position.set(Math.cos(a) * 0.95, Math.sin(a) * 0.95, -0.15); port.add(l); }
    g.add(port); g.userData.dock = port;   // the port faces -z: its open side is -z, so a craft arriving from -z meets it
    return g;
  }
  dispose() {
    this.show(false); for (const r of this._res) if (r && r.dispose) r.dispose(); this._res.length = 0; this._built = false;
  }
}
