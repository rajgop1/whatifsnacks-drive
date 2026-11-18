// The map: one source of truth for where roads, blocks, the beach, the bay bridge, the island and the airport are.
// Everything else (meshes, traffic, radar, collisions) reads from here. Units are metres, y up, north = -z.
import { makeRng, clamp } from './util.js';

// FULL = the big desktop map (bay bridge, island, airport). The default is the lean ~600 m district used by the daily drive run.
export const FULL = typeof location !== 'undefined' && new URLSearchParams(location.search).get('world') === 'full';
export const P = 100;            // block pitch (road centre to road centre)
export const RW = 18;            // road width (two lanes each way)
export const SW = 4;             // sidewalk width
export const LANE = 4.4;         // AI lane offset from the road centre line (right-hand traffic)
export const XI = FULL ? [-9, 9] : [-3, 3];       // road lines x = i*P
export const ZJ = FULL ? [-9, 5] : [-3, 3];       // road lines z = j*P (the last one is the beach boulevard)
export const LAND = { x0: XI[0] * P - 50, x1: XI[1] * P + 50, z0: ZJ[0] * P - 50, z1: ZJ[1] * P + 20 };
export const BEACH = { z0: LAND.z1 - 7, z1: LAND.z1 + 120 };   // boardwalk, then sand to the water
export const WATER_Y = -1.2;
export const BRIDGE = FULL ? { x0: 950, x1: 1750, z: -300, w: 20, h: 26 } : { x0: 1e9, x1: 1e9, z: 1e9, w: 0, h: 0 };
export const ISLAND = FULL ? { x0: 1750, x1: 2250, z0: -560, z1: -40 } : { x0: 1e9, x1: 1e9, z0: 1e9, z1: 1e9 };
export const AIRPORT = FULL ? { x0: -2300, x1: -950, z0: -950, z1: 560 } : { x0: 1e9, x1: 1e9, z0: 1e9, z1: 1e9 };
export const RUNWAY = { x: -1650, z0: -880, z1: 480, w: 46 };
export const APRON = { x0: -1560, x1: -1240, z0: -460, z1: -140 };
export const LIGHTHOUSE = { x: 2205, z: -95 };
export const DOWNTOWN = FULL ? { x: 0, z: -430, r: 400 } : { x: -20, z: -120, r: 230 };
export const SPAWN = { x: 4.4, z: 214, yaw: Math.PI };   // right lane of the x = 0 avenue, just south of an intersection, facing north

// ---- traffic signals: one global cycle. axis 0 = roads along z (north/south traffic), 1 = along x.
const CYCLE = 18;
export function signal(axis, t) {
  const c = ((t % CYCLE) + CYCLE) % CYCLE, k = axis === 0 ? c : (c + 9) % CYCLE;
  return k < 7 ? 'G' : k < 8.5 ? 'Y' : 'R';
}
export const signalPhase = (t) => signal(0, t) + signal(1, t);

// ---- blocks
export const blocks = [];          // { bi, bj, x0, z0, x1, z1, cx, cz, kind }
const r = makeRng(99);
const PARKS = new Set(FULL ? ['2,-2', '3,-2', '2,-1', '-6,1', '-3,-7', '6,-6', '-8,3', '5,2'] : ['1,0', '-3,-3']);
for (let bi = XI[0]; bi < XI[1]; bi++) for (let bj = ZJ[0]; bj < ZJ[1]; bj++) {
  const x0 = bi * P, z0 = bj * P, cx = x0 + P / 2, cz = z0 + P / 2;
  const d = Math.hypot(cx - DOWNTOWN.x, (cz - DOWNTOWN.z) * 1.15);
  let kind = d < DOWNTOWN.r ? 'downtown' : bj === ZJ[1] - 1 ? 'beachfront' : 'low';
  if (PARKS.has(`${bi},${bj}`) || (FULL && kind === 'low' && r() < 0.04)) kind = 'park';
  if (kind === 'low' && r() < (FULL ? 0.08 : 0.1)) kind = 'lot';     // open parking lot
  blocks.push({ bi, bj, x0, z0, x1: x0 + P, z1: z0 + P, cx, cz, kind, dt: d });
}
export const blockAt = (x, z) => {
  const bi = Math.floor(x / P), bj = Math.floor(z / P);
  if (bi < XI[0] || bi >= XI[1] || bj < ZJ[0] || bj >= ZJ[1]) return null;
  return blocks[(bi - XI[0]) * (ZJ[1] - ZJ[0]) + (bj - ZJ[0])];
};

// ---- ground: height and surface
export function bridgeY(x) { const t = (x - BRIDGE.x0) / (BRIDGE.x1 - BRIDGE.x0); return t <= 0 || t >= 1 ? 0 : BRIDGE.h * Math.sin(Math.PI * t) ** 0.8; }
export function onBridge(x, z) { return x > BRIDGE.x0 - 1 && x < BRIDGE.x1 + 1 && Math.abs(z - BRIDGE.z) < BRIDGE.w / 2; }
export function surface(x, z) {   // 'land' | 'sand' | 'bridge' | 'water'
  if (onBridge(x, z)) return 'bridge';
  if (x >= LAND.x0 && x <= LAND.x1 && z >= LAND.z0 && z <= LAND.z1) return 'land';
  if (x >= LAND.x0 && x <= LAND.x1 && z > LAND.z1 && z < BEACH.z1) return 'sand';
  if (x >= AIRPORT.x0 && x <= AIRPORT.x1 && z >= AIRPORT.z0 && z <= AIRPORT.z1) return 'land';
  if (x >= ISLAND.x0 && x <= ISLAND.x1 && z >= ISLAND.z0 && z <= ISLAND.z1) return 'land';
  return 'water';
}
export function sandY(z) { return z <= BEACH.z0 + 8 ? 0 : -2.6 * clamp((z - BEACH.z0 - 8) / (BEACH.z1 - BEACH.z0 - 8), 0, 1) ** 1.3; }
// ---- stunt jump ramps (district map only): (x, z) = centre of the foot, yaw = heading (forward = sin, cos like the car).
// A wedge rises 0 -> h over len, then a short back slope drops to the ground; the landing pad sits pad m past the lip.
// Placed off every AI lane: the empty margin strips outside the ring road and the north-west park.
export const RAMPS = (FULL ? [] : [
  { x: -286, z: -262, yaw: Math.PI / 2 },   // NW park lawn, eastbound from the west strip
  { x: 330, z: 150, yaw: Math.PI },         // east strip, northbound
  { x: 330, z: -150, yaw: 0 },              // east strip, southbound
  { x: -330, z: 50, yaw: Math.PI },         // west strip, northbound
  { x: -330, z: 200, yaw: 0 },              // west strip, southbound toward the beach (run-up clear of ramp 3)
  { x: 120, z: -330, yaw: Math.PI / 2 },    // north waterfront strip, eastbound under the skyline
]).map((r) => {
  const len = 19, back = 8, w = 7, h = 2.2, pad = 42, dx = Math.sin(r.yaw), dz = Math.cos(r.yaw), e = len + back + 1;
  return { ...r, len, back, w, h, pad, padR: 10, dx, dz, lipX: r.x + dx * len, lipZ: r.z + dz * len, padX: r.x + dx * (len + pad), padZ: r.z + dz * (len + pad),
    bx0: Math.min(r.x, r.x + dx * e) - w, bx1: Math.max(r.x, r.x + dx * e) + w, bz0: Math.min(r.z, r.z + dz * e) - w, bz1: Math.max(r.z, r.z + dz * e) + w };
});
// ramp height at (x, z), 0 off every ramp (a bounding-box early-out per ramp keeps it cheap)
export function rampY(x, z) {
  for (let i = 0; i < RAMPS.length; i++) {
    const r = RAMPS[i]; if (x < r.bx0 || x > r.bx1 || z < r.bz0 || z > r.bz1) continue;
    const ox = x - r.x, oz = z - r.z, u = ox * r.dx + oz * r.dz, v = ox * r.dz - oz * r.dx;
    if (u < 0 || u > r.len + r.back || Math.abs(v) > r.w / 2) continue;
    return u <= r.len ? r.h * u / r.len : r.h * (1 - (u - r.len) / r.back);
  }
  return 0;
}
export function groundY(x, z) {
  const s = surface(x, z);
  if (s === 'bridge') return bridgeY(x);
  if (s === 'land') return rampY(x, z);
  if (s === 'sand') return sandY(z);
  return WATER_Y - 3;
}
export const isRoad = (x, z) => {
  if (onBridge(x, z)) return true;
  const mx = ((x % P) + P) % P, mz = ((z % P) + P) % P, h = RW / 2;
  return surface(x, z) === 'land' && x > LAND.x0 && x < LAND.x1 && (mx < h || mx > P - h || mz < h || mz > P - h);
};

// ---- collision: axis-aligned boxes in a hashed grid (cells of 50 m)
const CELL = 50, grid = new Map();
export const solids = [];
const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
export function addSolid(x0, z0, x1, z1, h = 1000, tag = 'wall') {
  const s = { x0, z0, x1, z1, h, tag }; solids.push(s);
  for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) for (let cz = Math.floor(z0 / CELL); cz <= Math.floor(z1 / CELL); cz++) {
    const k = key(cx, cz); let a = grid.get(k); if (!a) grid.set(k, (a = [])); a.push(s);
  }
  return s;
}
// Push a circle (x,z,radius) at height y out of any solid. Returns the contact normal in out {hit,nx,nz,depth} (reused object, no allocation).
const hitOut = { hit: false, nx: 0, nz: 0, depth: 0, x: 0, z: 0, tag: '' };
export function collideCircle(x, z, rad, y = 0) {
  hitOut.hit = false; hitOut.x = x; hitOut.z = z; hitOut.depth = 0;
  const c0x = Math.floor((x - rad) / CELL), c1x = Math.floor((x + rad) / CELL), c0z = Math.floor((z - rad) / CELL), c1z = Math.floor((z + rad) / CELL);
  for (let cx = c0x; cx <= c1x; cx++) for (let cz = c0z; cz <= c1z; cz++) {
    const a = grid.get(key(cx, cz)); if (!a) continue;
    for (let i = 0; i < a.length; i++) {
      const s = a[i]; if (y > s.h) continue;
      const px = clamp(hitOut.x, s.x0, s.x1), pz = clamp(hitOut.z, s.z0, s.z1);
      let dx = hitOut.x - px, dz = hitOut.z - pz, d2 = dx * dx + dz * dz;
      if (d2 >= rad * rad) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-4) { // centre inside the box: push out along the shallowest side
        const l = hitOut.x - s.x0, rr = s.x1 - hitOut.x, t = hitOut.z - s.z0, b = s.z1 - hitOut.z, m = Math.min(l, rr, t, b);
        dx = m === l ? -1 : m === rr ? 1 : 0; dz = m === t ? -1 : m === b ? 1 : 0; d = 0;
        hitOut.x += dx * (m + rad); hitOut.z += dz * (m + rad);
      } else { dx /= d; dz /= d; hitOut.x = px + dx * rad; hitOut.z = pz + dz * rad; }
      hitOut.hit = true; hitOut.nx = dx; hitOut.nz = dz; hitOut.depth = Math.max(hitOut.depth, rad - d); hitOut.tag = s.tag;
    }
  }
  return hitOut;
}
// Is a 3D point inside any solid (used by the plane and the camera)?
export function insideSolid(x, y, z) {
  const a = grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))); if (!a) return false;
  for (let i = 0; i < a.length; i++) { const s = a[i]; if (y < s.h && x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return true; }
  return false;
}

// ---- roads as a graph for AI: intersections at (i*P, j*P); edges along grid lines, plus the bridge and airport spur
export const nodeOk = (i, j) => i >= XI[0] && i <= XI[1] && j >= ZJ[0] && j <= ZJ[1];
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // +x, +z, -x, -z
// Exits from node (i,j): list of direction indices that lead to another node.
export function exits(i, j) {
  const out = [];
  for (let d = 0; d < 4; d++) if (nodeOk(i + DIRS[d][0], j + DIRS[d][1])) out.push(d);
  return out;
}
