// DEEP SNACK world: the compressed depth scale, the sea floor (one function, chunked mesh), the sea surface seen from above and below,
// the sky, god rays, drifting plankton and marine snow, and the shared shader patch (caustics, sonar ring, colour absorption seen from above).
import * as THREE from 'three';
import { clamp, lerp, smooth, makeRng, canvas, tex, radial } from '../util.js';

// ---------------------------------------------------------------- depth: world units Y (positive down) to real metres. Piecewise so every zone gets screen time.
export const DMAP = [[0, 0], [40, 40], [75, 200], [160, 1000], [250, 2000], [400, 3800], [420, 4400], [470, 6000], [800, 10935]];
export const MAXY = 800, MAXD = 10935;
export function realDepth(Y) {
  if (Y <= 0) return 0;
  for (let i = 1; i < DMAP.length; i++) if (Y <= DMAP[i][0]) { const [y0, d0] = DMAP[i - 1], [y1, d1] = DMAP[i]; return d0 + (d1 - d0) * (Y - y0) / (y1 - y0); }
  return MAXD;
}
export function worldY(d) {
  if (d <= 0) return 0;
  for (let i = 1; i < DMAP.length; i++) if (d <= DMAP[i][1]) { const [y0, d0] = DMAP[i - 1], [y1, d1] = DMAP[i]; return y0 + (y1 - y0) * (d - d0) / (d1 - d0); }
  return MAXY;
}
export const atm = (d) => 1 + (1025 * 9.80665 * d) / 101325;   // hydrostatic, same formula as js/oceanfacts.js (about 1 atm per 10.08 m)
export const ZONES = [[0, 'SUNLIGHT ZONE'], [200, 'TWILIGHT ZONE'], [1000, 'MIDNIGHT ZONE'], [4000, 'THE ABYSS'], [6000, 'HADAL ZONE']];
export const zoneName = (d) => { let n = ZONES[0][1]; for (const [m, s] of ZONES) if (d >= m) n = s; return n; };

// ---------------------------------------------------------------- layout (x, z in metres; the dive heads toward -z)
export const REEF = { x: 0, z: 200 }, WRECK = { x: 42, z: -178, yaw: 0.55 }, VENTS = { x: -70, z: -228 }, TRENCH_Z = -340, SNACK = { x: 0, z: -800 };
export const START = { x: 0, z: 150, yaw: Math.PI }, BOUND = 1150, EXTENT = 1200;
const n2 = (x, z) => Math.sin(x * 0.071 + Math.sin(z * 0.053) * 1.7) * Math.cos(z * 0.067 + Math.sin(x * 0.041) * 1.3);
const n3 = (x, z) => Math.sin(x * 0.23 + 1.7) * Math.sin(z * 0.19 + 0.4) + 0.5 * Math.sin(x * 0.51 + z * 0.37);
// depth of the sea floor (world units, positive down)
export function floorY(x, z) {
  const r = Math.hypot(x - REEF.x, z - REEF.z), tp = clamp((-z - 130) / 130, 0, 1);
  const P = 400 + 20 * tp * tp * (3 - 2 * tp) + 3 * n2(x, z) * smooth(330, 420, r);           // the plain deepens toward the trench
  let Y = lerp(13 + 1.4 * n3(x, z) + 0.8 * n2(x * 2.3, z * 2.3), 36 + 2 * n3(x, z), smooth(92, 112, r));   // reef top and its slope
  Y = lerp(Y, 130 + 6 * n2(x * 1.3, z), smooth(111, 124, r));                                  // the drop-off wall
  Y = lerp(Y, P, smooth(124, 330, r));                                                          // the steep slope to the abyssal plain
  const k = (1 - smooth(22, 92, Math.abs(x))) * smooth(-230, -700, z) * (1 - smooth(-960, -1120, z));   // the trench runs north (-z), deepening to the Challenger Deep
  if (k > 0) Y = Math.max(Y, lerp(P, 802, k) + 14 * n2(x * 1.9, z * 1.9) * k * (1 - k));       // rugged walls, flat floor at 802
  return Y;
}

// ---------------------------------------------------------------- shared shader patch: animation snippet, caustics, sonar ring, underwater tint seen from above
export const U = { uT: { value: 0 }, uPing: { value: new THREE.Vector4(0, 0, 0, -1) }, uPingA: { value: 0 }, uCaus: { value: 0 }, uCausCol: { value: new THREE.Color(1, 1, 1) }, uAbove: { value: 0 }, uWCol: { value: new THREE.Color(0.1, 0.5, 0.6) } };
const CAUS = `float caus(vec2 q, float t){ vec2 p = mod(q, 6.28318) - 250.0; vec2 i = p; float c = 1.0;
  for (int n = 0; n < 3; n++) { float tt = t * (1.0 - (3.5 / float(n + 1))); i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x)); c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / 0.005), p.y / (cos(i.y + tt) / 0.005))); }
  c /= 3.0; c = 1.17 - pow(c, 1.4); return pow(abs(c), 8.0); }\n`;
export function patch(mat, { anim = '', caustic = false, ping = true, above = true } = {}) {
  mat.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, U);
    s.vertexShader = 'uniform float uT; varying vec3 vSW;\n' + s.vertexShader
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nfloat phase = 0.0;\n#ifdef USE_INSTANCING\nphase = float(gl_InstanceID) * 1.618;\n#endif\n${anim}`)
      .replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 sw = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nsw = instanceMatrix * sw;\n#endif\nvSW = (modelMatrix * sw).xyz; }');
    let f = 'uniform float uT, uCaus, uPingA, uAbove; uniform vec4 uPing; uniform vec3 uCausCol, uWCol; varying vec3 vSW;\n' + (caustic ? CAUS : '') + s.fragmentShader;
    if (caustic) f = f.replace('#include <opaque_fragment>', `{ float up = max(dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)), 0.0);
      outgoingLight += uCausCol * caus(vSW.xz * 0.11, uT * 0.55) * uCaus * up * exp(-max(-vSW.y, 0.0) / 16.0); }\n#include <opaque_fragment>`);
    f = f.replace('#include <fog_fragment>', `#include <fog_fragment>
      ${above ? 'gl_FragColor.rgb = mix(gl_FragColor.rgb, uWCol, uAbove * (1.0 - exp(-max(-vSW.y, 0.0) * 0.06)));' : ''}
      ${ping ? 'if (uPingA > 0.0) { float pd = distance(vSW, uPing.xyz); float ring = exp(-pow((pd - uPing.w) / 2.4, 2.0)); float ins = step(pd, uPing.w) * exp(-(uPing.w - pd) * 0.07); gl_FragColor.rgb += vec3(0.25, 1.0, 0.85) * (ring * 1.5 + ins * 0.3) * uPingA; }' : ''}`);
    s.fragmentShader = f;
  };
  mat.customProgramCacheKey = () => `sub|${caustic}|${ping}|${above}|${anim}`;
  return mat;
}
export const lambert = (opts = {}, flags = {}) => patch(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, ...opts }), flags);

// ---------------------------------------------------------------- the sea floor: one heightfield in chunks (frustum + distance culled)
const CELL = 8, CH = 25;
export function buildTerrain(scene) {
  const mat = lambert({}, { caustic: true }), chunks = [], N = Math.round(EXTENT * 2 / CELL / CH);
  const sand = new THREE.Color(0xf0dcaa), rock = new THREE.Color(0x8c7fae), silt = new THREE.Color(0x6e6c86), basalt = new THREE.Color(0x4c4864), c = new THREE.Color();
  for (let ci = 0; ci < N; ci++) for (let cj = 0; cj < N; cj++) {
    const x0 = -EXTENT + ci * CH * CELL, z0 = -EXTENT + cj * CH * CELL, V = CH + 1, P = new Float32Array(V * V * 3), C = new Float32Array(V * V * 3), I = [];
    let ymin = 1e9, ymax = -1e9;
    for (let j = 0; j < V; j++) for (let i = 0; i < V; i++) {
      const x = x0 + i * CELL, z = z0 + j * CELL, Y = floorY(x, z), k = (j * V + i) * 3, sl = Math.min(1, Math.abs(floorY(x + 3, z) - floorY(x - 3, z)) / 6 + Math.abs(floorY(x, z + 3) - floorY(x, z - 3)) / 6);
      P[k] = x; P[k + 1] = -Y; P[k + 2] = z; ymin = Math.min(ymin, -Y); ymax = Math.max(ymax, -Y);
      c.copy(Y < 30 ? sand : Y < 380 ? rock : Y < 430 ? silt : basalt);
      if (Y < 30) c.lerp(rock, smooth(0.25, 0.9, sl)); else if (Y > 380 && Y < 430) c.lerp(rock, smooth(0.3, 1, sl) * 0.6);
      const sh = 0.9 + 0.1 * Math.sin(x * 0.7 + z * 0.43); C[k] = c.r * sh; C[k + 1] = c.g * sh; C[k + 2] = c.b * sh;
    }
    for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) { const a = j * V + i, b = a + 1, d = a + V, e = d + 1; I.push(a, d, b, b, d, e); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3)); g.setIndex(I); g.computeVertexNormals(); g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; scene.add(m);
    chunks.push({ m, box: new THREE.Box3(new THREE.Vector3(x0, ymin, z0), new THREE.Vector3(x0 + CH * CELL, ymax, z0 + CH * CELL)) });
  }
  const p = new THREE.Vector3();
  return { chunks, mat, cull(cam, dist) { for (const ch of chunks) ch.m.visible = ch.box.distanceToPoint(p.copy(cam)) < dist; } };
}

// ---------------------------------------------------------------- the sea surface (follows the camera, snapped), seen from above or from below
export const SUN_DIR = new THREE.Vector3(0.35, 0.8, -0.5).normalize();
const WV = `float wv(vec2 p){ return 0.28 * sin(p.x * 0.21 + uT * 1.3) + 0.22 * sin(p.y * 0.17 - uT * 1.1 + p.x * 0.05) + 0.12 * sin((p.x + p.y) * 0.43 + uT * 2.1); }`;
export const waveH = (x, z, t) => 0.28 * Math.sin(x * 0.21 + t * 1.3) + 0.22 * Math.sin(z * 0.17 - t * 1.1 + x * 0.05) + 0.12 * Math.sin((x + z) * 0.43 + t * 2.1);
export function buildSurface(scene) {
  const geo = new THREE.PlaneGeometry(700, 700, 110, 110).rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uSky: { value: new THREE.Color(0.45, 0.62, 0.75) }, uDeep: { value: new THREE.Color(0.02, 0.26, 0.34) }, uWin: { value: new THREE.Color(0.7, 1.05, 1.15) }, uUnder: { value: new THREE.Color(0.05, 0.4, 0.5) }, uSun: { value: SUN_DIR } }]),
    vertexShader: `uniform float uT; varying vec3 vW, vN; ${WV}
      #include <fog_pars_vertex>
      void main(){ vec4 w = modelMatrix * vec4(position, 1.0); float h = wv(w.xz), e = 0.6, hx = wv(w.xz + vec2(e, 0.0)) - h, hz = wv(w.xz + vec2(0.0, e)) - h;
        w.y += h; vN = normalize(vec3(-hx / e, 1.0, -hz / e)); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 uSky, uDeep, uWin, uUnder, uSun; uniform float uT; varying vec3 vW, vN;
      #include <fog_pars_fragment>
      void main(){ vec3 v = normalize(vW - cameraPosition), n = normalize(vN); vec3 col; float a = 1.0;
        if (cameraPosition.y > vW.y) {   // from above: tint, fresnel to the sky, sun glints
          float fr = pow(1.0 - max(dot(-v, n), 0.0), 3.0); vec3 r = reflect(v, n); float sp = pow(max(dot(r, uSun), 0.0), 220.0);
          float sparkle = step(0.985, fract(sin(dot(floor(vW.xz * 1.7), vec2(12.9898, 78.233))) * 43758.5453)) * pow(max(dot(r, uSun), 0.0), 8.0);
          col = mix(uDeep, uSky, 0.12 + 0.88 * fr) + (sp * 5.0 + sparkle * 2.0) * vec3(1.0, 0.92, 0.75); a = 0.5 + 0.5 * fr;
        } else {                         // from below: Snell's window (48.6 deg) with a rippling, sunlit edge
          float c = -dot(v, vec3(0.0, -1.0, 0.0)) + (n.x + n.z) * 0.5;
          float win = smoothstep(0.6, 0.7, c), rip = 0.5 + 0.5 * sin(vW.x * 0.9 + n.x * 30.0 + uT) * sin(vW.z * 0.8 - n.z * 30.0 - uT * 0.7);
          col = mix(uUnder * (0.8 + 0.6 * rip), uWin * (0.75 + 0.5 * rip), win) + vec3(2.5, 2.3, 1.8) * pow(max(dot(-v, uSun), 0.0), 60.0) * win;
        }
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
    side: THREE.DoubleSide, transparent: true, fog: true,
  });
  mat.uniforms.uT = U.uT;
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 5; scene.add(m); return { m, mat };
}

// ---------------------------------------------------------------- sky dome and flat-vector clouds (only drawn while the camera is above water)
export function buildSky(scene) {
  const g = new THREE.Group();
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), new THREE.ShaderMaterial({
    uniforms: { uSun: { value: SUN_DIR } }, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform vec3 uSun; varying vec3 vD; void main(){ float y = vD.y; vec3 top = vec3(0.1, 0.34, 0.95), hor = vec3(0.55, 0.72, 0.85), sea = vec3(0.03, 0.22, 0.32);
      vec3 c = y > 0.0 ? mix(hor, top, pow(clamp(y, 0.0, 1.0), 0.55)) : mix(hor * 0.7, sea, smoothstep(0.0, -0.06, y));
      float s = max(dot(vD, uSun), 0.0); c += vec3(6.0, 5.0, 3.6) * smoothstep(0.9993, 0.9996, s) + vec3(0.6, 0.4, 0.2) * pow(s, 18.0);
      gl_FragColor = vec4(c, 1.0); }`,
  }));
  dome.renderOrder = -10; g.add(dome);
  const cv = canvas(256, 128), x = cv.getContext('2d');
  for (const [cx, cy, r, col] of [[70, 82, 34, '#dfe8f5'], [118, 70, 46, '#dfe8f5'], [176, 84, 32, '#dfe8f5'], [70, 76, 32, '#fff'], [118, 62, 44, '#fff'], [174, 78, 30, '#fff']]) { x.fillStyle = col; x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
  x.fillStyle = '#dfe8f5'; x.fillRect(40, 84, 170, 30); x.fillStyle = '#fff'; x.fillRect(40, 80, 168, 26);
  const cm = new THREE.SpriteMaterial({ map: tex(cv, { repeat: false }), fog: false, depthWrite: false, color: new THREE.Color(0.85, 0.85, 0.9) });
  const r = makeRng(5);
  for (let i = 0; i < 7; i++) { const s = new THREE.Sprite(cm), a = START.yaw + (i - 3) * 0.55 + r.range(-0.2, 0.2), d = 1500; s.position.set(Math.sin(a) * d, r.range(180, 380), Math.cos(a) * d); s.scale.set(r.range(380, 620), 0, 1); s.scale.y = s.scale.x / 2; s.renderOrder = -9; g.add(s); }
  scene.add(g); return g;
}

// ---------------------------------------------------------------- god rays: tall additive planes billboarded round their vertical axis, on a world grid around the camera
export function buildShafts(scene) {
  const N = 14, geo = new THREE.PlaneGeometry(1, 1).translate(0, -0.5, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uT: U.uT, uI: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    vertexShader: `uniform float uT; varying vec2 vUv; varying float vF;
      void main(){ vec3 c = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz; float w = length(instanceMatrix[0].xyz), h = length(instanceMatrix[1].xyz);
        vec3 tc = cameraPosition - c; tc.y = 0.0; vec3 rt = normalize(vec3(tc.z, 0.0, -tc.x) + 1e-4);
        vec3 p = c + rt * position.x * w * (1.0 - position.y * 0.6) + vec3(0.0, position.y * h, 0.0); p.x -= position.y * h * 0.22; p.z += position.y * h * 0.3;
        vUv = uv; vF = (0.65 + 0.35 * sin(uT * 0.8 + c.x * 0.3 + c.z * 0.17)) * smoothstep(110.0, 35.0, distance(cameraPosition.xz, c.xz)); gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0); }`,
    fragmentShader: `uniform float uI; varying vec2 vUv; varying float vF; void main(){ float x = 1.0 - abs(vUv.x * 2.0 - 1.0); gl_FragColor = vec4(vec3(0.55, 0.9, 1.0) * x * x * pow(vUv.y, 1.6) * vF * uI * 0.32, 1.0); }`,
  });
  const m = new THREE.InstancedMesh(geo, mat, N); m.frustumCulled = false; m.renderOrder = 4; scene.add(m);
  const o = new THREE.Object3D(), G = 34;
  return { m, mat, update(cam) {
    const gx = Math.floor(cam.x / G), gz = Math.floor(cam.z / G); let k = 0;
    for (let i = -2; i <= 2 && k < N; i++) for (let j = -2; j <= 2 && k < N; j++) {
      const cx = gx + i, cz = gz + j, h = Math.abs(Math.sin(cx * 127.1 + cz * 311.7) * 43758.5) % 1; if (h < 0.35) continue;
      o.position.set((cx + h) * G, 0, (cz + ((h * 7.3) % 1)) * G); o.scale.set(4 + h * 9, 55 + h * 40, 1); o.updateMatrix(); m.setMatrixAt(k++, o.matrix);
    }
    m.count = k; m.instanceMatrix.needsUpdate = true;
  } };
}

// ---------------------------------------------------------------- particles that live in a box wrapped round the camera: plankton glow (additive) and marine snow
export function buildDrift(scene) {
  const mk = (n, box, additive, seed) => {
    const r = makeRng(seed), P = new Float32Array(n * 3), S = new Float32Array(n);
    for (let i = 0; i < n; i++) { P[i * 3] = r() * box; P[i * 3 + 1] = r() * box; P[i * 3 + 2] = r() * box; S[i] = r(); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('seed', new THREE.BufferAttribute(S, 1)); g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    const mat = new THREE.ShaderMaterial({
      uniforms: { uT: U.uT, uCol: { value: new THREE.Color(1, 1, 1) }, uA: { value: 1 }, uScale: { value: 600 }, uFall: { value: 0.3 }, uBox: { value: box }, uLamp: { value: new THREE.Vector3() }, uLdir: { value: new THREE.Vector3(0, 0, 1) }, uLampOn: { value: 0 } },
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false,
      vertexShader: `uniform float uT, uScale, uFall, uBox, uLampOn; uniform vec3 uLamp, uLdir; attribute float seed; varying float vA, vL;
        void main(){ vec3 p = position; p.y -= uT * uFall * (0.5 + seed); p.x += sin(uT * 0.3 + seed * 20.0) * 1.5;
          p = mod(p - cameraPosition + uBox * 0.5, uBox) - uBox * 0.5 + cameraPosition;
          vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z; vA = smoothstep(uBox * 0.5, uBox * 0.3, d) * smoothstep(0.5, 2.0, d) * (0.5 + 0.5 * sin(uT * (1.0 + seed * 2.0) + seed * 40.0));
          vec3 q = p - uLamp; float al = dot(q, uLdir), pp = length(q - uLdir * al); vL = uLampOn * step(0.0, al) * smoothstep(al * 0.32 + 0.8, 0.0, pp) * smoothstep(42.0, 4.0, al);
          gl_PointSize = (0.06 + seed * 0.08) * uScale / max(d, 0.5); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: 'uniform vec3 uCol; uniform float uA; varying float vA, vL; void main(){ vec2 d = gl_PointCoord - 0.5; float r = 1.0 - dot(d, d) * 4.0; if (r <= 0.0) discard; gl_FragColor = vec4(uCol + vec3(1.0, 0.95, 0.85) * vL * 1.6, r * vA * min(1.0, uA + vL)); }',
    });
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; scene.add(pts); return pts;
  };
  return { snow: mk(700, 46, false, 11), glow: mk(420, 60, true, 12) };
}

// a soft round glow texture (halos, beacons)
export const glowTex = () => tex(radial(128, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.45)'], [1, 'rgba(255,255,255,0)']]), { repeat: false });
