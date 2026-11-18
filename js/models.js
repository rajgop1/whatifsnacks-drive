// Procedural models built from primitives, baked to single vertex-colored geometries so they instance cheaply.
// Convention: pure white (1,1,1) vertices take the per-instance tint (paint, hoodie colour); everything else keeps its baked colour.
import * as THREE from 'three';
import { bakeColored, M4 } from './util.js';

// Material whose instance colour only tints pure-white vertices.
export function tintMaterial(params = {}, Kind = THREE.MeshStandardMaterial) {
  const m = new Kind({ vertexColors: true, ...params });
  m.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
      #if defined( USE_COLOR ) && defined( USE_INSTANCING_COLOR )
        vColor.rgb = color.rgb * mix(vec3(1.0), instanceColor.rgb, step(2.995, color.r + color.g + color.b));
      #endif`);
  };
  m.customProgramCacheKey = () => 'tint';
  return m;
}

const extrudeSide = (pts, width, bevel = 0.06) => {
  const s = new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  g.rotateY(-Math.PI / 2); g.translate((width - bevel * 2) / 2, 0, 0);   // shape x -> world z, extrude along world x, centred
  return g;
};

// ---------------------------------------------------------------- cars (forward = +z, ground at y = 0)
// Shared car-building helpers. A greenhouse (cabin) is a tinted glass solid on top of the lower body, framed by pillar struts with a roof skin, so the
// mascot driver shows through the side windows. glass:false leaves the glass out of the body so the player car can draw it with a see-through material.
const GLASS_C = 0x1c2a44, GLINT = 0xcfdcf5, DARK = 0x17161e, TRIM = 0x2a2834, CHROME = 0xc8ccd8;
// a box strut along the side-profile segment a -> b ([z, y]) at x; off pushes it out along the segment's outward normal, k shortens it about the middle
const strut = (a, b, x, w, t, color, off = 0, k = 1) => {
  const dz = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dz, dy), nz = -dy / L, ny = dz / L;
  return [new THREE.BoxGeometry(w, t, L * k), color, M4(x, (a[1] + b[1]) / 2 + ny * off, (a[0] + b[0]) / 2 + nz * off, -Math.atan2(dy, dz), 0, 0)];
};
// prof runs rear base -> over the roof -> front base. Glints: two light stripes on the windscreen and rear window, and diagonal streaks on the side glass.
function greenhouse(parts, glassParts, { prof, w, frame, roof, roofW, roofC, side = [], pillars = [] }) {
  glassParts.push([extrudeSide(prof, w, 0.04), GLASS_C]);
  const n = prof.length, hw = w / 2;
  for (const s of [-1, 1]) {
    for (let i = 0; i < n - 1; i++) parts.push(strut(prof[i], prof[i + 1], s * (hw + 0.004), 0.05, 0.07, frame, 0.02));
    for (const [z, y0, y1] of pillars) parts.push([new THREE.BoxGeometry(0.05, y1 - y0, 0.08), frame, M4(s * (hw + 0.004), (y0 + y1) / 2, z)]);
    for (const [z, y, l] of side) { glassParts.push([new THREE.BoxGeometry(0.012, 0.05, l), GLINT, M4(s * (hw + 0.002), y, z, 0.95, 0, 0)]); glassParts.push([new THREE.BoxGeometry(0.012, 0.025, l * 0.7), GLINT, M4(s * (hw + 0.002), y + 0.03, z + 0.12, 0.95, 0, 0)]); }
  }
  for (const [a, b] of [[prof[n - 2], prof[n - 1]], [prof[0], prof[1]]]) for (const [x, ww] of [[hw * 0.3, 0.08], [hw * 0.5, 0.035]]) glassParts.push(strut(a, b, x, ww, 0.012, GLINT, 0.045, 0.62));
  if (roof) parts.push([extrudeSide(roof, roofW, 0.04), roofC]);
}
// wheel arch: a dark liner disc just inside the tyre face, and a lip round it (paint or black plastic)
function arch(parts, x, z, r, lip, tube = 0.045) {
  const s = Math.sign(x);
  parts.push([new THREE.CylinderGeometry(r + 0.09, r + 0.09, 0.03, 22, 1, false, 0, Math.PI), 0x0d0c12, M4(x, r, z, 0, 0, Math.PI / 2)]);
  parts.push([new THREE.TorusGeometry(r + 0.1, tube, 6, 20, Math.PI), lip, M4(x + s * 0.005, r, z, 0, Math.PI / 2, 0)]);
}
const side = (geo, x) => geo.translate(x, 0, 0);   // an extrudeSide slab moved out to one flank

// Side profile of our coupe (z forward, y up): low nose, long hood, ducktail. The cabin is a separate greenhouse.
const BODY = [[-2.3, 0.36], [-2.36, 0.56], [-2.34, 0.78], [-2.18, 0.88], [-1.75, 0.93], [-1.42, 0.97], [1.02, 0.97], [1.55, 0.88], [2.05, 0.8], [2.3, 0.68], [2.4, 0.5], [2.36, 0.36]];
const GLASS = [[-1.47, 0.96], [-1.0, 1.24], [-0.62, 1.37], [-0.2, 1.41], [0.3, 1.39], [0.65, 1.25], [1.07, 0.96]];
const ROOF = [[-0.74, 1.3], [-0.62, 1.38], [-0.2, 1.43], [0.3, 1.41], [0.52, 1.32]];
export function carGeometry({ police = false, taxi = false, wheels = true, glass = true } = {}) {
  const paint = taxi ? 0xffc52e : 0xffffff, dark = DARK, trim = TRIM, chrome = CHROME, parts = [], glassParts = [];
  parts.push([extrudeSide(BODY, 1.9, 0.12), paint]);
  greenhouse(parts, glassParts, { prof: GLASS, w: 1.66, frame: trim, roof: ROOF, roofW: 1.72, roofC: paint, pillars: [[-0.12, 1.0, 1.42]], side: [[0.25, 1.17, 0.42], [-0.75, 1.13, 0.36]] });
  for (const s of [-1, 1]) {
    arch(parts, s * 0.955, 1.42, 0.37, paint, 0.035); arch(parts, s * 0.955, -1.42, 0.37, paint, 0.035);
    parts.push([new THREE.BoxGeometry(0.06, 0.12, 1.9), dark, M4(s * 0.93, 0.36, 0)]);                                  // side skirt
    parts.push([new THREE.BoxGeometry(0.03, 0.035, 1.9), chrome, M4(s * 0.935, 0.975, -0.2)]);                         // belt-line chrome
    parts.push([new THREE.BoxGeometry(0.02, 0.5, 0.025), trim, M4(s * 0.955, 0.72, 0.98)]);                            // door shut lines
    parts.push([new THREE.BoxGeometry(0.02, 0.48, 0.025), trim, M4(s * 0.955, 0.72, -0.72)]);
    parts.push([new THREE.BoxGeometry(0.02, 0.03, 0.18), chrome, M4(s * 0.96, 0.86, 0.3)]);                            // door handle
    parts.push([new THREE.BoxGeometry(0.14, 0.04, 0.06), dark, M4(s * 0.9, 1.0, 0.82)]);                                // mirror stalk
    parts.push([new THREE.BoxGeometry(0.16, 0.1, 0.2), paint, M4(s * 1.0, 1.04, 0.8)]);                                 // mirrors
    parts.push([new THREE.BoxGeometry(0.03, 0.07, 0.16), 0x9ab0d0, M4(s * 1.0, 1.04, 0.69)]);
    parts.push([new THREE.BoxGeometry(0.06, 0.22, 0.06), dark, M4(s * 0.55, 1.03, -2.0)]);                             // spoiler posts
    parts.push([new THREE.BoxGeometry(0.32, 0.1, 0.06), dark, M4(s * 0.55, 0.34, -2.33)]);                             // diffuser fins
  }
  parts.push([new THREE.BoxGeometry(1.7, 0.05, 0.34), taxi ? paint : dark, M4(0, 1.15, -2.04, 0.12, 0, 0)]);            // ducktail spoiler
  parts.push([new THREE.BoxGeometry(1.8, 0.07, 0.3), dark, M4(0, 0.33, 2.3)]);                                          // splitter
  parts.push([new THREE.BoxGeometry(1.1, 0.14, 0.05), 0x22202c, M4(0, 0.5, 2.39)]);                                     // grille
  parts.push([new THREE.BoxGeometry(1.0, 0.03, 0.05), chrome, M4(0, 0.58, 2.4)]);
  parts.push([new THREE.BoxGeometry(1.6, 0.14, 0.2), dark, M4(0, 0.4, -2.3)]);                                          // rear valance
  parts.push([new THREE.BoxGeometry(0.62, 0.18, 0.04), 0xf2f0e6, M4(0, 0.6, -2.37)]);                                   // plate
  parts.push([new THREE.BoxGeometry(1.7, 0.12, 4.3), 0x111018, M4(0, 0.3, 0)]);                                          // underbody
  parts.push([new THREE.BoxGeometry(0.5, 0.025, 1.2), trim, M4(0, 1.095, 1.5, 0.12, 0, 0)]);                           // hood vent
  if (wheels) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    parts.push([new THREE.CylinderGeometry(0.37, 0.37, 0.28, 16), 0x16151c, M4(sx * 0.84, 0.37, sz * 1.42, 0, 0, Math.PI / 2)]);
    parts.push([new THREE.CylinderGeometry(0.24, 0.24, 0.29, 10), 0xb8bcc8, M4(sx * 0.845, 0.37, sz * 1.42, 0, 0, Math.PI / 2)]);
  }
  if (police) parts.push([new THREE.BoxGeometry(1.2, 0.1, 0.3), 0x22222a, M4(0, 1.47, -0.2)]);
  if (taxi) { parts.push([new THREE.BoxGeometry(0.7, 0.2, 0.25), 0xfff2c0, M4(0, 1.54, -0.2)]); for (const s of [-1, 1]) parts.push([new THREE.BoxGeometry(0.02, 0.08, 3.4), 0x1d1b26, M4(s * 0.955, 0.66, 0)]); }
  if (glass) parts.push(...glassParts);
  const g = bakeColored(parts);
  if (police) {
    const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) if (c.getX(i) + c.getY(i) + c.getZ(i) > 2.99) { if (p.getY(i) < 0.86) c.setXYZ(i, 0.11, 0.14, 0.28); else c.setXYZ(i, 0.95, 0.95, 0.97); }
  }
  return g;
}
export function carGlassGeometry() { const parts = [], gp = []; greenhouse(parts, gp, { prof: GLASS, w: 1.66, frame: TRIM, pillars: [], side: [[0.25, 1.17, 0.42], [-0.75, 1.13, 0.36]] }); parts.forEach(([g]) => g.dispose()); return bakeColored(gp); }
// Lamps: slim swept headlights with a light bar, wraparound tail lights joined by a strip. Vertex colours carry the hue.
export function carLightsGeometry() {
  const parts = [];
  for (const s of [-1, 1]) {
    parts.push([new THREE.BoxGeometry(0.46, 0.09, 0.08), 0xfff4e0, M4(s * 0.6, 0.7, 2.29, -0.25, s * -0.18, 0)]);
    parts.push([new THREE.BoxGeometry(0.34, 0.025, 0.05), 0xffe2b8, M4(s * 0.62, 0.63, 2.33, 0, s * -0.18, 0)]);   // daytime strip
    parts.push([new THREE.BoxGeometry(0.42, 0.11, 0.06), 0xff1830, M4(s * 0.66, 0.78, -2.35)]);
    parts.push([new THREE.BoxGeometry(0.05, 0.11, 0.3), 0xff1830, M4(s * 0.92, 0.78, -2.15)]);                   // wrap
    parts.push([new THREE.BoxGeometry(0.14, 0.05, 0.05), 0xffa030, M4(s * 0.74, 0.46, 2.37)]);                   // indicators
  }
  parts.push([new THREE.BoxGeometry(0.9, 0.03, 0.05), 0xff1830, M4(0, 0.8, -2.36)]);
  return bakeColored(parts);
}
// ---------------------------------------------------------------- the Volt Roadster: a low open two-seater (4.5 m, forward = +z). White vertices take the paint.
const ROAD_BODY = [[-2.2, 0.34], [-2.26, 0.5], [-2.24, 0.7], [-2.08, 0.81], [-1.6, 0.86], [-1.2, 0.9], [-0.98, 0.97], [-0.8, 0.88], [-0.45, 0.8], [0.1, 0.8], [0.5, 0.84], [0.85, 0.82], [1.3, 0.76], [1.75, 0.67], [2.1, 0.57], [2.25, 0.45], [2.22, 0.34]];
export function roadsterGeometry({ wheels = false } = {}) {
  const paint = 0xffffff, dark = DARK, chrome = CHROME, leather = 0x24212d, parts = [];
  parts.push([extrudeSide(ROAD_BODY, 1.92, 0.13), paint]);
  parts.push([new THREE.BoxGeometry(1.46, 0.03, 1.15), 0x121118, M4(0, 0.815, -0.18)]);                                   // cockpit floor
  parts.push([new THREE.BoxGeometry(1.7, 0.13, 0.5), paint, M4(0, 0.87, 0.66, 0.05, 0, 0)]);                              // cowl and dash
  parts.push([new THREE.BoxGeometry(1.52, 0.42, 0.035), 0x1a2236, M4(0, 1.03, 0.66, -0.75, 0, 0)]);                       // low raked windscreen
  parts.push([new THREE.BoxGeometry(0.1, 0.36, 0.012), GLINT, M4(0.3, 1.04, 0.685, -0.75, 0, 0)]);                       // windscreen glints
  parts.push([new THREE.BoxGeometry(0.04, 0.3, 0.012), GLINT, M4(0.46, 1.03, 0.685, -0.75, 0, 0)]);
  parts.push([new THREE.BoxGeometry(1.56, 0.05, 0.05), dark, M4(0, 1.18, 0.53, -0.75, 0, 0)]);                           // screen top rail
  for (const s of [-1, 1]) {
    parts.push([new THREE.BoxGeometry(0.05, 0.46, 0.05), dark, M4(s * 0.77, 1.03, 0.66, -0.75, 0, 0)]);                  // A-pillars
    parts.push([new THREE.BoxGeometry(0.52, 0.1, 0.52), leather, M4(s * 0.4, 0.88, -0.12)]);                                // seats
    parts.push([new THREE.BoxGeometry(0.5, 0.52, 0.12), leather, M4(s * 0.4, 1.12, -0.42, -0.16, 0, 0)]);
    parts.push([new THREE.BoxGeometry(0.3, 0.16, 0.1), leather, M4(s * 0.4, 1.46, -0.5)]);
    parts.push([new THREE.SphereGeometry(0.3, 12, 8), paint, M4(s * 0.4, 0.98, -1.3, 0, 0, 0, 0.95, 0.62, 2.0)]);          // twin head fairings
    arch(parts, s * 0.965, 1.33, 0.37, paint, 0.035); arch(parts, s * 0.965, -1.3, 0.37, paint, 0.035);
    parts.push([new THREE.BoxGeometry(0.06, 0.11, 1.9), dark, M4(s * 0.95, 0.35, 0)]);                                     // side skirts
    parts.push([new THREE.BoxGeometry(0.03, 0.03, 1.5), chrome, M4(s * 0.965, 0.76, -0.05)]);                              // belt-line chrome
    parts.push([new THREE.BoxGeometry(0.05, 0.16, 0.7), 0x0e0d14, M4(s * 0.96, 0.55, -0.55)]);                             // side intakes
    parts.push([new THREE.BoxGeometry(0.02, 0.42, 0.025), TRIM, M4(s * 0.965, 0.6, 0.62)]);                               // door shut line
    parts.push([new THREE.BoxGeometry(0.06, 0.03, 0.12), dark, M4(s * 0.9, 0.9, 0.58)]);                                   // mirror stalk
    parts.push([new THREE.BoxGeometry(0.1, 0.07, 0.18), paint, M4(s * 0.96, 0.93, 0.62)]);                                 // mirrors
    parts.push([new THREE.BoxGeometry(0.02, 0.05, 0.14), 0x9ab0d0, M4(s * 0.96, 0.93, 0.525)]);
    parts.push([new THREE.BoxGeometry(0.34, 0.1, 0.06), dark, M4(s * 0.55, 0.36, -2.2)]);                                  // diffuser fins
  }
  parts.push([new THREE.BoxGeometry(1.5, 0.07, 0.07), dark, M4(0, 1.5, -0.62)]);                                           // roll hoop bar
  parts.push([new THREE.BoxGeometry(0.06, 0.62, 0.06), dark, M4(-0.74, 1.2, -0.62)]); parts.push([new THREE.BoxGeometry(0.06, 0.62, 0.06), dark, M4(0.74, 1.2, -0.62)]);
  parts.push([new THREE.BoxGeometry(1.84, 0.07, 0.34), dark, M4(0, 0.34, 2.18)]);                                          // splitter
  parts.push([new THREE.BoxGeometry(0.9, 0.1, 0.05), 0x0e0d14, M4(0, 0.46, 2.27)]);                                        // low grille
  parts.push([new THREE.BoxGeometry(1.7, 0.1, 0.22), dark, M4(0, 0.4, -2.22)]);                                            // rear valance
  parts.push([new THREE.BoxGeometry(0.5, 0.15, 0.04), 0xf2f0e6, M4(0, 0.58, -2.29)]);                                      // plate
  parts.push([new THREE.BoxGeometry(1.7, 0.12, 4.2), 0x111018, M4(0, 0.3, 0)]);                                            // underbody
  parts.push([new THREE.BoxGeometry(1.9, 0.04, 0.3), paint, M4(0, 0.86, -2.0, 0.15, 0, 0)]);                              // tail lip
  if (wheels) for (const sx of [-1, 1]) for (const sz of [1.33, -1.3]) { parts.push([new THREE.CylinderGeometry(0.37, 0.37, 0.28, 16), 0x16151c, M4(sx * 0.88, 0.37, sz, 0, 0, Math.PI / 2)]); }
  return bakeColored(parts);
}
export function roadsterLightsGeometry() {
  const parts = [];
  for (const s of [-1, 1]) {
    parts.push([new THREE.BoxGeometry(0.5, 0.07, 0.07), 0xfff4e0, M4(s * 0.62, 0.62, 2.18, -0.3, s * -0.2, 0)]);
    parts.push([new THREE.BoxGeometry(0.3, 0.02, 0.05), 0xffe2b8, M4(s * 0.64, 0.56, 2.22, 0, s * -0.2, 0)]);
    parts.push([new THREE.BoxGeometry(0.5, 0.1, 0.05), 0xff1830, M4(s * 0.62, 0.72, -2.27)]);
    parts.push([new THREE.BoxGeometry(0.05, 0.1, 0.34), 0xff1830, M4(s * 0.93, 0.72, -2.1)]);
  }
  parts.push([new THREE.BoxGeometry(0.7, 0.03, 0.05), 0xff1830, M4(0, 0.74, -2.28)]);
  return bakeColored(parts);
}

// ---------------------------------------------------------------- the Snack Van: a tall delivery van (5.2 m, 2.1 m wide, 2.5 m tall) with a donut painted on the sides
const VAN_BODY = [[-2.5, 0.44], [-2.56, 0.62], [-2.56, 2.28], [-2.44, 2.4], [0.86, 2.4], [0.86, 1.42], [2.0, 1.42], [2.4, 1.3], [2.58, 1.06], [2.62, 0.72], [2.56, 0.44]];
const VAN_GLASS = [[0.8, 1.38], [0.8, 2.3], [1.42, 2.3], [2.06, 1.38]];
const VAN_ROOF = [[0.8, 2.22], [0.8, 2.46], [1.36, 2.46], [1.5, 2.22]];
const VAN_GH = { prof: VAN_GLASS, w: 2.0, frame: 0xffffff, roof: VAN_ROOF, roofW: 2.08, roofC: 0xffffff, side: [[1.2, 1.9, 0.5]] };
const ring = (r, n, wob = 0, f = 9) => Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, rr = r * (1 + wob * Math.sin(a * f)); return [Math.cos(a) * rr, Math.sin(a) * rr]; });
function donut(parts, s, z0, y0, x0) {   // a flat cartoon donut on one flank: dough, wavy pink icing, hole, sprinkles
  const at = (pts) => pts.map(([a, b]) => [z0 + a, y0 + b]);
  parts.push([side(extrudeSide(at(ring(0.6, 28)), 0.03, 0), s * (x0 + 0.015)), 0xe0a25a]);
  parts.push([side(extrudeSide(at(ring(0.5, 54, 0.07)), 0.03, 0), s * (x0 + 0.035)), 0xff7eb6]);
  parts.push([side(extrudeSide(at(ring(0.24, 20)), 0.03, 0), s * (x0 + 0.055)), 0xe0a25a]);
  parts.push([side(extrudeSide(at(ring(0.165, 18)), 0.03, 0), s * (x0 + 0.07)), 0xffffff]);
  parts.push([side(extrudeSide(at(ring(0.12, 12).map(([a, b]) => [a + 0.27, b + 0.33])), 0.02, 0), s * (x0 + 0.06)), 0xffc4dd]);   // icing shine
  const sp = [0xfff3a0, 0x6fd3ff, 0x3b3170, 0x9cff6b, 0xb07cff, 0xff4f5e];
  for (let k = 0; k < 14; k++) { const a = k * 2.399 + 0.4, r = 0.32 + (k % 3) * 0.055; parts.push([new THREE.BoxGeometry(0.03, 0.035, 0.11), sp[k % sp.length], M4(s * (x0 + 0.06), y0 + Math.sin(a) * r, z0 + Math.cos(a) * r, a * 1.7, 0, 0)]); }
}
export function vanGeometry({ glass = false } = {}) {
  const paint = 0xffffff, dark = DARK, plastic = 0x2a2a33, parts = [], gp = [];
  parts.push([extrudeSide(VAN_BODY, 2.1, 0.1), paint]);
  greenhouse(parts, gp, VAN_GH);
  parts.push([new THREE.BoxGeometry(1.9, 0.16, 0.42), 0x15141c, M4(0, 1.56, 1.78, 0.2, 0, 0)]);                              // dashboard
  parts.push([new THREE.BoxGeometry(2.0, 0.18, 4.9), 0x111018, M4(0, 0.44, 0)]);                                              // underbody
  for (const s of [-1, 1]) {
    arch(parts, s * 1.06, 1.75, 0.42, plastic, 0.06); arch(parts, s * 1.06, -1.55, 0.42, plastic, 0.06);
    // sliding side door: the cut lines and the rail it runs back on
    parts.push([new THREE.BoxGeometry(0.02, 1.7, 0.03), TRIM, M4(s * 1.056, 1.4, 0.72)]);
    parts.push([new THREE.BoxGeometry(0.02, 1.7, 0.03), TRIM, M4(s * 1.056, 1.4, -0.72)]);
    parts.push([new THREE.BoxGeometry(0.02, 0.03, 1.44), TRIM, M4(s * 1.056, 2.25, 0)]);
    parts.push([new THREE.BoxGeometry(0.04, 0.05, 1.7), plastic, M4(s * 1.06, 2.28, -1.55)]);                              // rail
    parts.push([new THREE.BoxGeometry(0.04, 0.05, 0.18), CHROME, M4(s * 1.065, 1.4, 0.58)]);                              // handle
    parts.push([new THREE.BoxGeometry(0.02, 0.85, 0.03), TRIM, M4(s * 1.056, 0.97, 1.96)]);                                // cab door line
    parts.push([new THREE.BoxGeometry(0.03, 0.04, 0.16), CHROME, M4(s * 1.06, 1.3, 1.1)]);
    parts.push([new THREE.BoxGeometry(0.06, 0.2, 2.3), plastic, M4(s * 1.04, 0.56, -1.15)]);                               // rub strips
    parts.push([new THREE.BoxGeometry(0.06, 0.2, 0.7), plastic, M4(s * 1.04, 0.56, 1.0)]);
    donut(parts, s, -1.4, 1.42, 1.05);
    // big van mirrors on arms
    parts.push(strut([1.75, 1.5], [1.6, 1.62], s * 1.12, 0.05, 0.05, dark));
    parts.push([new THREE.BoxGeometry(0.1, 0.36, 0.2), dark, M4(s * 1.22, 1.72, 1.62)]);
    parts.push([new THREE.BoxGeometry(0.02, 0.3, 0.16), 0x9ab0d0, M4(s * 1.22, 1.72, 1.51)]);
    // rear door windows, tail-lamp housings
    gp.push([new THREE.BoxGeometry(0.78, 0.5, 0.03), GLASS_C, M4(s * 0.5, 1.9, -2.575)]);
    gp.push([new THREE.BoxGeometry(0.06, 0.36, 0.01), GLINT, M4(s * 0.5 + 0.12, 1.9, -2.593, 0, 0, 0.6)]);
    parts.push([new THREE.BoxGeometry(0.2, 0.62, 0.04), plastic, M4(s * 0.95, 1.25, -2.565)]);
  }
  parts.push([new THREE.BoxGeometry(0.03, 1.7, 0.02), TRIM, M4(0, 1.4, -2.565)]);                                            // rear doors split
  parts.push([new THREE.BoxGeometry(0.16, 0.05, 0.04), CHROME, M4(0.12, 1.3, -2.575)]);
  parts.push([new THREE.BoxGeometry(2.14, 0.26, 0.3), plastic, M4(0, 0.54, 2.58)]);                                           // front bumper
  parts.push([new THREE.BoxGeometry(1.36, 0.34, 0.06), 0x1b1a22, M4(0, 0.98, 2.6)]);                                          // grille
  for (const y of [0.9, 1.0, 1.1]) parts.push([new THREE.BoxGeometry(1.3, 0.025, 0.03), 0x5a5866, M4(0, y, 2.635)]);
  parts.push([new THREE.BoxGeometry(2.14, 0.22, 0.26), plastic, M4(0, 0.52, -2.55)]);                                         // rear bumper
  parts.push([new THREE.BoxGeometry(0.6, 0.16, 0.04), 0xf2f0e6, M4(0, 0.74, -2.575)]);                                        // plate
  // roof vent and a pair of roof bars
  parts.push([new THREE.BoxGeometry(0.72, 0.14, 0.62), 0xd9dde6, M4(0, 2.56, -0.9)]);
  for (const z of [-1.1, -0.9, -0.7]) parts.push([new THREE.BoxGeometry(0.6, 0.03, 0.06), 0x3a3a46, M4(0, 2.635, z)]);
  for (const x of [-0.82, 0.82]) parts.push([new THREE.BoxGeometry(0.06, 0.06, 3.0), plastic, M4(x, 2.53, -0.9)]);
  if (glass) parts.push(...gp); else gp.forEach(([g]) => g.dispose());
  return bakeColored(parts);
}
export function vanGlassGeometry() { const parts = [], gp = []; greenhouse(parts, gp, { ...VAN_GH, roof: null }); parts.forEach(([g]) => g.dispose());
  for (const s of [-1, 1]) { gp.push([new THREE.BoxGeometry(0.78, 0.5, 0.03), GLASS_C, M4(s * 0.5, 1.9, -2.575)]); gp.push([new THREE.BoxGeometry(0.06, 0.36, 0.01), GLINT, M4(s * 0.5 + 0.12, 1.9, -2.593, 0, 0, 0.6)]); }
  return bakeColored(gp); }
export function vanLightsGeometry() {
  const parts = [];
  for (const s of [-1, 1]) {
    parts.push([new THREE.BoxGeometry(0.44, 0.22, 0.06), 0xfff4e0, M4(s * 0.74, 1.14, 2.6)]);
    parts.push([new THREE.BoxGeometry(0.2, 0.08, 0.05), 0xffa030, M4(s * 0.86, 0.94, 2.61)]);
    parts.push([new THREE.BoxGeometry(0.14, 0.5, 0.05), 0xff1830, M4(s * 0.95, 1.32, -2.59)]);
    parts.push([new THREE.BoxGeometry(0.14, 0.08, 0.05), 0xffa030, M4(s * 0.95, 1.0, -2.59)]);
    parts.push([new THREE.BoxGeometry(0.06, 0.05, 0.06), 0xffa030, M4(s * 0.92, 2.5, 0.84)]);                                // roof markers
  }
  parts.push([new THREE.BoxGeometry(0.5, 0.06, 0.04), 0xff1830, M4(0, 2.33, -2.58)]);                                         // high brake light
  return bakeColored(parts);
}

// ---------------------------------------------------------------- the Sidewinder: a low wide wedge supercar (4.6 m, 2.0 m wide, 1.2 m tall), mid engine, rear wing
const SUP_BODY = [[-2.25, 0.3], [-2.3, 0.52], [-2.26, 0.82], [-1.9, 0.88], [-1.3, 0.9], [-1.05, 0.74], [0.6, 0.7], [0.95, 0.74], [1.55, 0.62], [2.14, 0.46], [2.3, 0.37], [2.26, 0.3]];
const SUP_GLASS = [[-1.45, 0.72], [-0.75, 1.06], [-0.25, 1.13], [0.2, 1.1], [1.28, 0.66]];
const SUP_ROOF = [[-0.86, 0.99], [-0.72, 1.08], [-0.25, 1.16], [0.15, 1.13], [0.36, 1.05]];
const SUP_GH = { prof: SUP_GLASS, w: 1.52, frame: 0x101015, roof: SUP_ROOF, roofW: 1.56, roofC: 0xffffff, side: [[0.35, 0.92, 0.36], [-0.6, 0.9, 0.3]] };
const ACCENT = 0xc6ff3d;
export function superGeometry({ glass = false } = {}) {
  const paint = 0xffffff, dark = 0x101015, parts = [], gp = [];
  parts.push([extrudeSide(SUP_BODY, 2.0, 0.1), paint]);
  greenhouse(parts, gp, SUP_GH);
  parts.push([new THREE.BoxGeometry(1.7, 0.12, 4.3), 0x0d0c12, M4(0, 0.3, 0)]);                                               // underbody
  for (const s of [-1, 1]) {
    arch(parts, s * 1.005, 1.38, 0.35, paint, 0.04); arch(parts, s * 1.005, -1.38, 0.37, paint, 0.045);
    // scissor-style side intakes: a deep dark scoop with a paint blade across it
    parts.push([side(extrudeSide([[-1.42, 0.42], [-0.42, 0.42], [-0.52, 0.66], [-1.02, 0.86], [-1.3, 0.84]], 0.04, 0), s * 1.012), dark]);
    parts.push([side(extrudeSide([[-1.3, 0.48], [-0.62, 0.48], [-0.7, 0.62], [-1.08, 0.78], [-1.22, 0.76]], 0.04, 0), s * 1.02), 0x050508]);
    parts.push(strut([-1.38, 0.5], [-0.5, 0.74], s * 1.04, 0.04, 0.07, paint));
    parts.push([new THREE.BoxGeometry(0.02, 0.36, 0.025), TRIM, M4(s * 1.006, 0.56, 0.62)]);                                 // door line
    parts.push([new THREE.BoxGeometry(0.06, 0.1, 2.5), dark, M4(s * 0.99, 0.34, 0)]);                                        // side skirts
    parts.push(strut([0.7, 0.86], [0.92, 0.9], s * 0.86, 0.035, 0.035, dark));                                              // mirror stalk
    parts.push([new THREE.BoxGeometry(0.16, 0.08, 0.17), paint, M4(s * 0.99, 0.92, 0.8)]);
    parts.push([new THREE.BoxGeometry(0.02, 0.06, 0.13), 0x9ab0d0, M4(s * 0.99, 0.92, 0.71)]);
    // racing stripes up the hood
    parts.push(strut([0.95, 0.85], [1.55, 0.73], s * 0.2, 0.16, 0.02, ACCENT, 0)); parts.push(strut([1.55, 0.73], [2.14, 0.57], s * 0.2, 0.16, 0.02, ACCENT, 0));
    parts.push([new THREE.BoxGeometry(0.06, 0.32, 0.12), dark, M4(s * 0.62, 1.08, -1.95)]);                                  // wing posts
    parts.push([new THREE.BoxGeometry(0.05, 0.26, 0.5), paint, M4(s * 0.99, 1.22, -2.0)]);                                  // wing end plates
    parts.push([new THREE.BoxGeometry(0.3, 0.12, 0.06), dark, M4(s * 0.5, 0.34, -2.28)]);                                   // diffuser fins
    parts.push([new THREE.BoxGeometry(0.16, 0.16, 0.06), 0x2a2a33, M4(s * 0.3, 0.45, -2.29)]);                              // exhaust surrounds
  }
  for (let k = 0; k < 5; k++) parts.push([new THREE.BoxGeometry(1.1, 0.03, 0.07), dark, M4(0, 1.005, -1.45 - k * 0.11, 0.25, 0, 0)]);   // engine louvres
  parts.push([new THREE.BoxGeometry(1.96, 0.05, 0.4), dark, M4(0, 1.26, -2.0, 0.1, 0, 0)]);                                   // rear wing
  parts.push([new THREE.BoxGeometry(1.96, 0.02, 0.06), ACCENT, M4(0, 1.27, -2.2, 0.1, 0, 0)]);
  parts.push([new THREE.BoxGeometry(1.94, 0.06, 0.3), dark, M4(0, 0.31, 2.22)]);                                              // splitter
  parts.push([new THREE.BoxGeometry(1.3, 0.07, 0.05), 0x050508, M4(0, 0.42, 2.27)]);                                          // nose slit
  for (const x of [-0.42, 0.42]) parts.push([new THREE.BoxGeometry(0.34, 0.02, 0.4), dark, M4(x, 0.705, 1.62, 0.2, 0, 0)]);   // hood vents
  parts.push([new THREE.BoxGeometry(1.7, 0.16, 0.12), dark, M4(0, 0.4, -2.26)]);                                              // rear valance
  if (glass) parts.push(...gp); else gp.forEach(([g]) => g.dispose());
  return bakeColored(parts);
}
export function superGlassGeometry() { const parts = [], gp = []; greenhouse(parts, gp, { ...SUP_GH, roof: null }); parts.forEach(([g]) => g.dispose()); return bakeColored(gp); }
export function superLightsGeometry() {
  const parts = [];
  for (const s of [-1, 1]) {
    parts.push([new THREE.BoxGeometry(0.42, 0.04, 0.12), 0xfff4e0, M4(s * 0.66, 0.6, 2.06, -0.35, s * -0.25, 0)]);          // slit headlights
    parts.push([new THREE.BoxGeometry(0.18, 0.025, 0.06), 0xffe2b8, M4(s * 0.72, 0.52, 2.17, 0, s * -0.25, 0)]);
    parts.push([new THREE.BoxGeometry(0.5, 0.06, 0.05), 0xff1830, M4(s * 0.68, 0.8, -2.29)]);
  }
  parts.push([new THREE.BoxGeometry(0.86, 0.025, 0.05), 0xff1830, M4(0, 0.8, -2.29)]);                                        // full-width bar
  return bakeColored(parts);
}

// ---------------------------------------------------------------- the Dust Hauler: a chunky single-cab pickup (5.1 m, 2.05 m wide, 2.2 m tall) with a bed, roll bar and big tyres
const PK_BODY = [[-2.48, 0.62], [-2.52, 0.78], [-2.5, 0.98], [-0.6, 0.98], [-0.6, 1.36], [0.95, 1.36], [2.3, 1.28], [2.48, 1.16], [2.54, 0.9], [2.5, 0.62]];
const PK_GLASS = [[-0.56, 1.34], [-0.5, 1.96], [0.42, 1.96], [1.0, 1.34]];
const PK_ROOF = [[-0.6, 1.9], [-0.6, 2.04], [0.44, 2.04], [0.56, 1.9]];
const PK_GH = { prof: PK_GLASS, w: 1.86, frame: 0xffffff, roof: PK_ROOF, roofW: 1.94, roofC: 0xffffff, side: [[0.3, 1.68, 0.46]] };
export function pickupGeometry({ glass = false } = {}) {
  const paint = 0xffffff, dark = DARK, plastic = 0x26252e, sand = 0xe6b56a, parts = [], gp = [];
  parts.push([extrudeSide(PK_BODY, 2.05, 0.1), paint]);
  greenhouse(parts, gp, PK_GH);
  parts.push([new THREE.BoxGeometry(1.8, 0.2, 4.8), 0x111018, M4(0, 0.62, 0)]);                                              // chassis
  parts.push([new THREE.BoxGeometry(1.86, 0.04, 1.78), 0x3b3a45, M4(0, 1.1, -1.56)]);                                         // bed liner
  parts.push([new THREE.BoxGeometry(2.05, 0.46, 0.08), paint, M4(0, 1.21, -2.46)]);                                            // tailgate
  parts.push([new THREE.BoxGeometry(1.5, 0.025, 0.02), TRIM, M4(0, 1.32, -2.505)]); parts.push([new THREE.BoxGeometry(0.24, 0.06, 0.03), dark, M4(0, 1.3, -2.51)]);
  parts.push([new THREE.BoxGeometry(0.7, 0.38, 0.56), 0xa5713f, M4(0.42, 1.31, -1.85)]);                                       // a crate in the bed
  for (const y of [1.2, 1.4]) parts.push([new THREE.BoxGeometry(0.72, 0.04, 0.58), 0x7d5530, M4(0.42, y, -1.85)]);
  parts.push([new THREE.BoxGeometry(1.1, 0.3, 0.06), 0x1d1c24, M4(0, 1.3, -0.72)]);                                            // rear cab window frame
  // roll bar behind the cab
  for (const s of [-1, 1]) { parts.push([new THREE.BoxGeometry(0.08, 0.8, 0.08), dark, M4(s * 0.86, 1.8, -0.86)]); parts.push(strut([-0.86, 2.14], [-1.5, 1.44], s * 0.86, 0.07, 0.07, dark)); parts.push([new THREE.BoxGeometry(0.24, 0.17, 0.12), dark, M4(s * 0.42, 2.27, -0.86)]); }
  parts.push([new THREE.BoxGeometry(1.8, 0.08, 0.08), dark, M4(0, 2.18, -0.86)]);
  for (const s of [-1, 1]) {
    arch(parts, s * 1.03, 1.62, 0.5, plastic, 0.09); arch(parts, s * 1.03, -1.6, 0.5, plastic, 0.09);
    parts.push([new THREE.BoxGeometry(0.09, 0.46, 1.86), paint, M4(s * 0.98, 1.21, -1.54)]);                                  // bed sides
    parts.push([new THREE.BoxGeometry(0.13, 0.04, 1.9), plastic, M4(s * 0.98, 1.46, -1.54)]);                                 // bed rails
    parts.push([new THREE.BoxGeometry(0.02, 0.62, 0.03), TRIM, M4(s * 1.031, 1.02, 0.97)]);                                   // door lines
    parts.push([new THREE.BoxGeometry(0.02, 0.62, 0.03), TRIM, M4(s * 1.031, 1.02, -0.56)]);
    parts.push([new THREE.BoxGeometry(0.03, 0.04, 0.18), CHROME, M4(s * 1.036, 1.22, -0.36)]);
    parts.push(strut([-2.2, 0.98], [0.75, 1.12], s * 1.032, 0.012, 0.07, sand)); parts.push(strut([-2.2, 0.9], [0.75, 1.04], s * 1.032, 0.012, 0.035, sand));   // dust stripes
    parts.push([new THREE.BoxGeometry(0.2, 0.06, 1.3), plastic, M4(s * 1.1, 0.62, 0.05)]);                                   // side steps
    parts.push(strut([1.05, 1.42], [0.9, 1.56], s * 0.98, 0.05, 0.05, dark));                                                // mirrors
    parts.push([new THREE.BoxGeometry(0.1, 0.24, 0.18), dark, M4(s * 1.06, 1.6, 0.86)]);
    parts.push([new THREE.BoxGeometry(0.02, 0.2, 0.14), 0x9ab0d0, M4(s * 1.06, 1.6, 0.765)]);
    parts.push([new THREE.BoxGeometry(0.07, 0.5, 0.07), dark, M4(s * 0.46, 1.0, 2.66)]);                                     // bull bar uprights
  }
  parts.push([new THREE.BoxGeometry(1.06, 0.07, 0.07), dark, M4(0, 1.22, 2.66)]); parts.push([new THREE.BoxGeometry(1.06, 0.07, 0.07), dark, M4(0, 0.82, 2.66)]);
  parts.push([new THREE.BoxGeometry(1.52, 0.4, 0.05), 0x1b1a22, M4(0, 1.04, 2.535)]);                                         // grille
  for (const y of [0.94, 1.04, 1.14]) parts.push([new THREE.BoxGeometry(1.44, 0.035, 0.03), CHROME, M4(0, y, 2.565)]);
  parts.push([new THREE.BoxGeometry(2.12, 0.26, 0.32), plastic, M4(0, 0.7, 2.5)]);                                            // bumpers
  parts.push([new THREE.BoxGeometry(2.12, 0.22, 0.26), plastic, M4(0, 0.66, -2.5)]);
  parts.push([new THREE.BoxGeometry(0.1, 0.1, 0.24), 0x9a9aa8, M4(0, 0.6, -2.7)]);                                            // tow hitch
  parts.push([new THREE.BoxGeometry(0.56, 0.16, 0.04), 0xf2f0e6, M4(0, 0.86, -2.47)]);                                        // plate (on the bumper step)
  parts.push([new THREE.BoxGeometry(0.6, 0.06, 1.0), TRIM, M4(0, 1.44, 1.7, 0.06, 0, 0)]);                                    // hood scoop
  if (glass) parts.push(...gp); else gp.forEach(([g]) => g.dispose());
  return bakeColored(parts);
}
export function pickupGlassGeometry() { const parts = [], gp = []; greenhouse(parts, gp, { ...PK_GH, roof: null }); parts.forEach(([g]) => g.dispose()); return bakeColored(gp); }
export function pickupLightsGeometry() {
  const parts = [];
  for (const s of [-1, 1]) {
    parts.push([new THREE.BoxGeometry(0.4, 0.2, 0.06), 0xfff4e0, M4(s * 0.8, 1.14, 2.52)]);
    parts.push([new THREE.BoxGeometry(0.16, 0.08, 0.05), 0xffa030, M4(s * 0.8, 0.94, 2.54)]);
    parts.push([new THREE.BoxGeometry(0.1, 0.42, 0.05), 0xff1830, M4(s * 0.96, 1.18, -2.52)]);
    parts.push([new THREE.BoxGeometry(0.18, 0.12, 0.04), 0xfff4e0, M4(s * 0.42, 2.27, -0.79)]);                              // roll-bar lamps
  }
  parts.push([new THREE.BoxGeometry(0.4, 0.05, 0.04), 0xff1830, M4(0, 2.08, -0.66)]);                                         // cab brake light
  return bakeColored(parts);
}
// ---------------------------------------------------------------- the Star Hopper: a stainless-steel launch vehicle (37 m tall, 9 m wide, upright, base at y = 0).
// Our own design: steel body, black belly shield on the -z side, two nose flaps and two tail flaps, a ring of engines. Pure white takes no tint here.
export function rocketGeometry() {
  const R = 4.5, parts = [], P = (r, y) => new THREE.Vector2(r, y);
  const prof = [P(0, 0), P(R * 0.96, 0), P(R, 0.5), P(R, 26), P(R * 0.97, 28.4), P(R * 0.84, 31.6), P(R * 0.58, 34.6), P(R * 0.27, 36.6), P(0, 37.4)];
  parts.push([new THREE.LatheGeometry(prof, 28), 0xd9dde6]);
  parts.push([new THREE.LatheGeometry(prof.map((p) => P(p.x * 1.014, p.y)), 20, Math.PI - 1.0, 2.0), 0x1b1c24]);                 // black belly shield
  for (const y of [5, 10, 15, 20, 25]) parts.push([new THREE.CylinderGeometry(R + 0.04, R + 0.04, 0.14, 28), 0xaeb4c2, M4(0, y, 0)]);   // weld seams
  for (const s of [-1, 1]) {
    parts.push([new THREE.BoxGeometry(0.3, 5.2, 3.2), 0x2b2e3a, M4(s * (R + 0.45), 29.6, 0.3, 0, 0, s * -0.1)]);               // nose flaps
    parts.push([new THREE.BoxGeometry(0.34, 7.4, 5.2), 0x2b2e3a, M4(s * (R + 1.1), 6.2, 0.2, 0, 0, s * 0.18)]);                  // tail flaps
    parts.push([new THREE.BoxGeometry(0.5, 0.5, 0.5), 0x10121c, M4(s * 1.6, 32.8, R * 0.5)]);                                    // cabin windows
  }
  parts.push([new THREE.BoxGeometry(3.6, 0.25, 0.3), 0x10121c, M4(0, 31.6, R * 0.82)]);
  parts.push([new THREE.CylinderGeometry(0.75, 1.15, 1.6, 12), 0x3a3a46, M4(0, -0.5, 0)]);                                      // engines
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; parts.push([new THREE.CylinderGeometry(0.7, 1.05, 1.5, 10), 0x3a3a46, M4(Math.sin(a) * 2.5, -0.45, Math.cos(a) * 2.5)]); }
  parts.push([new THREE.BoxGeometry(1.4, 1.4, 0.4), 0xff6b57, M4(0, 12, R + 0.04)]);                                              // a coral square on the nose side: the channel colour
  return bakeColored(parts);
}
export function padGeometry() {
  const parts = [];
  parts.push([new THREE.CylinderGeometry(15, 16, 1.2, 32), 0x8a8794, M4(0, 0.5, 0)]);
  parts.push([new THREE.CylinderGeometry(8, 8, 0.2, 24), 0x3b3a46, M4(0, 1.12, 0)]);                                           // flame deflector plate
  for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [1.4, 1.4], [-1.4, 1.4]]) parts.push([new THREE.BoxGeometry(0.45, 52, 0.45), 0xe05a3c, M4(15.5 + x, 26, z)]);   // launch tower legs
  for (let y = 3; y < 52; y += 5) { parts.push([new THREE.BoxGeometry(3.4, 0.3, 0.3), 0xb84a30, M4(15.5, y, -1.4)]); parts.push([new THREE.BoxGeometry(3.4, 0.3, 0.3), 0xb84a30, M4(15.5, y, 1.4)]); parts.push([new THREE.BoxGeometry(0.3, 0.3, 3.4), 0xb84a30, M4(14.1, y, 0)]); parts.push([new THREE.BoxGeometry(0.3, 0.3, 3.4), 0xb84a30, M4(16.9, y, 0)]); }
  parts.push([new THREE.BoxGeometry(11, 1.2, 1.4), 0x9a9aa8, M4(9.5, 30, 0)]);                                                  // the arm that holds the rocket
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; parts.push([new THREE.CylinderGeometry(0.2, 0.2, 7, 6), 0xd8d8e0, M4(Math.sin(a) * 13, 3.5, Math.cos(a) * 13)]); }   // fire-suppression pipes
  return bakeColored(parts);
}
export function sirenGeometry() { // two bulbs: blue left, red right (colour animated by the material)
  return bakeColored([[new THREE.BoxGeometry(0.48, 0.12, 0.26), 0x2a5bff, M4(-0.33, 1.52, -0.2)], [new THREE.BoxGeometry(0.48, 0.12, 0.26), 0xff2030, M4(0.33, 1.52, -0.2)]]);
}

// ---------------------------------------------------------------- the mascot: a hoodie-wearing chibi (height ~1.75 m). Pure white = hoodie (tinted).
export const SKIN = 0xf4bf98, HAIR = 0x2b2140, PANTS = 0x2c3166, HOODIE = 0xff6b57;
export function mascotParts(hoodie = 0xffffff, lo = false) {
  const S = (n) => (lo ? Math.max(4, Math.round(n / 2)) : n);   // segment counts; the crowd uses the low version
  const torso = [
    [new THREE.CapsuleGeometry(0.27, 0.42, 2, S(12)), hoodie, M4(0, 1.12, 0, 0, 0, 0, 1.08, 1, 0.82)],
    [new THREE.SphereGeometry(0.2, S(12), S(8)), hoodie, M4(0, 1.47, -0.13, 0, 0, 0, 1.3, 0.9, 0.9)],                        // hood behind the neck
    [new THREE.BoxGeometry(0.3, 0.12, 0.05), hoodie === 0xffffff ? 0xd8d8de : 0xe2513f, M4(0, 0.98, 0.215)],          // pocket
    [new THREE.CylinderGeometry(0.012, 0.012, 0.16, 4), 0xfff1ea, M4(-0.06, 1.35, 0.22)], [new THREE.CylinderGeometry(0.012, 0.012, 0.16, 4), 0xfff1ea, M4(0.06, 1.35, 0.22)],
    [new THREE.SphereGeometry(0.3, S(16), S(12)), SKIN, M4(0, 1.78, 0.02)],                                                    // head
    [new THREE.SphereGeometry(0.315, S(16), S(10), 0, Math.PI * 2, 0, Math.PI * 0.55), HAIR, M4(0, 1.8, -0.01, -0.25)],         // hair cap
    [new THREE.SphereGeometry(0.075, S(8), S(6)), 0xf8f8fb, M4(-0.1, 1.8, 0.27, 0, 0, 0, 0.8, 1.1, 0.5)], [new THREE.SphereGeometry(0.075, S(8), S(6)), 0xf8f8fb, M4(0.1, 1.8, 0.27, 0, 0, 0, 0.8, 1.1, 0.5)],
    [new THREE.SphereGeometry(0.042, S(8), S(6)), 0x1d1b2e, M4(-0.1, 1.79, 0.305)], [new THREE.SphereGeometry(0.042, S(8), S(6)), 0x1d1b2e, M4(0.1, 1.79, 0.305)],
    [new THREE.BoxGeometry(0.08, 0.015, 0.02), 0x9a4a3a, M4(0, 1.66, 0.3)],                                              // mouth
    [new THREE.SphereGeometry(0.05, S(6), S(6)), 0xe3a27c, M4(-0.3, 1.77, 0)], [new THREE.SphereGeometry(0.05, S(6), S(6)), 0xe3a27c, M4(0.3, 1.77, 0)],
  ];
  const leg = [ // pivot at the hip (y = 0 here), hangs down 0.82
    [new THREE.CapsuleGeometry(0.1, 0.5, 2, S(8)), PANTS, M4(0, -0.38, 0)],
    [new THREE.BoxGeometry(0.17, 0.11, 0.3), 0xf7f7fb, M4(0, -0.78, 0.05)],
    [new THREE.BoxGeometry(0.175, 0.03, 0.31), 0xc9cede, M4(0, -0.83, 0.05)],
  ];
  const arm = [ // pivot at the shoulder
    [new THREE.CapsuleGeometry(0.085, 0.42, 2, S(8)), hoodie, M4(0, -0.27, 0)],
    [new THREE.SphereGeometry(0.075, S(8), S(6)), SKIN, M4(0, -0.58, 0.01)],
  ];
  return { torso: bakeColored(torso), leg: bakeColored(leg), arm: bakeColored(arm) };
}
export const MASCOT_JOINTS = { hipY: 0.82, hipX: 0.12, shoulderY: 1.38, shoulderX: 0.33 };

// A hierarchical mascot for the player (separate meshes so limbs swing).
export function buildMascot(hoodie = HOODIE) {
  const g = mascotParts(hoodie), mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const torso = new THREE.Mesh(g.torso, mat); body.add(torso);
  const J = MASCOT_JOINTS, limbs = {};
  for (const [name, geo, x, y] of [['legL', g.leg, -J.hipX, J.hipY], ['legR', g.leg, J.hipX, J.hipY], ['armL', g.arm, -J.shoulderX, J.shoulderY], ['armR', g.arm, J.shoulderX, J.shoulderY]]) {
    const piv = new THREE.Group(); piv.position.set(x, y, 0); piv.add(new THREE.Mesh(geo, mat)); body.add(piv); limbs[name] = piv;
  }
  root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { root, body, ...limbs };
}

// ---------------------------------------------------------------- a sport jet (~13 m, forward = +z). Our own design: white, coral and navy.
export function jetGeometry() {
  const parts = [];
  const prof = [[0, -6.4], [0.42, -6.3], [0.62, -5.4], [0.78, -3], [0.82, 0], [0.74, 2.6], [0.55, 4.6], [0.3, 5.9], [0.05, 6.6], [0, 6.62]].map(([r, z]) => new THREE.Vector2(r, z));
  const fus = new THREE.LatheGeometry(prof, 18); fus.rotateX(Math.PI / 2);   // lathe axis y -> +z
  parts.push([fus, 0xf3f2f7, M4(0, 0, 0, 0, 0, 0, 1, 0.9, 1)]);
  parts.push([new THREE.SphereGeometry(0.6, 14, 10), 0x182038, M4(0, 0.55, 2.2, 0, 0, 0, 0.8, 0.75, 2.4)]);                          // canopy
  const wing = new THREE.Shape([new THREE.Vector2(0, 2.2), new THREE.Vector2(5.4, -2.2), new THREE.Vector2(5.4, -3.3), new THREE.Vector2(0, -3.6)]);
  const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.14, bevelEnabled: false }); wg.rotateX(Math.PI / 2);
  parts.push([wg, 0xf3f2f7, M4(0.4, -0.1, -0.5)]); parts.push([wg, 0xf3f2f7, M4(-0.4, -0.24, -0.5, 0, 0, Math.PI)]);
  for (const s of [-1, 1]) { // coral wing stripe and navy tip
    parts.push([new THREE.BoxGeometry(2.2, 0.16, 0.5), 0xff5d6c, M4(s * 3.0, -0.08, -1.0, 0, s * -0.68, 0)]);
    parts.push([new THREE.BoxGeometry(0.3, 0.18, 1.2), 0x1e2a5a, M4(s * 5.6, -0.12, -2.75)]);
    const fin = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(1.6, 0), new THREE.Vector2(0.4, 2.3), new THREE.Vector2(-0.4, 2.3)]);
    const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.1, bevelEnabled: false }); fg.rotateY(-Math.PI / 2);
    parts.push([fg, 0x1e2a5a, M4(s * 0.75, 0.25, -5.5, 0, 0, -s * 0.38)]);
    parts.push([new THREE.BoxGeometry(2.2, 0.1, 1.1), 0xf3f2f7, M4(s * 1.6, -0.05, -5.4, 0, s * -0.3, 0)]);
    parts.push([new THREE.BoxGeometry(0.5, 0.55, 2.2), 0xd9d8e2, M4(s * 0.72, -0.2, 0.6)]);                                         // intakes
    parts.push([new THREE.BoxGeometry(0.4, 0.5, 0.05), 0x10121c, M4(s * 0.72, -0.2, 1.72)]);
  }
  parts.push([new THREE.BoxGeometry(0.2, 0.06, 6.5), 0xff5d6c, M4(0, 0.74, -1.5)]);                                                   // spine stripe
  parts.push([new THREE.CylinderGeometry(0.55, 0.45, 0.6, 14), 0x3a3a46, M4(0, 0, -6.45, Math.PI / 2, 0, 0)]);                      // nozzle
  return bakeColored(parts);
}
export function jetGearGeometry() {
  const parts = [];
  for (const [x, z] of [[0, 3.6], [-1.6, -1.2], [1.6, -1.2]]) { parts.push([new THREE.CylinderGeometry(0.06, 0.06, 1.0, 6), 0x9a9aa8, M4(x, -0.95, z)]); parts.push([new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12), 0x16151c, M4(x, -1.45, z, 0, 0, Math.PI / 2)]); }
  return bakeColored(parts);
}

// ---------------------------------------------------------------- helicopter (forward +z) with a separate rotor
export function heliGeometry() {
  return bakeColored([
    [new THREE.SphereGeometry(1.4, 16, 12), 0x26305e, M4(0, 1.6, 0.6, 0, 0, 0, 1, 1, 1.6)],
    [new THREE.SphereGeometry(1.2, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0x9fd8ff, M4(0, 1.75, 1.7, 1.1, 0, 0, 0.9, 1, 1)],
    [new THREE.CylinderGeometry(0.22, 0.42, 5.2, 8), 0x26305e, M4(0, 1.9, -3.4, Math.PI / 2, 0, 0)],
    [new THREE.BoxGeometry(0.12, 1.4, 0.8), 0xffc24a, M4(0, 2.5, -5.8)],
    [new THREE.BoxGeometry(2.6, 0.3, 0.5), 0xf2f2f6, M4(0, 1.5, 0.6)],
    [new THREE.BoxGeometry(0.1, 0.1, 3.6), 0x1a1a22, M4(-1.0, 0.1, 0.6)], [new THREE.BoxGeometry(0.1, 0.1, 3.6), 0x1a1a22, M4(1.0, 0.1, 0.6)],
    [new THREE.BoxGeometry(0.08, 0.7, 0.08), 0x1a1a22, M4(-0.9, 0.45, 1.4)], [new THREE.BoxGeometry(0.08, 0.7, 0.08), 0x1a1a22, M4(0.9, 0.45, 1.4)],
    [new THREE.BoxGeometry(0.08, 0.7, 0.08), 0x1a1a22, M4(-0.9, 0.45, -0.2)], [new THREE.BoxGeometry(0.08, 0.7, 0.08), 0x1a1a22, M4(0.9, 0.45, -0.2)],
    [new THREE.CylinderGeometry(0.15, 0.15, 0.5, 8), 0x1a1a22, M4(0, 3.1, 0.5)],
  ]);
}
export function rotorGeometry(len = 10, w = 0.3) { return bakeColored([[new THREE.BoxGeometry(len, 0.05, w), 0x22222a], [new THREE.BoxGeometry(w, 0.05, len), 0x22222a]]); }

// ---------------------------------------------------------------- speedboat (forward +z, waterline y = 0)
export function boatGeometry() {
  const hull = new THREE.Shape([new THREE.Vector2(-1.3, -3.6), new THREE.Vector2(1.3, -3.6), new THREE.Vector2(1.3, 1.6), new THREE.Vector2(0, 4.2), new THREE.Vector2(-1.3, 1.6)]);
  const hg = new THREE.ExtrudeGeometry(hull, { depth: 1.0, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 2 }); hg.rotateX(Math.PI / 2);
  return bakeColored([
    [hg, 0xffffff, M4(0, 0.7, 0)],
    [new THREE.BoxGeometry(2.6, 0.12, 7.4), 0x1e2a5a, M4(0, -0.15, 0.2)],
    [new THREE.BoxGeometry(2.0, 0.6, 2.0), 0xf0eee8, M4(0, 1.0, -0.6)],
    [new THREE.BoxGeometry(1.9, 0.5, 0.1), 0x1a2236, M4(0, 1.25, 0.5, -0.5, 0, 0)],
    [new THREE.BoxGeometry(2.2, 0.08, 2.4), 0x8a5a3a, M4(0, 0.76, -2.2)],
  ]);
}

// ---------------------------------------------------------------- street props
export function coneGeometry() { return bakeColored([[new THREE.ConeGeometry(0.22, 0.7, 10), 0xff7a1a, M4(0, 0.38, 0)], [new THREE.CylinderGeometry(0.135, 0.165, 0.12, 10), 0xf5f5f5, M4(0, 0.42, 0)], [new THREE.BoxGeometry(0.5, 0.04, 0.5), 0xff7a1a, M4(0, 0.02, 0)]]); }
export function binGeometry() { return bakeColored([[new THREE.CylinderGeometry(0.32, 0.27, 0.95, 12), 0x2f7a5a, M4(0, 0.48, 0)], [new THREE.CylinderGeometry(0.35, 0.35, 0.08, 12), 0x245a44, M4(0, 0.98, 0)]]); }
export function signGeometry() { return bakeColored([[new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6), 0x9a9aa8, M4(0, 1.15, 0)], [new THREE.BoxGeometry(0.55, 0.55, 0.04), 0xffd23a, M4(0, 2.1, 0, 0, 0, Math.PI / 4)]]); }
export function hydrantGeometry() { return bakeColored([[new THREE.CylinderGeometry(0.14, 0.17, 0.62, 10), 0xe23a3a, M4(0, 0.31, 0)], [new THREE.SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xe23a3a, M4(0, 0.62, 0)], [new THREE.CylinderGeometry(0.06, 0.06, 0.38, 6), 0xe23a3a, M4(0, 0.4, 0, 0, 0, Math.PI / 2)]]); }
