// SNACK PATROL: goofy cruisers that chase you when the chaos (heat) climbs. FREE ROAM only (not deterministic).
// Stars come from heat and only go up; you lose them by staying 160 m clear for 8 s, or get BUSTED (a donut-flavoured fine)
// by stopping with two cruisers parked round you for 3 s. Bumpers bonk, nobody is hurt.
// Cruisers drive the road grid (greedy node-to-node toward you), switch to direct pursuit when close with a clear line,
// and are pushed out of solids every step. Four instanced draw calls for up to 5 cruisers, no per-frame allocation.
import * as THREE from 'three';
import * as L from './layout.js';
import { bakeColored, M4, clamp, wrapAngle } from './util.js';

const MAXN = 5, R_HIT = 3.0, R_TOUCH = 3.6, BUST_R = 7, BUST_V = 6 / 3.6, BUST_T = 3, LOST_R = 160, LOST_T = 8, PIN_T = 2.5;
const STAR_V = [0, 22, 25, 28, 31, 34];          // cruise cap per star (m/s); always under the player's top speed
const BLUE = 0x3f86ff, CREAM = 0xfff1dc, PINK = 0xff7fb0, DOUGH = 0xd99a5b, DARK = 0x262532, GLASS = 0x1f2c55;
const PUFF = { life: 0.6, size: 0.9, grow: 1.6, drag: 3, r: 0.95, g: 0.92, b: 0.96 };
const STAR = { life: 0.45, size: 0.28, grow: -0.5, drag: 2, grav: 6, r: 1, g: 0.75, b: 0.85, add: 1 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

// side-profile slab (z forward, y up) extruded across x, centred, with a soft bevel: the chunky toy look
function slab(pts, width, bevel) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))), { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
  g.rotateY(-Math.PI / 2); g.translate((width - bevel * 2) / 2, 0, 0); return g;
}
// a flat donut (pink frosting, sprinkles) facing out along +x / -x, used as the door emblem
function donut(parts, s, y, z, r) {
  const rot = M4(0, 0, 0, 0, 0, Math.PI / 2);
  const at = (dx, dy = 0, dz = 0) => M4(s * (1.0 + dx), y + dy, z + dz).multiply(rot);
  parts.push([new THREE.CylinderGeometry(r, r, 0.02, 22), DOUGH, at(0.012)]);
  parts.push([new THREE.CylinderGeometry(r * 0.82, r * 0.82, 0.02, 22), PINK, at(0.022)]);
  parts.push([new THREE.CylinderGeometry(r * 0.34, r * 0.34, 0.02, 16), DOUGH, at(0.032)]);
  parts.push([new THREE.CylinderGeometry(r * 0.24, r * 0.24, 0.02, 16), BLUE, at(0.042)]);
  const SPR = [0xffd84d, 0xf8f8f8, 0x6ee0c8, 0xffd84d, 0x8a6cff, 0xf8f8f8];
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + 0.4, rr = r * 0.58; parts.push([new THREE.BoxGeometry(0.02, 0.035, 0.1), SPR[k], M4(s * 1.034, y + Math.sin(a) * rr, z + Math.cos(a) * rr, a, 0, 0)]); }
}
function cruiserGeometry() {
  const parts = [];
  // body: short, tall, rounded. Built in a marker colour, then two-toned by height (candy blue below, cream above)
  // (the bevel grows each slab by 0.16 all round: the shell spans z -2.24..2.24)
  parts.push([slab([[-2.0, 0.34], [-2.08, 0.62], [-2.07, 0.72], [2.06, 0.72], [2.08, 0.64], [2.0, 0.34]], 2.0, 0.16), BLUE]);
  parts.push([slab([[-2.07, 0.74], [-2.0, 0.98], [-1.55, 1.05], [1.25, 1.05], [1.9, 0.92], [2.06, 0.74]], 1.98, 0.15), CREAM]);
  parts.push([slab([[-1.32, 1.02], [-1.0, 1.62], [0.5, 1.62], [1.02, 1.02]], 1.78, 0.08), GLASS]);          // bubble cabin
  parts.push([slab([[-1.02, 1.6], [-0.96, 1.72], [0.48, 1.72], [0.55, 1.6]], 1.86, 0.05), CREAM]);           // roof cap
  for (const s of [-1, 1]) {
    parts.push([new THREE.BoxGeometry(0.06, 0.6, 0.12), CREAM, M4(s * 0.9, 1.33, -0.25)]);                    // centre pillar
    parts.push([new THREE.BoxGeometry(0.03, 0.1, 3.5), PINK, M4(s * 1.0, 0.86, 0)]);                         // frosting stripe
    donut(parts, s, 0.52, 0.15, 0.27);
    parts.push([new THREE.BoxGeometry(0.2, 0.12, 0.18), CREAM, M4(s * 1.02, 1.12, 0.95)]);                    // stubby mirrors
    for (const z of [1.36, -1.36]) {
      parts.push([new THREE.CylinderGeometry(0.43, 0.43, 0.36, 18), 0x18171f, M4(s * 0.86, 0.43, z, 0, 0, Math.PI / 2)]);
      parts.push([new THREE.CylinderGeometry(0.22, 0.22, 0.37, 12), CREAM, M4(s * 0.87, 0.43, z, 0, 0, Math.PI / 2)]);
    }
  }
  // squishy bonk bumpers and a little smile under the grille
  parts.push([new THREE.CapsuleGeometry(0.19, 1.75, 4, 10), DARK, M4(0, 0.36, 2.24, 0, 0, Math.PI / 2)]);
  parts.push([new THREE.CapsuleGeometry(0.19, 1.75, 4, 10), DARK, M4(0, 0.36, -2.24, 0, 0, Math.PI / 2)]);
  parts.push([new THREE.TorusGeometry(0.2, 0.04, 6, 16, Math.PI), DARK, M4(0, 0.82, 2.22, 0, 0, Math.PI)]);
  parts.push([new THREE.BoxGeometry(1.8, 0.12, 3.9), 0x121118, M4(0, 0.3, 0)]);                                // underbody
  // light bar base and the roof donut (stood upright, seen from front and back)
  parts.push([new THREE.BoxGeometry(1.36, 0.1, 0.38), DARK, M4(0, 1.77, -0.25)]);
  parts.push([new THREE.TorusGeometry(0.2, 0.1, 8, 18), DOUGH, M4(0, 2.08, -0.25)]);
  parts.push([new THREE.TorusGeometry(0.2, 0.105, 8, 18, Math.PI), PINK, M4(0, 2.09, -0.25)]);
  parts.push([new THREE.BoxGeometry(0.1, 0.1, 0.1), DARK, M4(0, 1.86, -0.25)]);
  return bakeColored(parts);
}
const lampGeometry = () => bakeColored([
  ...[-1, 1].map((s) => [new THREE.CylinderGeometry(0.2, 0.2, 0.06, 18), 0xfff2d6, M4(s * 0.6, 0.72, 2.25, Math.PI / 2, 0, 0)]),
  ...[-1, 1].map((s) => [new THREE.CylinderGeometry(0.14, 0.14, 0.06, 14), 0xff2a40, M4(s * 0.66, 0.74, -2.25, Math.PI / 2, 0, 0)]),
]);
const lensGeometry = (s) => bakeColored([[new THREE.BoxGeometry(0.42, 0.17, 0.32), 0xffffff, M4(s * 0.44, 1.9, -0.25)], [new THREE.SphereGeometry(0.1, 10, 6), 0xffffff, M4(s * 0.44, 2.0, -0.25, 0, 0, 0, 1, 0.6, 1)]]);

export class Police {
  constructor(scene, tier = 'medium', audio = null) {
    this.scene = scene; this.audio = audio; this.cap = tier === 'low' ? 3 : MAXN;
    const inst = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, MAXN); m.count = 0; m.frustumCulled = false; m.castShadow = m.receiveShadow = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); return m; };
    this.body = inst(cruiserGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.15 }));
    this.lamps = inst(lampGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(2, 2, 2) }));
    this.red = inst(lensGeometry(-1), new THREE.MeshBasicMaterial({ toneMapped: false, color: new THREE.Color(4, 0.3, 0.35) }));
    this.blue = inst(lensGeometry(1), new THREE.MeshBasicMaterial({ toneMapped: false, color: new THREE.Color(0.3, 0.6, 4) }));
    this.meshes = [this.body, this.lamps, this.red, this.blue];
    this.pool = Array.from({ length: MAXN }, (_, k) => ({ k, on: false, x: 0, z: 0, yaw: 0, speed: 0, role: k, ai: 0, aj: 0, bi: 0, bj: 0, mode: 'road', bonkT: 0, backT: 0, wallT: 0, roadT: 0, slowT: 0, roll: 0, bob: 0, bobV: 0, d: 1e9 }));
    this.cruisers = []; this.siren = null; this.reset();
  }
  reset() {
    for (const c of this.pool) c.on = false;
    this.cruisers.length = 0; this._stars = 0; this.calm = 0; this.spawnT = 0; this.bustT = 0; this.lostT = 0; this.pinT = 0; this.pinX = 0; this.pinZ = 0;
    this.nearest = 1e9; this.holding = false; this.bust = 0; this.spawned = 0;
    for (const m of this.meshes) m.count = 0;
    this.sirenOff(true);
  }
  get stars() { return this._stars; }
  get chasing() { return this.cruisers.length > 0; }
  // heat = the game's chaos 0..5.99; cb = { onBust(fine), onShove(speed), onLost(), onSpawn(), toast(big, small) }; traffic optional (cruisers shove it)
  update(dt, time, car, heat, fx, cb = {}, traffic = null) {
    // ---- wanted level: rises with heat, never flickers down; after a bust / escape it waits for fresh chaos
    if (heat < this.calm) this.calm = heat;
    const eff = this.calm > 0 && heat < this.calm + 0.75 ? 0 : heat, want = Math.min(5, Math.floor(eff));
    if (want > this._stars) { this._stars = want; this.calm = 0; if (cb.toast) cb.toast('★'.repeat(want), want === 1 ? 'SNACK PATROL IS ON YOU' : want >= 5 ? 'EVERY DONUT IN TOWN' : 'MORE SNACK PATROL'); }
    const stars = this._stars, vmax = car.P && car.P.vmax ? car.P.vmax : 46, cap = Math.min(STAR_V[stars] || 0, vmax * 0.85);
    // ---- spawn up to one cruiser per star (tier cap), out of sight behind you
    let n = 0; for (const c of this.pool) if (c.on) n++;
    this.spawnT -= dt;
    if (n < Math.min(this.cap, stars) && this.spawnT <= 0) { if (this.spawn(car, cap)) { n++; this.spawned++; if (cb.onSpawn) cb.onSpawn(); } this.spawnT = 1.4; }
    // ---- drive
    const pfx = Math.sin(car.yaw), pfz = Math.cos(car.yaw), prx = -pfz, prz = pfx;
    let nearest = 1e9, near7 = 0, touching = false;
    for (const c of this.pool) {
      if (!c.on) continue;
      c.bonkT -= dt; c.roadT -= dt;
      const dx0 = car.x - c.x, dz0 = car.z - c.z, d = Math.hypot(dx0, dz0); c.d = d;
      let tx, tz, wantV;
      if (c.backT > 0) { c.backT -= dt; c.speed = Math.max(-6, c.speed - 14 * dt); tx = c.x + Math.sin(c.yaw) * 10; tz = c.z + Math.cos(c.yaw) * 10; wantV = -6; }
      else {
        const direct = d < 42 && c.roadT <= 0 && this.clear(c.x, c.z, car.x, car.z);
        if (direct) {
          c.mode = 'direct';
          const lead = Math.min(0.6, d / 40);
          let ox = 0, oz = 0;
          if (stars >= 3 && (c.role === 1 || c.role === 2) && d > 4) { const s = c.role === 1 ? -3.2 : 3.2; ox = prx * s; oz = prz * s; }   // flankers: come alongside for the PIT bonk
          else if (stars >= 4 && c.role === 3 && (c.x - car.x) * pfx + (c.z - car.z) * pfz > -4) { ox = pfx * 14; oz = pfz * 14; }      // the blocker: get in front
          tx = car.x + car.vx * lead + ox; tz = car.z + car.vz * lead + oz;
          wantV = car.speed < 2 ? clamp((d - 4.2) * 1.3, 0, 9) : Math.min(cap, car.speed + 3 + Math.hypot(tx - c.x, tz - c.z) * 0.6);
        } else {
          if (c.mode !== 'road') { c.mode = 'road'; this.snap(c, car); }
          const bx = c.bi * L.P, bz = c.bj * L.P;
          if (Math.abs(c.x - bx) + Math.abs(c.z - bz) < 10) this.nextNode(c, car);
          const ax = c.ai * L.P, az = c.aj * L.P, ux = Math.sign(c.bi - c.ai), uz = Math.sign(c.bj - c.aj);
          const t = clamp((c.x - ax) * ux + (c.z - az) * uz + 11, 0, L.P);
          tx = ax + ux * t; tz = az + uz * t;
          wantV = d > 90 ? Math.max(cap, vmax * 0.9) : cap;   // a little catch-up when far (still under your top speed)
        }
      }
      // steer toward the target; slow for sharp turns
      const turn = wrapAngle(Math.atan2(tx - c.x, tz - c.z) - c.yaw), rate = 1.7 + stars * 0.35;
      if (c.backT <= 0) { c.yaw += clamp(turn, -rate * dt, rate * dt); wantV *= clamp(1.15 - Math.abs(turn) * 0.7, 0.3, 1); }
      else c.yaw -= clamp(turn, -1, 1) * 0.8 * dt;
      c.speed += clamp(wantV - c.speed, -22 * dt, 11 * dt);
      const sy = Math.sin(c.yaw), cy = Math.cos(c.yaw), px = c.x, pz = c.z;
      c.x += sy * c.speed * dt; c.z += cy * c.speed * dt;
      // walls: two circles along the body, pushed out of every solid
      let hit = false;
      for (let s = -1; s <= 1; s += 2) {
        const cx = c.x + sy * s * 1.15, cz = c.z + cy * s * 1.15, h = L.collideCircle(cx, cz, 1.1, 0.3);
        if (h.hit) { c.x += h.x - cx; c.z += h.z - cz; hit = true; }
      }
      c.x = clamp(c.x, L.LAND.x0 + 3, L.LAND.x1 - 3); c.z = clamp(c.z, L.LAND.z0 + 3, L.LAND.z1 - 3);
      if (hit) { c.speed *= 0.85; c.wallT += dt; if (c.mode === 'direct' && c.wallT > 0.8) { c.roadT = 3; c.wallT = 0; } }
      else c.wallT = Math.max(0, c.wallT - dt);
      // wedged (wants to move, isn't): reverse out for a moment
      const moved = Math.hypot(c.x - px, c.z - pz) / dt;
      if (c.backT <= 0 && wantV > 4 && moved < 1) { c.slowT += dt; if (c.slowT > 1.5) { c.slowT = 0; c.backT = 1.2; c.roadT = 2.5; } } else c.slowT = 0;
      c.roll += (clamp(turn * c.speed * 0.004, -0.06, 0.06) - c.roll) * Math.min(1, dt * 6);
      c.bobV += (-c.bob * 140 - c.bobV * 9) * dt; c.bob += c.bobV * dt;
      // the bonk: a shove through your velocity, a spin on a side (PIT) hit at 3+ stars
      const ddx = car.x - c.x, ddz = car.z - c.z, dd = Math.hypot(ddx, ddz) || 0.01;
      if (dd < R_HIT && car.y < 2) {
        const nx = ddx / dd, nz = ddz / dd, ov = R_HIT - dd;
        car.x += nx * ov * 0.6; car.z += nz * ov * 0.6; c.x -= nx * ov * 0.4; c.z -= nz * ov * 0.4;
        const vr = (sy * c.speed - car.vx) * nx + (cy * c.speed - car.vz) * nz;
        if (vr > 0.8 && c.bonkT <= 0 && c.backT <= 0) {
          const imp = Math.min(7, 1.5 + vr * 0.45); car.vx += nx * imp; car.vz += nz * imp; c.speed *= 0.45; c.bonkT = 0.7; c.bobV = 2.2;
          car.impact = Math.max(car.impact, Math.min(7.5, vr * 0.6));   // under the game's crash threshold: police bonks don't feed the heat
          const side = Math.abs(nx * pfx + nz * pfz) < 0.55;
          if (side && stars >= 3 && car.yawRate !== undefined) car.yawRate += (nx * prx + nz * prz > 0 ? 1 : -1) * Math.min(1.6, 0.5 + vr * 0.12);
          if (fx) { fx.burst(c.x + nx * 1.5, 1.0, c.z + nz * 1.5, 6, 4, PUFF, 0.3); fx.burst(c.x + nx * 1.5, 1.2, c.z + nz * 1.5, 10, 6, STAR, 0.8); }
          if (cb.onShove) cb.onShove(vr);
        }
      }
      if (dd < R_TOUCH) touching = true;
      if (dd < BUST_R) near7++;
      if (dd < nearest) nearest = dd;
      // traffic gets bumped aside
      if (traffic) for (const t of traffic.cars) {
        if (t.mode === 'fly' || t.mode === 'shove') continue;
        const ox = t.x - c.x, oz = t.z - c.z, od = Math.hypot(ox, oz);
        if (od < 3.2 && od > 0.01) { traffic.launch(t, 'shove', ox / od * (4 + c.speed * 0.4) + sy * c.speed * 0.5, oz / od * (4 + c.speed * 0.4) + cy * c.speed * 0.5, 2.5); c.speed *= 0.6; c.bobV = 1.5; if (fx) fx.burst(t.x, 1, t.z, 5, 4, PUFF, 0.3); }
      }
    }
    // cruisers bump each other
    for (let a = 0; a < MAXN; a++) { const A = this.pool[a]; if (!A.on) continue;
      for (let b = a + 1; b < MAXN; b++) { const B = this.pool[b]; if (!B.on) continue; const ox = B.x - A.x, oz = B.z - A.z, od = Math.hypot(ox, oz);
        if (od < 3.0 && od > 0.01) { const k = (3.0 - od) / od * 0.5; A.x -= ox * k; A.z -= oz * k; B.x += ox * k; B.z += oz * k; } } }
    for (const c of this.pool) if (c.on && L.insideSolid(c.x, 1, c.z)) { const h = L.collideCircle(c.x, c.z, 1.1, 0.3); c.x = h.x; c.z = h.z; }   // the pair push can't leave one inside a wall
    this.nearest = nearest;
    const slow = car.speed < BUST_V;
    this.holding = slow && nearest < BUST_R;   // the game should skip its stuck-poof while this is true
    // ---- BUSTED: parked with two cruisers round you
    if (near7 >= 2 && slow) this.bustT += dt; else this.bustT = Math.max(0, this.bustT - dt * 2);
    this.bust = this.bustT / BUST_T;
    if (this.bustT >= BUST_T) {
      const fine = 25 + stars * 25;
      this.clearAll(fx); this.calm = heat;
      if (cb.toast) cb.toast('BUSTED!', `DONUT FINE $${fine}`);
      if (cb.onBust) cb.onBust(fine);
    } else {
    // ---- never pinned for good: a cruiser leaning on a stuck player backs off (unless a bust is already counting down)
    if (touching && this.bustT <= 0) {
      if (this.pinT === 0) { this.pinX = car.x; this.pinZ = car.z; }
      this.pinT += dt;
      if (this.pinT > PIN_T) { if (Math.hypot(car.x - this.pinX, car.z - this.pinZ) < 3) for (const c of this.pool) if (c.on && c.d < R_TOUCH + 0.5) { c.backT = 1.5; c.roadT = 3; } this.pinT = 0; }
    } else this.pinT = 0;
    // ---- LOST THEM: nobody within 160 m for 8 s
    if (n > 0 && nearest > LOST_R) this.lostT += dt; else this.lostT = 0;
    if (this.lostT >= LOST_T) { this.clearAll(null); this.calm = heat; if (cb.toast) cb.toast('LOST THEM!', 'SNACK PATROL WENT FOR DONUTS'); if (cb.onLost) cb.onLost(); }
    }
    const k = this.draw(time); this.sirenUpdate(dt); return k;
  }
  // line of sight at bumper height (samples every ~8 m)
  clear(x0, z0, x1, z1) {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 8);
    for (let k = 1; k < n; k++) { const t = k / n; if (L.insideSolid(x0 + (x1 - x0) * t, 1, z0 + (z1 - z0) * t)) return false; }
    return true;
  }
  // put a cruiser back on the road graph: the nearest road line, heading for the end closer to the player
  snap(c, car) {
    const i = Math.round(c.x / L.P), j = Math.round(c.z / L.P), fx_ = Math.abs(c.x - i * L.P), fz_ = Math.abs(c.z - j * L.P);
    const ci = clamp(i, L.XI[0], L.XI[1]), cj = clamp(j, L.ZJ[0], L.ZJ[1]);
    if (fx_ < fz_) { const j0 = clamp(Math.floor(c.z / L.P), L.ZJ[0], L.ZJ[1] - 1); this.seg(c, ci, j0, ci, j0 + 1, car); }
    else { const i0 = clamp(Math.floor(c.x / L.P), L.XI[0], L.XI[1] - 1); this.seg(c, i0, cj, i0 + 1, cj, car); }
  }
  seg(c, i0, j0, i1, j1, car) {
    const d0 = Math.abs(i0 * L.P - car.x) + Math.abs(j0 * L.P - car.z), d1 = Math.abs(i1 * L.P - car.x) + Math.abs(j1 * L.P - car.z);
    if (d1 <= d0) { c.ai = i0; c.aj = j0; c.bi = i1; c.bj = j1; } else { c.ai = i1; c.aj = j1; c.bi = i0; c.bj = j0; }
  }
  // at a node: take the exit that gets closest to where you are going (the grid is complete, so greedy is a shortest path)
  nextNode(c, car) {
    const gx = car.x + car.vx * 1.5, gz = car.z + car.vz * 1.5;
    let best = -1, bs = 1e9;
    for (let d = 0; d < 4; d++) {
      const ni = c.bi + L.DIRS[d][0], nj = c.bj + L.DIRS[d][1]; if (!L.nodeOk(ni, nj)) continue;
      const s = Math.abs(ni * L.P - gx) + Math.abs(nj * L.P - gz) + (ni === c.ai && nj === c.aj ? 60 : 0) + c.role * Math.random() * 8;   // others fan out a little
      if (s < bs) { bs = s; best = d; }
    }
    if (best < 0) return;
    c.ai = c.bi; c.aj = c.bj; c.bi += L.DIRS[best][0]; c.bj += L.DIRS[best][1];
  }
  spawn(car, cap) {
    const c = this.pool.find((q) => !q.on); if (!c) return false;
    const fx_ = Math.sin(car.yaw), fz_ = Math.cos(car.yaw);
    let bx = 0, bz = 0, bs = 1e9, b0 = 0, b1 = 0, b2 = 0, b3 = 0;
    for (let pass = 0; pass < 2 && bs === 1e9; pass++) {
      const lo = pass ? 60 : 90, hi = pass ? 220 : 160;
      for (let i = L.XI[0]; i <= L.XI[1]; i++) for (let j = L.ZJ[0]; j <= L.ZJ[1]; j++) for (let m = 0; m < 3; m++) {
        // m 0: the node, 1: half way to (i+1, j), 2: half way to (i, j+1)
        const i2 = m === 1 ? i + 1 : i, j2 = m === 2 ? j + 1 : j; if (!L.nodeOk(i2, j2)) continue;
        const x = (i + i2) / 2 * L.P, z = (j + j2) / 2 * L.P, d = Math.hypot(x - car.x, z - car.z);
        if (d < lo || d > hi || L.insideSolid(x, 1, z)) continue;
        let crowd = false; for (const o of this.pool) if (o.on && Math.hypot(o.x - x, o.z - z) < 20) crowd = true; if (crowd) continue;
        const ahead = (x - car.x) * fx_ + (z - car.z) * fz_, s = (ahead > -15 ? 200 : 0) + Math.random() * 40;
        if (s < bs) { bs = s; bx = x; bz = z; b0 = i; b1 = j; b2 = i2; b3 = j2; }
      }
    }
    if (bs === 1e9) return false;
    Object.assign(c, { on: true, x: bx, z: bz, speed: cap * 0.7, mode: 'road', bonkT: 0, backT: 0, wallT: 0, roadT: 0, slowT: 0, roll: 0, bob: 0, bobV: 0, d: 1e9, role: this.spawned % MAXN });
    if (b0 === b2 && b1 === b3) { c.ai = c.bi = b0; c.aj = c.bj = b1; this.nextNode(c, car); } else this.seg(c, b0, b1, b2, b3, car);
    c.yaw = Math.atan2(c.bi * L.P - c.x, c.bj * L.P - c.z);
    return true;
  }
  clearAll(fx) {
    for (const c of this.pool) if (c.on) { c.on = false; if (fx && c.d < 60) fx.burst(c.x, 1.2, c.z, 10, 6, PUFF, 0.4); }
    this._stars = 0; this.bustT = 0; this.lostT = 0; this.pinT = 0; this.bust = 0; this.holding = false; this.nearest = 1e9;
  }
  draw(time) {
    const list = this.cruisers; list.length = 0; let k = 0;
    for (const c of this.pool) {
      if (!c.on) continue; list.push(c);
      _e.set(-c.bob * 0.05, c.yaw, c.roll, 'YXZ'); _q.setFromEuler(_e); _p.set(c.x, Math.max(0, c.bob * 0.06), c.z); _m.compose(_p, _q, _s);
      for (const m of this.meshes) m.setMatrixAt(k, _m); k++;
    }
    for (const m of this.meshes) { m.count = k; m.instanceMatrix.needsUpdate = true; }
    // wig-wag: red double-flash, then blue double-flash
    const ph = (time * 5) % 2, on = (ph % 1) < 0.55, red = ph < 1 && on, blue = ph >= 1 && on;
    this.red.material.color.setRGB(red ? 5 : 0.3, red ? 0.12 : 0.02, red ? 0.12 : 0.03);
    this.blue.material.color.setRGB(blue ? 0.1 : 0.02, blue ? 0.35 : 0.05, blue ? 5 : 0.3);
    return k;
  }
  // ---- the siren: a synthesized cartoon "wee-woo" (square LFO flips a triangle voice between two tones), loudness from the nearest cruiser
  sirenUpdate(dt) {
    const a = this.audio, ctx = a && a.ctx, live = this.cruisers.length > 0;
    if (!ctx) return;
    const t = ctx.currentTime;
    if (live && !this.siren) {
      const o = ctx.createOscillator(), o2 = ctx.createOscillator(), lfo = ctx.createOscillator(), lg = ctx.createGain(), lg2 = ctx.createGain(), lp = ctx.createBiquadFilter(), g = ctx.createGain(), g2 = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = 720; o2.type = 'square'; o2.frequency.value = 723; lfo.type = 'square'; lfo.frequency.value = 0.9; lg.gain.value = 150; lg2.gain.value = 150;
      lp.type = 'lowpass'; lp.frequency.value = 2200; g2.gain.value = 0.18; g.gain.value = 0;
      lfo.connect(lg); lg.connect(o.frequency); lfo.connect(lg2); lg2.connect(o2.frequency); o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(a.sfx || ctx.destination);
      o.start(); o2.start(); lfo.start(); this.siren = { o, o2, lfo, g, nodes: [o, o2, lfo, lg, lg2, lp, g, g2], offT: 0 };
    }
    const S = this.siren; if (!S) return;
    const vol = live ? 0.06 * clamp(1 - this.nearest / 220, 0, 1) ** 1.4 : 0;
    S.g.gain.setTargetAtTime(vol, t, 0.25);
    if (live) S.offT = 0; else if ((S.offT += dt) > 1.5) this.sirenOff(true);
  }
  sirenOff(now) {
    const S = this.siren; if (!S) return; this.siren = null;
    try { for (const o of [S.o, S.o2, S.lfo]) o.stop(); } catch (e) { /* already stopped */ }
    for (const nd of S.nodes) nd.disconnect(); void now;
  }
  dispose() {
    this.reset();
    for (const m of this.meshes) { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); m.dispose(); }
  }
}
