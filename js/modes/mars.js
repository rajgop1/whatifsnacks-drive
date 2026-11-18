// MARS ROVER: "What if you drove on Mars?" Drive a cute six-wheeled rover (the hoodie mascot at the wheel, a dish on a mast, a snack crate on the back) over seeded,
// streamed butterscotch sand: dunes with slip faces, dark basalt, a canyon rim, a big ramp dune, tyre tracks that stay in the sand, dust devils that wander and
// tumble you, thin haze, a butterscotch sky with a blue glow round the small Sun, and a dust storm at about 40 s ("FOLLOW THE BEACON").
// Grab 6 snack crates, find the old tiny rover and the Olympus Mons sign-post, then plant the flag at the lander.
// Contract: js/modes/README.md. World and art: js/modes/mars_world.js. Structure copied from js/modes/moon.js.
// Controls (touch has five): steer, DRIVE (boost / W / Up), BRAKE (brake / S, hold when stopped to reverse), HOP (drift / Space: a spring hop on the ground; recharges on the ground).
//
// FACTS (radio lines; checked numbers and sources):
//  - Surface gravity 3.71 m/s², Earth 9.81: 3.71 / 9.81 = 37.8%. Moon 1.62, so Mars pulls 3.71 / 1.62 = 2.3x harder:     NASA Mars Fact Sheet (nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html)
//    the same hop hangs 2.3x shorter than on the Moon (airtime = 2v/g).                                                  NASA Moon Fact Sheet, projectile motion
//  - A sol (solar day) is 24 h 39 min 35 s (24.6597 h).                                                                    NASA Mars Fact Sheet: length of day 24.6597 h
//  - A Mars year is 687 Earth days.                                                                                         NASA Mars Fact Sheet: orbital period 686.98 d
//  - Surface pressure about 6.36 mb, under 1% of Earth's 1,014 mb; the air is about 95% carbon dioxide.                     NASA Mars Fact Sheet
//  - Average temperature about -60 °C (-80 °F).                                                                             NASA Science "Mars: Facts"
//  - Olympus Mons rises about 22 km (21.9 km above the datum, MOLA), about 2.5x Everest's 8.85 km.                          NASA Science / USGS MOLA topography; 22 / 8.85 = 2.5
//  - Valles Marineris is about 4,000 km long.                                                                               NASA Science "Valles Marineris"
//  - The daytime sky is butterscotch (dust); sunsets look blue round the Sun (dust scatters blue light forward).            NASA JPL, Curiosity sunset images (2015) and Mars sky explainers
//  - Dust devils are real; gusts cleaned the solar panels of the Spirit and Opportunity rovers.                             NASA JPL, Spirit/Opportunity "cleaning events" (2005 onwards)
//  - The strongest Martian storm winds reach about 100 km/h (60 mph), but with air about 1% as dense they push far less.    NASA "The Fact and Fiction of Martian Dust Storms" (2015)
//  - Light takes about 3 to 22 minutes to cross from Earth to Mars, depending on where the planets are.                     NASA Mars Exploration "Mars Close Approach" / mission communications pages
//  - Ingenuity made the first powered, controlled flight on another planet on 19 April 2021.                                NASA JPL Ingenuity Mars Helicopter
//  - Perseverance's microphones measured the speed of sound near the surface at about 240 m/s (Earth: 343 m/s),            Maurice et al., Nature 605, 653-658 (2022)
//    and sound there is much quieter.
//  - Sojourner, the first Mars rover (Mars Pathfinder, landed 4 July 1997), was about the size of a microwave oven (65 cm); NASA JPL Mars Pathfinder mission pages
//    the lander bounced down on airbags.
//  - A dune's steep downwind side is its slip face, where sand slides (about 30 to 35 degrees, the angle of repose).        USGS / NASA HiRISE dune explainers
import * as THREE from 'three';
import { Particles } from '../fx.js';
import { clamp, damp, lerp, smooth } from '../util.js';
import { World, Terrain, G, U as WU, curve, makeRover, WHEELS, landerGeometry, landerWindowGeometry, oldRoverGeometry, makeSign, crateGeometry, makeFlag, makeSky, makeBeam, devilGeometry, devilMaterial, makeStreaks, trackMaterial, makeMarsPost, NC } from './mars_world.js';

const VMAX = 16, ACC = 7.5, WB = 2.5, TRACK = 2.16, BATTERY = 150, PICK = 3.6, HOP = 3.0, HOP_COST = 0.4, SUN_EL = 0.2, STORM_AT = 38, STORM_LEN = 14, NT = 720;
const R = {
  hi: 'Welcome to Mars! Gravity\'s 38% of Earth\'s here, so you\'re floaty, just not Moon-floaty. Grab the six snack crates.',
  g: 'Gravity here is 3.71 metres per second squared. That\'s about 38% of Earth\'s.',
  jump: 'On the Moon that hop would\'ve lasted more than twice as long. Mars pulls 2.3 times harder.',
  ramp: 'Nice dune jump! The steep side of a dune is its slip face. That\'s where the sand slides down.',
  sol: 'A day here, a sol, lasts 24 hours, 39 minutes and 35 seconds. Forty bonus minutes, every day.',
  air: 'The air\'s under 1% as thick as Earth\'s, and it\'s mostly carbon dioxide. Keep the helmet on.',
  cold: 'It\'s about minus 60 degrees on average out here. Good thing you wore the hoodie.',
  sky: 'See the sky? Butterscotch all day. At sunset it goes blue round the Sun. Dust does that.',
  lag: 'Confession: this radio cheats. Light takes 3 to 22 minutes to get from Earth to Mars, so a real chat would lag that long.',
  heli: 'In 2021 a little helicopter called Ingenuity flew here. First powered flight on another planet.',
  year: 'A year on Mars lasts 687 Earth days. Your birthday would only come round every couple of Earth years.',
  sound: 'Perseverance\'s microphones found sound here is quieter and slower, about 240 metres a second.',
  canyon: 'That\'s a canyon! Mars has a monster one, Valles Marineris. It\'s about 4,000 km long.',
  devil: 'Dust devil! They\'re real here. A few even blew the dust off old rovers\' solar panels. Free car wash.',
  storm: 'Dust storm! Visibility\'s dropping. Follow the beacon and take it easy.',
  storm2: 'Storm\'s passing. The strongest winds here hit about 100 km/h, but the air\'s so thin it\'s more of a shove than a punch.',
  olympus: 'Ha! Olympus Mons is 22 km tall, about two and a half Everests. This little pile is, um, smaller.',
  rover: 'An old rover! The first one on Mars, Sojourner, rolled out in 1997. It was about the size of a microwave.',
  rover2: 'Its lander bounced down on giant airbags. That\'s what those saggy lumps are.',
  allc: 'That\'s all six crates! Head back to the lander and plant the flag.',
  flag: 'Flag planted! See it flutter? There\'s wind here, it\'s just very thin.',
  flat: 'Battery\'s flat and the panels are dusty. We\'re coasting now.',
};
const FILL = ['g', 'sky', 'sol', 'air', 'lag', 'cold', 'heli', 'sound', 'year'];
const fmtD = (m) => (m < 1000 ? `${Math.round(m)} M` : `${(m / 1000).toFixed(1)} KM`), fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const FOG0 = new THREE.Color(1.0, 0.47, 0.2), FOGS = new THREE.Color(0.6, 0.28, 0.13), FD0 = 0.0042, FDS = 0.034;

export default class MarsMode {
  constructor(ctx) { this.ctx = ctx; this.phase = 'idle'; }

  // ------------------------------------------------------------------------------------------------ build once
  load() {
    const ctx = this.ctx, tier = ctx.tier, S = (this.scene = new THREE.Scene()); this.tier = tier;
    S.background = FOG0.clone(); S.fog = new THREE.FogExp2(FOG0.clone(), FD0);
    const W = (this.world = new World(ctx.DAY || 1));
    const saz = W.az + 0.45; this.SUN = new THREE.Vector3(Math.sin(saz) * Math.cos(SUN_EL), Math.sin(SUN_EL), Math.cos(saz) * Math.cos(SUN_EL));
    this.sunL = new THREE.DirectionalLight(0xffe4c8, 3.0); S.add(this.sunL, this.sunL.target);
    this.hemi = new THREE.HemisphereLight(0xffb98a, 0x7a3a22, 1.7); S.add(this.hemi);
    this.terrain = new Terrain(S, W, tier, this.SUN);
    this.sky = makeSky(S, this.SUN);
    const lam = (o = {}) => curve(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...o }));
    this.mats = { body: curve(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, emissive: 0x2a1c16 })), glass: curve(new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.22, roughness: 0.05, depthWrite: false })) };
    this.rv = makeRover(this.mats); S.add(this.rv.root);
    this.lander = new THREE.Mesh(landerGeometry(), lam()); this.lander.rotation.y = W.az; S.add(this.lander);
    this.lWin = new THREE.Mesh(landerWindowGeometry(), curve(new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.8, 0.9), toneMapped: false }))); this.lander.add(this.lWin);
    this.old = new THREE.Mesh(oldRoverGeometry(), lam()); this.old.position.set(W.oldRover.x, W.h(W.oldRover.x, W.oldRover.z) - 0.03, W.oldRover.z); this.old.rotation.y = W.oldRover.yaw; S.add(this.old);
    this.signM = makeSign(lam()); this.signM.group.position.set(W.sign.x, W.h(W.sign.x, W.sign.z) - 0.05, W.sign.z); this.signM.group.rotation.y = W.sign.yaw; S.add(this.signM.group);
    // crates, glows (one curved Points: 6 crates + 2 eggs), the beam, the pointer, the flag
    this.crates = new THREE.InstancedMesh(crateGeometry(), lam({ emissive: 0x3a1408 }), 6); this.crates.frustumCulled = false; S.add(this.crates);
    const gp = new Float32Array(8 * 3), ga = new Float32Array(8).fill(1), gc = new Float32Array(8 * 3); this.glowA = ga; this.glowP = gp;
    for (let i = 0; i < 8; i++) gc.set(i < 6 ? [2.6, 1.6, 0.5] : [0.9, 1.6, 2.6], i * 3);
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.setAttribute('a', new THREE.BufferAttribute(ga, 1)); gg.setAttribute('c', new THREE.BufferAttribute(gc, 3));
    this.glowU = { uS: { value: 600 }, uT: { value: 0 }, uCurve: WU.uCurve };
    this.glows = new THREE.Points(gg, new THREE.ShaderMaterial({ uniforms: this.glowU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float a; attribute vec3 c; uniform float uS, uT, uCurve; varying float vA; varying vec3 vC; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vec2 d = w.xz - cameraPosition.xz; w.y -= dot(d, d) * uCurve; vec4 mv = viewMatrix * w; vA = a * (0.75 + 0.25 * sin(uT * 3.0 + position.x)); vC = c; gl_PointSize = 3.6 * uS / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = max(0.0, 1.0 - length(d) * 2.0); gl_FragColor = vec4(vC * r * r * vA * 0.8, 1.0); }' }));
    gp.set([W.oldRover.x, this.old.position.y + 1.6, W.oldRover.z, W.sign.x, this.signM.group.position.y + 3.6, W.sign.z], 18); this.glows.frustumCulled = false; S.add(this.glows);
    this.eggList = [{ id: 'oldrover', x: W.oldRover.x + 2, z: W.oldRover.z, r: 13, g: 6 }, { id: 'olympus', x: W.sign.x, z: W.sign.z, r: 11, g: 7 }];
    this.beam = makeBeam(); S.add(this.beam);
    { const sh = new THREE.Shape([[0, 1.1], [0.75, 0.1], [0.3, 0.1], [0.3, -0.8], [-0.3, -0.8], [-0.3, 0.1], [-0.75, 0.1]].map(([x, y]) => new THREE.Vector2(x, y))); const ag = new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: false }); ag.rotateX(Math.PI / 2);
      this.pointer = new THREE.Mesh(ag, curve(new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.1, 0.12), toneMapped: false, fog: false }))); this.pointer.renderOrder = 9; S.add(this.pointer); }
    this.flag = makeFlag(curve(new THREE.MeshLambertMaterial({ vertexColors: true }))); this.flag.group.position.set(W.flagAt.x, W.h(W.flagAt.x, W.flagAt.z), W.flagAt.z); this.flag.group.rotation.y = W.az + 1.2; S.add(this.flag.group);
    // dust devils, streaks, tyre tracks, dust
    const dg = devilGeometry(), dm = devilMaterial(); this.devM = []; this.dev = [];
    for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(dg, dm); m.frustumCulled = false; m.renderOrder = 6; S.add(m); this.devM.push(m); this.dev.push({ x: 0, z: 0, ox: 0, oz: 0, cd: 0, p: { x: 0, z: 0 } }); }
    this.streaks = makeStreaks(tier === 'low' ? 120 : 260); S.add(this.streaks);
    const tm = trackMaterial(), tg = new THREE.PlaneGeometry(0.34, 0.6); tg.rotateX(-Math.PI / 2);
    this.tracks = new THREE.InstancedMesh(tg, tm.mat, NT); this.tracks.frustumCulled = false; this.tracks.renderOrder = -1; S.add(this.tracks);
    this.fx = new MarsDust(S);
    this.post = makeMarsPost(ctx.renderer, S, ctx.camera, tier); this.postTier = tier;
    // preallocated scratch
    this.v = new THREE.Vector3(); this.o3 = new THREE.Object3D(); this.sz = new THREE.Vector2(); this.camL = new THREE.Vector3(); this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
    this.cast = this.terrain.casts; this.nCast = 0;
    this.addRock = (x, y, z, r) => { if (this.nCast >= NC) return; const dx = x - this.b.x, dz = z - this.b.z; if (dx * dx + dz * dz > 1600) return; this.cast[this.nCast++].set(x, y, z, r * 1.05); };
    this.hitRock = (x, y, z, r) => this.rockHit(x, y, z, r);
    this.b = { x: 0, y: 0, z: 0, yaw: 0, u: 0, vx: 0, vz: 0, vy: 0, ground: true, pitch: 0, roll: 0, steer: 0, hop: 1, spin: 0, hf: 0, hb: 0, hl: 0, hr: 0, hm: 0, wh: new Float32Array(6) };
    this.cam = { x: 0, y: 5, z: 0, yaw: 0, shake: 0 };
    this.resetRun();
    ctx.camera.near = 0.3; ctx.camera.far = 2000; ctx.camera.updateProjectionMatrix(); ctx.renderer.compile(S, ctx.camera);
  }

  // ------------------------------------------------------------------------------------------------ title showroom: the rover on a small sand plinth (fit logic copied from moon.js)
  makePreview() {
    const g = new THREE.Group(), inner = new THREE.Group(), r = makeRover({ body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), glass: new THREE.MeshStandardMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.25, roughness: 0.05, depthWrite: false }) });
    r.root.scale.setScalar(0.91 / 3.2); r.root.position.y = 0.09; r.root.rotation.y = 0.5; inner.add(r.root); g.add(inner);
    const sand = new THREE.MeshStandardMaterial({ color: 0xd9824a, roughness: 0.95, flatShading: true }), rock = new THREE.MeshStandardMaterial({ color: 0x5a3428, roughness: 0.9, flatShading: true });
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.66, 0.09, 9), sand); plinth.position.y = 0.045; plinth.renderOrder = -1; inner.add(plinth);
    for (const [a, rr, s] of [[0.6, 0.48, 0.07], [2.4, 0.5, 0.05], [4.4, 0.45, 0.06]]) { const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rock); m.position.set(Math.cos(a) * rr, 0.1, Math.sin(a) * rr); inner.add(m); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.635, 0.012, 6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.9, 1.1, 0.5), toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.09; inner.add(ring);
    const v = new THREE.Vector3(), rt = new THREE.Vector3(), band = { key: '', t: 0, top: 0, bot: 0 };
    const readBand = (H) => { const q = document.getElementById('tq'), h1 = document.querySelector('#title h1'), gr = document.getElementById('garage'); if (!h1 || !gr) return false;
      const qr = q && q.offsetHeight && q.textContent.trim() ? q.getBoundingClientRect() : null, top = (qr || h1.getBoundingClientRect()).bottom, bot = gr.getBoundingClientRect().top;
      if (!(bot > top + 30)) return false; band.top = top + Math.min(8, (bot - top) * 0.04); band.bot = bot - Math.min(16, (bot - top) * 0.07); return H > 0; };
    plinth.onBeforeRender = (ren, sc, cam) => {
      const H = ren.domElement.clientHeight || innerHeight, Wd = ren.domElement.clientWidth || innerWidth, key = Wd + 'x' + H, now = performance.now();
      if (band.key !== key || now - band.t > 1000) { band.t = now; if (readBand(H)) band.key = key; else return; }
      const x = g.matrixWorld.elements[12], z = g.matrixWorld.elements[14], cdx = cam.position.x - x, cdz = cam.position.z - z, cl = Math.hypot(cdx, cdz) || 1; let off = 0;
      const py = (y) => (1 - (v.set(x + cdx / cl * off, y, z + cdz / cl * off).project(cam).y + 1) / 2) * H;
      const top = cam.position.y - 0.15;
      const solve = (px) => { let lo = -3, hi = Math.min(30, top); for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (py(m) > px) lo = m; else hi = m; } return (lo + hi) / 2; };
      let y0 = 0, y1 = 0, h = 1; for (let it = 0; it < 3; it++) { off = 0.66 * h; y0 = Math.max(0, solve(band.bot)); off = 0; y1 = solve(band.top); h = Math.min(4.6, Math.max(0.25, (y1 - y0) * 0.72)); }
      rt.setFromMatrixColumn(cam.matrixWorld, 0); const pxW = (s) => { const a = v.set(x, y0 + s * 0.3, z).addScaledVector(rt, 0.66 * s).project(cam).x, c = v.set(x, y0 + s * 0.3, z).addScaledVector(rt, -0.66 * s).project(cam).x; return Math.abs(a - c) / 2 * Wd; };
      const wpx = pxW(h); if (wpx > Wd * 0.62) h *= Wd * 0.62 / wpx;
      g.userData.fit = { top: band.top, bot: band.bot, y0, y1, h };
      inner.position.y = y0 + h * 0.06; inner.scale.setScalar(h); inner.updateMatrixWorld(true);
    };
    return g;
  }

  // ------------------------------------------------------------------------------------------------ run state
  resetRun() {
    const W = this.world, b = this.b, a = Math.atan2(W.ramp.dx, W.ramp.dz);
    Object.assign(b, { x: W.start.x, z: W.start.z, yaw: a, u: 6, vy: 0.6, ground: false, pitch: -0.12, roll: 0, steer: 0, hop: 1, spin: 0 });
    b.y = W.h(b.x, b.z) + 1.0; b.vx = Math.sin(a) * b.u; b.vz = Math.cos(a) * b.u;
    Object.assign(this, { phase: 'intro', t: 0, time: 0, battery: BATTERY, got: [false, false, false, false, false, false], nGot: 0, longest: 0, bestAir: 0, jumps: 0, rampJumps: 0, eggs: 0, dist: 0, devils: 0,
      air: { t0: 0, x0: 0, z0: 0, ramp: false, devil: false }, fired: new Set(), counted: new Set(), toastQ: [], radioQ: [], toastCd: 0, radioCd: 1.0, idleT: 0, fillI: 0, flagT: -1, cardAt: -1, card: false, flash: 0,
      prevHop: false, landT: 0, plantedOk: false, bonk: 0, tumble: 0, tumS: 1, storm: { on: false, t: 0, k: 0, done: false }, trackD: 0, trackI: 0, trackDirty: true, devNear: 1e9 });
    this.air.x0 = b.x; this.air.z0 = b.z;
    this.terrain.reset(b.x, b.z); this.fx.life.fill(0);
    for (let i = 0; i < NT; i++) this.tracks.setMatrixAt(i, this.zero);
    for (const d of this.dev) { d.ox = d.oz = 0; d.cd = 0; }
    const c = this.cam; c.yaw = b.yaw; c.x = b.x - Math.sin(b.yaw) * 9; c.z = b.z - Math.cos(b.yaw) * 9; c.y = W.h(c.x, c.z) + 4; c.shake = 0;
    this.flag.group.visible = false; this.flag.group.scale.set(1, 0.01, 1);
    for (let i = 0; i < 8; i++) this.glowA[i] = 1; this.glows.geometry.attributes.a.needsUpdate = true;
    this.applyStorm(0);
  }

  start() {
    const ctx = this.ctx; this.resetRun(); this.buildUI(); this.startAudio();
    if (ctx.tier !== this.postTier) { this.post.dispose(); this.post = makeMarsPost(ctx.renderer, this.scene, ctx.camera, ctx.tier); this.postTier = ctx.tier; }
    const sz = ctx.renderer.getSize(this.sz); this.resize(sz.x, sz.y, ctx.renderer.getPixelRatio());
    this.hello();
  }
  hello() {
    const ctx = this.ctx; ctx.labels({ boost: 'DRIVE', brake: 'BRAKE', drift: 'HOP' }); ctx.count('mars-drive');
    ctx.hud.toast('WHAT IF YOU DROVE ON MARS?', '38% GRAVITY · GRAB 6 SNACK CRATES', 2.6); this.toastCd = 2.4;
    this.radio(R.hi + (ctx.isTouch ? ' Hold DRIVE to go, HOP to bounce.' : ' W to drive, Space to hop.'), 4.5);
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
    const drive = live && this.battery > 0 && inp.boost, brake = live ? inp.brake : 0.6, hopHeld = live && inp.handbrake, hopPress = hopHeld && !this.prevHop; this.prevHop = hopHeld;
    const tum = this.tumble > 0; b.steer = damp(b.steer, live && !tum ? inp.steer : 0, 7, dt);
    this.wheelHeights(b.x, b.z, b.yaw);
    if (b.ground) {
      const s = (b.hf - b.hb) / WB; let a = -G * s / Math.sqrt(1 + s * s) - 0.16 * b.u;
      if (drive) a += ACC * Math.max(0, 1 - b.u / VMAX) + (b.u < 0 ? 6 : 0);
      if (brake > 0.05) { if (b.u > 0.4) a -= 9 * brake; else if (live && !drive) a += (-4 - b.u) * 2.5; else b.u *= Math.exp(-6 * dt); }
      b.u = clamp(b.u + a * dt, -4.5, VMAX + 4);
      const yr = -b.steer * 1.5 * Math.min(1, Math.abs(b.u) / 4) * Math.sign(b.u || 1) * (1 - 0.3 * Math.min(1, Math.abs(b.u) / VMAX)); b.yaw += yr * dt;
      b.vx = Math.sin(b.yaw) * b.u; b.vz = Math.cos(b.yaw) * b.u;
      b.hop = Math.min(1, b.hop + 0.2 * dt);
      if (hopPress && b.hop >= HOP_COST) { b.hop -= HOP_COST; b.vy = Math.max(b.vy, 0) + HOP; b.ground = false; this.takeoff(); this.boing(); for (let i = 0; i < 10; i++) this.dust(4, 0.5); }
    } else {
      b.yaw -= b.steer * 0.6 * dt;
      const k = Math.exp(-0.03 * dt); b.vx *= k; b.vz *= k;   // a whisper of air drag
    }
    if (tum) { this.tumble -= dt; b.yaw += this.tumS * 5.5 * this.tumble * dt; }
    if (this.storm.k > 0) { b.vx += 0.6 * this.storm.k * dt; b.vz += 0.2 * this.storm.k * dt; }   // thin air: the storm wind barely nudges
    const px = b.x, pz = b.z; b.x += b.vx * dt; b.z += b.vz * dt; const ds = Math.hypot(b.x - px, b.z - pz); this.dist += ds;
    this.collide();
    this.wheelHeights(b.x, b.z, b.yaw); const g1 = (b.hf + b.hb) * 0.25 + b.hm * 0.5;
    if (b.ground) {
      const free = b.y + b.vy * dt - G * dt * dt;
      if (g1 < free - 0.015 && b.vy > -0.5) { b.ground = false; b.vy -= G * dt; b.y = free; this.takeoff(); }
      else { b.vy = clamp((g1 - b.y) / dt, -6, 9); b.y = g1; }
    } else {
      b.vy -= G * dt; b.y += b.vy * dt;
      if (b.y <= g1) this.land(g1);
    }
    b.spin += (b.ground ? b.u : b.u * 0.995) * dt / 0.42; if (!b.ground) b.u *= Math.exp(-0.05 * dt);
    // wheel roost: dust hangs a moment in the thin air and drifts downwind
    if (b.ground && Math.abs(b.u) > 1.5 && this.t > 0.2) { const k = Math.min(1, Math.abs(b.u) / VMAX); if (Math.random() < k * 0.5) this.dust(Math.random() < 0.5 ? 4 : 5, k); }
    // tyre tracks: a pair of tread marks behind the rear wheels every 0.5 m on the ground
    if (b.ground) { this.trackD += ds; if (this.trackD > 0.5) { this.trackD = 0; this.mark(4); this.mark(5); } }
    this.devilsStep(dt);
    if (this.phase === 'play') this.goals(dt);
    const S = this.storm;   // once started the storm always runs out (also after the flag)
    if (S.on) { S.t += dt; S.k = smooth(0, 2.5, S.t) * (1 - smooth(STORM_LEN - 3, STORM_LEN, S.t));
      if (S.t >= STORM_LEN) { S.on = false; S.done = true; S.k = 0; this.ctx.count('mars-storm'); if (this.phase === 'play') { this.toast('STORM SURVIVED', 'THE SKY IS BACK', 2); this.radio(R.storm2, 4.5); this.ctx.audio.chime(8); } } }
    if (this.flagT >= 0) { this.flagT += dt; const k = smooth(0, 0.9, this.flagT); this.flag.group.scale.set(1, Math.max(0.01, k), 1); }
    if (this.cardAt > 0 && this.t >= this.cardAt) { this.cardAt = -1; this.showCard(); }
    this.terrain.update(b.x, b.z, 1);
    this.fx.update(dt, this.storm.k);
  }
  wheelHeights(x, z, yaw) {
    const b = this.b, W = this.world, c = Math.cos(yaw), s = Math.sin(yaw), wh = b.wh;
    for (let i = 0; i < 6; i++) { const lx = WHEELS[i][0], lz = WHEELS[i][1]; wh[i] = W.h(x + lx * c + lz * s, z - lx * s + lz * c); }
    b.hf = (wh[0] + wh[1]) / 2; b.hm = (wh[2] + wh[3]) / 2; b.hb = (wh[4] + wh[5]) / 2; b.hl = (wh[0] + wh[2] + wh[4]) / 3; b.hr = (wh[1] + wh[3] + wh[5]) / 3;
  }
  mark(i) {
    const b = this.b, c = Math.cos(b.yaw), s = Math.sin(b.yaw), w = WHEELS[i], x = b.x + w[0] * c + w[1] * s, z = b.z - w[0] * s + w[1] * c, o = this.o3;
    o.position.set(x, this.world.h(x, z) + 0.035, z); o.rotation.set(b.pitch, b.yaw, b.roll, 'YXZ'); o.scale.set(1, 1, 1); o.updateMatrix();
    this.tracks.setMatrixAt(this.trackI, o.matrix); this.trackI = (this.trackI + 1) % NT; this.trackDirty = true;
  }
  takeoff() { const b = this.b, a = this.air; a.t0 = this.t; a.x0 = b.x; a.z0 = b.z; const R0 = this.world.ramp; a.ramp = Math.hypot(b.x - R0.x, b.z - R0.z) < 9; a.devil = this.tumble > 0; }
  land(g1) {
    const b = this.b, a = this.air, A = this.ctx.audio, imp = -b.vy, airT = this.t - a.t0, d = Math.hypot(b.x - a.x0, b.z - a.z0);
    b.y = g1; b.ground = true; b.u = b.vx * Math.sin(b.yaw) + b.vz * Math.cos(b.yaw); if (imp > 3) b.u *= 0.93; b.vy = 0;
    if (imp > 1.2) { this.thump(Math.min(1, imp / 6)); this.cam.shake = Math.max(this.cam.shake, Math.min(0.9, imp * 0.12)); for (let i = 0; i < Math.min(16, 4 + imp * 3); i++) this.dust(4, Math.min(1, imp / 5)); }
    if (airT > 0.6 && this.phase === 'play' && !a.devil) {
      this.jumps++; if (d > this.longest) this.longest = d; if (airT > this.bestAir) this.bestAir = airT;
      if (a.ramp && d > 8) { this.rampJumps++; this.toast('DUNE JUMP!', `${Math.round(d)} M IN ${airT.toFixed(1)} S OF AIR`); A.chime(9); this.flash = 0.3; if (!this.fired.has('ramp')) { this.fired.add('ramp'); this.radio(R.ramp); } }
      else if (airT > 1.2) this.ctx.hud.plus(`${Math.round(d)} M HOP`);
      if (airT > 1.2 && !this.fired.has('jump')) { this.fired.add('jump'); this.radio(R.jump); }
    }
    this.landT = this.t;
  }
  collide() {
    const b = this.b, W = this.world;
    this.terrain.near(b.x, b.z, this.hitRock);
    this.cyl(0, 0, 2.8, 5); this.cyl(W.oldRover.x + 4, W.oldRover.z, 1.0, this.old.position.y + 0.5); this.cyl(W.sign.x, W.sign.z, 0.3, this.signM.group.position.y + 3);
    // the canyon rim: a soft wall keeps the rover on the near side
    const c = W.cs(b.x, b.z); if (c > -3.2) { const p = c + 3.2; b.x -= W.cn.x * p; b.z -= W.cn.z * p; this.bounce(-W.cn.x, -W.cn.z); }
  }
  cyl(x, z, r, top) { const b = this.b, dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz), m = r + 1.4; if (d < m && d > 1e-3 && b.y < top) { b.x = x + dx / d * m; b.z = z + dz / d * m; this.bounce(dx / d, dz / d); } }
  rockHit(x, y, z, r) {
    const b = this.b, dx = b.x - x, dz = b.z - z, d2 = dx * dx + dz * dz, m = r * 0.9 + 1.3; if (d2 >= m * m || b.y > y + r * 0.6) return;
    const d = Math.sqrt(d2) || 1e-3; b.x = x + dx / d * m; b.z = z + dz / d * m; this.bounce(dx / d, dz / d);
  }
  bounce(nx, nz) {
    const b = this.b, vn = b.vx * nx + b.vz * nz; if (vn >= 0) return; b.vx -= 1.5 * vn * nx; b.vz -= 1.5 * vn * nz; b.u = b.vx * Math.sin(b.yaw) + b.vz * Math.cos(b.yaw);
    if (-vn > 2 && this.bonk <= 0) { this.bonk = 0.6; this.ctx.audio.crash(Math.min(10, -vn)); this.cam.shake = Math.max(this.cam.shake, 0.5); if (this.phase === 'play') this.ctx.hud.plus('BONK', 'hit'); for (let i = 0; i < 8; i++) this.dust(4, 0.6); }
  }
  devilsStep(dt) {   // devils wander round their homes and lean toward the rover when it is near; driving into one tumbles you
    const b = this.b, W = this.world; let near = 1e9;
    for (let k = 0; k < 3; k++) {
      const d = this.dev[k]; W.devil(k, this.t + k * 17, d.p); let dx = b.x - (d.p.x + d.ox), dz = b.z - (d.p.z + d.oz), L = Math.hypot(dx, dz);
      if (L < 45 && L > 0.1 && this.phase === 'play') { d.ox += dx / L * 1.6 * dt; d.oz += dz / L * 1.6 * dt; const ol = Math.hypot(d.ox, d.oz); if (ol > 22) { d.ox *= 22 / ol; d.oz *= 22 / ol; } }
      d.x = d.p.x + d.ox; d.z = d.p.z + d.oz; if (W.cs(d.x, d.z) > -6) { d.ox -= W.cn.x * 0.5; d.oz -= W.cn.z * 0.5; }
      dx = b.x - d.x; dz = b.z - d.z; L = Math.hypot(dx, dz); near = Math.min(near, L); d.cd -= dt;
      if (L < 18 && Math.random() < 0.35) { const a = Math.random() * 6.283, r = 0.8 + Math.random() * 2.2; this.fx.emit(d.x + Math.cos(a) * r, W.h(d.x, d.z) + 0.2, d.z + Math.sin(a) * r, -Math.sin(a) * 4, 2 + Math.random() * 3, Math.cos(a) * 4, { life: 1.2, size: 0.4, grow: 1.2, drag: 0.8, grav: 0.3, r: 0.7, g: 0.38, b: 0.2 }); }
      if (L < 3.8 && d.cd <= 0 && this.phase === 'play') this.devilHit(d, dx, dz);
    }
    this.devNear = near;
  }
  devilHit(d, dx, dz) {
    const b = this.b, A = this.ctx.audio; d.cd = 5; this.devils++; this.tumble = 1.1; this.tumS = (dx * Math.cos(b.yaw) - dz * Math.sin(b.yaw)) > 0 ? 1 : -1;
    b.u *= 0.5; b.vx *= 0.5; b.vz *= 0.5; if (b.ground) { b.vy = 1.8; b.ground = false; this.takeoff(); }
    this.battery = Math.max(0, this.battery - 6); this.cam.shake = Math.max(this.cam.shake, 0.8); this.flash = 0.2; A.whoosh(2); A.whoosh(0);
    for (let i = 0; i < 12; i++) { const a = Math.random() * 6.283; this.fx.emit(b.x + Math.cos(a) * 2.2, b.y + 0.3, b.z + Math.sin(a) * 2.2, -Math.sin(a) * 5, 1 + Math.random() * 2, Math.cos(a) * 5, { life: 1.0, size: 0.4, grow: 1.2, drag: 0.8, grav: 0.4, r: 0.7, g: 0.38, b: 0.2 }); }
    this.toast('DUST DEVIL!', 'SPUN AROUND · -6 S BATTERY', 1.8);
    if (!this.counted.has('devil')) { this.counted.add('devil'); this.ctx.count('mars-devil'); }
    if (!this.fired.has('devil')) { this.fired.add('devil'); this.radio(R.devil); }
  }
  goals(dt) {
    const b = this.b, W = this.world, A = this.ctx.audio;
    for (let i = 0; i < 6; i++) { if (this.got[i]) continue; const c = W.crates[i], dx = b.x - c.x, dz = b.z - c.z; if (dx * dx + dz * dz < PICK * PICK && Math.abs(b.y + 0.8 - (c.y + 1.4)) < 3.2) this.collect(i); }
    for (const q of this.eggList) {
      if (this.fired.has(q.id) || (b.x - q.x) ** 2 + (b.z - q.z) ** 2 > q.r * q.r) continue;
      this.fired.add(q.id); this.eggs++; this.glowA[q.g] = 0; this.glows.geometry.attributes.a.needsUpdate = true; this.ctx.count('mars-egg-' + q.id);
      if (q.id === 'oldrover') { this.toast('THE FIRST ROVER', '1997 · MICROWAVE-SIZED', 2.4); this.radio(R.rover, 4.5); this.radio(R.rover2, 4); A.chime(11); }
      else { this.toast('OLYMPUS MONS', '22 KM TALL · NOT THIS ONE', 2.4); this.radio(R.olympus, 4.5); A.chime(10); }
    }
    if (W.cs(b.x, b.z) > -30 && !this.fired.has('canyon')) { this.fired.add('canyon'); this.toast('CANYON RIM', 'DON\'T LOOK DOWN', 1.8); this.radio(R.canyon); }
    // the dust storm
    const S = this.storm;
    if (!S.on && !S.done && this.time >= STORM_AT && this.flagT < 0) { S.on = true; S.t = 0; this.radio(R.storm); A.alarm(); this.cam.shake = 0.5; }
    if (this.nGot === 6 && this.flagT < 0) { const dx = b.x - W.flagAt.x, dz = b.z - W.flagAt.z; if (dx * dx + dz * dz < 64) this.plant(); }
    if (this.battery <= 0 && this.cardAt < 0 && !this.card) { this.phase = 'done'; this.toast('BATTERY FLAT', 'COASTING TO A STOP', 2); this.radio(R.flat); A.alarm(); this.cardAt = this.t + 2.6; }
    this.idleT += dt; if (this.idleT > 7 && !S.on && !this.radioQ.length && this.radioCd < -1 && this.fillI < FILL.length) { const k = FILL[this.fillI++]; if (!this.fired.has(k)) { this.fired.add(k); this.radio(R[k]); } }
  }
  collect(i) {
    const c = this.world.crates[i], A = this.ctx.audio; this.got[i] = true; this.nGot++; this.glowA[i] = 0; this.glows.geometry.attributes.a.needsUpdate = true;
    A.chime(this.nGot + 3); this.ctx.hud.plus(`SNACK ${this.nGot}/6`, 'near'); this.battery = Math.min(BATTERY, this.battery + 4); this.cam.shake = Math.max(this.cam.shake, 0.25); this.flash = 0.25;
    for (let k = 0; k < 24; k++) { const a = Math.random() * 6.283, s = 1 + Math.random() * 3; this.fx.emit(c.x, c.y + 1.4, c.z, Math.cos(a) * s, 1.5 + Math.random() * 3, Math.sin(a) * s, { life: 1.2, size: 0.32, grow: -0.5, drag: 0.6, grav: G, r: 1, g: 0.75, b: 0.3, add: 1 }); }
    if (this.nGot === 6) { this.ctx.count('mars-crates'); this.toast('ALL 6 CRATES!', 'BACK TO THE LANDER · PLANT THE FLAG', 2.4); this.radio(R.allc); A.finish(true); }
    else if (this.nGot === 1) this.toast('SNACK CRATE!', 'FOLLOW THE ARROW TO THE NEXT', 1.8);
  }
  plant() {
    const A = this.ctx.audio; this.flagT = 0; this.flag.group.visible = true; this.phase = 'done'; this.plantedOk = true; this.ctx.count('mars-flag');
    A.finish(true); A.chime(12); A.thud(); this.flash = 0.7; this.cam.shake = 0.4; this.toast('FLAG PLANTED', 'SNACK BASE MARS IS OPEN', 2.4); this.radio(R.flag, 4.5); this.cardAt = this.t + 3.0;
    try { const best = +localStorage.getItem('wis-mars-best') || 0; this.isBest = !best || this.time < best; if (this.isBest) localStorage.setItem('wis-mars-best', this.time.toFixed(2)); } catch (e) { this.isBest = false; }
  }
  dust(kind, k) {   // 4/5: rear wheels; dust hangs in the thin air and drifts with the wind
    const b = this.b, c = Math.cos(b.yaw), s = Math.sin(b.yaw), w = WHEELS[kind], wx = b.x + w[0] * c + w[1] * s, wz = b.z - w[0] * s + w[1] * c, vy = 0.8 + Math.random() * 2 * k, back = -(1 + Math.random() * 2) * Math.sign(b.u || 1);
    this.fx.emit(wx, b.y + 0.15, wz, s * back + (Math.random() - 0.5) * 1.2 + b.vx * 0.4, vy, c * back + (Math.random() - 0.5) * 1.2 + b.vz * 0.4, { life: 1.0 + Math.random() * 0.7, size: 0.25 + Math.random() * 0.3, grow: 1.4, drag: 1.4, grav: 1.2, r: 0.72, g: 0.4, b: 0.22 });
  }

  // ------------------------------------------------------------------------------------------------ messages
  toast(big, small, dur = 1.9) { this.toastQ.push([big, small, dur]); }
  radio(text, dur = 3.8) { this.radioQ.push([text, dur]); }
  queues(dt) {
    this.toastCd -= dt; this.radioCd -= dt; const h = this.ctx.hud;
    if (this.toastCd <= 0 && this.toastQ.length) { const [b, s, d] = this.toastQ.shift(); h.toast(b, s, d); this.toastCd = Math.min(d, 1.6); }
    if (this.radioCd <= 0 && this.radioQ.length) { const [t, d] = this.radioQ.shift(); h.radio(t, d); this.ctx.audio.voice(t); this.ping(); this.radioCd = 1.4 + t.length / 26; this.idleT = 0; }
  }

  // ------------------------------------------------------------------------------------------------ storm look (fog, sky, streaks, overlay)
  applyStorm(k) {
    WU.uStorm.value = k; WU.uFogD.value = lerp(FD0, FDS, k); WU.uFogC.value.copy(FOG0).lerp(FOGS, k);
    const S = this.scene; S.fog.density = WU.uFogD.value; S.fog.color.copy(WU.uFogC.value); S.background.copy(WU.uFogC.value);
    const sm = this.streaks.material.uniforms; sm.uA.value = 0.22 + 0.7 * k; sm.uLen.value = 2.5 + 3 * k; sm.uWind.value.set(5 + 14 * k, 0, 1.5 + 4 * k);
    this.hemi.intensity = 1.7 - 0.5 * k; this.sunL.intensity = 3.0 * (1 - 0.6 * k);
  }

  // ------------------------------------------------------------------------------------------------ render
  render(dt) {
    const ctx = this.ctx, cam = ctx.camera, b = this.b, W = this.world, t = this.t;
    if (ctx.tier !== this.postTier) { this.postTier = ctx.tier; this.post.dispose(); this.post = makeMarsPost(ctx.renderer, this.scene, cam, ctx.tier); const sz = ctx.renderer.getSize(this.sz); this.post.setSize(sz.x, sz.y, ctx.renderer.getPixelRatio()); }
    const sk = this.storm.k; this.applyStorm(sk); WU.uT.value = t % 1000;
    // the rover: chassis on the six wheel heights when grounded, flight attitude in the air, a cartoon wobble while a devil spins it
    const g = this.rv;
    const tp = b.ground ? -Math.atan2(b.hf - b.hb, WB) : clamp(-Math.atan2(b.vy, Math.max(4, Math.abs(b.u))) * 0.5, -0.5, 0.5), tr = b.ground ? Math.atan2(b.hl - b.hr, TRACK) : 0;
    b.pitch = damp(b.pitch, tp, b.ground ? 14 : 2.5, dt); b.roll = damp(b.roll, tr + b.steer * Math.min(1, Math.abs(b.u) / VMAX) * 0.05 + (this.tumble > 0 ? Math.sin(t * 18) * 0.12 * this.tumble : 0), b.ground ? 14 : 2, dt);
    g.root.position.set(b.x, b.y, b.z); g.root.rotation.set(0, b.yaw, 0); g.chassis.rotation.set(b.pitch, 0, b.roll, 'YXZ');
    for (let i = 0; i < 6; i++) {
      const w = g.wheels[i], plane = -Math.sin(b.pitch) * w.z + Math.sin(b.roll) * w.x;
      const off = b.ground ? clamp(b.wh[i] - b.y, plane - 0.3, plane + 0.3) : plane - 0.15;
      w.piv.position.y = 0.42 + off; w.piv.rotation.y = i < 2 ? b.steer * 0.4 : i > 3 ? -b.steer * 0.25 : 0; w.spin.rotation.x = b.spin;
    }
    g.arms[0].rotation.z = 0.1 + b.steer * 0.25; g.arms[1].rotation.z = -0.1 + b.steer * 0.25; g.kid.rotation.y = -b.steer * 0.12;
    // camera: a scripted swing for the first 2 s, then a chase that stays above the ground
    const portrait = cam.aspect < 0.8, c = this.cam, air = b.ground ? 0 : smooth(0.3, 1.2, t - this.air.t0);
    c.yaw = damp(c.yaw, b.yaw + (b.u < -0.5 ? Math.PI : 0), b.ground ? 3.2 : 1.4, dt);
    const back = (portrait ? 10.5 : 8.4) + air * 1.8, up = (portrait ? 4.3 : 3.3) + air * 0.9;
    let tx = b.x - Math.sin(c.yaw) * back, tz = b.z - Math.cos(c.yaw) * back, ty = b.y + up;
    ty = Math.max(ty, W.h(tx, tz) + 1.8, W.h((tx + b.x) / 2, (tz + b.z) / 2) + 1.6);
    if (this.phase === 'intro' || t < 2.2) { const k = smooth(0.2, 2.2, t), a = b.yaw + Math.PI + 0.75, ix = b.x + Math.sin(a) * 7.5, iz = b.z + Math.cos(a) * 7.5; tx = lerp(ix, tx, k); tz = lerp(iz, tz, k); ty = lerp(W.h(ix, iz) + 1.8, ty, k); c.x = tx; c.y = ty; c.z = tz; }
    else { c.x = damp(c.x, tx, 5, dt); c.z = damp(c.z, tz, 5, dt); c.y = damp(c.y, ty, 4, dt); c.y = Math.max(c.y, W.h(c.x, c.z) + 1.5); }
    const sh = c.shake * c.shake, n1 = Math.sin(t * 37) + Math.sin(t * 23.7), n2 = Math.sin(t * 31.3) + Math.sin(t * 19.1);
    cam.position.set(c.x + n1 * sh * 0.12, c.y + n2 * sh * 0.1, c.z); cam.up.set(0, 1, 0);
    this.camL.set(b.x + Math.sin(c.yaw) * 3.5, b.y + 1.3 + air * 0.5, b.z + Math.cos(c.yaw) * 3.5); cam.lookAt(this.camL);
    cam.fov = damp(cam.fov, (portrait ? 70 : 60) + Math.max(0, Math.abs(b.u) - 10) * 0.6, 3, dt); cam.near = 0.3; cam.far = 2000; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    this.sky.position.copy(cam.position);
    this.sunL.position.copy(this.SUN).multiplyScalar(60).add(g.root.position); this.sunL.target.position.copy(g.root.position); this.sunL.target.updateMatrixWorld();
    // devils
    for (let k = 0; k < 3; k++) { const d = this.dev[k], m = this.devM[k]; m.position.set(d.x, W.h(d.x, d.z) - 0.5, d.z); m.rotation.y = t * 2 + k; }
    // crates, glows, the beam and pointer at the nearest target (a bright blue beacon in the storm)
    let tgt = -1, best = 1e18;
    for (let i = 0; i < 6; i++) { const p = W.crates[i], o = this.o3; o.position.set(p.x, p.y + 1.2 + Math.sin(t * 1.8 + i) * 0.25, p.z); o.rotation.set(0.15, t * 0.9 + i, 0); o.scale.setScalar(this.got[i] ? 0 : 1); o.updateMatrix(); this.crates.setMatrixAt(i, o.matrix); this.glowP[i * 3] = p.x; this.glowP[i * 3 + 1] = p.y + 1.3; this.glowP[i * 3 + 2] = p.z;
      if (!this.got[i]) { const d = (p.x - b.x) ** 2 + (p.z - b.z) ** 2; if (d < best) { best = d; tgt = i; } } }
    this.crates.instanceMatrix.needsUpdate = true; this.glows.geometry.attributes.position.needsUpdate = true; this.glowU.uT.value = t;
    if (this.trackDirty) { this.trackDirty = false; this.tracks.instanceMatrix.needsUpdate = true; }
    let tx2, tz2; if (tgt >= 0) { tx2 = W.crates[tgt].x; tz2 = W.crates[tgt].z; } else { tx2 = W.flagAt.x; tz2 = W.flagAt.z; }
    const showT = (this.phase === 'play' || this.phase === 'intro') && !(tgt < 0 && this.flagT >= 0);
    this.beam.visible = showT; this.pointer.visible = showT && this.t > 1.5;
    if (showT) { this.beam.position.set(tx2, W.h(tx2, tz2), tz2); const u = this.beam.material.uniforms, cr = tgt >= 0;
      u.uCol.value.setRGB(lerp(cr ? 2.2 : 0.9, 0.7, sk), lerp(cr ? 1.6 : 2.0, 1.7, sk), lerp(cr ? 0.5 : 0.8, 3.0, sk)); u.uA.value = 1 + 1.6 * sk; this.beam.scale.set(1 + 1.5 * sk, 1, 1 + 1.5 * sk);
      const ang = Math.atan2(tx2 - b.x, tz2 - b.z); this.pointer.position.set(b.x, b.y + 3.6 + Math.sin(t * 3) * 0.12, b.z); this.pointer.rotation.set(-0.45, ang, 0, 'YXZ'); }
    this.tgtD = Math.hypot(tx2 - b.x, tz2 - b.z); this.tgtA = Math.atan2(tx2 - b.x, tz2 - b.z); this.tgtCrate = tgt >= 0;
    this.lWin.material.color.setRGB(2.2, 1.8 + 0.3 * Math.sin(t * 2), 0.9);
    if (this.flag.group.visible) this.flag.wave(t, 0.4 + 0.6 * sk);
    this.fillCasts();
    this.hudUpdate();
    this.audioUpdate();
    const u = this.post.uniforms;
    if (u) {
      this.v.copy(this.SUN).multiplyScalar(1400).add(cam.position).project(cam); u.sun.value.set(this.v.x * 0.5 + 0.5, this.v.y * 0.5 + 0.5);
      u.sunVis.value = (this.v.z < 1 && Math.abs(this.v.x) < 1.1 && Math.abs(this.v.y) < 1.1 ? 0.8 : 0) * (1 - sk); u.time.value = (t % 10) + 1; u.hit.value = this.bonk > 0 ? this.bonk * 0.5 : 0; u.storm.value = sk;
    }
    this.post.render();
  }
  fillCasts() {
    const b = this.b, W = this.world, C = this.cast, cy = Math.cos(b.yaw), sy = Math.sin(b.yaw);
    this.nCast = 0; const by = b.y;
    this.put(b.x, by + 1.05, b.z, 1.15); this.put(b.x + sy * 1.0, by + 1.0, b.z + cy * 1.0, 0.9); this.put(b.x - sy * 1.0, by + 1.15, b.z - cy * 1.0, 0.9); this.put(b.x + sy * 0.5, by + 1.9, b.z + cy * 0.5, 0.45);
    for (let i = 0; i < 6; i += 2) { const w = WHEELS[i]; this.put(b.x + w[0] * cy + w[1] * sy, by + 0.42, b.z - w[0] * sy + w[1] * cy, 0.42); const w2 = WHEELS[i + 1]; this.put(b.x + w2[0] * cy + w2[1] * sy, by + 0.42, b.z - w2[0] * sy + w2[1] * cy, 0.42); }
    if (this.near(0, 0, 90)) { this.put(0, W.h(0, 0) + 2.4, 0, 2.6); this.put(0, W.h(0, 0) + 4.2, 0, 1.9); }
    if (this.flag.group.visible) this.put(W.flagAt.x, this.flag.group.position.y + 2.2, W.flagAt.z, 0.45);
    for (let i = 0; i < 6; i++) { const p = W.crates[i]; if (!this.got[i] && this.near(p.x, p.z, 70)) this.put(p.x, p.y + 1.25, p.z, 0.72); }
    this.terrain.near(b.x, b.z, this.addRock);
    for (let i = this.nCast; i < NC; i++) C[i].set(0, -9999, 0, 0.01);
  }
  put(x, y, z, r) { if (this.nCast < NC) this.cast[this.nCast++].set(x, y, z, r); }
  near(x, z, r) { return (x - this.b.x) ** 2 + (z - this.b.z) ** 2 < r * r; }

  // ------------------------------------------------------------------------------------------------ HUD
  buildUI() {
    const ui = this.ctx.ui; ui.innerHTML = ''; const st = document.createElement('style'); st.textContent = CSS; ui.appendChild(st);
    const h = document.createElement('div'); h.id = 'mrhud';
    h.innerHTML = `<div id="mrDust"></div><div id="mrTop"><div class="c"><small>CRATES</small><b id="mrC">0/6</b></div><div class="c"><small>KM/H</small><b id="mrS">0</b></div>
      <div class="c n"><small id="mrNl">NEXT</small><div class="row"><span id="mrArr"></span><b id="mrD">0</b></div></div>
      <div class="c f"><small>BATTERY</small><div class="bar" id="mrBat"><i></i></div><small class="j">HOP</small><div class="bar hop" id="mrHop"><i></i></div></div></div>
      <div id="mrStorm"><b>FOLLOW THE BEACON</b><span>DUST STORM</span><div class="bar"><i id="mrStI"></i></div></div>
      <div id="mrAir"><b id="mrAirT">0.0 S</b><span id="mrAirD">0 M</span></div><div id="mrKeys">A D STEER · W DRIVE · S BRAKE / REVERSE · SPACE HOP</div><div id="mrFlash"></div><div id="mrCard"></div>`;
    ui.appendChild(h); this.hud = h; const $ = (id) => h.querySelector('#' + id);
    this.el = { c: $('mrC'), s: $('mrS'), d: $('mrD'), nl: $('mrNl'), arr: $('mrArr'), bat: $('mrBat'), batI: $('mrBat').firstChild, hopI: $('mrHop').firstChild, air: $('mrAir'), airT: $('mrAirT'), airD: $('mrAirD'), flash: $('mrFlash'), card: $('mrCard'), keys: $('mrKeys'), storm: $('mrStorm'), stI: $('mrStI'), dust: $('mrDust') };
    this.cache = {};
  }
  set(k, v, e, prop = 'textContent') { if (this.cache[k] !== v) { this.cache[k] = v; e[prop] = v; } }
  hudUpdate() {
    const e = this.el; if (!e) return; const b = this.b, cam = this.ctx.camera, S = this.storm;
    this.set('c', `${this.nGot}/6`, e.c); this.set('s', String(Math.round(Math.abs(b.u) * 3.6)), e.s);
    this.set('nl', this.tgtCrate ? 'NEXT' : 'FLAG', e.nl); this.set('d', fmtD(this.tgtD), e.d);
    const fw = Math.atan2(this.camL.x - cam.position.x, this.camL.z - cam.position.z), rel = Math.round(((this.tgtA - fw + Math.PI * 3) % (Math.PI * 2) - Math.PI) * 20) / 20;
    this.set('arr', `rotate(${(-rel).toFixed(2)}rad)`, e.arr.style, 'transform');
    this.set('bat', (this.battery / BATTERY * 100).toFixed(1) + '%', e.batI.style, 'width'); if (this.cache.bl !== (this.battery < 20)) { this.cache.bl = this.battery < 20; e.bat.classList.toggle('low', this.cache.bl); }
    this.set('hop', (b.hop * 100).toFixed(1) + '%', e.hopI.style, 'width');
    this.ctx.hud.boost(this.battery / BATTERY, this.battery <= 0, this.ctx.input.boost && this.battery > 0);
    const at = this.t - this.air.t0, showAir = !b.ground && at > 0.5 && this.phase === 'play' && !S.on;
    if (showAir !== this.cache.sa) { this.cache.sa = showAir; e.air.classList.toggle('on', showAir); }
    if (showAir) { this.set('at', `AIR ${at.toFixed(1)} S`, e.airT); this.set('ad', `${Math.round(Math.hypot(b.x - this.air.x0, b.z - this.air.z0))} M`, e.airD); }
    const so = S.on && this.phase === 'play'; if (so !== this.cache.so) { this.cache.so = so; e.storm.classList.toggle('on', so); }
    if (so) this.set('st', (100 - S.t / STORM_LEN * 100).toFixed(1) + '%', e.stI.style, 'width');
    this.set('du', (S.k * 0.42).toFixed(2), e.dust.style, 'opacity');
    e.flash.style.opacity = (this.flash * 0.5).toFixed(2);
    if (this.t > 12 && !this.cache.kf) { this.cache.kf = true; e.keys.style.opacity = '0.35'; }
  }

  // ------------------------------------------------------------------------------------------------ result card
  hideCard() { if (!this.el) return; this.card = false; this.el.card.className = ''; this.el.card.innerHTML = ''; this.hud.classList.remove('carded'); }
  showCard() {
    if (this.card || !this.el) return; this.card = true; this.phase = 'card'; const A = this.ctx.audio, ok = this.plantedOk, e = this.el.card;
    const brag = ok ? 'SNACK BASE MARS!' : this.nGot >= 4 ? 'CRATE CRUSHER' : this.devils >= 2 ? 'DEVIL MAGNET' : this.nGot >= 1 ? 'MARS ROOKIE' : 'STILL BY THE LANDER';
    let best = 0; try { best = +localStorage.getItem('wis-mars-best') || 0; } catch (x) { /* private window */ }
    const line = ok ? `I drove a rover on Mars, grabbed all 6 snack crates and planted the flag in ${fmtT(this.time)}${this.storm.done ? ', right through a dust storm' : ''}.`
      : `I drove on Mars and grabbed ${this.nGot} of 6 snack crates in 38% gravity.`;
    const egg = (on, txt) => `<span${on ? ' class="y"' : ''}>${txt}${on ? '' : ' ?'}</span>`;
    e.innerHTML = `<small>MARS ROVER · DRIVE LOG</small><h2>${brag}</h2><div class="big">${this.nGot}/6 <span>CRATES</span></div>
      <div class="sub">${ok ? (this.isBest ? 'NEW BEST · ' : best ? `BEST ${fmtT(best)} · ` : '') + 'FLAG PLANTED' : 'THE FLAG IS STILL IN THE ROVER'}</div>
      <div class="st"><div><b>${fmtT(this.time)}</b><span>TIME</span></div><div><b>${Math.round(this.longest)} M</b><span>LONGEST JUMP</span></div><div><b>${this.bestAir.toFixed(1)} S</b><span>BEST AIR</span></div><div><b>${this.devils}</b><span>DUST DEVILS</span></div></div>
      <div class="eggs">${egg(this.fired.has('oldrover'), 'FIRST ROVER')}${egg(this.fired.has('olympus'), 'OLYMPUS SIGN')}${egg(this.storm.done, 'STORM')}${egg(this.rampJumps > 0, 'DUNE JUMP')}</div>
      <p>${line} Beat that.</p><div class="btns"><button type="button" class="pri" data-a="r">RETRY</button><button type="button" data-a="b">BACK TO THE CITY</button></div>`;
    e.querySelector('[data-a="r"]').addEventListener('click', () => { A.whoosh(1); this.retry(); });
    e.querySelector('[data-a="b"]').addEventListener('click', () => { A.whoosh(1); this.ctx.exit(); });
    e.className = 'on'; this.hud.classList.add('carded'); A.finish(ok || this.nGot >= 3);
    window.__marsCard = { crates: this.nGot, time: +this.time.toFixed(1), longest: Math.round(this.longest), air: +this.bestAir.toFixed(1), flag: ok, ramp: this.rampJumps, devils: this.devils, storm: this.storm.done, eggs: this.eggs };
  }

  // ------------------------------------------------------------------------------------------------ sound: thin wind, motor whine, sand crunch, dust-devil whoosh, radio pings (all muffled a bit: thin air carries sound poorly)
  startAudio() {
    const A = this.ctx.audio, c = A && A.ctx; if (!c || this.snd || !A.noiseBuf) return;
    this.musicWas = A.music; A.music = false;
    const bus = c.createGain(), lp = c.createBiquadFilter(); bus.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.5; bus.connect(lp); lp.connect(A.master); bus.gain.setTargetAtTime(1, c.currentTime, 0.4);
    const osc = (type, f, g, to) => { const o = c.createOscillator(), gn = c.createGain(); o.type = type; o.frequency.value = f; gn.gain.value = g; o.connect(gn); gn.connect(to); o.start(); return o; };
    const whF = c.createBiquadFilter(); whF.type = 'bandpass'; whF.frequency.value = 500; whF.Q.value = 3; const whG = c.createGain(); whG.gain.value = 0; whF.connect(whG); whG.connect(bus); const wh = osc('sawtooth', 160, 1, whF);
    const loop = (type, f, q, to) => { const s = c.createBufferSource(); s.buffer = A.noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(to); s.start(); return { s, g, fl }; };
    const wind = loop('bandpass', 380, 0.8, bus), gust = loop('bandpass', 900, 3, bus), crunch = loop('bandpass', 1100, 1.6, bus), devil = loop('bandpass', 600, 2.5, bus);
    this.snd = { c, bus, lp, whG, wh, wind, gust, crunch, devil, all: [wh, wind.s, gust.s, crunch.s, devil.s] };
  }
  audioUpdate() {
    const S = this.snd; if (!S) return; const t = S.c.currentTime, b = this.b, k = Math.min(1, Math.abs(b.u) / VMAX), on = this.phase !== 'card', drive = this.ctx.input.boost && this.battery > 0 && on, st = this.storm.k, tt = this.t;
    S.wind.g.gain.setTargetAtTime(0.05 + 0.03 * Math.sin(tt * 0.37) + 0.22 * st, t, 0.3); S.wind.fl.frequency.setTargetAtTime(330 + 90 * Math.sin(tt * 0.23) + 260 * st, t, 0.4);
    S.gust.g.gain.setTargetAtTime((0.012 + 0.015 * Math.max(0, Math.sin(tt * 0.61))) * (1 + 4 * st), t, 0.3); S.gust.fl.frequency.setTargetAtTime(800 + 400 * Math.sin(tt * 0.9), t, 0.3);
    S.wh.frequency.setTargetAtTime(140 + k * 480, t, 0.1); S.whG.gain.setTargetAtTime(drive ? 0.018 + 0.025 * k : 0.004, t, 0.12);
    S.crunch.g.gain.setTargetAtTime(b.ground && on ? 0.04 + 0.16 * k : 0, t, 0.06); S.crunch.fl.frequency.setTargetAtTime(800 + 600 * k + Math.random() * 300, t, 0.05);
    const dv = Math.max(0, 1 - this.devNear / 40); S.devil.g.gain.setTargetAtTime(on ? 0.25 * dv * dv : 0, t, 0.2); S.devil.fl.frequency.setTargetAtTime(450 + 350 * Math.sin(tt * 3.1) * dv + 300 * dv, t, 0.08);
  }
  thump(v) { const A = this.ctx.audio, S = this.snd; if (!A.ctx || !S) return; const t = A.ctx.currentTime; A.tone(70, t, 0.35, 'sine', 0.5 * v + 0.15, S.bus, 0.5); A.noise(t, 0.3, 0.3 * v + 0.05, 500, 'lowpass', S.bus); }
  boing() { const A = this.ctx.audio, S = this.snd; if (!A.ctx || !S) return; const t = A.ctx.currentTime; A.tone(220, t, 0.25, 'triangle', 0.12, S.bus, 2.2); }
  ping() { const A = this.ctx.audio; if (!A.ctx) return; const t = A.ctx.currentTime; A.tone(1568, t, 0.09, 'sine', 0.06); A.tone(2093, t + 0.1, 0.12, 'sine', 0.05); }
  stopAudio() {
    const A = this.ctx.audio, S = this.snd; if (A && this.musicWas !== undefined) { A.music = this.musicWas; if (A.ctx) A.nextBeat = A.ctx.currentTime + 0.1; }
    if (!S) return; this.snd = null; S.bus.gain.setTargetAtTime(0, S.c.currentTime, 0.1);
    setTimeout(() => { for (const n of S.all) { try { n.stop(); } catch (e) { /* already stopped */ } } try { S.lp.disconnect(); } catch (e) { /* ok */ } }, 600);
  }
}

// dust in thin air: drag and a little gravity, drifts downwind, no floor test (short lives)
class MarsDust extends Particles {
  update(dt, storm = 0) {
    const p = this.pos, v = this.vel, wx = (1.5 + 8 * storm) * dt, wz = (0.5 + 2.5 * storm) * dt;
    for (let i = 0; i < this.life.length; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt; const t = 1 - this.life[i] / this.max[i], k = Math.exp(-this.drag[i] * dt);
      v[i * 3] *= k; v[i * 3 + 1] = v[i * 3 + 1] * k - this.grav[i] * dt; v[i * 3 + 2] *= k; p[i * 3] += v[i * 3] * dt + wx; p[i * 3 + 1] += v[i * 3 + 1] * dt; p[i * 3 + 2] += v[i * 3 + 2] * dt + wz;
      this.alpha[i] = Math.min(1, (1 - t) * 2) * (t < 0.08 ? t / 0.08 : 1); this.sz[i] = this.size[i] * (1 + t * this.grow[i]);
    }
    const a = this.geo.attributes; a.position.needsUpdate = a.alpha.needsUpdate = a.psize.needsUpdate = a.color.needsUpdate = true;
  }
}

const CSS = `
#mrhud{position:absolute;inset:0;font-family:var(--f);color:var(--cream)}
#mrDust{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 55%,rgba(150,80,40,.35),rgba(110,55,28,.95));opacity:0;pointer-events:none}
#mrTop{position:absolute;top:max(10px,var(--sa-top));left:calc(max(10px,var(--sa-left)) + 50px);right:max(10px,var(--sa-right));max-width:560px;margin-left:auto;display:flex;align-items:stretch;gap:2px;padding:5px 6px;height:50px;box-sizing:border-box;background:rgba(20,26,58,.84);border-radius:12px;box-shadow:0 3px 0 rgba(0,0,0,.35)}
#mrTop .c{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;padding:0 7px;border-right:1px solid rgba(255,244,230,.12);line-height:1}
#mrTop .c:last-child{border-right:0}
#mrTop small{font-size:10px;font-weight:900;letter-spacing:.12em;color:var(--sun);margin-bottom:3px;white-space:nowrap;overflow:hidden}
#mrTop b{font-size:clamp(16px,4.6vw,22px);font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}
#mrTop .n{flex:1.25}#mrTop .n b{font-size:clamp(14px,4vw,20px)}
#mrTop .row{display:flex;align-items:center;gap:5px}
#mrArr{width:18px;height:18px;flex:none;position:relative}
#mrArr::before{content:"";position:absolute;left:3px;top:0;border-bottom:16px solid var(--sun);border-left:6px solid transparent;border-right:6px solid transparent}
#mrTop .f{flex:1.2}#mrTop .f small{margin-bottom:2px}#mrTop .f small.j{margin:3px 0 2px}
#mrTop .bar{height:7px;border-radius:4px;background:rgba(255,244,230,.15);overflow:hidden}
#mrTop .bar i{display:block;height:100%;width:100%;margin:0;background:#5fe0a8;border-radius:4px}
#mrTop .bar.hop i{background:#9fd8ff}#mrTop .bar.low i{background:var(--coral)}
#mrStorm{position:absolute;left:50%;bottom:max(150px,24%);transform:translate(-50%,0) scale(.85);opacity:0;transition:opacity .3s,transform .3s;text-align:center;background:rgba(20,26,58,.8);border-radius:14px;padding:9px 16px 10px;box-shadow:0 4px 0 rgba(0,0,0,.35);white-space:nowrap}
#mrStorm.on{opacity:1;transform:translate(-50%,0)}
#mrStorm b{display:block;font-size:clamp(17px,5vw,24px);font-weight:900;letter-spacing:.04em;color:#9fd8ff}
#mrStorm span{display:block;font-size:11px;font-weight:900;letter-spacing:.14em;color:var(--sun);margin-top:2px}
#mrStorm .bar{height:6px;border-radius:3px;background:rgba(255,244,230,.15);overflow:hidden;margin-top:6px}#mrStorm .bar i{display:block;height:100%;width:100%;background:#9fd8ff}
#mrAir{position:absolute;left:50%;top:max(41%,calc(var(--hudb,150px) + 120px));transform:translate(-50%,-50%) scale(.8);opacity:0;transition:opacity .2s,transform .2s;text-align:center;text-shadow:0 3px 0 var(--navy)}
#mrAir.on{opacity:1;transform:translate(-50%,-50%)}
#mrAir b{display:block;font-size:clamp(22px,6.4vw,34px);font-weight:900;letter-spacing:.04em;color:var(--sun);font-variant-numeric:tabular-nums}
#mrAir span{display:block;font-size:14px;font-weight:900;letter-spacing:.12em}
#mrKeys{position:absolute;left:50%;bottom:max(14px,var(--sa-bottom));transform:translateX(-50%);font:800 11px var(--f);letter-spacing:.1em;opacity:.8;text-shadow:0 1px 0 rgba(0,0,0,.6);white-space:nowrap;transition:opacity .6s}
.touch #mrKeys{display:none}
#mrFlash{position:absolute;inset:0;background:#fff4e6;opacity:0;mix-blend-mode:screen;pointer-events:none}
#mrhud.carded #mrAir,#mrhud.carded #mrStorm{display:none}
#mrCard{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100% - 28px));max-height:calc(100% - 24px);overflow:auto;padding:16px 16px 14px;box-sizing:border-box;text-align:center;pointer-events:auto;background:rgba(20,26,58,.96);border-radius:18px;box-shadow:0 8px 0 rgba(0,0,0,.35);display:none}
#mrCard.on{display:block;animation:mrIn .35s cubic-bezier(.2,1.4,.4,1)}
#mrCard>small{display:block;font:900 11px var(--f);letter-spacing:.16em;color:var(--sun)}
#mrCard h2{margin:6px 0 2px;font:900 clamp(24px,7vw,34px)/1.05 var(--f);text-shadow:0 3px 0 var(--coral)}
#mrCard .big{font:900 clamp(36px,11vw,54px)/1 var(--f);margin-top:6px;font-variant-numeric:tabular-nums}#mrCard .big span{font-size:.36em;letter-spacing:.12em;vertical-align:middle}
#mrCard .sub{font:800 12px var(--f);letter-spacing:.1em;color:#9fd8ff;margin-top:4px}
#mrCard .st{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:10px 0 8px}#mrCard .st div{background:#1f2756;border-radius:10px;padding:7px 2px}
#mrCard .st b{display:block;font:900 17px var(--f);color:var(--sun);white-space:nowrap}#mrCard .st span{display:block;font:800 10px/1.15 var(--f);letter-spacing:.06em;margin-top:2px}
#mrCard .eggs{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin:4px 0}
#mrCard .eggs span{padding:5px 9px;border-radius:999px;background:rgba(255,244,230,.08);font:900 10px var(--f);letter-spacing:.08em;opacity:.55}#mrCard .eggs span.y{background:var(--sun);color:var(--navy);opacity:1}
#mrCard p{margin:8px 4px 10px;font:800 13px/1.35 var(--f)}
#mrCard .btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#mrCard button{min-height:46px;border:0;border-radius:12px;font:900 13px var(--f);letter-spacing:.05em;cursor:pointer;background:var(--cream);color:var(--navy);box-shadow:0 4px 0 rgba(0,0,0,.35)}
#mrCard button.pri{background:var(--sun);box-shadow:0 4px 0 #c99a1c}
#mrCard button:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.35)}
@media (max-height:520px){#mrCard{width:min(94vw,600px);padding:10px 12px}#mrCard h2{font-size:22px}#mrCard .big{font-size:32px;margin-top:2px}#mrCard .st{margin:6px 0 4px}#mrCard p{margin:4px;font-size:12px}#mrAir{top:36%}#mrStorm{bottom:18px}}
@keyframes mrIn{from{transform:translate(-50%,-50%) scale(.85);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
`;
