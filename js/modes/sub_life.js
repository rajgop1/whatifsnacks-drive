// DEEP SNACK models and creatures: the sub, reef life (fish school, turtle, manta, kelp, coral), the drifting deep swarms (jellies, glowing squid,
// siphonophores, anglerfish, amphipods, snailfish), set pieces (giant squid, sperm whale), the wreck, the vent field, the snack and the sample canisters.
// Everything is baked to vertex-coloured geometry and instanced; forward is +z everywhere.
import * as THREE from 'three';
import { bakeColored, M4, makeRng, TAU, clamp, damp, smooth } from '../util.js';
import { floorY, worldY, realDepth, lambert, patch, REEF, WRECK, VENTS, SNACK, TRENCH_Z, U, glowTex } from './sub_world.js';

const PI = Math.PI, S = (r, w = 10, h = 8) => new THREE.SphereGeometry(r, w, h), Bx = (x, y, z) => new THREE.BoxGeometry(x, y, z), Cy = (a, b, h, n = 10, open = false) => new THREE.CylinderGeometry(a, b, h, n, 1, open);
const glowMat = (anim = '') => patch(new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }), { anim, above: false });

// ---------------------------------------------------------------- the sub (4.5 m, nose +z, body centre at the origin; skids reach y = -1.06)
export function subGeometry() {
  const Yl = 0xffd84d, Co = 0xff6b57, Na = 0x1f2756, Cr = 0xfff4e6, Sk = 0xf4bf98, p = [];
  p.push([Cy(0.85, 0.85, 2.4, 22, true), Yl, M4(0, 0, 0, PI / 2)]);
  p.push([new THREE.SphereGeometry(0.85, 22, 10, 0, TAU, 0, PI / 2), Yl, M4(0, 0, -1.2, -PI / 2, 0, 0, 1, 1.35, 1)]);
  for (const z of [-0.62, 0.62]) p.push([Cy(0.875, 0.875, 0.26, 22, true), Co, M4(0, 0, z, PI / 2)]);
  p.push([new THREE.TorusGeometry(0.82, 0.1, 8, 26), Cr, M4(0, 0, 1.2)]);
  p.push([new THREE.CircleGeometry(0.83, 22), Na, M4(0, 0, 1.17)]);
  // the hoodie mascot peeking out of the dome
  p.push([S(0.42, 14, 10), Co, M4(0, -0.2, 1.4, 0, 0, 0, 1.05, 0.8, 0.8)]);
  p.push([S(0.38, 14, 10), Co, M4(0, 0.16, 1.43)]);
  p.push([S(0.29, 16, 12), Sk, M4(0, 0.16, 1.57)]);
  p.push([S(0.3, 16, 10), 0x2b2140, M4(0, 0.27, 1.52, 0, 0, 0, 1.02, 0.7, 0.95)]);
  for (const s of [-1, 1]) {
    p.push([S(0.075, 10, 8), 0xffffff, M4(s * 0.11, 0.18, 1.82)]); p.push([S(0.046, 8, 6), 0x1d1b2e, M4(s * 0.11, 0.18, 1.875)]);
    p.push([S(0.05, 8, 6), 0xff8a7a, M4(s * 0.19, 0.08, 1.79, 0, 0, 0, 1, 0.6, 0.5)]);
  }
  p.push([S(0.045, 8, 6), 0x9a4a3a, M4(0, 0.06, 1.85, 0, 0, 0, 1.6, 0.5, 0.6)]);
  // sail, hatch, periscope
  p.push([new THREE.CapsuleGeometry(0.34, 0.6, 4, 14), Co, M4(0, 0.95, -0.2, 0, 0, 0, 0.9, 1, 1.7)]);
  p.push([Cy(0.22, 0.22, 0.07, 14), Na, M4(0, 1.6, -0.28)]);
  p.push([Cy(0.06, 0.06, 0.8, 8), Na, M4(0.12, 1.85, -0.05)]); p.push([Bx(0.15, 0.17, 0.34), Na, M4(0.12, 2.25, 0.05)]); p.push([Cy(0.06, 0.06, 0.03, 10), 0xbfe8ff, M4(0.12, 2.25, 0.23, PI / 2)]);
  // side windows, fins, shroud, dive planes, skids, lamp housings
  for (const s of [-1, 1]) for (const z of [0.3, -0.45]) { p.push([new THREE.CircleGeometry(0.17, 16), Na, M4(s * 0.86, 0.12, z, 0, s * PI / 2)]); p.push([new THREE.TorusGeometry(0.18, 0.04, 6, 16), Cr, M4(s * 0.86, 0.12, z, 0, s * PI / 2)]); }
  p.push([Bx(0.07, 1.3, 0.62), Co, M4(0, 0, -2.0)]); p.push([Bx(1.5, 0.07, 0.56), Co, M4(0, 0, -2.0)]);
  p.push([new THREE.TorusGeometry(0.52, 0.08, 8, 22), Na, M4(0, 0, -2.25)]);
  for (const s of [-1, 1]) {
    p.push([Bx(0.55, 0.06, 0.32), Na, M4(s * 1.08, -0.05, 0.7)]);
    p.push([Bx(0.13, 0.13, 2.7), Na, M4(s * 0.5, -1.0, 0.1)]); for (const z of [-0.8, 0.9]) p.push([Bx(0.09, 0.36, 0.09), Na, M4(s * 0.5, -0.78, z)]);
    p.push([Cy(0.15, 0.15, 0.14, 12), Na, M4(s * 0.52, -0.46, 1.17, PI / 2)]);
  }
  const body = bakeColored(p);
  const prop = bakeColored([[new THREE.ConeGeometry(0.13, 0.32, 10), Cr, M4(0, 0, -0.08, -PI / 2)], ...[0, 1, 2].map((k) => [Bx(0.13, 0.42, 0.03), Cr, new THREE.Matrix4().makeRotationZ(k * TAU / 3).multiply(M4(0, 0.24, 0, 0, 0.55))])]);
  const glass = new THREE.SphereGeometry(0.84, 24, 12, 0, TAU, 0, PI / 2).rotateX(PI / 2).translate(0, 0, 1.2);
  const lamps = bakeColored([[new THREE.CircleGeometry(0.115, 14), 0xffffff, M4(-0.52, -0.46, 1.25)], [new THREE.CircleGeometry(0.115, 14), 0xffffff, M4(0.52, -0.46, 1.25)]]);
  return { body, prop, glass, lamps };
}
let SUBGEO = null;
export function makeSub(mats) {
  SUBGEO = SUBGEO || subGeometry();
  const g = new THREE.Group(), body = new THREE.Mesh(SUBGEO.body, mats.body), prop = new THREE.Mesh(SUBGEO.prop, mats.body), glass = new THREE.Mesh(SUBGEO.glass, mats.glass), lamps = new THREE.Mesh(SUBGEO.lamps, mats.lamp);
  prop.position.z = -2.3; glass.renderOrder = 6; g.add(body, prop, glass, lamps); g.userData.prop = prop; return g;
}
export function makePreviewSub() {   // own (unpatched) materials for the city showroom
  const mats = { body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05 }), glass: new THREE.MeshStandardMaterial({ color: 0xbfe8ff, transparent: true, opacity: 0.28, roughness: 0.05, depthWrite: false }), lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.5, 1.2) }) };
  const root = new THREE.Group(), sub = makeSub(mats), stand = new THREE.Group(), chocks = new THREE.Group(); root.add(sub, stand, chocks);
  const nav = new THREE.MeshStandardMaterial({ color: 0x2a2f55, roughness: 0.8 }), plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.55, 0.8, 28), nav); plinth.position.y = 0.4; stand.add(plinth);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.1, 28), new THREE.MeshStandardMaterial({ color: 0xffd84d, roughness: 0.6 })); rim.position.y = 0.85; stand.add(rim);
  for (const z of [-0.75, 0.82]) { const c = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.14, 0.42), nav); c.position.set(0, 0.07, z); chocks.add(c); }
  // fit the showroom band between the title and the garage row: on a plinth in portrait, smaller and on the ground in landscape
  sub.children[0].onBeforeRender = (r, sc, cam) => { const p = cam.aspect < 0.8, short = !p && r.domElement.clientHeight < 520, K = p ? 0.82 : short ? 0.27 : 0.47, L = p ? 0.9 : short ? 1.12 : 0.2;   // short = landscape phone: a ~55 px band
    sub.scale.setScalar(K); sub.position.y = L + 1.08 * K; const w = K / 0.82; stand.scale.set(w, L / 0.9, w); chocks.position.y = L; chocks.scale.setScalar(w); };
  const sh = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false })); sh.scale.set(1.3, 1, 2.6); sh.position.y = 0.02; root.add(sh);
  sub.userData.prop.onBeforeRender = () => { sub.userData.prop.rotation.z = performance.now() * 0.004; };
  return root;
}

// ---------------------------------------------------------------- geometries
const fishGeo = () => bakeColored([[S(0.5, 10, 8), 0xffffff, M4(0, 0, 0, 0, 0, 0, 0.24, 0.62, 1)], [new THREE.ConeGeometry(0.34, 0.5, 3), 0xffffff, M4(0, 0, -0.62, PI / 2, 0, 0, 0.22, 1, 1)],
  [S(0.07, 6, 4), 0x10101a, M4(0.1, 0.08, 0.3)], [S(0.07, 6, 4), 0x10101a, M4(-0.1, 0.08, 0.3)], [Bx(0.02, 0.3, 0.35), 0xffffff, M4(0, 0.32, -0.05)]]);
function turtleGeo() {
  const p = [[S(1, 14, 8), 0x6e7040, M4(0, 0, 0, 0, 0, 0, 0.8, 0.33, 1)], [S(1, 12, 6), 0xd8c48a, M4(0, -0.07, 0, 0, 0, 0, 0.74, 0.16, 0.95)], [S(0.22, 10, 8), 0x93a070, M4(0, 0.02, 1.1, 0, 0, 0, 1, 0.9, 1.3)]];
  for (let i = 0; i < 6; i++) p.push([S(0.22, 6, 4), 0x4e5030, M4(Math.sin(i) * 0.4, 0.3, -0.4 + i * 0.16, 0, 0, 0, 1, 0.25, 1)]);
  for (const s of [-1, 1]) { p.push([S(0.05, 6, 4), 0x10101a, M4(s * 0.12, 0.08, 1.3)]); p.push([S(1, 8, 4), 0x93a070, M4(s * 1.15, -0.05, 0.45, 0, s * 0.5, 0, 0.5, 0.05, 0.2)]); p.push([S(1, 8, 4), 0x93a070, M4(s * 0.6, -0.05, -0.85, 0, -s * 0.6, 0, 0.3, 0.05, 0.15)]); }
  return bakeColored(p);
}
function rayGeo() {
  const sh = new THREE.Shape([[0, 1.2], [2.3, -0.1], [0.5, -0.7], [0, -0.8], [-0.5, -0.7], [-2.3, -0.1]].map(([x, y]) => new THREE.Vector2(x, y)));
  const top = new THREE.ExtrudeGeometry(sh, { depth: 0.16, bevelEnabled: false }).rotateX(PI / 2).translate(0, 0.16, 0), bot = new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: false }).rotateX(PI / 2).translate(0, -0.01, 0);
  top.scale(1, 1, -1); bot.scale(1, 1, -1);   // extrude shape y -> world -z, so flip to put the head at +z
  return bakeColored([[top, 0x283048], [bot, 0xeef0f4], [Bx(0.12, 0.08, 0.5), 0x283048, M4(0.42, 0.06, 1.25, 0, 0.2)], [Bx(0.12, 0.08, 0.5), 0x283048, M4(-0.42, 0.06, 1.25, 0, -0.2)], [Cy(0.04, 0.01, 2.2, 5), 0x283048, M4(0, 0.05, -1.8, PI / 2)]]);
}
const kelpGeo = () => { const p = []; for (let k = 0; k < 3; k++) p.push([new THREE.PlaneGeometry(0.7, 1, 1, 10).translate(0, 0.5, 0), 0xffffff, M4(Math.sin(k * 2.1) * 0.3, 0, Math.cos(k * 2.1) * 0.3, 0, k * 1.05)]); return bakeColored(p); };
const branchGeo = () => { const p = [[Cy(0.12, 0.16, 0.4, 6), 0xffffff, M4(0, 0.2, 0)]]; for (let k = 0; k < 7; k++) { const a = k * 2.4, t = 0.3 + (k % 3) * 0.2; p.push([Cy(0.03, 0.07, 1.1, 5), 0xffffff, M4(Math.sin(a) * 0.25, 0.75, Math.cos(a) * 0.25, Math.cos(a) * t, 0, -Math.sin(a) * t)]); p.push([S(0.07, 5, 4), 0xffffff, M4(Math.sin(a) * (0.25 + t * 0.55), 1.3, Math.cos(a) * (0.25 + t * 0.55))]); } return bakeColored(p); };
const fanGeo = () => bakeColored([[new THREE.CircleGeometry(1, 9, 0, PI), 0xffffff, M4(0, 0.15, 0)], [Cy(0.04, 0.06, 0.3, 5), 0x6a4a3a, M4(0, 0.15, 0)]]);
const tubeGeo = () => { const p = []; for (let k = 0; k < 3; k++) { const h = 0.8 + k * 0.3, x = Math.sin(k * 2.2) * 0.25, z = Math.cos(k * 2.2) * 0.25; p.push([Cy(0.17, 0.14, h, 8), 0xffffff, M4(x, h / 2, z)]); p.push([new THREE.CircleGeometry(0.13, 8), 0x2a1a20, M4(x, h + 0.005, z, -PI / 2)]); } return bakeColored(p); };
function jellyGeo() {
  const p = [[new THREE.SphereGeometry(1, 14, 6, 0, TAU, 0, PI / 2), 0x9a9a9a, M4(0, 0, 0, 0, 0, 0, 1, 0.75, 1)], [new THREE.TorusGeometry(0.98, 0.06, 5, 20), 0xffffff, M4(0, 0, 0, PI / 2)], [S(0.35, 8, 6), 0xffffff, M4(0, 0.25, 0)]];
  for (let k = 0; k < 8; k++) { const a = k * TAU / 8; p.push([Cy(0.025, 0.01, 2.6, 3), 0x888888, M4(Math.sin(a) * 0.85, -1.3, Math.cos(a) * 0.85)]); }
  for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.4; p.push([Cy(0.09, 0.03, 1.5, 4), 0xbbbbbb, M4(Math.sin(a) * 0.2, -0.75, Math.cos(a) * 0.2)]); }
  const g = bakeColored(p), P = g.attributes.position, C = g.attributes.color;
  for (let i = 0; i < P.count; i++) if (P.getY(i) > 0.05) { const k = 0.35 + 0.65 * (P.getY(i) / 0.75); C.setXYZ(i, C.getX(i) * k, C.getY(i) * k, C.getZ(i) * k); }
  return g;
}
function glowSquidGeo() {
  const p = [[new THREE.ConeGeometry(0.22, 1.1, 8), 0x203050, M4(0, 0, 0.35, PI / 2)], [S(1, 6, 4), 0x203050, M4(0, 0, 0.75, 0, 0, 0, 0.45, 0.04, 0.25)], [S(0.2, 8, 6), 0x203050, M4(0, 0, -0.3)]];
  for (let k = 0; k < 8; k++) { const a = k * TAU / 8; p.push([Cy(0.03, 0.005, 0.7, 3), 0x4466aa, M4(Math.sin(a) * 0.1, Math.cos(a) * 0.1, -0.7, PI / 2)]); }
  for (let k = 0; k < 14; k++) p.push([S(0.035, 4, 3), 0xffffff, M4(Math.sin(k * 2.4) * 0.2, Math.cos(k * 2.4) * 0.2, -0.1 + (k / 14) * 0.8 - (k % 2) * 0.05)]);
  p.push([S(0.07, 6, 4), 0xffffff, M4(0.17, 0.05, -0.33)], [S(0.07, 6, 4), 0xffffff, M4(-0.17, 0.05, -0.33)]);
  return bakeColored(p);
}
function siphGeo() {
  const p = [], c = new THREE.Color();
  for (let k = 0; k < 56; k++) { c.setHSL(0.92 - k / 56 * 0.45, 1, 0.55); const z = -k * 0.48; p.push([new THREE.OctahedronGeometry(k < 4 ? 0.28 : 0.14 + (k % 3) * 0.04), c.getHex(), M4(Math.sin(k * 0.9) * 0.15, Math.cos(k * 0.7) * 0.15, z)]); if (k % 4 === 2) p.push([Cy(0.015, 0.005, 1.2, 3), 0x88aaff, M4(0, -0.6, z)]); }
  return bakeColored(p);
}
function anglerGeo() {
  const p = [[S(0.5, 12, 10), 0x3b2a2c, M4(0, 0, 0, 0, 0, 0, 0.85, 0.8, 1)], [S(0.36, 10, 8), 0x14060a, M4(0, -0.12, 0.33, 0, 0, 0, 1, 0.55, 0.5)], [new THREE.ConeGeometry(0.22, 0.4, 3), 0x3b2a2c, M4(0, 0, -0.6, -PI / 2, 0, 0, 0.3, 1, 1)]];
  for (let k = 0; k < 9; k++) { const a = -1 + k / 8 * 2; p.push([new THREE.ConeGeometry(0.03, 0.14, 4), 0xf4f0e8, M4(Math.sin(a) * 0.3, -0.02 + (k % 2) * -0.2, 0.5 + Math.cos(a) * 0.02, k % 2 ? 0 : PI)]); }
  for (const s of [-1, 1]) { p.push([S(0.07, 8, 6), 0xd8e8ff, M4(s * 0.22, 0.15, 0.35)]); p.push([S(0.04, 6, 4), 0x0a0a14, M4(s * 0.24, 0.16, 0.4)]); p.push([S(1, 6, 4), 0x2a1c1e, M4(s * 0.4, -0.1, -0.1, 0, 0, s * 0.5, 0.25, 0.03, 0.2)]); }
  p.push([Cy(0.015, 0.02, 0.7, 4), 0x4a3a3a, M4(0, 0.55, 0.35, 0.7)]);
  return bakeColored(p);
}
function giantSquidGeo() {
  const p = [[S(1, 16, 12), 0xb04a38, M4(0, 0, 2.2, 0, 0, 0, 0.85, 0.85, 3.0)], [S(1, 10, 6), 0xa04232, M4(0, 0, 4.6, 0, 0, 0, 1.8, 0.12, 0.9)], [S(0.75, 12, 10), 0xb85240, M4(0, 0, -0.9, 0, 0, 0, 1, 0.9, 1.1)]];
  for (const s of [-1, 1]) { p.push([S(0.36, 14, 10), 0xf4f2ea, M4(s * 0.62, 0.1, -0.9)]); p.push([S(0.22, 12, 8), 0x0c0c18, M4(s * 0.8, 0.12, -0.92)]); p.push([S(0.06, 6, 4), 0xffffff, M4(s * 0.92, 0.22, -0.85)]); }
  for (let k = 0; k < 8; k++) { const a = k * TAU / 8; p.push([Cy(0.16, 0.03, 4.2, 6), 0xa84636, M4(Math.sin(a) * 0.45, Math.cos(a) * 0.45, -3.6, -PI / 2 + Math.cos(a) * 0.12, 0, -Math.sin(a) * 0.12)]); }
  for (const s of [-1, 1]) { p.push([Cy(0.07, 0.05, 8.5, 5), 0xa84636, M4(s * 0.2, 0, -6.0, -PI / 2)]); p.push([S(0.22, 8, 6), 0xa84636, M4(s * 0.2, 0, -10.3, 0, 0, 0, 1, 0.6, 3)]); }
  return bakeColored(p);
}
function whaleGeo() {
  const W = 0x4c5466, D = 0x3a4050, p = [[Bx(2.6, 3.0, 5.6), W, M4(0, 0.3, 5.0)], [S(1, 14, 10), W, M4(0, 0.2, 7.7, 0, 0, 0, 1.3, 1.5, 0.6)], [S(1, 16, 12), W, M4(0, 0, 0.5, 0, 0, 0, 1.5, 1.7, 4.8)],
    [new THREE.ConeGeometry(1.2, 5.5, 12), W, M4(0, 0, -6.0, -PI / 2)], [Bx(0.7, 0.35, 5.0), 0xe8e6e0, M4(0, -1.35, 4.8)], [Bx(0.66, 0.3, 4.6), D, M4(0, -1.6, 4.8)]];
  p.push([S(1, 10, 6), D, M4(0, 0, -9.0, 0, 0, 0, 2.4, 0.12, 0.9)]);
  for (const s of [-1, 1]) { p.push([S(0.12, 6, 4), 0x10121a, M4(s * 1.32, -0.2, 3.2)]); p.push([S(1, 8, 4), D, M4(s * 1.5, -0.9, 2.2, 0, s * 0.4, s * 0.5, 0.9, 0.08, 0.4)]); }
  for (let k = 0; k < 5; k++) p.push([S(0.3, 6, 4), D, M4(0, 1.6 - k * 0.12, -1.8 - k * 0.9, 0, 0, 0, 1, 0.5, 1)]);
  return bakeColored(p);
}
const pigGeo = () => { const p = [[S(0.5, 10, 8), 0xffc8c8, M4(0, 0.3, 0, 0, 0, 0, 0.6, 0.5, 1.1)]]; for (let k = 0; k < 6; k++) p.push([new THREE.ConeGeometry(0.06, 0.3, 4), 0xffb0b0, M4((k % 2 ? 1 : -1) * 0.24, 0.06, -0.35 + Math.floor(k / 2) * 0.35, PI)]); for (const s of [-1, 1]) p.push([new THREE.ConeGeometry(0.05, 0.35, 4), 0xffb0b0, M4(s * 0.12, 0.65, 0.4)]); return bakeColored(p); };
const amphiGeo = () => bakeColored([0, 1, 2, 3].map((k) => [S(0.16 - k * 0.025, 6, 4), 0xf0e8dc, M4(0, Math.sin(k * 0.6) * 0.1, 0.3 - k * 0.2)]).concat([[Cy(0.01, 0.01, 0.4, 3), 0xf0e8dc, M4(0.05, 0.1, 0.55, 1.1)], [Cy(0.01, 0.01, 0.4, 3), 0xf0e8dc, M4(-0.05, 0.1, 0.55, 1.1)]]));
const snailGeo = () => bakeColored([[S(0.5, 12, 8), 0xffd8e0, M4(0, 0, 0.35, 0, 0, 0, 0.6, 0.62, 0.8)], [new THREE.ConeGeometry(0.28, 1.4, 8), 0xffd8e0, M4(0, 0, -0.6, -PI / 2, 0, 0, 0.5, 1, 1)], [S(0.06, 6, 4), 0x202030, M4(0.18, 0.08, 0.62)], [S(0.06, 6, 4), 0x202030, M4(-0.18, 0.08, 0.62)]]);
const wormGeo = () => bakeColored([[Cy(0.06, 0.08, 1.6, 6), 0xf2eee2, M4(0, 0.8, 0)], [new THREE.ConeGeometry(0.17, 0.45, 7), 0xe0262c, M4(0, 1.8, 0)]]);
function snackGeo() { return bakeColored([[S(1, 20, 14), 0xffd84d, M4(0, 0, 0, 0, 0, 0, 0.75, 1, 0.3)], [Bx(1.25, 0.13, 0.2), 0xffb347, M4(0, 0.97, 0)], [Bx(1.25, 0.13, 0.2), 0xffb347, M4(0, -0.97, 0)],
  [new THREE.CircleGeometry(0.36, 20), 0xff6b57, M4(0, 0.05, 0.302)], [new THREE.CircleGeometry(0.36, 20), 0xff6b57, M4(0, 0.05, -0.302, 0, PI)], [new THREE.CircleGeometry(0.13, 12), 0xfff4e6, M4(0, 0.05, 0.31)], [new THREE.CircleGeometry(0.13, 12), 0xfff4e6, M4(0, 0.05, -0.31, 0, PI)]]); }

// ---------------------------------------------------------------- the wreck: an old ocean liner broken in two (original design), local frame, bow toward +z
const hullShape = (pts) => new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
const extrudeUp = (sh, y0, h) => new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 6 }).rotateX(-PI / 2).translate(0, y0, 0);
export function wreckGeo(colliders) {
  const p = [], r = makeRng(38), add = (g, c, m, par) => p.push([g, c, par ? par.clone().multiply(m) : m]);
  const BOW = [[-8, 0], [8, 0], [8, 40], [6, 52], [2.5, 59], [0, 62], [-2.5, 59], [-6, 52], [-8, 40]], deck = 10;
  add(extrudeUp(hullShape(BOW), -3, 6), 0x9a3e26, new THREE.Matrix4()); add(extrudeUp(hullShape(BOW), 3, 7), 0x3c3a46, new THREE.Matrix4());
  add(extrudeUp(hullShape(BOW.map(([x, z]) => [x * 0.95, z * 0.98 + 0.5])), deck, 0.25), 0x5a4a38, new THREE.Matrix4());
  add(Bx(11, 3.2, 26), 0xb0a58e, M4(0, deck + 1.6, 22)); add(Bx(8, 2.6, 16), 0x9c907a, M4(0, deck + 4.5, 24)); add(Bx(12, 2.2, 3), 0xa89c86, M4(0, deck + 4.4, 37));
  for (let k = 0; k < 9; k++) add(Bx(0.1, 0.9, 0.9), 0x2a2620, M4(5.52, deck + 1.7, 11 + k * 2.6)), add(Bx(0.1, 0.9, 0.9), 0x2a2620, M4(-5.52, deck + 1.7, 11 + k * 2.6));
  add(Cy(1.9, 2.1, 9, 14), 0x8a5432, M4(0, deck + 10.3, 27)); add(Cy(1.93, 1.93, 1.6, 14), 0x15151a, M4(0, deck + 14.2, 27));
  add(Cy(1.9, 2.1, 8, 14), 0x7a4a2c, M4(3.5, deck + 3.6, 13, 0.15, 0, PI / 2 - 0.2)); add(Cy(2.1, 2.1, 1.8, 14), 0x7a4a2c, M4(0, deck + 6.6, 17));
  add(Cy(0.2, 0.28, 15, 6), 0x3a3430, M4(0, deck + 6, 50, 0.55)); add(Cy(0.15, 0.2, 9, 6), 0x3a3430, M4(0, deck + 4, 4, -0.4, 0, 0.2));
  for (const s of [-1, 1]) {
    add(Bx(0.1, 0.9, 40), 0x4a4038, M4(s * 7.5, deck + 0.45, 22));
    for (let k = 0; k < 16; k++) add(Bx(0.12, 0.55, 0.55), 0x4a3e26, M4(s * 8.02, deck - 2.4, 4 + k * 2.6));
    for (let k = 0; k < 14; k++) add(Bx(0.12, 0.45, 0.45), 0x4a3e26, M4(s * 8.02, deck - 4.6, 5 + k * 2.9));
  }
  for (let k = 0; k < 46; k++) { const z = r.range(1, 50), s = r() < 0.5 ? -1 : 1, h = r.range(0.8, 2.6); add(new THREE.ConeGeometry(r.range(0.15, 0.32), h, 5), 0x9c4a22, M4(s * 8.1, deck - 0.4 - h / 2 - r() * 4, z, PI)); }
  for (let k = 0; k < 7; k++) add(Bx(r.range(2, 5), r.range(3, 8), 0.3), 0x15161c, M4(r.range(-6, 6), r.range(0, 9), r.range(0, 1.2), r.range(-0.5, 0.5), r.range(-0.6, 0.6), r.range(-0.6, 0.6)));
  colliders.push({ cx: 0, cy: 3.5, cz: 31, hx: 8.4, hy: 13, hz: 31.5, yaw: 0 });
  // the stern half, turned and listing, 40 m off
  const st = M4(-18, -2, -44, 0, 2.6, 0.32), STERN = [[-7.5, 0], [7.5, 0], [7.5, 24], [5.5, 31], [0, 34], [-5.5, 31], [-7.5, 24]];
  add(extrudeUp(hullShape(STERN), -2, 6), 0x9a3e26, new THREE.Matrix4(), st); add(extrudeUp(hullShape(STERN), 4, 6), 0x3c3a46, new THREE.Matrix4(), st);
  add(Bx(9, 2.6, 13), 0x9c907a, M4(0, 11.3, 14), st); add(Bx(0.5, 6, 3.4), 0x2a2420, M4(0, 1, 34.5), st);
  for (let k = 0; k < 3; k++) add(Bx(0.3, 2.4, 0.8), 0x7a5a30, new THREE.Matrix4().makeTranslation(0, 1, 33).multiply(new THREE.Matrix4().makeRotationZ(k * TAU / 3)).multiply(M4(0, 1.2, 0)), st);
  colliders.push({ cx: -18 + Math.sin(2.6) * 17, cy: 3, cz: -44 + Math.cos(2.6) * 17, hx: 8.5, hy: 9, hz: 18, yaw: 2.6 });
  for (let k = 0; k < 30; k++) { const a = r.range(0, TAU), d = r.range(6, 40); add(r() < 0.6 ? Bx(r.range(0.6, 3), r.range(0.4, 1.6), r.range(0.6, 3)) : Cy(0.3, 0.3, r.range(1, 3), 6), r.pick([0x2a2620, 0x5a3a26, 0x1d1e26, 0x8a5432]), M4(-8 + Math.sin(a) * d, -0.6, -18 + Math.cos(a) * d, r() * 3, r() * 3, r() * 3)); }
  return bakeColored(p);
}
// the vent field: black smoker chimneys (baked), tops returned for smoke and colliders
export function ventGeo(tops) {
  const p = [], r = makeRng(77);
  for (let c = 0; c < 7; c++) {
    const a = c * 2.4, d = c === 0 ? 0 : 8 + r() * 14, x = VENTS.x + Math.sin(a) * d, z = VENTS.z + Math.cos(a) * d, base = -floorY(x, z) - 1, n = 4 + (c % 3);
    let y = base, rad = r.range(1.4, 1.9), ox = 0, oz = 0;
    for (let k = 0; k < n; k++) { const h = r.range(2.2, 3.8); add(); function add() { p.push([Cy(rad * 0.82, rad, h, 9), k === n - 1 ? 0x6e5630 : k % 2 ? 0x2c2a30 : 0x3a3230, M4(x + ox, y + h / 2, z + oz, r.range(-0.08, 0.08), r() * 3, r.range(-0.08, 0.08))]); } y += h * 0.92; rad *= 0.82; ox += r.range(-0.3, 0.3); oz += r.range(-0.3, 0.3); }
    for (let k = 0; k < 5; k++) { const b = r() * TAU; p.push([S(r.range(0.4, 0.9), 7, 5), 0xd8cfa4, M4(x + Math.sin(b) * 1.8, base + r.range(0.3, 2.5), z + Math.cos(b) * 1.8, 0, 0, 0, 1, 0.45, 1)]); }
    tops.push({ x: x + ox, y, z: z + oz, base, r: 2.1 });
  }
  return bakeColored(p);
}

// ---------------------------------------------------------------- drifting swarms that live round the sub inside a depth band (recycled, faded in, never popped in sight)
const O = new THREE.Object3D(); O.rotation.order = 'YXZ';
const C = new THREE.Color();
class Swarm {
  constructor(scene, geo, mat, n, o) {
    this.o = o; this.n = n; this.m = new THREE.InstancedMesh(geo, mat, n); this.m.frustumCulled = false; scene.add(this.m);
    this.p = new Float32Array(n * 3); this.yaw = new Float32Array(n); this.sc = new Float32Array(n); this.f = new Float32Array(n); this.ph = new Float32Array(n); this.col = []; this.on = false; this.r = makeRng(o.seed || 3);
    for (let i = 0; i < n; i++) { this.col.push(new THREE.Color(o.cols[i % o.cols.length])); this.m.setColorAt(i, C.setRGB(0, 0, 0)); O.scale.setScalar(0); O.updateMatrix(); this.m.setMatrixAt(i, O.matrix); }
    this.y0 = worldY(o.band[0]); this.y1 = worldY(o.band[1]); this.near = 1e9; this.lure = o.lure ? new THREE.InstancedMesh(o.lure, glowMat(), n) : null;
    if (this.lure) { this.lure.frustumCulled = false; scene.add(this.lure); for (let i = 0; i < n; i++) this.lure.setColorAt(i, C.setRGB(0, 0, 0)); }
  }
  spawn(i, s, near) {
    const r = this.r, R = this.o.R, a = s.yaw + r.range(-1.1, 1.1), d = near ? r.range(R * 0.25, R) : r.range(R * 0.6, R);
    let x = s.x + Math.sin(a) * d, z = s.z + Math.cos(a) * d, Y = clamp(s.Y + r.range(-R, R) * 0.4, this.y0, this.y1);
    if (this.o.floor) Y = floorY(x, z) - r.range(0.3, 2.5); else Y = Math.min(Y, floorY(x, z) - 3);
    this.p[i * 3] = x; this.p[i * 3 + 1] = -Y; this.p[i * 3 + 2] = z; this.yaw[i] = r() * TAU; this.sc[i] = r.range(this.o.scale[0], this.o.scale[1]); this.f[i] = 0; this.ph[i] = r() * 100;
  }
  reset() { this.on = false; for (let i = 0; i < this.n; i++) this.f[i] = 0; this.near = 1e9; }
  update(dt, t, s) {
    const want = s.Y > this.y0 - 4 && s.Y < this.y1 + 4, o = this.o, R = o.R; this.near = 1e9;
    if (want && !this.on) { this.on = true; for (let i = 0; i < this.n; i++) this.spawn(i, s, true); }
    if (!this.on) return;
    let alive = 0;
    for (let i = 0; i < this.n; i++) {
      const k = i * 3; let x = this.p[k], y = this.p[k + 1], z = this.p[k + 2];
      const dx = x - s.x, dy = y - s.y, dz = z - s.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (want && d > R * 1.15 && this.f[i] <= 0.02) { this.spawn(i, s, false); continue; }
      const fadeOut = !want || d > R * 1.05 || -y < this.y0 - 25 || -y > this.y1 + 25;
      this.f[i] = clamp(this.f[i] + (fadeOut ? -dt : dt) * 0.8, 0, 1); if (this.f[i] > 0.02) alive++;
      this.yaw[i] += Math.sin(t * 0.25 + this.ph[i]) * dt * 0.35;
      let sp = o.speed; if (o.jet) sp *= 0.4 + 3 * Math.pow(Math.max(0, Math.sin(t * 1.6 + this.ph[i])), 6);
      if (o.flee && d < 7) { this.yaw[i] = damp(this.yaw[i], Math.atan2(dx, dz), 3, dt); sp *= 3; }
      x += Math.sin(this.yaw[i]) * sp * dt; z += Math.cos(this.yaw[i]) * sp * dt; y += Math.sin(t * 0.5 + this.ph[i]) * o.bob * dt;
      if (o.floor) y = -floorY(x, z) + 0.2; else y = Math.max(y, -floorY(x, z) + 2);
      this.p[k] = x; this.p[k + 1] = y; this.p[k + 2] = z; if (this.f[i] > 0.3) this.near = Math.min(this.near, d);
      const f = this.f[i], sc = this.sc[i] * (o.glow ? 1 : f);
      O.position.set(x, y, z); O.rotation.set(o.pitch ? Math.sin(t * 0.4 + this.ph[i]) * 0.2 : 0, this.yaw[i], 0); O.scale.setScalar(sc); O.updateMatrix(); this.m.setMatrixAt(i, O.matrix);
      if (o.glow) this.m.setColorAt(i, C.copy(this.col[i]).multiplyScalar(f * o.bright * (0.75 + 0.25 * Math.sin(t * 2 + this.ph[i]))));
      if (this.lure) { O.position.set(x + Math.sin(this.yaw[i]) * 0.72 * sc, y + 0.82 * sc, z + Math.cos(this.yaw[i]) * 0.72 * sc); O.scale.setScalar(sc); O.updateMatrix(); this.lure.setMatrixAt(i, O.matrix); this.lure.setColorAt(i, C.setRGB(1.4, 3.2, 2.6).multiplyScalar(f * (0.6 + 0.4 * Math.sin(t * 3 + this.ph[i])))); }
    }
    if (!want && alive === 0) this.on = false;
    this.m.instanceMatrix.needsUpdate = true; if (this.m.instanceColor) this.m.instanceColor.needsUpdate = true;
    if (this.lure) { this.lure.instanceMatrix.needsUpdate = true; this.lure.instanceColor.needsUpdate = true; }
  }
  get visible() { return this.on; }
}

// ---------------------------------------------------------------- the reef fish: three swirling schools (boids-lite) that orbit near the sub while it's on the reef
class School {
  constructor(scene, n) {
    this.n = n; this.m = new THREE.InstancedMesh(fishGeo(), lambert({ flatShading: false }, { anim: 'transformed.x += sin(uT * 10.0 + phase - position.z * 4.0) * 0.07 * (0.35 - position.z);' }), n); this.m.frustumCulled = false; scene.add(this.m);
    this.p = new Float32Array(n * 3); this.v = new Float32Array(n * 3); this.c = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()]; this.near = 1e9;
    const cols = [[0xffd23a, 0xffe066], [0x3a7dff, 0x58a8ff], [0xff7a2a, 0xffffff]];
    for (let i = 0; i < n; i++) this.m.setColorAt(i, C.setHex(cols[i % 3][(i >> 2) % 2]));
  }
  reset(s) {
    const r = makeRng(9); for (let k = 0; k < 3; k++) this.c[k].set(s.x + (k - 1) * 9, -6 - k, s.z - 14 - k * 6);
    for (let i = 0; i < this.n; i++) { const c = this.c[i % 3]; this.p[i * 3] = c.x + r.range(-4, 4); this.p[i * 3 + 1] = c.y + r.range(-2, 2); this.p[i * 3 + 2] = c.z + r.range(-4, 4); this.v[i * 3] = this.v[i * 3 + 1] = this.v[i * 3 + 2] = 0; }
  }
  update(dt, t, s) {
    const onReef = Math.hypot(s.x - REEF.x, s.z - REEF.z) < 170 && s.Y < 70; this.near = 1e9;
    for (let k = 0; k < 3; k++) {
      const a = t * 0.16 + k * 2.1, tx = onReef ? s.x + Math.sin(s.yaw + Math.sin(a) * 1.2) * (16 + k * 5) : REEF.x + Math.sin(a) * 50, tz = onReef ? s.z + Math.cos(s.yaw + Math.sin(a) * 1.2) * (16 + k * 5) : REEF.z + Math.cos(a) * 50;
      const ty = -clamp(onReef ? s.Y + Math.sin(a * 1.7) * 3 : 8, 3, floorY(tx, tz) - 2.5);
      this.c[k].x = damp(this.c[k].x, tx, 0.5, dt); this.c[k].y = damp(this.c[k].y, ty, 0.5, dt); this.c[k].z = damp(this.c[k].z, tz, 0.5, dt);
    }
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const k = i * 3, c = this.c[i % 3], ph = i * 0.618 * TAU, rr = 1.6 + (i % 7) * 0.55, w = 0.6 + (i % 3) * 0.15;
      const tx = c.x + Math.cos(ph + t * w) * rr, ty = c.y + Math.sin(ph * 2 + t * 0.9) * 1.1, tz = c.z + Math.sin(ph + t * w) * rr;
      let vx = (tx - this.p[k]) * 1.6, vy = (ty - this.p[k + 1]) * 1.6, vz = (tz - this.p[k + 2]) * 1.6;
      const dx = this.p[k] - s.x, dy = this.p[k + 1] - s.y, dz = this.p[k + 2] - s.z, d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-3;
      if (d < 6) { const f = (6 - d) * 3 / d; vx += dx * f; vy += dy * f; vz += dz * f; }
      const sp = Math.sqrt(vx * vx + vy * vy + vz * vz), mx = 7; if (sp > mx) { vx *= mx / sp; vy *= mx / sp; vz *= mx / sp; }
      const e = 1 - Math.exp(-3 * dt); this.v[k] += (vx - this.v[k]) * e; this.v[k + 1] += (vy - this.v[k + 1]) * e; this.v[k + 2] += (vz - this.v[k + 2]) * e;
      this.p[k] += this.v[k] * dt; this.p[k + 1] = Math.min(this.p[k + 1] + this.v[k + 1] * dt, -1.2); this.p[k + 2] += this.v[k + 2] * dt;
      this.near = Math.min(this.near, d);
      const hv = Math.hypot(this.v[k], this.v[k + 2]); O.position.set(this.p[k], this.p[k + 1], this.p[k + 2]); O.rotation.set(-Math.atan2(this.v[k + 1], hv + 0.3) * 0.6, Math.atan2(this.v[k], this.v[k + 2]), 0); O.scale.setScalar(0.45 + (i % 5) * 0.06); O.updateMatrix(); this.m.setMatrixAt(i, O.matrix);
    }
    this.m.instanceMatrix.needsUpdate = true; this.m.visible = s.Y < 130;
  }
}

// ---------------------------------------------------------------- everything alive, in one object the mode drives
export class Life {
  constructor(scene) {
    this.scene = scene; const r = makeRng(2026);
    this.school = new School(scene, 135);
    this.turtle = new THREE.Mesh(turtleGeo(), lambert({ flatShading: false }, { anim: 'float ax = max(abs(position.x) - 0.55, 0.0); transformed.y += sin(uT * 2.2) * ax * 0.8 * step(0.0, position.z) + sin(uT * 2.2 + 1.5) * ax * 0.4 * step(position.z, 0.0);' })); this.turtle.scale.setScalar(0.75); scene.add(this.turtle);
    this.ray = new THREE.Mesh(rayGeo(), lambert({ flatShading: false, side: THREE.DoubleSide }, { anim: 'transformed.y += sin(uT * 1.5 - abs(position.x) * 0.5) * pow(abs(position.x), 1.4) * 0.22;' })); this.ray.scale.setScalar(1.1); scene.add(this.ray);
    this.turtle.rotation.order = this.ray.rotation.order = 'YXZ';
    // static reef: coral, sponges, rocks and a kelp patch, instanced
    const cmat = lambert({}, { caustic: true }), fmat = lambert({ side: THREE.DoubleSide }, { caustic: true, anim: 'transformed.x += sin(uT * 0.8 + phase) * position.y * 0.05;' });
    const kmat = lambert({ side: THREE.DoubleSide }, { caustic: true, anim: 'float hh = position.y; transformed.x += sin(uT * 0.9 + phase + hh * 2.5) * hh * hh * 0.45; transformed.z += cos(uT * 0.7 + phase) * hh * 0.3;' });
    const PAL = [0xff6fa0, 0xd05cff, 0xff8840, 0xffd04a, 0x3fd6c0, 0x8a5cff, 0xff4a4a, 0x9ee05a];
    const spots = (n, fn) => { const out = []; for (let i = 0; i < n; i++) { let x, z, ok = false; for (let tries = 0; tries < 20 && !ok; tries++) { if (i % 3) { x = r.range(-45, 45); z = r.range(88, 178); } else { const a = r() * TAU, d = Math.sqrt(r()) * 98; x = REEF.x + Math.sin(a) * d; z = REEF.z + Math.cos(a) * d; } ok = Math.hypot(x - REEF.x, z - REEF.z) < 100 && Math.hypot(x + 34, z - 118) > 16 && Math.hypot(x - 0, z - 150) > 7; } out.push(fn(x, z, i)); } return out; };
    const place = (geo, mat, n, sc, col = true, floor = 0.2) => { const m = new THREE.InstancedMesh(geo, mat, n); spots(n, (x, z, i) => { O.position.set(x, -floorY(x, z) - floor, z); O.rotation.set(r.range(-0.15, 0.15), r() * TAU, r.range(-0.15, 0.15)); const s = r.range(sc[0], sc[1]); O.scale.set(s * r.range(0.8, 1.2), s * (sc[2] ? r.range(0.5, 0.9) : 1), s * r.range(0.8, 1.2)); O.updateMatrix(); m.setMatrixAt(i, O.matrix); if (col) m.setColorAt(i, C.setHex(PAL[(i * 5 + (n % 7)) % PAL.length])); }); m.computeBoundingSphere(); scene.add(m); return m; };
    this.coral = [place(new THREE.IcosahedronGeometry(1, 1), cmat, 60, [0.6, 1.5, 1]), place(branchGeo(), cmat, 100, [0.8, 1.8]), place(fanGeo(), fmat, 45, [0.8, 1.6]), place(tubeGeo(), cmat, 45, [0.7, 1.4]), place(new THREE.DodecahedronGeometry(1, 0), cmat, 60, [0.8, 2.6, 1], false, 0.5)];
    for (let i = 0; i < 60; i++) this.coral[4].setColorAt(i, C.setHex(r.pick([0x8c7fae, 0x7a7090, 0x9a8a9a])));
    const kelp = new THREE.InstancedMesh(kelpGeo(), kmat, 34);
    for (let i = 0; i < 34; i++) { const a = r() * TAU, d = Math.sqrt(r()) * 17, x = -34 + Math.sin(a) * d, z = 118 + Math.cos(a) * d, h = r.range(7, 12); O.position.set(x, -floorY(x, z) - 0.3, z); O.rotation.set(0, r() * TAU, 0); O.scale.set(1.2, h, 1.2); O.updateMatrix(); kelp.setMatrixAt(i, O.matrix); kelp.setColorAt(i, C.setHex(r.pick([0x8a8a30, 0x6e7a2a, 0x9a8a3a]))); }
    kelp.computeBoundingSphere(); scene.add(kelp); this.kelp = kelp;
    // the deep swarms
    const gm = (a) => glowMat(a);
    this.jelly = new Swarm(scene, jellyGeo(), gm('float b = step(-0.05, position.y); float pu = sin(uT * 2.6 + phase); transformed.xz *= 1.0 + b * 0.13 * pu; transformed.y *= 1.0 - b * 0.1 * pu; float tn = step(position.y, -0.05); transformed.x += tn * sin(uT * 2.0 + phase + position.y * 1.5) * position.y * 0.14;'), 22,
      { band: [150, 1400], R: 44, scale: [0.7, 1.8], speed: 0.35, bob: 0.4, glow: true, bright: 1.6, cols: [0xff6fd0, 0x9a7aff, 0x5ae0ff, 0xff9a6a], seed: 4 });
    this.squid = new Swarm(scene, glowSquidGeo(), gm('transformed.x += sin(uT * 4.0 + phase + position.z * 5.0) * min(position.z + 0.3, 0.0) * 0.2;'), 12,
      { band: [450, 3200], R: 45, scale: [0.8, 1.3], speed: 1.6, bob: 0.6, jet: true, glow: true, bright: 1.8, cols: [0x58b8ff, 0x7ae8ff], seed: 5, pitch: true });
    this.siph = new Swarm(scene, siphGeo(), gm('transformed.x += sin(uT * 0.8 + phase + position.z * 0.25) * 1.3; transformed.y += cos(uT * 0.6 + phase + position.z * 0.18) * 0.7;'), 3,
      { band: [700, 4200], R: 70, scale: [1, 1.4], speed: 0.3, bob: 0.2, glow: true, bright: 1.6, cols: [0xffffff], seed: 6 });
    this.angler = new Swarm(scene, anglerGeo(), lambert({ flatShading: false }, { above: false, anim: 'transformed.x += sin(uT * 3.0 + phase) * min(position.z, 0.0) * 0.25;' }), 5,
      { band: [1000, 4600], R: 38, scale: [0.9, 1.3], speed: 0.6, bob: 0.3, cols: [0xffffff], seed: 7, lure: new THREE.SphereGeometry(0.11, 10, 8), flee: false });
    this.amphi = new Swarm(scene, amphiGeo(), lambert({ flatShading: false }, { above: false }), 36, { band: [6000, 11000], R: 24, scale: [0.35, 0.6], speed: 1.2, bob: 0.8, cols: [0xffffff], seed: 8, flee: true, pitch: true });
    this.snail = new Swarm(scene, snailGeo(), lambert({ flatShading: false, transparent: true, opacity: 0.85 }, { above: false, anim: 'transformed.x += sin(uT * 2.0 + phase - position.z * 2.0) * min(position.z, 0.0) * 0.15;' }), 6,
      { band: [6000, 8336], R: 34, scale: [0.9, 1.4], speed: 0.7, bob: 0.3, cols: [0xffffff], seed: 9 });
    this.swarms = [this.jelly, this.squid, this.siph, this.angler, this.amphi, this.snail];
    // set pieces
    this.giant = new THREE.Mesh(giantSquidGeo(), lambert({ flatShading: false }, { above: false, anim: 'float a = smoothstep(-1.6, -4.0, position.z); transformed.x += sin(uT * 2.2 - position.z * 0.55) * a * 0.6; transformed.y += cos(uT * 1.8 - position.z * 0.5) * a * 0.45; float m = smoothstep(0.0, 1.0, position.z); transformed.xy *= 1.0 + m * 0.06 * sin(uT * 3.0);' }));
    this.whale = new THREE.Mesh(whaleGeo(), lambert({ flatShading: false }, { above: false, anim: 'float t = smoothstep(-2.0, -9.5, position.z); transformed.y += sin(uT * 1.3) * t * t * 1.7;' }));
    for (const m of [this.giant, this.whale]) { m.visible = false; m.rotation.order = 'YXZ'; m.frustumCulled = false; scene.add(m); }
    this.sets = { giant: { t: -1, done: false }, whale: { t: -1, done: false } };
    // sea pigs on the abyssal plain near the wreck and the vents
    this.pigs = new THREE.InstancedMesh(pigGeo(), lambert({ flatShading: false, transparent: true, opacity: 0.9 }, { above: false }), 18); this.pigP = [];
    for (let i = 0; i < 18; i++) { const a = r() * TAU, d = r.range(10, 70), x = (i % 2 ? WRECK.x : VENTS.x) + Math.sin(a) * d, z = (i % 2 ? WRECK.z : VENTS.z) + Math.cos(a) * d; this.pigP.push([x, z, r() * TAU]); this.pigs.setColorAt(i, C.setHex(0xffffff)); }
    this.pigs.frustumCulled = false; scene.add(this.pigs);
    // wreck, vents, tube worms, bacterial mats
    this.colliders = []; const wc = [];
    this.wreck = new THREE.Mesh(wreckGeo(wc), lambert({}, { above: false })); const wy = -floorY(WRECK.x, WRECK.z); this.wreck.position.set(WRECK.x, wy, WRECK.z); this.wreck.rotation.y = WRECK.yaw; scene.add(this.wreck);
    for (const c of wc) { const cs = Math.cos(WRECK.yaw), sn = Math.sin(WRECK.yaw); this.colliders.push({ type: 'box', x: WRECK.x + c.cx * cs + c.cz * sn, y: wy + c.cy, z: WRECK.z - c.cx * sn + c.cz * cs, hx: c.hx, hy: c.hy, hz: c.hz, yaw: WRECK.yaw + c.yaw }); }
    this.deck = new THREE.Vector3(0, 10.3 + 1.6 + 3.2 + 1.5, 22).applyEuler(new THREE.Euler(0, WRECK.yaw, 0)).add(this.wreck.position);
    this.tops = []; this.vents = new THREE.Mesh(ventGeo(this.tops), lambert({}, { above: false })); scene.add(this.vents);
    for (const t of this.tops) this.colliders.push({ type: 'cyl', x: t.x, z: t.z, r: t.r, y0: t.base, y1: t.y });
    const worms = new THREE.InstancedMesh(wormGeo(), lambert({ flatShading: false }, { above: false, anim: 'float h = max(position.y, 0.0); transformed.x += sin(uT * 1.3 + phase) * h * h * 0.05; transformed.z += cos(uT * 1.1 + phase) * h * h * 0.04;' }), 170);
    for (let i = 0; i < 170; i++) { const t = this.tops[i % this.tops.length], a = r() * TAU, d = r.range(1.6, 5.5), x = t.x + Math.sin(a) * d, z = t.z + Math.cos(a) * d; O.position.set(x, -floorY(x, z) - 0.2, z); O.rotation.set(r.range(-0.2, 0.2), r() * TAU, r.range(-0.2, 0.2)); O.scale.setScalar(r.range(0.7, 1.5)); O.updateMatrix(); worms.setMatrixAt(i, O.matrix); }
    worms.computeBoundingSphere(); scene.add(worms); this.worms = worms;
    const mats = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 12).rotateX(-PI / 2), lambert({ color: 0xe8dca0, vertexColors: false }, { above: false }), 12);
    for (let i = 0; i < 12; i++) { const t = this.tops[i % this.tops.length], a = r() * TAU, x = t.x + Math.sin(a) * 4, z = t.z + Math.cos(a) * 4; O.position.set(x, -floorY(x, z) + 0.05, z); O.rotation.set(0, 0, 0); O.scale.set(r.range(2, 4), 1, r.range(1.5, 3)); O.updateMatrix(); mats.setMatrixAt(i, O.matrix); }
    mats.computeBoundingSphere(); scene.add(mats);
    // the snack at the bottom of the world
    const sy = -floorY(SNACK.x, SNACK.z) + 3.2; this.snackPos = new THREE.Vector3(SNACK.x, sy, SNACK.z);
    this.snack = new THREE.Mesh(snackGeo(), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(2.2, 2.0, 1.7), fog: false })); this.snack.position.copy(this.snackPos); this.snack.scale.setScalar(0.65); scene.add(this.snack);
    const gt = glowTex();
    this.snackHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: new THREE.Color(2.4, 1.7, 0.6), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true })); this.snackHalo.scale.setScalar(6); this.snackHalo.position.copy(this.snackPos); scene.add(this.snackHalo);
    this.snackPool = new THREE.Mesh(new THREE.CircleGeometry(9, 24).rotateX(-PI / 2), new THREE.MeshBasicMaterial({ map: gt, color: new THREE.Color(0.6, 0.42, 0.15), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    this.snackPool.position.set(SNACK.x, -floorY(SNACK.x, SNACK.z) + 0.3, SNACK.z); scene.add(this.snackPool);
    this.species = { fish: () => this.school.near, turtle: () => this.dist(this.turtle), ray: () => this.dist(this.ray), jelly: () => this.jelly.near, giant: () => (this.giant.visible ? this.dist(this.giant) : 1e9), squid: () => this.squid.near, siph: () => this.siph.near,
      whale: () => (this.whale.visible ? this.dist(this.whale) : 1e9), angler: () => this.angler.near, pig: () => this.pigNear, worms: () => this.ventNear, snail: () => this.snail.near, amphi: () => this.amphi.near };
    this._s = null; this.pigNear = 1e9; this.ventNear = 1e9;
  }
  dist(m) { const s = this._s; return s ? Math.hypot(m.position.x - s.x, m.position.y - s.y, m.position.z - s.z) : 1e9; }
  reset(s) {
    this.school.reset(s); for (const w of this.swarms) w.reset();
    this.snackGone = false;
    for (const k in this.sets) { this.sets[k].t = -1; this.sets[k].done = false; } this.giant.visible = this.whale.visible = false;
  }
  trigger(name, s) { const st = this.sets[name]; if (st.done) return false; st.done = true; st.t = 0; st.yaw = s.yaw; this[name].visible = true; return true; }
  update(dt, t, s) {
    this._s = s; this.school.update(dt, t, s);
    { const a = t * 0.1, x = Math.sin(a) * 26, z = 112 + Math.cos(a) * 19, y = -7.5 - Math.sin(t * 0.3); this.turtle.position.set(x, y, z); this.turtle.rotation.set(Math.cos(t * 0.3) * 0.08, Math.atan2(Math.cos(a) * 26, -Math.sin(a) * 19), Math.sin(t * 0.5) * 0.1); }
    { const w = 0.026, a = PI - w * 12 + t * w, x = Math.sin(a) * 120, z = REEF.z + Math.cos(a) * 120; this.ray.position.set(x, -34 - Math.sin(t * 0.2) * 3, z); this.ray.rotation.set(Math.sin(t * 0.4) * 0.06, a + PI / 2, -0.25); }
    const reefVis = s.Y < 140; this.turtle.visible = this.ray.visible = this.kelp.visible = reefVis; for (const c of this.coral) c.visible = reefVis;
    for (const w of this.swarms) w.update(dt, t, s);
    // set pieces: paths in the sub's frame as it was when they started, so they always cross the headlight beam
    const G = this.sets.giant; if (G.t >= 0) { G.t += dt; const k = Math.min(1, G.t / 11);   // swims across the beam, left to right, then sinks away
      this.place(this.giant, s, G.yaw, -30 + 60 * k, -1 - 3 * k - 8 * smooth(0.75, 1, k), 19 + 4 * Math.sin(k * PI), PI / 2 - 0.25 + 0.5 * k, 0.12); if (G.t > 11.5) { G.t = -1; this.giant.visible = false; } }
    const W = this.sets.whale; if (W.t >= 0) { W.t += dt; const k = Math.min(1, W.t / 13);   // glides across, right to left, diving
      this.place(this.whale, s, W.yaw, 36 - 72 * k, 3 - 16 * k, 23 + 4 * Math.sin(k * PI), -PI / 2 + 0.2, 0.3); if (W.t > 13.5) { W.t = -1; this.whale.visible = false; } }
    // sea pigs crawl, vents and wreck distances
    this.pigNear = 1e9; const near = s.Y > 380;
    this.pigs.visible = near;
    if (near) { for (let i = 0; i < this.pigP.length; i++) { const q = this.pigP[i]; q[2] += Math.sin(t * 0.1 + i) * dt * 0.1; q[0] += Math.sin(q[2]) * dt * 0.15; q[1] += Math.cos(q[2]) * dt * 0.15; O.position.set(q[0], -floorY(q[0], q[1]) - 0.1, q[1]); O.rotation.set(0, q[2], 0); O.scale.setScalar(1.1); O.updateMatrix(); this.pigs.setMatrixAt(i, O.matrix); this.pigNear = Math.min(this.pigNear, Math.hypot(q[0] - s.x, O.position.y - s.y, q[1] - s.z)); } this.pigs.instanceMatrix.needsUpdate = true; }
    this.ventNear = Math.hypot(VENTS.x - s.x, -floorY(VENTS.x, VENTS.z) - s.y, VENTS.z - s.z) - 10;
    this.snack.rotation.y = t * 0.9; this.snack.position.y = this.snackPos.y + Math.sin(t * 1.4) * 0.35; this.snackHalo.material.opacity = 0.7 + 0.3 * Math.sin(t * 3);
    const deep = s.Y > 300; this.wreck.visible = this.vents.visible = this.worms.visible = deep; this.snack.visible = this.snackHalo.visible = this.snackPool.visible = s.Y > 420 && !this.snackGone;
  }
  place(m, s, yaw, lx, ly, lz, dirYaw, pitch) { const c = Math.cos(yaw), sn = Math.sin(yaw); m.position.set(s.x + lx * c + lz * sn, s.y + ly, s.z - lx * sn + lz * c); m.rotation.set(pitch, yaw + dirYaw, 0); m.position.y = Math.max(m.position.y, -floorY(m.position.x, m.position.z) + 6); }
}
export { TRENCH_Z, U };
