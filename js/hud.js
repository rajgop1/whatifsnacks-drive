// The HUD: DOM for text (crisp at any DPR), one canvas for the rotating radar. Our own flat style: navy panels, sun-yellow and amber accents.
import * as L from './layout.js';
import { CONFIG } from './config.js';
import { pad3 } from './scenarios.js';
import { fmtTime } from './run.js';

const $ = (id) => document.getElementById(id);
// The chaos pip: an original icon (a hexagonal drone puck with a spark), not a star.
const PIP = '<svg viewBox="0 0 24 24"><path class="f" stroke-width="1.6" d="M12 1.8 21 7v10l-9 5.2L3 17V7z"/><path class="s" d="M13.2 5.5 8.4 13h3.2l-1 5.5 5-7.6h-3.3z"/></svg>';

export class Hud {
  constructor() {
    this.el = $('hud'); this.radar = $('radar'); this.rg = this.radar.getContext('2d'); this.toastT = 0; this.radioT = 0; this.flash = 0;
    $('pips').innerHTML = Array.from({ length: 5 }, () => `<span class="pip">${PIP}</span>`).join('');
    this.pipEls = [...document.querySelectorAll('#pips .pip')]; this.lastPips = 0;
    this.drawFace(); this.buildMap();
  }
  drawFace(mouth = 0, blink = false) { // the hoodie mascot on the radio (mouth 0..1 while talking)
    const g = this.fg || (this.fg = $('face').getContext('2d')), c = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
    g.fillStyle = '#1f2756'; g.fillRect(0, 0, 92, 92);
    g.fillStyle = '#ff6b57'; g.beginPath(); g.ellipse(46, 98, 40, 30, 0, 0, 7); g.fill(); g.fillStyle = '#e2513f'; g.beginPath(); g.ellipse(46, 72, 28, 12, 0, 0, 7); g.fill();
    c(46, 46, 24, '#f4bf98'); g.fillStyle = '#2b2140'; g.beginPath(); g.arc(46, 42, 25, Math.PI * 1.02, Math.PI * 1.98); g.fill();
    if (blink) { g.strokeStyle = '#1d1b2e'; g.lineWidth = 2; g.beginPath(); g.moveTo(33, 48); g.lineTo(41, 48); g.moveTo(51, 48); g.lineTo(59, 48); g.stroke(); }
    else { c(37, 48, 4.8, '#fff'); c(55, 48, 4.8, '#fff'); c(38, 48.5, 2.8, '#1d1b2e'); c(56, 48.5, 2.8, '#1d1b2e'); }
    if (mouth > 0.05) { g.fillStyle = '#7a2a2a'; g.beginPath(); g.ellipse(46, 57, 5.5, 1.5 + mouth * 4.5, 0, 0, 7); g.fill(); g.fillStyle = '#ff8a8a'; g.beginPath(); g.ellipse(46, 58.5 + mouth * 2, 3, 1 + mouth * 1.5, 0, 0, 7); g.fill(); }
    else { g.strokeStyle = '#9a4a3a'; g.lineWidth = 2; g.beginPath(); g.arc(46, 56, 6, 0.2, Math.PI - 0.2); g.stroke(); }
    g.strokeStyle = '#141a3a'; g.lineWidth = 4; g.beginPath(); g.arc(46, 44, 27, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); c(19, 48, 6, '#141a3a'); c(73, 48, 6, '#141a3a');
  }
  buildMap() { // a flat street map of the district, drawn once
    const S = 2, X0 = L.LAND.x0 - 100, Z0 = L.LAND.z0 - 100, W = (L.LAND.x1 - L.LAND.x0 + 200) * S, H = (L.BEACH.z1 - L.LAND.z0 + 200) * S;
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'), m = (v, o) => (v - o) * S;
    g.fillStyle = '#3d6f8f'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#e9c9a0'; g.fillRect(m(L.LAND.x0 - 100, X0), m(L.LAND.z1 - 10, Z0), (L.LAND.x1 - L.LAND.x0 + 200) * S, 70 * S);
    g.fillStyle = '#4a4466'; g.fillRect(m(L.LAND.x0, X0), m(L.LAND.z0, Z0), (L.LAND.x1 - L.LAND.x0) * S, (L.LAND.z1 - L.LAND.z0) * S);
    for (const b of L.blocks) { if (b.kind === 'park') { g.fillStyle = '#5f9a5a'; g.fillRect(m(b.x0 + 9, X0), m(b.z0 + 9, Z0), (L.P - 18) * S, (L.P - 18) * S); } }
    g.fillStyle = '#9b8fb8'; for (const s of L.solids) if (s.tag === 'building') g.fillRect(m(s.x0, X0), m(s.z0, Z0), (s.x1 - s.x0) * S, (s.z1 - s.z0) * S);
    g.fillStyle = '#f4ecf8';
    for (let i = L.XI[0]; i <= L.XI[1]; i++) g.fillRect(m(i * L.P - 6, X0), m(L.ZJ[0] * L.P - 6, Z0), 12 * S, ((L.ZJ[1] - L.ZJ[0]) * L.P + 12) * S);
    for (let j = L.ZJ[0]; j <= L.ZJ[1]; j++) g.fillRect(m(L.XI[0] * L.P - 6, X0), m(j * L.P - 6, Z0), ((L.XI[1] - L.XI[0]) * L.P + 12) * S, 12 * S);
    this.map = c; this.mapS = S; this.mapX0 = X0; this.mapZ0 = Z0;
  }
  show(on) { this.el.classList.toggle('on', on); }
  mission(label, text) { $('mlabel').textContent = label; $('mtext').textContent = text; }
  meter(name, pct, pulse, flash) { if (flash) { const b = $('barwrap'); b.classList.remove('gain'); void b.offsetWidth; b.classList.add('gain'); } $('blabel').textContent = name; $('bpct').textContent = Math.round(pct) + '%'; $('fill').style.width = pct + '%'; $('barwrap').classList.toggle('pulse', !!pulse); }
  timer(sec, on) { const t = $('timer'); t.textContent = fmtTime(Math.max(0, Math.ceil(sec))); t.classList.toggle('off', !on); t.classList.toggle('low', on && sec < 10); }
  pips(n) { this.pipEls.forEach((p, i) => { p.classList.toggle('on', i < n); if (i === n - 1 && n > this.lastPips) { p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); } }); this.lastPips = n; }
  radio(text, dur = 3.2) { this.sayText = text; this.sayN = 0; $('say').textContent = ''; $('radio').classList.add('on'); this.radioT = dur + text.length / 38; this.talkT = 0; }
  toast(big, small = '', dur = 1.8) { $('toast').innerHTML = `${small ? `<small>${small}</small>` : ''}${big}`; $('toast').classList.add('on'); this.toastT = dur; }
  // rising pop text: kind '' (sun, packets) | 'hit' (coral, crashes) | 'near' (mint, near misses)
  plus(text, kind = '') { const d = document.createElement('div'); d.className = 'plus ' + kind; d.textContent = text; this.el.appendChild(d); setTimeout(() => d.remove(), 1000); }
  hint(on) { $('hint').classList.toggle('on', on); }
  speed(kmh) { $('kmh').textContent = kmh; }
  flashRadar() { this.flash = 2.5; }
  update(dt) {
    if (this.sayText !== undefined && this.radioT > 0) { // typewriter subtitle + talking mouth, ~20 redraws a second
      this.talkT += dt; const n = Math.min(this.sayText.length, Math.floor(this.talkT * 38));
      if (n !== this.sayN) { this.sayN = n; $('say').textContent = this.sayText.slice(0, n); }
      this.faceT = (this.faceT || 0) + dt;
      if (this.faceT > 0.05) { this.faceT = 0; const talking = n < this.sayText.length; this.drawFace(talking ? Math.abs(Math.sin(this.talkT * 17)) * (0.5 + 0.5 * Math.sin(this.talkT * 5.3)) : 0, (this.talkT % 2.6) < 0.12); }
    }
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) $('toast').classList.remove('on');
    if (this.radioT > 0 && (this.radioT -= dt) <= 0) $('radio').classList.remove('on');
    this.flash = Math.max(0, this.flash - dt);
  }
  // blips: [{x, z, kind: 'packet'|'next'|'tornado'|'drone'|'ghost'}]
  drawRadar(car, blips, time) {
    const cv = this.radar, dpr = Math.min(2, devicePixelRatio || 1), sz = cv.clientWidth * dpr;
    if (sz < 40) return;   // hidden (capture mode)
    if (cv.width !== sz) { cv.width = cv.height = sz; }
    const g = this.rg, R = sz / 2, range = 110, k = (R - 6 * dpr) / range;
    g.clearRect(0, 0, sz, sz); g.save(); g.translate(R, R);
    g.beginPath(); g.arc(0, 0, R - 2 * dpr, 0, 7); g.fillStyle = '#141a3a'; g.fill(); g.save(); g.clip();
    g.rotate(car.yaw + Math.PI); g.scale(k, k);
    g.drawImage(this.map, -(car.x - this.mapX0), -(car.z - this.mapZ0), this.map.width / this.mapS, this.map.height / this.mapS);
    if (this.flash > 0 && Math.sin(time * 18) > 0) { g.fillStyle = 'rgba(255,60,50,0.35)'; g.fillRect(-range * 2, -range * 2, range * 4, range * 4); }
    g.restore();
    // blips in radar space (clamped to the rim)
    const c = Math.cos(car.yaw + Math.PI), s = Math.sin(car.yaw + Math.PI);
    for (const b of blips) {
      let x = (b.x - car.x) * k, y = (b.z - car.z) * k; [x, y] = [x * c - y * s, x * s + y * c];
      const d = Math.hypot(x, y), lim = R - 10 * dpr; let edge = false; if (d > lim) { x *= lim / d; y *= lim / d; edge = true; }
      if (edge && b.kind !== 'next' && b.kind !== 'tornado') continue;
      g.save(); g.translate(x, y);
      if (b.kind === 'next') { const r = (7 + 1.5 * Math.sin(time * 6)) * dpr; g.fillStyle = '#ffd84d'; g.strokeStyle = '#141a3a'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(0, -r); g.lineTo(r, 0); g.lineTo(0, r); g.lineTo(-r, 0); g.closePath(); g.fill(); g.stroke(); }
      else if (b.kind === 'packet') { g.fillStyle = '#ffd84d'; g.fillRect(-3 * dpr, -3 * dpr, 6 * dpr, 6 * dpr); }
      else if (b.kind === 'tornado') { g.strokeStyle = '#ff6b57'; g.lineWidth = 2.5 * dpr; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(0, 0, (4 + i * 3) * dpr, time * 5 + i, time * 5 + i + 4); g.stroke(); } }
      else if (b.kind === 'drone') { g.fillStyle = Math.sin(time * 12) > 0 ? '#ffb347' : '#ff6b57'; g.beginPath(); g.arc(0, 0, 3.5 * dpr, 0, 7); g.fill(); }
      else if (b.kind === 'heli') { g.strokeStyle = '#ffb347'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(-6 * dpr, -6 * dpr); g.lineTo(6 * dpr, 6 * dpr); g.moveTo(6 * dpr, -6 * dpr); g.lineTo(-6 * dpr, 6 * dpr); g.stroke(); g.fillStyle = '#1e2a5a'; g.beginPath(); g.arc(0, 0, 3 * dpr, 0, 7); g.fill(); }
      else if (b.kind === 'ghost') { g.fillStyle = 'rgba(255,216,77,0.6)'; g.beginPath(); g.arc(0, 0, 4 * dpr, 0, 7); g.fill(); }
      g.restore();
    }
    // the player arrow
    g.fillStyle = '#fff4e6'; g.strokeStyle = '#141a3a'; g.lineWidth = 2 * dpr; g.beginPath(); g.moveTo(0, -8 * dpr); g.lineTo(6 * dpr, 7 * dpr); g.lineTo(0, 4 * dpr); g.lineTo(-6 * dpr, 7 * dpr); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(0, 0, R - 2 * dpr, 0, 7); g.strokeStyle = this.flash > 0 ? '#ff6b57' : 'rgba(255,244,230,0.9)'; g.lineWidth = 3 * dpr; g.stroke();
    g.fillStyle = '#ffd84d'; g.font = `900 ${10 * dpr}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', (R - 11 * dpr) * s, -(R - 11 * dpr) * c);
    g.restore();
  }
  title(day, scn, ghostNote) {
    $('tday').textContent = `DAILY RUN #${pad3(day)} · ${scn.name}`; $('tq').textContent = scn.title.replace('{n}', pad3(day)).replace(/^WHAT IF #\d+: /, 'What if ') + '?';
    $('ghostnote').innerHTML = ghostNote || ''; $('title').classList.remove('hide');
  }
  hideTitle() { $('title').classList.add('hide'); }
  // a fun one-line verdict for the card (what people screenshot)
  static rank(r) {
    if (r.pct >= 100) return r.pips === 0 ? 'CLEAN DELIVERY' : r.pips >= 3 ? 'CHAOS COURIER' : 'DELIVERED!';
    return r.pct >= r.scn.startPct + r.scn.packets - 1 ? 'SO CLOSE.' : r.pips >= 3 ? 'BEAUTIFUL CHAOS' : 'STILL BUFFERING...';
  }
  // the route you drove, north up, over the street map: your line in sun-yellow, packets filled (got) or hollow (missed)
  routeMap(cv, rec, pk, size = 132) {
    const dpr = 2 * size / 132, W = cv.width = cv.height = size * 2, g = cv.getContext('2d'), pts = rec.length ? rec : [[0, 0]];
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of [...pts, ...pk]) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    const span = Math.max(x1 - x0, z1 - z0) + 50, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, k = W / span, X = (x) => (x - cx) * k + W / 2, Z = (z) => (z - cz) * k + W / 2;
    g.fillStyle = '#3d6f8f'; g.fillRect(0, 0, W, W);
    g.drawImage(this.map, (cx - span / 2 - this.mapX0) * this.mapS, (cz - span / 2 - this.mapZ0) * this.mapS, span * this.mapS, span * this.mapS, 0, 0, W, W);
    g.lineJoin = g.lineCap = 'round';
    for (const [w, c] of [[7, '#141a3a'], [3.5, '#ffd84d']]) { g.lineWidth = w * dpr; g.strokeStyle = c; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])))); g.stroke(); }
    for (const [x, z, got] of pk) { const s = 5 * dpr; g.lineWidth = 2 * dpr; g.strokeStyle = '#141a3a'; g.fillStyle = got ? '#ffd84d' : '#fff4e6'; g.beginPath(); g.rect(X(x) - s / 2, Z(z) - s / 2, s, s); g.fill(); g.stroke(); if (!got) { g.fillStyle = '#ff6b57'; g.fillRect(X(x) - s / 4, Z(z) - s / 4, s / 2, s / 2); } }
    const dot = (p, c) => { g.fillStyle = c; g.strokeStyle = '#141a3a'; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(X(p[0]), Z(p[1]), 5 * dpr, 0, 7); g.fill(); g.stroke(); };
    dot(pts[0], '#fff4e6'); dot(pts[pts.length - 1], '#ff6b57');
  }
  // the share image: a 1080x1350 (4:5) card drawn on a canvas, all local (no network)
  cardImage(r) {
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); if (!g.roundRect) g.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };   // older Safari
    const F = (w, s) => `${w} ${s}px Montserrat, "Segoe UI", system-ui, Arial, sans-serif`;
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2b2a63'); bg.addColorStop(0.55, '#141a3a'); bg.addColorStop(1, '#0d1028'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const sun = g.createRadialGradient(880, 170, 10, 880, 170, 520); sun.addColorStop(0, 'rgba(255,190,110,0.55)'); sun.addColorStop(1, 'rgba(255,120,90,0)'); g.fillStyle = sun; g.fillRect(0, 0, W, H);
    const text = (s, x, y, font, col, align = 'left', shadow) => { g.font = font; g.textAlign = align; if (shadow) { g.fillStyle = shadow; g.fillText(s, x, y + 7); } g.fillStyle = col; g.fillText(s, x, y); };
    text(CONFIG.gameName, 70, 110, F(900, 34), '#ffd84d'); text(`WHAT IF #${pad3(r.day)} · ${r.scn.name}`, 70, 160, F(800, 30), '#fff4e6');
    text(Hud.rank(r), 70, 280, F(900, Hud.rank(r).length > 13 ? 84 : 104), '#fff4e6', 'left', '#ff6b57');
    const map = document.createElement('canvas'); this.routeMap(map, r.route, r.packets, 210);
    g.save(); g.beginPath(); g.roundRect(70, 340, 420, 420, 28); g.clip(); g.drawImage(map, 70, 340, 420, 420); g.restore();
    g.lineWidth = 8; g.strokeStyle = '#1f2756'; g.beginPath(); g.roundRect(70, 340, 420, 420, 28); g.stroke();
    text(`${r.pct}%`, 785, 580, F(900, 190), '#fff4e6', 'center', '#ff6b57'); text(r.scn.meter, 785, 650, F(900, 36), '#ffd84d', 'center');
    for (let i = 0; i < 5; i++) { const x = 625 + i * 80, y = 715, on = i < r.pips; g.beginPath(); for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k - Math.PI / 2; g.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30); } g.closePath(); g.fillStyle = on ? '#ffb347' : 'rgba(255,255,255,0.12)'; g.fill(); g.lineWidth = 4; g.strokeStyle = on ? '#fff' : 'rgba(255,255,255,0.45)'; g.stroke(); }
    const got = r.packets.filter((p) => p[2]).length, stats = [[fmtTime(r.time), 'TIME'], [`${got}/${r.packets.length}`, 'PACKETS'], [String(r.near), r.near === 1 ? 'NEAR MISS' : 'NEAR MISSES']];
    stats.forEach(([v, l], i) => { const x = 70 + i * 320; g.fillStyle = '#1f2756'; g.beginPath(); g.roundRect(x, 810, 300, 170, 24); g.fill(); text(v, x + 150, 905, F(900, 72), '#ffd84d', 'center'); text(l, x + 150, 950, F(800, 26), '#fff4e6', 'center'); });
    g.fillStyle = '#1f2756'; g.beginPath(); g.roundRect(70, 1010, 940, 140, 24); g.fill();
    text('POST YOUR RUN CODE UNDER THE SHORT', 540, 1060, F(800, 26), 'rgba(255,244,230,0.8)', 'center'); text(r.code, 540, 1125, '900 54px ui-monospace, Consolas, monospace', '#fff4e6', 'center');
    text(r.scn.title.replace('{n}', pad3(r.day)).replace(/^WHAT IF #\d+: /, 'What if ') + '?', 540, 1215, F(800, 30), '#fff4e6', 'center');
    text(`Beat my ghost: ${location.host || 'play the daily run'}`, 540, 1262, F(900, 30), '#ffd84d', 'center');
    text(CONFIG.disclaimer, 540, 1315, F(600, 22), 'rgba(255,244,230,0.6)', 'center');
    return c;
  }
  // share sheet with the PNG where the browser can share files, else download it (and copy the text with the link)
  async shareCard(r) {
    const c = this.cardImage(r), name = `what-if-snacks-drive-${pad3(r.day)}.png`;
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/png')); if (!blob) return 'Could not make the image.';
    const file = new File([blob], name, { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: r.share }); return 'Shared.'; } } catch (e) { if (e && e.name === 'AbortError') return 'Cancelled.'; }   // the player closed the share sheet: no surprise download; any other error falls through to the download
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    try { await navigator.clipboard.writeText(r.share); return `Saved ${name}. Result text copied too.`; } catch { return `Saved ${name}.`; }
  }
  result(r, handlers) {
    const card = $('card'), got = r.packets.filter((p) => p[2]).length, pips = Array.from({ length: 5 }, (_, i) => `<span class="pip${i < r.pips ? ' on' : ''}">${PIP}</span>`).join('');
    card.innerHTML = `<div class="day">WHAT IF #${pad3(r.day)} · ${r.scn.name}</div>
      <h2>${Hud.rank(r)}</h2>
      <div class="hero"><canvas id="rmap"></canvas><div class="big"><b>${r.pct}%</b><span>${r.scn.meter}</span><div class="rpips">${pips}</div></div></div>
      <div class="stats"><div class="stat"><b>${fmtTime(r.time)}</b><span>TIME</span></div><div class="stat"><b>${got}/${r.packets.length}</b><span>PACKETS</span></div><div class="stat"><b>${r.near}</b><span>${r.near === 1 ? 'NEAR MISS' : 'NEAR MISSES'}</span></div></div>
      ${r.ghostLine ? `<div class="fact ghost"><b>GHOST</b>${r.ghostLine}</div>` : ''}
      <div class="code"><small>POST YOUR RUN CODE UNDER THE SHORT</small>${r.code}</div>
      <div class="btns">
        <button class="b1 wide" id="rRetry">RETRY VS MY GHOST</button>
        <button class="b2" id="rShare">SHARE CARD</button><button class="b2" id="rLink">CHALLENGE LINK</button>
        <a class="b3 wide" id="rWatch" target="_blank" rel="noopener">WATCH THE 40-SECOND SCIENCE</a>
      </div><div id="copied"></div>
      <div class="fact"><b>THE SCIENCE BIT</b>${r.scn.fact}</div>
      ${r.stats || r.eggs ? `<div class="eggs">${r.stats ? `${r.stats.newBest ? '<b>NEW BEST</b> · ' : ''}STREAK <b>${r.stats.streak}</b> · BEST <b>${r.stats.best.pct}% ${fmtTime(r.stats.best.time)}</b> · ` : ''}EGGS <b>${r.eggs.found}/${r.eggs.total}</b>${r.eggs.run ? ` (+${r.eggs.run})` : ''}</div>` : ''}
      <div class="btns"><button class="b4" id="rClip">SAVE MY 10 S CLIP</button><a class="b4" id="rSub" target="_blank" rel="noopener">SUBSCRIBE</a></div>
      <div class="disc">${CONFIG.disclaimer}</div>`;
    this.routeMap($('rmap'), r.route, r.packets); this.show(false);   // the live HUD (timer, mission, radar) fades out behind the card
    $('rWatch').href = r.scn.scienceUrl || CONFIG.scienceFallbackUrl; $('rSub').href = CONFIG.subscribeUrl;
    const copy = async (txt, msg) => { try { await navigator.clipboard.writeText(txt); } catch { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); } $('copied').textContent = msg; };
    $('rShare').onclick = async () => { $('copied').textContent = 'Making your card...'; $('copied').textContent = await this.shareCard(r); };
    $('rLink').onclick = () => copy(r.link, 'Challenge link copied.');
    $('rRetry').onclick = handlers.retry;
    $('rClip').onclick = async () => { $('copied').textContent = 'Preparing the clip...'; $('copied').textContent = await handlers.clip(); };
    $('result').classList.remove('hide');
  }
  hideResult() { $('result').classList.add('hide'); }
}
