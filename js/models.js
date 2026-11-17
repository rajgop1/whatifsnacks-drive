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

// ---------------------------------------------------------------- cars (forward = +z, ground at y = 0, 4.6 m long)
// Side profile of our coupe (z forward, y up): low nose, long hood, fastback roof, ducktail.
const BODY = [[-2.3, 0.36], [-2.36, 0.56], [-2.34, 0.78], [-2.18, 0.88], [-1.75, 0.93], [-1.42, 0.97], [-1.0, 1.2], [-0.62, 1.33], [-0.2, 1.37], [0.3, 1.35], [0.62, 1.22], [1.02, 0.97], [1.55, 0.88], [2.05, 0.8], [2.3, 0.68], [2.4, 0.5], [2.36, 0.36]];
const GLASS = [[-1.47, 0.96], [-1.0, 1.24], [-0.62, 1.37], [-0.2, 1.41], [0.3, 1.39], [0.65, 1.25], [1.07, 0.96]];
export function carGeometry({ police = false, taxi = false, wheels = true } = {}) {
  const paint = taxi ? 0xffc52e : 0xffffff, dark = 0x17161e, trim = 0x2a2834, chrome = 0xc8ccd8, parts = [];
  parts.push([extrudeSide(BODY, 1.9, 0.12), paint]);
  parts.push([extrudeSide(GLASS, 1.84, 0.05), 0x10141f]);
  parts.push([new THREE.BoxGeometry(1.5, 0.05, 0.75), paint, M4(0, 1.405, -0.18)]);                                      // roof skin over the glass
  for (const s of [-1, 1]) {
    parts.push([new THREE.CylinderGeometry(0.47, 0.47, 0.05, 20, 1, false, 0, Math.PI), dark, M4(s * 0.955, 0.38, 1.42, 0, 0, Math.PI / 2)]);   // arches
    parts.push([new THREE.CylinderGeometry(0.47, 0.47, 0.05, 20, 1, false, 0, Math.PI), dark, M4(s * 0.955, 0.38, -1.42, 0, 0, Math.PI / 2)]);
    parts.push([new THREE.BoxGeometry(0.06, 0.12, 1.9), dark, M4(s * 0.93, 0.36, 0)]);                                  // side skirt
    parts.push([new THREE.BoxGeometry(0.03, 0.035, 1.9), chrome, M4(s * 0.935, 0.975, -0.2)]);                         // belt-line chrome
    parts.push([new THREE.BoxGeometry(0.02, 0.5, 0.025), trim, M4(s * 0.945, 0.72, 0.98)]);                            // door shut lines
    parts.push([new THREE.BoxGeometry(0.02, 0.48, 0.025), trim, M4(s * 0.945, 0.72, -0.72)]);
    parts.push([new THREE.BoxGeometry(0.02, 0.03, 0.18), chrome, M4(s * 0.95, 0.86, 0.3)]);                            // door handle
    parts.push([new THREE.BoxGeometry(0.16, 0.1, 0.22), paint, M4(s * 1.0, 1.02, 0.8)]);                                // mirrors
    parts.push([new THREE.BoxGeometry(0.03, 0.08, 0.18), 0x9ab0d0, M4(s * 1.04, 1.02, 0.78)]);
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
  parts.push([new THREE.BoxGeometry(0.5, 0.025, 1.2), trim, M4(0, 0.905, 1.55, 0.06, 0, 0)]);                           // hood vent
  if (wheels) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    parts.push([new THREE.CylinderGeometry(0.37, 0.37, 0.28, 16), 0x16151c, M4(sx * 0.84, 0.37, sz * 1.42, 0, 0, Math.PI / 2)]);
    parts.push([new THREE.CylinderGeometry(0.24, 0.24, 0.29, 10), 0xb8bcc8, M4(sx * 0.845, 0.37, sz * 1.42, 0, 0, Math.PI / 2)]);
  }
  if (police) parts.push([new THREE.BoxGeometry(1.2, 0.1, 0.3), 0x22222a, M4(0, 1.45, -0.2)]);
  if (taxi) { parts.push([new THREE.BoxGeometry(0.7, 0.2, 0.25), 0xfff2c0, M4(0, 1.52, -0.2)]); for (const s of [-1, 1]) parts.push([new THREE.BoxGeometry(0.02, 0.08, 3.4), 0x1d1b26, M4(s * 0.955, 0.66, 0)]); }
  const g = bakeColored(parts);
  if (police) {
    const p = g.attributes.position, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) if (c.getX(i) + c.getY(i) + c.getZ(i) > 2.99) { if (p.getY(i) < 0.86) c.setXYZ(i, 0.11, 0.14, 0.28); else c.setXYZ(i, 0.95, 0.95, 0.97); }
  }
  return g;
}
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
  const paint = 0xffffff, dark = 0x17161e, trim = 0x2a2834, chrome = 0xc8ccd8, leather = 0x24212d, parts = [];
  parts.push([extrudeSide(ROAD_BODY, 1.92, 0.13), paint]);
  parts.push([new THREE.BoxGeometry(1.46, 0.03, 1.15), 0x121118, M4(0, 0.815, -0.18)]);                                   // cockpit floor
  parts.push([new THREE.BoxGeometry(1.7, 0.13, 0.5), paint, M4(0, 0.87, 0.66, 0.05, 0, 0)]);                              // cowl and dash
  parts.push([new THREE.BoxGeometry(1.52, 0.42, 0.035), 0x1a2236, M4(0, 1.03, 0.66, -0.75, 0, 0)]);                       // low raked windscreen
  for (const s of [-1, 1]) {
    parts.push([new THREE.BoxGeometry(0.05, 0.46, 0.05), dark, M4(s * 0.77, 1.03, 0.66, -0.75, 0, 0)]);                  // A-pillars
    parts.push([new THREE.BoxGeometry(0.52, 0.1, 0.52), leather, M4(s * 0.4, 0.88, -0.12)]);                                // seats
    parts.push([new THREE.BoxGeometry(0.5, 0.52, 0.12), leather, M4(s * 0.4, 1.12, -0.42, -0.16, 0, 0)]);
    parts.push([new THREE.BoxGeometry(0.3, 0.16, 0.1), leather, M4(s * 0.4, 1.46, -0.5)]);
    parts.push([new THREE.SphereGeometry(0.3, 12, 8), paint, M4(s * 0.4, 0.98, -1.3, 0, 0, 0, 0.95, 0.62, 2.0)]);          // twin head fairings
    parts.push([new THREE.CylinderGeometry(0.47, 0.47, 0.05, 20, 1, false, 0, Math.PI), dark, M4(s * 0.965, 0.38, 1.33, 0, 0, Math.PI / 2)]);
    parts.push([new THREE.CylinderGeometry(0.47, 0.47, 0.05, 20, 1, false, 0, Math.PI), dark, M4(s * 0.965, 0.38, -1.3, 0, 0, Math.PI / 2)]);
    parts.push([new THREE.BoxGeometry(0.06, 0.11, 1.9), dark, M4(s * 0.95, 0.35, 0)]);                                     // side skirts
    parts.push([new THREE.BoxGeometry(0.03, 0.03, 1.5), chrome, M4(s * 0.965, 0.76, -0.05)]);                              // belt-line chrome
    parts.push([new THREE.BoxGeometry(0.05, 0.16, 0.7), 0x0e0d14, M4(s * 0.96, 0.55, -0.55)]);                             // side intakes
    parts.push([new THREE.BoxGeometry(0.1, 0.07, 0.18), paint, M4(s * 0.96, 0.93, 0.62)]);                                 // mirrors
    parts.push([new THREE.BoxGeometry(0.34, 0.1, 0.06), dark, M4(s * 0.55, 0.36, -2.2)]);                                  // diffuser fins
  }
  parts.push([new THREE.BoxGeometry(1.5, 0.07, 0.07), dark, M4(0, 1.5, -0.62)]);                                           // roll hoop bar
  parts.push([new THREE.BoxGeometry(0.06, 0.62, 0.06), dark, M4(-0.74, 1.2, -0.62)]); parts.push([new THREE.BoxGeometry(0.06, 0.62, 0.06), dark, M4(0.74, 1.2, -0.62)]);
  parts.push([new THREE.TorusGeometry(0.17, 0.03, 6, 14), dark, M4(-0.4, 1.0, 0.28, -0.95, 0, 0)]);                       // steering wheel
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
