// The player's arcade car: bicycle-ish handling with lateral grip (handbrake drifts), suspension feel, airtime, wall bounces,
// tyre smoke, headlight cones, a blob shadow, and the hoodie mascot at the wheel.
import * as THREE from 'three';
import { carGeometry, carLightsGeometry, mascotParts, tintMaterial } from './models.js';
import { clamp, damp, radial, tex, bakeColored, M4 } from './util.js';
import * as L from './layout.js';

const WHEEL = new THREE.CylinderGeometry(0.37, 0.37, 0.28, 22).rotateZ(Math.PI / 2);
// five-spoke rim (baked), turned so the axle is x; the outer face sits at +x and is mirrored for the left side
const rimGeo = (side) => { const parts = [[new THREE.CylinderGeometry(0.26, 0.26, 0.04, 22), 0xd8dbe6, M4(side * 0.13, 0, 0, 0, 0, Math.PI / 2)], [new THREE.CylinderGeometry(0.24, 0.24, 0.05, 22), 0x2a2a33, M4(side * 0.115, 0, 0, 0, 0, Math.PI / 2)], [new THREE.CylinderGeometry(0.06, 0.06, 0.07, 10), 0xe8eaf0, M4(side * 0.15, 0, 0, 0, 0, Math.PI / 2)]];
  for (let k = 0; k < 5; k++) parts.push([new THREE.BoxGeometry(0.05, 0.05, 0.24), 0xe0e3ec, M4(side * 0.145, 0, 0, k / 5 * Math.PI * 2, 0, 0).multiply(M4(0, 0, 0.12))]);
  return bakeColored(parts); };
const RIMS = { '-1': rimGeo(-1), '1': rimGeo(1) };
const blobTex = (() => tex(radial(128, [[0, 'rgba(0,0,0,0.75)'], [0.55, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]), { repeat: false, srgb: false }))();

export function blobShadow(w, l, opacity = 0.6) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity, polygonOffset: true, polygonOffsetFactor: -6 }));
  m.renderOrder = 1; return m;
}

export class Car {
  constructor(scene, { paint = 0xff6b57, quality = 'medium' } = {}) {
    this.root = new THREE.Group(); this.body = new THREE.Group(); this.root.add(this.body); scene.add(this.root);
    const paintMat = quality === 'low' ? tintMaterial({ roughness: 0.3, metalness: 0.5 }) : tintMaterial({ roughness: 0.25, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.08 }, THREE.MeshPhysicalMaterial);
    const geo = carGeometry({ wheels: false });   // wheels are separate meshes so they spin and steer
    const bodyMesh = new THREE.Mesh(geo, paintMat); bodyMesh.castShadow = true;
    const c = geo.attributes.color, col = new THREE.Color(paint);
    for (let i = 0; i < c.count; i++) if (c.getX(i) + c.getY(i) + c.getZ(i) > 2.99) c.setXYZ(i, col.r, col.g, col.b);   // bake the paint
    this.paintAttr = c; this.body.add(bodyMesh);
    this.lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); this.lightMat.color.setScalar(2.2);
    this.body.add(new THREE.Mesh(carLightsGeometry(), this.lightMat));
    const tyre = new THREE.MeshStandardMaterial({ color: 0x1a1920, roughness: 0.85 }), rim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.85 }), caliper = new THREE.MeshStandardMaterial({ color: 0xff5a3a, roughness: 0.5 });
    this.wheels = [];
    for (const [x, z] of [[-0.86, 1.42], [0.86, 1.42], [-0.86, -1.42], [0.86, -1.42]]) {
      const piv = new THREE.Group(); piv.position.set(x, 0.37, z); const w = new THREE.Group(); w.add(new THREE.Mesh(WHEEL, tyre), new THREE.Mesh(RIMS[x > 0 ? '1' : '-1'], rim)); piv.add(w); const cal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.12), caliper); cal.position.set(Math.sign(x) * 0.08, 0.12, -0.12); piv.add(cal); this.root.add(piv); this.wheels.push({ piv, w, front: z > 0 });
    }
    // the mascot driving (seen through the glass)
    const mp = mascotParts(0xff6b57), mm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
    const driver = new THREE.Mesh(mp.torso, mm); driver.scale.setScalar(0.62); driver.position.set(-0.38, 0.12, -0.2); this.body.add(driver);
    // headlight beams (cheap additive cones)
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const bg = new THREE.ConeGeometry(2.4, 16, 16, 1, true); bg.translate(0, -8, 0); bg.rotateX(-Math.PI / 2);
    for (const s of [-1, 1]) { const b = new THREE.Mesh(bg, beamMat); b.position.set(s * 0.62, 0.68, 2.35); b.rotation.x = 0.06; this.body.add(b); }
    this.beamMat = beamMat;
    this.shadow = blobShadow(2.8, 5.6); scene.add(this.shadow);
    if (quality === 'high') { const sl = new THREE.SpotLight(0xffe2c0, 60, 60, 0.5, 0.6, 1.4); sl.position.set(0, 0.8, 2.2); sl.target.position.set(0, 0, 14); this.body.add(sl, sl.target); }
    this.reset(L.SPAWN.x, L.SPAWN.z, L.SPAWN.yaw);
  }
  reset(x, z, yaw) {
    this.x = x; this.z = z; this.y = L.groundY(x, z); this.vy = 0; this.yaw = yaw; this.vx = 0; this.vz = 0; this.yawRate = 0; this.steer = 0;
    this.pitch = 0; this.roll = 0; this.bob = 0; this.bobV = 0; this.air = false; this.airT = 0; this.spin = 0; this.wheelRot = 0;
    this.impact = 0; this.lastSafe = [x, z, yaw]; this.offroad = 0; this.drift = 0; this.speed = 0; this.vf = 0; this.braking = false; this.lift = 0;
  }
  // inp: { steer -1..1 (right +), throttle 0..1, brake 0..1, handbrake bool }; env: { g, grip }
  update(dt, inp, env, fx) {
    const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), fx_ = sy, fz = cy, rx = -cy, rz = sy;
    let vf = this.vx * fx_ + this.vz * fz, vl = this.vx * rx + this.vz * rz;
    this.steer = damp(this.steer, inp.steer, 10, dt);
    const ground = !this.air;
    if (ground) {
      const VMAX = 46;
      if (inp.throttle > 0 && vf > -0.5) vf += inp.throttle * (inp.launch ? 26 : 15) * Math.max(0, 1 - vf / VMAX) * dt;   // launch: a hard first 1.5 s
      if (inp.brake > 0) { if (vf > 0.6) vf -= 30 * inp.brake * dt; else vf = Math.max(-12, vf - 9 * inp.brake * dt); }
      if (inp.throttle > 0 && vf < 0 && !inp.brake) vf += 20 * dt;
      vf -= vf * (0.12 + (inp.handbrake ? 0.9 : 0)) * dt;
      if (!inp.throttle && !inp.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 3 * dt);
      const grip = (inp.handbrake ? 1.4 : 8.5) * env.grip;
      vl *= Math.exp(-grip * dt);
      const maxSteer = 0.58 - 0.38 * clamp(Math.abs(vf) / 40, 0, 1);
      let target = -vf * Math.tan(this.steer * maxSteer) / 2.7;
      if (inp.handbrake && Math.abs(vf) > 6) target *= 1.5;
      this.yawRate = damp(this.yawRate, target, 9, dt);
      this.drift = Math.abs(vl);
    } else {
      this.yawRate = damp(this.yawRate, this.spin, 2, dt);
      this.airT += dt;
    }
    // velocity stays in the old heading's frame: the body turns first and grip drags the velocity round next step,
    // so the car carries a real slip angle (small at full grip, a proper slide on the handbrake or ice)
    this.vx = sy * vf - cy * vl; this.vz = cy * vf + sy * vl;
    this.yaw += this.yawRate * dt;
    const s2 = Math.sin(this.yaw), c2 = Math.cos(this.yaw);
    this.x += this.vx * dt; this.z += this.vz * dt;
    // vertical: gravity, ground, tornado lift
    // a flight is capped: after 3 s aloft gravity ramps up (the tornado ride on the moon event gave 30 s and 220 m with no steering)
    const extraG = this.air ? Math.min(60, Math.max(0, this.airT - 3) * 16) : 0;
    this.vy -= (env.g + extraG) * dt; this.vy += this.lift * dt; this.y += this.vy * dt;
    const gy = L.groundY(this.x, this.z);
    if (this.y > gy + 50) { this.y = gy + 50; this.vy = Math.min(this.vy, 0); }   // hard ceiling, 50 m over the ground
    if (this.y <= gy) {
      if (this.air && this.airT > 0.25) { this.impact = Math.max(this.impact, Math.abs(this.vy) * 0.6); this.bobV -= Math.abs(this.vy) * 0.25; if (fx) fx.burst(this.x, gy + 0.3, this.z, 14, 5, { life: 0.9, size: 1.6, grow: 2, drag: 3, r: 0.85, g: 0.8, b: 0.78 }, 0.2); }
      this.y = gy; this.vy = Math.max(0, this.vy); this.air = false; this.airT = 0; this.spin = 0;
    } else if (this.y > gy + 0.35) this.air = true;
    // walls: two circles along the body
    this.impact *= Math.exp(-6 * dt);
    for (const off of [1.25, -1.25]) {
      const cx = this.x + s2 * off, cz = this.z + c2 * off, h = L.collideCircle(cx, cz, 1.05, this.y + 0.3);
      if (!h.hit) continue;
      this.x += h.x - cx; this.z += h.z - cz;
      const vn = this.vx * h.nx + this.vz * h.nz;
      if (vn < 0) { this.vx -= 1.35 * vn * h.nx; this.vz -= 1.35 * vn * h.nz; this.vx *= 0.8; this.vz *= 0.8; this.impact = Math.max(this.impact, -vn); this.yawRate += (off > 0 ? 1 : -1) * (h.nx * c2 - h.nz * s2) * vn * 0.08;
        if (fx && -vn > 4) fx.burst(h.x - h.nx * 1.05, this.y + 0.6, h.z - h.nz * 1.05, Math.min(30, -vn * 2) | 0, 6, { life: 0.5, size: 0.35, grow: -0.5, drag: 2, grav: 9, r: 1, g: 0.75, b: 0.3, add: 1 }); }
    }
    // keep inside the playable land; the sea edge resets
    const lx0 = L.LAND.x0 + 2, lx1 = L.LAND.x1 - 2, lz0 = L.LAND.z0 + 2;
    if (this.x < lx0) { this.x = lx0; this.vx = Math.abs(this.vx) * 0.4; this.impact = Math.max(this.impact, 6); }
    if (this.x > lx1) { this.x = lx1; this.vx = -Math.abs(this.vx) * 0.4; this.impact = Math.max(this.impact, 6); }
    if (this.z < lz0) { this.z = lz0; this.vz = Math.abs(this.vz) * 0.4; this.impact = Math.max(this.impact, 6); }
    if (this.y < L.WATER_Y - 0.4 || this.z > L.BEACH.z1 - 20) { this.reset(...this.lastSafe); this.splashed = true; }
    if (!this.air && L.isRoad(this.x, this.z)) { this.offroad = 0; if (Math.hypot(this.vx, this.vz) > 4) this.lastSafeT = (this.lastSafeT || 0) + dt; if (this.lastSafeT > 1) { this.lastSafe[0] = this.x; this.lastSafe[1] = this.z; this.lastSafe[2] = this.yaw; this.lastSafeT = 0; } }
    else if (!this.air) this.offroad += dt;
    this.vf = vf; this.speed = Math.hypot(this.vx, this.vz); this.braking = inp.brake > 0 && vf > 1;
    // suspension feel: pitch from acceleration, roll from cornering, a spring for bumps
    const accel = (vf - (this.prevVf ?? vf)) / Math.max(dt, 1e-3); this.prevVf = vf;
    this.pitch = damp(this.pitch, clamp(-accel * 0.006, -0.06, 0.06), 6, dt);
    this.roll = damp(this.roll, clamp(this.yawRate * vf * 0.004, -0.07, 0.07), 6, dt);
    this.bobV += (-this.bob * 120 - this.bobV * 9) * dt; this.bob += this.bobV * dt;
    // tyre smoke while drifting or burning out
    this.burnout = !!inp.launch && !this.air && this.speed < 16;
    // (every other step and modest puffs: on a phone the chase camera sits close and big smoke buries the screen)
    if (fx && !this.air && (this.smokeT = (this.smokeT || 0) + 1) % 2 === 0 && (this.drift > 4.5 || (inp.handbrake && this.speed > 8) || this.burnout)) {
      for (const sx of [-0.86, 0.86]) { const wx = this.x + s2 * -1.42 + -c2 * sx, wz = this.z + c2 * -1.42 + s2 * sx; fx.emit(wx, this.y + 0.25, wz, (Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2, { life: 1.0, size: 0.9, grow: 2.2, drag: 1.5, r: 0.86, g: 0.82, b: 0.84 }); }
    }
  }
  render(dt) {
    this.root.position.set(this.x, this.y, this.z); this.root.rotation.set(0, this.yaw, 0);
    this.body.rotation.set(this.pitch + (this.air ? -this.vy * 0.01 : 0), 0, this.roll, 'YXZ'); this.body.position.y = this.bob;
    this.wheelRot += this.vf * dt / 0.37;
    for (const w of this.wheels) { w.w.rotation.x = this.wheelRot; if (w.front) w.piv.rotation.y = -this.steer * 0.5; }
    this.lightMat.color.setScalar(this.braking ? 3.2 : 2.2);
    const gy = L.groundY(this.x, this.z); this.shadow.position.set(this.x, gy + 0.04, this.z); this.shadow.rotation.y = this.yaw;
    const hgt = this.y - gy; this.shadow.material.opacity = 0.6 * Math.max(0.15, 1 - hgt / 10); this.shadow.scale.setScalar(1 + hgt * 0.06);
  }
}

// A translucent ghost (the friend's or your own recorded run).
export function ghostCar(scene) {
  const m = new THREE.Mesh(carGeometry(), new THREE.MeshBasicMaterial({ color: 0xffd84d, transparent: true, opacity: 0.32, depthWrite: false }));
  m.add(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 4.8).translate(0, 0.05, 0), new THREE.MeshBasicMaterial({ color: 0xffd84d, transparent: true, opacity: 0.5, depthWrite: false })));
  m.visible = false; scene.add(m); return m;
}
