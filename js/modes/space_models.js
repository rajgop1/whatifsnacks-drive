// Space mode art: the STAR HOPPER rocket (our own chunky cartoon design: cream body, coral nose, navy fins, a porthole with the mascot),
// the launch pad, ascent obstacles, flames, and procedural planet textures. Everything is built from primitives and canvases (no files).
import * as THREE from 'three';
import { bakeColored, M4 } from '../util.js';

const TAU = Math.PI * 2;
const CREAM = 0xeedcc4, CORAL = 0xff6b57, NAVY = 0x1f2756, SUN = 0xffd84d, DARK = 0x2a2d3c, STEEL = 0xb9bfd0;

// ---------------------------------------------------------------- the rocket (base of the engine bell at y = 0, nose at y = 16.4, +z is its "back")
export function makeRocket() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.05, emissive: 0x140f1c });
  const cyl = (r0, r1, y0, y1, col, seg = 32) => [new THREE.CylinderGeometry(r1, r0, y1 - y0, seg), col, M4(0, (y0 + y1) / 2, 0)];
  // stage 1: bell, body, a sun band, navy stripe, four swept fins with coral tips
  const finShape = new THREE.Shape([[0, 1.3], [0, 4.4], [1.25, 1.7], [1.35, 0.55], [0.9, 0.55]].map(([x, y]) => new THREE.Vector2(x, y)));
  const fin = new THREE.ExtrudeGeometry(finShape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1 }); fin.translate(0.95, 0, -0.1);
  const tip = new THREE.BoxGeometry(0.3, 1.25, 0.32);
  const b = [cyl(0.62, 0.38, 0, 1.15, DARK, 20), cyl(1.05, 1.05, 1.0, 8.0, CREAM), cyl(1.075, 1.075, 6.5, 7.2, SUN), cyl(1.07, 1.07, 2.0, 2.3, NAVY), cyl(1.0, 1.06, 0.9, 1.1, NAVY)];
  for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + TAU / 8; b.push([fin, NAVY, M4(0, 0, 0, 0, a, 0)]); b.push([tip, CORAL, new THREE.Matrix4().makeRotationY(a).multiply(M4(2.25, 1.15, 0))]); }
  const booster = new THREE.Mesh(bakeColored(b), mat);
  // stage 2: interstage, body, coral band, a small engine bell (hidden in the interstage until separation), the docking nose under the fairing
  const u = [cyl(1.06, 1.06, 8.0, 8.4, NAVY), cyl(1.0, 1.0, 8.4, 12.8, CREAM), cyl(1.02, 1.02, 9.0, 9.35, CORAL), cyl(0.5, 0.3, 7.3, 8.1, DARK, 16),
    cyl(0.82, 0.42, 12.8, 14.0, NAVY, 24), cyl(0.46, 0.46, 14.0, 14.25, STEEL, 16), cyl(0.2, 0.2, 14.25, 14.7, STEEL, 10)];
  for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + TAU / 8; u.push([new THREE.BoxGeometry(0.12, 0.6, 0.5), SUN, M4(Math.cos(a) * 1.02, 12.2, Math.sin(a) * 1.02, 0, -a, 0)]); }   // little thruster blocks
  const upper = new THREE.Group(); upper.add(new THREE.Mesh(bakeColored(u), mat));
  // the porthole: a navy ring and a glass disc with the hoodie mascot looking out (on +z, the side the chase camera sees)
  const ring = new THREE.Mesh(bakeColored([[new THREE.TorusGeometry(0.5, 0.11, 8, 28), NAVY]]), mat); ring.position.set(0, 11.0, 0.99); upper.add(ring);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.47, 28), new THREE.MeshBasicMaterial({ map: faceTexture(), color: new THREE.Color(1.5, 1.5, 1.5) })); glass.position.set(0, 11.0, 1.0); upper.add(glass);
  // the fairing: two coral halves of the nose cone
  const prof = []; for (let i = 0; i <= 12; i++) { const t = i / 12; prof.push(new THREE.Vector2(Math.max(0.001, 1.02 * Math.pow(1 - t, 0.8) * (1 - 0.15 * t * t)), 12.8 + t * 3.6)); }
  const half = (p0) => new THREE.Mesh(bakeColored([[new THREE.LatheGeometry(prof, 14, p0, Math.PI), CORAL], [new THREE.CylinderGeometry(1.04, 1.04, 0.22, 14, 1, true, p0, Math.PI), SUN, M4(0, 13.05, 0)]]), mat);
  const fairL = half(0), fairR = half(Math.PI); upper.add(fairL, fairR);
  // flames (point down from the nozzle exit)
  const flameMat = makeFlameMaterial();
  const fg = new THREE.ConeGeometry(0.7, 7, 20, 6, true); fg.rotateX(Math.PI); fg.translate(0, -3.5, 0);
  const flameBig = new THREE.Mesh(fg, flameMat); flameBig.position.y = 0.05; flameBig.frustumCulled = false; flameBig.renderOrder = 5; booster.add(flameBig);
  const flameSmall = new THREE.Mesh(fg, flameMat); flameSmall.position.y = 7.3; flameSmall.scale.setScalar(0.62); flameSmall.frustumCulled = false; flameSmall.renderOrder = 5; flameSmall.visible = false; upper.add(flameSmall);
  const group = new THREE.Group(); group.add(booster, upper);
  return { group, booster, upper, fairL, fairR, flameBig, flameSmall, flameMat, mat };
}
function faceTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'), C = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  const gr = g.createRadialGradient(64, 50, 10, 64, 64, 70); gr.addColorStop(0, '#9fd8ff'); gr.addColorStop(1, '#3a5aa8'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#ff6b57'; g.beginPath(); g.ellipse(64, 138, 52, 40, 0, 0, TAU); g.fill();                  // hoodie
  C(64, 70, 30, '#f4bf98'); g.fillStyle = '#2b2140'; g.beginPath(); g.arc(64, 64, 31, Math.PI * 1.03, Math.PI * 1.97); g.fill();   // face, hair
  C(53, 72, 6, '#fff'); C(75, 72, 6, '#fff'); C(54, 73, 3.4, '#1d1b2e'); C(76, 73, 3.4, '#1d1b2e');
  g.strokeStyle = '#9a4a3a'; g.lineWidth = 3; g.beginPath(); g.arc(64, 81, 8, 0.2, Math.PI - 0.2); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(40, 34, 22, 10, -0.6, 0, TAU); g.fill();   // glass highlight
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function makeFlameMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPow: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: 'varying float vY; varying vec3 vN; varying vec3 vV; void main(){ vY = -position.y / 7.0; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: `uniform float uTime, uPow; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float core = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); float fl = 0.85 + 0.15 * sin(uTime * 53.0 + vY * 19.0) * sin(uTime * 31.0);
        float len = smoothstep(1.0, 0.05, vY / max(0.25, uPow * fl)); vec3 c = mix(vec3(3.2, 1.0, 0.3), vec3(4.0, 3.4, 1.8), core * (1.0 - vY));
        gl_FragColor = vec4(c * len * core * uPow, 1.0); }`,
  });
}

// ---------------------------------------------------------------- the pad (centred on the origin), a little coastal launch site
export function padGeometry() {
  const p = [];
  p.push([new THREE.CylinderGeometry(10, 11, 0.6, 40), 0x8d8798, M4(0, 0.3, 0)]);
  p.push([new THREE.CylinderGeometry(3.2, 3.2, 0.1, 28), 0x3a3846, M4(0, 0.62, 0)]);               // blast plate
  p.push([new THREE.BoxGeometry(4, 0.12, 14), 0x2b2936, M4(0, 0.61, 7)]);                            // flame trench
  for (const [x, z] of [[-1.3, -1.3], [1.3, -1.3], [1.3, 1.3], [-1.3, 1.3]]) p.push([new THREE.BoxGeometry(0.35, 20, 0.35), NAVY, M4(-6 + x, 10, z)]);   // tower legs
  for (let y = 2; y < 20; y += 3) { p.push([new THREE.BoxGeometry(2.9, 0.22, 0.22), SUN, M4(-6, y, -1.3)]); p.push([new THREE.BoxGeometry(2.9, 0.22, 0.22), SUN, M4(-6, y, 1.3)]); p.push([new THREE.BoxGeometry(0.22, 0.22, 2.9), SUN, M4(-7.3, y, 0)]); p.push([new THREE.BoxGeometry(0.22, 0.22, 2.9), SUN, M4(-4.7, y, 0)]); }
  p.push([new THREE.BoxGeometry(3.4, 0.5, 3.4), CORAL, M4(-6, 20.2, 0)]);                              // tower cab
  for (let k = 0; k < 10; k++) { const a = k / 10 * TAU; p.push([new THREE.CylinderGeometry(0.16, 0.16, 4, 6), 0xdcd6e6, M4(Math.cos(a) * 8.6, 2.3, Math.sin(a) * 8.6)]); }   // water-deluge pipes
  return bakeColored(p);
}
export function armGeometry() { return bakeColored([[new THREE.BoxGeometry(4.6, 0.6, 0.8), STEEL, M4(2.3, 0, 0)], [new THREE.BoxGeometry(0.5, 1.2, 1.4), CORAL, M4(4.6, 0, 0)]]); }   // pivots at x = 0
export function lightsGeometry() { const p = []; for (let y = 2; y < 21; y += 3) p.push([new THREE.BoxGeometry(0.3, 0.3, 0.3), 0xffffff, M4(-4.55, y, 1.45)]); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + 0.2; p.push([new THREE.BoxGeometry(0.4, 0.25, 0.4), 0xffffff, M4(Math.cos(a) * 10.4, 0.7, Math.sin(a) * 10.4)]); } return bakeColored(p); }

// ---------------------------------------------------------------- ascent obstacles (each one shared geometry for an InstancedMesh)
export function cloudGeometry() { const p = []; for (const [x, y, z, r, c] of [[0, 0, 0, 3.2, 0xfff3ea], [2.8, -0.6, 0.6, 2.4, 0xffe6dc], [-2.9, -0.7, -0.3, 2.5, 0xffe2d6], [1.2, 1.5, -0.8, 2.2, 0xffffff], [-1.4, 1.1, 0.9, 2.0, 0xfff6ee], [0.3, -1.6, 1.2, 2.2, 0xf2c8c8]]) p.push([new THREE.IcosahedronGeometry(r, 2), c, M4(x, y, z)]); return bakeColored(p); }
export function birdGeometry() { return bakeColored([[new THREE.BoxGeometry(1.5, 0.08, 0.45), 0x2a2240, M4(-0.68, 0.22, 0, 0, 0, -0.38)], [new THREE.BoxGeometry(1.5, 0.08, 0.45), 0x2a2240, M4(0.68, 0.22, 0, 0, 0, 0.38)], [new THREE.SphereGeometry(0.22, 8, 6), 0x3a3050, M4(0, 0, 0, 0, 0, 0, 1, 1, 2.2)]]); }
export function balloonGeometry() { return bakeColored([[new THREE.SphereGeometry(2.4, 18, 14), 0xf6f2ff, M4(0, 1.5, 0, 0, 0, 0, 1, 1.25, 1)], [new THREE.CylinderGeometry(0.03, 0.03, 3, 4), 0x555566, M4(0, -2.2, 0)], [new THREE.BoxGeometry(0.7, 0.6, 0.7), CORAL, M4(0, -3.9, 0)]]); }
export function junkGeometry() { return bakeColored([[new THREE.BoxGeometry(1.2, 1.0, 1.4), 0x9aa0b0], [new THREE.BoxGeometry(3.2, 0.06, 1.0), 0x4a5fb0, M4(2.0, 0, 0, 0.3, 0, 0)], [new THREE.CylinderGeometry(0.06, 0.06, 1.4, 4), 0xd8d8e0, M4(-0.5, 1.0, 0, 0, 0, 0.5)], [new THREE.BoxGeometry(1.25, 0.2, 1.45), 0xd9a63c, M4(0, -0.55, 0)]]); }
export function cellGeometry() { return bakeColored([[new THREE.CapsuleGeometry(0.55, 1.1, 4, 12), 0xffffff], [new THREE.TorusGeometry(0.62, 0.1, 6, 16), 0xffffff, M4(0, 0, 0, Math.PI / 2, 0, 0)]]); }
export function meteorGeometry() { const g = new THREE.SphereGeometry(0.6, 10, 8); g.scale(1, 1, 9); g.translate(0, 0, 4.5); return g; }

// ---------------------------------------------------------------- shared canvases
export function dotTexture() { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); }

// periodic value noise (wraps in x so equirect textures have no seam)
function makeNoise(seed) {
  const P = new Float32Array(256 * 256); let s = seed >>> 0; for (let i = 0; i < P.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; P[i] = s / 4294967296; }
  const n = (x, y, per) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), x0 = ((xi % per) + per) % per, x1 = (x0 + 1) % per, y0 = (((yi % per) + per) % per) & 255, y1 = ((y0 + 1) % per) & 255;
    const a = P[y0 * 256 + x0], b = P[y0 * 256 + x1], c = P[y1 * 256 + x0], d = P[y1 * 256 + x1]; return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  return (x, y, per, oct = 4) => { let a = 0, amp = 0.5, f = 1, t = 0; for (let o = 0; o < oct; o++) { a += amp * n(x * f, y * f + o * 31.7, per * f); t += amp; amp *= 0.5; f *= 2; } return a / t; };
}
const hex = (c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mixc = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
// one 2:1 equirect canvas per world. kind picks the look. Returns a CanvasTexture.
export function planetTexture(kind, W = 512) {
  const H = W / 2, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), img = g.createImageData(W, H), d = img.data;
  const N = makeNoise(kind.length * 7919 + kind.charCodeAt(0) * 31), per = 8, sx = per / W;
  const bands = (stops) => (lat) => { for (let i = 1; i < stops.length; i++) if (lat <= stops[i][0]) { const a = stops[i - 1], b = stops[i], k = (lat - a[0]) / (b[0] - a[0]); return mixc(hex(a[1]), hex(b[1]), k); } return hex(stops[stops.length - 1][1]); };
  const J = bands([[0, 0xc9b49a], [0.12, 0xe8d8bc], [0.2, 0xb07a52], [0.28, 0xf0e2c6], [0.36, 0xc48a5c], [0.44, 0xf3e7d0], [0.5, 0xe9d4b2], [0.56, 0xf3e7d0], [0.64, 0x9c6a4a], [0.72, 0xeedcbe], [0.8, 0xb98a62], [0.88, 0xe2d0b4], [1, 0xbfa88e]]);
  const S = bands([[0, 0xcbb894], [0.2, 0xe6d4a8], [0.3, 0xd6bc86], [0.42, 0xf0e2bc], [0.5, 0xe8d29e], [0.58, 0xf0e2bc], [0.7, 0xd2b47e], [0.8, 0xe6d4a8], [1, 0xc4b08c]]);
  for (let y = 0; y < H; y++) {
    const lat = y / H, la = Math.abs(lat - 0.5) * 2;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, nx = x * sx, ny = y * sx; let col;
      if (kind === 'jupiter' || kind === 'saturn') {
        const w = N(nx * 2, ny * 2, per * 2, 3), base = (kind === 'jupiter' ? J : S)(Math.min(1, Math.max(0, lat + (w - 0.5) * (kind === 'jupiter' ? 0.035 : 0.02))));
        col = mixc(base, [255, 250, 240], (N(nx * 6, ny * 1.2, per * 6, 2) - 0.5) * 0.3);
        if (kind === 'jupiter') { const dx = (x / W - 0.62) * 2 * 3.2, dy = (lat - 0.64) * 6.4, r = dx * dx * 0.55 + dy * dy; if (r < 1) col = mixc(col, [200, 92, 60], Math.min(1, (1 - r) * 2.2)); }   // the Great Red Spot
      } else if (kind === 'mars') {
        const n = N(nx, ny, per, 5); col = mixc([196, 92, 52], [120, 52, 36], Math.max(0, (n - 0.45) * 2.6)); col = mixc(col, [232, 150, 100], Math.max(0, (0.42 - n) * 2));
        if (la > 0.86 + (N(nx * 3, ny * 3, per * 3, 2) - 0.5) * 0.08) col = [244, 240, 236];
      } else if (kind === 'venus') {
        const w = N(nx * 1.5, ny * 1.5, per * 1.5, 4); col = mixc([236, 200, 132], [250, 232, 186], N(nx * 3 + w * 2, ny * 1.4, per * 3, 3)); col = mixc(col, [200, 150, 90], Math.max(0, (w - 0.6) * 1.8));
      } else if (kind === 'uranus') { col = mixc([160, 226, 232], [196, 240, 240], N(nx * 0.8, ny * 4, per * 0.8, 2) * 0.6 + la * 0.3);
      } else if (kind === 'neptune') {
        col = mixc([54, 92, 210], [96, 140, 236], N(nx * 1.5, ny * 5, per * 1.5, 3)); const dx = (x / W - 0.3) * 6, dy = (lat - 0.62) * 9, r = dx * dx + dy * dy; if (r < 1) col = mixc(col, [24, 40, 120], (1 - r) * 0.9);
      } else if (kind === 'sun') { const n = N(nx * 4, ny * 4, per * 4, 3); col = mixc([255, 170, 60], [255, 236, 170], n);
      } else { // moon, mercury: grey regolith with maria; craters are drawn after
        const n = N(nx, ny, per, 5); col = kind === 'mercury' ? mixc([150, 140, 132], [196, 186, 176], n) : mixc([150, 148, 146], [214, 210, 202], n);
        if (kind === 'moon' && N(nx * 0.6 + 3, ny * 0.6, per * 0.6, 3) > 0.58) col = mixc(col, [96, 96, 104], 0.6);
      }
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  if (kind === 'moon' || kind === 'mercury') {   // craters at mid latitudes (they would smear near the poles), drawn twice across the seam
    let s = 99 + kind.length; const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    for (let k = 0; k < 70; k++) { const x = r() * W, y = H * (0.2 + 0.6 * r()), rad = (2 + r() * r() * 16) * W / 512;
      for (const ox of [0, -W, W]) { const gr = g.createRadialGradient(x + ox - rad * 0.2, y - rad * 0.2, rad * 0.1, x + ox, y, rad); gr.addColorStop(0, 'rgba(70,66,64,0.45)'); gr.addColorStop(0.75, 'rgba(110,104,100,0.3)'); gr.addColorStop(0.92, 'rgba(240,236,228,0.45)'); gr.addColorStop(1, 'rgba(240,236,228,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(x + ox, y, rad, rad, 0, 0, TAU); g.fill(); } }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
export function ringTexture() {   // Saturn's rings, radial (u = 0 inner .. 1 outer); one row is enough
  const c = document.createElement('canvas'); c.width = 512; c.height = 4; const g = c.getContext('2d'); let s = 5; const r = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
  for (let x = 0; x < 512; x++) { const u = x / 512, cassini = u > 0.62 && u < 0.68 ? 0.08 : 1, a = (0.35 + 0.55 * r()) * cassini * Math.min(1, u * 8) * Math.min(1, (1 - u) * 10), b = 200 + 40 * Math.sin(u * 40); g.fillStyle = `rgba(${b + 30},${b + 10},${b - 30},${a.toFixed(3)})`; g.fillRect(x, 0, 1, 4); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// a tiling soft cloud-top texture for the cloud deck (periodic in both directions)
export function deckTexture(W = 256) {
  const N = makeNoise(4242), c = document.createElement('canvas'); c.width = c.height = W; const g = c.getContext('2d'), img = g.createImageData(W, W), d = img.data, per = 8;
  for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4, n = N(x / W * per, y / W * per, per, 5), v = Math.max(0, Math.min(1, (n - 0.38) * 2.6)); d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = v * 255; }
  g.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// ---------------------------------------------------------------- easter eggs
export function satelliteGeometry() {   // a small old sphere satellite with four whip antennas
  const p = [[new THREE.SphereGeometry(1, 16, 12), 0xd8dae2]];
  for (let k = 0; k < 4; k++) { const a = k * TAU / 4; p.push([new THREE.CylinderGeometry(0.04, 0.04, 4, 4), 0xc0c4cc, new THREE.Matrix4().makeRotationY(a).multiply(M4(1.6, -1.2, 0, 0, 0, 0.9))]); }
  return bakeColored(p);
}
export function cometGeometry() {   // tail along +z (pointed away from the Sun at runtime)
  const g = new THREE.ConeGeometry(1, 1, 24, 8, true); g.rotateX(-Math.PI / 2); g.translate(0, 0, 0.5); return g;
}
