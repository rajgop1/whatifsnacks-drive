// Things a scenario puts in the city: data packets to collect, the data tornado, physics cube rain (data cubes or car-sized ice), chaos drones.
import * as THREE from 'three';
import * as L from './layout.js';
import { canvas, tex, bakeColored, M4, makeRng } from './util.js';
import { blobShadow } from './car.js';
import { heliGeometry, rotorGeometry } from './models.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _ax = new THREE.Vector3();

function dataCubeTextures() {
  const c = canvas(128), e = canvas(128), g = c.getContext('2d'), ge = e.getContext('2d');
  g.fillStyle = '#1b2148'; g.fillRect(0, 0, 128, 128); ge.fillStyle = '#000'; ge.fillRect(0, 0, 128, 128);
  for (const ctx of [g, ge]) { ctx.strokeStyle = '#ffd84d'; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 120, 120); }
  ge.fillStyle = '#ffb347'; g.fillStyle = '#ffd84d'; g.font = ge.font = 'bold 18px monospace';
  const r = makeRng(5); for (let y = 0; y < 4; y++) { const s = Array.from({ length: 6 }, () => (r() < 0.5 ? '0' : '1')).join(''); g.fillText(s, 22, 34 + y * 24); ge.globalAlpha = 0.6; ge.fillText(s, 22, 34 + y * 24); ge.globalAlpha = 1; }
  return { map: tex(c, { repeat: false }), emissive: tex(e, { repeat: false }) };
}

// ---------------------------------------------------------------- packets
export class Packets {
  constructor(scene) {
    const T = dataCubeTextures(); this.n = 0; this.list = [];
    this.cube = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 1.5, 1.5), new THREE.MeshStandardMaterial({ map: T.map, emissiveMap: T.emissive, emissive: 0xffffff, emissiveIntensity: 1.5, roughness: 0.4 }), 32);
    const bg = new THREE.CylinderGeometry(0.9, 1.6, 34, 12, 1, true); bg.translate(0, 17, 0);
    this.beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.75, 0.25), transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    this.beam = new THREE.InstancedMesh(bg, this.beamMat, 32);
    this.ring = new THREE.InstancedMesh(new THREE.RingGeometry(2.4, 3.1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.05, 0.3), transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }), 32);
    for (const m of [this.cube, this.beam, this.ring]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
  }
  set(points) { this.list = points.map(([x, z]) => ({ x, z, got: false })); }
  get remaining() { return this.list.filter((p) => !p.got).length; }
  nextIndex() { return this.list.findIndex((p) => !p.got); }
  update(dt, time, car, onCollect) {
    let k = 0;
    for (let i = 0; i < this.list.length; i++) {
      const p = this.list[i]; if (p.got) continue;
      if (Math.hypot(car.x - p.x, car.z - p.z) < 5.5 && car.y < 10) { p.got = true; onCollect(p, i); continue; }
      const bob = Math.sin(time * 3 + i) * 0.3, big = i === this.nextIndex() ? 1.25 : 1;
      _e.set(time * 0.9 + i, time * 1.4 + i, 0); _q.setFromEuler(_e); _p.set(p.x, 2.2 + bob, p.z); _s.setScalar(big); _m.compose(_p, _q, _s); this.cube.setMatrixAt(k, _m);
      _q.identity(); _p.set(p.x, 0, p.z); _s.set(1, 1, 1); _m.compose(_p, _q, _s); this.beam.setMatrixAt(k, _m);
      _p.y = 0.08; _s.setScalar(1 + 0.15 * Math.sin(time * 5 + i)); _m.compose(_p, _q, _s); this.ring.setMatrixAt(k, _m);
      k++;
    }
    for (const m of [this.cube, this.beam, this.ring]) { m.count = k; m.instanceMatrix.needsUpdate = true; }
  }
}

// ---------------------------------------------------------------- the data tornado
export class Tornado {
  constructor(scene) {
    const c = canvas(256), g = c.getContext('2d'); g.clearRect(0, 0, 256, 256);
    for (let i = 0; i < 220; i++) { const y = Math.random() * 256, x = Math.random() * 256, w = 20 + Math.random() * 90; g.fillStyle = Math.random() < 0.12 ? `rgba(255,216,77,${0.5 + Math.random() * 0.5})` : `rgba(${200 + Math.random() * 40},${170 + Math.random() * 40},${200 + Math.random() * 30},${0.08 + Math.random() * 0.25})`; g.fillRect(x, y, w, 1 + Math.random() * 3); g.fillRect(x - 256, y, w, 2); }
    const t = tex(c); this.group = new THREE.Group(); this.layers = [];
    for (let k = 0; k < 3; k++) {
      const geo = new THREE.CylinderGeometry(16 + k * 4, 3 + k * 1.5, 80, 24, 6, true); geo.translate(0, 40, 0);
      const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i), w = Math.sin(y * 0.06 + k) * (y * 0.05); p.setX(i, p.getX(i) + w); }
      const m = new THREE.MeshBasicMaterial({ map: t.clone(), transparent: true, opacity: 0.75 - k * 0.15, depthWrite: false, side: THREE.DoubleSide, color: k === 0 ? 0xd8c8e0 : 0xb8a8c8 });
      m.map.repeat.set(2 + k, 1); m.map.needsUpdate = true; const mesh = new THREE.Mesh(geo, m); this.group.add(mesh); this.layers.push(mesh);
    }
    const bits = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.6, 0.4), toneMapped: false }), 60);
    this.bits = bits; this.group.add(bits); this.bitData = Array.from({ length: 60 }, () => [Math.random() * 6.28, Math.random() * 70, 4 + Math.random() * 16, 0.6 + Math.random()]);
    this.shadow = blobShadow(40, 40, 0.5); scene.add(this.shadow);
    this.group.visible = this.shadow.visible = false; scene.add(this.group); this.active = false; this.r = 13; this.rng = makeRng(77);
  }
  spawn(x, z, i, j) { this.cool = 0; this.holding = false; this.active = true; this.x = x; this.z = z; this.i = i; this.j = j; this.target = null; this.group.visible = this.shadow.visible = true; this.grow = 0; }
  hide() { this.active = false; this.group.visible = this.shadow.visible = false; }
  update(dt, time, car, fx) {
    if (!this.active) return;
    this.grow = Math.min(1, this.grow + dt * 0.8);
    // wander node to node, leaning toward the player
    if (!this.target) {
      const ex = L.exits(this.i, this.j); let best = ex[0], bs = -1e9;
      for (const d of ex) { const nx = (this.i + L.DIRS[d][0]) * L.P, nz = (this.j + L.DIRS[d][1]) * L.P, s = (this.cool > 0 ? 1 : -0.6) * Math.hypot(nx - car.x, nz - car.z) + this.rng() * 120; if (s > bs) { bs = s; best = d; } }
      this.i += L.DIRS[best][0]; this.j += L.DIRS[best][1]; this.target = [this.i * L.P, this.j * L.P];
    }
    const dx = this.target[0] - this.x, dz = this.target[1] - this.z, d = Math.hypot(dx, dz), sp = 7.5;
    if (d < 1) this.target = null; else { this.x += dx / d * Math.min(d, sp * dt); this.z += dz / d * Math.min(d, sp * dt); }
    this.group.position.set(this.x, 0, this.z); this.group.scale.set(this.grow, this.grow, this.grow);
    this.layers.forEach((m, k) => { m.rotation.y = time * (2.2 - k * 0.5); m.material.map.offset.y = time * 0.1 * (k + 1); });
    for (let i = 0; i < 60; i++) { const b = this.bitData[i], a = b[0] + time * (3.5 - b[1] * 0.03), h = (b[1] + time * 8 * b[3]) % 70, rr = b[2] * (0.3 + h / 70); _e.set(time * b[3], a, 0); _q.setFromEuler(_e); _p.set(Math.cos(a) * rr, h, Math.sin(a) * rr); _s.setScalar(b[3]); _m.compose(_p, _q, _s); this.bits.setMatrixAt(i, _m); }
    this.bits.instanceMatrix.needsUpdate = true;
    this.shadow.position.set(this.x, 0.05, this.z);
    if (fx && Math.random() < dt * 40) { const a = Math.random() * 6.28, rr = 4 + Math.random() * 8; fx.emit(this.x + Math.cos(a) * rr, 0.5, this.z + Math.sin(a) * rr, -Math.sin(a) * 9, 2 + Math.random() * 4, Math.cos(a) * 9, { life: 1.6, size: 3, grow: 2, drag: 1, r: 0.8, g: 0.72, b: 0.7 }); }
    // lift the player
    this.cool -= dt;
    const px = car.x - this.x, pz = car.z - this.z, pd = Math.hypot(px, pz);
    if (this.holding && (pd > this.r * this.grow || car.y >= 14)) { this.holding = false; this.cool = 8; this.target = null; }   // one ride per visit
    if (pd < this.r * this.grow && car.y < 14 && (this.cool <= 0 || this.holding)) { this.holding = true;
      car.lift = 26; car.air = true; car.spin = 5;
      car.vx += (-pz / pd * 18 - px / pd * 4) * dt; car.vz += (px / pd * 18 - pz / pd * 4) * dt; return true;
    }
    car.lift = 0; return false;
  }
}

// ---------------------------------------------------------------- cube rain: data cubes or car-sized ice
const MAXC = 70;
export class Cubes {
  constructor(scene) {
    const T = dataCubeTextures();
    this.data = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: T.map, emissiveMap: T.emissive, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: 0.5 }), MAXC);
    this.ice = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1, 1, 1, 1), new THREE.MeshStandardMaterial({ color: 0xcdeeff, roughness: 0.04, metalness: 0.15, transparent: true, opacity: 0.78, envMapIntensity: 2.2, emissive: 0x2a5a7a, emissiveIntensity: 0.3 }), MAXC);
    for (const m of [this.data, this.ice]) { m.count = 0; m.castShadow = true; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(m); }
    this.pool = Array.from({ length: MAXC * 2 }, () => ({ on: false, q: new THREE.Quaternion(), flat: new THREE.Quaternion() }));
    this.queue = []; this.rng = makeRng(31);
  }
  rain(kind, count, every, size, t0) { for (let k = 0; k < count; k++) this.queue.push({ at: t0 + k * every, kind, size }); }
  spawn(kind, size, car) {
    const c = this.pool.find((p) => !p.on) || this.pool.reduce((a, b) => (a.age > b.age ? a : b));
    const sp = Math.max(8, car.speed), ahead = 18 + this.rng() * 40 + sp * 0.8, side = (this.rng() - 0.5) * 26, fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
    c.on = true; c.kind = kind; c.s = size * (0.8 + this.rng() * 0.4); c.x = car.x + fx * ahead + fz * side; c.z = car.z + fz * ahead - fx * side; c.y = 38 + this.rng() * 20;
    c.vx = 0; c.vz = 0; c.vy = -10; c.age = 0; c.rest = false;
    _ax.set(this.rng() - 0.5, this.rng() - 0.5, this.rng() - 0.5).normalize(); c.ax = _ax.clone(); c.w = 2 + this.rng() * 3; c.q.setFromAxisAngle(c.ax, this.rng() * 6); c.flat.setFromEuler(_e.set(0, this.rng() * 6, 0));
  }
  update(dt, time, env, car, traffic, fx, onHit) {
    for (let i = this.queue.length - 1; i >= 0; i--) if (time >= this.queue[i].at) { this.spawn(this.queue[i].kind, this.queue[i].size, car); this.queue.splice(i, 1); }
    let kd = 0, ki = 0;
    for (const c of this.pool) {
      if (!c.on) continue; c.age += dt;
      if (Math.hypot(c.x - car.x, c.z - car.z) > 260 && c.age > 3) { c.on = false; continue; }
      const half = c.s / 2, gy = L.groundY(c.x, c.z);
      c.vy -= env.g * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      if (c.y - half <= gy) {
        if (c.vy < -8) { if (fx) fx.burst(c.x, gy + 0.3, c.z, c.kind === 'ice' ? 22 : 10, c.kind === 'ice' ? 8 : 5, c.kind === 'ice' ? { life: 0.9, size: 0.9, grow: 1, drag: 2, grav: 8, r: 0.85, g: 0.95, b: 1 } : { life: 0.8, size: 1.4, grow: 2, drag: 3, r: 0.85, g: 0.8, b: 0.78 }, 0.3); c.impactT = 0.3; }
        c.y = gy + half; c.vy = Math.abs(c.vy) * 0.22; if (c.vy < 1) c.vy = 0;
        const k = Math.exp(-(c.kind === 'ice' ? 0.8 : 3) * dt); c.vx *= k; c.vz *= k;
        c.q.slerp(c.flat, Math.min(1, dt * 6)); c.rest = true;
      } else { c.rest = false; _q.setFromAxisAngle(c.ax, c.w * dt); c.q.premultiply(_q); }
      const h = L.collideCircle(c.x, c.z, half * 0.9, c.y); if (h.hit) { c.x = h.x; c.z = h.z; const vn = c.vx * h.nx + c.vz * h.nz; if (vn < 0) { c.vx -= 1.4 * vn * h.nx; c.vz -= 1.4 * vn * h.nz; } }
      // against the player's car
      const dx = c.x - car.x, dz = c.z - car.z, d = Math.hypot(dx, dz) || 1, R = half * 0.95 + 1.5;
      if (d < R && car.y < c.y + half && car.y + 1.4 > c.y - half) {
        const nx = dx / d, nz = dz / d, rel = (car.vx - c.vx) * nx + (car.vz - c.vz) * nz;
        if (c.kind === 'ice') { // ~59 t: you bounce off it
          car.x -= nx * (R - d); car.z -= nz * (R - d);
          if (rel > 0) { car.vx -= 1.4 * rel * nx; car.vz -= 1.4 * rel * nz; c.vx += rel * nx * 0.05; c.vz += rel * nz * 0.05; car.impact = Math.max(car.impact, rel); if (rel > 5 && onHit) onHit(rel, c); }
        } else {
          c.x += nx * (R - d); c.z += nz * (R - d);
          if (rel > 0) { c.vx += nx * rel * 1.3 + car.vx * 0.2; c.vz += nz * rel * 1.3 + car.vz * 0.2; c.vy += rel * 0.35; car.vx *= 0.9; car.vz *= 0.9; car.impact = Math.max(car.impact, rel * 0.4);
            if (rel > 12 && !car.air) { car.vy = 3 + rel * 0.12; car.air = true; } if (onHit && rel > 6) onHit(rel * 0.5, c); }
        }
      }
      // falling on top of the car
      if (c.vy < -6 && Math.abs(dx) < half + 1 && Math.abs(dz) < half + 1.5 && c.y - half < car.y + 1.6 && c.y > car.y) { c.vy = 6; c.vx += dx * 2; c.vz += dz * 2; car.impact = Math.max(car.impact, 10); if (onHit) onHit(8, c); }
      // AI cars bump into cubes
      if (traffic && c.rest) for (const t of traffic.cars) { if (t.mode !== 'lane' && t.mode !== 'turn') continue; if (Math.abs(t.x - c.x) < half + 1.4 && Math.abs(t.z - c.z) < half + 1.4) traffic.launch(t, 'shove', (t.x - c.x) * 1.5, (t.z - c.z) * 1.5, 2); }
      _p.set(c.x, c.y, c.z); _s.setScalar(c.s); _m.compose(_p, c.q, _s);
      if (c.kind === 'ice') this.ice.setMatrixAt(ki++, _m); else this.data.setMatrixAt(kd++, _m);
    }
    this.data.count = kd; this.ice.count = ki; this.data.instanceMatrix.needsUpdate = this.ice.instanceMatrix.needsUpdate = true;
  }
  clear() { for (const c of this.pool) c.on = false; this.queue.length = 0; }
  clearNear(x, z, r, fx) { let n = 0; for (const c of this.pool) if (c.on && Math.hypot(c.x - x, c.z - z) < r) { c.on = false; n++; if (fx) fx.burst(c.x, c.y, c.z, 10, 5, { life: 0.6, size: 0.4, grow: -0.5, drag: 2, r: 1, g: 0.85, b: 0.3, add: 1 }); } return n; }
}

// ---------------------------------------------------------------- chaos drones (original design: a navy puck with four warm rotors and an amber eye)
export class Drones {
  constructor(scene) {
    const g = bakeColored([[new THREE.SphereGeometry(0.7, 14, 8), 0x1e2a5a, M4(0, 0, 0, 0, 0, 0, 1, 0.45, 1)], [new THREE.BoxGeometry(2.6, 0.12, 0.18), 0x2a2838, M4(0, 0, 0, 0, Math.PI / 4)], [new THREE.BoxGeometry(2.6, 0.12, 0.18), 0x2a2838, M4(0, 0, 0, 0, -Math.PI / 4)],
      ...[[0.92, 0.92], [-0.92, 0.92], [0.92, -0.92], [-0.92, -0.92]].map(([x, z]) => [new THREE.CylinderGeometry(0.5, 0.5, 0.05, 12), 0xffb347, M4(x, 0.12, z)])]);
    this.mesh = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.4 }), 6);
    this.eye = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.2, 0.2), toneMapped: false }), 6);
    for (const m of [this.mesh, this.eye]) { m.count = 0; m.frustumCulled = false; scene.add(m); }
    this.list = Array.from({ length: 6 }, () => ({ on: false })); this.hits = 0;
  }
  setCount(n, car) {
    this.list.forEach((d, i) => { if (i < n && !d.on) { const a = Math.random() * 6.28; Object.assign(d, { on: true, x: car.x + Math.cos(a) * 90, y: 35, z: car.z + Math.sin(a) * 90, vx: 0, vy: 0, vz: 0, cool: 1.5 }); } if (i >= n) d.on = false; });
  }
  update(dt, time, car, fx, onZap) {
    let k = 0;
    for (const d of this.list) {
      if (!d.on) continue;
      d.cool -= dt;
      const tx = car.x + car.vx * 0.4, tz = car.z + car.vz * 0.4, ty = car.y + (d.cool > 0 ? 9 : 2.2), dx = tx - d.x, dy = ty - d.y, dz = tz - d.z, dist = Math.hypot(dx, dy, dz) || 1, max = d.cool > 0 ? 18 : 31;
      d.vx += (dx / dist * max - d.vx) * 2.2 * dt; d.vy += (dy / dist * max - d.vy) * 2.2 * dt; d.vz += (dz / dist * max - d.vz) * 2.2 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      if (L.insideSolid(d.x, d.y, d.z)) { d.y += 40 * dt; d.vy = Math.max(d.vy, 8); }
      d.y = Math.max(d.y, L.groundY(d.x, d.z) + 1.2);
      if (d.cool <= 0 && Math.hypot(car.x - d.x, car.z - d.z) < 3.4 && Math.abs(car.y + 1 - d.y) < 2.6) {
        d.cool = 3; d.vx = -d.vx * 0.5 + (Math.random() - 0.5) * 10; d.vy = 12; d.vz = -d.vz * 0.5; car.vx *= 0.45; car.vz *= 0.45; car.impact = Math.max(car.impact, 7); this.hits++;
        if (fx) fx.burst(d.x, d.y, d.z, 30, 9, { life: 0.5, size: 0.4, grow: -0.5, drag: 2, grav: 6, r: 1, g: 0.7, b: 0.2, add: 1 });
        if (onZap) onZap();
      }
      _e.set(d.vz * 0.02, time * 0.5, -d.vx * 0.02); _q.setFromEuler(_e); _p.set(d.x, d.y + Math.sin(time * 6 + k) * 0.15, d.z); _s.set(1, 1, 1); _m.compose(_p, _q, _s); this.mesh.setMatrixAt(k, _m);
      _p.y -= 0.2; _m.compose(_p, _q, _s); this.eye.setMatrixAt(k, _m); k++;
    }
    this.mesh.count = this.eye.count = k; this.mesh.instanceMatrix.needsUpdate = this.eye.instanceMatrix.needsUpdate = true;
    this.eye.material.color.setRGB(Math.sin(time * 14) > 0 ? 3.5 : 1.2, 0.9, 0.15);
  }
}

// ---------------------------------------------------------------- the chaos helicopter: shows up at 2+ pips, circles you with a searchlight
export class Heli {
  constructor(scene) {
    this.g = new THREE.Group(); const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.4 });
    this.g.add(new THREE.Mesh(heliGeometry(), mat)); this.rotor = new THREE.Mesh(rotorGeometry(11, 0.35), mat); this.rotor.position.y = 3.35; this.g.add(this.rotor);
    this.tail = new THREE.Mesh(rotorGeometry(1.8, 0.15), mat); this.tail.rotation.z = Math.PI / 2; this.tail.position.set(0.25, 2.5, -5.8); this.g.add(this.tail);
    const cg = new THREE.CylinderGeometry(0.3, 4.5, 1, 20, 1, true); cg.translate(0, -0.5, 0);
    this.cone = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide }));
    this.pool = new THREE.Mesh(new THREE.CircleGeometry(4.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    scene.add(this.g, this.cone, this.pool); this.g.visible = this.cone.visible = this.pool.visible = false; this.x = 0; this.y = 160; this.z = 0; this.on = false; this.a = 0;
  }
  update(dt, time, car, active) {
    if (active && !this.on) { this.on = true; this.x = car.x - 300; this.z = car.z - 300; this.y = 120; }
    if (!this.on) return;
    this.a += dt * 0.35;
    // hold station ahead of the car, low over the street, so it sits in the upper part of the chase-camera frame
    // (a slow weave along the travel axis, not a wide circle that would put it inside the towers or behind the camera)
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw), ah = 50 + Math.cos(this.a) * 6, sd = Math.sin(this.a * 1.3) * 3;
    const tx = active ? car.x + fx * ah + fz * sd : car.x + 700, tz = active ? car.z + fz * ah - fx * sd : car.z - 700;
    let ty = active ? 12.5 + Math.sin(this.a * 0.7) * 1.5 : 180;
    const dx = tx - this.x, dz = tz - this.z, d = Math.hypot(dx, dz), sp = Math.min(d, (8 + d * 0.9) * dt), ux = dx / (d || 1), uz = dz / (d || 1);
    // towers: look 25 m along the flight path; climb (20 m/s) before moving on, and hold back from anything over 70 m
    const nx = this.x + ux * sp, nz = this.z + uz * sp, need = Math.max(Heli.clearY(nx, nz, ty), Heli.clearY(this.x + ux * 25, this.z + uz * 25, ty));
    if (need <= 70) { ty = Math.max(ty, need); if (this.y >= Heli.clearY(nx, nz, this.y) - 0.01) { this.x = nx; this.z = nz; } }
    if (Heli.clearY(this.x, this.z, this.y) > this.y) ty = Math.max(ty, Heli.clearY(this.x, this.z, this.y));   // already inside: get out upward
    this.y += ty > this.y ? Math.min(ty - this.y, 20 * dt) : (ty - this.y) * Math.min(1, dt * 0.8);
    if (!active && Math.hypot(this.x - car.x, this.z - car.z) > 650) { this.on = false; this.g.visible = this.cone.visible = this.pool.visible = false; return; }
    this.g.visible = true; this.g.position.set(this.x, this.y, this.z);
    const vx = dx / (d || 1), vz = dz / (d || 1); this.g.rotation.set(0.12 * Math.min(1, d / 30), Math.atan2(vx, vz), -0.1, 'YXZ');
    this.rotor.rotation.y = time * 32; this.tail.rotation.x = time * 50;
    // searchlight from the nose down to the car
    const lit = active && Math.hypot(this.x - car.x, this.z - car.z) < 120; this.cone.visible = this.pool.visible = lit;
    if (lit) { _p.set(this.x, this.y + 0.6, this.z); this.cone.position.copy(_p); _s.set(car.x - this.x, car.y - this.y, car.z - this.z); const len = _s.length(); this.cone.scale.set(1, len, 1); _ax.set(0, -1, 0); _q.setFromUnitVectors(_ax, _s.normalize()); this.cone.quaternion.copy(_q); this.pool.position.set(car.x, car.y + 0.08, car.z); }
  }
  get dist() { return this.on ? this.y : 1e9; }
  // the lowest height >= y where the body and rotor tips (5.5 m) are clear of solids
  static clearY(x, z, y) {
    const hit = (h) => [[0, 0], [5.5, 0], [-5.5, 0], [0, 5.5], [0, -5.5]].some(([ox, oz]) => L.insideSolid(x + ox, h - 1.5, z + oz));
    for (let k = 0; k < 40 && hit(y); k++) y += 5;
    return y;
  }
}
