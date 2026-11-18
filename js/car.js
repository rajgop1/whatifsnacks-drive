// The player's arcade car: bicycle-ish handling with lateral grip (handbrake drifts), suspension feel, airtime, wall bounces,
// tyre smoke, skid marks, headlight cones, brake lights, a blob shadow, boost, and the hoodie mascot at the wheel. The body, wheels, driver seat and handling
// numbers come from a vehicle definition (vehicles.js), so setVehicle() can swap the whole car without losing the run state.
import * as THREE from 'three';
import { carGeometry, mascotParts, tintMaterial } from './models.js';
import { VEHICLES } from './vehicles.js';
import { clamp, damp, radial, tex, bakeColored, M4 } from './util.js';
import { Skids } from './skids.js';
import * as L from './layout.js';

const WHEEL = new THREE.CylinderGeometry(0.37, 0.37, 0.28, 22).rotateZ(Math.PI / 2);   // unit wheel (r 0.37, w 0.28), scaled per vehicle
// five-spoke rim (baked), turned so the axle is x; the outer face sits at +x and is mirrored for the left side. A bright lip catches the light.
const rimGeo = (side) => { const parts = [[new THREE.CylinderGeometry(0.26, 0.26, 0.04, 22), 0xd8dbe6, M4(side * 0.13, 0, 0, 0, 0, Math.PI / 2)], [new THREE.CylinderGeometry(0.24, 0.24, 0.05, 22), 0x2a2a33, M4(side * 0.115, 0, 0, 0, 0, Math.PI / 2)], [new THREE.CylinderGeometry(0.06, 0.06, 0.07, 10), 0xe8eaf0, M4(side * 0.15, 0, 0, 0, 0, Math.PI / 2)],
  [new THREE.TorusGeometry(0.255, 0.014, 4, 24), 0xf4f6fc, M4(side * 0.152, 0, 0, 0, Math.PI / 2, 0)]];
  for (let k = 0; k < 5; k++) parts.push([new THREE.BoxGeometry(0.05, 0.05, 0.24), 0xe0e3ec, M4(side * 0.145, 0, 0, k / 5 * Math.PI * 2, 0, 0).multiply(M4(0, 0, 0.12))]);
  return bakeColored(parts); };
const RIMS = { '-1': rimGeo(-1), '1': rimGeo(1) };
const CALIPER = new THREE.BoxGeometry(0.06, 0.16, 0.12);
const SHARED = new Set([WHEEL, RIMS['-1'], RIMS['1'], CALIPER]);   // never disposed when the car is rebuilt
const blobTex = (() => tex(radial(128, [[0, 'rgba(0,0,0,0.75)'], [0.55, 'rgba(0,0,0,0.45)'], [1, 'rgba(0,0,0,0)']]), { repeat: false, srgb: false }))();
const haloTex = (() => tex(radial(64, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.5)'], [1, 'rgba(255,255,255,0)']]), { repeat: false, srgb: false }))();
const DEF = { steerRate: 10, yawDamp: 9, hbYaw: 1.5, slide: 0, roll: [0.004, 0.07], pitch: [0.006, 0.06], spring: [120, 9] };

export function blobShadow(w, l, opacity = 0.6) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity, polygonOffset: true, polygonOffsetFactor: -6 }));
  m.renderOrder = 1; return m;
}
// split a baked lamp geometry into head lamps (everything not red) and tail lamps (red), and find each side's lamp centre for the glow sprites
function splitLights(g) {
  const p = g.attributes.position.array, c = g.attributes.color.array, out = [[[], []], [[], []]], ctr = [[[0, 0, 0, 0], [0, 0, 0, 0]], [[0, 0, 0, 0], [0, 0, 0, 0]]];
  for (let t = 0; t < p.length; t += 9) {
    const red = c[t] > 0.8 && c[t + 1] < 0.3, k = red ? 1 : 0, white = c[t + 1] > 0.85;
    for (let q = 0; q < 9; q++) { out[k][0].push(p[t + q]); out[k][1].push(c[t + q]); }
    if (red || white) for (let q = 0; q < 9; q += 3) { const C = ctr[k][p[t + q] > 0 ? 1 : 0]; if ((p[t + q + 2] > 0) === !red && p[t + q + 1] < 1.6) { C[0] += p[t + q]; C[1] += p[t + q + 1]; C[2] += p[t + q + 2]; C[3]++; } }
  }
  g.dispose();
  const mk = ([P, C]) => { const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); b.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); return b; };
  const centres = (k) => ctr[k].filter((C) => C[3]).map((C) => [C[0] / C[3], C[1] / C[3], C[2] / C[3]]);
  return { head: mk(out[0]), tail: mk(out[1]), headAt: centres(0), tailAt: centres(1) };
}

export class Car {
  constructor(scene, { paint, quality = 'medium', vehicle = VEHICLES[0] } = {}) {
    this.scene = scene; this.quality = quality; this.root = new THREE.Group(); scene.add(this.root);
    this.skids = new Skids(scene);
    this.build(vehicle, paint);
    this.reset(L.SPAWN.x, L.SPAWN.z, L.SPAWN.yaw);
  }
  // (re)build every mesh from a vehicle definition
  build(v, paint = v.paint) {
    if (this.body) {
      this.root.traverse((o) => { if (o.isMesh || o.isSprite) { if (o.isMesh && o.geometry && !SHARED.has(o.geometry)) o.geometry.dispose(); const m = o.material; if (m && !m.userData.keep) m.dispose(); } });
      this.root.clear(); this.scene.remove(this.shadow); this.shadow.geometry.dispose(); this.shadow.material.dispose();
    }
    this.v = v; this.paint = paint; this.P = { ...DEF, ...v.phys }; this.body = new THREE.Group(); this.root.add(this.body);
    const quality = this.quality;
    const paintMat = quality === 'low' ? tintMaterial({ roughness: 0.3, metalness: 0.5 }) : tintMaterial({ roughness: 0.25, metalness: 0.45, clearcoat: 1, clearcoatRoughness: 0.08 }, THREE.MeshPhysicalMaterial);
    const geo = v.geo();   // wheels are separate meshes so they spin and steer
    const bodyMesh = new THREE.Mesh(geo, paintMat); bodyMesh.castShadow = true;
    const c = geo.attributes.color, col = new THREE.Color(paint);
    for (let i = 0; i < c.count; i++) if (c.getX(i) + c.getY(i) + c.getZ(i) > 2.99) c.setXYZ(i, col.r, col.g, col.b);   // bake the paint
    this.paintAttr = c; this.body.add(bodyMesh);
    if (v.glass) {   // tinted, see-through cabin glass with the sky reflected in it, so the driver shows
      const gm = new (quality === 'low' ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial)({ vertexColors: true, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.3, depthWrite: false, envMapIntensity: 1.6 });
      const gl = new THREE.Mesh(v.glass(), gm); gl.renderOrder = 2; this.body.add(gl);
    }
    // lamps: heads always lit, tails dim until the brakes go on; soft glow sprites on each lamp
    const lamps = splitLights(v.lights());
    this.lightMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); this.lightMat.color.setScalar(2.2);
    this.tailMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }); this.tailMat.color.setScalar(1.1);
    this.body.add(new THREE.Mesh(lamps.head, this.lightMat), new THREE.Mesh(lamps.tail, this.tailMat));
    this.headGlow = new THREE.SpriteMaterial({ map: haloTex, color: 0xffe6c0, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    this.tailGlow = new THREE.SpriteMaterial({ map: haloTex, color: 0xff2a3a, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
    for (const [x, y, z] of lamps.headAt.slice(0, 2)) { const s = new THREE.Sprite(this.headGlow); s.position.set(x, y, z + 0.06); s.scale.setScalar(0.75); this.body.add(s); }
    for (const [x, y, z] of lamps.tailAt.slice(0, 2)) { const s = new THREE.Sprite(this.tailGlow); s.position.set(x, y, z - 0.06); s.scale.setScalar(0.9); this.body.add(s); }
    const tyre = new THREE.MeshStandardMaterial({ color: 0x1a1920, roughness: 0.85 }), rim = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.9, envMapIntensity: 1.5 }), caliper = new THREE.MeshStandardMaterial({ color: 0xff5a3a, roughness: 0.5 });
    this.wheels = [];
    for (const [x, z, r = v.tyreR, w = 0.28] of v.wheels) {
      const piv = new THREE.Group(); piv.position.set(x, r, z); const sw = w / 0.28, sr = r / 0.37;
      const wg = new THREE.Group(); wg.add(new THREE.Mesh(WHEEL, tyre), new THREE.Mesh(RIMS[x > 0 ? '1' : '-1'], rim)); wg.scale.set(sw, sr, sr); piv.add(wg);
      const cal = new THREE.Mesh(CALIPER, caliper); cal.position.set(Math.sign(x) * 0.08 * sw, 0.12 * sr, -0.12 * sr); cal.scale.set(1, sr, sr); piv.add(cal);
      this.root.add(piv); this.wheels.push({ piv, w: wg, r, front: z > 0 });
    }
    // the mascot driving, hands on a wheel that turns (seen through the glass, or in the open on the roadster, in a clear space helmet)
    const mp = mascotParts(0xff6b57), mm = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), d = v.driver; mp.leg.dispose();
    const driver = new THREE.Group(); driver.add(new THREE.Mesh(mp.torso, mm)); driver.scale.setScalar(d.s); driver.position.set(d.x, d.y, d.z); this.body.add(driver);
    this.arms = [];
    for (const s of [-1, 1]) { const a = new THREE.Group(); a.position.set(s * 0.3, 1.36, 0.02); a.rotation.set(-1.15, 0, 0); a.add(new THREE.Mesh(s < 0 ? mp.arm : mp.arm.clone(), mm)); driver.add(a); this.arms.push(a); }
    const sw = new THREE.Group(), swMat = new THREE.MeshStandardMaterial({ color: 0x1d1c24, roughness: 0.6 });
    sw.add(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.04, 6, 20), swMat), new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.04), swMat), new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 10).rotateX(Math.PI / 2), swMat));
    sw.position.set(0, 1.12, 0.62); sw.rotation.x = -0.35; driver.add(sw); this.steeringWheel = sw;
    if (v.helmet) {
      const glass = new THREE.MeshPhysicalMaterial({ color: 0xdfeaff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.26, depthWrite: false }), white = new THREE.MeshStandardMaterial({ color: 0xf4f4f8, roughness: 0.4 });
      const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.43, 18, 14), glass); bubble.position.set(0, 1.79, 0.03); driver.add(bubble);
      const collar = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 8, 18), white); collar.rotation.x = Math.PI / 2; collar.position.set(0, 1.5, 0.02); driver.add(collar);
    }
    // headlight beams (cheap additive cones)
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe2b0, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const s of [-1, 1]) { const bg = new THREE.ConeGeometry(2.4, 16, 16, 1, true); bg.translate(0, -8, 0); bg.rotateX(-Math.PI / 2); const b = new THREE.Mesh(bg, beamMat); b.position.set(s * v.beams.x, v.beams.y, v.beams.z); b.rotation.x = 0.06; this.body.add(b); }
    this.beamMat = beamMat;
    this.shadow = blobShadow(...v.shadow); this.scene.add(this.shadow);
    if (quality === 'high') { const sl = new THREE.SpotLight(0xffe2c0, 60, 60, 0.5, 0.6, 1.4); sl.position.set(0, v.beams.y + 0.1, v.beams.z - 0.1); sl.target.position.set(0, 0, 14); this.body.add(sl, sl.target); }
  }
  setVehicle(v, paint) { if (v === this.v && paint === undefined) return; this.build(v, paint); }
  reset(x, z, yaw) {
    this.x = x; this.z = z; this.y = L.groundY(x, z); this.vy = 0; this.yaw = yaw; this.vx = 0; this.vz = 0; this.yawRate = 0; this.steer = 0;
    this.pitch = 0; this.roll = 0; this.bob = 0; this.bobV = 0; this.air = false; this.airT = 0; this.spin = 0; this.wheelRot = 0; this.wheelRotR = 0;
    this.impact = 0; this.lastSafe = [x, z, yaw]; this.offroad = 0; this.drift = 0; this.speed = 0; this.vf = 0; this.braking = false; this.lift = 0;
    this.boostE = 1; this.boosting = false; this.boostLock = false; this.skidRear = this.skidFront = false; this.handbrake = false; this.prevVf = undefined;
    if (this.skids) this.skids.cut();
  }
  // inp: { steer -1..1 (right +), throttle 0..1, brake 0..1, handbrake bool, boost bool }; env: { g, grip }
  update(dt, inp, env, fx) {
    const P = this.P, sy = Math.sin(this.yaw), cy = Math.cos(this.yaw), fx_ = sy, fz = cy, rx = -cy, rz = sy;
    let vf = this.vx * fx_ + this.vz * fz, vl = this.vx * rx + this.vz * rz;
    this.steer = damp(this.steer, inp.steer, P.steerRate, dt);
    const ground = !this.air;
    // boost: a tank that drains while held and refills when released (locked until a quarter is back after running dry)
    const want = !!inp.boost && !this.boostLock && this.boostE > 0 && ground && !inp.brake;
    this.boosting = want;
    if (want) { this.boostE = Math.max(0, this.boostE - P.boostDrain * dt); if (this.boostE <= 0) this.boostLock = true; }
    else { this.boostE = Math.min(1, this.boostE + P.boostRegen * dt); if (this.boostLock && this.boostE > 0.25) this.boostLock = false; }
    if (ground) {
      const VMAX = P.vmax + (want ? P.boostV : 0);
      if (inp.throttle > 0 && vf > -0.5) vf += inp.throttle * (inp.launch ? P.launch : P.accel) * Math.max(0, 1 - vf / VMAX) * dt;   // launch: a hard first 1.5 s
      if (want) vf += P.boostAccel * Math.max(0, 1 - vf / VMAX) * dt;
      if (inp.brake > 0) { if (vf > 0.6) vf -= P.brake * inp.brake * dt; else vf = Math.max(-12, vf - 9 * inp.brake * dt); }
      if (inp.throttle > 0 && vf < 0 && !inp.brake) vf += 20 * dt;
      vf -= vf * (0.12 + (inp.handbrake ? 0.9 : 0)) * dt;
      if (!inp.throttle && !inp.brake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 3 * dt);
      let grip = (inp.handbrake ? P.hgrip : P.grip) * env.grip;
      // power slide: near full lock with the throttle in, the rear lets go a little (smooth in steer, so tilt steering never snaps)
      if (P.slide && !inp.handbrake) grip *= 1 - P.slide * clamp((Math.abs(this.steer) - 0.5) / 0.5, 0, 1) * inp.throttle * clamp((vf - 10) / 15, 0, 1);
      vl *= Math.exp(-grip * dt);
      const maxSteer = P.steer - P.steerLoss * clamp(Math.abs(vf) / 40, 0, 1);
      let target = -vf * Math.tan(this.steer * maxSteer) / P.wb;
      if (inp.handbrake && Math.abs(vf) > 6) target *= P.hbYaw;
      this.yawRate = damp(this.yawRate, target, P.yawDamp, dt);
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
    this.vf = vf; this.speed = Math.hypot(this.vx, this.vz); this.braking = inp.brake > 0 && vf > 1; this.handbrake = !!inp.handbrake;
    // suspension feel: pitch from acceleration (squat / dive), roll from lateral acceleration (taller cars lean more), a spring for bumps and landings
    const accel = (vf - (this.prevVf ?? vf)) / Math.max(dt, 1e-3); this.prevVf = vf;
    this.pitch = damp(this.pitch, clamp(-accel * P.pitch[0], -P.pitch[1], P.pitch[1]), 6, dt);
    this.roll = damp(this.roll, clamp(this.yawRate * vf * P.roll[0], -P.roll[1], P.roll[1]), 6, dt);
    this.bobV += (-this.bob * P.spring[0] - this.bobV * P.spring[1]) * dt; this.bob += this.bobV * dt;
    // tyre smoke and skid marks while drifting, power-sliding or burning out; all four tyres mark under hard braking
    this.burnout = !!inp.launch && !this.air && this.speed < 16;
    this.skidRear = !this.air && (this.drift > 3.5 || this.burnout || (!!inp.handbrake && this.speed > 6));
    this.skidFront = !this.air && this.braking && inp.brake > 0.5 && vf > 12;
    const W = this.v.wheels, rearZ = W[2][1], rearX = W[2][0], dusty = this.offroad > 0;
    // (every other step and modest puffs: on a phone the chase camera sits close and big smoke buries the screen)
    if (fx && !this.air && (this.smokeT = (this.smokeT || 0) + 1) % 2 === 0 && (this.drift > 4.5 || (inp.handbrake && this.speed > 8) || this.burnout)) {
      const k = clamp(this.burnout ? 1 : this.drift / 9, 0.5, 1.2);
      for (const sx of [rearX, -rearX]) { const wx = this.x + s2 * rearZ + c2 * sx, wz = this.z + c2 * rearZ - s2 * sx; fx.emit(wx, this.y + 0.25, wz, (Math.random() - 0.5) * 2 - this.vx * 0.15, 0.8 + Math.random(), (Math.random() - 0.5) * 2 - this.vz * 0.15, { life: 1.0, size: 0.9 * k, grow: 2.2, drag: 1.5, r: dusty ? 0.78 : 0.86, g: dusty ? 0.68 : 0.82, b: dusty ? 0.52 : 0.84 }); }
    }
    if (this.skids) this.skids.update(this, dt);
    // the boost flame: a white-hot core inside an orange jet out of each pipe (and a few pops on the launch)
    const pipes = this.v.exhaust || [[-0.45, 0.55, this.v.rear], [0.45, 0.55, this.v.rear]];
    if (fx && (want || (this.burnout && Math.random() < 0.15))) for (const [ex0, ey, ez0] of pipes) {
      const ex = this.x + s2 * ez0 + c2 * ex0, ez = this.z + c2 * ez0 - s2 * ex0, j = () => (Math.random() - 0.5), [r, g, b] = this.v.flame || [1, 0.5, 0.14];
      fx.emit(ex, this.y + ey, ez, this.vx - s2 * 10 + j(), 0.2 + j() * 0.4, this.vz - c2 * 10 + j(), { life: 0.26, size: 0.6, grow: -1.2, drag: 3, r, g, b, add: 1 });
      fx.emit(ex, this.y + ey, ez, this.vx - s2 * 7, 0.1, this.vz - c2 * 7, { life: 0.11, size: 0.32, grow: -0.6, drag: 2, r: 1, g: 0.92, b: 0.7, add: 1 });
    }
  }
  render(dt) {
    this.root.position.set(this.x, this.y, this.z); this.root.rotation.set(0, this.yaw, 0);
    this.body.rotation.set(this.pitch + (this.air ? -this.vy * 0.01 : 0), 0, this.roll, 'YXZ'); this.body.position.y = this.bob;
    // wheels roll with the road; the rears lock on the handbrake and spin up in a burnout
    this.wheelRot += this.vf * dt; if (!this.handbrake || this.air) this.wheelRotR += (this.vf + (this.burnout ? 22 : 0)) * dt;
    const turn = -this.steer * this.P.steer * 0.85;
    for (const w of this.wheels) { w.w.rotation.x = (w.front ? this.wheelRot : this.wheelRotR) / w.r; if (w.front) w.piv.rotation.y = turn; }
    this.steeringWheel.rotation.z = this.steer * 1.4; for (const a of this.arms) a.rotation.z = this.steer * 0.18;
    this.tailMat.color.setScalar(this.braking ? 3.6 : 1.1); this.tailGlow.opacity = this.braking ? 0.95 : 0.2;
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
