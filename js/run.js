// The daily run: a seeded packet route, the scenario's timed events, the chaos meter and drones, the ghost recording,
// the result (time, percent, pips, comment code, share text, challenge link) and an autopilot for capture mode.
import * as L from './layout.js';
import { makeRng, clamp, wrapAngle } from './util.js';
import { CONFIG } from './config.js';
import { pad3 } from './scenarios.js';

// ---------------------------------------------------------------- route
const right = (d) => [-L.DIRS[d][1], L.DIRS[d][0]];
export function makeRoute(day) {
  const rng = makeRng(day * 7919 + 17), pts = [], packets = [], nodes = [];
  const lane = (i, j, d, along) => { const [dx, dz] = L.DIRS[d], [rx, rz] = right(d); return [i * L.P + rx * L.LANE + dx * along, j * L.P + rz * L.LANE + dz * along]; };
  // intro: straight north from the spawn with three packets, the 2nd and 3rd on a gentle weave inside the lane
  pts.push([L.SPAWN.x, L.SPAWN.z]);
  packets.push([L.LANE, L.SPAWN.z - 46], [L.LANE + 1.6, L.SPAWN.z - 80], [L.LANE - 0.4, L.SPAWN.z - 104]);
  let i = 0, j = 2, d = 3; const seen = new Set(['0,2']);
  // through node (0,2) heading north to node (0,1), then 11 random segments
  const legs = 9, packetLegs = new Set([1, 2, 3, 5, 6, 7, 8]);   // tuned so a clean human run is about 1:00
  for (let k = 0; k < legs; k++) {
    const ni = i + L.DIRS[d][0], nj = j + L.DIRS[d][1];
    // choose the turn at the next node
    let ex = L.exits(ni, nj).filter((e) => e !== (d + 2) % 4 && !seen.has(`${ni + L.DIRS[e][0]},${nj + L.DIRS[e][1]}`));
    if (!ex.length) ex = L.exits(ni, nj).filter((e) => e !== (d + 2) % 4);
    const nd = ex[Math.floor(rng() * ex.length)];
    if (k > 0 && packetLegs.has(k)) { const p = lane(i, j, d, 50 + (rng() - 0.5) * 30); packets.push(p); }
    // polyline: lane approach, curved turn through the node, lane exit
    const [dx, dz] = L.DIRS[d], [rx, rz] = right(d), [ndx, ndz] = L.DIRS[nd], [r2x, r2z] = right(nd), Nx = ni * L.P, Nz = nj * L.P;
    const A = [Nx + rx * L.LANE - dx * 14, Nz + rz * L.LANE - dz * 14], X = [Nx + r2x * L.LANE + ndx * 14, Nz + r2z * L.LANE + ndz * 14];
    const K = nd === d ? [(A[0] + X[0]) / 2, (A[1] + X[1]) / 2] : [Nx + (rx + r2x) * L.LANE, Nz + (rz + r2z) * L.LANE];
    for (let s = 0; s <= 6; s++) { const t = s / 6, u = 1 - t; pts.push([u * u * A[0] + 2 * u * t * K[0] + t * t * X[0], u * u * A[1] + 2 * u * t * K[1] + t * t * X[1]]); }
    nodes.push([ni, nj, pts.length - 4]);
    i = ni; j = nj; d = nd; seen.add(`${i},${j}`);
  }
  const [dx, dz] = L.DIRS[d]; pts.push([pts[pts.length - 1][0] + dx * 60, pts[pts.length - 1][1] + dz * 60]);
  return { pts, packets: packets.slice(0, 10), nodes };
}

// ---------------------------------------------------------------- ghost encoding (5 Hz, 0.25 m steps, base64url)
export const GHOST_HZ = 5;
export function encodeGhost(day, time, pct, pips, samples) {
  const n = samples.length, b = new Uint8Array(11 + 5 + Math.max(0, n - 1) * 3); let o = 0;
  const u16 = (v) => { v = clamp(Math.round(v), 0, 65535); b[o++] = v >> 8; b[o++] = v & 255; }, i16 = (v) => u16((Math.round(v) + 65536) % 65536);
  b[o++] = 1; u16(day); u16(time * 10); b[o++] = clamp(Math.round(pct), 0, 255); b[o++] = pips; u16(n); b[o++] = 0; b[o++] = 0;
  if (n) {
    let qx = Math.round(samples[0][0] * 4), qz = Math.round(samples[0][1] * 4); i16(qx); i16(qz); b[o++] = Math.round(((samples[0][2] % 6.2832) + 6.2832) % 6.2832 / 6.2832 * 255);
    for (let k = 1; k < n; k++) {
      const tx = Math.round(samples[k][0] * 4), tz = Math.round(samples[k][1] * 4), dx = clamp(tx - qx, -127, 127), dz = clamp(tz - qz, -127, 127); qx += dx; qz += dz;
      b[o++] = (dx + 256) % 256; b[o++] = (dz + 256) % 256; b[o++] = Math.round(((samples[k][2] % 6.2832) + 6.2832) % 6.2832 / 6.2832 * 255);
    }
  }
  let s = ''; for (let k = 0; k < o; k++) s += String.fromCharCode(b[k]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function decodeGhost(str) {
  try {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/')), b = Uint8Array.from(s, (c) => c.charCodeAt(0)); let o = 0;
    const u16 = () => (b[o++] << 8) | b[o++], i16 = () => { const v = u16(); return v > 32767 ? v - 65536 : v; };
    if (b.length < 9 || b[o++] !== 1) return null;   // a link cut short in a chat is dropped, not half-read
    const day = u16(), time = u16() / 10, pct = b[o++], pips = b[o++], n = u16(); o += 2;
    const samples = []; if (n) { let qx = i16(), qz = i16(); samples.push([qx / 4, qz / 4, b[o++] / 255 * 6.2832]); for (let k = 1; k < n && o + 2 < b.length; k++) { const dx = b[o++], dz = b[o++]; qx += dx > 127 ? dx - 256 : dx; qz += dz > 127 ? dz - 256 : dz; samples.push([qx / 4, qz / 4, b[o++] / 255 * 6.2832]); } }
    return { day, time, pct, pips, samples };
  } catch { return null; }
}
export function ghostAt(g, t, out) {
  const f = t * GHOST_HZ, k = Math.floor(f), s = g.samples; if (!s.length) return false;
  if (k >= s.length - 1) { const z = s[s.length - 1]; out[0] = z[0]; out[1] = z[1]; out[2] = z[2]; return t < g.time + 1.5; }
  const a = s[Math.max(0, k)], b = s[k + 1], u = f - k; out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u; out[2] = a[2] + wrapAngle(b[2] - a[2]) * u; return true;
}

// ---------------------------------------------------------------- codes and share text
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function fnv(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export const fmtTime = (t) => { const s = Math.round(t); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
export function commentCode(day, time, pct, pips, ghost) {
  let h = fnv(`${day}|${Math.round(time * 10)}|${pct}|${pips}|${ghost}`), c = '';
  for (let k = 0; k < 4; k++) { c += B32[h & 31]; h >>>= 5; }
  return `WIS-${pad3(day)}-${fmtTime(time).replace(':', '')}-${c}`;
}
export function challengeLink(day, ghost) { const base = location.href.split('#')[0].split('?')[0]; return `${base}#d=${day}&g=${ghost}`; }
export function shareText(day, time, pct, pips, link) {
  return `${CONFIG.shareName} #${pad3(day)}, ${pct}% in ${fmtTime(time)}, ${pips} ${pips === 1 ? 'pip' : 'pips'}, beat my ghost: ${link}`;
}

// ---------------------------------------------------------------- autopilot: pure pursuit along the route polyline
export function autopilot(car, route, state, out) {
  const P = route.pts; let best = state.idx || 0, bd = 1e9;
  for (let k = Math.max(0, best - 2); k < Math.min(P.length, best + 14); k++) { const d = Math.hypot(P[k][0] - car.x, P[k][1] - car.z); if (d < bd) { bd = d; best = k; } }
  state.idx = best;
  const look = 7 + car.speed * 0.45; let k = best, acc = 0;
  while (k < P.length - 1 && acc < look) { acc += Math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]); k++; }
  let t = P[k];
  // a packet close ahead wins over the lane line
  const pk = state.packet; if (pk) { const dx = pk.x - car.x, dz = pk.z - car.z, d = Math.hypot(dx, dz); if (d < 45 && (dx * Math.sin(car.yaw) + dz * Math.cos(car.yaw)) > d * 0.5 && [0.25, 0.5, 0.75].every((f) => L.isRoad(car.x + dx * f, car.z + dz * f))) t = [pk.x, pk.z]; }
  const want = Math.atan2(t[0] - car.x, t[1] - car.z), diff = wrapAngle(want - car.yaw);
  // slow for upcoming bends
  let bend = 0; for (let m = best; m < Math.min(P.length - 2, best + 10); m++) { const a = Math.atan2(P[m + 1][0] - P[m][0], P[m + 1][1] - P[m][1]), b = Math.atan2(P[m + 2][0] - P[m + 1][0], P[m + 2][1] - P[m + 1][1]); bend += Math.abs(wrapAngle(b - a)); }
  let target = bend > 0.8 ? 15 : bend > 0.3 ? 22 : state.cruise || 30;
  // obey the lights: find the next signalled intersection on the route and stop at its line on amber/red
  state.waiting = false;
  if (state.time !== undefined) for (const [i, j, pi] of route.nodes) {
    if (pi < best - 3) continue;
    const nx = i * L.P, nz = j * L.P, fx = Math.sin(car.yaw), fz = Math.cos(car.yaw), along = (nx - car.x) * fx + (nz - car.z) * fz;
    if (along < 0) continue;
    const lit = i > L.XI[0] && i < L.XI[1] && j > L.ZJ[0] && j < L.ZJ[1], axis = Math.abs(fx) > Math.abs(fz) ? 1 : 0, sg = L.signal(axis, state.time);
    if (lit && along > 12 && along < 60 && (sg === 'R' || (sg === 'Y' && along > 24))) { target = Math.min(target, Math.max(0, (along - 15.5) * 0.9)); state.waiting = true; }
    break;
  }
  out.steer = clamp(-diff * 2.6, -1, 1); out.throttle = car.speed < target ? 1 : 0; out.brake = car.speed > target + 3 ? 0.6 : target < 0.5 ? 1 : 0; out.handbrake = false;
  if (car.speed < 1 && state.t > 2 && !state.waiting) { state.stuck = (state.stuck || 0) + 1 / 60; if (state.stuck > 1.5) { out.throttle = 0; out.brake = 1; out.steer = -out.steer; if (state.stuck > 2.6) state.stuck = 0; } } else state.stuck = 0;
}
