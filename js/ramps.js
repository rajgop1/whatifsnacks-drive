// STUNT JUMPS: six painted wedge ramps (layout.RAMPS) with a glowing arch over the run-up and a bullseye landing pad.
// The height lives in layout.rampY (so groundY and the car see it); this file builds the meshes (5 draw calls for all six),
// the guard-rail solids, and the game logic: launch off a ramp, land on its pad = a found jump, remembered in localStorage.
import * as THREE from 'three';
import * as L from './layout.js';
import { canvas, tex, bakeColored, M4 } from './util.js';

const KEY = 'wis-jumps';
const readFound = () => {   // hand-edited storage must never throw: keep only valid ramp indices
  try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return new Set(Array.isArray(a) ? a.filter((i) => Number.isInteger(i) && i >= 0 && i < L.RAMPS.length) : []); } catch (e) { return new Set(); }
};

function deckTexture() {   // top half: coral deck with yellow chevrons pointing up the ramp; bottom strip: navy side paint with a yellow band
  const c = canvas(256, 512), g = c.getContext('2d');
  g.fillStyle = '#ff6a4d'; g.fillRect(0, 0, 256, 384);
  g.fillStyle = '#ffd84d';
  for (let y = -64; y < 384; y += 64) { g.beginPath(); g.moveTo(20, y + 44); g.lineTo(128, y); g.lineTo(236, y + 44); g.lineTo(236, y + 66); g.lineTo(128, y + 22); g.lineTo(20, y + 66); g.closePath(); g.fill(); }
  g.fillStyle = '#f4f1f8'; g.fillRect(0, 0, 12, 384); g.fillRect(244, 0, 12, 384);
  g.fillStyle = '#2b2f5e'; g.fillRect(0, 384, 256, 128); g.fillStyle = '#ffd84d'; g.fillRect(0, 420, 256, 22);
  return tex(c, { repeat: false });
}
function padTexture() {
  const c = canvas(256), g = c.getContext('2d');
  for (const [r, col] of [[126, '#ff6a4d'], [104, '#fff4e8'], [80, '#ff6a4d'], [56, '#fff4e8'], [32, '#ffd84d']]) { g.fillStyle = col; g.beginPath(); g.arc(128, 128, r, 0, 7); g.fill(); }
  return tex(c, { repeat: false });
}
function signTexture() {
  const c = canvas(512, 128), g = c.getContext('2d');
  g.fillStyle = '#2b2f5e'; g.fillRect(0, 0, 512, 128); g.fillStyle = '#ffd84d'; g.fillRect(0, 0, 512, 10); g.fillRect(0, 118, 512, 10);
  g.font = '900 78px "Montserrat","Arial Black",sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#ffd84d'; g.fillText('STUNT JUMP', 256, 68);
  return tex(c, { repeat: false });
}

// plain triangle soup with uvs: push(x,y,z,u,v) per vertex, three per triangle
class Soup { constructor() { this.p = []; this.u = []; } tri(...vs) { for (const [x, y, z, u, v] of vs) { this.p.push(x, y, z); this.u.push(u, v); } }
  quad(a, b, c, d) { this.tri(a, b, c); this.tri(a, c, d); }
  build() { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(this.u, 2)); g.computeVertexNormals(); return g; } }

export class Ramps {
  constructor(scene, tier = 'medium') {
    this._found = readFound(); this.blips = []; this.reset();
    const lit = tier !== 'low', Std = lit ? THREE.MeshStandardMaterial : THREE.MeshBasicMaterial;
    const deck = new Soup(), pads = new Soup(), sign = new Soup(), kit = [], glow = [], beams = [];
    for (const r of L.RAMPS) {
      // world point from ramp-local (u along, v right, y up); right = (dz, -dx) matches rampY's v
      const W = (u, v, y, tu, tv) => [r.x + r.dx * u + r.dz * v, y, r.z + r.dz * u - r.dx * v, tu, tv];
      const hw = r.w / 2, L1 = r.len, L2 = r.len + r.back, h = r.h, top = (u) => (u <= L1 ? h * u / L1 : h * (1 - (u - L1) / r.back));
      // deck: up slope (chevrons) and back slope; v of the texture runs 0.25..1 over the deck (top 3/4 of the canvas)
      deck.quad(W(0, -hw, 0.02, 0, 0.25), W(0, hw, 0.02, 1, 0.25), W(L1, hw, h, 1, 1), W(L1, -hw, h, 0, 1));
      deck.quad(W(L1, -hw, h, 0, 0.6), W(L1, hw, h, 1, 0.6), W(L2, hw, 0.02, 1, 0.3), W(L2, -hw, 0.02, 0, 0.3));
      // sides: navy with the yellow band (texture v 0..0.25)
      for (const s of [-1, 1]) {
        const v = s * hw; deck.tri(W(0, v, 0, 0, 0.2), W(L1, v, h, 0.5, 0.02), W(L1, v, 0, 0.5, 0.2)); deck.tri(W(L1, v, 0, 0.5, 0.2), W(L1, v, h, 0.5, 0.02), W(L2, v, 0, 1, 0.2));
      }
      const yaw = Math.atan2(r.dx, r.dz), at = (u, v, y, rx = 0) => M4(r.x + r.dx * u + r.dz * v, y, r.z + r.dz * u - r.dx * v, 0, yaw).multiply(M4(0, 0, 0, rx));   // pitch first, then yaw
      // guard rails along both edges, 0.6 m over the deck, on posts; their solids step with the deck so the car is kept on and side entries bump
      const slope = Math.atan2(h, L1), back = Math.atan2(h, r.back);
      for (const s of [-1, 1]) {
        const v = s * (hw + 0.15);
        kit.push([new THREE.BoxGeometry(0.22, 0.22, Math.hypot(L1, h)), 0xf4f1f8, at(L1 / 2, v, h / 2 + 0.6, -slope)]);
        kit.push([new THREE.BoxGeometry(0.22, 0.22, Math.hypot(r.back, h)), 0xf4f1f8, at(L1 + r.back / 2, v, h / 2 + 0.6, back)]);
        for (let u = 1; u < L2; u += 4.5) kit.push([new THREE.BoxGeometry(0.16, 0.7, 0.16), 0x2b2f5e, at(u, v, top(u) + 0.3)]);
        const seg = 5; for (let k = 0; k < seg; k++) {
          const u0 = (L2 * k) / seg, u1 = (L2 * (k + 1)) / seg, hh = Math.max(top(u0), top(u1), u0 < L1 && u1 > L1 ? h : 0) + 0.6;
          const a = W(u0, v - 0.2, 0), b = W(u1, v + 0.2, 0); L.addSolid(Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2]), hh, 'ramp');
        }
      }
      // the arch over the run-up (glows), its feet, and the sign on top facing the approach
      const AR = hw + 1.6;
      glow.push([new THREE.TorusGeometry(AR, 0.32, 8, 28, Math.PI), 0xffffff, at(-1, 0, 0)]);
      for (const s of [-1, 1]) { kit.push([new THREE.BoxGeometry(1.1, 0.5, 1.1), 0x2b2f5e, at(-1, s * AR, 0.25)]); const f = W(-1, s * AR, 0); L.addSolid(f[0] - 0.55, f[2] - 0.55, f[0] + 0.55, f[2] + 0.55, 6, 'ramp'); }
      { const y0 = AR + 0.5, y1 = y0 + 1.9, sw = 3.8; sign.quad(W(-1, sw, y0, 0, 0), W(-1, -sw, y0, 1, 0), W(-1, -sw, y1, 1, 1), W(-1, sw, y1, 0, 1));     // reads right from the run-up
        sign.quad(W(-1.06, -sw, y0, 0, 0), W(-1.06, sw, y0, 1, 0), W(-1.06, sw, y1, 1, 1), W(-1.06, -sw, y1, 0, 1)); }   // and from the pad side
      // a tall soft light column beside the ramp, seen from across the district (faded out once the jump is found)
      { const g = new THREE.CylinderGeometry(1.1, 1.6, 60, 12, 8, true), p = g.attributes.position, c = new Float32Array(p.count * 3);
        for (let k = 0; k < p.count; k++) { const t = (p.getY(k) + 30) / 60, f = (1 - t) ** 1.5 * Math.min(1, 0.25 + t * 6); c[k * 3] = f; c[k * 3 + 1] = f * 0.75; c[k * 3 + 2] = f * 0.3; }
        g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.applyMatrix4(at(r.len * 0.5, hw + 3.2, 30)); beams.push(g); }
      // a base of barrels by the foot and cones lining the run-up
      for (const s of [-1, 1]) {
        for (const [du, dv] of [[0.6, 1.1], [0.6, 2.3], [1.8, 1.7]]) kit.push([new THREE.CylinderGeometry(0.45, 0.45, 1.1, 12), du > 1 ? 0xffd84d : 0xff6a4d, at(du, s * (hw + dv), 0.55)]);
        for (let k = 1; k <= 4; k++) { kit.push([new THREE.ConeGeometry(0.32, 0.8, 10), 0xff8a3a, at(-k * 5, s * (hw + 0.6), 0.4)]); kit.push([new THREE.CylinderGeometry(0.33, 0.33, 0.1, 10), 0xf4f1f8, at(-k * 5, s * (hw + 0.6), 0.45)]); }
      }
      // the landing pad (a square decal with the bullseye texture)
      const R = r.padR; pads.quad(W(L1 + r.pad - R, -R, 0.05, 0, 0), W(L1 + r.pad - R, R, 0.05, 1, 0), W(L1 + r.pad + R, R, 0.05, 1, 1), W(L1 + r.pad + R, -R, 0.05, 0, 1));
    }
    const add = (g, m, order) => { const o = new THREE.Mesh(g, m); if (order) o.renderOrder = order; o.receiveShadow = lit; scene.add(o); return o; };
    if (!L.RAMPS.length) return;
    add(deck.build(), new Std({ map: deckTexture(), roughness: 0.7, side: THREE.DoubleSide }));
    add(bakeColored(kit), new Std({ vertexColors: true, roughness: 0.6 })).castShadow = lit;
    this.glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.5, 0.5), toneMapped: false });
    add(bakeColored(glow), this.glowMat);
    add(sign.build(), new THREE.MeshBasicMaterial({ map: signTexture(), toneMapped: false, color: new THREE.Color(1.4, 1.4, 1.4) }));
    { const n = beams[0].attributes.position.count, P = new Float32Array(n * 3 * beams.length), C = new Float32Array(n * 3 * beams.length), g = new THREE.BufferGeometry(), I = [];
      beams.forEach((b, k) => { P.set(b.attributes.position.array, k * n * 3); C.set(b.attributes.color.array, k * n * 3); for (const i of b.index.array) I.push(i + k * n); });
      g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setIndex(I); this.beamC = C.slice(); this.beamN = n * 3; this.beamGeo = g;
      add(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }), 2); this.refresh(); }
    add(pads.build(), new THREE.MeshBasicMaterial({ map: padTexture(), transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 1);
  }
  get count() { return L.RAMPS.length; }
  get found() { return this._found; }
  reset() { this.fly = -1; this.onRamp = -1; this.t = 0; this.x0 = 0; this.z0 = 0; this.refresh(); }
  refresh() {
    this.blips.length = 0; L.RAMPS.forEach((r, i) => { if (!this._found.has(i)) this.blips.push({ x: r.x, z: r.z }); });
    if (this.beamGeo) { const a = this.beamGeo.attributes.color; L.RAMPS.forEach((r, i) => { for (let k = i * this.beamN; k < (i + 1) * this.beamN; k++) a.array[k] = this._found.has(i) ? 0 : this.beamC[k]; }); a.needsUpdate = true; }
  }
  // cb: { onFly(i), onJump(i, distance, airTime) }; active = a run or free roam is live (the arches still pulse otherwise)
  update(dt, time, car, active, cb = {}) {
    if (this.glowMat) this.glowMat.color.setRGB(2.4, 1.5, 0.5).multiplyScalar(0.8 + 0.25 * Math.sin(time * 4));
    if (!active) { this.fly = -1; return; }
    if (!car.air) {
      if (this.fly >= 0 && this.t > 0.25) {   // landed: on the pad = a found jump
        const r = L.RAMPS[this.fly], dist = Math.hypot(car.x - this.x0, car.z - this.z0);
        if (Math.hypot(car.x - r.padX, car.z - r.padZ) <= r.padR) {
          if (!this._found.has(this.fly)) { this._found.add(this.fly); try { localStorage.setItem(KEY, JSON.stringify([...this._found])); } catch (e) { /* private window */ } this.refresh(); }
          if (cb.onJump) cb.onJump(this.fly, dist, this.t);
        }
      }
      this.fly = -1;
      this.onRamp = L.rampY(car.x, car.z) > 0.3 ? this.nearest(car) : -1;
    } else if (this.fly >= 0) this.t += dt;
    else if (this.onRamp >= 0) {   // just left a ramp's deck: launched
      if (car.vy < 1.5) { this.onRamp = -1; return; }   // rolled off the back slope, no launch
      this.fly = this.onRamp; this.onRamp = -1; this.t = dt; this.x0 = car.x; this.z0 = car.z;
      if (cb.onFly) cb.onFly(this.fly);
    }
  }
  nearest(car) { let b = -1, d = 1e9; L.RAMPS.forEach((r, i) => { const k = Math.hypot(car.x - r.lipX, car.z - r.lipZ); if (k < d) { d = k; b = i; } }); return b; }
}
