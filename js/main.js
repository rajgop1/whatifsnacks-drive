// What If Snacks: Drive. Boot, quality tiers, the golden-hour look, the run state machine, camera, and the frame loop.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Lensflare, LensflareElement } from 'three/addons/objects/Lensflare.js';
import * as L from './layout.js';
import { buildCity } from './city.js';
import { Car, ghostCar } from './car.js';
import { VEHICLES, vehicleById, carById } from './vehicles.js';
import { Traffic } from './traffic.js';
import { Packets, Tornado, Cubes, Drones, Heli } from './hazards.js';
import { Peds } from './peds.js';
import { Eggs, EGGS } from './eggs.js';
import { Particles } from './fx.js';
import { Hud } from './hud.js';
import { Input } from './input.js';
import { Audio } from './audio.js';
import { makePost } from './post.js';
import { CONFIG, dayNumber, featuredDay } from './config.js';
import { scenarioFor, pad3 } from './scenarios.js';
import { makeRoute, encodeGhost, decodeGhost, ghostAt, GHOST_HZ, commentCode, challengeLink, shareText, autopilot, fmtTime } from './run.js';
import { clamp, damp, radial, tex } from './util.js';
import { Clip, Stats } from './clip.js';
import { count, countOnce } from './counter.js';
import { Radio } from './radio.js';
import { award } from './badges.js';
import { Police } from './police.js';
import { Ramps } from './ramps.js';
import { Style, fmt$, bank as readBank, PAINTS } from './style.js';

const Q = new URLSearchParams(location.search), H = new URLSearchParams(location.hash.slice(1));
const CAPTURE = Q.has('capture'), MANUAL = Q.has('manual'), AUTO = CAPTURE || Q.has('auto'), NOHUD = Q.get('hud') === '0';
const isTouch = Q.get('touch') === '1' || matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
let tier = Q.get('q') || (isTouch || Math.min(screen.width, screen.height) < 700 ? 'medium' : 'high');
document.documentElement.classList.add(isTouch ? 'touch' : 'notouch', tier); if (CAPTURE) document.documentElement.classList.add('capture'); if (Q.get('hud') === '0') document.documentElement.classList.add('nohud');
const DAY = Math.max(1, Math.floor(+H.get('d') || +Q.get('d') || featuredDay())), SCN = scenarioFor(DAY);   // a hand-typed #d=-5 or d=1.5 must still land on a scenario
const stored = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const lbar = document.getElementById('lbar'), nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const progress = (p) => { lbar.style.width = Math.round(p * 100) + '%'; };
const T0 = performance.now();

// ---------------------------------------------------------------- renderer, sky, light
const canvasEl = document.getElementById('gl'), TODAY = dayNumber();
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: tier !== 'high', powerPreference: 'high-performance', preserveDrawingBuffer: MANUAL });
renderer.info.autoReset = false; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.55;
renderer.shadowMap.enabled = tier === 'high'; renderer.shadowMap.type = THREE.PCFShadowMap;
const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(60, 1, 0.5, 9000);
const SUN = new THREE.Vector3(-0.6, 0.085, -0.8).normalize(), MOON = new THREE.Vector3(0.45, 0.42, -0.78).normalize(), LD = SUN.clone(); let flare = null;
const sky = new Sky(); sky.scale.setScalar(20000); scene.add(sky);
const skyU = sky.material.uniforms; skyU.turbidity.value = 3.4; skyU.rayleigh.value = 1.4; skyU.mieCoefficient.value = 0.0035; skyU.mieDirectionalG.value = 0.86; skyU.sunPosition.value.copy(SUN);
{ const envSky = new Sky(); envSky.scale.setScalar(20000); Object.assign(envSky.material.uniforms.turbidity, { value: 3.4 }); envSky.material.uniforms.rayleigh.value = 1.4; envSky.material.uniforms.mieCoefficient.value = 0.0035; envSky.material.uniforms.sunPosition.value.copy(SUN); envSky.material.uniforms.showSunDisc.value = false;
  const es = new THREE.Scene(); es.add(envSky); const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(es, 0, 1, 30000).texture; scene.environmentIntensity = 0.9; pm.dispose(); }
scene.fog = new THREE.FogExp2(0xd99a96, 0.0011);
const sunL = new THREE.DirectionalLight(0xffa25a, 3.2); sunL.position.copy(SUN).multiplyScalar(300); scene.add(sunL, sunL.target);
if (tier === 'high') { sunL.castShadow = true; sunL.shadow.mapSize.set(2048, 2048); Object.assign(sunL.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 1, far: 800 }); sunL.shadow.bias = -0.0005; sunL.shadow.normalBias = 0.04; }
const hemi = new THREE.HemisphereLight(0x9a8ae0, 0xffa078, 1.0); scene.add(hemi);
const fill = new THREE.DirectionalLight(0xffc2d0, 0.6); fill.position.set(0.6, 0.5, 0.7); scene.add(fill);
// a sun flare (the addon occlusion-tests against the depth buffer)
{ const mk = (stops) => tex(radial(128, stops), { repeat: false });
  const lf = new Lensflare(); lf.addElement(new LensflareElement(mk([[0, 'rgba(255,240,210,1)'], [0.2, 'rgba(255,190,120,0.35)'], [1, 'rgba(255,120,80,0)']]), 120, 0, new THREE.Color(1, 0.8, 0.6)));
  const ghost = mk([[0, 'rgba(255,180,120,0)'], [0.75, 'rgba(255,180,120,0.05)'], [1, 'rgba(255,255,255,0)']]), dot = mk([[0, 'rgba(255,210,140,0.12)'], [1, 'rgba(255,210,140,0)']]);
  for (const [t, s] of [[0.3, 120], [0.55, 60], [0.8, 200], [1.1, 40], [1.4, 320]]) lf.addElement(new LensflareElement(s > 100 ? ghost : dot, s, t));
  const fl = new THREE.PointLight(0xffffff, 0, 0); fl.position.copy(SUN).multiplyScalar(8000); fl.add(lf); scene.add(fl); flare = fl; }

// ---------------------------------------------------------------- time of day: golden hour (0) to night (1), chosen on the title
const CLOUD = new THREE.Color(1, 0.72, 0.68);
const LOOKS = [[0, 0, 'GOLDEN HOUR'], [1, 0, 'NIGHT'], [0, 1, 'RAIN'], [1, 1, 'RAINY NIGHT']];   // [night, rain, name]: the title's LOOK chip cycles them
let lookIdx = (() => { const q = Q.get('look'); if (q != null && LOOKS[+q]) return +q; if (Q.get('t') === 'night') return Q.get('w') === 'rain' ? 3 : 1; if (Q.get('w') === 'rain') return 2; const sv = stored('wis-look'); if (sv !== '' && LOOKS[+sv]) return +sv; return stored('wis-time') === 'night' ? 1 : 0; })();
let todTarget = LOOKS[lookIdx][0], tod = todTarget, rainTarget = LOOKS[lookIdx][1], rain = rainTarget;
const TOD = {   // [golden hour, night]
  sky: { turb: [3.4, 1.2], ray: [1.4, 0.25], mie: [0.0035, 0.0012] }, sunI: [3.2, 1.5], hemiI: [1.0, 1.0], fillI: [0.6, 0.35], env: [0.9, 0.3], expo: [0.55, 0.62], fogD: [0.0011, 0.0016],
  sunC: [new THREE.Color(0xffa25a), new THREE.Color(0x7f9cff)], hemiS: [new THREE.Color(0x9a8ae0), new THREE.Color(0x4a5cb0)], hemiG: [new THREE.Color(0xffa078), new THREE.Color(0x2a2048)],
  fogC: [new THREE.Color(0xd99a96), new THREE.Color(0x1a2146)], cloud: [new THREE.Color(1, 0.72, 0.68), new THREE.Color(0.28, 0.32, 0.55)],
};
const todL = (a, k) => a[0] + (a[1] - a[0]) * k, _tc = new THREE.Color();
let stars = null, moonSpr = null;
function makeNight() {
  const n = tier === 'low' ? 500 : 1400, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const u = Math.random(), v = Math.random() * Math.PI * 2, y = 0.06 + u * 0.94, r = Math.sqrt(1 - y * y); pos[i * 3] = Math.cos(v) * r * 7000; pos[i * 3 + 1] = y * 7000; pos[i * 3 + 2] = Math.sin(v) * r * 7000; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: tier === 'low' ? 2 : 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false, toneMapped: false })); stars.frustumCulled = false; stars.visible = false; scene.add(stars);
  const mk = tex(radial(256, [[0, 'rgba(255,255,245,1)'], [0.16, 'rgba(235,240,255,1)'], [0.2, 'rgba(180,200,255,0.35)'], [0.5, 'rgba(120,150,255,0.08)'], [1, 'rgba(120,150,255,0)']]), { repeat: false });
  moonSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: mk, transparent: true, opacity: 0, fog: false, depthWrite: false, toneMapped: false })); moonSpr.scale.setScalar(1300); moonSpr.visible = false; scene.add(moonSpr);
}
const RAINFOG = [new THREE.Color(0x7d869c), new THREE.Color(0x232c47)], RAINHEMI = new THREE.Color(0x8892aa);
function applyTod() {
  const k = tod, r = rain; LD.copy(SUN).lerp(MOON, k).normalize();
  skyU.turbidity.value = todL(TOD.sky.turb, k) + 9 * r; skyU.rayleigh.value = todL(TOD.sky.ray, k) * (1 - 0.45 * r); skyU.mieCoefficient.value = todL(TOD.sky.mie, k) + 0.02 * r;
  skyU.sunPosition.value.copy(SUN).lerp(new THREE.Vector3(-0.2, -0.3, -0.9), k).normalize();
  sunL.intensity = todL(TOD.sunI, k) * (1 - 0.55 * r); sunL.color.copy(TOD.sunC[0]).lerp(TOD.sunC[1], k);
  hemi.intensity = todL(TOD.hemiI, k) * (1 - 0.08 * r); hemi.color.copy(TOD.hemiS[0]).lerp(TOD.hemiS[1], k).lerp(RAINHEMI, 0.55 * r * (1 - 0.6 * k)); hemi.groundColor.copy(TOD.hemiG[0]).lerp(TOD.hemiG[1], k); fill.intensity = todL(TOD.fillI, k) * (1 - 0.4 * r);
  scene.environmentIntensity = todL(TOD.env, k) * (1 - 0.3 * r); renderer.toneMappingExposure = todL(TOD.expo, k);
  scene.fog.density = todL(TOD.fogD, k) * (1 + 0.8 * r); scene.fog.color.copy(TOD.fogC[0]).lerp(TOD.fogC[1], k).lerp(_tc.copy(RAINFOG[0]).lerp(RAINFOG[1], k), 0.7 * r); CLOUD.copy(TOD.cloud[0]).lerp(TOD.cloud[1], k).multiplyScalar(1 - 0.3 * r);
  if (flare) flare.visible = k < 0.5 && r < 0.6;
  if (stars) { stars.visible = moonSpr.visible = k > 0.02; stars.material.opacity = Math.max(0, (k - 0.35) / 0.65) * (1 - r); moonSpr.material.opacity = Math.max(0, (k - 0.3) / 0.7) * (1 - 0.85 * r); }
}
function setLook(i) {
  lookIdx = i; todTarget = LOOKS[i][0]; rainTarget = LOOKS[i][1]; try { localStorage.setItem('wis-look', String(i)); } catch (e) { /* private window */ }
  hud.timeBtn(i);
}
// rain: streaks in a box that follows the camera, leaning back along the car's motion; a soft hiss on the sfx bus
let rainLines = null, rainPos = null, rainBase = null, rainSnd = null;
function makeRain() {
  const n = tier === 'low' ? 450 : tier === 'medium' ? 900 : 1500; rainBase = new Float32Array(n * 3); rainPos = new Float32Array(n * 6);
  for (let i = 0; i < n; i++) { rainBase[i * 3] = Math.random() * 40; rainBase[i * 3 + 1] = Math.random() * 30; rainBase[i * 3 + 2] = Math.random() * 40; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(rainPos, 3).setUsage(THREE.DynamicDrawUsage));
  rainLines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xbcd0ff, transparent: true, opacity: 0, fog: false, depthWrite: false, toneMapped: false })); rainLines.frustumCulled = false; rainLines.visible = false; scene.add(rainLines);
}
function updateRain(dt) {
  const on = rain > 0.02; if (rainLines) rainLines.visible = on;
  if (audio.ctx) { if (!rainSnd && on) rainSnd = audio.loopNoise('highpass', 2600, 0.4); if (rainSnd) rainSnd.g.gain.setTargetAtTime(on && !mode ? rain * 0.07 : 0, audio.ctx.currentTime, 0.3); }
  if (!on || !rainLines) return;
  rainLines.material.opacity = 0.6 * rain; const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, lx = -(car.vx || 0) * 0.025, lz = -(car.vz || 0) * 0.025, n = rainBase.length / 3;
  for (let i = 0; i < n; i++) {
    const y = (((rainBase[i * 3 + 1] - 32 * dt) % 30) + 30) % 30; rainBase[i * 3 + 1] = y;
    const x = cx + ((rainBase[i * 3] - cx + 20) % 40 + 40) % 40 - 20, z = cz + ((rainBase[i * 3 + 2] - cz + 20) % 40 + 40) % 40 - 20, wy = cy - 12 + y, j = i * 6;
    rainPos[j] = x; rainPos[j + 1] = wy; rainPos[j + 2] = z; rainPos[j + 3] = x + lx; rainPos[j + 4] = wy + 1.6; rainPos[j + 5] = z + lz;
  }
  rainLines.geometry.attributes.position.needsUpdate = true;
}

// ---------------------------------------------------------------- world and actors
const hud = new Hud(), input = new Input(document.body), audio = new Audio(), clip = new Clip(canvasEl, audio), radio = new Radio(audio, hud);
let style, police, ramps, city, car, traffic, packets, tornado, cubes, drones, fx, ghostMesh, post, peds, heli, eggs, arrow;
let free = Q.get('free') === '1' || (!Q.has('free') && stored('wis-free') === '1');   // FREE ROAM: no timer, endless deliveries, random what-if events, you choose when to stop
let paintIdx = Math.max(0, Math.min(PAINTS.length - 1, Math.trunc(+stored('wis-paint')) || 0)); if (PAINTS[paintIdx].cost > readBank()) paintIdx = 0;
const paintOf = (v) => (PAINTS[paintIdx].c == null ? v.paint : PAINTS[paintIdx].c);
let sel = vehicleById(Q.get('v') || stored('wis-vehicle')), mode = null, preview = null;   // sel: the garage choice (a car, or a mode vehicle); mode: the running mode world
// the guide arrow: floats over the car and points at the next packet (sun fill, navy outline, drawn on top)
function makeArrow() {
  const s = new THREE.Shape([[0, 1.5], [1.25, 0], [0.45, 0], [0.45, -1.1], [-0.45, -1.1], [-0.45, 0], [-1.25, 0]].map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ShapeGeometry(s).translate(0, -0.2, 0), g = new THREE.Group();   // tip +y; it faces the camera and turns in the view plane
  const mk = (color, sc, order) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, toneMapped: false, depthTest: false, depthWrite: false, transparent: true, side: THREE.DoubleSide })); m.scale.setScalar(sc); m.renderOrder = order; g.add(m); return m; };
  mk(0x141a3a, 1.22, 20).position.y = -0.01; mk(new THREE.Color(1.0, 0.62, 0.08), 1, 21);   // deep gold, below the bloom threshold so it stays a crisp shape
  g.visible = false; scene.add(g); return g;
}
async function boot() {
  progress(0.1); await nextFrame();
  city = buildCity(scene, tier, (p) => progress(0.1 + p * 0.7)); ramps = new Ramps(scene, tier); progress(0.82); await nextFrame();
  car = new Car(scene, { quality: tier, vehicle: carById(sel.id), paint: paintOf(carById(sel.id)) }); fx = new Particles(scene); hud.garage(sel); showSel();
  traffic = new Traffic(scene, tier === 'high' ? 34 : tier === 'medium' ? 26 : 16, DAY); police = new Police(scene, tier, audio);
  arrow = makeArrow();
  packets = new Packets(scene); tornado = new Tornado(scene); cubes = new Cubes(scene); drones = new Drones(scene); ghostMesh = ghostCar(scene);
  peds = new Peds(scene, tier === 'high' ? 60 : tier === 'medium' ? 42 : 24, DAY); heli = new Heli(scene); eggs = new Eggs(scene); traffic.onHonk = () => audio.honk(); traffic.onNear = () => nearMiss('NEAR MISS');
  style = new Style(hud); hud.radioBtn(radio.off ? 'OFF' : radio.station.name); makeNight(); makeRain(); applyTod(); hud.timeBtn(lookIdx); hud.freeBtn(free);
  post = makePost(renderer, scene, camera, tier); resize(); progress(1);
  const pre = [tornado.group, tornado.shadow, heli.g, heli.cone, heli.pool, arrow]; pre.forEach((o) => (o.visible = true)); renderer.compile(scene, camera); pre.forEach((o) => (o.visible = false)); render(0.016);
  document.getElementById('loading').classList.add('hide');
  window.__oc.ready = true; window.__oc.bootMs = performance.now() - T0;
  toTitle();
  count('visits'); countOnce('people', 'wis-seen');   // anonymous: a page load, and once per browser
  if (CAPTURE) turnKey();
  if (!MANUAL) requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- run state
const R = { state: 'boot', t: 0, near: 0, sim: 0, timerOn: false, timerT: 0, pct: SCN.startPct, got: 0, chaos: 0, pips: 0, maxPips: 0, env: { g: 9.8, grip: 1 }, events: [], rec: [], recT: 0, ghost: null, ownGhost: null, route: null, ap: { idx: 0, t: 0 }, gravityUntil: -1, slickUntil: -1, lastImpact: 0, endT: 0 };
const fromLink = H.get('g') ? decodeGhost(H.get('g')) : null;
if (fromLink && fromLink.day === DAY) R.ghost = fromLink;
function toTitle() {
  R.state = 'title'; R.route = makeRoute(DAY); packets.set(R.route.packets); hud.show(false);
  hud.mission(`DAILY RUN #${pad3(DAY)} · ${SCN.name}`, SCN.title.replace('{n}', pad3(DAY))); document.body.classList.remove('freerun');
  hud.meter(meterLabel(), SCN.startPct, true); hud.timer(CONFIG.runSeconds, false); hud.pips(0);
  const st = Stats.summary(TODAY, DAY), lines = [];
  if (R.ghost) lines.push(`Racing a ghost: ${R.ghost.pct}% in ${fmtTime(R.ghost.time)}. Beat it.`);
  if (st.best) lines.push(`Your best today: ${st.best.pct}% in ${fmtTime(st.best.time)}${st.streak > 1 ? ` · ${st.streak}-day streak` : ''}`); else if (st.streak > 0) lines.push(`${st.streak}-day streak. Keep it going.`);
  const bk = readBank(); if (bk > 0) lines.push(`Bank: ${fmt$(bk)}`);
  if (!CAPTURE) hud.title(DAY, SCN, lines.join('<br>'));
}
function freePackets(n) {   // n deliveries on roads 70 to 240 m from the car, spread apart
  const out = []; let tries = 0;
  while (out.length < n && tries++ < 600) {
    const a = Math.random() * 6.283, d = 70 + Math.random() * 170, x = car.x + Math.sin(a) * d, z = car.z + Math.cos(a) * d;
    if (!L.isRoad(x, z) || L.insideSolid(x, 1, z)) continue;
    if (out.every(([px, pz]) => Math.hypot(px - x, pz - z) > 55)) out.push([x, z]);
  }
  return out;
}
function resetRun() {
  car.reset(L.SPAWN.x, L.SPAWN.z, L.SPAWN.yaw); packets.set(R.route.packets); tornado.hide(); cubes.clear(); drones.setCount(0, car);
  Object.assign(R, { t: 0, near: 0, goalShown: false, launched: false, stuckT: 0, timerOn: false, timerT: 0, pct: SCN.startPct, got: 0, chaos: 0, pips: 0, maxPips: 0, env: { g: 9.8, grip: 1 }, rec: [], recT: 0, ap: { idx: 0, t: 0 }, gravityUntil: -1, slickUntil: -1, lastImpact: 0 });
  R.events = SCN.events.map((e) => ({ ...e, fired: false })); input.any = false;
  police.reset(); ramps.reset(); R.jumps = new Set(); R.free = free; R.nextEv = 26; document.body.classList.toggle('freerun', free);
  if (free) { R.events = []; packets.set(freePackets(4)); hud.meterN(0); } eggs.reset(); style.reset(); city.roadMat.userData.wet = 0;
}
function turnKey() {
  if (R.state !== 'title' && R.state !== 'done') return;
  if (sel.kind === 'mode' && R.state === 'title') return startMode();
  audio.start(); radio.start(); audio.rev(); hud.hideResult(); resetRun(); input.calibrate();   // wherever the phone is held now is "straight ahead"
  // the key turn: button twist, a warm flash, the engine catches (puffs and a shake), HUD panels slide in with whooshes
  document.getElementById('key').classList.add('turn'); if (!CAPTURE) flash('on');   // no flash in capture: frame 0 must be a clean, lit frame
  setTimeout(() => { hud.hideTitle(); document.getElementById('key').classList.remove('turn'); }, 260);
  car.bobV = -1.2; for (let k = 0; k < 7; k++) { const sx = Math.sin(car.yaw), sz = Math.cos(car.yaw); fx.emit(car.x - sx * 2.5 + (Math.random() - 0.5) * 0.6, 0.45, car.z - sz * 2.5, -sx * 2 + (Math.random() - 0.5), 0.6 + Math.random(), -sz * 2 + (Math.random() - 0.5), { life: 0.9, size: 0.5, grow: 1.8, drag: 1.5, r: 0.8, g: 0.78, b: 0.82 }); }
  [0, 120, 260].forEach((ms, k) => setTimeout(() => audio.whoosh(k), 150 + ms));
  if (!CAPTURE) { Stats.attempt(TODAY); if (!MANUAL) clip.start(); count('plays'); count('car-' + car.v.id); }
  R.state = 'intro'; setTimeout(() => hud.show(true), 150); if (R.free) hud.meterN(0); else hud.meter(meterLabel(), SCN.startPct, true);
  if (SCN.onStart && !R.free) SCN.onStart(api);
  if (R.free) { hud.mission('FREE ROAM', 'DELIVER SNACKS · SURVIVE THE WHAT-IFS'); count('free-roam'); }
}
document.getElementById('key').addEventListener('click', turnKey);
// the garage: pick a car on the title screen, the model swaps in front of you
function pickCar(dir) {
  if (R.state !== 'title') return;
  const i = (VEHICLES.indexOf(sel) + dir + VEHICLES.length) % VEHICLES.length; sel = VEHICLES[i];
  if (sel.kind !== 'mode') car.setVehicle(sel, paintOf(sel));
  hud.garage(sel); showSel(); audio.chime(2 + i); cam.kick = 0.6;
  try { localStorage.setItem('wis-vehicle', sel.id); } catch (e) { /* private window */ }
}
// the showroom shows the chosen car, or a small model of the mode's vehicle standing where the car would be
function showSel() {
  const isMode = sel.kind === 'mode'; hud.paint(isMode ? null : PAINTS[paintIdx], paintOf(carById(sel.id))); car.root.visible = !isMode; if (car.shadow) car.shadow.visible = !isMode;
  if (preview) preview.visible = false;
  if (!isMode) return;
  const want = sel;
  ensureMode(sel).then((m) => {
    if (!m.makePreview) return;
    if (!m.previewGroup) { m.previewGroup = m.makePreview(); m.previewGroup.position.set(L.SPAWN.x, 0, L.SPAWN.z); m.previewGroup.rotation.y = L.SPAWN.yaw; scene.add(m.previewGroup); }
    preview = m.previewGroup; preview.visible = sel === want && R.state === 'title';
  }).catch((e) => console.error('mode preview', e));
}
// ---------------------------------------------------------------- modes: self-contained worlds (own scene) the title can start; see js/modes/README.md
const MODE_SRC = { space: './modes/space.js', sub: './modes/sub.js', moon: './modes/moon.js', mars: './modes/mars.js' }, modeCache = {}, modeUI = document.getElementById('modeui');
const modeCtx = (id) => ({ id, THREE, renderer, camera, input, audio, hud, makePost, count, isTouch, DAY, ui: modeUI, get tier() { return tier; }, get vehicle() { return sel; }, exit: () => exitMode(), labels: (l) => hud.labels(l) });
function ensureMode(v) {
  if (!modeCache[v.mode]) modeCache[v.mode] = import(MODE_SRC[v.mode]).then(async (mod) => { const m = new mod.default(modeCtx(v.mode)); if (m.load) await m.load(); return m; });
  return modeCache[v.mode];
}
async function startMode() {
  if (R.state !== 'title') return; R.state = 'loading';
  let m; try { m = await ensureMode(sel); } catch (e) { console.error(e); R.state = 'title'; hud.toast('COULD NOT LOAD', 'TRY AGAIN', 1.6); return; }
  audio.start(); radio.pause(true); hud.hideResult(); hud.hideTitle(); count('plays'); count('car-' + sel.id); if (preview) preview.visible = false;
  mode = m; R.state = 'mode'; document.body.classList.add('inmode'); hud.show(true); m.start();
}
function exitMode() {
  if (!mode) return; try { mode.stop && mode.stop(); } catch (e) { console.error(e); }
  mode = null; radio.pause(false); document.body.classList.remove('inmode'); hud.labels(null); modeUI.innerHTML = ''; camera.near = 0.5; camera.far = 9000; camera.up.set(0, 1, 0); cam.fov = 56;
  toTitle(); showSel();
}
document.getElementById('modeExit').addEventListener('click', () => (mode ? exitMode() : (R.free && live() ? finish() : 0)));
document.getElementById('btnTime').addEventListener('click', () => setLook((lookIdx + 1) % LOOKS.length));
document.getElementById('btnFree').addEventListener('click', () => { free = !free; try { localStorage.setItem('wis-free', free ? '1' : '0'); } catch (e) { /* private window */ } hud.freeBtn(free); });
function pickPaint() {
  if (R.state !== 'title' || sel.kind === 'mode') return;
  const bk = readBank(); let i = paintIdx, locked = null;
  for (let n = 1; n <= PAINTS.length; n++) { const j = (paintIdx + n) % PAINTS.length; if (PAINTS[j].cost <= bk) { i = j; break; } }
  locked = PAINTS.find((p) => p.cost > bk);
  if (i < paintIdx && locked) hud.toast('MORE PAINT', `${locked.n} UNLOCKS AT ${fmt$(locked.cost)} BANK`, 1.8);   // wrapped round: tell them what is next
  paintIdx = i; try { localStorage.setItem('wis-paint', String(i)); } catch (e) { /* private window */ }
  car.setVehicle(carById(sel.id), paintOf(carById(sel.id))); hud.paint(PAINTS[i], paintOf(carById(sel.id))); audio.chime(6 + i); cam.kick = 0.4;
}
document.getElementById('gPaint').addEventListener('click', pickPaint);
function tuneRadio() {   // the first tap starts the sound (browsers need a tap) and plays the remembered station; after that each tap changes station
  const first = !audio.ctx; audio.start(); radio.start(); if (first) hud.toast(radio.off ? 'RADIO OFF' : radio.station.name, radio.off ? '' : '♪ ' + radio.station.sub, 1.3); else radio.next();
}
document.getElementById('gRadio').addEventListener('click', tuneRadio);
document.getElementById('gPrev').addEventListener('click', () => pickCar(-1)); document.getElementById('gNext').addEventListener('click', () => pickCar(1));
addEventListener('click', (e) => { const b = e.target && e.target.closest && e.target.closest('button'); if (b) b.blur(); }, true);
addEventListener('keydown', (e) => { if (e.code === 'KeyP' && !e.repeat) { if (photo) exitPhoto(); else enterPhoto(); } if (photo) { if (e.code === 'Escape') { exitPhoto(); return; } if (e.code === 'ArrowLeft' || e.code === 'KeyA') photo.a += 0.08; if (e.code === 'ArrowRight' || e.code === 'KeyD') photo.a -= 0.08; if (e.code === 'ArrowUp' || e.code === 'KeyW') photo.e = clamp(photo.e - 0.05, -0.05, 1.35); if (e.code === 'ArrowDown' || e.code === 'KeyS') photo.e = clamp(photo.e + 0.05, -0.05, 1.35); if (e.code === 'Enter') { snap(); return; } } if (e.code === 'KeyM' && !e.repeat && (R.state === 'title' || live() || R.state === 'done')) { if (R.state === 'title') tuneRadio(); else radio.next(); } if (e.code === 'KeyH' && !e.repeat && live()) audio.honk(); if (e.code === 'Escape') { if (mode) exitMode(); else if (R.free && live()) finish(); } if ((e.code === 'Enter' || e.code === 'Space') && (R.state === 'title') && !(e.target && e.target.tagName === 'BUTTON')) turnKey(); if (e.code === 'KeyR' && R.state === 'done') retry(); if (R.state === 'title' && !e.repeat) { if (e.code === 'ArrowLeft' || e.code === 'KeyA') pickCar(-1); if (e.code === 'ArrowRight' || e.code === 'KeyD') pickCar(1); } });
const beats = (a, b) => !b || a.pct > b.pct || (a.pct === b.pct && a.time < b.time);   // more percent first, then faster
function garage() { hud.hideResult(); if (!R.free && R.ownGhost && beats(R.ownGhost, R.ghost)) R.ghost = R.ownGhost; toTitle(); car.reset(L.SPAWN.x, L.SPAWN.z, L.SPAWN.yaw); showSel(); }   // the result card's CHANGE CAR button
function retry() { if (!R.free && R.ownGhost && beats(R.ownGhost, R.ghost)) R.ghost = R.ownGhost; R.state = 'title'; turnKey(); }   // the ghost is the best run so far, never a worse retry
const api = { hud, audio, get car() { return car; }, get traffic() { return traffic; }, get cubes() { return cubes; }, get tornado() { return tornado; }, R };   // what scenario hooks may touch

function addChaos(v) { R.chaos = Math.min(5.99, R.chaos + v); }
const live = () => R.state === 'live' || R.state === 'intro';
const meterLabel = () => `${SCN.meter} · ${R.got}/${packets.list.length}`;
const flash = (cls) => { const fl = document.getElementById('flash'); fl.classList.add(cls); requestAnimationFrame(() => requestAnimationFrame(() => fl.classList.remove(cls))); };
function nearMiss(label) { if (!live()) return; R.near++; style.add('', 60); audio.nearMiss(); hud.plus(label, 'near'); cam.kick = Math.max(cam.kick, 0.5); }
function poof(x, z) {   // a big soft cloud with gold sparks and a whoosh
  fx.burst(x, 1.2, z, 10, 6, { life: 0.7, size: 1.0, grow: 1.5, drag: 3, r: 0.95, g: 0.9, b: 0.95 }, 0.4);   // small: the camera can be right on top of it after a respawn
  fx.burst(x, 1.2, z, 20, 9, { life: 0.6, size: 0.3, grow: -0.5, drag: 2, grav: 5, r: 1, g: 0.8, b: 0.3, add: 1 }, 0.6);
  audio.whoosh(2); audio.whoosh(0);
}
function crashPop(v, label) { hud.plus(label, 'hit'); cam.shake = Math.max(cam.shake, Math.min(1.4, 0.4 + v * 0.04)); cam.kick = Math.max(cam.kick, -0.4); }
function collect(p, i) {
  style.add('', 150); car.boostE = Math.min(1, car.boostE + 0.2);   // every packet tops the boost tank up a fifth
  R.got++; audio.chime(R.got);
  if (R.free) { hud.plus('DELIVERED!'); hud.meterN(R.got); R.respawn = packets.remaining <= 1; }
  else { R.pct = Math.min(100, SCN.startPct + R.got * SCN.packetPct); hud.plus(`+${SCN.packetPct}%`); hud.meter(meterLabel(), R.pct, R.pct < 100, true); }
  fx.burst(p.x, 2.2, p.z, 26, 9, { life: 0.8, size: 0.22, grow: -0.4, drag: 2.5, grav: 6, r: 1, g: 0.85, b: 0.3, add: 1 }, 0.8);
  fx.burst(p.x, 2.2, p.z, 6, 5, { life: 0.45, size: 1.3, grow: 1.2, drag: 3, r: 0.7, g: 0.45, b: 0.12, add: 1 }, 0.2);   // a soft golden pop (kept small: additive + bloom blows out fast)
  cam.kick = 1; flash('pk');
  if (SCN.onPacket && !R.free) SCN.onPacket(api, R.got); void i;
}
function startTimer() {
  if (R.timerOn) return; R.timerOn = true; R.timerT = 0; hud.flashRadar(); audio.alarm();
}
function fire(e) {
  if (e.type === 'tornado') {
    const nodes = R.route.nodes; let k = 0, bd = 1e9; nodes.forEach(([i, j], n) => { const d = Math.hypot(i * L.P - car.x, j * L.P - car.z); if (d < bd) { bd = d; k = n; } });
    const [i, j] = nodes[Math.min(nodes.length - 1, k + (e.ahead || 2))]; tornado.spawn(i * L.P, j * L.P, i, j); hud.toast('DATA TORNADO', 'TWO BLOCKS AHEAD'); R.chaos = Math.max(R.chaos, 1);
  } else if (e.type === 'cubeRain') { cubes.rain('data', e.count, e.every, e.size, R.sim); hud.toast('CUBE RAIN', 'DATA IS FALLING'); }
  else if (e.type === 'iceRain') { cubes.rain('ice', e.count, e.every, e.size, R.sim); hud.toast('ICE INCOMING', `${Math.round(e.size ** 3 * 0.917)} TONNES EACH`); }   // ice is 917 kg/m³
  else if (e.type === 'gravity') { R.env.g = e.g; R.gravityUntil = R.timerT + e.duration; hud.toast(e.label || 'GRAVITY DROP', e.sub || `${e.duration} SECONDS OF MOON`); traffic.cars.forEach((c, k) => { if (k % 3 === 0 && c.mode !== 'fly') traffic.launch(c, 'shove', 0, 0, 6); }); }
  else if (e.type === 'slick') { R.env.grip = e.grip; R.slickUntil = R.timerT + e.duration; hud.toast(e.label || 'ROADS ICED', e.sub || 'GRIP IS GONE'); }
  audio.alarm();
}
function finish() {
  exitPhoto(); R.state = 'done'; R.endT = R.t; document.body.classList.remove('freerun'); audio.finish(R.free ? true : R.pct >= 100); count(R.free ? 'free-done' : 'done'); if (!R.free && R.pct >= 100) count('wins');
  const ghost = encodeGhost(DAY, R.t, R.pct, R.maxPips, R.rec);
  R.ownGhost = decodeGhost(ghost);
  const link = challengeLink(DAY, ghost), code = commentCode(DAY, R.t, R.pct, R.maxPips, ghost);
  let ghostLine = '';
  if (R.ghost) { const gt = R.ghost.time, mine = R.t; ghostLine = R.pct >= R.ghost.pct && (R.pct < 100 || mine < gt) ? `You beat the ghost (${fmtTime(gt)}, ${R.ghost.pct}%).` : `The ghost wins this time (${fmtTime(gt)}, ${R.ghost.pct}%). Retry?`; }
  const res = { day: DAY, scn: SCN, time: R.t, pct: R.pct, pips: R.maxPips, near: R.near, route: R.rec.slice(), packets: packets.list.map((p) => [p.x, p.z, p.got]), code, link, share: shareText(DAY, R.t, R.pct, R.maxPips, link), ghostLine, eggs: { found: eggs.found.size, total: EGGS.length, run: eggs.run.size }, free: !!R.free, got: R.got };
  if (R.free) res.share = `I made ${fmt$(style.run)} in FREE ROAM on What If Snacks: Drive: ${R.got} deliveries, ${R.near} near misses, ${fmtTime(R.t)}. ${location.origin}`;
  const bankBefore = style.bank; if (!CAPTURE) res.style = style.finish();
  { const nu = PAINTS.find((p) => p.cost > bankBefore && p.cost <= style.bank); if (nu && !CAPTURE) setTimeout(() => hud.toast('NEW PAINT', `${nu.n} UNLOCKED`, 2.2), 1600); }
  if (!CAPTURE && !R.free) { res.stats = Stats.finish(TODAY, DAY, R.t, R.pct); if (res.stats.newBest) setTimeout(() => hud.toast('NEW BEST', `${R.pct}% IN ${fmtTime(R.t)}`, 1.6), 900); }
  window.__oc.result = res;
  if (!CAPTURE) { try { award({ ...res, night: todTarget === 1, vehicle: sel.id, bestDrift: style.bestDrift }); } catch (e) { console.error('badges', e); } }
  const clipName = `what-if-snacks-drive-${pad3(DAY)}`;
  setTimeout(() => { if (CAPTURE || R.state !== 'done') return; const done = clip.finish(); hud.result(res, { retry, garage, clip: async () => { if (!clip.ok) return "This browser can't record clips. Try Chrome on Android or desktop."; await done; return clip.save(clipName); } }); }, 1400);   // the R-state guard: R pressed inside the 1.4 s window already started the next run, so no stale card
  if (R.free) hud.toast('PARKED', `${fmt$(style.run)} EARNED`, 2.5); else hud.toast(R.pct >= 100 ? '100%' : 'TIME', R.pct >= 100 ? 'DOWNLOAD COMPLETE' : `${R.pct}% DELIVERED`, 2.5);
}

// ---------------------------------------------------------------- simulation step (fixed 60 Hz)
const ctl = { steer: 0, throttle: 0, brake: 0, handbrake: false, boost: false };
const gpos = [0, 0, 0];
let hidden = false;
function step(dt) {
  R.sim += dt; input.poll();
  if (mode) { mode.step(dt); return; }
  if (photo) return;   // photo mode freezes the world; the camera is free
  ctl.steer = 0; ctl.throttle = 0; ctl.brake = 0; ctl.handbrake = false; ctl.boost = false;
  if (R.state === 'intro' || R.state === 'live') {
    R.t += dt; R.ap.t = R.t;
    const auto = AUTO || (R.state === 'intro' && !input.any);
    R.ap.time = Q.has('reds') ? undefined : R.sim;   // ?reds = autopilot runs red lights (to measure a fast human line)
    if (auto) { if (R.t > 0.25) autopilot(car, R.route, R.ap, ctl); R.ap.cruise = R.state === 'intro' && !AUTO ? 22 : 31; { const ni = packets.nextIndex(); R.ap.packet = ni >= 0 ? packets.list[ni] : null; } }
    else { ctl.steer = input.steer; ctl.brake = input.brake; ctl.throttle = input.brake ? 0 : 1; ctl.handbrake = input.handbrake; ctl.boost = input.boost; }
    // the launch: 1.5 s of boosted full throttle with a burnout, tyre squeal and the camera pulling back
    ctl.launch = R.t > 0.1 && R.t < 1.6 && !ctl.brake;
    if (ctl.launch) { ctl.throttle = 1; if (!R.launched) { R.launched = true; audio.launch(); cam.pull = 1; cam.kick = 0.8; } }
    if (R.state === 'intro' && R.t >= 3) { R.state = 'live'; if (!input.any && !CAPTURE) hud.hint(true); }
    if (R.t > 0.5 && !R.goalShown) { R.goalShown = true; hud.toast(R.free ? 'DELIVER SNACKS' : `GRAB ${packets.list.length} PACKETS`, 'FOLLOW THE ARROW', 2.4); }
    if (R.t > 1 && R.t < 1.1 && !R.saidRadio) { R.saidRadio = true; const line = R.free ? 'No clock today. Grab the snacks, drift for cash, and keep it classy. Too much chaos and the Snack Patrol shows up.' : SCN.radio; hud.radio(line, 3.4); audio.voice(line); }
    if (R.t > 6 || input.any) hud.hint(false);
    if (!R.timerOn && (R.free ? R.t >= 6 : (R.got >= 3 || R.t >= 10))) startTimer();
    if (R.timerOn) {
      R.timerT += dt;
      for (const e of R.events) if (!e.fired && R.timerT >= e.at) { e.fired = true; fire(e); }
      if (R.free && (R.nextEv -= dt) <= 0) { R.nextEv = 26 + Math.random() * 16; const base = SCN.events[Math.floor(Math.random() * SCN.events.length)]; if (base && !tornado.active && R.gravityUntil < 0 && R.slickUntil < 0) fire({ ...base, at: R.timerT }); }   // a random what-if from today's list every 26 to 42 s
      if (R.gravityUntil > 0 && R.timerT > R.gravityUntil) { R.env.g = 9.8; R.gravityUntil = -1; }
      if (R.slickUntil > 0 && R.timerT > R.slickUntil) { R.env.grip = 1; R.slickUntil = -1; }
    }
    // ghost recording
    R.recT += dt; if (R.recT >= 1 / GHOST_HZ || R.rec.length === 0) { R.recT = 0; R.rec.push([car.x, car.z, car.yaw]); }
    if (SCN.onUpdate && !R.free) SCN.onUpdate(api, dt);
    if (R.respawn) { R.respawn = false; packets.set(freePackets(4)); }
  } else if (R.state === 'done') { ctl.brake = 1; R.t = R.endT; }
  else { R.saidRadio = false; }
  car.update(dt, ctl, R.env, fx);
  if (car.boosting) { cam.kick = Math.max(cam.kick, 0.5); if (!R.boostSnd || R.sim - R.boostSnd > 0.5) { R.boostSnd = R.sim; audio.whoosh(1); } }
  // chaos: hard hits, corner cutting over sidewalks and parks, decays when you drive clean
  if (R.state === 'live' || R.state === 'intro') {
    if (car.impact > 8 && car.impact > R.lastImpact + 4) { style.crash(); addChaos(car.impact > 18 ? 0.6 : 0.35); audio.crash(car.impact); crashPop(car.impact, car.impact > 18 ? 'WRECKED!' : 'CRASH!'); }
    else if (car.impact > 5 && car.impact > R.lastImpact + 3) audio.thud();
    if (car.offroad > 0.5 && car.speed > 8) addChaos(0.28 * dt);
    R.chaos = Math.max(R.timerOn ? 0 : 0, R.chaos - 0.035 * dt);
    const p = Math.min(5, Math.floor(R.chaos)); if (p !== R.pips) { if (p > R.pips) audio.alarm(); R.pips = p; hud.pips(p); drones.setCount(p, car); } R.maxPips = Math.max(R.maxPips, p);
  }
  R.lastImpact = car.impact; style.update(dt, car, R.state === 'live'); ramps.update(dt, R.sim, car, R.state === 'live', JCB);
  traffic.update(dt, R.sim, car, tornado.active ? tornado : null, fx, (v) => { if (live()) { addChaos(0.45); audio.crash(v); crashPop(v, 'RAMMED!'); } });
  if (R.free && R.state === 'live') police.update(dt, R.sim, car, R.chaos, fx, PCB, traffic); else if (police.chasing) police.reset();   // SNACK PATROL: free roam only
  if (R.state !== 'title') packets.update(dt, R.sim, car, collect); else packets.update(dt, R.sim, { x: 1e9, z: 1e9, y: 0 }, () => {});
  tornado.update(dt, R.sim, car, fx);
  cubes.update(dt, R.sim, R.env, car, traffic, fx, (v) => { if (R.state === 'live') addChaos(v > 8 ? 0.3 : 0.12); audio.thud(); });
  drones.update(dt, R.sim, car, fx, () => { audio.zap(); hud.toast('ZAPPED', 'CHAOS DRONE', 0.9); });
  peds.update(dt, R.sim, car, tornado, () => nearMiss('CLOSE ONE!'));
  heli.update(dt, R.sim, car, R.state === 'live' && R.pips >= 2);
  if (R.state === 'live' || R.state === 'intro') { const egg = eggs.check(car, dt, R.sim); if (egg) { hud.toast(egg.name, `EASTER EGG ${eggs.found.size}/${EGGS.length}`, 2); audio.chime(14); } }
  fx.update(dt);
  // stuck (after a tornado drop, against a wall, boxed in by cubes): after 1.2 s a poof clears the cubes around you;
  // if you're off the road or nothing was blocking you, the poof also puts you back on the last good road spot
  const waiting = AUTO ? R.ap.waiting : input.brake > 0;
  if (R.state === 'live' && car.speed < 1.2 && !car.air && !waiting && !police.holding) {
    R.stuckT += dt;
    if (R.stuckT > 1.2) { R.stuckT = 0; poof(car.x, car.z);
      const cleared = cubes.clearNear(car.x, car.z, 16, fx);
      if (cleared && L.isRoad(car.x, car.z)) hud.toast('POOF', 'CUBES CLEARED', 0.9);
      else { car.reset(...car.lastSafe); poof(car.x, car.z); hud.toast('POOF', 'BACK ON THE ROAD', 1); } }
  } else if (car.speed > 2) R.stuckT = 0;
  if (car.splashed) { car.splashed = false; hud.toast('SPLASH', 'BACK ON THE ROAD', 1.2); }
  if (!R.free && R.state === 'live' && R.timerOn && (packets.remaining === 0 || R.timerT >= CONFIG.runSeconds)) finish();
  else if (!R.free && R.state === 'live' && packets.remaining === 0) finish();
}

// ---------------------------------------------------------------- camera
const cam = { x: L.SPAWN.x, y: 6, z: L.SPAWN.z + 12, lx: 0, ly: 0, lz: 0, shake: 0, fov: 60, orbit: 0, kick: 0, pull: 0 };   // kick: FOV punch (+ packet, - crash)
// thin occluders: palm trunks (they lean and curve, so a wide radius) and lamp / signal poles
let THIN = null;
function thinClear(x, z, dx, dz, dist) {
  if (!THIN) THIN = L.solids.filter((s) => s.tag === 'pole' || s.tag === 'palm').map((s) => [(s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, s.tag === 'palm' ? 2.2 : 1.0]);
  let best = dist;
  for (const [px, pz, r] of THIN) {
    const ox = px - x, oz = pz - z; if (Math.abs(ox) > dist + 3 || Math.abs(oz) > dist + 3) continue;
    const t = ox * dx + oz * dz; if (t < 2.5 || t > best + r) continue;   // behind the car, or beyond the camera
    if (Math.abs(ox * dz - oz * dx) < r) best = Math.max(3.2, t - r);
  }
  return best;
}
const _v = new THREE.Vector3(), _q2 = new THREE.Quaternion();
// ---------------------------------------------------------------- photo mode (P or the camera button): the world freezes, drag to orbit, a filter, SNAP saves a PNG
const PF = [['NORMAL', ''], ['VICE', 'saturate(1.4) hue-rotate(-14deg) contrast(1.08) brightness(1.03)'], ['NOIR', 'grayscale(1) contrast(1.1) brightness(1.15)'], ['FILM', 'sepia(.35) saturate(1.15) contrast(1.06)']];
let photo = null;
const pEl = (id) => document.getElementById(id);
function enterPhoto() {
  if (photo || mode || !live()) return;
  police.sirenOff(true); photo = { a: car.yaw + Math.PI + 0.5, e: 0.22, d: 8 * (car.v.show || 1), f: 0 }; document.body.classList.add('photo'); document.body.classList.remove('freerun'); setPhotoFilter(0); pEl('pMsg').textContent = '';
  count('photo-mode');
}
function exitPhoto() { if (!photo) return; photo = null; document.body.classList.remove('photo'); document.body.classList.toggle('freerun', !!R.free); canvasEl.style.filter = ''; }
function setPhotoFilter(i) { photo.f = i; canvasEl.style.filter = PF[i][1]; pEl('pFilter').textContent = 'FILTER: ' + PF[i][0]; }
async function snap() {
  if (!photo) return;
  post.render(); const w = canvasEl.width, h = canvasEl.height, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  try { if ('filter' in g) g.filter = PF[photo.f][1] || 'none'; } catch (e) { /* no canvas filters (older Safari): saved unfiltered */ }
  g.drawImage(canvasEl, 0, 0); try { g.filter = 'none'; } catch (e) { /* same */ }
  const fs = Math.round(Math.min(w, h) * 0.03); g.font = `900 ${fs}px Montserrat, Arial, sans-serif`; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.lineJoin = 'round'; g.lineWidth = fs * 0.28; g.strokeStyle = 'rgba(20,26,58,.85)'; g.fillStyle = '#fff4e6';
  const tx = w - fs, ty = h - fs; g.strokeText('WHAT IF SNACKS: DRIVE', tx, ty); g.fillText('WHAT IF SNACKS: DRIVE', tx, ty);
  const blob = await new Promise((ok) => c.toBlob(ok, 'image/png')); const f = pEl('pFlash'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 90); audio.chime && audio.chime(7);
  if (!blob) { pEl('pMsg').textContent = 'COULD NOT SAVE'; return; }
  count('photos'); const file = new File([blob], 'what-if-snacks-drive.png', { type: 'image/png' });
  try { if (input.isTouch && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: 'What if 50 million people hit download? whatifsnacks.online' }); pEl('pMsg').textContent = 'SHARED'; return; } } catch (e) { /* cancelled: fall through to a download */ }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'what-if-snacks-drive.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); pEl('pMsg').textContent = 'PHOTO SAVED';
}
pEl('btnPhoto').addEventListener('click', enterPhoto); pEl('pDone').addEventListener('click', exitPhoto); pEl('pSnap').addEventListener('click', snap);
pEl('pFilter').addEventListener('click', () => setPhotoFilter((photo.f + 1) % PF.length)); pEl('pIn').addEventListener('click', () => { photo.d = Math.max(3, photo.d * 0.85); }); pEl('pOut').addEventListener('click', () => { photo.d = Math.min(40, photo.d / 0.85); });
{ let drag = null; const pr = new Map();
  canvasEl.addEventListener('pointerdown', (e) => { if (!photo) return; pr.set(e.pointerId, [e.clientX, e.clientY]); drag = pr.size === 2 ? Math.hypot(...[...pr.values()].reduce((p, q) => [p[0] - q[0], p[1] - q[1]])) : null; canvasEl.setPointerCapture(e.pointerId); });
  canvasEl.addEventListener('pointermove', (e) => { if (!photo || !pr.has(e.pointerId)) return; const o = pr.get(e.pointerId); pr.set(e.pointerId, [e.clientX, e.clientY]);
    if (pr.size === 2) { const d = Math.hypot(...[...pr.values()].reduce((p, q) => [p[0] - q[0], p[1] - q[1]])); if (drag) photo.d = clamp(photo.d * drag / d, 3, 40); drag = d; }
    else { photo.a -= (e.clientX - o[0]) * 0.008; photo.e = clamp(photo.e + (e.clientY - o[1]) * 0.006, -0.05, 1.35); } });
  const up = (e) => { pr.delete(e.pointerId); drag = null; }; canvasEl.addEventListener('pointerup', up); canvasEl.addEventListener('pointercancel', up);
  canvasEl.addEventListener('wheel', (e) => { if (photo) { photo.d = clamp(photo.d * Math.exp(e.deltaY * 0.001), 3, 40); e.preventDefault(); } }, { passive: false }); }
function updateCamera(dt, time) {
  if (photo) {
    const ce = Math.cos(photo.e), tx = car.x + Math.sin(photo.a) * ce * photo.d, tz = car.z + Math.cos(photo.a) * ce * photo.d, ty = Math.max(0.5, car.y + 1.1 + Math.sin(photo.e) * photo.d);
    camera.position.set(tx, ty, tz); camera.lookAt(car.x, car.y + 1.0, car.z); camera.fov = 50; camera.updateProjectionMatrix(); arrow.visible = false; return;
  }
  const portrait = camera.aspect < 0.8, speed = car.speed;
  if (R.state === 'title') {
    // the showroom shot: a slow orbit round the car, held in the band between the title text and the garage buttons
    cam.orbit += dt * 0.15; const a = L.SPAWN.yaw + 0.75 + 0.7 * Math.sin(cam.orbit), dist = (portrait ? 12.5 : 7.2) * (car.v.show || 1);
    const tx = car.x + Math.sin(a) * dist, tz = car.z + Math.cos(a) * dist;
    cam.x = damp(cam.x, tx, 2, dt); cam.z = damp(cam.z, tz, 2, dt); cam.y = damp(cam.y, 1.7, 2, dt);
    cam.lx = car.x; cam.ly = car.y + (portrait ? 0.25 : 0.55); cam.lz = car.z;
    cam.fov = portrait ? 62 : 46;
  } else {
    // swing behind the direction of travel, not just the nose
    let hx = Math.sin(car.yaw), hz = Math.cos(car.yaw);
    if (speed > 3) { const vx = car.vx / speed, vz = car.vz / speed, k = car.vf >= 0 ? 0.55 : 0; hx = hx * (1 - k) + vx * k; hz = hz * (1 - k) + vz * k; const n = Math.hypot(hx, hz); hx /= n; hz /= n; }
    cam.pull *= Math.exp(-1.1 * dt);   // the launch pull-back
    let dist = (portrait ? 9.8 : 7.6) + speed * 0.06 + cam.pull * 4;
    const hgt = (portrait ? 4.4 : 3.1) + speed * 0.015 + (car.air ? 1.5 : 0) + cam.pull * 1.2;
    // push in past thin things (palm trunks, lamp and signal poles) that sit between the car and the camera
    dist = Math.min(dist, thinClear(car.x, car.z, -hx, -hz, dist));
    let tx = car.x - hx * dist, tz = car.z - hz * dist, ty = car.y + hgt;
    for (let s = 1; s <= 4; s++) { const f = s / 4; if (L.insideSolid(car.x - hx * dist * f, car.y + 2, car.z - hz * dist * f)) { tx = car.x - hx * dist * (f - 0.25) * 0.9; tz = car.z - hz * dist * (f - 0.25) * 0.9; ty += 1.5; break; } }
    const ease = R.state === 'intro' && R.t < 1.8 ? 1.2 + R.t * 2.6 : 6;   // the swing from the title orbit into the chase cam
    cam.x = damp(cam.x, tx, ease, dt); cam.z = damp(cam.z, tz, ease, dt); cam.y = damp(cam.y, ty, Math.min(4, ease), dt);
    cam.lx = car.x + hx * 5; cam.ly = car.y + 1.3; cam.lz = car.z + hz * 5;
    cam.fov = damp(cam.fov, (portrait ? 68 : 56) + speed * 0.32, 3, dt);
  }
  cam.kick *= Math.exp(-5 * dt); camera.fov = cam.fov + cam.kick * 7;
  const tornadoNear = tornado.active ? Math.max(0, 1 - Math.hypot(tornado.x - car.x, tornado.z - car.z) / 60) : 0;
  cam.shake = Math.max(cam.shake * Math.exp(-5 * dt), Math.min(1.2, car.impact * 0.05), tornadoNear * 0.35, car.speed > 30 ? (car.speed - 30) * 0.008 : 0);
  const sh = cam.shake, n1 = Math.sin(time * 37) + Math.sin(time * 23.7), n2 = Math.sin(time * 31.3) + Math.sin(time * 19.1);
  camera.position.set(cam.x + n1 * sh * 0.12, cam.y + n2 * sh * 0.1, cam.z);
  camera.lookAt(cam.lx, cam.ly, cam.lz); camera.updateProjectionMatrix();
  // the guide arrow over the car, pointing at the next packet (hidden when it's close, after the run, and with ?hud=0).
  // A compass in the view plane: up = straight ahead, leaned back a little so it reads as lying toward the road.
  const ni = packets.nextIndex(), np = ni >= 0 && packets.list[ni], adist = np ? Math.hypot(np.x - car.x, np.z - car.z) : 0;
  arrow.visible = !!np && adist > 12 && (R.state === 'intro' || R.state === 'live') && !NOHUD;
  if (arrow.visible) {
    _v.set(np.x - car.x, 0, np.z - car.z).applyQuaternion(_q2.copy(camera.quaternion).invert());
    arrow.position.set(car.x + Math.sin(car.yaw) * 1.5, car.y + 3.2 + Math.sin(time * 4) * 0.12, car.z + Math.cos(car.yaw) * 1.5);
    arrow.quaternion.copy(camera.quaternion); arrow.rotateX(-0.6); arrow.rotateZ(-Math.atan2(_v.x, -_v.z)); arrow.scale.setScalar(0.8 + 0.07 * Math.sin(time * 8));
  }
  if (tier === 'high') { sunL.position.set(car.x, 0, car.z).addScaledVector(LD, 300); sunL.target.position.set(car.x, 0, car.z); sunL.target.updateMatrixWorld(); }
}

// ---------------------------------------------------------------- render, adaptive resolution, tier probe
let scale = 1, ema = 16, adaptT = 0, probeT = 0;
const basePR = () => Math.min(devicePixelRatio || 1, tier === 'high' ? 1.5 : tier === 'medium' ? 1.25 : 1);
function resize() {
  const w = innerWidth, h = innerHeight, pr = basePR() * scale;
  renderer.setPixelRatio(pr); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); if (post) post.setSize(w, h, pr);
  if (mode && mode.resize) mode.resize(w, h, pr);
  fx && (fx.mat.uniforms.scale.value = h * pr * 0.9);
}
addEventListener('resize', resize);
function dropTier() {
  if (tier === 'high') { tier = 'medium'; renderer.shadowMap.enabled = false; sunL.castShadow = false; }
  else if (tier === 'medium') { tier = 'low'; post = makePost(renderer, scene, camera, 'low'); document.documentElement.classList.add('low'); }
  scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
  resize();
}
function render(dt) {
  renderer.info.reset();
  const time = R.sim;
  if (mode) { mode.render(dt); hud.update(dt); if (rainSnd && audio.ctx) rainSnd.g.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.2); audio.update(dt, car, { running: false, silent: true }); return; }
  if (tod !== todTarget || rain !== rainTarget) { tod = Math.abs(tod - todTarget) < 0.004 ? todTarget : damp(tod, todTarget, 2.2, dt); rain = Math.abs(rain - rainTarget) < 0.004 ? rainTarget : damp(rain, rainTarget, 1.6, dt); applyTod(); }
  if (stars && stars.visible) { stars.position.copy(camera.position); moonSpr.position.copy(camera.position).addScaledVector(MOON, 6200); }
  city.update(time, dt, { night: tod * 0.62, dusk: 0.35 * (1 - tod) + 0.12 * tod, wet: Math.max(R.env.grip < 1 ? 0.6 : 0, rain * 0.7), wind: tornado.active ? 1 : 0.2, cloudColor: CLOUD });
  car.render(dt); updateCamera(dt, time); updateRain(dt);
  // the ghost
  const gh = R.ghost && (R.state === 'intro' || R.state === 'live') && ghostAt(R.ghost, R.t, gpos);
  ghostMesh.visible = !!gh; if (gh) { ghostMesh.position.set(gpos[0], L.groundY(gpos[0], gpos[1]) + 0.02, gpos[1]); ghostMesh.rotation.y = gpos[2]; }
  // HUD
  if (R.state === 'intro' || R.state === 'live' || R.state === 'done') {
    hud.timer(R.free ? R.t : R.timerOn ? CONFIG.runSeconds - R.timerT : CONFIG.runSeconds, R.free || R.timerOn, R.free); hud.speed(Math.round(car.speed * 3.6)); hud.boost(car.boostE, car.boostLock, car.boosting);
    const blips = BLIPS; blips.length = 0; const ni = packets.nextIndex();
    packets.list.forEach((p, i) => { if (!p.got) blips.push({ x: p.x, z: p.z, kind: i === ni ? 'next' : 'packet' }); });
    if (tornado.active) blips.push({ x: tornado.x, z: tornado.z, kind: 'tornado' });
    for (const d of drones.list) if (d.on) blips.push({ x: d.x, z: d.z, kind: 'drone' });
    for (const b of ramps.blips) blips.push({ x: b.x, z: b.z, kind: 'packet' });
    if (gh) blips.push({ x: gpos[0], z: gpos[1], kind: 'ghost' });
    if (heli.on) blips.push({ x: heli.x, z: heli.z, kind: 'heli' });
    for (const c of police.cruisers) blips.push({ x: c.x, z: c.z, kind: 'drone' });
    hud.drawRadar(car, blips, time);
  }
  hud.update(dt);
  let dd = 1e9; for (const d of drones.list) if (d.on) dd = Math.min(dd, Math.hypot(d.x - car.x, d.z - car.z));
  audio.update(dt, car, { heliDist: heli.on ? Math.hypot(heli.x - car.x, heli.y - car.y, heli.z - car.z) : 1e9, tornadoDist: tornado.active ? Math.hypot(tornado.x - car.x, tornado.z - car.z) : 1e9, droneDist: dd, running: R.state !== 'title' });
  if (post.uniforms) {
    _v.copy(SUN).multiplyScalar(5000).add(camera.position).project(camera); const vis = _v.z < 1 && Math.abs(_v.x) < 1.3 && Math.abs(_v.y) < 1.3 ? 1 - tod : 0;
    post.uniforms.sun.value.set(_v.x * 0.5 + 0.5, _v.y * 0.5 + 0.5); post.uniforms.sunVis.value = vis; post.uniforms.time.value = (time % 10) + 1;
    post.uniforms.speed.value = clamp((car.speed - 18) / 30, 0, 1) * (CAPTURE ? 0.6 : 1); post.uniforms.hit.value = clamp(car.impact / 25, 0, 1);
  }
  post.render();
}
const BLIPS = [];
// stunt jumps: landing on a ramp's bullseye pad pays once per run (on top of the air-time bonus), the tally lives in localStorage
const JCB = { onFly: () => audio.whoosh(1), onJump: (i, d) => { const first = !R.jumps.has(i); R.jumps.add(i); if (first) { style.add('UNIQUE JUMP', 1000); count('stunt-jump'); } hud.toast('STUNT JUMP', `${ramps.found.size}/${ramps.count} · ${Math.round(d)} M`, 1.8); } };
// police callbacks: a bust takes a fine off the run's style cash and clears the heat; escaping clears it too
const PCB = { onBust: (fine) => { style.run = Math.max(0, style.run - fine); R.chaos = 0; count('police-bust'); audio.thud(); }, onShove: (v) => { audio.thud(); crashPop(v, 'BONK!'); }, onLost: () => { R.chaos = 0; count('police-lost'); audio.chime(9); }, onSpawn: () => audio.alarm(), toast: (a, b) => hud.toast(a, b, 1.8) };

let last = 0, acc = 0, frames = 0, fpsT = 0, fps = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (hidden) { last = now; return; }
  const dtReal = Math.min(0.1, (now - (last || now)) / 1000); last = now;
  ema = ema * 0.92 + dtReal * 1000 * 0.08; frames++; fpsT += dtReal; if (fpsT >= 1) { fps = frames / fpsT; frames = 0; fpsT = 0; window.__oc.fps = fps; }
  const c0 = performance.now();
  acc += dtReal; let n = 0; while (acc >= 1 / 60 && n < 5) { step(1 / 60); acc -= 1 / 60; n++; } if (n === 5) acc = 0;
  // adaptive resolution and the tier probe
  adaptT += dtReal; probeT += dtReal;
  if (adaptT > 0.6) { adaptT = 0; const old = scale; if (ema > 17.6) scale = Math.max(0.55, scale - 0.06); else if (ema < 14.2) scale = Math.min(1, scale + 0.04); if (old !== scale) resize(); }
  if (probeT > 4 && ema > 38 && scale <= 0.6 && tier !== 'low' && !Q.get('q') && !document.hidden && document.hasFocus()) { probeT = 0; dropTier(); }   // really slow (under ~26 fps at the lowest resolution) and the tab is in front; a 30 fps power-saver or a backgrounded tab must not cost the quality for good
  const c1 = performance.now(); render(dtReal); const c2 = performance.now(); cpu.step = cpu.step * 0.95 + (c1 - c0) * 0.05; cpu.render = cpu.render * 0.95 + (c2 - c1) * 0.05;
}
const cpu = { step: 0, render: 0 };
document.addEventListener('visibilitychange', () => { hidden = document.hidden; audio.suspend(hidden); });

// ---------------------------------------------------------------- test / capture hooks
window.__oc = {
  setNight: (n, now) => { setLook(n ? 1 : 0); if (now) { tod = todTarget; rain = rainTarget; applyTod(); } }, setLook: (i, now) => { setLook(i); if (now) { tod = todTarget; rain = rainTarget; applyTod(); } }, get tod() { return tod; }, get rain() { return rain; },
  ready: false, fps: 0, get tier() { return tier; }, get mode() { return mode; }, get sel() { return sel; }, THREE, get scene() { return scene; }, get state() { return R.state; }, get R() { return R; }, get car() { return car; },
  key: turnKey, retry, pick: pickCar, get audio() { return audio; }, get heli() { return heli; }, get police() { return police; }, get ramps() { return ramps; }, get style() { return style; }, get traffic() { return traffic; }, get packets() { return packets; }, mem: () => ({ geo: renderer.info.memory.geometries, tex: renderer.info.memory.textures }), get camera() { return camera; }, card: () => hud.cardImage(window.__oc.result).toDataURL('image/png'),
  advance(dt) { const n = Math.max(1, Math.round(dt * 60)); for (let i = 0; i < n; i++) step(1 / 60); render(dt); return R.state; },
  stats: () => ({ fps, ema, cpuStep: +cpu.step.toFixed(2), cpuRender: +cpu.render.toFixed(2), scale, tier, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, state: R.state, pct: R.pct, pips: R.pips, t: R.t, x: car.x, z: car.z, speed: car.speed }),
};
boot().catch((e) => { console.error(e); document.getElementById('loading').innerHTML = `<div style="padding:20px">Could not start: ${e.message}</div>`; });
