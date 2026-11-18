// SPACE mode: the STAR HOPPER. A 3-2-1 countdown on a coastal pad at golden hour, a 60 to 75 s ascent to the ISS at 408 km (steer round gulls,
// clouds, weather balloons, meteors and space junk, grab fuel cells, BOOST = thrust, BRAKE = slow, DRIFT = barrel roll), stage separation at 60 km,
// the fairing at 110 km, a SPACE badge at the Karman line, docking at the station, then EXPLORE SPACE: free flight with WARP through a compressed,
// stylised solar system (js/modes/space_explore.js). Contract: js/modes/README.md. Planet and sky: js/earth.js (peer). Facts: js/spacefacts.js, js/solar.js.
import * as THREE from 'three';
import { SpaceScene } from '../earth.js';
import { SPACE_FACTS } from '../spacefacts.js';
import { Particles } from '../fx.js';
import * as M from './space_models.js';
import { Explore, NINE, fmtKm, lightTime, LIGHT } from './space_explore.js';

const SUN = new THREE.Vector3(-0.6, 0.085, -0.8).normalize();
const ISS_KM = 408, ASCENT_S = 62, EXPO = 2.2, PIV = 8;   // alt = 408 * u^2.2, u grows at 1/62 per second at plain thrust; the rocket's pivot (its middle) is 8 up
const MILES = SPACE_FACTS.filter((f) => f.km <= ISS_KM);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), lerp = (a, b, k) => a + (b - a) * k, ss = (a, b, x) => { const k = clamp((x - a) / (b - a)); return k * k * (3 - 2 * k); };
const speedAt = (alt) => 7.66 * Math.pow(clamp(alt / ISS_KM), 0.62);   // km/s, real-ish and monotone: about 3.2 at 100 km, 7.66 in orbit
const pitchAt = (alt) => (68 * ss(0.25, 5, alt) + 22 * ss(120, 380, alt)) * Math.PI / 180;   // the gravity turn: upright on the pad, flat at the station
// obstacle bands: [type, from km, to km, seconds between spawns]
const BANDS = [['bird', 0.35, 4, 0.5], ['cloud', 2.5, 13, 0.62], ['balloon', 17, 40, 0.9], ['meteor', 55, 98, 0.55], ['junk', 175, 385, 0.42], ['cell', 1.2, 392, 2.4]];
const BAND_SAY = { bird: ['DODGE THE GULLS', 'STEER'], cloud: ['CLOUD LAYER', 'PUNCH THROUGH'], balloon: ['WEATHER BALLOONS', '30 KM UP'], meteor: ['METEORS', 'BURNING UP AROUND 80 KM'], junk: ['SPACE JUNK', 'DODGE IT'] };
const BAND_RADIO = { balloon: 'Weather balloons float up here, around 30 km, before they pop.', junk: 'Radar tracks more than 30,000 bits of junk up here. Each one moves faster than a bullet.' };
const SKY_V = 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const TAIL = '#include <tonemapping_fragment>\n#include <colorspace_fragment>';
const SKY_F = `uniform vec3 uSun; uniform float uDark, uFade, uGain; varying vec3 vP;
  vec3 capL(vec3 c, float m){ float l = dot(c, vec3(0.299, 0.587, 0.114)); return c * min(1.0, m / max(l, 1e-4)); }
  void main(){ vec3 d = normalize(vP); float y = d.y, s = max(dot(d, uSun), 0.0);
    vec3 c = mix(vec3(0.9, 0.44, 0.22), vec3(0.5, 0.25, 0.36), smoothstep(0.0, 0.16, y)); c = mix(c, vec3(0.09, 0.11, 0.33), smoothstep(0.1, 0.62, y)); c = mix(c, vec3(0.55, 0.32, 0.27), smoothstep(0.0, -0.12, y));
    c += vec3(1.5, 0.75, 0.3) * pow(s, 8.0) * 0.45; c = capL(c, 0.7); c += vec3(5.0, 3.6, 2.0) * smoothstep(0.99935, 0.9997, s);
    c = mix(c, vec3(0.004, 0.006, 0.03), uDark * smoothstep(-0.08, 0.3 - uDark * 0.3, y));
    gl_FragColor = vec4(c * uGain, uFade);
    ${TAIL}
  }`;
const GROUND_V = 'varying vec3 vW; varying vec2 vL; void main(){ vL = position.xz; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }';
const GROUND_F = `uniform vec3 uSun, uHaze; uniform float uFade, uH; varying vec3 vW; varying vec2 vL;
  vec3 capL(vec3 c, float m){ float l = dot(c, vec3(0.299, 0.587, 0.114)); return c * min(1.0, m / max(l, 1e-4)); }
  void main(){ vec2 p = vL; float cz = -60.0 + 22.0 * sin(p.x * 0.011) + 140.0 * sin(p.x * 0.0021 + 1.3) + 700.0 * sin(p.x * 0.0004 + 0.4);
    float fw = 2.0 + length(vW - cameraPosition) * 0.004, land = smoothstep(cz - fw, cz + fw, p.y), beach = land * (1.0 - smoothstep(cz + 6.0, cz + 26.0 + fw, p.y));
    float n = 0.5 + 0.25 * sin(p.x * 0.013 + sin(p.y * 0.017)) + 0.25 * sin(p.y * 0.009 - p.x * 0.004);
    vec3 grass = mix(vec3(0.62, 0.48, 0.26), vec3(0.3, 0.42, 0.2), n), sand = vec3(1.0, 0.8, 0.56);
    vec3 lc = mix(grass, sand, beach) * vec3(0.95, 0.72, 0.6);
    vec3 V = normalize(cameraPosition - vW), R = reflect(-V, vec3(0.0, 1.0, 0.0)); float sh = clamp((cz - p.y) / 260.0, 0.0, 1.0);
    vec3 sea = mix(vec3(0.12, 0.45, 0.55), vec3(0.03, 0.11, 0.27), sh); float gl = max(dot(R, uSun), 0.0); sea += vec3(1.8, 1.0, 0.5) * (pow(gl, 400.0) * 3.0 + pow(gl, 24.0) * 0.25);
    vec3 c = mix(sea, lc, land); float d = length(vW - cameraPosition); c = capL(mix(c, uHaze, 1.0 - exp(-d / (2200.0 + uH * 2.0))), 0.62 + 2.0 * pow(gl, 400.0) * (1.0 - land));
    gl_FragColor = vec4(c, uFade);
    ${TAIL}
  }`;
const DECK_F = `uniform sampler2D tMap; uniform vec3 uSun, uHaze; uniform float uFade; varying vec3 vW; varying vec2 vL;
  vec3 capL(vec3 c, float m){ float l = dot(c, vec3(0.299, 0.587, 0.114)); return c * min(1.0, m / max(l, 1e-4)); }
  void main(){ float a = texture2D(tMap, vL / 900.0).a * 0.6 + texture2D(tMap, vL / 2600.0 + 0.37).a * 0.6; a = smoothstep(0.25, 0.8, a);
    vec3 c = mix(vec3(0.62, 0.42, 0.5), vec3(1.25, 0.98, 0.86), a); float d = length(vW - cameraPosition); c = capL(mix(c, uHaze, 1.0 - exp(-d / 9000.0)), 0.72);
    gl_FragColor = vec4(c, uFade * (0.82 + 0.18 * a));
    ${TAIL}
  }`;

export default class SpaceMode {
  constructor(ctx) { this.ctx = ctx; this.phase = 'idle'; }

  // ------------------------------------------------------------------------------------------------ build once
  // load() returns at once so the title showroom appears instantly; the world builds in slices between frames (a generator), and start() finishes any slice left
  load() { this.gen = this.buildSteps(); this.built = false; const pump = () => { if (this.built) return; if (this.gen.next().done) this.built = true; else setTimeout(pump, 30); }; setTimeout(pump, 30); }
  finishLoad() { while (!this.built) if (this.gen.next().done) this.built = true; }
  *buildSteps() {
    const { renderer, camera } = this.ctx, tier = this.ctx.tier, S = (this.scene = new THREE.Scene());
    this.tier = tier;
    this.sunL = new THREE.DirectionalLight(0xffb27a, 3.6); this.sunL.position.copy(SUN).multiplyScalar(100); S.add(this.sunL, this.sunL.target);
    this.hemi = new THREE.HemisphereLight(0x9aa0f0, 0xffa078, 1.4); this.fill = new THREE.DirectionalLight(0xffd6e2, 1.1); this.fill.position.set(0.6, 0.4, 1); S.add(this.hemi, this.fill);
    // golden-hour sky dome (follows the camera), the coast and pad (the "world" that falls away), a cloud deck
    this.skyU = { uSun: { value: SUN }, uDark: { value: 0 }, uFade: { value: 1 }, uGain: { value: 1 } };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(38000, 32, 16), new THREE.ShaderMaterial({ uniforms: this.skyU, vertexShader: SKY_V, fragmentShader: SKY_F, side: THREE.BackSide, depthWrite: false, transparent: true }));
    this.sky.renderOrder = -12; this.sky.frustumCulled = false; S.add(this.sky);
    this.world = new THREE.Group(); S.add(this.world); const haze = new THREE.Color(0.66, 0.38, 0.3);
    const gp = new THREE.PlaneGeometry(120000, 120000, 1, 1); gp.rotateX(-Math.PI / 2);
    this.groundU = { uSun: { value: SUN }, uHaze: { value: haze }, uFade: { value: 1 }, uH: { value: 0 } };
    this.ground = new THREE.Mesh(gp, new THREE.ShaderMaterial({ uniforms: this.groundU, vertexShader: GROUND_V, fragmentShader: GROUND_F, transparent: true })); this.ground.frustumCulled = false; this.ground.renderOrder = -6; this.world.add(this.ground);
    const std = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, emissive: 0x241c2a, ...o });
    this.pad = new THREE.Mesh(M.padGeometry(), std()); this.world.add(this.pad);
    this.arm = new THREE.Mesh(M.armGeometry(), std()); this.arm.position.set(-4.6, 13.5, 0); this.world.add(this.arm);
    this.padLights = new THREE.Mesh(M.lightsGeometry(), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.2, 0.9), toneMapped: false })); this.world.add(this.padLights);
    { // a low skyline on the land behind the pad
      const box = new THREE.BoxGeometry(1, 1, 1); box.translate(0, 0.5, 0); const town = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ color: 0x3a3560, roughness: 0.9, emissive: 0x1a1430 }), 36), o = new THREE.Object3D(); let s = 7; const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
      for (let i = 0; i < 36; i++) { o.position.set(-500 + r() * 1100, 0, 260 + r() * 500); o.scale.set(14 + r() * 26, 8 + r() * r() * 70, 14 + r() * 26); o.updateMatrix(); town.setMatrixAt(i, o.matrix); } this.world.add(town);
    }
    this.deckU = { tMap: { value: M.deckTexture(tier === 'low' ? 128 : 256) }, uSun: { value: SUN }, uHaze: { value: new THREE.Color(0.75, 0.5, 0.55) }, uFade: { value: 0 } };
    const dp = new THREE.PlaneGeometry(120000, 120000, 1, 1); dp.rotateX(-Math.PI / 2);
    this.deck = new THREE.Mesh(dp, new THREE.ShaderMaterial({ uniforms: this.deckU, vertexShader: GROUND_V, fragmentShader: DECK_F, transparent: true, depthWrite: false })); this.deck.position.y = 7500; this.deck.frustumCulled = false; this.deck.renderOrder = -5; this.world.add(this.deck);
    yield;
    // the peer's planet, atmosphere, stars and Moon; the station for the finish
    this.space = new SpaceScene(S, { tier, sun: SUN.clone() }); this.space.prepare(); yield;
    this.iss = this.space.makeISS(); this.iss.rotation.y = Math.PI; this.iss.visible = false; S.add(this.iss);
    // the rocket: a pivot at its middle, the model hangs below it so the base sits 8 under the pivot
    this.rk = M.makeRocket(); this.pivot = new THREE.Group(); this.rk.group.position.y = -PIV; this.pivot.add(this.rk.group); S.add(this.pivot);
    // obstacles: one InstancedMesh per type
    const basic = (c, add) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, transparent: !!add, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !add });
    const T = (this.types = {
      bird: { geo: M.birdGeometry(), mat: std({ emissive: 0x000000 }), n: 24, r: 1.3 },
      cloud: { geo: M.cloudGeometry(), mat: std({ emissive: 0x6a4a4a, roughness: 1 }), n: 12, r: 4.0 },
      balloon: { geo: M.balloonGeometry(), mat: std({ emissive: 0x4a4a5a }), n: 8, r: 2.6 },
      meteor: { geo: M.meteorGeometry(), mat: basic(new THREE.Color(4, 1.6, 0.5), true), n: 10, r: 1.2 },
      junk: { geo: M.junkGeometry(), mat: std({ emissive: 0x3a3a48, metalness: 0.3 }), n: 24, r: 2.0 },
      cell: { geo: M.cellGeometry(), mat: basic(new THREE.Color(0.6, 3.2, 1.9)), n: 10, r: 1.7 },
    });
    for (const k in T) { const t = T[k]; t.mesh = new THREE.InstancedMesh(t.geo, t.mat, t.n); t.mesh.count = 0; t.mesh.frustumCulled = false; S.add(t.mesh); }
    this.obs = Array.from({ length: 90 }, () => ({ on: false, type: '', x: 0, y: 0, z: 0, vx: 0, rx: 0, ry: 0, spin: 0, s: 1, passed: false }));
    this.spawnT = {}; for (const b of BANDS) this.spawnT[b[0]] = 0;
    this.groundFx = new Particles(this.world); this.trailFx = new Particles(S);
    // explore: the solar system (built now so EXPLORE SPACE opens instantly)
    import('../solar.js').then((m) => { this.bodies = m.BODIES; }).catch(() => { this.bodies = null; });   // the peer's checked numbers; the fallback table otherwise
    this.post = this.ctx.makePost(renderer, S, camera, tier); this.postTier = tier;
    this._t = new THREE.Vector3(); this._q = new THREE.Vector3(); this._o = new THREE.Object3D(); this._camP = new THREE.Vector3(); this._camL = new THREE.Vector3(); this._c2 = new THREE.Vector3(); this._l2 = new THREE.Vector3();
    // compile every program now so nothing hitches mid-flight
    this.space.show(true); this.iss.visible = true; for (const k in T) T[k].mesh.count = 1;
    camera.near = 0.5; camera.far = 60000; camera.updateProjectionMatrix(); renderer.compile(S, camera);
    this.iss.visible = false; for (const k in T) T[k].mesh.count = 0;
    setTimeout(() => this.buildExplore(), 2500);   // the solar system is built while the player looks at the title or counts down, so the showroom appears sooner
  }
  buildExplore() {   // once; EXPLORE SPACE calls it too in case the timer has not fired yet
    if (this.explore) return; this.finishLoad(); const c = this.ctx;
    this.explore = new Explore(this.scene, { tier: this.tier, earthScene: this.space, sunDir: SUN }); this.explore.build(this.bodies);
    this.explore.group.visible = true; c.renderer.compile(this.scene, c.camera); this.explore.group.visible = this.phase === 'explore' || this.phase === 'xcard'; this.sizeFx();
  }

  // ------------------------------------------------------------------------------------------------ title showroom: a 4.5 m STAR HOPPER on a tiny stand
  makePreview() {   // a small showroom model on a navy hover plinth: round, so the title camera's orbit frames it the same from every side.
    // The title camera and layout change with the screen shape, so the model sizes and lifts itself into the free band between the subtitle and the garage row.
    const g = new THREE.Group(), inner = new THREE.Group(), r = M.makeRocket(); r.booster.remove(r.flameBig); r.upper.remove(r.flameSmall);   // no flames on the showroom model (they would also stretch its bounding box)
    r.mat.color.setScalar(0.7); r.mat.emissive.setHex(0x000000);
    r.group.scale.setScalar(1 / 16.4); r.group.position.y = 0.09; r.group.rotation.y = 0.5; inner.add(r.group); g.add(inner);   // inner is 1 m tall (+ plinth) before fitting
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.26, 0.09, 32), new THREE.MeshStandardMaterial({ color: 0x1f2756, roughness: 0.6 })); plinth.position.y = 0.045; plinth.renderOrder = -1; inner.add(plinth);   // drawn first, so its fit (below) moves the rocket before the rocket draws
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.245, 0.01, 6, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.25, 0.4), toneMapped: false })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.09; inner.add(ring);
    // Fit into the free band of the title screen: between the subtitle (or the logo when it is hidden) and the garage row. The band is read from the page
    // (re-read when the window size changes, and every second while the title animates in), then the lift and height that project the model's foot onto the
    // band's bottom and its nose near the band's top are solved against the title camera itself, so every phone shape and the orbit are covered.
    const v = new THREE.Vector3(), band = { key: '', t: 0, top: 0, bot: 0 }, cur = { lift: -1, h: 1 };
    const readBand = (H) => { const q = document.getElementById('tq'), h1 = document.querySelector('#title h1'), gr = document.getElementById('garage'); if (!h1 || !gr) return false;
      const qr = q && q.offsetHeight && q.textContent.trim() ? q.getBoundingClientRect() : null, top = (qr || h1.getBoundingClientRect()).bottom, bot = gr.getBoundingClientRect().top;
      if (!(bot > top + 30)) return false; band.top = top + Math.min(14, (bot - top) * 0.06); band.bot = bot - Math.min(8, (bot - top) * 0.04); return H > 0; };
    plinth.onBeforeRender = (ren, sc, cam) => {
      const H = ren.domElement.clientHeight || innerHeight, W = ren.domElement.clientWidth || innerWidth, key = W + 'x' + H, now = performance.now();
      if (band.key !== key || now - band.t > 1000) { band.t = now; if (readBand(H)) band.key = key; else return; }
      const x = g.matrixWorld.elements[12], z = g.matrixWorld.elements[14], cdx = cam.position.x - x, cdz = cam.position.z - z, cl = Math.hypot(cdx, cdz) || 1; let off = 0;
      const py = (y) => (1 - (v.set(x + cdx / cl * off, y, z + cdz / cl * off).project(cam).y + 1) / 2) * H;   // off: the plinth's near rim (lowest on screen), not its centre
      const ceil = cam.position.y - 0.15;   // search only below the camera: higher points can fall behind a steep title camera and project upside down
      const solve = (px) => { let lo = -3, hi = Math.min(30, ceil); for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (py(m) > px) lo = m; else hi = m; } return (lo + hi) / 2; };
      let y0 = 0, y1 = 0, h = 1; for (let it = 0; it < 3; it++) { off = 0.26 * h; y0 = Math.max(0, solve(band.bot)); off = 0; y1 = solve(band.top); h = Math.min(4.6, Math.max(0.25, (y1 - y0) / 1.09 * 0.96)); }   // the inner model is 1.09 tall (plinth + rocket)
      cur.lift = y0; cur.h = h; g.userData.fit = { top: band.top, bot: band.bot, y0, y1, h };   // the orbit is slow, so no smoothing is needed
      inner.position.y = Math.max(0, cur.lift); inner.scale.setScalar(cur.h); inner.updateMatrixWorld(true);
    };
    return g;
  }

  // ------------------------------------------------------------------------------------------------ TURN THE KEY
  start() {
    this.finishLoad(); const c = this.ctx;
    if (c.tier !== this.postTier) { this.post = c.makePost(c.renderer, this.scene, c.camera, c.tier); this.postTier = c.tier; }
    this.buildUI(); this.sizeFx(); this.ensureSound();
    this.keyH = (e) => this.onKey(e); addEventListener('keydown', this.keyH);
    this.resetAscent();
  }
  resetAscent() {
    const c = this.ctx, rk = this.rk;
    this.phase = 'count'; this.t = 0; this.u = 0; this.alt = 0; this.px = 0; this.vx = 0; this.fuel = 1; this.hitT = 0; this.shake = 0; this.flash = 0; this.rollT = -9; this.rollCd = 0;
    this.lift = -1; this.dz = 0; this.cells = 0; this.dodged = 0; this.hits = 0; this.nearCd = 0; this.mi = 0; this.bandSaid = {}; this.fired = {}; this.boosting = false; this.lowFuelSaid = false; this.time = 0; this.card = false;
    this.cnt = null; this.bdg = null; this.toastQ = []; this.toastCd = 0; this.radioQ = []; this.radioCd = 0; this.reached = MILES.map(() => -1);
    for (const o of this.obs) o.on = false; for (const k in this.types) this.types[k].mesh.count = 0; for (const k in this.spawnT) this.spawnT[k] = 0.5;
    this.groundFx.life.fill(0); this.trailFx.life.fill(0);
    // reassemble the rocket (stage separation and the fairing take parts away)
    for (const [p, parent] of [[rk.booster, rk.group], [rk.fairL, rk.upper], [rk.fairR, rk.upper]]) { parent.add(p); p.position.set(0, 0, 0); p.rotation.set(0, 0, 0); p.visible = true; }
    this.sep = null; this.fair = null; rk.flameBig.visible = false; rk.flameSmall.visible = false; rk.booster.visible = true;
    this.pivot.position.set(0, PIV, 0); this.pivot.rotation.set(0, 0, 0); this.arm.rotation.set(0, 0, 0);
    this.world.visible = true; this.sky.visible = true; this.space.show(true); if (this.explore) this.explore.group.visible = false; this.iss.visible = false;
    this.ui.classList.remove('sp-x'); this.ui.classList.add('sp-a'); this.hideCard(); this.setTop('ascent'); this.el.count.className = '';
    c.labels({ boost: 'THRUST', brake: 'SLOW', drift: 'ROLL' }); c.hud.boost(1, false, false);
    this.say('3');
  }
  stop() {
    removeEventListener('keydown', this.keyH); this.phase = 'idle';
    if (this.snd) { const t = this.snd.c.currentTime; for (const g of [this.snd.rg, this.snd.cg, this.snd.hg]) g.gain.setTargetAtTime(0, t, 0.08); }
    this.ctx.hud.boost(1, false, false); this.ctx.ui.innerHTML = '';
  }
  resize(w, h, pr) { if (this.built) { this.post.setSize(w, h, pr); this.sizeFx(); } }
  sizeFx() { const r = this.ctx.renderer, h = r.domElement.clientHeight || innerHeight, k = h * r.getPixelRatio() * 0.9; this.groundFx.mat.uniforms.scale.value = k; this.trailFx.mat.uniforms.scale.value = k; if (this.explore) this.explore.belt.material.uniforms.uScale.value = h * r.getPixelRatio() * 0.5;
    const sz = this._sz || (this._sz = new THREE.Vector2()); r.getSize(sz); this.post.setSize(sz.x, sz.y, r.getPixelRatio()); }

  // ------------------------------------------------------------------------------------------------ input extras (keyboard only; touch has the chip)
  onKey(e) {
    if (this.phase !== 'explore') return;
    if (e.code === 'KeyT' || e.code === 'KeyE' || e.code === 'Tab') { e.preventDefault(); this.cycle(1); } else if (e.code === 'KeyQ') this.cycle(-1);
  }
  cycle(d) { this.explore.cycle(d); this.ctx.audio.whoosh(0); this.chipText = ''; }

  // ------------------------------------------------------------------------------------------------ fixed step
  step(dt) {
    const inp = this.ctx.input;
    this.time += dt; this.t += dt; this.shake = Math.max(0, this.shake - dt * 1.6); this.flash = Math.max(0, this.flash - dt * 2.2);
    this.queues(dt);
    if (this.phase === 'count') this.stepCount(dt);
    else if (this.phase === 'ascent' || this.phase === 'dock' || this.phase === 'card') this.stepAscent(dt, inp);
    else if (this.phase === 'explore' || this.phase === 'xcard') this.stepExplore(dt, inp);
    this.groundFx.update(dt); this.trailFx.update(dt);
  }
  stepCount(dt) {
    const t = this.t, a = this.ctx.audio, rk = this.rk;
    for (const [at, n] of [[0.75, '2'], [1.5, '1']]) if (t >= at && t - dt < at) { this.say(n); this.beep(n === '1' ? 1 : 0); }
    if (t >= 0.02 && t - dt < 0.02) this.beep(0);
    if (t > 0.3 && Math.random() < 0.35) this.vent();   // venting vapour while it counts
    if (t > 1.0) this.arm.rotation.y = -ss(1.0, 2.0, t) * 1.4;
    if (t >= 1.85 && t - dt < 1.85) { rk.flameBig.visible = true; this.shake = 0.5; if (a.ctx) { a.noise(a.ctx.currentTime, 1.2, 0.5, 220); a.crash(12); } }   // ignition
    if (t > 1.85) this.padSmoke(4);
    if (t >= 2.25) { this.phase = 'ascent'; this.t = 0; this.lift = 0; this.say('GO'); this.shake = 1; this.flash = 0.5; a.launch(); a.whoosh(2); this.radio('We have liftoff! Steer round anything in the way.'); }
  }
  stepAscent(dt, inp) {
    const a = this.ctx.audio, docking = this.phase !== 'ascent';
    this.lift += dt; this.rollCd -= dt; this.nearCd -= dt; this.hitT -= dt;
    // thrust, fuel, progress
    const canBoost = !docking && inp.boost && this.fuel > 0.01; this.boosting = canBoost;
    const slow = !docking && inp.brake > 0.1, mult = docking ? 0.6 : (canBoost ? 1.5 : 1) * (slow ? 0.7 : 1) * (this.fuel > 0.01 ? 1 : 0.55) * (this.hitT > 0 ? 0.6 : 1);
    if (!docking) { this.fuel = clamp(this.fuel - dt * (0.008 + (canBoost ? 0.05 : 0))); if (this.fuel <= 0.01 && !this.lowFuelSaid) { this.lowFuelSaid = true; a.alarm(); this.toast('LOW FUEL', 'GRAB THE GREEN CELLS'); } }
    this.u = Math.min(1, this.u + dt * mult / ASCENT_S); this.alt = ISS_KM * Math.pow(this.u, EXPO);
    if (this.alt < 0.25) this.lift = Math.max(this.lift, 0);
    this.dz += dt * 260 * ss(0.5, 8, this.alt);
    // steering (from clear of the tower), the barrel roll
    const steerOk = this.alt > 0.22 && !docking, want = steerOk ? inp.steer * 15 : 0;
    this.vx += (want - this.vx) * (1 - Math.exp(-dt * 6)); this.px = clamp(this.px + this.vx * dt, -11, 11); if (this.px === 11 || this.px === -11) this.vx = 0;
    if (docking) this.px *= Math.exp(-dt * 3);
    if (inp.handbrake && this.rollCd <= 0 && steerOk) { this.rollT = 0; this.rollCd = 1.6; a.whoosh(2); }
    this.rollT += dt;
    // milestones and beats
    while (this.mi < MILES.length && this.alt >= MILES[this.mi].km) { const m = MILES[this.mi]; this.reached[this.mi] = this.time; this.milestone(m, this.mi); this.mi++; }
    if (this.alt >= 60 && !this.sep) this.separate();
    if (this.alt >= 110 && !this.fair) this.dropFairing();
    if (this.alt >= 330 && !this.fired.iss) { this.fired.iss = true; this.radio('There\'s the station! Hold her steady, we\'ll line up the port.'); this.toast('ISS IN SIGHT', 'LINE UP'); }
    if (this.alt >= 250 && !this.fired.half) { this.fired.half = true; this.radio('Over halfway. That\'s orbital speed building, not just height.'); }
    // spawn and move obstacles
    if (!docking) for (const b of BANDS) { if (this.alt < b[1] || this.alt > b[2]) continue; if ((this.spawnT[b[0]] -= dt * (canBoost ? 1.35 : 1)) <= 0) { this.spawnT[b[0]] = b[3] * (0.7 + Math.random() * 0.6); this.spawn(b[0]); if (BAND_SAY[b[0]] && !this.bandSaid[b[0]]) { this.bandSaid[b[0]] = true; this.toast(BAND_SAY[b[0]][0], BAND_SAY[b[0]][1]); if (BAND_RADIO[b[0]]) this.radio(BAND_RADIO[b[0]]); } } }
    const rel = (docking ? 40 : 95) * (canBoost ? 1.35 : 1) * (slow ? 0.65 : 1), rolling = this.rollT < 0.7;
    for (const o of this.obs) {
      if (!o.on) continue; const T = this.types[o.type];
      o.z += rel * dt * (o.type === 'meteor' ? 1.3 : 1); o.x += o.vx * dt; o.rx += o.spin * dt; o.ry += o.spin * 0.7 * dt;
      const dx = Math.abs(o.x - this.px), dy = Math.abs(o.y - PIV), hitZ = Math.abs(o.z) < T.r + 3.6;
      if (!o.passed && hitZ && dx < T.r + 1.15 && dy < T.r + 2.4) {
        o.on = false;
        if (o.type === 'cell') { this.cells++; this.fuel = clamp(this.fuel + 0.25); a.chime(this.cells % 8); this.ctx.hud.plus('+FUEL'); this.trailBurst(o, 0.4, 1.6, 1.0, 1); continue; }
        if (rolling) { this.dodged++; this.ctx.hud.plus('ROLLED IT', 'near'); a.nearMiss(); continue; }
        this.hits++; this.hitT = 0.8; this.shake = Math.max(this.shake, 0.7); this.flash = Math.max(this.flash, o.type === 'cloud' ? 0.6 : 0.3);
        if (o.type !== 'cloud') this.fuel = clamp(this.fuel - 0.1); a.crash(o.type === 'cloud' ? 4 : 12); this.ctx.hud.plus(o.type === 'cloud' ? 'WHOOMPH' : 'BONK', 'hit');
        this.trailBurst(o, 1, 0.95, 0.9, 0); continue;
      }
      if (!o.passed && o.z > 4) { o.passed = true; if (o.type !== 'cell') { this.dodged++; if (dx < T.r + 3.4 && this.nearCd <= 0) { this.nearCd = 1.2; this.ctx.hud.plus('CLOSE CALL', 'near'); a.nearMiss(); } } }
      if (o.z > 14) o.on = false;   // gone before it reaches the chase camera
    }
    // exhaust, separation debris, the station
    this.exhaust(dt, rel);
    if (this.sep && this.sep.t < 4) { const s = this.sep; s.t += dt; s.o.position.addScaledVector(s.v, dt); s.v.y -= 6 * dt; s.o.rotation.x += dt * 0.6; s.o.rotation.z += dt * 0.25; if (s.t >= 4) s.o.visible = false; }
    if (this.fair && this.fair.t < 4) { const f = this.fair; f.t += dt; for (const [o, sx] of [[this.rk.fairL, 1], [this.rk.fairR, -1]]) { o.position.x += sx * 9 * dt; o.position.z += 22 * dt; o.rotation.z += sx * dt * 2.5; o.rotation.x += dt; } if (f.t >= 4) this.rk.fairL.visible = this.rk.fairR.visible = false; }
    if (this.phase === 'ascent' && this.alt >= ISS_KM - 4) { this.phase = 'dock'; this.dockT = 0; this.ctx.labels({ boost: 'THRUST', brake: 'SLOW', drift: 'ROLL' }); }
    if (this.phase === 'dock') {
      this.dockT += dt;
      if (this.u >= 1 && !this.fired.dock) { this.fired.dock = true; this.docked(); }
      if (this.fired.dock && this.dockT > 0 && this.t > 2.4 && !this.card) { this.card = true; this.phase = 'card'; this.showAscentCard(); }
    }
  }
  spawn(type) {
    const o = this.obs.find((q) => !q.on); if (!o) return;   // ponytail: linear scan of a 90-slot pool on spawn only, fine
    o.on = true; o.type = type; o.passed = false; o.z = -330; o.vx = 0; o.spin = (Math.random() - 0.5) * 2; o.rx = Math.random() * 6; o.ry = Math.random() * 6; o.s = 0.85 + Math.random() * 0.4;
    o.x = clamp(this.px + (Math.random() - 0.5) * 16, -11.5, 11.5); o.y = PIV + (Math.random() - 0.5) * 2.4;
    if (type === 'meteor') { const s = Math.random() < 0.5 ? -1 : 1; o.x = this.px - s * 28; o.vx = s * (14 + Math.random() * 8); o.y = PIV + 1 + Math.random() * 2; }
    if (type === 'cloud') { o.s = 1 + Math.random() * 0.5; o.spin = 0; }
    if (type === 'bird') { o.spin = 0; for (let k = 0; k < 2; k++) { const q = this.obs.find((w) => !w.on); if (!q) break; Object.assign(q, { on: true, type, passed: false, z: o.z - 4 - k * 5, x: clamp(o.x + (k ? 2.6 : -2.6), -11.5, 11.5), y: o.y + 0.6 + k * 0.3, vx: 0, spin: 0, rx: Math.random() * 6, ry: 0, s: 0.9 }); } }
  }
  milestone(m, i) {
    const a = this.ctx.audio;
    if (m.km === 100) { this.badge(); this.ctx.count('space-karman'); a.finish(true); a.chime(7); a.whoosh(2); this.flash = 1; this.shake = 0.6; }
    else { this.toast(m.title, `${m.km} KM`); a.chime(i); }
    if (m.km === 12) this.shake = Math.max(this.shake, 0.9);   // max Q rattles
    if (m.km !== ISS_KM) this.radio(m.fact);
  }
  separate() {
    const rk = this.rk, b = rk.booster; this.scene.attach(b); rk.flameBig.visible = false; rk.flameSmall.visible = true;
    this.sep = { t: 0, o: b, v: new THREE.Vector3(0, -3, 26) }; this.shake = 0.8; this.flash = 0.35; const a = this.ctx.audio; a.thud(); a.whoosh(1); if (a.ctx) a.noise(a.ctx.currentTime, 0.6, 0.4, 900, 'bandpass');
    this.toast('STAGE 2', 'BOOSTER AWAY'); this.radio('Stage one\'s done its job. Stage two takes it from here.');
    this.rk.flameSmall.getWorldPosition(this._t); for (let k = 0; k < 24; k++) this.trailFx.emit(this._t.x, this._t.y, this._t.z, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, 10 + Math.random() * 20, { life: 1.2, size: 1.6, grow: 2, drag: 1.2, r: 1, g: 0.9, b: 0.85 });
  }
  dropFairing() { const rk = this.rk; this.scene.attach(rk.fairL); this.scene.attach(rk.fairR); this.fair = { t: 0 }; this.ctx.audio.thud(); this.ctx.audio.whoosh(0); this.toast('FAIRING OFF', 'NOSE COVER GONE'); this.radio('Nose cover off. There\'s no air left up here to protect us from.'); }
  docked() {
    const a = this.ctx.audio, best = this.best(); this.dockTime = this.time; this.ctx.count('space-orbit');
    a.finish(true); a.chime(12); a.thud(); this.flash = 0.9; this.shake = 0.4; this.toast('DOCKED', 'WELCOME TO THE ISS', 2.4); this.radio(MILES[MILES.length - 1].fact, 5);
    this.isBest = !best || this.dockTime < best; if (this.isBest) try { localStorage.setItem('wis-space-best', this.dockTime.toFixed(2)); } catch (e) { /* private window */ }
    this.t = 0;
  }
  best() { try { return +localStorage.getItem('wis-space-best') || 0; } catch (e) { return 0; } }
  exhaust(dt, rel) {
    const rk = this.rk, f = rk.flameSmall.visible ? rk.flameSmall : rk.flameBig; if (!f.visible) return;
    f.getWorldPosition(this._t); const p = this.pivot, k = this.alt < 50 ? 1 : 0.25, n = this.alt < 3 ? 3 : this.alt < 50 ? 2 : 1;
    const ax = -Math.sin(p.rotation.z) * 0, ay = -Math.cos(p.rotation.x), az = -Math.sin(-p.rotation.x);   // backward along the rocket axis
    for (let i = 0; i < n; i++) {
      if (Math.random() > k) continue; const sp = 18 + Math.random() * 8, hot = this.alt > 50;
      this.trailFx.emit(this._t.x + (Math.random() - 0.5) * 0.6, this._t.y, this._t.z, ax * sp + (Math.random() - 0.5) * 3, ay * sp, az * sp + rel * 0.55, { life: hot ? 0.5 : 1.6, size: hot ? 0.7 : 1.5 + this.alt * 0.02, grow: hot ? 1 : 3, drag: 0.6, r: hot ? 1.0 : 0.8, g: hot ? 0.55 : 0.7, b: hot ? 0.3 : 0.72, add: hot ? 1 : 0 });
    }
    if (this.lift >= 0 && this.lift < 6) this.padSmoke(this.lift < 3 ? 4 : 2);
  }
  padSmoke(n) {
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 10 + Math.random() * 14; this.groundFx.emit(Math.cos(a) * 3, 1 + Math.random(), Math.sin(a) * 3 + 2, Math.cos(a) * s, 1.5 + Math.random() * 3, Math.sin(a) * s, { life: 3 + Math.random() * 1.5, size: 5, grow: 2.5, drag: 0.7, r: 0.8, g: 0.7, b: 0.7 }); }
    if (Math.random() < 0.5) this.groundFx.emit(0, 0.8, 1, (Math.random() - 0.5) * 6, 2, 8, { life: 0.5, size: 2.5, grow: 1, drag: 1, r: 1, g: 0.6, b: 0.25, add: 1 });
  }
  vent() { const s = Math.random() < 0.5 ? -1 : 1; this.groundFx.emit(s * 1.1, 9.5 + Math.random() * 2, 0.2, s * (3 + Math.random() * 2), 0.5, (Math.random() - 0.5), { life: 1.3, size: 0.9, grow: 2.5, drag: 1.4, r: 0.8, g: 0.8, b: 0.82 }); }
  trailBurst(o, r, g, b, add) { for (let k = 0; k < 14; k++) this.trailFx.emit(o.x, o.y, o.z, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 16 + 20, { life: 0.8, size: 0.9, grow: 1.5, drag: 2, r, g, b, add }); }

  // ------------------------------------------------------------------------------------------------ explore
  enterExplore() {
    const c = this.ctx; this.buildExplore(); this.phase = 'explore'; this.t = 0; this.hideCard(); c.count('space-explore');
    this.world.visible = false; this.sky.visible = false; this.space.show(false); this.iss.visible = false; for (const k in this.types) this.types[k].mesh.count = 0; for (const o of this.obs) o.on = false;
    const rk = this.rk; rk.booster.visible = false; rk.fairL.visible = rk.fairR.visible = false; rk.flameBig.visible = false; rk.flameSmall.visible = true; this.groundFx.life.fill(0); this.trailFx.life.fill(0);
    { const sp = this.space; sp.litSun.copy(sp.sun); sp.litSun.y += sp.sunLift; sp.litSun.normalize(); sp.U.uFade.value = 1; sp.U.uGain.value = sp.gain; }   // the shared Earth material, lit and faded in (as at 408 km) even when EXPLORE opens straight away
    this.explore.group.visible = true; this.explore.reset(); this.flash = 1; c.audio.whoosh(2); c.audio.chime(4);
    this.ui.classList.remove('sp-a'); this.ui.classList.add('sp-x'); this.setTop('explore'); this.chipText = '';
    c.labels({ boost: 'THRUST', brake: 'SLOW', drift: 'WARP' });
    this.toast('OPEN SPACE', 'HOLD WARP TO FLY'); this.radio(c.isTouch ? 'Hold WARP and I\'ll take us to the target. Tap the target to pick another.' : 'Hold Space to warp to the target. T picks another one.');
  }
  stepExplore(dt, inp) {
    if (this.phase === 'xcard') return;
    this.explore.step(dt, inp, (b) => this.arrived(b));
  }
  arrived(b) {
    const c = this.ctx, n = this.visitedN(), nine = NINE.includes(b.id);
    c.audio.finish(true); c.audio.chime(nine ? n : 3); this.flash = 0.4;
    this.toast(b.name, nine ? `VISITED ${n}/9` : 'EASTER EGG FOUND', 2.4); this.radio(b.fact, 6);
    const key = { moon: 'space-moon', saturn: 'space-saturn', sun: 'space-sun', neptune: 'space-neptune', roadster: 'space-roadster' }[b.id]; if (key) c.count(key);
    this.setTop('explore');
    if (nine && n === 9) { c.count('space-all9'); this.t = 0; setTimeout(() => { if (this.phase === 'explore') this.showExploreCard(); }, 2600); }
  }
  visitedN() { let n = 0; for (const id of NINE) if (this.explore.visited.has(id)) n++; return n; }

  // ------------------------------------------------------------------------------------------------ render
  render(dt) {
    const c = this.ctx, cam = c.camera, ex = this.phase === 'explore' || this.phase === 'xcard';
    const shx = this.shake * this.shake * (Math.sin(this.time * 61) * 0.6 + Math.sin(this.time * 37) * 0.4), shy = this.shake * this.shake * Math.sin(this.time * 53 + 1);
    let warp = 0;
    if (ex) { warp = this.explore.render(dt, cam, this.pivot, this.time); cam.position.x += shx * 0.4; cam.position.y += shy * 0.4; this.sunL.position.set(0, 0, 0).sub(this.explore.pos).normalize().multiplyScalar(100).add(this.explore.pos); this.sunL.target.position.copy(this.explore.pos); this.sunL.target.updateMatrixWorld(); this.sunL.color.setRGB(1, 0.95, 0.9); this.hemi.intensity = 0.35; this.fill.intensity = 0.25; }
    else this.renderAscent(dt, cam, shx, shy);
    this.rk.flameMat.uniforms.uTime.value = this.time;
    this.hudFrame(dt, warp);
    const U = this.post.uniforms;
    if (U) {
      if (ex) { this._t.set(0, 0, 0).project(cam); } else this._t.copy(SUN).multiplyScalar(5000).add(cam.position).project(cam);
      const vis = this._t.z < 1 && Math.abs(this._t.x) < 1.2 && Math.abs(this._t.y) < 1.2 ? 1 : 0; U.sun.value.set(this._t.x * 0.5 + 0.5, this._t.y * 0.5 + 0.5); U.sunVis.value = vis * (ex ? 0.6 : 1 - ss(30, 80, this.alt));
      U.time.value = (this.time % 10) + 1; U.speed.value = ex ? warp : this.boosting ? 0.15 : this.phase === 'ascent' && this.lift < 1.5 ? 0.3 : 0; U.hit.value = this.hitT > 0 ? this.hitT * 0.4 : 0;
    }
    this.post.render();
  }
  renderAscent(dt, cam, shx, shy) {
    const alt = this.alt, rk = this.rk, p = this.pivot, h = alt * 1000, lift = this.lift;
    // the rocket: gravity turn, steer bank, barrel roll
    const roll = this.rollT < 0.7 ? ss(0, 0.7, this.rollT) * Math.PI * 2 : 0;
    p.position.set(this.px, PIV, 0); p.rotation.set(-pitchAt(alt), 0, 0, 'YXZ'); p.rotateY(roll - this.vx * 0.035); p.rotateZ(0);
    const thrust = this.phase === 'count' ? (this.t > 1.85 ? ss(1.85, 2.25, this.t) * 0.8 : 0) : this.phase === 'ascent' ? (this.boosting ? 1.25 : 1) : this.phase === 'dock' ? 0.35 : 0.15;
    rk.flameMat.uniforms.uPow.value = thrust * (0.9 + Math.random() * 0.1); const vac = 1 + ss(20, 120, alt) * 1.6; rk.flameBig.scale.set(vac, 1 + (this.boosting ? 0.35 : 0), vac); rk.flameSmall.scale.set(0.62 * vac, 0.62, 0.62 * vac);
    // the world below
    this.world.position.set(0, -h, this.dz); this.world.visible = alt < 45;
    this.groundU.uFade.value = 1 - ss(12, 24, alt); this.groundU.uH.value = h; this.ground.visible = alt < 24; this.pad.visible = this.arm.visible = this.padLights.visible = alt < 6;
    this.deckU.uFade.value = ss(8.5, 11, alt) * (1 - ss(28, 40, alt)); this.deck.visible = this.deckU.uFade.value > 0.003;
    this.skyU.uDark.value = ss(5, 55, alt); this.skyU.uFade.value = 1 - ss(48, 66, alt); this.sky.visible = alt < 66;
    this.hemi.intensity = lerp(1.4, 0.55, ss(20, 80, alt)); this.fill.intensity = lerp(1.1, 0.6, ss(20, 80, alt)); this.sunL.color.setRGB(1, lerp(0.7, 0.92, ss(10, 60, alt)), lerp(0.48, 0.85, ss(10, 60, alt)));
    this.sunL.position.copy(SUN).multiplyScalar(100); this.sunL.target.position.set(0, 0, 0); this.sunL.target.updateMatrixWorld();
    // obstacles -> instance matrices
    const o3 = this._o; for (const k in this.types) this.types[k].n2 = 0;
    for (const o of this.obs) {
      if (!o.on) continue; const T = this.types[o.type]; if (T.n2 >= T.n) continue;
      o3.position.set(o.x, o.y, o.z); o3.scale.setScalar(o.s);
      if (o.type === 'bird') { o3.rotation.set(0, Math.PI, 0); o3.scale.set(o.s, o.s * (0.55 + 0.45 * Math.sin(this.time * 14 + o.rx * 3)), o.s); }
      else if (o.type === 'meteor') o3.rotation.set(0, Math.atan2(o.vx, -95), 0);
      else if (o.type === 'cloud' || o.type === 'balloon') o3.rotation.set(0, o.rx, 0);
      else o3.rotation.set(o.rx, o.ry, 0);
      o3.updateMatrix(); T.mesh.setMatrixAt(T.n2++, o3.matrix);
    }
    for (const k in this.types) { const T = this.types[k]; T.mesh.count = T.n2; T.mesh.instanceMatrix.needsUpdate = true; }
    // the station
    this.iss.visible = alt > 320; if (this.iss.visible) { const gap = (ISS_KM - alt) * 45; this.iss.position.set(0, PIV, -8.3 - 6.6 - gap); }
    // camera: on the pad (fixed to the ground, pushing in), then a chase rig behind the rocket, then a beauty shot at the station
    const push = this.phase === 'count' ? ss(0, 2.25, this.t) : 1, wy = -h;
    const P = this._camP.set(lerp(21, 12.5, push), lerp(5.5, 2.6, push) + wy, lerp(44, 26, push) + this.dz), L = this._camL.set(0, PIV + lerp(1, 3, push), 0);
    const b = this.phase === 'count' ? 0 : ss(1.4, 4.8, lift), hi = ss(40, 160, this.alt), cp = this._c2.set(this.px * 0.85 + hi * 9, PIV + 6.5 + hi * 9, 34 - hi * 6), cl = this._l2.set(this.px * 0.9 - hi * 17, PIV - 2.5 - hi * 3, -60);
    P.lerp(cp, b); L.lerp(cl, b);
    if (this.phase === 'dock' || this.phase === 'card') { const k = ss(0, 3, this.dockT), ang = this.phase === 'card' ? this.t * 0.06 : 0; P.lerp(this._c2.set(Math.sin(0.7 + ang) * 34, PIV + 9, -14 + Math.cos(0.7 + ang) * 34), k); L.lerp(this._l2.set(0, PIV, -14), k); }
    cam.position.set(P.x + shx, P.y + shy, P.z); cam.up.set(0, 1, 0); cam.lookAt(L);
    cam.fov = (this.phase === 'count' ? lerp(46, 40, push) : lerp(40, 60, b)) + (this.boosting ? 5 : 0); cam.near = 0.5; cam.far = 60000; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    this.sky.position.copy(cam.position);
    this.space.update(alt, cam, dt);
  }

  // ------------------------------------------------------------------------------------------------ sound: a rumble that thins out with the air, a soft hum in vacuum
  ensureSound() {
    const a = this.ctx.audio; if (this.snd || !a.ctx || !a.noiseBuf) return; const c = a.ctx;
    const loop = (type, f, q) => { const s = c.createBufferSource(); s.buffer = a.noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(a.sfx); s.start(); return { g, fl }; };
    const r = loop('lowpass', 130, 0.8), k = loop('bandpass', 700, 1.2), o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 58; const hg = c.createGain(); hg.gain.value = 0; o.connect(hg); hg.connect(a.sfx); o.start();
    this.snd = { c, rg: r.g, cg: k.g, cf: k.fl, hg };
  }
  sound(warp) {
    const s = this.snd; if (!s) return; const t = s.c.currentTime, ph = this.phase, air = 1 - ss(40, 100, this.alt);
    let rum = 0, cr = 0, hum = 0.02, cf = 700;
    if (ph === 'count') rum = this.t > 1.85 ? 0.5 : 0;
    else if (ph === 'ascent') { rum = (0.4 + (this.boosting ? 0.2 : 0)) * air + 0.05; cr = 0.14 * air; hum = 0.03 * (1 - air) + 0.01; }
    else if (ph === 'dock' || ph === 'card') hum = 0.03;
    else if (ph === 'explore' || ph === 'xcard') { hum = 0.03; cr = 0.07 * warp; cf = 400 + warp * 1600; }
    s.rg.gain.setTargetAtTime(rum, t, 0.15); s.cg.gain.setTargetAtTime(cr, t, 0.15); s.hg.gain.setTargetAtTime(hum, t, 0.4); s.cf.frequency.setTargetAtTime(cf, t, 0.2);
  }
  beep(hi) { const a = this.ctx.audio; if (!a.ctx) return; a.tone(hi ? 1320 : 880, a.ctx.currentTime, 0.18, 'square', 0.07); a.tone(110, a.ctx.currentTime, 0.2, 'sine', 0.3, a.sfx, 0.6); }

  // ------------------------------------------------------------------------------------------------ messages: toasts and radio lines queue so beats never trample each other
  toast(big, small, dur = 1.9) { this.toastQ.push([big, small, dur]); }
  radio(text, dur = 3.6) { this.radioQ.push([text, dur]); }
  queues(dt) {
    this.toastCd -= dt; this.radioCd -= dt; const h = this.ctx.hud;
    if (this.toastCd <= 0 && this.toastQ.length) { const [b, s, d] = this.toastQ.shift(); h.toast(b, s, d); this.toastCd = Math.min(d, 1.5); }
    if (this.radioCd <= 0 && this.radioQ.length) { const [t, d] = this.radioQ.shift(); h.radio(t, d); this.ctx.audio.voice(t); this.radioCd = 1.2 + t.length / 30; }
  }
  say(txt) { this.cnt = { t0: this.time, dur: txt === 'GO' ? 1.3 : 0.75 }; const e = this.el.count; e.textContent = txt === 'GO' ? 'LIFTOFF' : txt; e.className = txt === 'GO' ? 'go' : ''; }
  badge() { this.bdg = { t0: this.time, dur: 3.2 }; }
  // pop-in, hold, fade: driven by game time so stepped tests and slow phones see the same thing
  pop(e, a, k0 = 0.18, s0 = 1.8) { if (!a) { if (e.style.opacity !== '0') e.style.opacity = '0'; return; } const k = (this.time - a.t0) / a.dur; if (k >= 1) { e.style.opacity = '0'; return; }
    const o = k < k0 ? k / k0 : k > 0.8 ? (1 - k) / 0.2 : 1, sc = k < k0 ? s0 - (s0 - 1) * k / k0 : 1 - 0.06 * Math.max(0, (k - 0.8) / 0.2); e.style.opacity = o.toFixed(2); e.style.transform = `translate(-50%,-50%) scale(${sc.toFixed(3)})`; }

  // ------------------------------------------------------------------------------------------------ HUD
  buildUI() {
    const ui = (this.ui = this.ctx.ui); ui.innerHTML = ''; ui.classList.add('sp');
    const st = document.createElement('style'); st.textContent = CSS; ui.appendChild(st);
    const div = (id, cls = '', html = '') => { const d = document.createElement('div'); if (id) d.id = id; if (cls) d.className = cls; d.innerHTML = html; ui.appendChild(d); return d; };
    this.el = {};
    this.el.top = div('sp-top', 'sp-panel');
    const lad = div('sp-ladder', '', '<div class="tr"><i></i></div>'); this.el.ladFill = lad.querySelector('i');
    let last = -99; const H = 1; for (const m of MILES) { const y = Math.sqrt(m.km / ISS_KM) * 100, t = document.createElement('div'); t.className = 'tk'; t.style.bottom = y + '%'; t.innerHTML = (y - last > 9 ? `<span>${m.km}</span>` : ''); if (y - last > 9) last = y; if (m.km === 100) t.classList.add('km'); lad.appendChild(t); }
    this.el.rkt = document.createElement('b'); this.el.rkt.className = 'rk'; lad.appendChild(this.el.rkt); this.el.ladder = lad; void H;
    this.el.count = div('sp-count'); this.el.badge = div('sp-badge', '', 'SPACE<small>100 KM · THE KARMAN LINE</small>'); this.el.flash = div('sp-flash');
    this.el.keys = div('sp-keys'); this.el.ring = div('sp-ring', '', '<b></b><span></span>'); this.el.arrow = div('sp-arrow', '', '<i></i><span></span>');
    const chip = document.createElement('button'); chip.id = 'sp-chip'; chip.type = 'button'; ui.appendChild(chip); chip.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.cycle(1); }); this.el.chip = chip;
    this.el.card = div('sp-card'); this.cache = {};
  }
  setTop(kind) {
    const t = this.el.top, touch = this.ctx.isTouch;
    if (kind === 'ascent') { t.innerHTML = '<div class="c"><small>ALTITUDE</small><b id="spAlt">0.0</b><i>KM</i></div><div class="c"><small>SPEED</small><b id="spSpd">0.00</b><i>KM/S</i></div><div class="c f"><small>FUEL</small><div class="bar"><i id="spFuel"></i></div></div>';
      this.el.keys.innerHTML = 'A D STEER · W THRUST · S SLOW · SPACE ROLL'; }
    else { t.innerHTML = `<div class="c"><small>SPEED</small><b id="spSpd">0</b><i id="spSpdU">KM/S</i></div><div class="c"><small>VISITED</small><b>${this.visitedN()}</b><i>/ 9</i></div><button id="spDone" type="button">DONE</button>`;
      t.querySelector('#spDone').addEventListener('click', () => this.showExploreCard()); this.el.keys.innerHTML = 'A D STEER · W THRUST · S SLOW · HOLD SPACE WARP · T NEXT TARGET'; }
    this.el.alt = t.querySelector('#spAlt'); this.el.spd = t.querySelector('#spSpd'); this.el.spdU = t.querySelector('#spSpdU'); this.el.fuel = t.querySelector('#spFuel'); this.cache = {}; void touch;
  }
  set(k, el, v) { if (el && this.cache[k] !== v) { this.cache[k] = v; el.textContent = v; } }
  hudFrame(dt, warp) {
    const ex = this.phase === 'explore' || this.phase === 'xcard', e = this.el;
    this.sound(warp);
    e.flash.style.opacity = (this.flash * 0.6).toFixed(2); this.pop(e.count, this.cnt); this.pop(e.badge, this.bdg, 0.12, 0.4);
    if (!ex) {
      this.set('alt', e.alt, this.alt < 100 ? this.alt.toFixed(1) : Math.floor(this.alt).toString()); this.set('spd', e.spd, speedAt(this.alt).toFixed(2));
      if (e.fuel) { const f = Math.round(this.fuel * 100); if (this.cache.f !== f) { this.cache.f = f; e.fuel.style.width = f + '%'; e.fuel.parentNode.classList.toggle('low', this.fuel < 0.2); } }
      const y = Math.round(Math.sqrt(this.alt / ISS_KM) * 1000) / 10; if (this.cache.y !== y) { this.cache.y = y; e.ladFill.style.height = y + '%'; e.rkt.style.bottom = y + '%'; }
      this.ctx.hud.boost(this.fuel, this.fuel <= 0.01, this.boosting);
      return;
    }
    // explore: speed, the target chip, the target ring or an edge arrow
    const X = this.explore, tgt = X.target, km = X.dist;
    if (X.warping && X.trueSpeed > 20000) { this.set('spd', e.spd, (X.trueSpeed / LIGHT).toFixed(X.trueSpeed < LIGHT * 10 ? 1 : 0)); this.set('spdU', e.spdU, '× LIGHT'); }
    else { this.set('spd', e.spd, X.warping ? Math.round(X.trueSpeed).toLocaleString('en-US') : (X.vel * 0.128).toFixed(1)); this.set('spdU', e.spdU, 'KM/S'); }
    const ct = `<small>TARGET ▸ TAP TO CHANGE</small><b>${tgt.name}</b><span>${fmtKm(km)} · LIGHT TAKES ${lightTime(km)}</span>`;
    if (Math.round(km / 1000) !== this.cache.km || tgt !== this.cache.tgt) { this.cache.km = Math.round(km / 1000); this.cache.tgt = tgt; e.chip.innerHTML = this.ctx.isTouch ? ct : ct.replace('TAP TO CHANGE', 'T TO CHANGE'); }
    const cam = this.ctx.camera, v = this._t.copy(tgt.pos).project(cam), W = innerWidth, H = innerHeight, behind = v.z > 1;
    const on = !behind && Math.abs(v.x) < 0.86 && Math.abs(v.y) < 0.8, rr = tgt.R / this._q.copy(tgt.pos).distanceTo(cam.position) * H / Math.tan(cam.fov * Math.PI / 360) * 0.5, huge = !behind && rr > 150;   // a world that fills the view needs no ring
    e.ring.style.display = on && !huge ? 'block' : 'none'; e.arrow.style.display = on || huge ? 'none' : 'block';
    if (on) { const r = clamp(rr, 18, 160); e.ring.style.transform = `translate(${((v.x * 0.5 + 0.5) * W).toFixed(0)}px,${((-v.y * 0.5 + 0.5) * H).toFixed(0)}px)`; e.ring.style.setProperty('--r', (r + 10).toFixed(0) + 'px'); this.set('rn', e.ring.firstChild, tgt.name); }
    else { let x = v.x, y = v.y; if (behind) { x = -x; y = -y; } const a = Math.atan2(y, x), m = Math.max(Math.abs(Math.cos(a)) / 0.82, Math.abs(Math.sin(a)) / 0.62), px = (Math.cos(a) / m * 0.5 + 0.5) * W, py = (-Math.sin(a) / m * 0.5 + 0.5) * H;
      e.arrow.style.transform = `translate(${px.toFixed(0)}px,${py.toFixed(0)}px)`; e.arrow.firstChild.style.transform = `rotate(${(-a).toFixed(2)}rad)`; this.set('an', e.arrow.lastChild, tgt.name); }
  }

  // ------------------------------------------------------------------------------------------------ result cards
  hideCard() { if (this.ui) this.ui.classList.remove('sp-card'); if (this.el) { this.el.card.className = ''; this.el.card.innerHTML = ''; } }
  showAscentCard() {
    const c = this.ctx, t = this.dockTime || this.time, best = this.best(), e = this.el.card;
    const rows = MILES.map((m, i) => `<div class="r ${this.reached[i] >= 0 ? 'y' : ''}${m.km === 100 ? ' k' : ''}"><b>${m.km} KM</b><span>${m.title}</span><i>${this.reached[i] >= 0 ? this.reached[i].toFixed(1) + ' S' : ''}</i></div>`).reverse().join('');
    e.innerHTML = `<small>STAR HOPPER · ORBIT REACHED</small><h2>ISS IN ${t.toFixed(1)} S</h2><div class="best">${this.isBest ? 'NEW BEST' : `BEST ${best.toFixed(1)} S`} · ${this.cells} FUEL CELLS · ${this.hits} BUMPS</div>
      <div class="lad">${rows}</div><p>I flew a rocket to the space station in ${t.toFixed(1)} seconds and dodged ${this.dodged} things on the way. Beat that.</p>
      <div class="btns"><button data-a="x" class="pri">EXPLORE SPACE</button><button data-a="r">RETRY</button><button data-a="b">BACK TO THE CITY</button></div>`;
    this.cardButtons(e, { x: () => this.enterExplore(), r: () => this.resetAscent(), b: () => c.exit() }); e.className = 'on'; this.ui.classList.add('sp-card');
  }
  showExploreCard() {
    if (this.phase !== 'explore') return; const X = this.explore, n = this.visitedN(), e = this.el.card; this.phase = 'xcard';
    const names = { moon: 'MOON', mercury: 'MERCURY', venus: 'VENUS', mars: 'MARS', jupiter: 'JUPITER', saturn: 'SATURN', uranus: 'URANUS', neptune: 'NEPTUNE', sun: 'SUN' };
    const chips = NINE.map((id) => `<span class="${X.visited.has(id) ? 'y' : ''}">${names[id]}</span>`).join(''), km = X.trueKm;
    e.innerHTML = `<small>STAR HOPPER · SPACE LOG</small><h2>${n}/9 WORLDS</h2><div class="chips">${chips}</div><div class="best">${km > 0 ? `${fmtKm(km)} COVERED · LIGHT WOULD TAKE ${lightTime(km)}` : 'HOLD WARP TO REACH YOUR FIRST WORLD'}</div>
      <p>${n ? `I warped to ${n} of 9 worlds in a cartoon rocket and covered ${fmtKm(km).toLowerCase()}.` : 'I made it to orbit. The planets are next.'} Your turn.</p>
      <div class="btns"><button data-a="k" class="pri">KEEP EXPLORING</button><button data-a="r">RETRY LAUNCH</button><button data-a="b">BACK TO THE CITY</button></div>`;
    this.cardButtons(e, { k: () => { this.hideCard(); this.phase = 'explore'; }, r: () => this.resetAscent(), b: () => this.ctx.exit() }); e.className = 'on'; this.ui.classList.add('sp-card');
  }
  cardButtons(e, acts) { e.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { this.ctx.audio.whoosh(1); acts[b.dataset.a](); })); }
}

const CSS = `
.sp{--pad:max(10px,var(--sa-top))}
.sp-panel{background:rgba(20,26,58,.84);border-radius:12px;box-shadow:0 3px 0 rgba(0,0,0,.35)}
#sp-top{position:absolute;top:max(10px,var(--sa-top));left:calc(max(10px,var(--sa-left)) + 50px);right:max(10px,var(--sa-right));max-width:520px;margin-left:auto;display:flex;align-items:stretch;gap:2px;padding:5px 6px;height:48px}
#sp-top .c{flex:1;min-width:0;display:flex;flex-direction:column;justify-content:center;padding:0 8px;border-right:1px solid rgba(255,244,230,.12);line-height:1}
#sp-top .c:last-of-type{border-right:0}
#sp-top small{font-size:10px;font-weight:900;letter-spacing:.16em;color:var(--sun);margin-bottom:3px}
#sp-top b{font-size:clamp(17px,5vw,22px);font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}
#sp-top i{font-style:normal;font-size:10px;font-weight:900;letter-spacing:.12em;opacity:.75;margin-top:2px}
#sp-top .c b+i{display:inline}
#sp-top .f .bar{height:12px;border-radius:6px;background:rgba(255,244,230,.15);overflow:hidden;margin-top:2px}
#sp-top .f .bar i{display:block;height:100%;width:100%;margin:0;background:#5fe0a8;border-radius:6px;transition:width .2s}
#sp-top .f .bar.low i{background:var(--coral)}
#spDone{pointer-events:auto;align-self:center;min-width:56px;height:38px;border:0;border-radius:10px;background:var(--sun);color:var(--navy);font:900 12px var(--f);letter-spacing:.08em;box-shadow:0 3px 0 #c99a1c;cursor:pointer;margin-left:4px}
#sp-ladder{position:absolute;right:max(12px,var(--sa-right));top:calc(max(10px,var(--sa-top)) + 140px);bottom:calc(max(18px,var(--sa-bottom)) + var(--bb) + var(--db) + 30px);width:12px}
.notouch #sp-ladder{bottom:max(24px,var(--sa-bottom));top:calc(max(10px,var(--sa-top)) + 72px)}
#sp-ladder .tr{position:absolute;inset:0;border-radius:6px;background:rgba(20,26,58,.7);box-shadow:0 2px 0 rgba(0,0,0,.35);overflow:hidden}
#sp-ladder .tr i{position:absolute;left:0;right:0;bottom:0;height:0;background:linear-gradient(0deg,#ff8a5c,var(--sun) 50%,#9fd8ff)}
#sp-ladder .tk{position:absolute;right:0;width:20px;height:2px;margin-bottom:-1px;background:rgba(255,244,230,.8)}
#sp-ladder .tk span{position:absolute;right:24px;top:-7px;font:900 10px/1 var(--f);letter-spacing:.04em;text-shadow:0 1px 0 rgba(0,0,0,.7);white-space:nowrap}
#sp-ladder .tk.km{background:var(--sun);width:24px}#sp-ladder .tk.km span{color:var(--sun)}
#sp-ladder .rk{position:absolute;left:50%;width:22px;height:22px;margin:0 0 -11px -11px;border-radius:50%;background:var(--coral);border:3px solid var(--cream);box-shadow:0 2px 0 rgba(0,0,0,.4);transition:bottom .1s linear}
.sp-x #sp-ladder,.sp-card #sp-ladder,.sp-card #sp-chip,.sp-card #sp-ring,.sp-card #sp-arrow,.sp-a #sp-chip,.sp-a #sp-ring,.sp-a #sp-arrow{display:none!important}
#sp-count{position:absolute;left:50%;top:40%;transform:translate(-50%,-50%) scale(.4);opacity:0;font:900 clamp(90px,30vw,170px)/1 var(--f);color:var(--cream);text-shadow:0 6px 0 var(--navy),0 0 40px rgba(255,140,60,.8)}
#sp-count.go{font-size:clamp(46px,14vw,92px);color:var(--sun)}
#sp-badge{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%) scale(.3);opacity:0;padding:18px 30px;border-radius:24px;background:var(--navy);border:5px solid var(--sun);box-shadow:0 6px 0 rgba(0,0,0,.4),0 0 60px rgba(255,216,77,.7);font:900 clamp(48px,15vw,96px)/1 var(--f);letter-spacing:.08em;color:var(--sun);text-align:center;white-space:nowrap}
#sp-badge small{display:block;margin-top:8px;font-size:clamp(11px,3vw,15px);letter-spacing:.14em;color:var(--cream)}
#sp-flash{position:absolute;inset:0;background:#fff4e6;opacity:0;mix-blend-mode:screen}
#sp-keys{position:absolute;left:50%;bottom:max(14px,var(--sa-bottom));transform:translateX(-50%);font:800 11px var(--f);letter-spacing:.1em;opacity:.8;text-shadow:0 1px 0 rgba(0,0,0,.6);white-space:nowrap}
.touch #sp-keys{display:none}
#sp-chip{position:absolute;pointer-events:auto;left:max(16px,var(--sa-left));bottom:calc(max(18px,var(--sa-bottom)) + var(--tb) + 12px);max-width:min(64vw,330px);min-height:48px;padding:7px 12px;border:0;border-radius:12px;background:rgba(20,26,58,.88);color:var(--cream);text-align:left;font-family:var(--f);box-shadow:0 3px 0 rgba(0,0,0,.35);cursor:pointer;border-left:4px solid var(--sun)}
#sp-chip small{display:block;font:900 10px var(--f);letter-spacing:.14em;color:var(--sun)}#sp-chip b{display:block;font:900 16px/1.2 var(--f);letter-spacing:.04em}#sp-chip span{display:block;font:800 10px/1.25 var(--f);letter-spacing:.04em;opacity:.9}
.notouch #sp-chip{left:50%;transform:translateX(-50%);bottom:calc(max(14px,var(--sa-bottom)) + 26px);text-align:center;border-left:0;border-top:4px solid var(--sun)}
@media (max-height:520px){.touch #sp-chip{left:50%;transform:translateX(-50%);bottom:max(14px,var(--sa-bottom));max-width:min(46vw,330px)}.touch #sp-ladder{top:calc(max(10px,var(--sa-top)) + 66px);bottom:max(20px,var(--sa-bottom));right:calc(max(16px,var(--sa-right)) + var(--bb) + var(--db) + 34px)}}
#sp-ring{position:absolute;left:0;top:0;--r:40px}
#sp-ring::before{content:"";position:absolute;left:calc(var(--r) * -1);top:calc(var(--r) * -1);width:calc(var(--r) * 2);height:calc(var(--r) * 2);border-radius:50%;border:3px solid var(--sun);box-shadow:0 0 0 2px rgba(20,26,58,.6);opacity:.9;animation:spSpin 1.6s ease-in-out infinite alternate}
#sp-ring b{position:absolute;top:calc(var(--r) + 6px);left:0;transform:translateX(-50%);font:900 12px var(--f);letter-spacing:.12em;color:var(--sun);white-space:nowrap;text-shadow:0 1px 0 rgba(0,0,0,.7)}
@keyframes spSpin{from{transform:scale(1)}to{transform:scale(1.08)}}
#sp-arrow{position:absolute;left:0;top:0}#sp-arrow i{position:absolute;left:-16px;top:-16px;width:32px;height:32px;display:block}
#sp-arrow i::before{content:"";position:absolute;left:4px;top:6px;border-left:26px solid var(--sun);border-top:10px solid transparent;border-bottom:10px solid transparent;filter:drop-shadow(0 2px 0 rgba(0,0,0,.5))}
#sp-arrow span{position:absolute;left:0;top:20px;transform:translateX(-50%);font:900 11px var(--f);letter-spacing:.1em;color:var(--sun);white-space:nowrap;text-shadow:0 1px 0 rgba(0,0,0,.8)}
#sp-card{position:absolute;left:50%;top:50%;transform:translate(-50%,-46%) scale(.96);opacity:0;pointer-events:none;width:min(92vw,440px);max-height:calc(100% - 24px);overflow:auto;padding:16px 16px 14px;border-radius:18px;background:rgba(20,26,58,.95);box-shadow:0 8px 0 rgba(0,0,0,.35);text-align:center;transition:all .3s}
#sp-card.on{opacity:1;transform:translate(-50%,-50%);pointer-events:auto}
#sp-card>small{font:900 10px var(--f);letter-spacing:.16em;color:var(--sun)}
#sp-card h2{margin:4px 0 2px;font:900 clamp(26px,8vw,38px)/1.05 var(--f);letter-spacing:.02em}
#sp-card .best{font:800 11px var(--f);letter-spacing:.1em;color:#9fd8ff;margin-bottom:8px}
#sp-card .lad{display:flex;flex-direction:column;gap:2px;margin:6px 0;text-align:left}
#sp-card .r{display:flex;gap:8px;align-items:center;padding:3px 10px;border-radius:8px;background:rgba(255,244,230,.06);font:800 12px var(--f);opacity:.45}
#sp-card .r.y{opacity:1}#sp-card .r b{min-width:62px;color:var(--sun);font-weight:900}#sp-card .r span{flex:1;min-width:0;letter-spacing:.06em}#sp-card .r i{font-style:normal;opacity:.75;font-variant-numeric:tabular-nums}
#sp-card .r.k{background:rgba(255,216,77,.18)}
#sp-card .chips{display:flex;flex-wrap:wrap;gap:5px;justify-content:center;margin:8px 0}
#sp-card .chips span{padding:5px 9px;border-radius:999px;background:rgba(255,244,230,.08);font:900 11px var(--f);letter-spacing:.08em;opacity:.45}#sp-card .chips span.y{background:var(--sun);color:var(--navy);opacity:1}
#sp-card p{margin:8px 4px 10px;font:800 13px/1.35 var(--f)}
#sp-card .btns{display:grid;grid-template-columns:1fr 1fr;gap:8px}
#sp-card button{min-height:46px;border:0;border-radius:10px;font:900 13px var(--f);letter-spacing:.05em;cursor:pointer;background:var(--cream);color:var(--navy);box-shadow:0 4px 0 rgba(0,0,0,.35)}
#sp-card button.pri{grid-column:1 / -1;background:var(--sun);box-shadow:0 4px 0 #c99a1c}
#sp-card button:active{transform:translateY(2px);box-shadow:0 1px 0 rgba(0,0,0,.35)}
@media (max-height:520px){#sp-card{width:min(94vw,640px);padding:10px 12px}#sp-card .lad{display:grid;grid-template-columns:1fr 1fr;gap:3px 6px}#sp-card h2{font-size:24px}#sp-card p{margin:4px;font-size:12px}#sp-card .btns{grid-template-columns:1fr 1fr 1fr}#sp-card button.pri{grid-column:auto}}
`;
