// Pedestrians: mascot-bodied people on the sidewalks, three instanced meshes (body, legs, arms) plus dogs.
// Little stories: phone zombies who stop to film the tornado, joggers, dog walkers, people hailing a taxi at the corner.
// Everyone dives out of the way of a fast car (nobody gets hit) and runs from the tornado.
import * as THREE from 'three';
import * as L from './layout.js';
import { mascotParts, tintMaterial, MASCOT_JOINTS as J } from './models.js';
import { makeRng, bakeColored, M4 } from './util.js';

const HOODIES = [0xff6b57, 0x2a52b0, 0xffd84d, 0x3a8a6a, 0xf2f2f6, 0x6a3aa8, 0xff9a3d, 0x22222c, 0x8ad0ff, 0xe86aa0].map((c) => new THREE.Color(c));
const KINDS = ['walk', 'walk', 'phone', 'phone', 'jog', 'dog', 'hail'];
const OFF = L.RW / 2 + L.SW / 2, SIDE = L.P - 2 * OFF, PER = SIDE * 4;
const _b = new THREE.Matrix4(), _l = new THREE.Matrix4(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

export class Peds {
  constructor(scene, count, seed = 1) {
    const g = mascotParts(0xffffff, true), mat = tintMaterial({ roughness: 0.75 });
    this.body = new THREE.InstancedMesh(g.torso, mat, count); this.legs = new THREE.InstancedMesh(g.leg, mat, count * 2); this.arms = new THREE.InstancedMesh(g.arm, mat, count * 2);
    const dog = bakeColored([[new THREE.BoxGeometry(0.28, 0.26, 0.62), 0xb07a4a, M4(0, 0.42, 0)], [new THREE.BoxGeometry(0.24, 0.24, 0.26), 0xb07a4a, M4(0, 0.62, 0.36)], [new THREE.BoxGeometry(0.12, 0.1, 0.12), 0x2a1a14, M4(0, 0.6, 0.52)],
      [new THREE.BoxGeometry(0.06, 0.12, 0.06), 0x7a4a2a, M4(-0.09, 0.78, 0.32)], [new THREE.BoxGeometry(0.06, 0.12, 0.06), 0x7a4a2a, M4(0.09, 0.78, 0.32)], [new THREE.BoxGeometry(0.05, 0.05, 0.3), 0xb07a4a, M4(0, 0.55, -0.4, 0.6, 0, 0)],
      ...[[-0.1, 0.22], [0.1, 0.22], [-0.1, -0.22], [0.1, -0.22]].map(([x, z]) => [new THREE.BoxGeometry(0.07, 0.3, 0.07), 0x8a5a3a, M4(x, 0.15, z)])]);
    this.dogs = new THREE.InstancedMesh(dog, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), count);
    for (const m of [this.body, this.legs, this.arms, this.dogs]) { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; scene.add(m); }
    const r = (this.rng = makeRng(seed * 31 + 5)), blocks = L.blocks.filter((b) => b.kind !== 'park');
    this.list = [];
    for (let k = 0; k < count; k++) {
      const kind = KINDS[k % KINDS.length], b = blocks[r.int(0, blocks.length - 1)];
      const p = { k, kind, b, s: r() * PER, dir: r() < 0.5 ? 1 : -1, speed: kind === 'jog' ? 3.2 : kind === 'phone' ? 0.9 : 1.3 + r() * 0.4, sc: 0.9 + r() * 0.2, ph: r() * 6.28, state: 'walk', t: 0, x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, yaw: 0, lean: 0, dog: kind === 'dog' };
      if (kind === 'hail') p.s = Math.floor(r() * 4) * SIDE + SIDE * (r() < 0.5 ? 0.12 : 0.88);
      this.place(p); this.body.setColorAt(k, HOODIES[r.int(0, HOODIES.length - 1)]); const cc = new THREE.Color(); this.body.getColorAt(k, cc); this.arms.setColorAt(k * 2, cc); this.arms.setColorAt(k * 2 + 1, cc);
      this.list.push(p);
    }
    this.dogs.count = this.list.filter((p) => p.dog).length;
    this.nearT = 0;
  }
  perim(p, s) { // point and heading on the block's sidewalk loop
    s = ((s % PER) + PER) % PER; const e = Math.floor(s / SIDE), u = s - e * SIDE, b = p.b, x0 = b.x0 + OFF, z0 = b.z0 + OFF;
    if (e === 0) return [x0 + u, z0, 1, 0]; if (e === 1) return [x0 + SIDE, z0 + u, 0, 1]; if (e === 2) return [x0 + SIDE - u, z0 + SIDE, -1, 0]; return [x0, z0 + SIDE - u, 0, -1];
  }
  place(p) { const [x, z, dx, dz] = this.perim(p, p.s); p.x = x; p.z = z; p.yaw = Math.atan2(dx * p.dir, dz * p.dir); if (p.kind === 'hail') { const e = Math.floor((((p.s % PER) + PER) % PER) / SIDE); p.yaw = [Math.PI, Math.PI / 2, 0, -Math.PI / 2][e]; } }
  update(dt, time, car, tornado, onNearMiss) {
    this.nearT -= dt; let dk = 0;
    for (const p of this.list) {
      p.t += dt; const cdx = p.x - car.x, cdz = p.z - car.z, cd = Math.hypot(cdx, cdz);
      const tdx = tornado.active ? p.x - tornado.x : 0, tdz = tornado.active ? p.z - tornado.z : 0, td = tornado.active ? Math.hypot(tdx, tdz) : 1e9;
      // reactions
      const fwd = car.speed > 0.1 ? (car.vx * cdx + car.vz * cdz) / car.speed : -1, lat = car.speed > 0.1 ? Math.abs(car.vx * cdz - car.vz * cdx) / car.speed : 99;
      if (p.state !== 'dive' && fwd > 0 && fwd < 6 + car.speed * 0.35 && lat < 2.8 && car.speed > 7 && car.y < 3) {
        const sx = -car.vz / car.speed, sz = car.vx / car.speed, side = sx * cdx + sz * cdz > 0 ? 1 : -1;
        p.state = 'dive'; p.t = 0; p.vx = sx * side * 6; p.vz = sz * side * 6; p.vy = 3.4; p.yaw = Math.atan2(p.vx, p.vz);
        if (this.nearT <= 0 && onNearMiss) { onNearMiss(); this.nearT = 4; }
      } else if (p.state !== 'dive' && td < 50) { p.state = 'flee'; p.t = 0; }
      else if (p.kind === 'phone' && p.state === 'walk' && td < 170) { p.state = 'film'; p.t = 0; }
      if (p.state === 'dive') {
        p.vy -= 12 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.y = Math.max(0, p.y + p.vy * dt); if (p.y === 0) { p.vx *= Math.exp(-6 * dt); p.vz *= Math.exp(-6 * dt); }
        p.lean = Math.min(1.45, p.t * 4); if (p.t > 1.6) { p.state = 'walk'; p.lean = 0; this.resnap(p); }
      } else if (p.state === 'flee') {
        const n = td || 1; p.yaw = Math.atan2(tdx / n, tdz / n); p.x += tdx / n * 5 * dt; p.z += tdz / n * 5 * dt; p.lean = 0.25;
        if (td > 90) { p.state = 'walk'; p.lean = 0; this.resnap(p); }
      } else if (p.state === 'film') {
        p.yaw = Math.atan2(-tdx, -tdz); p.lean = -0.08; if (!tornado.active || td > 200) { p.state = 'walk'; p.lean = 0; }
      } else if (p.kind !== 'hail') { p.s += p.speed * p.dir * dt; this.place(p); p.lean = p.kind === 'phone' ? 0.12 : p.kind === 'jog' ? 0.1 : 0; }
      if (p.state === 'dive' || p.state === 'flee') { const h = L.collideCircle(p.x, p.z, 0.4, 0); if (h.hit) { p.x = h.x; p.z = h.z; } }
      // pose
      const moving = p.state === 'walk' && p.kind !== 'hail' || p.state === 'flee', rate = p.state === 'flee' ? 11 : p.kind === 'jog' ? 10 : 6.5 * p.speed / 1.3;
      const ph = p.ph + time * rate, sw = moving ? Math.sin(ph) * (p.state === 'flee' || p.kind === 'jog' ? 0.75 : 0.5) : 0, bob = moving ? Math.abs(Math.cos(ph)) * 0.05 : 0;
      _e.set(p.lean, p.yaw, 0, 'YXZ'); _q.setFromEuler(_e); _p.set(p.x, p.y + bob, p.z); _s.setScalar(p.sc); _b.compose(_p, _q, _s);
      this.body.setMatrixAt(p.k, _b);
      for (let s = 0; s < 2; s++) {
        const sg = s ? 1 : -1, legSwing = p.state === 'dive' ? -0.6 : sw * sg;
        _l.makeRotationX(legSwing).setPosition(sg * J.hipX, J.hipY, 0); _m.multiplyMatrices(_b, _l); this.legs.setMatrixAt(p.k * 2 + s, _m);
        let ax = -sw * sg * 0.9, az = sg * 0.12;
        if (p.state === 'flee' || p.state === 'dive') { ax = -2.8 + Math.sin(time * 14 + s) * 0.3; az = sg * 0.3; }
        else if (p.kind === 'phone' && s === 1) { ax = p.state === 'film' ? -2.4 : -1.35; az = -0.25; }
        else if (p.kind === 'hail' && s === 1) { ax = -2.9; az = 0.35 * Math.sin(time * 7 + p.ph); }
        else if (p.kind === 'dog' && s === 1) ax = -0.7;
        _e.set(ax, 0, az, 'ZXY'); _q.setFromEuler(_e); _p.set(sg * J.shoulderX, J.shoulderY, 0); _s.set(1, 1, 1); _l.compose(_p, _q, _s); _m.multiplyMatrices(_b, _l); this.arms.setMatrixAt(p.k * 2 + s, _m);
      }
      if (p.dog) { const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), db = Math.abs(Math.sin(time * 12 + p.ph)) * 0.06; _e.set(0, p.yaw, 0); _q.setFromEuler(_e); _p.set(p.x + fx * 1.3 + fz * 0.3, db, p.z + fz * 1.3 - fx * 0.3); _s.set(1, 1, 1); _m.compose(_p, _q, _s); this.dogs.setMatrixAt(dk++, _m); }
    }
    for (const m of [this.body, this.legs, this.arms, this.dogs]) m.instanceMatrix.needsUpdate = true;
  }
  resnap(p) { // back onto the sidewalk loop nearest to where the dive or run ended
    let best = p.s, bd = 1e9; for (let s = 0; s < PER; s += 2) { const [x, z] = this.perim(p, s); const d = (x - p.x) ** 2 + (z - p.z) ** 2; if (d < bd) { bd = d; best = s; } }
    p.s = best; p.y = 0; if (p.kind !== 'hail') this.place(p);
  }
}
