// Canvas textures for the city. Each facade texture comes as a pair: a colour map (daytime look) and an emissive map (lit windows only),
// one tile = 24 m wide x 56 m tall (8 bays x 16 floors). The bottom-left texel is the roof colour (used by GeoBuilder.roofUV).
import { canvas, tex, makeRng } from './util.js';

const r = makeRng(4242);
const LIT = ['#ffd9a0', '#ffe6bd', '#ffcf8a', '#cfe6ff', '#f6f0ff', '#ffb98a', '#ff9ac8'];

function facade(kind) {
  const W = 512, H = 512, cw = W / 8, ch = H / 16, c = canvas(W, H), e = canvas(W, H), g = c.getContext('2d'), ge = e.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  if (kind === 'office') {
    g.fillStyle = '#8c86a0'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
      const X = x * cw + 6, Y = y * ch + 5, w = cw - 12, h = ch - 9, gr = g.createLinearGradient(0, Y, 0, Y + h);
      gr.addColorStop(0, '#41527a'); gr.addColorStop(1, '#1b2238'); g.fillStyle = gr; g.fillRect(X, Y, w, h);
      g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(X, Y, w, 3);
      if (r() < 0.42) { const col = r.pick(LIT); ge.fillStyle = col; ge.fillRect(X, Y, w, h); if (r() < 0.5) { ge.fillStyle = 'rgba(0,0,0,0.45)'; for (let k = 0; k < h; k += 4) ge.fillRect(X, Y + k, w, 1.5); } }
      g.fillStyle = '#6e6884'; g.fillRect(x * cw, y * ch + ch - 4, cw, 4);
    }
  } else if (kind === 'glass') {
    for (let y = 0; y < 16; y++) {
      const gr = g.createLinearGradient(0, y * ch, 0, y * ch + ch); gr.addColorStop(0, '#6f92b8'); gr.addColorStop(0.5, '#3a5d86'); gr.addColorStop(1, '#25405f');
      g.fillStyle = gr; g.fillRect(0, y * ch, W, ch);
      const lit = r() < 0.38, part = r();
      for (let x = 0; x < 16; x++) if (lit && (part > 0.5 || r() < 0.55)) { ge.fillStyle = r() < 0.7 ? '#dff0ff' : '#ffe2b0'; ge.fillRect(x * 32 + 2, y * ch + 4, 28, ch - 8); }
      g.fillStyle = '#16202e'; g.fillRect(0, y * ch + ch - 4, W, 4);
    }
    g.fillStyle = 'rgba(20,30,46,0.9)'; for (let x = 0; x < 16; x++) g.fillRect(x * 32, 0, 2, H);
    g.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 6; i++) { const x = r() * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 60, 0); g.lineTo(x - 100, H); g.lineTo(x - 160, H); g.fill(); }
  } else { // 'resi': pastel stucco hotels and apartments: smaller windows, balconies, deco ledges
    g.fillStyle = '#f2ece6'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < 16; y++) {
      g.fillStyle = 'rgba(120,100,120,0.18)'; g.fillRect(0, y * ch + ch - 3, W, 3);
      for (let x = 0; x < 8; x++) {
        const X = x * cw + 14, Y = y * ch + 7, w = cw - 28, h = ch - 13;
        g.fillStyle = '#2c3552'; g.fillRect(X, Y, w, h); g.fillStyle = 'rgba(160,200,255,0.25)'; g.fillRect(X, Y, w, 3);
        g.fillStyle = '#d8d0cc'; g.fillRect(X - 3, Y + h, w + 6, 3);
        if (x % 2 === 0) { g.fillStyle = 'rgba(70,60,80,0.55)'; g.fillRect(X - 6, Y + h - 6, w + 12, 2); }
        if (r() < 0.36) { ge.fillStyle = r.pick(LIT); ge.fillRect(X, Y, w, h); if (r() < 0.4) { ge.fillStyle = 'rgba(0,0,0,0.5)'; ge.fillRect(X, Y, w * 0.45, h); } }
      }
    }
  }
  // roof texel (bottom-left)
  g.fillStyle = '#7b7487'; g.fillRect(0, H - 6, 6, 6); ge.fillStyle = '#000'; ge.fillRect(0, H - 6, 6, 6);
  return { map: tex(c), emissive: tex(e) };
}

// Shop fronts for the ground floor: tile = 24 m x 6 m.
function storefront() {
  const W = 512, H = 128, c = canvas(W, H), e = canvas(W, H), g = c.getContext('2d'), ge = e.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  g.fillStyle = '#3a3346'; g.fillRect(0, 0, W, H);
  const aw = ['#ff5d6c', '#2ec4a6', '#ffb347', '#6c8cff', '#ff7ac8', '#f2f2f2'];
  for (let s = 0; s < 4; s++) {
    const X = s * 128, col = r.pick(aw);
    g.fillStyle = '#1a1e2c'; g.fillRect(X + 8, 42, 112, 78);
    const lit = r.pick(['#ffe2b0', '#fff4dc', '#ffd0e6', '#d6f0ff']);
    ge.fillStyle = lit; ge.fillRect(X + 10, 46, 70, 70); ge.fillRect(X + 92, 50, 22, 66);
    ge.fillStyle = 'rgba(60,40,50,0.55)'; for (let k = 0; k < 3; k++) ge.fillRect(X + 12, 62 + k * 18, 66, 3);              // shelves
    for (let k = 0; k < 2; k++) if (r() < 0.6) { const px = X + 18 + r() * 50; ge.fillStyle = 'rgba(40,25,40,0.7)'; ge.beginPath(); ge.arc(px, 82, 6, 0, 7); ge.fill(); ge.fillRect(px - 7, 88, 14, 28); }   // shoppers
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(X + 14, 116); g.lineTo(X + 40, 46); g.lineTo(X + 52, 46); g.lineTo(X + 26, 116); g.fill();
    g.fillStyle = 'rgba(255,240,220,0.18)'; g.fillRect(X + 10, 46, 70, 70);
    g.fillStyle = '#5a4f66'; g.fillRect(X + 84, 44, 6, 76);
    for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? col : '#f7f3ee'; g.fillRect(X + 4 + k * 15, 18, 15, 22); }
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(X + 4, 38, 120, 4);
    g.fillStyle = '#2a2433'; g.fillRect(X, 0, 128, 16); ge.fillStyle = col; ge.globalAlpha = 0.6; ge.fillRect(X + 20, 4, 88, 8); ge.globalAlpha = 1;
  }
  g.fillStyle = '#7b7487'; g.fillRect(0, H - 4, 4, 4);
  return { map: tex(c), emissive: tex(e) };
}

export function buildingTextures() { return { office: facade('office'), glass: facade('glass'), resi: facade('resi'), store: storefront() }; }

// Road tile: one block (100 m) with half a road on every edge, sidewalks, crosswalks, lane paint. Second canvas = lamp pools (emissive at night).
export function roadTextures(P, RW, SW, lampSpots) {
  const S = 1024, k = S / P, c = canvas(S), e = canvas(S), g = c.getContext('2d'), ge = e.getContext('2d'), h = RW / 2;
  g.fillStyle = '#5d5a62'; g.fillRect(0, 0, S, S);                          // lot ground (concrete) — buildings cover most of it
  // sidewalks
  g.fillStyle = '#a49aa6'; g.fillRect(0, 0, S, (h + SW) * k); g.fillRect(0, S - (h + SW) * k, S, (h + SW) * k); g.fillRect(0, 0, (h + SW) * k, S); g.fillRect(S - (h + SW) * k, 0, (h + SW) * k, S);
  g.strokeStyle = 'rgba(70,60,80,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < P; i += 2) { g.beginPath(); g.moveTo(i * k, 0); g.lineTo(i * k, (h + SW) * k); g.moveTo(i * k, S); g.lineTo(i * k, S - (h + SW) * k); g.moveTo(0, i * k); g.lineTo((h + SW) * k, i * k); g.moveTo(S, i * k); g.lineTo(S - (h + SW) * k, i * k); g.stroke(); }
  // asphalt with a little grain
  g.fillStyle = '#3f3b4a'; g.fillRect(0, 0, S, h * k); g.fillRect(0, S - h * k, S, h * k); g.fillRect(0, 0, h * k, S); g.fillRect(S - h * k, 0, h * k, S);
  for (let i = 0; i < 9000; i++) { const x = Math.random() * S, y = Math.random() * S; if ((x > h * k && x < S - h * k) && (y > h * k && y < S - h * k)) continue; g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + Math.random() * 0.05})`; g.fillRect(x, y, 2, 2); }
  // curbs
  g.fillStyle = '#c9c0c8'; g.fillRect(0, h * k, S, 0.35 * k); g.fillRect(0, S - h * k - 0.35 * k, S, 0.35 * k); g.fillRect(h * k, 0, 0.35 * k, S); g.fillRect(S - h * k - 0.35 * k, 0, 0.35 * k, S);
  // re-cut the asphalt at the corners (intersections) so curbs stop at the cross street
  g.fillStyle = '#3f3b4a'; for (const [x, y] of [[0, 0], [S - h * k, 0], [0, S - h * k], [S - h * k, S - h * k]]) g.fillRect(x, y, h * k, h * k);
  // centre lines (double yellow) and lane dashes (white), stopping before the crosswalks
  const paint = (x, y, w, hh, col) => { g.fillStyle = col; g.fillRect(x * k, y * k, w * k, hh * k); };
  for (const edge of [0, P]) {
    for (const off of [-0.3, 0.3]) { // double yellow: on the road centre line, which lies on the tile edge; each tile paints its half
      const o = edge + off; if (o < 0 || o > P) continue;
      paint(o - 0.1, h + 5, 0.2, P - 2 * h - 10, '#e8c14a'); paint(h + 5, o - 0.1, P - 2 * h - 10, 0.2, '#e8c14a');
    }
    const lane = edge === 0 ? RW / 4 : P - RW / 4;
    for (let t = h + 6; t < P - h - 8; t += 9) { paint(lane - 0.08, t, 0.16, 4, '#dedae4'); paint(t, lane - 0.08, 4, 0.16, '#dedae4'); }
  }
  // crosswalks at each corner and stop lines
  for (const [cx, cy] of [[0, 0], [P, 0], [0, P], [P, P]]) {
    const sx = cx === 0 ? 1 : -1, sy = cy === 0 ? 1 : -1;
    for (let i = -h + 0.6; i < h - 0.4; i += 1.4) { paint(cx + sx * (h + 1) - (sx < 0 ? 3 : 0), cy + i, 3, 0.75, '#e8e4ee'); paint(cx + i, cy + sy * (h + 1) - (sy < 0 ? 3 : 0), 0.75, 3, '#e8e4ee'); }
    paint(cx + sx * (h + 4.5) - (sx < 0 ? 0.5 : 0), sx > 0 ? cy - h : cy, 0.5, h, '#e8e4ee');   // stop lines on the approach lanes
    paint(sy > 0 ? cx : cx - h, cy + sy * (h + 4.5) - (sy < 0 ? 0.5 : 0), h, 0.5, '#e8e4ee');
  }
  // lamp pools on the emissive layer
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  for (const [x, y, dx, dy] of lampSpots) {
    const px = (x + dx * 2.2) * k, py = (y + dy * 2.2) * k, R = 13 * k, gr = ge.createRadialGradient(px, py, 0, px, py, R);
    gr.addColorStop(0, 'rgba(255,190,120,0.75)'); gr.addColorStop(0.35, 'rgba(255,160,90,0.3)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); ge.fillStyle = gr; ge.fillRect(px - R, py - R, 2 * R, 2 * R);
  }
  const t1 = tex(c, { aniso: 16 }), t2 = tex(e, { aniso: 8 });
  return { map: t1, emissive: t2 };
}

export function noiseTex(base, spots, size = 256, alpha = 0.12, seed = 3) {
  const rr = makeRng(seed), c = canvas(size), g = c.getContext('2d'); g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * size / 6; i++) { g.fillStyle = rr.pick(spots); g.globalAlpha = alpha * rr(); g.fillRect(rr() * size, rr() * size, 1 + rr() * 2, 1 + rr() * 2); }
  g.globalAlpha = 1; return c;
}

// Neon sign atlas: 2 columns x 8 rows of 512x128 signs on transparent ground. All names are generic.
export const NEON_WORDS = ['MOTEL', 'NOODLES', 'TACOS', 'SURF', 'DISCO', 'OPEN 24H', 'PALMS', 'ARCADE', 'HOTEL', 'PIZZA', 'SODA', 'CLUB', 'VIDEO', 'DINER', 'GELATO', 'KARAOKE'];
const NEON_COLS = ['#ff4fa3', '#3ff0ff', '#ffe14d', '#ff7a3d', '#b35cff', '#59ff8a', '#ff5370', '#7ab8ff'];
export function neonAtlas() {
  const c = canvas(1024, 1024), g = c.getContext('2d');
  NEON_WORDS.forEach((w, i) => {
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 128, col = NEON_COLS[i % NEON_COLS.length];
    g.save(); g.beginPath(); g.rect(x, y, 512, 128); g.clip();
    g.fillStyle = 'rgba(20,10,30,0.55)'; g.beginPath(); g.roundRect(x + 10, y + 12, 492, 104, 18); g.fill();
    g.strokeStyle = col; g.lineWidth = 5; g.shadowColor = col; g.shadowBlur = 18; g.beginPath(); g.roundRect(x + 18, y + 20, 476, 88, 14); g.stroke();
    g.font = `900 ${w.length > 6 ? 58 : 72}px "Trebuchet MS", "Arial Black", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#fff'; g.shadowBlur = 26; g.fillText(w, x + 256, y + 66); g.shadowBlur = 8; g.fillStyle = col; g.globalAlpha = 0.55; g.fillText(w, x + 256, y + 66);
    g.restore();
  });
  return tex(c, { repeat: false });
}
// Billboards (8 rows of 1024x256). Fictional brands only.
export function billboardAtlas() {
  const c = canvas(1024, 2048), g = c.getContext('2d');
  const ads = [
    ['#ff8a5c', '#ff4f9a', 'WHAT IF?', 'SNACK-SIZED SCIENCE'], ['#3fd0ff', '#4b5cff', 'SUNSET COLA', 'ICE COLD SINCE NEVER'],
    ['#ffe14d', '#ff9a3d', 'FLY HIGH AIR', 'ONE WAY TO THE CLOUDS'], ['#59ff8a', '#1fb6a6', 'PALM BAY FM', 'SYNTHS ALL NIGHT'],
    ['#ff6b57', '#ffb347', 'BYTE BURGER', 'FRESH FROM THE CACHE'], ['#6c8cff', '#1f2756', 'CLOUD NOODLE', 'SLURP AT LINK SPEED'],
    ['#ffd84d', '#ff6b57', 'ORBIT SODA', 'FIZZ IN ZERO-G'], ['#3a8a6a', '#1f2756', 'SNACK BAR 3000', 'OPEN TILL THE BAR FILLS'],
  ];
  ads.forEach(([a, b, t1, t2], i) => {
    const y = i * 256, gr = g.createLinearGradient(0, y, 1024, y + 256); gr.addColorStop(0, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fillRect(0, y, 1024, 256); g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.arc(860, y + 128, 150, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.font = '900 104px "Trebuchet MS", "Arial Black", sans-serif'; g.textBaseline = 'middle'; g.fillText(t1, 46, y + 112);
    g.font = '700 38px "Trebuchet MS", Arial, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillText(t2, 52, y + 196);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 10; g.strokeRect(5, y + 5, 1014, 246);
  });
  return tex(c, { repeat: false });
}

export function palmLeafTexture() {
  const c = canvas(64, 256), g = c.getContext('2d');
  g.strokeStyle = '#3d6b3a'; g.lineWidth = 3; g.beginPath(); g.moveTo(32, 0); g.lineTo(32, 256); g.stroke();
  for (let y = 4; y < 252; y += 5) {
    const w = 30 * Math.sin(Math.PI * (y / 256)) ** 0.6, col = y % 10 < 5 ? '#4f8f45' : '#5fa04e';
    g.strokeStyle = col; g.lineWidth = 3;
    g.beginPath(); g.moveTo(32, y); g.lineTo(32 - w, y + 9); g.moveTo(32, y); g.lineTo(32 + w, y + 9); g.stroke();
  }
  const t = tex(c, { repeat: false }); return t;
}
export function runwayTexture() {
  const c = canvas(256, 2048), g = c.getContext('2d'); g.fillStyle = '#34313a'; g.fillRect(0, 0, 256, 2048);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`; g.fillRect(Math.random() * 256, Math.random() * 2048, 2, 2); }
  g.fillStyle = '#ece8f0';
  for (let y = 200; y < 1848; y += 60) g.fillRect(125, y, 6, 34);                // centre dashes
  g.fillRect(8, 0, 4, 2048); g.fillRect(244, 0, 4, 2048);                          // edge lines
  for (const y0 of [8, 1960]) for (let x = 20; x < 236; x += 20) if (Math.abs(x - 128) > 14) g.fillRect(x, y0, 10, 80);  // thresholds
  g.font = '900 64px Arial'; g.textAlign = 'center'; g.save(); g.translate(128, 140); g.fillText('36', 0, 0); g.restore();
  g.save(); g.translate(128, 1910); g.rotate(Math.PI); g.fillText('18', 0, 0); g.restore();
  for (const y of [400, 1600]) { g.fillRect(60, y, 30, 120); g.fillRect(166, y, 30, 120); }
  return tex(c, { repeat: false, aniso: 16 });
}
