// EXPLORE SPACE: free flight through a stylised, compressed solar system. The Sun sits at the origin, the planets lie in the y = 0 plane at
// r = A * sqrt(true distance in AU), so the inner planets are not lost and Neptune is still reachable. WARP is "supercruise": the speed grows with
// the distance to the nearest world (v = k * d), so every trip takes 20 to 40 s whatever its length, and the ship slows by itself on arrival.
// True distances are mapped back from the game positions (inverse of the same law), so the numbers on screen are real km.
import * as THREE from 'three';
import { planetTexture, ringTexture, dotTexture, satelliteGeometry, cometGeometry } from './space_models.js';
import { bakeColored, M4 } from '../util.js';
import { roadsterGeometry, mascotParts } from '../models.js';

export const AU = 149597871, LIGHT = 299792.458;
const A = 120000, LOCAL = 30000, KM_PER_GU = (384400 - 6371 - 1737.4) / (12000 - 400 - 110), WARP_K = 0.46, CRUISE = 60;
const TAIL = '#include <tonemapping_fragment>\n#include <colorspace_fragment>';
// fallback when js/solar.js is missing (same shape)
export const FALLBACK = [
  { id: 'earth', name: 'EARTH', kind: 'planet', radiusKm: 6371, sunKm: 149597871, color: '#3f7fd6', fact: 'You are here. Earth is 12,742 km wide and races round the Sun at 29.8 km/s.' },
  { id: 'moon', name: 'THE MOON', kind: 'moon', radiusKm: 1737.4, sunKm: 149597871, color: '#c9c5bc', fact: 'The Moon drifts 3.8 cm farther from Earth every year.' },
  { id: 'venus', name: 'VENUS', kind: 'planet', radiusKm: 6051.8, sunKm: 108200000, color: '#e3bb76', fact: 'The hottest planet at 464 °C. A day on Venus is longer than its year.' },
  { id: 'mars', name: 'MARS', kind: 'planet', radiusKm: 3389.5, sunKm: 227900000, color: '#c1583a', fact: 'Mars has a volcano 21.9 km tall, nearly two and a half Everests.' },
  { id: 'mercury', name: 'MERCURY', kind: 'planet', radiusKm: 2439.7, sunKm: 57900000, color: '#9c9690', fact: 'Only 1.4 times as wide as our Moon, and its year lasts just 88 days.' },
  { id: 'sun', name: 'THE SUN', kind: 'star', radiusKm: 695700, sunKm: 0, color: '#ffc94a', fact: 'The sunlight on your face left the Sun 8 minutes 19 seconds ago.' },
  { id: 'jupiter', name: 'JUPITER', kind: 'planet', radiusKm: 69911, sunKm: 778500000, color: '#d8a878', fact: 'More than 1,300 Earths would fit inside Jupiter.' },
  { id: 'saturn', name: 'SATURN', kind: 'planet', radiusKm: 58232, sunKm: 1433500000, color: '#e4cf9a', fact: 'Saturn is less dense than water. In a big enough bath, it would float.' },
  { id: 'uranus', name: 'URANUS', kind: 'planet', radiusKm: 25362, sunKm: 2872500000, color: '#9fe0e6', fact: 'Uranus rolls round the Sun on its side, tilted 98 degrees.' },
  { id: 'neptune', name: 'NEPTUNE', kind: 'planet', radiusKm: 24622, sunKm: 4495100000, color: '#4a6fe0', fact: 'Winds on Neptune reach 2,000 km/h, the fastest in the Solar System.' },
];
// the easter eggs (facts checked: Falcon Heavy test flight 6 Feb 2018; Vanguard 1 launched 17 Mar 1958; Halley perihelion due 28 Jul 2061; ISS length 109 m, NASA)
const EGGS = [
  { id: 'iss', name: 'THE ISS', radiusKm: 0.055, fact: 'The station is 109 metres end to end, about as long as a football pitch.' },
  { id: 'sat', name: 'LOST SATELLITE', radiusKm: 0.001, fact: 'Vanguard 1 went up in 1958 and it\'s still up there, the oldest human-made thing in orbit.' },
  { id: 'roadster', name: 'RED ROADSTER', radiusKm: 0.002, fact: 'In 2018 a real red sports car with a dummy at the wheel was fired into space. It\'s been circling the Sun ever since.' },
  { id: 'comet', name: 'A COMET', radiusKm: 5.5, fact: 'Halley\'s Comet swings past every 75 or 76 years. It\'s due back in 2061.' },
];
export const NINE = ['moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'sun'];
const ORDER = ['moon', 'mars', 'venus', 'mercury', 'sun', 'jupiter', 'saturn', 'uranus', 'neptune', 'iss', 'sat', 'roadster', 'comet', 'earth'];
// game radius (gu) and the angle (degrees from Earth's) of each world round the Sun
const LOOK = { sun: [5200, 0], mercury: [170, 150], venus: [380, -38], earth: [400, 0], mars: [230, 34], jupiter: [1800, 62], saturn: [1500, -78], uranus: [820, 140], neptune: [800, -128], moon: [110, 0] };

const BODY_V = 'varying vec3 vN; varying vec3 vW; varying vec2 vUv; void main(){ vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const BODY_F = `uniform sampler2D map; uniform vec3 uSun, uRim; uniform float uEmit; varying vec3 vN; varying vec3 vW; varying vec2 vUv;
  void main(){ vec3 N = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(uSun - vW); vec3 t = texture2D(map, vUv).rgb; float dl = dot(N, L), nv = clamp(dot(N, V), 0.0, 1.0);
    vec3 c;
    if (uEmit > 0.5) { c = t * (2.2 + 1.6 * pow(nv, 0.6)) * vec3(1.0, 0.82, 0.55) + vec3(1.6, 0.6, 0.15) * pow(1.0 - nv, 2.0); }
    else { c = t * (0.1 + 1.4 * smoothstep(-0.12, 1.0, dl)); c += uRim * pow(1.0 - nv, 3.0) * smoothstep(-0.35, 0.5, dl) * 1.4; }
    gl_FragColor = vec4(c, 1.0);
    ${TAIL}
  }`;

export class Explore {
  constructor(scene, { tier, earthScene, sunDir }) {
    this.scene = scene; this.tier = tier; this.space = earthScene; this.sunDir = sunDir; this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);
    this.pos = new THREE.Vector3(); this.vel = 0; this.yaw = 0; this.bank = 0; this.warpT = 0; this.targetI = 0; this.visited = new Set(); this.trueKm = 0; this.trueSpeed = 0; this.dist = 0;
    this._v = new THREE.Vector3(); this._w = new THREE.Vector3(); this._u = new THREE.Vector3(); this._tp = new THREE.Vector3(); this._tq = new THREE.Vector3(); this._last = new THREE.Vector3(); this._lastOk = false;
  }
  build(BODIES) {
    const T = this.tier, W = T === 'low' ? 256 : 512, seg = T === 'low' ? [32, 20] : [56, 36], g = this.group, sphere = new THREE.SphereGeometry(1, seg[0], seg[1]), dot = dotTexture();
    const byId = {}; for (const b of FALLBACK) byId[b.id] = { ...b }; for (const b of BODIES || []) if (byId[b.id]) Object.assign(byId[b.id], b);
    const sunH = this._v.set(this.sunDir.x, 0, this.sunDir.z).normalize(), thE = Math.atan2(-sunH.z, -sunH.x);
    this.E = new THREE.Vector3(Math.cos(thE) * A, 0, Math.sin(thE) * A);
    this.bodies = [];
    const add = (o) => { this.bodies.push(o); return o; };
    for (const id of ['sun', 'mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'moon']) {
      const d = byId[id], [R, ang] = LOOK[id], b = add({ ...d, R, pos: new THREE.Vector3(), egg: false });
      if (id === 'moon') { const a = thE + Math.PI / 2 + 0.35; b.pos.set(this.E.x + Math.cos(a) * 12000, 0, this.E.z + Math.sin(a) * 12000); }
      else if (id === 'earth') b.pos.copy(this.E);
      else if (id !== 'sun') { const r = A * Math.sqrt(d.sunKm / AU), a = thE + ang * Math.PI / 180; b.pos.set(Math.cos(a) * r, 0, Math.sin(a) * r); }
      const col = new THREE.Color(d.color || '#ffffff');
      if (id === 'earth' && this.space && this.space.planet) {   // the peer's Earth (oceans, land, clouds, city lights) on our own mesh; equator up so the ship sits over it
        const e = new THREE.Group(); e.position.copy(b.pos); e.rotation.x = Math.PI / 2; e.add(new THREE.Mesh(this.space.planet.geometry, this.space.planet.material));
        e.children[0].scale.setScalar(R); if (this.space.clouds) { const c = new THREE.Mesh(this.space.clouds.geometry, this.space.clouds.material); c.scale.setScalar(R * 1.008); e.add(c); }
        e.children.forEach((m) => (m.frustumCulled = false)); g.add(e); b.mesh = e;
      } else {
        const m = new THREE.Mesh(sphere, new THREE.ShaderMaterial({ uniforms: { map: { value: planetTexture(id === 'earth' ? 'uranus' : id, id === 'sun' ? 256 : W) }, uSun: { value: new THREE.Vector3() }, uRim: { value: col.clone().multiplyScalar(0.6) }, uEmit: { value: id === 'sun' ? 1 : 0 } }, vertexShader: BODY_V, fragmentShader: BODY_F }));
        m.position.copy(b.pos); m.scale.setScalar(R); if (id === 'uranus') m.rotation.z = 1.7; g.add(m); b.mesh = m; b.mat = m.material;
      }
      const glowCol = id === 'sun' ? new THREE.Color(2.4, 1.3, 0.5) : id === 'earth' ? new THREE.Color(0.35, 0.6, 1.4) : col.clone().multiplyScalar(0.55);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: glowCol, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
      s.position.copy(b.pos); s.scale.setScalar(R * (id === 'sun' ? 7 : 3.1)); g.add(s); b.glow = s;
      if (id === 'saturn') {   // rings with a radial texture, tilted 27 degrees
        const rg = new THREE.RingGeometry(R * 1.25, R * 2.3, 96, 1), uv = rg.attributes.uv, p = rg.attributes.position;
        for (let i = 0; i < uv.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (r - R * 1.25) / (R * 1.05), 0.5); }
        const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: ringTexture(), color: new THREE.Color(1.5, 1.4, 1.25), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
        ring.position.copy(b.pos); ring.rotation.set(-Math.PI / 2 + 0.47, 0, 0.2); g.add(ring);
      }
    }
    this.byId = {}; for (const b of this.bodies) this.byId[b.id] = b;
    const earth = this.byId.earth, mat = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1, emissive: 0x30303a, ...o });
    // eggs: the ISS over Earth, an old satellite, a red roadster with a dummy, a comet
    this.start = new THREE.Vector3(earth.pos.x, earth.R + 55, earth.pos.z); this.startYaw = this.yawTo(this.start, this.byId.moon.pos);
    const fwd = this._u.set(-Math.sin(this.startYaw), 0, -Math.cos(this.startYaw)), left = this._w.set(fwd.z, 0, -fwd.x).multiplyScalar(-1);
    const eggPos = { iss: this.start.clone().addScaledVector(fwd, 70).addScaledVector(left, 26).add(new THREE.Vector3(0, 6, 0)), sat: earth.pos.clone().add(new THREE.Vector3(-1500, 300, 900)),
      roadster: (() => { const a = thE + 0.21, r = A * Math.sqrt(1.3); return new THREE.Vector3(Math.cos(a) * r, 400, Math.sin(a) * r); })(), comet: (() => { const a = thE - 0.44, r = A * Math.sqrt(2.0); return new THREE.Vector3(Math.cos(a) * r, 2500, Math.sin(a) * r); })() };
    for (const e of EGGS) {
      const b = add({ ...e, R: { iss: 12, sat: 4, roadster: 9, comet: 40 }[e.id], pos: eggPos[e.id], egg: true, color: '#ffd84d' }); let o;
      if (e.id === 'iss') { o = this.space.makeISS(); o.scale.setScalar(0.4); o.rotation.set(0.25, this.startYaw + 0.9, 0.12); }
      else if (e.id === 'sat') { o = new THREE.Mesh(satelliteGeometry(), mat({})); o.scale.setScalar(3); }
      else if (e.id === 'roadster') {
        const geo = roadsterGeometry({ wheels: true }), c = geo.attributes.color; for (let i = 0; i < c.count; i++) if (c.getX(i) + c.getY(i) + c.getZ(i) > 2.99) c.setXYZ(i, 0.85, 0.08, 0.1);   // paint the white body red
        const p = mascotParts(0xffffff), dummy = bakeColored([[p.torso, 0xffffff, M4(-0.4, -0.45, -0.2, 0, 0, 0, 0.62, 0.62, 0.62)]]);
        o = new THREE.Group(); o.add(new THREE.Mesh(geo, mat({ emissive: 0x401010 })), new THREE.Mesh(dummy, mat({})));
        const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), new THREE.MeshStandardMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.35, roughness: 0.1 })); helmet.position.set(-0.4, 0.66, -0.19); o.add(helmet);
        o.scale.setScalar(2.4);
      } else {
        o = new THREE.Group(); o.add(new THREE.Mesh(new THREE.IcosahedronGeometry(14, 2), mat({ color: 0x9c98a8, vertexColors: false, emissive: 0x404050 })));
        const tail = new THREE.Mesh(cometGeometry(), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
          vertexShader: 'varying float vZ; varying vec3 vN; varying vec3 vV; void main(){ vZ = position.z; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
          fragmentShader: 'varying float vZ; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(abs(dot(normalize(vN), normalize(vV))), 1.5) * pow(1.0 - vZ, 1.6); gl_FragColor = vec4(vec3(0.5, 0.9, 1.6) * f, 1.0); }' }));
        tail.scale.set(160, 160, 5200); o.add(tail); const coma = new THREE.Sprite(new THREE.SpriteMaterial({ map: dot, color: new THREE.Color(0.6, 1.1, 1.6), blending: THREE.AdditiveBlending, depthWrite: false })); coma.scale.setScalar(260); o.add(coma);
      }
      o.position.copy(b.pos); if (e.id === 'comet') o.lookAt(this._v.copy(b.pos).multiplyScalar(2)); g.add(o); b.mesh = o;   // the comet's tail points away from the Sun
    }
    // stars round the camera, and the asteroid belt (3,000 specks between Mars and Jupiter)
    const n = T === 'low' ? 1200 : 2600, sp = new Float32Array(n * 3), sc = new Float32Array(n * 3); let s = 31; const rnd = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < n; i++) { const z = 2 * rnd() - 1, a = rnd() * Math.PI * 2, r = Math.sqrt(1 - z * z), b = 0.4 + 1.4 * Math.pow(rnd(), 4), t = rnd(); sp.set([Math.cos(a) * r * 2e6, z * 2e6, Math.sin(a) * r * 2e6], i * 3); sc.set([b * (t > 0.8 ? 1.2 : 0.9), b * 0.92, b * (t < 0.3 ? 1.35 : 1.0)], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 2.6, sizeAttenuation: false, vertexColors: true, map: dot, transparent: true, depthWrite: false, fog: false })); this.stars.frustumCulled = false; this.stars.renderOrder = -5; g.add(this.stars);
    const nb = T === 'low' ? 1500 : 3000, bp = new Float32Array(nb * 3); for (let i = 0; i < nb; i++) { const a = rnd() * Math.PI * 2, r = A * Math.sqrt(2.2 + rnd() * 1.1), y = (rnd() - 0.5) * 9000; bp.set([Math.cos(a) * r, y, Math.sin(a) * r], i * 3); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(bp, 3));
    this.belt = new THREE.Points(bg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uScale: { value: 500 } },
      vertexShader: 'uniform float uScale; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = smoothstep(60000.0, 15000.0, -mv.z); gl_PointSize = clamp(160.0 * uScale / -mv.z, 1.0, 7.0); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; if (dot(d, d) > 0.25 || vA < 0.01) discard; gl_FragColor = vec4(0.66, 0.58, 0.52, vA); }' }));
    this.belt.frustumCulled = false; g.add(this.belt);
    // warp streaks: thin boxes in camera space
    this.streaks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.06, 0.06, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.7, 2.2), transparent: true, opacity: 0.7, depthWrite: false }), 60);
    this.streaks.frustumCulled = false; this.streakP = new Float32Array(60 * 3); for (let i = 0; i < 60; i++) { const a = rnd() * Math.PI * 2, r = 6 + rnd() * 30; this.streakP.set([Math.cos(a) * r, Math.sin(a) * r, -rnd() * 300], i * 3); }
    this.streakG = new THREE.Group(); this.streakG.add(this.streaks); g.add(this.streakG); this._dummy = new THREE.Object3D();
    for (const b of this.bodies) this.byId[b.id] = b; this.targets = ORDER.map((id) => this.byId[id]);
    for (const b of this.bodies) { b.trueC = new THREE.Vector3(); this.truePos(b.pos, b.trueC); }
  }
  yawTo(from, to) { return Math.atan2(-(to.x - from.x), -(to.z - from.z)); }
  // game position -> true position in km (heliocentric), local around Earth at a fixed scale
  truePos(p, out) {
    const E = this.E, dx = p.x - E.x, dy = p.y - E.y, dz = p.z - E.z;
    if (dx * dx + dy * dy + dz * dz < LOCAL * LOCAL) { const k = AU / A; return out.set(E.x * k + dx * KM_PER_GU, E.y * k + dy * KM_PER_GU, E.z * k + dz * KM_PER_GU); }
    const r = Math.hypot(p.x, p.z), rk = (r / A) * (r / A) * AU, k = r > 1 ? rk / r : AU / A; return out.set(p.x * k, p.y * (AU / A), p.z * k);
  }
  reset() {
    this.pos.copy(this.start); this.yaw = this.startYaw; this.vel = 0; this.bank = 0; this.warpT = 0; this.targetI = 0; this.visited.clear(); this.trueKm = 0; this.trueSpeed = 0; this._lastOk = false; this.arriveT = -1; this.lastBody = this.byId.earth; this.warping = false;
  }
  get target() { return this.targets[this.targetI]; }
  cycle(d = 1) { this.targetI = (this.targetI + d + this.targets.length) % this.targets.length; }
  nextUnvisited() { for (let k = 1; k <= this.targets.length; k++) { const i = (this.targetI + k) % this.targets.length, b = this.targets[i]; if (b.id !== 'earth' && !this.visited.has(b.id)) { this.targetI = i; return; } } }
  // km from the ship to a world's surface, true scale
  trueDist(b) {   // far: the inverse of the layout law; close to a world: that world's own scale (its true radius over its game radius); blended in log space
    this.truePos(this.pos, this._tp); const far = Math.max(1, this._tp.distanceTo(b.trueC) - (b.radiusKm || 0)), dS = Math.max(0, this.pos.distanceTo(b.pos) - b.R);
    if (!b.radiusKm || b.egg && b.id !== 'comet') return far; const near = Math.max(1, dS * b.radiusKm / b.R), k = Math.min(1, Math.max(0, (dS / b.R - 3) / 27)), f = k * k * (3 - 2 * k);
    return Math.exp(Math.log(near) + (Math.log(far) - Math.log(near)) * f);
  }
  step(dt, inp, onArrive) {
    const p = this.pos, t = this.target, warp = !!inp.handbrake;
    // nearest surface (worlds plus the current target)
    let dNear = 1e12; for (const b of this.bodies) { if (b.egg && b !== t) continue; const d = p.distanceTo(b.pos) - b.R; if (d < dNear) dNear = d; }
    let aimY = p.y;
    if (warp) {
      this.warpT += dt;
      const toC = this._v.subVectors(t.pos, p); toC.y = 0; const hd = toC.length() || 1, side = t.R * 1.7 + 30;
      const aim = this._w.set(t.pos.x - (toC.z / hd) * side, t.pos.y + t.R * 0.35, t.pos.z + (toC.x / hd) * side);
      let dy = this.yawTo(p, aim) - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += Math.max(-1.7 * dt, Math.min(1.7 * dt, dy)); aimY = aim.y;
      const want = Math.max(CRUISE, WARP_K * Math.max(0, dNear) * Math.min(1, 0.35 + this.warpT * 0.5));
      this.vel += (want - this.vel) * (1 - Math.exp(-dt * (want > this.vel ? 1.6 : 5)));
    } else {
      this.warpT = 0; const cap = inp.boost ? 75 : CRUISE;
      if (this.vel > cap) this.vel += (cap - this.vel) * (1 - Math.exp(-dt * 2.5));
      else if (inp.boost) this.vel = Math.min(75, this.vel + 30 * dt);
      if (inp.brake) this.vel = Math.max(0, this.vel - 45 * dt * Math.max(1, inp.brake));
    }
    this.warping = warp && this.vel > CRUISE * 1.5;
    this.yaw += inp.steer * -1.3 * dt; this.bank += (inp.steer * -0.5 - this.bank) * (1 - Math.exp(-dt * 4));
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), hdist = warp ? Math.max(1, Math.hypot(t.pos.x - p.x, t.pos.z - p.z)) : 1;
    const vy = warp ? this.vel * Math.max(-0.5, Math.min(0.5, (aimY - p.y) / hdist)) : 0;
    p.x += fx * this.vel * dt; p.z += fz * this.vel * dt; p.y += vy * dt;
    // never inside a world
    for (const b of this.bodies) { const d = p.distanceTo(b.pos), m = b.R * 1.06 + 5; if (d < m) { this._u.subVectors(p, b.pos).normalize(); p.copy(b.pos).addScaledVector(this._u, m); } }
    // true speed (km/s) for the HUD
    this.truePos(p, this._tq); if (this._lastOk) { const sp = this._tq.distanceTo(this._last) / dt; this.trueSpeed += (sp - this.trueSpeed) * 0.1; } this._last.copy(this._tq); this._lastOk = true;
    // arrivals
    for (const b of this.bodies) {
      if (b.id === 'earth' || this.visited.has(b.id)) continue;
      if (p.distanceTo(b.pos) - b.R < Math.max(b.R * 1.2, 55)) {
        this.visited.add(b.id); this.truePos(this.lastBody.pos, this._tp); this.trueKm += this._tp.distanceTo(b.trueC); this.lastBody = b;
        if (b === t) this.arriveT = 2.5; onArrive(b);
      }
    }
    if (this.arriveT > 0 && (this.arriveT -= dt) <= 0) this.nextUnvisited();
    this.dist = this.trueDist(this.target);
  }
  // camera + per-frame visuals
  render(dt, camera, rocket, time) {
    const p = this.pos, fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), w = Math.min(1, Math.max(0, (this.vel - 80) / 2000));
    rocket.position.copy(p); rocket.rotation.set(-Math.PI / 2, this.yaw, 0, 'YXZ'); rocket.rotateY(this.bank);
    const back = 30 + w * 8, rx = -fz, rz = fx; camera.position.set(p.x - fx * back + rx * 9, p.y + 12, p.z - fz * back + rz * 9); camera.up.set(0, 1, 0); camera.lookAt(p.x + fx * 60 - rx * 12, p.y - 17, p.z + fz * 60 - rz * 12);
    camera.fov = 58 + w * 16; camera.near = 1; camera.far = 3e6; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    this.stars.position.copy(camera.position);
    // warp streaks fly past the camera
    this.streakG.visible = w > 0.02; if (this.streakG.visible) {
      this.streakG.position.copy(camera.position); this.streakG.quaternion.copy(camera.quaternion); const sp = 60 + w * 900, len = 2 + w * 60, d = this._dummy;
      for (let i = 0; i < 60; i++) { let z = this.streakP[i * 3 + 2] + sp * dt; if (z > 10) z -= 310; this.streakP[i * 3 + 2] = z; d.position.set(this.streakP[i * 3], this.streakP[i * 3 + 1], z); d.scale.set(1, 1, len); d.updateMatrix(); this.streaks.setMatrixAt(i, d.matrix); }
      this.streaks.instanceMatrix.needsUpdate = true; this.streaks.material.opacity = 0.75 * w;
    }
    const iss = this.byId.iss.mesh; iss.rotation.y += dt * 0.05; const sat = this.byId.sat.mesh; sat.rotation.x += dt * 0.6; sat.rotation.y += dt * 0.4;
    const rd = this.byId.roadster.mesh; rd.rotation.y += dt * 0.25; rd.rotation.z = Math.sin(time * 0.3) * 0.4;
    return w;
  }
}
// "4 min 21 s", "1.3 s", "4 h 10 min"
export function lightTime(km) { const s = km / LIGHT; if (s < 60) return `${s < 1 ? s.toFixed(3) : s < 10 ? s.toFixed(1) : Math.round(s)} S`; if (s < 3600) return `${Math.floor(s / 60)} MIN ${Math.round(s % 60)} S`; return `${Math.floor(s / 3600)} H ${Math.round((s % 3600) / 60)} MIN`; }
export function fmtKm(km) { if (km < 1e6) return `${Math.round(km).toLocaleString('en-US')} KM`; if (km < 1e9) return `${(km / 1e6).toFixed(km < 1e7 ? 1 : 0)} MILLION KM`; return `${(km / 1e9).toFixed(2)} BILLION KM`; }
