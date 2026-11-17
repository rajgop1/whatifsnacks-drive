// AI traffic: cars follow lanes on the road grid, take curved turns, stop at red lights, brake for the car ahead (and for you),
// get shoved when you hit them, and get lifted by the tornado. Two instanced draw calls for all of them.
import * as THREE from 'three';
import { carGeometry, carLightsGeometry, tintMaterial } from './models.js';
import * as L from './layout.js';
import { makeRng } from './util.js';

const STOP = 14, SEG = L.P - 2 * STOP;
const COLORS = [0xf2f2f6, 0x22222c, 0xffc52e, 0xb8283a, 0x2a52b0, 0x9a9aa6, 0xffc52e, 0x3a8a6a, 0xff8a3a, 0x6a3aa8, 0xe8e0d0].map((c) => new THREE.Color(c));
const right = (d) => [-L.DIRS[d][1], L.DIRS[d][0]];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);

export class Traffic {
  constructor(scene, count, seed = 1) {
    this.rng = makeRng(seed * 977 + 13); this.cars = [];
    this.body = new THREE.InstancedMesh(carGeometry(), tintMaterial({ roughness: 0.32, metalness: 0.5 }), count);
    this.lights = new THREE.InstancedMesh(carLightsGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, color: new THREE.Color(2, 2, 2) }), count);
    this.body.castShadow = true; this.body.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.lights.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.body.frustumCulled = this.lights.frustumCulled = false;
    scene.add(this.body, this.lights);
    for (let k = 0; k < count; k++) { const c = { k, x: 0, y: 0, z: 0, yaw: 0, speed: 0 }; this.place(c, null); this.body.setColorAt(k, COLORS[k % COLORS.length]); this.cars.push(c); }
    this.body.instanceColor.needsUpdate = true;
  }
  // put a car on a random lane segment (away from a point if given)
  // (near: also keep it within that distance, so far-away cars are recycled into the streets you can see)
  place(c, away, near = 1e9) {
    for (let tries = 0; tries < 40; tries++) {
      const i = this.rng.int(L.XI[0], L.XI[1]), j = this.rng.int(L.ZJ[0], L.ZJ[1]), d = this.rng.int(0, 3), pi = i - L.DIRS[d][0], pj = j - L.DIRS[d][1];
      if (!L.nodeOk(pi, pj) || !L.nodeOk(i, j)) continue;
      c.i = i; c.j = j; c.d = d; c.s = this.rng() * SEG; c.mode = 'lane'; this.lanePos(c);
      const dd = away ? Math.hypot(c.x - away.x, c.z - away.z) : 0;
      if (tries < 39 && away && (dd < 70 || dd > near)) continue;
      break;
    }
    c.speed = 8; c.cruise = 9 + this.rng() * 5; c.y = 0; c.vy = 0; c.t = 0; c.spinV = 0; c.roll = 0; c.pitch = 0; c.nm = 0;
  }
  lanePos(c) {
    const [dx, dz] = L.DIRS[c.d], [rx, rz] = right(c.d), sx = (c.i - dx) * L.P + rx * L.LANE + dx * STOP, sz = (c.j - dz) * L.P + rz * L.LANE + dz * STOP;
    c.x = sx + dx * c.s; c.z = sz + dz * c.s; c.yaw = Math.atan2(dx, dz);
  }
  startTurn(c) {
    const ex = L.exits(c.i, c.j).filter((d) => d !== (c.d + 2) % 4), nd = ex.length ? ex[this.rng.int(0, ex.length - 1)] : (c.d + 2) % 4;
    const [dx, dz] = L.DIRS[c.d], [rx, rz] = right(c.d), [ndx, ndz] = L.DIRS[nd], [r2x, r2z] = right(nd), Nx = c.i * L.P, Nz = c.j * L.P;
    const E = [Nx + rx * L.LANE - dx * STOP, Nz + rz * L.LANE - dz * STOP], X = [Nx + r2x * L.LANE + ndx * STOP, Nz + r2z * L.LANE + ndz * STOP];
    const K = nd === c.d ? [(E[0] + X[0]) / 2, (E[1] + X[1]) / 2] : nd === (c.d + 2) % 4 ? [Nx - dx * 2, Nz - dz * 2] : [Nx + (rx + r2x) * L.LANE, Nz + (rz + r2z) * L.LANE];
    c.turn = { E, K, X, nd, len: Math.hypot(K[0] - E[0], K[1] - E[1]) + Math.hypot(X[0] - K[0], X[1] - K[1]) }; c.mode = 'turn'; c.t = 0;
  }
  // tornado = {x, z, r} or null; player = car
  update(dt, time, player, tornado, fx, onHit) {
    const cars = this.cars;
    for (const c of cars) {
      if (c.mode === 'fly' || c.mode === 'shove') {
        c.t += dt; c.vy -= 9.8 * dt; c.x += c.vx * dt; c.z += c.vz * dt; c.y += c.vy * dt; c.yaw += c.spinV * dt; c.roll += c.rollV * dt; c.pitch += c.pitchV * dt;
        if (c.mode === 'fly' && tornado && c.t < 2.4) { const ax = c.x - tornado.x, az = c.z - tornado.z, d = Math.hypot(ax, az) + 0.1; c.vx += (-az / d * 22 - ax / d * 6) * dt; c.vz += (ax / d * 22 - az / d * 6) * dt; c.vy += 16 * dt; }
        const h = L.collideCircle(c.x, c.z, 1.6, c.y); if (h.hit) { c.x = h.x; c.z = h.z; const vn = c.vx * h.nx + c.vz * h.nz; if (vn < 0) { c.vx -= 1.5 * vn * h.nx; c.vz -= 1.5 * vn * h.nz; } }
        if (c.y <= 0) { c.y = 0; if (c.vy < -6 && fx) fx.burst(c.x, 0.4, c.z, 12, 5, { life: 0.8, size: 1.4, grow: 2, drag: 3, r: 0.85, g: 0.8, b: 0.78 }, 0.2); c.vy = Math.abs(c.vy) * 0.25; c.vx *= 0.6; c.vz *= 0.6; c.spinV *= 0.5; c.rollV *= 0.3; c.pitchV *= 0.3; if (Math.abs(c.vy) < 1) { c.roll *= 0.8; c.pitch *= 0.8; } }
        if (c.mode === 'shove') { const k = Math.exp(-2.2 * dt); c.vx *= k; c.vz *= k; c.spinV *= k; }
        if (c.t > (c.mode === 'fly' ? 6 : 3.5)) this.place(c, player);
        continue;
      }
      // recycle cars that are far behind you into nearby streets (keeps the visible streets busy on any map size)
      if (player.y !== undefined && Math.abs(c.x - player.x) + Math.abs(c.z - player.z) > 320 && this.rng() < dt) { this.place(c, player, 240); continue; }
      // tornado pickup
      if (tornado && Math.hypot(c.x - tornado.x, c.z - tornado.z) < tornado.r) { this.launch(c, 'fly'); continue; }
      // speed control: lights, the car ahead, the player
      let want = c.cruise;
      const [dx, dz] = c.mode === 'lane' ? L.DIRS[c.d] : [Math.sin(c.yaw), Math.cos(c.yaw)];
      if (c.mode === 'lane') {
        const toStop = SEG - c.s, lit = L.nodeOk(c.i, c.j) && c.i > L.XI[0] && c.i < L.XI[1] && c.j > L.ZJ[0] && c.j < L.ZJ[1];
        if (lit) { const sg = L.signal(L.DIRS[c.d][0] !== 0 ? 1 : 0, time); if (sg === 'R' || (sg === 'Y' && toStop > 5)) want = Math.min(want, Math.max(0, (toStop - 0.5) * 0.9)); }
      }
      for (const o of cars) {
        if (o === c) continue; const ox = o.x - c.x, oz = o.z - c.z, f = ox * dx + oz * dz;
        if (f > 0 && f < 16) { const lat = Math.abs(ox * dz - oz * dx); if (lat < 2.4) want = Math.min(want, Math.max(0, (f - 6) * 0.8)); }
      }
      { const ox = player.x - c.x, oz = player.z - c.z, f = ox * dx + oz * dz; if (f > 0 && f < 18 && Math.abs(ox * dz - oz * dx) < 2.6) { want = Math.min(want, Math.max(0, (f - 6) * 0.7));
        // blocked by you: a polite pause, then the horn
        if (c.speed < 1 && player.speed < 1) { c.honk = (c.honk || 0) + dt; if (c.honk > 1.6) { c.honk = -3; if (this.onHonk) this.onHonk(); } } } }
      if (tornado && Math.hypot(c.x - tornado.x, c.z - tornado.z) < 90) want = Math.max(want, Math.min(c.cruise * 1.6, want + 6));   // panic
      c.speed += Math.max(-14 * dt, Math.min(4 * dt, want - c.speed));
      if (c.mode === 'lane') {
        c.s += c.speed * dt; if (c.s >= SEG) { c.s = SEG; this.startTurn(c); }
        this.lanePos(c);
      } else {
        const T = c.turn; c.t += c.speed * dt / T.len;
        if (c.t >= 1) { c.i += L.DIRS[T.nd][0]; c.j += L.DIRS[T.nd][1]; c.d = T.nd; c.s = 0; c.mode = 'lane'; if (!L.nodeOk(c.i, c.j)) { this.place(c, player); continue; } this.lanePos(c); }
        else { const t = c.t, u = 1 - t; c.x = u * u * T.E[0] + 2 * u * t * T.K[0] + t * t * T.X[0]; c.z = u * u * T.E[1] + 2 * u * t * T.K[1] + t * t * T.X[1];
          const tx = 2 * u * (T.K[0] - T.E[0]) + 2 * t * (T.X[0] - T.K[0]), tz = 2 * u * (T.K[1] - T.E[1]) + 2 * t * (T.X[1] - T.K[1]); c.yaw = Math.atan2(tx, tz); }
      }
      c.y = 0;
      // the player rams this car
      const px = c.x - player.x, pz = c.z - player.z, pd = Math.hypot(px, pz);
      if (pd < 3.3 && player.y < 2) {
        const rel = Math.hypot(player.vx - Math.sin(c.yaw) * c.speed, player.vz - Math.cos(c.yaw) * c.speed);
        this.launch(c, 'shove', player.vx * 0.7 + px / pd * 4, player.vz * 0.7 + pz / pd * 4, Math.min(6, rel * 0.15));
        player.vx *= 0.55; player.vz *= 0.55; player.x -= px / pd * (3.3 - pd); player.z -= pz / pd * (3.3 - pd);
        player.impact = Math.max(player.impact, rel * 0.8);
        if (fx) fx.burst((c.x + player.x) / 2, 0.9, (c.z + player.z) / 2, 24, 7, { life: 0.5, size: 0.35, grow: -0.5, drag: 2, grav: 9, r: 1, g: 0.75, b: 0.3, add: 1 });
        if (onHit) onHit(rel); c.nm = 2;
      }
      // near miss: armed when you pass within 5.6 m at speed, paid out once you're clear without touching it
      else if (!c.nm && pd < 5.6 && player.y < 2 && player.speed > 16) c.nm = 1;
      else if (c.nm === 1 && pd > 7) { c.nm = 2; if (this.onNear) this.onNear(c); }
      else if (c.nm === 2 && pd > 25) c.nm = 0;
    }
    // draw
    for (const c of cars) {
      _e.set(c.pitch || 0, c.yaw, c.roll || 0, 'YXZ'); _q.setFromEuler(_e); _p.set(c.x, c.y, c.z); _m.compose(_p, _q, _s);
      this.body.setMatrixAt(c.k, _m); this.lights.setMatrixAt(c.k, _m);
    }
    this.body.instanceMatrix.needsUpdate = this.lights.instanceMatrix.needsUpdate = true;
  }
  launch(c, mode, vx, vz, up) {
    c.mode = mode; c.t = 0;
    if (mode === 'fly') { c.vx = Math.sin(c.yaw) * c.speed; c.vz = Math.cos(c.yaw) * c.speed; c.vy = 9 + this.rng() * 5; c.spinV = (this.rng() - 0.5) * 8; c.rollV = (this.rng() - 0.5) * 5; c.pitchV = (this.rng() - 0.5) * 4; }
    else { c.vx = vx; c.vz = vz; c.vy = up; c.spinV = (this.rng() - 0.5) * 6; c.rollV = (this.rng() - 0.5) * 2; c.pitchV = 0; }
  }
  // lift everything inside a radius (used by the low-gravity event for a floaty moment)
  nearest(x, z) { let best = null, bd = 1e9; for (const c of this.cars) { const d = Math.hypot(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } } return best; }
}
