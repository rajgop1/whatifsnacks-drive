// MOON BUGGY: "What if you drove on the Moon?" Drive a chunky lunar buggy (the hoodie mascot at the wheel, a snack crate on the back) over seeded, streamed,
// low-gravity terrain: floaty jumps, wheels spinning in the air, dust that arcs and falls straight down (no air), long black shadows, a black starry sky and Earth
// rising over the hill as you drive toward it. Grab 6 snack crates, jump the crater, find the 1969 landing stage and the old rover, then plant the flag at the lander.
// Contract: js/modes/README.md. World and art: js/modes/moon_world.js.
// Controls (touch has five): steer, DRIVE (boost / W / Up), BRAKE (brake / S, hold when stopped to reverse), JUMP (drift / Space: a hop jet on the ground, a hover in the air; it recharges on the ground).
//
// FACTS (radio lines; checked numbers and sources):
//  - Surface gravity 1.62 m/s², Earth 9.81 m/s²: 1.62 / 9.81 = 16.5%.                                     NASA Moon Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html)
//  - At the same launch speed, airtime = 2v/g, so in 1/6 g you hang about six times longer.                 basic projectile motion with the numbers above
//  - A lunar day (sunrise to sunrise, synodic month) is 29.5 Earth days.                                      NASA Moon Fact Sheet: synodic period 29.53 d
//  - Equator temperatures run from about +120 °C in sunlight to about -130 °C at night.                       NASA Science "Moon: Facts" (250 °F / -208 °F)
//  - Almost no atmosphere (an exosphere), so sound cannot travel through it, and shadows are black because   NASA Science "Moon: Facts"; no air scatters light into them
//    no air scatters light into them.
//  - Apollo 17's rover holds the lunar speed record, about 18 km/h (Gene Cernan, 11.2 mph).                    NASA LRV history / Apollo 17 mission report
//  - Apollo 15, 16 and 17 each left their Lunar Roving Vehicle on the Moon (3 rovers). The rovers ran on      NASA History Office, "The Lunar Roving Vehicle"; LRV Operations Handbook:
//    two 36-volt silver-zinc batteries that were not rechargeable.                                             two 36 V silver-zinc primary batteries
//  - 12 people walked on the Moon, Apollo 11 to Apollo 17, 1969 to 1972.                                       NASA Apollo program summaries
//  - The Moon is tidally locked: the same face always points at Earth, so the far side is never seen from it.  NASA Science "Tidal locking"
//  - The horizon for a 1.7 m person: sqrt(2 x 1,737.4 km x 1.7 m) = about 2.4 km.                              NASA radius 1,737.4 km, geometry
//  - Earth's diameter is 3.67 times the Moon's (12,742 / 3,474 km), so it looks nearly four times wider.       NASA Earth and Moon Fact Sheets
//  - From a fixed spot on the near side, Earth stays almost still in the sky; it seems to rise here only       NASA Science: Earth "hangs" in the lunar sky; Apollo 8 earthrise was from orbit
//    because we drive over the curve.
//  - Lunar dust is sharp and glassy: no wind or water ever rounded the grains.                                 NASA "The Mysterious Moon Dust" / Apollo regolith studies
//  - Apollo 11 left the descent stage, a flag and footprints at Tranquility Base; Buzz Aldrin saw the flag     NASA Apollo 11 Mission Report; Aldrin's account of liftoff
//    blow over at liftoff. With no wind or rain, footprints can last for millions of years.                    NASA Science "Moon: Facts"
//  - Apollo flags had a horizontal rod along the top, because there is no wind to hold a flag out.            NASA "Where No Flag Has Gone Before" (Platoff, NASA CR-188251)
//  - The Moon drifts about 3.8 cm farther from Earth every year (lunar laser ranging).                          NASA, Apollo retroreflector experiments (also js/solar.js)
import * as THREE from 'three';
import { Particles } from '../fx.js';
import { clamp, damp, lerp, smooth } from '../util.js';
import { World, Terrain, G, CHUNK, U as WU, curve, makeBuggy, WHEELS, landerGeometry, landerWindowGeometry, stageGeometry, roverGeometry, crateGeometry, makeFlag, makeSky, makeBeam, footGeometry, NC } from './moon_world.js';

const VMAX = 16, ACC = 4.4, WB = 2.3, TRACK = 1.9, BATTERY = 140, PICK = 3.6, JET_HOP = 3.4, JET_COST = 0.34, SUN_EL = 0.25;
const R = {   // radio lines (sources above)
  hi: 'Welcome to the Moon! Gravity here is one sixth of Earth\'s, so every bump is a jump. Grab the six snack crates.',
  g: 'Gravity up here is 1.62 metres per second squared. That\'s just 16.5% of Earth\'s.',
  jump: 'Same launch speed, six times the hang time. That\'s one-sixth gravity for you.',
  quiet: 'Hear that? Nothing. There\'s almost no air out there, so no sound. We only hear the buggy through the seat.',
  shadow: 'See how black the shadows are? There\'s no air up here to scatter light into them.',
  speed: 'We\'re cheating a bit. The real speed record up here is about 18 km/h, set by Apollo 17\'s rover.',
  day: 'One day here lasts about 29 and a half Earth days. Two weeks of sunshine, then two weeks of night.',
  temp: 'At the equator the ground goes from about 120 degrees in the sun to minus 130 at night.',
  humans: 'Only 12 people have ever walked on the Moon, all of them between 1969 and 1972.',
  farside: 'The Moon always shows Earth the same face. Nobody on Earth ever sees the far side.',
  horizon: 'The horizon is close here. Stand up and it\'s only about 2.4 km away.',
  earth: 'Earth looks nearly four times wider from here than the Moon does from home.',
  rise: 'Earth\'s coming up over the hill! That\'s only because we\'re driving over the curve. Park, and it barely moves in the sky.',
  dust: 'Moon dust is sharp, like crushed glass. No wind or water ever rounded it off.',
  battery: 'The Apollo rovers ran on batteries that couldn\'t be recharged. Ours can\'t either, so keep moving.',
  drift: 'Fun one: the Moon drifts 3.8 cm farther from Earth every year.',
  crater: 'Crater cleared! Most of these were punched out by rocks from space, billions of years ago.',
  stage: 'Whoa, a landing stage from 1969! Apollo 11 left one just like it, with a flag and footprints. They\'re all still up here.',
  stage2: 'No wind, no rain. Footprints here can last for millions of years. Buzz Aldrin saw their flag blow over at liftoff.',
  rover: 'An old rover! Apollo 15, 16 and 17 each left one parked up here, right where the astronauts got out.',
  allc: 'That\'s all six crates! Head back to the lander and plant the flag.',
  flag: 'Flag planted! The rod along the top holds it out, because there\'s no wind up here to do it.',
  flat: 'Battery\'s flat. We\'re coasting now. Good thing the view\'s nice.',
};
const FILL = ['g', 'shadow', 'day', 'humans', 'temp', 'farside', 'horizon', 'dust', 'earth', 'drift', 'battery'];   // idle beats, in order
const fmtD = (m) => (m < 1000 ? `${Math.round(m)} M` : `${(m / 1000).toFixed(1)} KM`), fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;


export default class MoonMode {
  constructor(ctx) { this.ctx = ctx; this.phase = 'idle'; }

  // ------------------------------------------------------------------------------------------------ build once
  load() {
    const ctx = this.ctx, tier = ctx.tier, S = (this.scene = new THREE.Scene()); this.tier = tier;
    S.background = new THREE.Color(0, 0, 0);
    const W = (this.world = new World(ctx.DAY || 1));
    const saz = W.earthAz + 2.2; this.SUN = new THREE.Vector3(Math.sin(saz) * Math.cos(SUN_EL), Math.sin(SUN_EL), Math.cos(saz) * Math.cos(SUN_EL));
    this.sunL = new THREE.DirectionalLight(0xfff2e0, 3.4); S.add(this.sunL, this.sunL.target);
    this.hemi = new THREE.HemisphereLight(0x5a6688, 0x8a8690, 1.5); this.fill = new THREE.DirectionalLight(0x8fb4ff, 0.45); S.add(this.hemi, this.fill, this.fill.target);
    this.terrain = new Terrain(S, W, tier, this.SUN);
    this.sky = makeSky(S, tier);
    const lam = (o = {}) => curve(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...o }));
    this.mats = { body: curve(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, emissive: 0x2a1c22 })), glass: curve(new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false })) };
    this.bg = makeBuggy(this.mats); S.add(this.bg.root);
    this.lander = new THREE.Mesh(landerGeometry(), lam()); S.add(this.lander);
    this.lWin = new THREE.Mesh(landerWindowGeometry(), curve(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.8, 0.9), toneMapped: false }))); this.lander.add(this.lWin);
    this.stage = new THREE.Mesh(stageGeometry(), lam()); this.stage.position.set(W.stage.x, W.h(W.stage.x, W.stage.z) - 0.05, W.stage.z); this.stage.rotation.y = W.stage.yaw; S.add(this.stage);
    this.rover = new THREE.Mesh(roverGeometry(), lam()); this.rover.position.set(W.rover.x, W.h(W.rover.x, W.rover.z) - 0.05, W.rover.z); this.rover.rotation.y = W.rover.yaw; S.add(this.rover);
    // footprints wandering round the old stage
    this.feet = new THREE.InstancedMesh(footGeometry(), curve(new THREE.MeshBasicMaterial({ color: 0x2a282e, polygonOffset: true, polygonOffsetFactor: -2 })), 48); this.feet.frustumCulled = false;
    { const o = new THREE.Object3D(); let a = 0.4, x = W.stage.x + 3, z = W.stage.z; for (let i = 0; i < 48; i++) { a += Math.sin(i * 0.7) * 0.35; x += Math.sin(a) * 0.55; z += Math.cos(a) * 0.55; const s = i % 2 ? 1 : -1;
      o.position.set(x + Math.cos(a) * 0.14 * s, W.h(x, z) + 0.05, z - Math.sin(a) * 0.14 * s); o.rotation.set(0, a, 0); o.updateMatrix(); this.feet.setMatrixAt(i, o.matrix); } }
    S.add(this.feet);
    // crates (instanced), their glows (one curved Points), the target beam, the 3D pointer above the buggy, the flag
    this.crates = new THREE.InstancedMesh(crateGeometry(), lam({ emissive: 0x3a1408 }), 6); this.crates.frustumCulled = false; S.add(this.crates);
    const gp = new Float32Array(8 * 3), ga = new Float32Array(8).fill(1), gc = new Float32Array(8 * 3); this.glowA = ga; this.glowP = gp;
    for (let i = 0; i < 8; i++) { const c = i < 6 ? [2.4, 1.5, 0.5] : [1.2, 1.6, 2.4]; gc.set(c, i * 3); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.setAttribute('a', new THREE.BufferAttribute(ga, 1)); gg.setAttribute('c', new THREE.BufferAttribute(gc, 3));
    this.glowU = { uS: { value: 600 }, uT: { value: 0 }, uCurve: WU.uCurve };
    this.glows = new THREE.Points(gg, new THREE.ShaderMaterial({ uniforms: this.glowU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float a; attribute vec3 c; uniform float uS, uT, uCurve; varying float vA; varying vec3 vC; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vec2 d = w.xz - cameraPosition.xz; w.y -= dot(d, d) * uCurve; vec4 mv = viewMatrix * w; vA = a * (0.75 + 0.25 * sin(uT * 3.0 + position.x)); vC = c; gl_PointSize = 3.6 * uS / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = max(0.0, 1.0 - length(d) * 2.0); gl_FragColor = vec4(vC * r * r * vA * 0.8, 1.0); }' }));
    gp.set([W.stage.x, this.stage.position.y + 3.4, W.stage.z, W.rover.x, this.rover.position.y + 2.3, W.rover.z], 18); this.glows.frustumCulled = false; S.add(this.glows);
    this.eggList = [{ id: 'stage', x: W.stage.x, z: W.stage.z, r: 16, g: 6 }, { id: 'rover', x: W.rover.x, z: W.rover.z, r: 13, g: 7 }];
    this.beam = makeBeam(); S.add(this.beam);
    { const sh = new THREE.Shape([[0, 1.1], [0.75, 0.1], [0.3, 0.1], [0.3, -0.8], [-0.3, -0.8], [-0.3, 0.1], [-0.75, 0.1]].map(([x, y]) => new THREE.Vector2(x, y))); const ag = new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false }); ag.rotateX(Math.PI / 2);
      this.pointer = new THREE.Mesh(ag, curve(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.25, 0.35), toneMapped: false }))); this.pointer.renderOrder = 9; S.add(this.pointer); }
    this.flag = makeFlag(curve(new THREE.MeshLambertMaterial({ vertexColors: true }))); this.flag.group.position.set(W.flagAt.x, W.h(W.flagAt.x, W.flagAt.z), W.flagAt.z); this.flag.group.rotation.y = W.earthAz; S.add(this.flag.group);
    this.fx = new Dust(S);
    this.post = ctx.makePost(ctx.renderer, S, ctx.camera, tier); this.postTier = tier;
    // preallocated scratch
    this.v = new THREE.Vector3(); this.v2 = new THREE.Vector3(); this.o3 = new THREE.Object3D(); this.sz = new THREE.Vector2(); this.camL = new THREE.Vector3();
    this.cast = this.terrain.casts; this.nCast = 0;
    this.addRock = (x, y, z, r) => { if (this.nCast >= NC) return; const dx = x - this.b.x, dz = z - this.b.z; if (dx * dx + dz * dz > this.castR2 || (this.castR2 > 1600 && dx * dx + dz * dz <= 1600)) return; this.cast[this.nCast++].set(x, y, z, r * 1.05); };
    this.hitRock = (x, y, z, r) => this.rockHit(x, y, z, r);
    this.b = { x: 0, y: 0, z: 0, yaw: 0, u: 0, vx: 0, vz: 0, vy: 0, ground: true, pitch: 0, roll: 0, steer: 0, jet: 1, spin: 0, hf: 0, hb: 0, hl: 0, hr: 0, wh: new Float32Array(4) };
    this.cam = { x: 0, y: 5, z: 0, yaw: 0, shake: 0 };
    this.resetRun();
    // compile everything now so nothing hitches on TURN THE KEY
    ctx.camera.near = 0.3; ctx.camera.far = 2000; ctx.camera.updateProjectionMatrix(); ctx.renderer.compile(S, ctx.camera);
  }

  // ------------------------------------------------------------------------------------------------ title showroom: the buggy on a small lunar plinth
  makePreview() {   // fits into the free band between the title subtitle and the garage row (same approach as js/modes/space.js), also limited by the screen width
    const g = new THREE.Group(), inner = new THREE.Group(), b = makeBuggy({ body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), glass: new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }) });
    b.root.scale.setScalar(0.91 / 2.75); b.root.position.y = 0.09; b.root.rotation.y = 0.5; inner.add(b.root); g.add(inner);   // the buggy is 2.75 m tall to the dish; inner is 1.0 tall with the plinth
    const rock = new THREE.MeshStandardMaterial({ color: 0x8a8590, roughness: 0.9, flatShading: true });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.66, 0.09, 9), rock); plinth.position.y = 0.045; plinth.renderOrder = -1; inner.add(plinth);
    for (const [a, r, s] of [[0.6, 0.48, 0.07], [2.4, 0.5, 0.05], [4.4, 0.45, 0.06]]) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rock); m.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r); inner.add(m); }   // pebbles on the regolith top
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.635, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.4, 1.9), toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.09; inner.add(ring);
    const v = new THREE.Vector3(), rt = new THREE.Vector3(), band = { key: '', t: 0, top: 0, bot: 0 };
    const readBand = (H) => { const q = document.getElementById('tq'), h1 = document.querySelector('#title h1'), gr = document.getElementById('garage'); if (!h1 || !gr) return false;
      const qr = q && q.offsetHeight && q.textContent.trim() ? q.getBoundingClientRect() : null, top = (qr || h1.getBoundingClientRect()).bottom, bot = gr.getBoundingClientRect().top;
      if (!(bot > top + 30)) return false; band.top = top + Math.min(8, (bot - top) * 0.04); band.bot = bot - Math.min(16, (bot - top) * 0.07); return H > 0; };   // a little extra air above the garage row's name label
    plinth.onBeforeRender = (ren, sc, cam) => {
      const H = ren.domElement.clientHeight || innerHeight, Wd = ren.domElement.clientWidth || innerWidth, key = Wd + 'x' + H, now = performance.now();
      if (band.key !== key || now - band.t > 1000) { band.t = now; if (readBand(H)) band.key = key; else return; }
      const x = g.matrixWorld.elements[12], z = g.matrixWorld.elements[14], cdx = cam.position.x - x, cdz = cam.position.z - z, cl = Math.hypot(cdx, cdz) || 1; let off = 0;
      const py = (y) => (1 - (v.set(x + cdx / cl * off, y, z + cdz / cl * off).project(cam).y + 1) / 2) * H;   // off: the plinth's near rim (lowest on screen), not its centre
      const top = cam.position.y - 0.15;   // search only below the camera: higher points can fall behind a steep title camera and project upside down
      const solve = (px) => { let lo = -3, hi = Math.min(30, top); for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (py(m) > px) lo = m; else hi = m; } return (lo + hi) / 2; };
      let y0 = 0, y1 = 0, h = 1; for (let it = 0; it < 3; it++) { off = 0.66 * h; y0 = Math.max(0, solve(band.bot)); off = 0; y1 = solve(band.top); h = Math.min(4.6, Math.max(0.25, (y1 - y0) * 0.72)); }
      rt.setFromMatrixColumn(cam.matrixWorld, 0); const pxW = (s) => { const a = v.set(x, y0 + s * 0.3, z).addScaledVector(rt, 0.66 * s).project(cam).x, c = v.set(x, y0 + s * 0.3, z).addScaledVector(rt, -0.66 * s).project(cam).x; return Math.abs(a - c) / 2 * Wd; };
      const wpx = pxW(h); if (wpx > Wd * 0.62) h *= Wd * 0.62 / wpx;   // wide phones in portrait: the buggy is wider than tall
      g.userData.fit = { top: band.top, bot: band.bot, y0, y1, h };
      inner.position.y = y0 + h * 0.06; inner.scale.setScalar(h); inner.updateMatrixWorld(true);
    };
    return g;
  }

  // ------------------------------------------------------------------------------------------------ run state
  resetRun() {
    const W = this.world, b = this.b, a = W.earthAz - 0.1;
    Object.assign(b, { x: Math.sin(W.earthAz + 0.9) * 5, z: Math.cos(W.earthAz + 0.9) * 5, yaw: a, u: 7, vy: 0.8, ground: false, pitch: -0.15, roll: 0, steer: 0, jet: 1, spin: 0 });
    b.y = W.h(b.x, b.z) + 1.25; b.vx = Math.sin(a) * b.u; b.vz = Math.cos(a) * b.u;
    Object.assign(this, { phase: 'intro', t: 0, time: 0, battery: BATTERY, got: [false, false, false, false, false, false], nGot: 0, longest: 0, bestAir: 0, jumps: 0, craterJumps: 0, eggs: 0, dist: 0,
      air: { t0: 0, x0: 0, z0: 0, crater: null, big: false }, fired: new Set(), counted: new Set(), toastQ: [], radioQ: [], toastCd: 0, radioCd: 1.0, idleT: 0, fillI: 0, flagT: -1, cardAt: -1, card: false, hushT: 0, flash: 0,
      prevJet: false, jetBurst: 0, jetOn: false, earthEl: 0, landT: 0, lastAirShow: 0, plantedOk: false, bonk: 0 });
    b.ground = false; this.air.t0 = 0; this.air.x0 = b.x; this.air.z0 = b.z;
    this.terrain.reset(b.x, b.z); this.fx.life.fill(0);
    const c = this.cam; c.yaw = b.yaw; c.x = b.x - Math.sin(b.yaw) * 9; c.z = b.z - Math.cos(b.yaw) * 9; c.y = W.h(c.x, c.z) + 4; c.shake = 0;
    this.flag.group.visible = false; this.flag.group.scale.set(1, 0.01, 1);
    for (let i = 0; i < 6; i++) this.glowA[i] = 1; this.glows.geometry.attributes.a.needsUpdate = true;
  }

  start() {
    const ctx = this.ctx; this.resetRun(); this.buildUI(); this.startAudio();
    if (ctx.tier !== this.postTier) { this.post = ctx.makePost(ctx.renderer, this.scene, ctx.camera, ctx.tier); this.postTier = ctx.tier; }
    const sz = ctx.renderer.getSize(this.sz); this.resize(sz.x, sz.y, ctx.renderer.getPixelRatio());
    this.hello();
  }
  hello() {
    const ctx = this.ctx; ctx.labels({ boost: 'DRIVE', brake: 'BRAKE', drift: 'JUMP' }); ctx.count('moon-drive');
    ctx.hud.toast('WHAT IF YOU DROVE ON THE MOON?', '1/6 GRAVITY · GRAB 6 SNACK CRATES', 2.6); this.toastCd = 2.4;
    this.radio(R.hi + (ctx.isTouch ? ' Hold DRIVE to go, JUMP to hop.' : ' W to drive, Space to hop.'), 4.5);
  }
  retry() { this.hideCard(); this.resetRun(); this.hello(); }
  stop() { this.stopAudio(); this.phase = 'idle'; this.card = false; this.ctx.hud.boost(1, false, false); this.ctx.ui.innerHTML = ''; this.el = null; }
  resize(w, h, pr) { if (this.post) this.post.setSize(w, h, pr); this.fx.mat.uniforms.scale.value = h * pr * 0.9; this.glowU.uS.value = h * pr * 0.5; }

  // ------------------------------------------------------------------------------------------------ fixed step
  step(dt) {
    const inp = this.ctx.input, b = this.b; this.t += dt;
    const live = this.phase === 'play' || this.phase === 'intro';
    if (this.phase === 'intro' && b.ground) this.phase = 'play';
    if (live) { this.time += dt; this.battery = Math.max(0, this.battery - dt); }
    this.queues(dt); this.flash = Math.max(0, this.flash - dt * 2); this.cam.shake *= Math.exp(-4 * dt); this.bonk -= dt;
    // controls
    const drive = live && this.battery > 0 && inp.boost, brake = live ? inp.brake : 0.6, jetHeld = live && inp.handbrake, jetPress = jetHeld && !this.prevJet; this.prevJet = jetHeld;
    b.steer = damp(b.steer, live ? inp.steer : 0, 7, dt);
    // the four wheel contact heights -> the ground under the buggy
    this.wheelHeights(b.x, b.z, b.yaw);
    if (b.ground) {
      const s = (b.hf - b.hb) / WB; let a = -G * s / Math.sqrt(1 + s * s) - 0.22 * b.u;
      if (drive) a += ACC * Math.max(0, 1 - b.u / VMAX) + (b.u < 0 ? 6 : 0);
      if (brake > 0.05) { if (b.u > 0.4) a -= 9 * brake; else if (live && !drive) a += (-4 - b.u) * 2.5; else b.u *= Math.exp(-6 * dt); }
      b.u = clamp(b.u + a * dt, -4.5, VMAX + 4);
      const yr = -b.steer * 1.55 * Math.min(1, Math.abs(b.u) / 4) * Math.sign(b.u || 1) * (1 - 0.3 * Math.min(1, Math.abs(b.u) / VMAX)); b.yaw += yr * dt;
      b.vx = Math.sin(b.yaw) * b.u; b.vz = Math.cos(b.yaw) * b.u;
      b.jet = Math.min(1, b.jet + 0.15 * dt);
      if (jetPress && b.jet >= JET_COST) { b.jet -= JET_COST; b.vy = Math.max(b.vy, 0) + JET_HOP; b.ground = false; this.takeoff(true); this.jetPuff(14); }
    } else {
      b.yaw -= b.steer * 0.7 * dt;   // a little air control
      if (jetHeld && b.jet > 0.01) { b.vy += 1.3 * dt; b.jet = Math.max(0, b.jet - 0.32 * dt); if (Math.random() < 0.5) this.jetPuff(1); }
      if (drive) { b.vx += Math.sin(b.yaw) * 0.6 * dt; b.vz += Math.cos(b.yaw) * 0.6 * dt; }   // the jet nudges forward a touch
    }
    this.jetOn = !b.ground && jetHeld && b.jet > 0.01 || this.jetBurst > 0; this.jetBurst = Math.max(0, (this.jetBurst || 0) - dt);
    // move, then the ground
    const px = b.x, pz = b.z; b.x += b.vx * dt; b.z += b.vz * dt; this.dist += Math.hypot(b.x - px, b.z - pz);
    this.collide();
    this.wheelHeights(b.x, b.z, b.yaw); const g1 = (b.hf + b.hb) / 2;
    if (b.ground) {
      const free = b.y + b.vy * dt - G * dt * dt;
      if (g1 < free - 0.015 && b.vy > -0.5) { b.ground = false; b.vy -= G * dt; b.y = free; this.takeoff(false); }
      else { b.vy = clamp((g1 - b.y) / dt, -6, 9); b.y = g1; }
    } else {
      b.vy -= G * dt; b.y += b.vy * dt;
      if (b.y <= g1) this.land(g1);
    }
    // the wheels kick dust that flies on a clean arc and drops straight down (no air): drag 0, gravity 1.62
    b.spin += (b.ground ? b.u : b.u * 0.995) * dt / 0.45; if (!b.ground) b.u *= Math.exp(-0.05 * dt);
    if (b.ground && Math.abs(b.u) > 1.5 && this.t > 0.2) { const k = Math.min(1, Math.abs(b.u) / VMAX), n = Math.random() < k * 0.45 ? 1 : 0; for (let i = 0; i < n; i++) this.dust(i % 2 ? 2 : 3, k); }
    // crates, the flag, eggs, the crater, beats
    if (this.phase === 'play') this.goals(dt);
    if (this.flagT >= 0) { this.flagT += dt; const k = smooth(0, 0.9, this.flagT); this.flag.group.scale.set(1, Math.max(0.01, k), 1); }
    if (this.cardAt > 0 && this.t >= this.cardAt) { this.cardAt = -1; this.showCard(); }
    if (this.hushT > 0) this.hushT -= dt;
    this.terrain.update(b.x, b.z, 1);
    this.fx.update(dt);
  }
  wheelHeights(x, z, yaw) {
    const b = this.b, W = this.world, c = Math.cos(yaw), s = Math.sin(yaw), wh = b.wh;
    for (let i = 0; i < 4; i++) { const lx = WHEELS[i][0], lz = WHEELS[i][1]; wh[i] = W.h(x + lx * c + lz * s, z - lx * s + lz * c); }
    b.hf = (wh[0] + wh[1]) / 2; b.hb = (wh[2] + wh[3]) / 2; b.hl = (wh[0] + wh[2]) / 2; b.hr = (wh[1] + wh[3]) / 2;
  }
  takeoff(jet) { const b = this.b, a = this.air; a.t0 = this.t; a.x0 = b.x; a.z0 = b.z; a.crater = null; a.big = false; if (jet) { this.jetBurst = 0.35; this.jetHiss(); } }
  land(g1) {
    const b = this.b, a = this.air, A = this.ctx.audio, imp = -b.vy, airT = this.t - a.t0, d = Math.hypot(b.x - a.x0, b.z - a.z0);
    b.y = g1; b.ground = true; b.u = b.vx * Math.sin(b.yaw) + b.vz * Math.cos(b.yaw); if (imp > 3) b.u *= 0.93; b.vy = 0;
    if (imp > 1.2) { this.thump(Math.min(1, imp / 6)); this.cam.shake = Math.max(this.cam.shake, Math.min(0.9, imp * 0.12)); for (let i = 0; i < Math.min(18, 4 + imp * 3); i++) this.dust(4, Math.min(1, imp / 5)); }
    if (airT > 0.6 && this.phase === 'play') {
      this.jumps++; if (d > this.longest) this.longest = d; if (airT > this.bestAir) this.bestAir = airT;
      const cleared = a.crater && Math.hypot(b.x - a.crater.x, b.z - a.crater.z) > a.crater.r * 0.9;
      if (airT > 2 && !cleared && d < 50) this.ctx.hud.plus(`${Math.round(d)} M JUMP`);
      if (d >= 50 && !this.counted.has('j50')) { this.counted.add('j50'); this.ctx.count('moon-jump50'); this.toast('MOON JUMP!', `${Math.round(d)} M IN ${airT.toFixed(1)} S OF AIR`); A.finish(true); this.flash = 0.4; }
      if (airT > 1.4 && !this.fired.has('jump')) { this.fired.add('jump'); this.radio(R.jump); }
      if (a.crater && Math.hypot(b.x - a.crater.x, b.z - a.crater.z) > a.crater.r * 0.9) { this.craterJumps++; this.toast('CRATER CLEARED!', `${Math.round(a.crater.r * 2)} M ACROSS`); A.chime(9); if (!this.fired.has('crater')) { this.fired.add('crater'); this.radio(R.crater); } }
    }
    this.landT = this.t;
  }
  collide() {
    const b = this.b, W = this.world;
    this.terrain.near(b.x, b.z, this.hitRock);
    this.cyl(0, 0, 2.3, 3.4); this.cyl(W.stage.x, W.stage.z, 2.0, this.stage.position.y + 3); this.cyl(W.rover.x, W.rover.z, 1.4, this.rover.position.y + 1.2);
  }
  cyl(x, z, r, top) { const b = this.b, dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz), m = r + 1.3; if (d < m && d > 1e-3 && b.y < top) { b.x = x + dx / d * m; b.z = z + dz / d * m; this.bounce(dx / d, dz / d); } }
  rockHit(x, y, z, r) {
    const b = this.b, dx = b.x - x, dz = b.z - z, d2 = dx * dx + dz * dz, m = r * 0.9 + 1.2; if (d2 >= m * m || b.y > y + r * 0.62) return;
    const d = Math.sqrt(d2) || 1e-3; b.x = x + dx / d * m; b.z = z + dz / d * m; this.bounce(dx / d, dz / d);
  }
  bounce(nx, nz) {   // reflect the velocity off a rock / prop
    const b = this.b, vn = b.vx * nx + b.vz * nz; if (vn >= 0) return; b.vx -= 1.5 * vn * nx; b.vz -= 1.5 * vn * nz; b.u = b.vx * Math.sin(b.yaw) + b.vz * Math.cos(b.yaw);
    if (-vn > 2 && this.bonk <= 0) { this.bonk = 0.6; this.ctx.audio.crash(Math.min(10, -vn)); this.cam.shake = Math.max(this.cam.shake, 0.5); if (this.phase === 'play') this.ctx.hud.plus('BONK', 'hit'); for (let i = 0; i < 8; i++) this.dust(4, 0.6); }
  }
  goals(dt) {
    const b = this.b, W = this.world, A = this.ctx.audio, a = this.air;
    for (let i = 0; i < 6; i++) { if (this.got[i]) continue; const c = W.crates[i], dx = b.x - c.x, dz = b.z - c.z; if (dx * dx + dz * dz < PICK * PICK && Math.abs(b.y + 0.8 - (c.y + 1.4)) < 3.2) this.collect(i); }
    // over a big crater bowl in the air -> a crater jump if we land past its rim
    if (!b.ground && !a.crater) { const C = this.world.bonus; if (Math.hypot(b.x - C.x, b.z - C.z) < C.r * 0.55) a.crater = C; else { const ix = Math.floor(b.x / 90), iz = Math.floor(b.z / 90); for (let p = -1; p <= 1 && !a.crater; p++) for (let q = -1; q <= 1; q++) { const c = W.crater(ix + p, iz + q, false); if (c && c.r > 9 && Math.hypot(b.x - c.x, b.z - c.z) < c.r * 0.55) { a.crater = c; break; } } } }
    // the hush: the first long airtime goes quiet
    if (!b.ground && this.t - a.t0 > 1.6 && !this.fired.has('quiet')) { this.fired.add('quiet'); this.hushT = 3.4; this.toast('QUIET MOON', 'NO AIR · NO SOUND', 2.4); this.radio(R.quiet, 4.5); }
    // easter eggs
    for (const q of this.eggList) {
      if (this.fired.has(q.id) || (b.x - q.x) ** 2 + (b.z - q.z) ** 2 > q.r * q.r) continue;
      this.fired.add(q.id); this.eggs++; this.glowA[q.g] = 0; this.glows.geometry.attributes.a.needsUpdate = true; this.ctx.count('moon-egg-' + q.id);
      if (q.id === 'stage') { this.toast('HISTORIC SITE', '1969 · STILL HERE', 2.4); this.radio(R.stage, 5); this.radio(R.stage2, 5); A.chime(11); }
      else { this.toast('OLD ROVER', 'STILL PARKED', 2.2); this.radio(R.rover, 4.5); A.chime(10); }
    }
    // speed and earthrise beats
    if (Math.abs(b.u) > 14 && !this.fired.has('speed') && this.time > 8) { this.fired.add('speed'); this.radio(R.speed); }
    if (this.earthEl > 0.12 && !this.fired.has('rise')) { this.fired.add('rise'); this.radio(R.rise, 4.5); }
    // the flag at the lander once every crate is in
    if (this.nGot === 6 && this.flagT < 0) { const dx = b.x - W.flagAt.x, dz = b.z - W.flagAt.z; if (dx * dx + dz * dz < 64) this.plant(); }
    if (this.battery <= 0 && this.cardAt < 0 && !this.card) { this.phase = 'done'; this.toast('BATTERY FLAT', 'COASTING TO A STOP', 2); this.radio(R.flat); A.alarm(); this.cardAt = this.t + 2.6; }
    // idle beats: a fact when the radio has been quiet a while
    this.idleT += dt; if (this.idleT > 7.5 && !this.radioQ.length && this.radioCd < -1 && this.fillI < FILL.length) { const k = FILL[this.fillI++]; if (!this.fired.has(k)) { this.fired.add(k); this.radio(R[k]); } }
  }
  collect(i) {
    const c = this.world.crates[i], A = this.ctx.audio; this.got[i] = true; this.nGot++; this.glowA[i] = 0; this.glows.geometry.attributes.a.needsUpdate = true;
    A.chime(this.nGot + 3); this.ctx.hud.plus(`SNACK ${this.nGot}/6`, 'near'); this.battery = Math.min(BATTERY, this.battery + 4); this.cam.shake = Math.max(this.cam.shake, 0.25); this.flash = 0.25;
    for (let k = 0; k < 26; k++) { const a = Math.random() * 6.283, s = 1 + Math.random() * 3; this.fx.emit(c.x, c.y + 1.4, c.z, Math.cos(a) * s, 1.5 + Math.random() * 3, Math.sin(a) * s, { life: 1.6, size: 0.35, grow: -0.5, drag: 0, grav: G, r: 1, g: 0.75, b: 0.3, add: 1 }); }
    if (this.nGot === 6) { this.ctx.count('moon-crates'); this.toast('ALL 6 CRATES!', 'BACK TO THE LANDER · PLANT THE FLAG', 2.4); this.radio(R.allc); A.finish(true); }
    else if (this.nGot === 1) this.toast('SNACK CRATE!', 'FOLLOW THE ARROW TO THE NEXT', 1.8);
  }
  plant() {
    const A = this.ctx.audio; this.flagT = 0; this.flag.group.visible = true; this.phase = 'done'; this.plantedOk = true; this.ctx.count('moon-flag');
    A.finish(true); A.chime(12); A.thud(); this.flash = 0.7; this.cam.shake = 0.4; this.toast('FLAG PLANTED', 'SNACK BASE IS OPEN', 2.4); this.radio(R.flag, 4.5); this.cardAt = this.t + 3.0;
    try { const best = +localStorage.getItem('wis-moon-best') || 0; this.isBest = !best || this.time < best; if (this.isBest) localStorage.setItem('wis-moon-best', this.time.toFixed(2)); } catch (e) { this.isBest = false; }
  }
  dust(kind, k) {   // 2/3: wheel roost (rear wheels), 4: landing ring. Life = the flight time back to the launch height, so no floor test is needed
    const b = this.b, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    if (kind === 4) { const a = Math.random() * 6.283, sp = 1 + Math.random() * 3 * (0.5 + k), vy = 0.6 + Math.random() * 2.2 * k; this.fx.emit(b.x + Math.cos(a) * 1.2, b.y + 0.1, b.z + Math.sin(a) * 1.2, Math.cos(a) * sp, vy, Math.sin(a) * sp, { life: 2 * vy / G, size: 0.3 + Math.random() * 0.3, grow: 0.8, drag: 0, grav: G, r: 0.58, g: 0.56, b: 0.56 }); return; }
    const w = WHEELS[kind], wx = b.x + w[0] * c + w[1] * s, wz = b.z - w[0] * s + w[1] * c, vy = 1.2 + Math.random() * 2.6 * k, back = -(1 + Math.random() * 2) * Math.sign(b.u);
    this.fx.emit(wx, b.y + 0.15, wz, s * back + (Math.random() - 0.5) * 1.2 + b.vx * 0.6, vy, c * back + (Math.random() - 0.5) * 1.2 + b.vz * 0.6, { life: 2 * vy / G, size: 0.18 + Math.random() * 0.22, grow: 0.8, drag: 0, grav: G, r: 0.55, g: 0.53, b: 0.52 });
  }
  jetPuff(n) { const b = this.b; for (let i = 0; i < n; i++) this.fx.emit(b.x + (Math.random() - 0.5) * 1.2, b.y + 0.3, b.z + (Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 3, -2 - Math.random() * 3, (Math.random() - 0.5) * 3, { life: 0.5, size: 0.5, grow: 2, drag: 0, grav: 0, r: 1, g: 0.75, b: 0.45, add: 1 }); }

  // ------------------------------------------------------------------------------------------------ messages (queued so beats never trample each other)
  toast(big, small, dur = 1.9) { this.toastQ.push([big, small, dur]); }
  radio(text, dur = 3.8) { this.radioQ.push([text, dur]); }
  queues(dt) {
    this.toastCd -= dt; this.radioCd -= dt; const h = this.ctx.hud;
    if (this.toastCd <= 0 && this.toastQ.length) { const [b, s, d] = this.toastQ.shift(); h.toast(b, s, d); this.toastCd = Math.min(d, 1.6); }
    if (this.radioCd <= 0 && this.radioQ.length) { const [t, d] = this.radioQ.shift(); h.radio(t, d); this.ctx.audio.voice(t); this.ping(); this.radioCd = 1.4 + t.length / 26; this.idleT = 0; }
  }

  // ------------------------------------------------------------------------------------------------ render
  render(dt) {
    const ctx = this.ctx, cam = ctx.camera, b = this.b, W = this.world, t = this.t;
    if (ctx.tier !== this.postTier) { this.postTier = ctx.tier; this.post = ctx.makePost(ctx.renderer, this.scene, cam, ctx.tier); const sz = ctx.renderer.getSize(this.sz); this.post.setSize(sz.x, sz.y, ctx.renderer.getPixelRatio()); }
    // the buggy: chassis on the four wheel heights when grounded, flight attitude in the air; wheels follow the ground or hang
    const g = this.bg, cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
    const tp = b.ground ? -Math.atan2(b.hf - b.hb, WB) : clamp(-Math.atan2(b.vy, Math.max(4, Math.abs(b.u))) * 0.5, -0.5, 0.5), tr = b.ground ? Math.atan2(b.hl - b.hr, TRACK) : 0;
    b.pitch = damp(b.pitch, tp, b.ground ? 14 : 2.5, dt); b.roll = damp(b.roll, tr + b.steer * Math.min(1, Math.abs(b.u) / VMAX) * 0.05, b.ground ? 14 : 2, dt);
    g.root.position.set(b.x, b.y, b.z); g.root.rotation.set(0, b.yaw, 0); g.chassis.rotation.set(b.pitch, 0, b.roll, 'YXZ');
    for (let i = 0; i < 4; i++) {
      const w = g.wheels[i];
      // wheel height in the root frame: the chassis plane through the 4 contacts puts each wheel on its own ground point (within the suspension travel)
      const plane = -Math.sin(b.pitch) * w.z + Math.sin(b.roll) * w.x;   // where the rigid chassis carries this corner
      const off = b.ground ? clamp(b.wh[i] - b.y, plane - 0.3, plane + 0.3) : plane - 0.18;
      w.piv.position.y = 0.45 + off; w.piv.rotation.y = i < 2 ? b.steer * 0.42 : 0; w.spin.rotation.x = b.spin;
    }
    g.arms[0].rotation.z = 0.1 + b.steer * 0.25; g.arms[1].rotation.z = -0.1 + b.steer * 0.25; g.kid.rotation.y = -b.steer * 0.12; g.kid.position.y = 0.2 + (b.ground ? 0 : 0.04);
    // camera: a scripted swing for the first 2 s, then a chase that stays above the ground and clear of crater rims
    const portrait = cam.aspect < 0.8, c = this.cam, air = b.ground ? 0 : smooth(0.3, 1.2, t - this.air.t0);
    c.yaw = damp(c.yaw, b.yaw + (b.u < -0.5 ? Math.PI : 0), b.ground ? 3.2 : 1.2, dt);
    const back = (portrait ? 10.5 : 8.2) + air * 2.5, up = (portrait ? 4.3 : 3.2) + air * 1.2;
    let tx = b.x - Math.sin(c.yaw) * back, tz = b.z - Math.cos(c.yaw) * back, ty = b.y + up;
    ty = Math.max(ty, W.h(tx, tz) + 1.8, W.h((tx + b.x) / 2, (tz + b.z) / 2) + 1.6);
    if (this.phase === 'intro' || t < 2.2) { const k = smooth(0.2, 2.2, t), a = b.yaw + Math.PI + 0.75, ix = b.x + Math.sin(a) * 7, iz = b.z + Math.cos(a) * 7; tx = lerp(ix, tx, k); tz = lerp(iz, tz, k); ty = lerp(W.h(ix, iz) + 1.6, ty, k); c.x = tx; c.y = ty; c.z = tz; }
    else { c.x = damp(c.x, tx, 5, dt); c.z = damp(c.z, tz, 5, dt); c.y = damp(c.y, ty, 4, dt); c.y = Math.max(c.y, W.h(c.x, c.z) + 1.5); }
    const sh = c.shake * c.shake, n1 = Math.sin(t * 37) + Math.sin(t * 23.7), n2 = Math.sin(t * 31.3) + Math.sin(t * 19.1);
    cam.position.set(c.x + n1 * sh * 0.12, c.y + n2 * sh * 0.1, c.z); cam.up.set(0, 1, 0);
    this.camL.set(b.x + Math.sin(c.yaw) * 3.5, b.y + 1.1 + air * 0.6, b.z + Math.cos(c.yaw) * 3.5); cam.lookAt(this.camL);
    cam.fov = damp(cam.fov, (portrait ? 70 : 60) + Math.max(0, Math.abs(b.u) - 10) * 0.6, 3, dt); cam.near = 0.3; cam.far = 2000; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    // sky: stars and sun follow the camera; Earth rises as we drive toward it (over the toy curve)
    const sk = this.sky, el = clamp(0.005 + (b.x * W.earthXZ.x + b.z * W.earthXZ.z) / 650, -0.05, 0.45); this.earthEl = el;
    sk.stars.position.copy(cam.position); sk.sun.position.copy(this.SUN).multiplyScalar(1400).add(cam.position);
    const ce = Math.cos(el); sk.earth.position.set(Math.sin(W.earthAz) * ce, Math.sin(el), Math.cos(W.earthAz) * ce).multiplyScalar(1000).add(cam.position); sk.halo.position.copy(sk.earth.position); sk.earth.rotation.y = t * 0.01;
    this.terrain.U.uEarthDir.value.set(Math.sin(W.earthAz) * ce, Math.max(0.2, Math.sin(el)), Math.cos(W.earthAz) * ce).normalize();
    this.sunL.position.copy(this.SUN).multiplyScalar(60).add(g.root.position); this.sunL.target.position.copy(g.root.position); this.sunL.target.updateMatrixWorld();
    this.fill.position.copy(this.terrain.U.uEarthDir.value).multiplyScalar(60).add(g.root.position); this.fill.target.position.copy(g.root.position); this.fill.target.updateMatrixWorld();
    // crates bob and spin; glows; the beam and the pointer at the nearest target
    let tgt = -1, best = 1e18;
    for (let i = 0; i < 6; i++) { const p = W.crates[i], o = this.o3; o.position.set(p.x, p.y + 1.2 + Math.sin(t * 1.8 + i) * 0.25, p.z); o.rotation.set(0.15, t * 0.9 + i, 0); o.scale.setScalar(this.got[i] ? 0 : 1); o.updateMatrix(); this.crates.setMatrixAt(i, o.matrix); this.glowP[i * 3] = p.x; this.glowP[i * 3 + 1] = p.y + 1.3; this.glowP[i * 3 + 2] = p.z;
      if (!this.got[i]) { const d = (p.x - b.x) ** 2 + (p.z - b.z) ** 2; if (d < best) { best = d; tgt = i; } } }
    this.crates.instanceMatrix.needsUpdate = true; this.glows.geometry.attributes.position.needsUpdate = true; this.glowU.uT.value = t;
    let tx2, tz2; if (tgt >= 0) { tx2 = W.crates[tgt].x; tz2 = W.crates[tgt].z; } else { tx2 = W.flagAt.x; tz2 = W.flagAt.z; }
    const showT = (this.phase === 'play' || this.phase === 'intro') && !(tgt < 0 && this.flagT >= 0);
    this.beam.visible = showT; this.pointer.visible = showT && this.t > 1.5;
    if (showT) { this.beam.position.set(tx2, W.h(tx2, tz2), tz2); this.beam.material.uniforms.uCol.value.setRGB(tgt >= 0 ? 2.2 : 0.9, tgt >= 0 ? 1.6 : 2.0, tgt >= 0 ? 0.5 : 0.8); const ang = Math.atan2(tx2 - b.x, tz2 - b.z); this.pointer.position.set(b.x, b.y + 3.3 + Math.sin(t * 3) * 0.12, b.z); this.pointer.rotation.set(0, ang, 0); }
    this.tgtD = Math.hypot(tx2 - b.x, tz2 - b.z); this.tgtA = Math.atan2(tx2 - b.x, tz2 - b.z); this.tgtCrate = tgt >= 0;
    this.lWin.material.color.setRGB(2.2, 1.8 + 0.3 * Math.sin(t * 2), 0.9);
    // shadow casters for the terrain shader
    this.fillCasts();
    this.hudUpdate();
    this.audioUpdate();
    const u = this.post.uniforms;
    if (u) {
      this.v.copy(this.SUN).multiplyScalar(1400).add(cam.position).project(cam); u.sun.value.set(this.v.x * 0.5 + 0.5, this.v.y * 0.5 + 0.5);
      u.sunVis.value = this.v.z < 1 && Math.abs(this.v.x) < 1.1 && Math.abs(this.v.y) < 1.1 ? 0.8 : 0; u.time.value = (t % 10) + 1; u.speed.value = Math.max(0, (Math.abs(b.u) - 13) / 7) * 0.3; u.hit.value = this.bonk > 0 ? this.bonk * 0.5 : 0;
    }
    this.post.render();
  }
  fillCasts() {
    const b = this.b, W = this.world, C = this.cast, cy = Math.cos(b.yaw), sy = Math.sin(b.yaw), up = Math.cos(b.pitch);
    this.nCast = 0;
    const by = b.y; this.put(b.x, by + 0.75 * up, b.z, 1.05); this.put(b.x + sy * 1.15, by + 0.65, b.z + cy * 1.15, 0.8); this.put(b.x - sy * 1.1, by + 1.0, b.z - cy * 1.1, 0.72);
    this.put(b.x - sy * 0.15, by + 1.3, b.z - cy * 0.15, 0.48); this.put(b.x - 0.62 * cy + sy * 0.85, by + 2.6, b.z + 0.62 * sy + cy * 0.85, 0.42);
    for (let i = 0; i < 4; i++) { const w = WHEELS[i]; this.put(b.x + w[0] * cy + w[1] * sy, by + 0.4 + this.bg.wheels[i].piv.position.y - 0.45, b.z - w[0] * sy + w[1] * cy, 0.42); }
    if (this.near(0, 0, 90)) { this.put(0, W.h(0, 0) + 2.6, 0, 2.35); this.put(0, W.h(0, 0) + 4.7, 0, 1.75); }
    if (this.near(W.stage.x, W.stage.z, 90)) this.put(W.stage.x, this.stage.position.y + 2.2, W.stage.z, 2.0);
    if (this.near(W.rover.x, W.rover.z, 90)) this.put(W.rover.x, this.rover.position.y + 0.9, W.rover.z, 1.25);
    if (this.flag.group.visible) this.put(W.flagAt.x + 0.6 * Math.cos(W.earthAz), this.flag.group.position.y + 2.2, W.flagAt.z - 0.6 * Math.sin(W.earthAz), 0.45);
    for (let i = 0; i < 6; i++) { const p = W.crates[i]; if (!this.got[i] && this.near(p.x, p.z, 70)) this.put(p.x, p.y + 1.25, p.z, 0.72); }
    this.castR2 = 1600; this.terrain.near(b.x, b.z, this.addRock); this.castR2 = 4900; this.terrain.near(b.x, b.z, this.addRock);
    for (let i = this.nCast; i < NC; i++) C[i].set(0, -9999, 0, 0.01);
  }

  put(x, y, z, r) { if (this.nCast < NC) this.cast[this.nCast++].set(x, y, z, r); }
  near(x, z, r) { return (x - this.b.x) ** 2 + (z - this.b.z) ** 2 < r * r; }

  // ------------------------------------------------------------------------------------------------ HUD
  buildUI() {
    const ui = this.ctx.ui; ui.innerHTML = ''; const st = document.createElement('style'); st.textContent = CSS; ui.appendChild(st);
    const h = document.createElement('div'); h.id = 'mnhud';
    h.innerHTML = `<div id="mnTop"><div class="c"><small>CRATES</small><b id="mnC">0/6</b></div><div class="c"><small>KM/H</small><b id="mnS">0</b></div>
      <div class="c n"><small id="mnNl">NEXT</small><div class="row"><span id="mnArr"></span><b id="mnD">0</b></div></div>
      <div class="c f"><small>BATTERY</small><div class="bar" id="mnBat"><i></i></div><small class="j">JUMP JET</small><div class="bar jet" id="mnJet"><i></i></div></div></div>
      <div id="mnAir"><b id="mnAirT">0.0 S</b><span id="mnAirD">0 M</span></div><div id="mnKeys">A D STEER · W DRIVE · S BRAKE / REVERSE · SPACE JUMP JET</div><div id="mnFlash"></div><div id="mnCard"></div>`;
    ui.appendChild(h); this.hud = h; const $ = (id) => h.querySelector('#' + id);
    this.el = { c: $('mnC'), s: $('mnS'), d: $('mnD'), nl: $('mnNl'), arr: $('mnArr'), bat: $('mnBat'), batI: $('mnBat').firstChild, jetI: $('mnJet').firstChild, air: $('mnAir'), airT: $('mnAirT'), airD: $('mnAirD'), flash: $('mnFlash'), card: $('mnCard'), keys: $('mnKeys') };
    this.cache = {};
  }
  set(k, v, e, prop = 'textContent') { if (this.cache[k] !== v) { this.cache[k] = v; e[prop] = v; } }
  hudUpdate() {
    const e = this.el; if (!e) return; const b = this.b, cam = this.ctx.camera;
    this.set('c', `${this.nGot}/6`, e.c); this.set('s', String(Math.round(Math.abs(b.u) * 3.6)), e.s);
    this.set('nl', this.tgtCrate ? 'NEXT' : 'FLAG', e.nl); this.set('d', fmtD(this.tgtD), e.d);
    const fw = Math.atan2(this.camL.x - cam.position.x, this.camL.z - cam.position.z), rel = Math.round(((this.tgtA - fw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 20) / 20;
    this.set('arr', `rotate(${(-rel).toFixed(2)}rad)`, e.arr.style, 'transform');
    this.set('bat', (this.battery / BATTERY * 100).toFixed(1) + '%', e.batI.style, 'width'); if (this.cache.bl !== (this.battery < 20)) { this.cache.bl = this.battery < 20; e.bat.classList.toggle('low', this.cache.bl); }
    this.set('jet', (b.jet * 100).toFixed(1) + '%', e.jetI.style, 'width');
    this.ctx.hud.boost(this.battery / BATTERY, this.battery <= 0, this.ctx.input.boost && this.battery > 0);
    const at = this.t - this.air.t0, showAir = !b.ground && at > 0.5 && this.phase === 'play';
    if (showAir !== this.cache.sa) { this.cache.sa = showAir; e.air.classList.toggle('on', showAir); }
    if (showAir) { this.set('at', `AIR ${at.toFixed(1)} S`, e.airT); this.set('ad', `${Math.round(Math.hypot(b.x - this.air.x0, b.z - this.air.z0))} M`, e.airD); }
    e.flash.style.opacity = (this.flash * 0.5).toFixed(2);
    if (this.t > 12 && !this.cache.kf) { this.cache.kf = true; e.keys.style.opacity = '0.35'; }
  }

  // ------------------------------------------------------------------------------------------------ result card
  hideCard() { if (!this.el) return; this.card = false; this.el.card.className = ''; this.el.card.innerHTML = ''; this.hud.classList.remove('carded'); }
  showCard() {
    if (this.card || !this.el) return; this.card = true; this.phase = 'card'; const A = this.ctx.audio, ok = this.plantedOk, e = this.el.card;
    const brag = ok ? 'SNACK BASE BUILT!' : this.nGot >= 4 ? 'CRATE CRUSHER' : this.longest >= 50 ? 'MOON JUMPER' : this.nGot >= 1 ? 'MOON ROOKIE' : 'STILL BY THE LANDER';
    let best = 0; try { best = +localStorage.getItem('wis-moon-best') || 0; } catch (x) { /* private window */ }
    const line = ok ? `I drove a buggy on the Moon, grabbed all 6 snack crates and planted the flag in ${fmtT(this.time)}. Longest jump ${Math.round(this.longest)} m.`
      : `I drove on the Moon, grabbed ${this.nGot} of 6 snack crates and jumped ${Math.round(this.longest)} m in one-sixth gravity.`;
    e.innerHTML = `<small>MOON BUGGY · DRIVE LOG</small><h2>${brag}</h2><div class="big">${this.nGot}/6 <span>CRATES</span></div>
      <div class="sub">${ok ? (this.isBest ? 'NEW BEST · ' : best ? `BEST ${fmtT(best)} · ` : '') + 'FLAG PLANTED' : 'THE FLAG IS STILL IN THE BUGGY'}</div>
      <div class="st"><div><b>${fmtT(this.time)}</b><span>TIME</span></div><div><b>${Math.round(this.longest)} M</b><span>LONGEST JUMP</span></div><div><b>${this.bestAir.toFixed(1)} S</b><span>BEST AIR</span></div><div><b>${this.craterJumps}</b><span>CRATERS</span></div></div>
      <div class="eggs">${this.fired.has('stage') ? '<span class="y">1969 SITE</span>' : '<span>1969 SITE ?</span>'}${this.fired.has('rover') ? '<span class="y">OLD ROVER</span>' : '<span>OLD ROVER ?</span>'}${this.fired.has('quiet') ? '<span class="y">QUIET MOON</span>' : '<span>QUIET MOON ?</span>'}</div>
      <p>${line} Beat that.</p><div class="btns"><button type="button" class="pri" data-a="r">RETRY</button><button type="button" data-a="b">BACK TO THE CITY</button></div>`;
    e.querySelector('[data-a="r"]').addEventListener('click', () => { A.whoosh(1); this.retry(); });
    e.querySelector('[data-a="b"]').addEventListener('click', () => { A.whoosh(1); this.ctx.exit(); });
    e.className = 'on'; this.hud.classList.add('carded'); A.finish(ok || this.nGot >= 3);
    window.__moonCard = { crates: this.nGot, time: +this.time.toFixed(1), longest: Math.round(this.longest), air: +this.bestAir.toFixed(1), flag: ok, craters: this.craterJumps, eggs: this.eggs };
  }

  // ------------------------------------------------------------------------------------------------ sound: a muffled cabin (we only hear the buggy through the seat), motor hum, wheel crunch, jet hiss, thumps, radio pings
  startAudio() {
    const A = this.ctx.audio, c = A && A.ctx; if (!c || this.snd || !A.noiseBuf) return;
    this.musicWas = A.music; A.music = false;
    const bus = c.createGain(), lp = c.createBiquadFilter(); bus.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.6; bus.connect(lp); lp.connect(A.master); bus.gain.setTargetAtTime(1, c.currentTime, 0.4);
    const osc = (type, f, g, to) => { const o = c.createOscillator(), gn = c.createGain(); o.type = type; o.frequency.value = f; gn.gain.value = g; o.connect(gn); gn.connect(to); o.start(); return o; };
    const humG = c.createGain(); humG.gain.value = 0; humG.connect(bus); const h1 = osc('sine', 62, 0.6, humG), h2 = osc('triangle', 124, 0.25, humG);
    const whF = c.createBiquadFilter(); whF.type = 'bandpass'; whF.frequency.value = 600; whF.Q.value = 3; const whG = c.createGain(); whG.gain.value = 0; whF.connect(whG); whG.connect(bus); const wh = osc('sawtooth', 180, 1, whF);
    const loop = (type, f, q, to) => { const s = c.createBufferSource(); s.buffer = A.noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(to); s.start(); return { s, g, fl }; };
    const crunch = loop('bandpass', 520, 1.4, bus), hiss = loop('highpass', 2400, 0.7, A.sfx);
    this.snd = { c, bus, lp, humG, whG, wh, crunch, hiss, all: [h1, h2, wh, crunch.s, hiss.s] };
  }
  audioUpdate() {
    const S = this.snd; if (!S) return; const t = S.c.currentTime, b = this.b, k = Math.min(1, Math.abs(b.u) / VMAX), on = this.phase !== 'card', drive = this.ctx.input.boost && this.battery > 0 && on;
    S.bus.gain.setTargetAtTime(this.hushT > 0 ? 0.06 : 1, t, this.hushT > 0 ? 0.25 : 0.8);
    S.humG.gain.setTargetAtTime(on ? 0.035 + 0.04 * k : 0.015, t, 0.2); S.wh.frequency.setTargetAtTime(150 + k * 520, t, 0.1); S.whG.gain.setTargetAtTime(drive ? 0.02 + 0.03 * k : 0.004, t, 0.12);
    S.crunch.g.gain.setTargetAtTime(b.ground && on ? 0.05 + 0.2 * k : 0, t, 0.06); S.crunch.fl.frequency.setTargetAtTime(380 + 500 * k + Math.random() * 120, t, 0.05);
    S.hiss.g.gain.setTargetAtTime(this.jetOn && this.hushT <= 0 ? 0.09 : 0, t, 0.05);
  }
  thump(v) { const A = this.ctx.audio, S = this.snd; if (!A.ctx || !S) return; const t = A.ctx.currentTime; A.tone(70, t, 0.35, 'sine', 0.5 * v + 0.15, S.bus, 0.5); A.noise(t, 0.25, 0.25 * v + 0.05, 300, 'lowpass', S.bus); }
  jetHiss() { const A = this.ctx.audio; if (!A.ctx || this.hushT > 0) return; A.noise(A.ctx.currentTime, 0.35, 0.18, 2600, 'highpass'); }
  ping() { const A = this.ctx.audio; if (!A.ctx) return; const t = A.ctx.currentTime; A.tone(1568, t, 0.09, 'sine', 0.06); A.tone(2093, t + 0.1, 0.12, 'sine', 0.05); }
  stopAudio() {
    const A = this.ctx.audio, S = this.snd; if (A && this.musicWas !== undefined) { A.music = this.musicWas; if (A.ctx) A.nextBeat = A.ctx.currentTime + 0.1; }
    if (!S) return; this.snd = null; S.bus.gain.setTargetAtTime(0, S.c.currentTime, 0.1); S.hiss.g.gain.setTargetAtTime(0, S.c.currentTime, 0.05);
    setTimeout(() => { for (const n of S.all) { try { n.stop(); } catch (e) { /* already stopped */ } } try { S.lp.disconnect(); S.hiss.g.disconnect(); } catch (e) { /* ok */ } }, 600);
  }
}

// dust with no air: no floor bounce (particles live exactly their flight time), drawn by the shared Particles shader
class Dust extends Particles {
  update(dt) {
    const p = this.pos, v = this.vel;
    for (let i = 0; i < this.life.length; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt; const t = 1 - this.life[i] / this.max[i], k = Math.exp(-this.drag[i] * dt);
      v[i * 3] *= k; v[i * 3 + 1] = v[i * 3 + 1] * k - this.grav[i] * dt; v[i * 3 + 2] *= k; p[i * 3] += v[i * 3] * dt; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt;
      this.alpha[i] = Math.min(1, (1 - t) * 3) * (t < 0.06 ? t / 0.06 : 1); this.sz[i] = this.size[i] * (1 + t * this.grow[i]);
    }
    const a = this.geo.attributes; a.position.needsUpdate = a.alpha.needsUpdate = a.psize.needsUpdate = a.color.needsUpdate = true;
  }
}

const CSS = `
#mnhud{position:absolute;inset:0;font-family:var(--f);color:var(--cream)}
#mnTop{position:absolute;top:max(10px,var(--sa-top));left:calc(max(10px,var(--sa-left)) + 50px);right:max(10px,var(--sa-right));max-width:560px;margin-left:auto;display:flex;align-items:stretch;gap:2px;padding:5px 6px;height:50px;box-sizing:border-box;background:rgba(20,26,58,.84);border-radius:12px;box-shadow:0 3px 0 rgba(0,0,0,.35)}
#mnTop .c{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;padding:0 7px;border-right:1px solid rgba(255,244,230,.12);line-height:1}
#mnTop .c:last-child{border-right:0}
#mnTop small{font-size:10px;font-weight:900;letter-spacing:.12em;color:var(--sun);margin-bottom:3px;white-space:nowrap;overflow:hidden}
#mnTop b{font-size:clamp(16px,4.6vw,22px);font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}
#mnTop i{font-style:normal;font-size:10px;font-weight:900;letter-spacing:.1em;opacity:.75;margin-top:2px}
#mnTop .n{flex:1.25}#mnTop .n b{font-size:clamp(14px,4vw,20px)}
#mnTop .row{display:flex;align-items:center;gap:5px}
#mnArr{width:18px;height:18px;flex:none;position:relative}
#mnArr::before{content:"";position:absolute;left:3px;top:0;border-bottom:16px solid var(--sun);border-left:6px solid transparent;border-right:6px solid transparent}
#mnTop .f{flex:1.2}#mnTop .f small{margin-bottom:2px}#mnTop .f small.j{margin:3px 0 2px}
#mnTop .bar{height:7px;border-radius:4px;background:rgba(255,244,230,.15);overflow:hidden}
#mnTop .bar i{display:block;height:100%;width:100%;margin:0;background:#5fe0a8;border-radius:4px}
#mnTop .bar.jet i{background:#9fd8ff}#mnTop .bar.low i{background:var(--coral)}
#mnAir{position:absolute;left:50%;top:max(41%,calc(var(--hudb,150px) + 120px));transform:translate(-50%,-50%) scale(.8);opacity:0;transition:opacity .2s,transform .2s;text-align:center;text-shadow:0 3px 0 var(--navy)}
#mnAir.on{opacity:1;transform:translate(-50%,-50%)}
#mnAir b{display:block;font-size:clamp(22px,6.4vw,34px);font-weight:900;letter-spacing:.04em;color:var(--sun);font-variant-numeric:tabular-nums}
#mnAir span{display:block;font-size:14px;font-weight:900;letter-spacing:.12em}
#mnKeys{position:absolute;left:50%;bottom:max(14px,var(--sa-bottom));transform:translateX(-50%);font:800 11px var(--f);letter-spacing:.1em;opacity:.8;text-shadow:0 1px 0 rgba(0,0,0,.6);white-space:nowrap;transition:opacity .6s}
.touch #mnKeys{display:none}
#mnFlash{position:absolute;inset:0;background:#fff4e6;opacity:0;mix-blend-mode:screen;pointer-events:none}
#mnhud.carded #mnAir{display:none}
#mnCard{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100% - 28px));max-height:calc(100% - 24px);overflow:auto;padding:16px 16px 14px;box-sizing:border-box;text-align:center;pointer-events:auto;background:rgba(20,26,58,.96);border-radius:18px;box-shadow:0 8px 0 rgba(0,0,0,.35);display:none}
#mnCard.on{display:block;animation:mnIn .35s cubic-bezier(.2,1.4,.4,1)}
#mnCard>small{display:block;font:900 11px var(--f);letter-spacing:.16em;color:var(--sun)}
#mnCard h2{margin:6px 0 2px;font:900 clamp(24px,7vw,34px)/1.05 var(--f);text-shadow:0 3px 0 var(--coral)}
#mnCard .big{font:900 clamp(36px,11vw,54px)/1 var(--f);margin-top:6px;font-variant-numeric:tabular-nums}#mnCard .big span{font-size:.36em;letter-spacing:.12em;vertical-align:middle}
#mnCard .sub{font:800 12px var(--f);letter-spacing:.1em;color:#9fd8ff;margin-top:4px}
#mnCard .st{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0 8px}#mnCard .st div{background:#1f2756;border-radius:10px;padding:7px 2px}
#mnCard .st b{display:block;font:900 17px var(--f);color:var(--sun);white-space:nowrap}#mnCard .st span{display:block;font:800 10px/1.15 var(--f);letter-spacing:.06em;margin-top:2px}
#mnCard .eggs{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin:4px 0}
#mnCard .eggs span{padding:5px 9px;border-radius:999px;background:rgba(255,244,230,.08);font:900 10px var(--f);letter-spacing:.08em;opacity:.55}#mnCard .eggs span.y{background:var(--sun);color:var(--navy);opacity:1}
#mnCard p{margin:8px 4px 10px;font:800 13px/1.35 var(--f)}
#mnCard .btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#mnCard button{min-height:46px;border:0;border-radius:12px;font:900 13px var(--f);letter-spacing:.05em;cursor:pointer;background:var(--cream);color:var(--navy);box-shadow:0 4px 0 rgba(0,0,0,.35)}
#mnCard button.pri{background:var(--sun);box-shadow:0 4px 0 #c99a1c}
#mnCard button:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.35)}
@media (max-height:520px){#mnCard{width:min(94vw,600px);padding:10px 12px}#mnCard h2{font-size:22px}#mnCard .big{font-size:32px;margin-top:2px}#mnCard .st{margin:6px 0 4px}#mnCard p{margin:4px;font-size:12px}#mnAir{top:36%}}
@keyframes mnIn{from{transform:translate(-50%,-50%) scale(.85);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
`;
