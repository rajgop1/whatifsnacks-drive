// DEEP SNACK: dive a cute submarine from a sunny surface to the bottom of the Challenger Deep (10,935 m). Self-contained mode (see README.md).
// Controls (touch has only five): steer = turn, DIVE (DRIFT / Space / Down / C / pad A or stick down) = flood the ballast, RISE (BRAKE / S / Q / pad LT or stick up)
// = blow it, SPRINT (BOOST / W / Shift / pad RT) = full propeller (battery). The sub always cruises. SONAR = HUD button, F, or pad Y. END DIVE = HUD button or Enter.
import * as THREE from 'three';
import { Particles } from '../fx.js';
import { clamp, damp, lerp, smooth } from '../util.js';
import * as W from './sub_world.js';
import { Life, makeSub, makePreviewSub } from './sub_life.js';

// built-in copy of the milestone table (js/oceanfacts.js is the source of truth; this is used only if it fails to load)
const FALLBACK = [
  [10, 'TWO ATMOSPHERES', 'Ten metres down, the water already presses twice as hard as the air at the surface.'],
  [40, 'SCUBA LIMIT', 'The recreational scuba limit. The pressure is 5 times the surface.'],
  [200, 'SUNLIGHT ENDS', 'Below about 200 m there is too little light for plants to grow. Welcome to the twilight zone.'],
  [332, 'SCUBA RECORD', 'The deepest scuba dive ever: 332 m. The way back up took over 13 hours.'],
  [1000, 'MIDNIGHT ZONE', 'No sunlight reaches below 1,000 m. The pressure is 100 times the surface.'],
  [2992, 'DEEPEST WHALE', 'A Cuvier\'s beaked whale dived 2,992 m on one breath, the deepest of any mammal ever tracked.'],
  [3800, 'THE TITANIC', 'The Titanic rests about 3,800 m down, under 380 times the pressure at the surface.'],
  [4000, 'THE ABYSS', 'Pitch dark, near freezing, and 400 times the pressure of the surface.'],
  [6000, 'HADAL ZONE', 'Below 6,000 m the ocean floor drops into trenches. The zone is named after Hades.'],
  [6500, 'ALVIN\'S LIMIT', 'Even Alvin, the most famous research sub in the world, cannot go deeper than 6,500 m.'],
  [8849, 'DEEPER THAN EVEREST', 'You have gone deeper than Mount Everest is tall. The summit is 8,849 m above sea level.'],
  [10935, 'CHALLENGER DEEP', 'The deepest known place in the ocean. Put Everest on the bottom and its tip stays 2 km underwater.'],
].map(([m, title, fact]) => ({ m, title, fact, source: 'js/oceanfacts.js', atm: Math.round(W.atm(m)), pressure: `${Math.round(W.atm(m))} ATM` }));
// creatures (first sighting: a +label and a short line). Lines are checked facts; sources in the comments.
const SPECIES = [
  ['fish', 'REEF FISH', 'Coral reefs cover under 1% of the sea floor but shelter about a quarter of all ocean species.'],            // NOAA Coral Reef Conservation Program
  ['turtle', 'SEA TURTLE', 'A resting sea turtle can stay underwater for hours on one breath.'],                                      // NOAA Fisheries: resting/sleeping turtles 4 to 7 h
  ['ray', 'MANTA RAY', 'Manta rays have one of the biggest brains for their size of any fish.'],                                     // Ari 2011, J. Fish Biol.: largest brain-to-body ratio of fishes
  ['jelly', 'JELLYFISH', 'No brain, no heart, no bones. Jellyfish have been drifting for over 500 million years.'],                  // Cartwright et al. 2007, PLOS ONE: 505 Myr fossils
  ['giant', 'GIANT SQUID', 'A giant squid. Its eyes are as big as dinner plates, among the largest of any animal.'],                  // Nilsson et al. 2012, Curr. Biol.: up to 27 cm
  ['squid', 'GLOWING SQUID', 'Lots of deep squid glow on their bellies to match the faint light above. It hides their shadow.'],     // counter-illumination, Young & Roper 1976
  ['siph', 'SIPHONOPHORE', 'That string of lights isn\'t one animal. It\'s a colony of clones working as one body.'],                 // MBARI
  ['whale', 'SPERM WHALE', 'Sperm whales dive past 2,000 m to hunt squid, all on a single breath.'],                                  // Watkins et al. 1993; Whitehead 2003: dives to 2,000 m+
  ['angler', 'ANGLERFISH', 'That glowing lure is lit by bacteria living inside it.'],                                                 // Haygood & Distel 1993, Nature
  ['pig', 'SEA PIG', 'Sea pigs are sea cucumbers that walk the abyss on tiny tube feet.'],                                           // MBARI, Scotoplanes
  ['worms', 'TUBE WORMS', 'Giant tube worms have no mouth and no gut. Bacteria inside them turn vent chemicals into food.'],         // Cavanaugh et al. 1981, Science
  ['snail', 'SNAILFISH', 'The deepest fish ever filmed was a snailfish at 8,336 m.'],                                                 // Jamieson et al. 2023, UWA / Minderoo
  ['amphi', 'AMPHIPODS', 'Tiny amphipods scavenge even at the very bottom of the Challenger Deep.'],                                  // Hirondellea gigas, Kobayashi et al. 2012
];
// sample canisters, a depth ladder (x, world depth, z); 'wreck' and 'vents' are placed on the props at load
const CANS = [[6, 9, 120], [0, 40, 74], [10, 75, 60], [-12, 118, 20], [14, 160, -20], [-10, 250, -75], 'wreck', 'vents', [6, 600, -580]];
const GLOWS = new Set(['jelly', 'squid', 'siph', 'angler', 'whale', 'giant']);
const fmt = (n) => Math.round(n).toLocaleString('en-US'), fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const WCOL = [[0, [0.05, 0.46, 0.56]], [12, [0.035, 0.36, 0.52]], [40, [0.025, 0.24, 0.46]], [200, [0.015, 0.1, 0.28]], [600, [0.01, 0.05, 0.14]], [1000, [0.005, 0.016, 0.045]], [4000, [0.003, 0.007, 0.018]]];
function waterCol(d, out) { let i = 1; while (i < WCOL.length - 1 && d > WCOL[i][0]) i++; const [d0, a] = WCOL[i - 1], [d1, b] = WCOL[i], k = clamp((d - d0) / (d1 - d0), 0, 1); return out.setRGB(lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)); }
const CSS = `
#subhud{position:absolute;inset:0;font-family:var(--f);color:var(--cream)}
#subhud .pn{background:rgba(20,26,58,.72);border-radius:12px;box-shadow:0 3px 0 rgba(0,0,0,.35)}
#shDepth{position:absolute;right:max(12px,var(--sa-right));top:max(10px,var(--sa-top));text-align:right;font-weight:900;text-shadow:0 2px 0 rgba(0,0,0,.5)}
#shDepth b{display:block;font-size:clamp(24px,6.6vw,38px);line-height:1;font-variant-numeric:tabular-nums}
#shDepth span{display:block;margin-top:2px;font-size:12px;letter-spacing:.12em;color:var(--sun);font-variant-numeric:tabular-nums}
#shDepth i{display:block;font-style:normal;margin-top:2px;font-size:10px;letter-spacing:.16em;opacity:.9}
#shEnd{position:absolute;left:max(14px,var(--sa-left));bottom:142px;height:44px;padding:0 14px;border:0;border-radius:22px;background:rgba(255,244,230,.92);color:var(--navy);font:900 12px/1 var(--f);letter-spacing:.1em;pointer-events:auto;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.35)}
#shComp{position:absolute;left:50%;top:max(12px,var(--sa-top));transform:translateX(-50%);width:min(28vw,280px);height:30px;border-radius:15px}
#shLad{position:absolute;right:max(20px,calc(var(--sa-right) + 20px));top:calc(max(10px,var(--sa-top)) + 150px);bottom:24px;width:8px;border-radius:4px;background:rgba(20,26,58,.72);box-shadow:0 2px 0 rgba(0,0,0,.35)}
.touch #shLad{bottom:calc(max(18px,var(--sa-bottom)) + var(--bb) + var(--db) + 30px)}
#shLad .fill{position:absolute;left:0;right:0;top:0;border-radius:4px;background:linear-gradient(#5ae0ff,#2a5aff 40%,#ffd84d)}
#shLad .tk{position:absolute;right:10px;transform:translateY(-50%);font-weight:900;font-size:10px;letter-spacing:.06em;white-space:nowrap;text-shadow:0 1px 0 rgba(0,0,0,.6);opacity:.75}
#shLad .tk::after{content:"";position:absolute;right:-10px;top:50%;width:8px;height:2px;background:currentColor}
#shLad .tk.on{color:var(--sun);opacity:1}#shLad .tk.nl{font-size:0}#shLad .tk.nl::after{right:-10px}
#shLad .cn{position:absolute;left:-3px;width:14px;height:14px;margin-top:-7px;border-radius:50%;border:2px solid #7ae8ff;background:var(--navy);box-sizing:border-box}#shLad .cn.got{background:#7ae8ff}
#shLad .me{position:absolute;left:-9px;width:26px;height:16px;margin-top:-8px;border-radius:8px;background:var(--sun);box-shadow:0 2px 0 rgba(0,0,0,.4)}
#shGau{position:absolute;left:max(14px,var(--sa-left));bottom:18px;width:150px}
.touch #shGau{bottom:calc(max(18px,var(--sa-bottom)) + var(--tb) + 16px)}
#shGau div{position:relative;height:16px;margin-top:6px;border-radius:8px;background:rgba(20,26,58,.75);overflow:hidden;box-shadow:0 2px 0 rgba(0,0,0,.35)}
#shGau i{position:absolute;left:0;top:0;bottom:0;width:0}#shGau span{position:absolute;inset:0;display:grid;place-items:center;font-weight:900;font-size:10px;letter-spacing:.14em;text-shadow:0 1px 0 rgba(0,0,0,.7)}
#shHull i{background:linear-gradient(90deg,#7ae8ff,#ffd84d 60%,#ff6b57)}#shBat i{background:var(--coral)}#shBat.lock i{background:#8a6a6a}
#shHull.warn{animation:shpulse .45s ease-in-out infinite alternate}
#shPing{position:absolute;left:max(14px,var(--sa-left));bottom:68px;width:62px;height:62px;border-radius:50%;border:3px solid #7ae8ff;background:rgba(20,26,58,.8);color:#7ae8ff;font:900 11px/1 var(--f);letter-spacing:.06em;pointer-events:auto;cursor:pointer;box-shadow:0 3px 0 rgba(0,0,0,.35)}
.touch #shPing{bottom:calc(max(18px,var(--sa-bottom)) + var(--tb) + 66px)}
.touch #shEnd{bottom:calc(max(18px,var(--sa-bottom)) + var(--tb) + 140px)}
.inmode #toast{white-space:normal;width:min(92vw,720px);font-size:clamp(24px,7vw,48px);line-height:1.05}
#shPing.cool{opacity:.5}#shPing small{display:block;font-size:10px;opacity:.8;margin-top:2px}.touch #shPing small{display:none}
#shKeys{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);font-weight:800;font-size:12px;letter-spacing:.08em;white-space:nowrap;padding:8px 14px;transition:opacity .6s}
.touch #shKeys{display:none}
#shHint{position:absolute;left:50%;top:44%;transform:translateX(-50%);font-weight:900;font-size:15px;letter-spacing:.1em;white-space:nowrap;text-shadow:0 2px 0 rgba(0,0,0,.6);opacity:0;transition:opacity .4s}
#shHint.on{opacity:1;animation:shpulse .7s ease-in-out infinite alternate}
#shWipe{position:absolute;inset:0;pointer-events:none;opacity:0;background:linear-gradient(180deg,rgba(255,255,255,0) 0%,rgba(200,250,255,.85) 46%,rgba(120,220,255,.5) 54%,rgba(40,140,200,0) 70%)}
#shWipe.go{animation:shwipe .55s ease-out forwards}
#shCard{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100% - 28px));max-height:calc(100% - 28px);overflow:auto;padding:18px 18px 16px;box-sizing:border-box;text-align:center;pointer-events:auto;background:#141a3a;border-radius:20px;box-shadow:0 8px 0 rgba(0,0,0,.35);display:none}
#shCard.on{display:block;animation:shin .35s cubic-bezier(.2,1.4,.4,1)}
#shCard small{display:block;font-weight:900;font-size:11px;letter-spacing:.16em;color:var(--sun)}
#shCard h2{margin:8px 0 4px;font-weight:900;font-size:clamp(26px,7vw,36px);line-height:1.05;text-shadow:0 3px 0 var(--coral)}
#shCard .big{font-weight:900;font-size:clamp(40px,12vw,60px);line-height:1;margin-top:8px;font-variant-numeric:tabular-nums}
#shCard .sub{font-weight:800;font-size:13px;letter-spacing:.1em;color:#7ae8ff}
#shCard .st{display:flex;gap:8px;margin:12px 0}#shCard .st div{flex:1;background:#1f2756;border-radius:12px;padding:8px 4px}
#shCard .st b{display:block;font-size:20px;color:var(--sun)}#shCard .st span{font-size:10px;font-weight:800;letter-spacing:.12em}
#shCard p{margin:4px 0 12px;font-weight:700;font-size:14px;line-height:1.35}
#shCard button{display:block;width:100%;min-height:46px;margin-top:8px;border:0;border-radius:14px;font:900 15px/1 var(--f);letter-spacing:.08em;cursor:pointer;box-shadow:0 4px 0 rgba(0,0,0,.35)}
#shCard .b1{background:var(--sun);color:var(--navy)}#shCard .b2{background:var(--cream);color:var(--navy)}#shCard .b3{background:#1f2756;color:var(--cream)}
@media (max-height:520px){#subhud #shEnd{left:calc(max(14px,var(--sa-left)) + 74px);bottom:calc(max(18px,var(--sa-bottom)) + var(--tb) + 75px)}.notouch #subhud #shEnd{bottom:77px}#shLad{top:calc(max(10px,var(--sa-top)) + 84px)}#shCard{padding:12px}#shCard .big{font-size:38px}#shCard .st{margin:8px 0}#shCard p{margin:2px 0 6px}}
#shLabels{position:absolute;left:50%;top:max(28%,calc(var(--hudb,150px) + 50px));transform:translate(-50%,-50%);display:flex;flex-direction:column;align-items:center;gap:6px}
#shLabels div.sun{color:var(--sun)}
#shLabels div{font-weight:900;font-size:clamp(20px,5.6vw,30px);letter-spacing:.04em;color:#7dffc8;text-shadow:0 3px 0 var(--navy);white-space:nowrap;animation:shlab 1.6s forwards}
@keyframes shlab{0%{transform:scale(.6);opacity:0}12%{transform:scale(1.1);opacity:1}80%{transform:none;opacity:1}100%{opacity:0;transform:translateY(-14px)}}
#subhud.carded #shEnd,#subhud.carded #shPing,#subhud.carded #shHint{display:none}
@keyframes shpulse{from{opacity:1}to{opacity:.55}}
@keyframes shwipe{0%{opacity:1;transform:translateY(60%)}100%{opacity:0;transform:translateY(-70%)}}
@keyframes shin{from{transform:translate(-50%,-50%) scale(.8);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
`;

export default class SubMode {
  constructor(ctx) { this.ctx = ctx; }

  async load() {
    this.facts = FALLBACK;
    try { const m = await import('../oceanfacts.js'); if (Array.isArray(m.OCEAN_FACTS) && m.OCEAN_FACTS.length) this.facts = m.OCEAN_FACTS.filter((f) => f && f.m > 0 && f.title && f.fact).slice().sort((a, b) => a.m - b.m); } catch (e) { /* keep the built-in table */ }
    const scene = (this.scene = new THREE.Scene());
    scene.fog = new THREE.FogExp2(0x2090a0, 0.012); this.bg = new THREE.Color(); scene.background = this.bg;
    this.sunL = new THREE.DirectionalLight(0xffffff, 3); this.sunL.position.copy(W.SUN_DIR).multiplyScalar(100); scene.add(this.sunL, this.sunL.target);
    this.hemi = new THREE.HemisphereLight(0x88ccff, 0x204060, 1.2); scene.add(this.hemi);
    this.terrain = W.buildTerrain(scene); this.surface = W.buildSurface(scene); this.sky = W.buildSky(scene); this.shafts = W.buildShafts(scene); this.drift = W.buildDrift(scene);
    this.life = new Life(scene);
    const bodyMat = W.patch(new THREE.MeshLambertMaterial({ vertexColors: true }), { ping: false });
    this.subG = makeSub({ body: bodyMat, glass: new THREE.MeshPhongMaterial({ color: 0xcff2ff, transparent: true, opacity: 0.22, shininess: 90, specular: 0xffffff, depthWrite: false }), lamp: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.8, 2.2), fog: false }) });
    this.subG.rotation.order = 'YXZ'; scene.add(this.subG);
    this.spot = new THREE.SpotLight(0xfff0dd, 0, 95, 0.5, 0.6, 1); this.spot.position.set(0, -0.45, 1.3); this.spot.target.position.set(0, -3.5, 22); this.subG.add(this.spot, this.spot.target);
    this.hull = new THREE.PointLight(0xffe2c0, 4, 11, 1); this.hull.position.set(0, 2.2, 0.5); this.subG.add(this.hull);
    // the headlight beam you can see in dark water
    const cone = new THREE.ConeGeometry(7, 34, 24, 1, true).translate(0, -17, 0).rotateX(-Math.PI / 2);
    this.beam = new THREE.Mesh(cone, new THREE.ShaderMaterial({ uniforms: { uA: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      vertexShader: 'varying float vZ; varying vec3 vN, vV; void main(){ vZ = position.z / 34.0; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform float uA; varying float vZ; varying vec3 vN, vV; void main(){ float e = pow(abs(dot(normalize(vN), vV)), 1.5); gl_FragColor = vec4(vec3(1.0, 0.92, 0.75) * uA * e * pow(1.0 - clamp(vZ, 0.0, 1.0), 1.6) * 0.3, 1.0); }' }));
    this.beam.position.set(0, -0.45, 1.3); this.beam.rotation.x = 0.14; this.beam.renderOrder = 7; this.subG.add(this.beam);
    this.fx = new Particles(scene);
    // canisters (body + glowing bands, instanced) and their halos (one Points)
    this.cans = CANS.map((c) => (c === 'wreck' ? this.life.deck.clone() : c === 'vents' ? new THREE.Vector3(W.VENTS.x + 7, -W.floorY(W.VENTS.x + 7, W.VENTS.z + 5) + 6, W.VENTS.z + 5) : new THREE.Vector3(c[0], -Math.min(c[1], W.floorY(c[0], c[2]) - 3), c[2])));
    const bodyG = new THREE.CylinderGeometry(0.36, 0.36, 1.1, 12), bandG = new THREE.CylinderGeometry(0.385, 0.385, 0.2, 14, 1, true);
    this.canBody = new THREE.InstancedMesh(bodyG, W.lambert({ color: 0xfff4e6, vertexColors: false, flatShading: false }, { above: true }), this.cans.length);
    this.canBand = new THREE.InstancedMesh(bandG, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 3.2, 3.0), fog: false }), this.cans.length * 2);
    for (const m of [this.canBody, this.canBand]) { m.frustumCulled = false; scene.add(m); }
    const hp = new Float32Array(this.cans.length * 3); this.cans.forEach((p, i) => p.toArray(hp, i * 3)); this.haloA = new Float32Array(this.cans.length).fill(1);
    const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.BufferAttribute(hp, 3)); hg.setAttribute('a', new THREE.BufferAttribute(this.haloA, 1));
    this.halos = new THREE.Points(hg, new THREE.ShaderMaterial({ uniforms: { uS: { value: 600 }, uT: W.U.uT }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
      vertexShader: 'attribute float a; uniform float uS, uT; varying float vA; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vA = a * (0.75 + 0.25 * sin(uT * 3.0 + position.x)); gl_PointSize = 4.0 * uS / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; void main(){ vec2 d = gl_PointCoord - 0.5; float r = max(0.0, 1.0 - length(d) * 2.0); gl_FragColor = vec4(vec3(0.4, 1.0, 0.95) * r * r * vA * 0.9, 1.0); }' }));
    this.halos.frustumCulled = false; scene.add(this.halos);
    this.beacon = new THREE.Sprite(new THREE.SpriteMaterial({ map: W.glowTex(), color: new THREE.Color(2.2, 1.8, 0.6), blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false, transparent: true })); this.beacon.renderOrder = 30; scene.add(this.beacon);
    this.O = new THREE.Object3D(); this.v = new THREE.Vector3(); this.c = new THREE.Color(); this.c2 = new THREE.Color();
    this.post = this.ctx.makePost(this.ctx.renderer, scene, this.ctx.camera, this.ctx.tier); this.postTier = this.ctx.tier;
    this.s = { x: W.START.x, y: 0, z: W.START.z, Y: 0, yaw: W.START.yaw, u: 0, vy: 0, pitch: 0, roll: 0, e: 1, lock: false };
    this.cam = { x: 0, y: 3, z: 0, shake: 0 }; this.t = 0; this.resetRun();
    this.ctx.renderer.compile(scene, this.ctx.camera);
  }

  makePreview() { return makePreviewSub(); }
  // test hook: drop the sub at a spot mid-dive (tools/sub.js uses it for framed screenshots)
  debugJump(x, Y, z, yaw = Math.PI) { const s = this.s; Object.assign(s, { x, y: -Y, z, Y, yaw, vy: 0, u: 9, pitch: 0 }); Object.assign(this, { phase: 'play', surfaced: false, splashed: true, vented: true, saidHi: true }); this.cam.x = x - Math.sin(yaw) * 10; this.cam.z = z - Math.cos(yaw) * 10; this.cam.y = -Y + 3; }

  // ---------------------------------------------------------------- run state
  resetRun() {
    const s = this.s; Object.assign(s, { x: W.START.x, z: W.START.z, yaw: W.START.yaw, y: -0.35, Y: 0.35, u: 0, vy: 0, pitch: 0, roll: 0, e: 1, lock: false });
    Object.assign(this, { t: 0, phase: 'intro', surfaced: true, maxD: 0, got: new Array(this.cans.length).fill(false), nGot: 0, spotted: new Set(), fired: new Set(), counted: new Set(), q: [], qT: 0, steerS: 0,
      ping: null, pingCool: 0, lq: [], live: [], toastAt: -9, creakT: 8, clickT: -1, bellT: 2, bubT: 0, spotT: 0, shudder: 0, idleT: 0, splashed: false, vented: false, card: false, cardAt: -1, gotSnack: false, armed: false, wasAbove: true, keysPrev: {}, hintOff: false, warned: 0, finalD: 0 });
    if (this.el && this.el.labels) this.el.labels.innerHTML = '';
    this.life.reset(s); this.cam.x = s.x - 6; this.cam.y = 2.2; this.cam.z = s.z - 8;
    for (let i = 0; i < this.cans.length; i++) this.haloA[i] = 1;
  }

  start() {
    const ctx = this.ctx; this.resetRun();
    ctx.labels({ boost: 'SPRINT', brake: 'RISE', drift: 'DIVE' });
    ctx.ui.innerHTML = '';
    const st = document.createElement('style'); st.textContent = CSS; ctx.ui.appendChild(st);
    const h = document.createElement('div'); h.id = 'subhud';
    h.innerHTML = `<div id="shDepth"><b id="shM">0 M</b><span id="shA">1.0 ATM</span><i id="shZ">SUNLIGHT ZONE</i></div><button id="shEnd" type="button">END DIVE</button>
      <canvas id="shComp"></canvas><div id="shLad"><div class="fill"></div></div>
      <div id="shGau"><div id="shHull"><i></i><span>HULL STRESS</span></div><div id="shBat"><i></i><span>SPRINT BATTERY</span></div></div>
      <button id="shPing" type="button">SONAR<small>F</small></button>
      <div id="shKeys" class="pn">← → TURN · SPACE / ↓ DIVE · S RISE · W SPRINT · F SONAR</div><div id="shHint"></div><div id="shLabels"></div><div id="shWipe"></div><div id="shCard"></div>`;
    ctx.ui.appendChild(h); this.hud = h; const $ = (id) => h.querySelector('#' + id);
    this.el = { m: $('shM'), a: $('shA'), z: $('shZ'), lad: $('shLad'), hull: $('shHull'), bat: $('shBat'), ping: $('shPing'), keys: $('shKeys'), hint: $('shHint'), wipe: $('shWipe'), card: $('shCard'), comp: $('shComp'), labels: $('shLabels') };
    this.el.hullI = this.el.hull.querySelector('i'); this.el.batI = this.el.bat.querySelector('i'); this.el.fill = this.el.lad.querySelector('.fill');
    $('shEnd').addEventListener('click', () => this.showCard('end')); this.el.ping.addEventListener('pointerdown', (e) => { e.preventDefault(); this.wantPing = true; });
    // the depth ladder: milestone ticks, canisters, you
    this.ticks = this.facts.map((f) => { const d = document.createElement('div'); d.className = 'tk'; d.style.top = (W.worldY(f.m) / W.MAXY * 100).toFixed(2) + '%'; d.textContent = f.m >= 1000 ? `${+(f.m / 1000).toFixed(1)}K` : `${f.m}`; this.el.lad.appendChild(d); return d; });
    this.canDots = this.cans.map((p) => { const d = document.createElement('div'); d.className = 'cn'; d.style.top = (-p.y / W.MAXY * 100).toFixed(2) + '%'; this.el.lad.appendChild(d); return d; });
    this.me = document.createElement('div'); this.me.className = 'me'; this.el.lad.appendChild(this.me);
    this.cache = {}; this.compHead = 1e9;
    const sz = ctx.renderer.getSize(this.v2 || (this.v2 = new THREE.Vector2())); this.resize(sz.x, sz.y, ctx.renderer.getPixelRatio());
    ctx.hud.toast('HOW DEEP?', 'THE BOTTOM IS 10,935 M DOWN', 2.4);
    this.startAudio(); setTimeout(() => this.layoutLadder(), 50);
  }

  resize(w, h, pr) {
    if (this.post) this.post.setSize(w, h, pr);
    this.fx.mat.uniforms.scale.value = h * pr * 0.9; this.halos.material.uniforms.uS.value = h * pr * 0.5;
    for (const p of [this.drift.snow, this.drift.glow]) p.material.uniforms.uScale.value = h * pr * 0.9;
    this.layoutLadder();
  }
  layoutLadder() {   // show only the labels that have room (12 milestones crowd near the top)
    if (!this.ticks || !this.el) return; const H = this.el.lad.clientHeight; let last = -99;
    this.ticks.forEach((d, i) => { const y = W.worldY(this.facts[i].m) / W.MAXY * H, ok = y - last >= 13 || i === this.ticks.length - 1; d.classList.toggle('nl', !ok); if (ok) last = y; });
  }

  // ---------------------------------------------------------------- fixed step
  step(dt) {
    const s = this.s, inp = this.ctx.input, k = inp.keys, A = this.ctx.audio; this.t += dt; const t = this.t;
    // controls
    let padY = 0, padPing = false; if (navigator.getGamepads) for (const p of navigator.getGamepads()) if (p) { if (Math.abs(p.axes[1] || 0) > 0.5) padY = p.axes[1]; if (p.buttons[3] && p.buttons[3].pressed) padPing = true; }
    const down = k.has('ArrowDown'), dive = inp.handbrake || down || k.has('KeyC') || padY > 0.5, rise = (inp.brake > 0 && !down) || k.has('KeyQ') || padY < -0.5;
    const edge = (name, on) => { const was = this.keysPrev[name]; this.keysPrev[name] = on; return on && !was; };
    if (edge('ping', k.has('KeyF') || padPing) || this.wantPing) { this.wantPing = false; this.doPing(); }
    if (edge('end', k.has('Enter')) && !this.card && this.phase === 'play') this.showCard('end');
    if (edge('retry', k.has('KeyR')) && this.card) { this.retry(); return; }
    const live = this.phase === 'play' && !this.card;
    // the intro: bob, vent the ballast, plunge (the hook)
    let wantDive = dive, wantRise = rise, sprintWant = inp.boost;
    if (this.phase === 'intro') {
      wantDive = t > 1.2; wantRise = false; sprintWant = false;
      if (t > 0.45 && !this.vented) { this.vented = true; this.vent(); }
      if (t > 2.0 && !this.saidHi) { this.saidHi = true; this.say(null, this.ctx.isTouch ? 'Hold DIVE to sink, RISE to come up. Grab the glowing samples on the way down.' : 'Hold Space to dive, S to rise. Grab the glowing samples on the way down.'); }
      if (t > 2.4) this.phase = 'play';
    } else if (this.card) { wantDive = false; wantRise = false; sprintWant = false; }
    if (live && !this.hintOff) { this.idleT = dive ? -99 : this.idleT + dt; const on = this.idleT > 3.5 && this.idleT < 60; this.el.hint.textContent = this.ctx.isTouch ? 'HOLD DIVE TO SINK' : 'HOLD SPACE TO DIVE'; this.el.hint.classList.toggle('on', on); if (dive) { this.hintOff = true; this.el.hint.classList.remove('on'); } }
    if (t > 14 && this.el.keys.style.opacity !== '0.35') this.el.keys.style.opacity = '0.35';
    // battery, speed, turn, buoyancy
    const sprint = sprintWant && !s.lock && s.e > 0;
    s.e = sprint ? s.e - 0.16 * dt : Math.min(1, s.e + 0.07 * dt); if (s.e <= 0) { s.e = 0; s.lock = true; } if (s.lock && s.e > 0.3) s.lock = false;
    const ut = this.phase === 'intro' ? (t > 1.2 ? 4 : 0) : this.card ? 2 : sprint ? 17 : 9;
    s.u = damp(s.u, ut, sprint ? 1.5 : 0.9, dt);
    this.steerS = damp(this.steerS, this.phase === 'intro' || this.card ? 0 : inp.steer, 6, dt);
    s.yaw -= this.steerS * 0.95 * (0.55 + 0.45 * Math.min(1, s.u / 9)) * dt;
    const vt = wantDive && wantRise ? 0 : wantDive ? -(this.phase === 'intro' ? 7 : sprint ? 11 : 8) : wantRise ? 8.5 : this.surfaced ? 0 : -0.45;
    s.vy = damp(s.vy, vt, 1.6, dt);
    s.x += Math.sin(s.yaw) * s.u * dt; s.z += Math.cos(s.yaw) * s.u * dt; s.y += s.vy * dt;
    // the surface: bob on the waves; diving breaks free
    const wy = W.waveH(s.x, s.z, t) - 0.35;
    if (s.y >= wy - 0.05 && !wantDive) { if (!this.surfaced && this.phase === 'play') this.onSurface(); this.surfaced = true; s.y = wy; s.vy = Math.max(0, Math.min(s.vy, 0)); }
    if (s.y > wy) s.y = wy;
    if (this.surfaced && s.y < wy - 0.7) this.surfaced = false;
    // floor and props
    this.collide(); s.x = clamp(s.x, -W.BOUND, W.BOUND); s.z = clamp(s.z, -W.BOUND, W.BOUND); s.Y = -s.y;
    const tp = this.surfaced ? clamp(Math.atan2(-(W.waveH(s.x + Math.sin(s.yaw) * 2, s.z + Math.cos(s.yaw) * 2, t) - W.waveH(s.x - Math.sin(s.yaw) * 2, s.z - Math.cos(s.yaw) * 2, t)), 4), -0.2, 0.2) : clamp(Math.atan2(-s.vy, Math.max(s.u, 4)) * 0.85, -0.7, 0.8);
    s.pitch = damp(s.pitch, this.phase === 'intro' && t > 1.1 && t < 2.6 ? 0.62 : tp, 3, dt); s.roll = damp(s.roll, this.steerS * 0.32 * Math.min(1, s.u / 9) + (this.surfaced ? Math.sin(t * 1.7) * 0.05 : 0), 3, dt);
    // splash as the hull goes under
    if (!this.splashed && s.y < -1.0) { this.splashed = true; this.splash(); }
    // depth bookkeeping, milestones, counters, hull
    const d = W.realDepth(s.Y); this.d = d; if (d > this.maxD) this.maxD = d;
    for (const f of this.facts) if (!this.fired.has(f.m) && this.maxD >= f.m) { this.fired.add(f.m); this.queue({ toast: [f.title, `${fmt(f.m)} M · ${f.pressure || Math.round(W.atm(f.m)) + ' ATM'}`], radio: f.fact, big: true }); }
    const cnt = (key, ok) => { if (ok && !this.counted.has(key)) { this.counted.add(key); this.ctx.count(key); } };
    cnt('sub-40m', d >= 40); cnt('sub-200m', d >= 200); cnt('sub-1000m', d >= 1000); cnt('sub-trench', d >= 6000);
    if (!this.counted.has('sub-wreck') && Math.hypot(s.x - W.WRECK.x, s.z - W.WRECK.z) < 60 && s.Y > 360) { cnt('sub-wreck', true); this.label('SHIPWRECK!'); this.say(null, 'An old ocean liner, broken in two. Nobody has touched her in a century. There\'s a sample on her deck.', true); }
    if (d > 1000) { this.creakT -= dt; if (this.creakT <= 0) { this.creakT = lerp(13, 4, d / W.MAXD) + Math.random() * 4; this.creak(0.5 + d / W.MAXD); } }
    if (d > 8000 && this.warned < 1) { this.warned = 1; this.creak(1.4); this.queue({ toast: ['HULL CREAKING', 'SHE\'S FINE. JUST DRAMATIC.'], radio: 'Hear that? The hull is squeezed by over 800 atmospheres. She\'s built for it. Probably.' }); }
    if (d > 10200 && this.warned < 2) { this.warned = 2; this.creak(1.8); this.ctx.audio.alarm(); }
    // set pieces
    if (d >= 650 && this.life.trigger('giant', s)) { this.doPing(true); this.ctx.audio.whoosh(2); }
    if (d >= 1700 && this.life.trigger('whale', s)) { this.clickT = 0; this.doPing(true); }
    if (this.clickT >= 0) { this.clickT += dt; if (A.ctx && this.snd && Math.random() < dt * 5) A.noise(A.ctx.currentTime, 0.012, 0.5, 2600, 'highpass', this.snd.echo); if (this.clickT > 12) this.clickT = -1; }
    // samples and the snack
    for (let i = 0; i < this.cans.length; i++) if (!this.got[i] && this.cans[i].distanceTo(this.v.set(s.x, s.y, s.z)) < 3.4) this.collect(i);
    if (!this.gotSnack && this.life.snack.position.distanceTo(this.v.set(s.x, s.y, s.z)) < 4) this.snackGet();
    // creatures spotted
    this.spotT -= dt; if (this.spotT <= 0) { this.spotT = 0.25; const R = this.ping && this.ping.t < 2.2 ? Math.min(95, this.ping.t * 55) : 26; for (const [id, name, line] of SPECIES) if (!this.spotted.has(id) && this.life.species[id]() < (GLOWS.has(id) ? R * 1.6 : R)) { this.spotted.add(id); this.label(name); this.ctx.audio.chime(9 + this.spotted.size); this.say(null, line, true); } }
    // sonar ping
    this.pingCool = Math.max(0, this.pingCool - dt);
    if (this.ping) { this.ping.t += dt; W.U.uPing.value.w = this.ping.t * 55; W.U.uPingA.value = Math.max(0, 1 - this.ping.t / 2.4); if (this.ping.t > 2.4) { this.ping = null; W.U.uPingA.value = 0; } }
    // bubbles behind the prop, ambient bells
    this.bubT -= dt; if (!this.surfaced && s.Y > 1.5 && this.bubT <= 0) { this.bubT = 0.09 - Math.min(0.06, s.u * 0.003); const b = 0.25 + 0.6 * Math.exp(-d / 60), sx = Math.sin(s.yaw), sz = Math.cos(s.yaw);
      this.fx.emit(s.x - sx * 2.6 + (Math.random() - 0.5) * 0.4, s.y + (Math.random() - 0.5) * 0.4, s.z - sz * 2.6, -sx * 1.5 + (Math.random() - 0.5), 1 + Math.random(), -sz * 1.5 + (Math.random() - 0.5), { life: 1.4, size: 0.16 + Math.random() * 0.12, grow: 0.5, drag: 1.4, grav: -2.2, r: 0.75 * b, g: 0.95 * b, b: 1.05 * b }); }
    if (this.snd) { this.bellT -= dt; if (this.bellT <= 0) { this.bellT = 2.6 + Math.random() * 3.5; const N = [0, 3, 5, 7, 10, 12, 15], n = N[Math.floor(Math.random() * N.length)]; A.tone(330 * Math.pow(2, n / 12) * (d > 1000 ? 0.5 : 1), A.ctx.currentTime, 2.4, 'sine', 0.03, this.snd.echo); } }
    if (d >= 40) this.armed = true;
    if (this.phase === 'play' && this.surfaced && this.armed && !this.card && this.cardAt < 0) { this.armed = false; this.cardAt = t + 1.2; }
    if (this.cardAt > 0 && t >= this.cardAt) { this.cardAt = -1; if (!this.card) this.showCard(this.gotSnack ? 'snack' : 'surface'); }
    // message queue (milestones first; creature lines are dropped when it's busy)
    if (this.q.length && t >= this.qT) { const m = this.q.shift(), rush = m.big && this.q.some((x) => x.big);   // diving fast: show each milestone briefly, speak only the newest
      if (m.toast) this.ctx.hud.toast(m.toast[0], m.toast[1], rush ? 1.4 : 2.4); if (m.radio && !rush) { this.ctx.hud.radio(m.radio, 2.6); this.ctx.audio.voice(m.radio); } if (m.big) { this.ctx.audio.chime(4); this.cam.shake = Math.max(this.cam.shake, 0.25); } this.qT = t + (rush ? 1.5 : 1.6 + (m.radio ? m.radio.length / 30 : 0)); }
    this.labelStep(t); this.shudder = Math.max(0, this.shudder - dt * 1.5);
    this.life.update(dt, t, s); this.fx.update(dt);
  }

  collide() {
    const s = this.s, R = 1.7;
    for (let it = 0; it < 2; it++) {
      const fy = W.floorY(s.x, s.z), h = -fy;
      if (s.y - R < h) {
        const gx = (W.floorY(s.x + 0.6, s.z) - W.floorY(s.x - 0.6, s.z)) / 1.2, gz = (W.floorY(s.x, s.z + 0.6) - W.floorY(s.x, s.z - 0.6)) / 1.2, l = Math.hypot(gx, 1, gz), pen = h - (s.y - R), dd = pen / l;
        s.x += gx / l * dd; s.y += dd / l; s.z += gz / l * dd; if (s.vy < 0) { if (s.vy < -5 && this.phase === 'play') { this.ctx.audio.thud(); this.cam.shake = Math.max(this.cam.shake, 0.3); } s.vy *= 0.2; }
      }
    }
    for (const c of this.life.colliders) {
      if (c.type === 'cyl') { if (s.y < c.y0 || s.y > c.y1 + R) continue; const dx = s.x - c.x, dz = s.z - c.z, dd = Math.hypot(dx, dz), m = c.r + R; if (dd < m && dd > 1e-3) { s.x = c.x + dx / dd * m; s.z = c.z + dz / dd * m; } continue; }
      const cs = Math.cos(c.yaw), sn = Math.sin(c.yaw), dx = s.x - c.x, dz = s.z - c.z, lx = dx * cs - dz * sn, lz = dx * sn + dz * cs, ly = s.y - c.y;
      const qx = clamp(lx, -c.hx, c.hx), qy = clamp(ly, -c.hy, c.hy), qz = clamp(lz, -c.hz, c.hz); let ex = lx - qx, ey = ly - qy, ez = lz - qz, e = Math.hypot(ex, ey, ez);
      if (e >= R) continue; if (e < 1e-4) { ex = 0; ey = 1; ez = 0; e = 0; s.y = c.y + c.hy + R; continue; }
      const push = (R - e) / e; ex *= push; ey *= push; ez *= push; s.x += ex * cs + ez * sn; s.y += ey; s.z += -ex * sn + ez * cs;
    }
  }

  // creature labels: at most 2 at once (newest replaces oldest), 1.6 s each, held while a milestone toast is up, dropped after 4 s of waiting
  label(text, kind = '') { this.lq.push({ text, kind, at: this.t }); }
  labelStep(t) {
    const box = this.el && this.el.labels; if (!box) return; if (this.ctx.hud.toastT > 0) this.toastAt = t; const toastUp = t - (this.toastAt ?? -9) < 0.4;   // 0.4 s for the toast to fade out
    this.live = this.live.filter((l) => { const keep = t - l.t < 1.6 && !toastUp; if (!keep) l.el.remove(); return keep; });
    this.lq = this.lq.filter((l) => t - l.at < 4);
    while (!toastUp && this.lq.length) { const l = this.lq.shift(); if (this.live.length >= 2) this.live.shift().el.remove(); const d = document.createElement('div'); d.textContent = l.text; if (l.kind) d.className = l.kind; box.appendChild(d); this.live.push({ el: d, t }); }
  }
  queue(m) { if (m.big) { const i = this.q.findIndex((x) => !x.big); if (i >= 0) this.q.splice(i, 0, m); else this.q.push(m); } else this.q.push(m); }
  say(toast, line, low) { if (low && (this.q.length > 1 || this.q.some((x) => x.big))) return; this.queue({ toast, radio: line }); }
  doPing(auto) {
    if (this.pingCool > 0 && !auto) return; this.pingCool = 2; const s = this.s; this.ping = { t: 0 }; W.U.uPing.value.set(s.x, s.y, s.z, 0); W.U.uPingA.value = 1;
    this.el && this.el.ping.classList.add('cool'); setTimeout(() => this.el && this.el.ping.classList.remove('cool'), 2000);
    const A = this.ctx.audio; if (A.ctx && this.snd) { const t = A.ctx.currentTime; A.tone(1250, t, 1.5, 'sine', 0.22, this.snd.echo); A.tone(2500, t, 0.25, 'sine', 0.05, this.snd.bus); }
  }
  vent() { const s = this.s; for (let k = 0; k < 26; k++) { const side = k % 2 ? 1 : -1, cs = Math.cos(s.yaw); this.fx.emit(s.x + side * 0.8 * cs, s.y + 0.7, s.z - side * 0.8 * Math.sin(s.yaw), side * cs * (1 + Math.random()), 5 + Math.random() * 4, -side * Math.sin(s.yaw) * (1 + Math.random()), { life: 0.9, size: 0.35, grow: 1.5, drag: 1.5, grav: 7, r: 1, g: 1, b: 1 }); }
    const A = this.ctx.audio; if (A.ctx && this.snd) A.noise(A.ctx.currentTime, 0.8, 0.35, 3500, 'highpass', this.snd.bus); }
  splash() {
    const s = this.s; this.fx.burst(s.x, 0.4, s.z, 46, 8, { life: 1.1, size: 0.5, grow: 1.3, drag: 1.1, grav: 9, r: 1, g: 1, b: 1 }, 1.3);
    this.fx.burst(s.x, -1.8, s.z, 70, 4, { life: 1.6, size: 0.22, grow: 0.6, drag: 1.6, grav: -4, r: 0.85, g: 1, b: 1.05 }, 0.4); this.cam.shake = 0.5;
    const A = this.ctx.audio; if (A.ctx && this.snd) { const t = A.ctx.currentTime; A.noise(t, 0.8, 0.7, 1300, 'lowpass', this.snd.bus); for (let k = 0; k < 14; k++) A.tone(500 + Math.random() * 800, t + 0.1 + k * 0.045, 0.08, 'sine', 0.06, this.snd.bus, 1.9); }
  }
  creak(v) {
    this.cam.shake = Math.max(this.cam.shake, 0.18 * v); this.shudder = Math.min(1, 0.5 * v);
    const A = this.ctx.audio, c = A.ctx; if (!c || !this.snd) return; const t = c.currentTime, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(48, t); o.frequency.linearRampToValueAtTime(74, t + 0.35); o.frequency.linearRampToValueAtTime(42, t + 0.9);
    f.type = 'bandpass'; f.frequency.value = 380; f.Q.value = 7; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22 * Math.min(1.5, v), t + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    o.connect(f); f.connect(g); g.connect(this.snd.bus); o.start(t); o.stop(t + 1.05); A.noise(t, 0.6, 0.06 * v, 260, 'bandpass', this.snd.bus);
  }
  collect(i) {
    this.got[i] = true; this.nGot++; this.haloA[i] = 0; this.halos.geometry.attributes.a.needsUpdate = true; this.canDots[i] && this.canDots[i].classList.add('got');
    const p = this.cans[i]; this.fx.burst(p.x, p.y, p.z, 30, 6, { life: 0.9, size: 0.25, grow: -0.4, drag: 2.5, r: 0.4, g: 1, b: 0.95, add: 1 }, 0);
    this.ctx.audio.chime(this.nGot + 2); this.label(`SAMPLE ${this.nGot}/${this.cans.length}`, 'sun'); this.s.e = Math.min(1, this.s.e + 0.25); this.cam.shake = Math.max(this.cam.shake, 0.2);
  }
  snackGet() {
    this.gotSnack = true; this.ctx.count('sub-snack'); this.ctx.audio.finish(true); this.ctx.hud.toast('YOU FOUND THE SNACK', 'AT THE BOTTOM OF THE WORLD', 3);
    const p = this.life.snack.position; this.fx.burst(p.x, p.y, p.z, 60, 7, { life: 1.4, size: 0.3, grow: -0.3, drag: 2, r: 1, g: 0.8, b: 0.3, add: 1 }, 0); this.life.snackGone = true;
    this.cam.shake = 0.6; this.cardAt = this.t + 2.6;
  }
  onSurface() { const A = this.ctx.audio; if (A.ctx && this.snd) A.noise(A.ctx.currentTime, 0.5, 0.4, 1600, 'lowpass', this.snd.bus); }

  // ---------------------------------------------------------------- result card
  showCard(kind) {
    if (this.card) return; this.card = true; this.finalD = this.maxD; this.el.hint.classList.remove('on');
    const d = this.maxD, deep = this.gotSnack || d >= W.MAXD - 1, brag = deep ? 'CHALLENGER DEEP!' : d < 40 ? 'PADDLING POOL PRO' : d < 200 ? 'SUNLIT SNACKER' : d < 1000 ? 'TWILIGHT TOURIST' : d < 3800 ? 'MIDNIGHT DIVER' : d < 6000 ? 'WRECK HUNTER' : 'HADAL HERO';
    const line = this.gotSnack ? `You found the snack at the bottom of the world, under ${fmt(W.atm(W.MAXD))} atmospheres. Fewer people have been down here than to space.`
      : d >= 8849 ? 'Deeper than Mount Everest is tall. The snack is still down there somewhere.' : d >= 3682 ? 'Deeper than the average ocean (3,682 m). The trench goes much further.'
        : d >= 332 ? 'Deeper than the deepest scuba dive ever (332 m).' : d >= 40 ? 'Past the recreational scuba limit. The bottom is 10,935 m down.' : 'The average ocean is 3,682 m deep. There\'s a snack at the very bottom.';
    this.el.card.innerHTML = `<small>DEEP SNACK · DIVE LOG${kind === 'surface' ? ' · BACK AT THE SURFACE' : ''}</small><h2>${brag}</h2>
      <div class="big">${fmt(d)} M</div><div class="sub">MAX DEPTH · ${fmt(W.atm(d))} ATM</div>
      <div class="st"><div><b>${this.spotted.size}/${SPECIES.length}</b><span>CREATURES</span></div><div><b>${this.nGot}/${this.cans.length}</b><span>SAMPLES</span></div><div><b>${fmtT(this.t)}</b><span>DIVE TIME</span></div></div>
      <p>${line}</p><button class="b1" id="shRetry">DIVE AGAIN</button>${this.gotSnack ? '' : '<button class="b2" id="shKeep">KEEP EXPLORING</button>'}<button class="b3" id="shBack">BACK TO THE CITY</button>`;
    this.el.card.classList.add('on'); this.hud.classList.add('carded'); this.ctx.audio.finish(deep || d >= 1000);
    this.el.card.querySelector('#shRetry').onclick = () => this.retry(); this.el.card.querySelector('#shBack').onclick = () => this.ctx.exit();
    const keep = this.el.card.querySelector('#shKeep'); if (keep) keep.onclick = () => { this.card = false; this.el.card.classList.remove('on'); this.hud.classList.remove('carded'); };
    window.__subCard = { kind, brag, depth: Math.round(d), creatures: this.spotted.size, samples: this.nGot };
  }
  retry() { this.el.card.classList.remove('on'); this.hud.classList.remove('carded'); this.el.card.innerHTML = ''; this.resetRun(); this.ctx.hud.toast('HOW DEEP?', 'THE BOTTOM IS 10,935 M DOWN', 2.4); this.canDots.forEach((d) => d.classList.remove('got')); this.ticks.forEach((d) => d.classList.remove('on')); this.halos.geometry.attributes.a.needsUpdate = true; }

  // ---------------------------------------------------------------- render
  render(dt) {
    const ctx = this.ctx, cam = ctx.camera, s = this.s, t = this.t;
    if (ctx.tier !== this.postTier) { this.postTier = ctx.tier; this.post = ctx.makePost(ctx.renderer, this.scene, cam, ctx.tier); const sz = ctx.renderer.getSize(this.v2); this.post.setSize(sz.x, sz.y, ctx.renderer.getPixelRatio()); }
    W.U.uT.value = t;
    // the sub
    this.subG.position.set(s.x, s.y, s.z); this.subG.rotation.set(s.pitch, s.yaw, s.roll + Math.sin(t * 9) * 0.01 * this.shudder); this.subG.userData.prop.rotation.z += s.u * dt * 2.2;
    // camera: a scripted swing for the intro, then a third-person chase that stays out of the floor and on one side of the waves
    const portrait = cam.aspect < 0.8, fx = Math.sin(s.yaw), fz = Math.cos(s.yaw);
    const back = portrait ? 12.5 : 9.5, up = (portrait ? 3.8 : 2.7) + clamp(-s.vy * 0.22, -1.2, 2.4);
    let tx = s.x - fx * back, tz = s.z - fz * back, ty = s.y + up;
    ty = Math.max(ty, -W.floorY(tx, tz) + 2.2);
    const underwater = !this.surfaced || this.phase === 'intro' && t > 1.3; if (underwater) ty = Math.min(ty, W.waveH(tx, tz, t) - 1.1); else ty = Math.max(ty, 2.4);
    const c = this.cam;
    if (this.phase === 'intro') {
      const a = 0.75 - t * 0.22, ix = s.x + Math.sin(s.yaw + a) * 8.5, iz = s.z + Math.cos(s.yaw + a) * 8.5, iy = 1.9, w = smooth(1.05, 2.35, t);
      c.x = lerp(ix, tx, w); c.y = lerp(iy, ty, w); c.z = lerp(iz, tz, w); if (t > 1.3) c.y = Math.min(c.y, W.waveH(c.x, c.z, t) - 1.1);
    } else { c.x = damp(c.x, tx, 4, dt); c.z = damp(c.z, tz, 4, dt); c.y = damp(c.y, ty, 3.2, dt); if (underwater) c.y = Math.min(c.y, W.waveH(c.x, c.z, t) - 1.1); else c.y = Math.max(c.y, 2.0); c.y = Math.max(c.y, -W.floorY(c.x, c.z) + 1.6); }
    c.shake = Math.max(c.shake * Math.exp(-4 * dt), this.shudder * 0.25);
    const sh = c.shake, n1 = Math.sin(t * 37) + Math.sin(t * 23.7), n2 = Math.sin(t * 31.3) + Math.sin(t * 19.1);
    cam.position.set(c.x + n1 * sh * 0.1 + Math.sin(t * 0.6) * 0.12, c.y + n2 * sh * 0.08 + Math.sin(t * 0.83) * 0.1, c.z);
    const look = this.phase === 'intro' ? 1 - smooth(1.05, 2.35, t) : 0;
    cam.lookAt(s.x + fx * 4 * (1 - look), s.y + 0.5 - (1 - look) * clamp(-s.vy * 0.15, -1, 1.6), s.z + fz * 4 * (1 - look));
    cam.fov = damp(cam.fov, (portrait ? 70 : 60) + Math.max(0, s.u - 9) * 0.5, 3, dt); cam.near = 0.3; cam.far = 3000; cam.updateProjectionMatrix();
    // water and light by depth
    const above = cam.position.y > W.waveH(cam.position.x, cam.position.z, t) + 0.02, dc = W.realDepth(-cam.position.y), d = this.d || 0;
    if (above !== this.wasAbove && t > 0.5) { this.wasAbove = above; this.el.wipe.classList.remove('go'); void this.el.wipe.offsetWidth; this.el.wipe.classList.add('go'); }
    this.wasAbove = above;
    const wc = waterCol(Math.max(0, dc), this.c);
    if (above) { this.scene.fog.color.setRGB(0.55, 0.68, 0.78); this.scene.fog.density = 0.0008; this.scene.background = null; }
    else { this.scene.fog.color.copy(wc); this.scene.fog.density = lerp(0.011, 0.0125, smooth(40, 1000, dc)); this.bg.copy(this.scene.fog.color); this.scene.background = this.bg; }
    this.sky.visible = above; this.sky.position.copy(cam.position);
    const sd = above ? 0 : dc; this.sunL.color.setRGB(Math.exp(-sd / 9), Math.exp(-sd / 28), Math.exp(-sd / 75)); this.sunL.intensity = 2.3;
    this.hemi.color.copy(above ? this.c2.setRGB(0.75, 0.9, 1.05) : this.c2.copy(wc).multiplyScalar(2.4)); this.hemi.groundColor.copy(this.c2).multiplyScalar(0.3); this.hemi.intensity = above ? 1.1 : 1.3;
    const sn = this.drift.snow.material.uniforms, gl = this.drift.glow.material.uniforms, dark = smooth(60, 400, d); this.spot.intensity = dark * 150; this.beam.material.uniforms.uA.value = dark; this.hull.intensity = 2 + 8 * dark;
    this.hemi.color.r = Math.max(this.hemi.color.r, 0.035); this.hemi.color.g = Math.max(this.hemi.color.g, 0.055); this.hemi.color.b = Math.max(this.hemi.color.b, 0.1);   // a faint blue so silhouettes read in the dark
    for (const u of [sn, gl]) { u.uLamp.value.copy(this.beam.getWorldPosition(this.v)); u.uLdir.value.set(0, -0.14, 1).applyQuaternion(this.subG.quaternion).normalize(); u.uLampOn.value = dark; }
    W.U.uAbove.value = above ? 1 : 0; W.U.uWCol.value.setRGB(0.05, 0.42, 0.52); W.U.uCaus.value = above ? 0.5 : (1 - smooth(0, 50, dc)) * 0.9; W.U.uCausCol.value.setRGB(0.55, 0.95, 1.0);
    const sm = this.surface.mat.uniforms; this.surface.m.position.set(Math.round(cam.position.x / 6.4) * 6.4, 0, Math.round(cam.position.z / 6.4) * 6.4); this.surface.m.visible = cam.position.y > -160;
    sm.uUnder.value.copy(waterCol(0, this.c2)).multiplyScalar(1.15);
    this.shafts.m.visible = !above && dc < 90; if (this.shafts.m.visible) { this.shafts.mat.uniforms.uI.value = 1 - smooth(5, 85, dc); this.shafts.update(cam.position); }
    this.drift.snow.visible = this.drift.glow.visible = !above;
    sn.uCol.value.setRGB(0.75, 0.85, 0.9).multiplyScalar(0.4 + 0.6 * Math.exp(-dc / 200) + 0.5 * dark); sn.uA.value = 0.35; sn.uFall.value = 0.25 + dark * 0.2;
    gl.uCol.value.setRGB(0.25, 1.2, 0.9); gl.uA.value = smooth(150, 700, dc) * 0.9; gl.uFall.value = 0.05;
    this.terrain.cull(cam.position, above ? 260 : Math.min(260, 2.6 / this.scene.fog.density));
    // canisters bob and spin; the beacon points at the next one (or the snack)
    let next = -1; for (let i = 0; i < this.cans.length; i++) if (!this.got[i]) { next = i; break; }
    if (!this._mb) { this._mb = new THREE.Matrix4(); this._mo = [new THREE.Matrix4().makeTranslation(0, -0.28, 0), new THREE.Matrix4().makeTranslation(0, 0.28, 0)]; }
    for (let i = 0; i < this.cans.length; i++) { const p = this.cans[i]; this.O.position.set(p.x, p.y + Math.sin(t * 1.5 + i) * 0.25, p.z); this.O.rotation.set(0.3, t * 0.8 + i, 0.2); this.O.scale.setScalar(this.got[i] ? 0 : 1); this.O.updateMatrix(); this.canBody.setMatrixAt(i, this.O.matrix);
      for (const k of [0, 1]) this.canBand.setMatrixAt(i * 2 + k, this._mb.multiplyMatrices(this.O.matrix, this._mo[k])); }
    this.canBody.instanceMatrix.needsUpdate = true; this.canBand.instanceMatrix.needsUpdate = true;
    const tgt = next >= 0 ? this.cans[next] : this.gotSnack ? null : this.life.snack.position;
    if (tgt && this.phase === 'play' && !this.card) { const dd = tgt.distanceTo(cam.position); this.beacon.visible = dd > 9; this.beacon.position.copy(tgt); this.beacon.scale.setScalar(dd * (0.045 + 0.008 * Math.sin(t * 5))); } else this.beacon.visible = false;
    // HUD
    this.hudUpdate(d, tgt);
    // audio
    this.audioUpdate(dt, d, above);
    if (this.post.uniforms) {
      const u = this.post.uniforms; this.v.copy(W.SUN_DIR).multiplyScalar(2000).add(cam.position).project(cam); u.sun.value.set(this.v.x * 0.5 + 0.5, this.v.y * 0.5 + 0.5);
      u.sunVis.value = above && this.v.z < 1 && Math.abs(this.v.x) < 1.2 && Math.abs(this.v.y) < 1.2 ? 1 : 0; u.time.value = (t % 10) + 1; u.speed.value = Math.max(0, (s.u - 10) / 7) * 0.35; u.hit.value = this.shudder * 0.6;
    }
    this.post.render();
  }

  hudUpdate(d, tgt) {
    const s = this.s, el = this.el, set = (k, v, e, prop = 'textContent') => { if (this.cache[k] !== v) { this.cache[k] = v; e[prop] = v; } };
    set('m', `${fmt(d)} M`, el.m); const a = W.atm(d); set('a', `${a < 100 ? a.toFixed(1) : fmt(a)} ATM`, el.a); set('z', W.zoneName(d), el.z);
    const fr = clamp(s.Y / W.MAXY, 0, 1); set('me', (fr * 100).toFixed(2) + '%', el.lad.querySelector('.me').style, 'top'); set('fill', (clamp(W.worldY(this.maxD) / W.MAXY, 0, 1) * 100).toFixed(1) + '%', el.fill.style, 'height');
    this.ticks.forEach((tk, i) => { const on = this.fired.has(this.facts[i].m); if (tk._on !== on) { tk._on = on; tk.classList.toggle('on', on); } });
    const stress = clamp(d / W.MAXD, 0, 1); set('hull', (stress * 100).toFixed(1) + '%', el.hullI.style, 'width'); const warn = d > 8000; if (this.cache.warn !== warn) { this.cache.warn = warn; el.hull.classList.toggle('warn', warn); }
    set('bat', (s.e * 100).toFixed(1) + '%', el.batI.style, 'width'); if (this.cache.lock !== s.lock) { this.cache.lock = s.lock; el.bat.classList.toggle('lock', s.lock); }
    this.ctx.hud.boost && this.ctx.hud.boost(s.e, s.lock, s.u > 10);
    // compass (north = -z, the way to the trench)
    const head = Math.atan2(Math.sin(s.yaw), -Math.cos(s.yaw)), tb = tgt ? Math.atan2(tgt.x - s.x, -(tgt.z - s.z)) : null;
    if (Math.abs(head - this.compHead) > 0.003 || tb !== null && Math.abs(tb - (this.compT || 0)) > 0.01 || this.compT === undefined) { this.compHead = head; this.compT = tb; this.drawCompass(head, tb); }
  }
  drawCompass(head, tb) {
    const cv = this.el.comp, dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr); if (w < 20) return;
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    const g = cv.getContext('2d'), span = 2.1, px = (a) => w / 2 + (((a - head + Math.PI * 3) % (Math.PI * 2)) - Math.PI) / span * w;
    g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(20,26,58,.74)'; g.beginPath(); if (g.roundRect) g.roundRect(0, 0, w, h, h / 2); else g.rect(0, 0, w, h); g.fill();
    g.save(); g.beginPath(); if (g.roundRect) g.roundRect(0, 0, w, h, h / 2); else g.rect(0, 0, w, h); g.clip();
    g.strokeStyle = 'rgba(255,244,230,.55)'; g.lineWidth = 1.5 * dpr; g.fillStyle = '#fff4e6'; g.font = `900 ${11 * dpr}px Montserrat, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k < 24; k++) { const a = k * Math.PI / 12, x = px(a); if (x < -10 || x > w + 10) continue; if (k % 6 === 0) { g.fillStyle = k === 0 ? '#ffd84d' : '#fff4e6'; g.fillText('NESW'[k / 6], x, h / 2); } else { g.beginPath(); g.moveTo(x, h * 0.3); g.lineTo(x, h * 0.7); g.stroke(); } }
    if (tb !== null) { let x = px(tb); const off = x < 6 * dpr || x > w - 6 * dpr; x = clamp(x, 7 * dpr, w - 7 * dpr); g.fillStyle = '#7ae8ff'; g.beginPath(); const r = 6 * dpr, y = h / 2; if (off) { const dir = x < w / 2 ? -1 : 1; g.moveTo(x + dir * r, y); g.lineTo(x - dir * r * 0.6, y - r); g.lineTo(x - dir * r * 0.6, y + r); } else { g.moveTo(x, y - r); g.lineTo(x + r, y); g.lineTo(x, y + r); g.lineTo(x - r, y); } g.closePath(); g.fill(); }
    g.restore(); g.fillStyle = '#ffd84d'; g.beginPath(); g.moveTo(w / 2 - 5 * dpr, 0); g.lineTo(w / 2 + 5 * dpr, 0); g.lineTo(w / 2, 6 * dpr); g.closePath(); g.fill();
  }

  // ---------------------------------------------------------------- sound: drone, propeller hum, echo bus; muffled with depth
  startAudio() {
    const A = this.ctx.audio, c = A && A.ctx; if (!c || this.snd) return;
    this.musicWas = A.music; A.music = false; try { if (A.eg) { A.eg.disconnect(); this.egOff = true; } } catch (e) { /* ok */ }
    const bus = c.createGain(), lp = c.createBiquadFilter(); bus.gain.value = 0; lp.type = 'lowpass'; lp.frequency.value = 6000; bus.connect(lp); lp.connect(A.master); bus.gain.setTargetAtTime(1, c.currentTime, 0.4);
    const echo = c.createGain(), dl = c.createDelay(1), fb = c.createGain(); dl.delayTime.value = 0.38; fb.gain.value = 0.38; echo.connect(bus); echo.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(bus);
    const osc = (type, f, g) => { const o = c.createOscillator(), gn = c.createGain(); o.type = type; o.frequency.value = f; gn.gain.value = g; o.connect(gn); o.start(); return { o, gn }; };
    const d1 = osc('sine', 55, 0.05), d2 = osc('triangle', 82.4, 0.025), droneG = c.createGain(); droneG.gain.value = 0; d1.gn.connect(droneG); d2.gn.connect(droneG); droneG.connect(bus);
    const ns = c.createBufferSource(); ns.buffer = A.noiseBuf; ns.loop = true; const nf = c.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 260; const ng = c.createGain(); ng.gain.value = 0; ns.connect(nf); nf.connect(ng); ng.connect(bus); ns.start();
    const po = c.createOscillator(); po.type = 'sawtooth'; po.frequency.value = 70; const pf = c.createBiquadFilter(); pf.type = 'lowpass'; pf.frequency.value = 360; const pg = c.createGain(); pg.gain.value = 0;
    const am = c.createGain(); am.gain.value = 0.6; const lfo = c.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 9; const lg = c.createGain(); lg.gain.value = 0.4; lfo.connect(lg); lg.connect(am.gain);
    po.connect(pf); pf.connect(am); am.connect(pg); pg.connect(bus); po.start(); lfo.start();
    this.snd = { bus, lp, echo, droneG, d1, d2, ng, nf, po, pg, lfo, ns, all: [d1.o, d2.o, ns, po, lfo] };
  }
  audioUpdate(dt, d, above) {
    const S = this.snd; if (!S) return; const c = this.ctx.audio.ctx, t = c.currentTime, s = this.s;
    S.lp.frequency.setTargetAtTime(above ? 9000 : lerp(2600, 800, smooth(0, 2500, d)), t, 0.15);
    S.droneG.gain.setTargetAtTime(above ? 0.2 : 0.8 + 0.8 * smooth(0, 3000, d), t, 0.4); S.d1.o.frequency.setTargetAtTime(55 - 12 * smooth(0, 10000, d), t, 0.5);
    S.ng.gain.setTargetAtTime(above ? 0.22 : 0.1, t, 0.3); S.nf.frequency.setTargetAtTime(above ? 900 : 260, t, 0.3);
    S.po.frequency.setTargetAtTime(55 + s.u * 4.5, t, 0.1); S.lfo.frequency.setTargetAtTime(3 + s.u * 0.9, t, 0.1); S.pg.gain.setTargetAtTime(this.card ? 0.01 : 0.025 + s.u * 0.004, t, 0.15);
  }
  stopAudio() {
    const A = this.ctx.audio, S = this.snd; if (A) { if (this.musicWas !== undefined) A.music = this.musicWas; if (this.egOff) { try { A.eg.connect(A.sfx); } catch (e) { /* ok */ } this.egOff = false; } if (A.ctx && A.musicBus) A.nextBeat = A.ctx.currentTime + 0.1; }
    if (!S) return; this.snd = null; const c = A.ctx; S.bus.gain.setTargetAtTime(0, c.currentTime, 0.12);
    setTimeout(() => { for (const n of S.all) { try { n.stop(); } catch (e) { /* ok */ } } try { S.lp.disconnect(); } catch (e) { /* ok */ } }, 700);
  }

  stop() { this.stopAudio(); this.card = false; W.U.uPingA.value = 0; this.ping = null; if (this.el) this.el.hint.classList.remove('on'); this.ctx.ui.innerHTML = ''; this.el = null; }
}
