import { CONFIG } from './config.js';
// All sound is synthesized with WebAudio (no files unless CONFIG.musicFile is set): an engine, an original synthwave loop, packet chimes, crashes, the tornado's wind,
// drone buzz, and chirpy "radio voice" blips under the mascot's subtitle. Starts on the TURN THE KEY tap (browsers require a gesture).
export class Audio {
  start() {
    if (this.ctx || this.failed) return; const A = window.AudioContext || window.webkitAudioContext; if (!A) { this.failed = true; return; }
    try { this.boot(A); } catch { this.ctx = null; this.failed = true; }   // blocked or broken audio: the game runs silent
  }
  boot(A) {
    const c = (this.ctx = new A()), comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
    this.master = c.createGain(); this.master.gain.value = 0.8; this.master.connect(comp); comp.connect(c.destination);
    this.musicBus = c.createGain(); this.musicBus.gain.value = 0.32; this.musicBus.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noiseBuf = nb;
    // engine
    this.eg = c.createGain(); this.eg.gain.value = 0; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; this.elp = lp;
    this.o1 = c.createOscillator(); this.o1.type = 'sawtooth'; this.o2 = c.createOscillator(); this.o2.type = 'square'; const g2 = c.createGain(); g2.gain.value = 0.35;
    this.o1.connect(lp); this.o2.connect(g2); g2.connect(lp); lp.connect(this.eg); this.eg.connect(this.sfx); this.o1.start(); this.o2.start();
    // loops: wind (tornado) and buzz (drones)
    this.wind = this.loopNoise('bandpass', 500, 0.8); this.screech = this.loopNoise('bandpass', 1900, 6); this.rush = this.loopNoise('lowpass', 500, 0.7);
this.buzz = c.createOscillator(); this.buzz.type = 'sawtooth'; this.buzz.frequency.value = 180; this.buzzG = c.createGain(); this.buzzG.gain.value = 0;
    const bf = c.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 900; this.buzz.connect(bf); bf.connect(this.buzzG); this.buzzG.connect(this.sfx); this.buzz.start();
    this.beat = 0; this.nextBeat = c.currentTime + 0.1; this.music = true;
    if (c.state === 'suspended' && c.resume) c.resume().catch(() => {});
    if (CONFIG.musicFile) this.loadMusic(CONFIG.musicFile);
  }
  // Optional licensed track (same-origin file, e.g. 'audio/music.mp3'): loops on the music bus (so it still ducks under the radio)
  // and replaces the synth bed. Any failure keeps the synth bed. Off by default: probing for a missing file logs a 404.
  async loadMusic(url) {
    try {
      const r = await fetch(url); if (!r.ok) return;
      const buf = await this.ctx.decodeAudioData(await r.arrayBuffer()), s = this.ctx.createBufferSource();
      s.buffer = buf; s.loop = true; const g = this.ctx.createGain(); g.gain.value = 1.4; s.connect(g); g.connect(this.musicBus); s.start();
      this.music = false; this.track = s;
    } catch { /* keep the synth bed */ }
  }
  streamTrack() { if (!this.ctx || !this.ctx.createMediaStreamDestination) return null; if (!this.dest) { this.dest = this.ctx.createMediaStreamDestination(); this.master.connect(this.dest); } return this.dest.stream.getAudioTracks()[0] || null; }
  whoosh(k = 0) { if (!this.ctx) return; const t = this.ctx.currentTime; this.noise(t, 0.22, 0.12, 900 + k * 500, 'bandpass'); this.tone(300 + k * 120, t, 0.12, 'sine', 0.05, this.sfx, 2); }
  loopNoise(type, f, q) { const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = c.createGain(); g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(this.sfx); s.start(); return { g, fl }; }
  tone(freq, t, dur, type = 'sine', vol = 0.2, bus = this.sfx, glide = 0) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (glide) o.frequency.exponentialRampToValueAtTime(freq * glide, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(t, dur, vol, f = 1200, type = 'lowpass', bus = this.sfx) {
    const c = this.ctx, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); s.buffer = this.noiseBuf; fl.type = type; fl.frequency.value = f;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); s.connect(fl); fl.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // per frame
  update(dt, car, { tornadoDist = 1e9, droneDist = 1e9, heliDist = 1e9, running = true, silent = false } = {}) {
    if (!this.ctx) return; const c = this.ctx, t = c.currentTime;
    const E = car.v.engine || {}, rpm = Math.min(1, Math.abs(car.vf) / (car.P && car.P.vmax || 46)), gear = (rpm * 4.2) % 1, f = (E.base ?? 38) + (E.range ?? 70) * rpm + (E.gear ?? 55) * gear + (car.air ? 40 : 0);
    this.o1.frequency.setTargetAtTime(f, t, 0.05); this.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05); this.elp.frequency.setTargetAtTime(500 + 2400 * rpm, t, 0.08);
    this.eg.gain.setTargetAtTime(silent ? 0 : running ? 0.09 + 0.08 * rpm : 0.05, t, 0.1);
    this.wind.g.gain.setTargetAtTime(Math.max(0, 1 - tornadoDist / 140) * 0.55, t, 0.2); this.wind.fl.frequency.setTargetAtTime(300 + Math.max(0, 1 - tornadoDist / 140) * 700, t, 0.2);
    this.buzzG.gain.setTargetAtTime(Math.max(0, 1 - droneDist / 60) * 0.06, t, 0.1);
    // tyre squeal while sliding, and wind rush that rises with speed
    const slide = car.air ? 0 : Math.max(car.burnout ? 0.8 : 0, Math.min(1, Math.max(0, (car.drift - 3.5) / 7))); this.screech.g.gain.setTargetAtTime(slide * 0.16, t, 0.05); this.screech.fl.frequency.setTargetAtTime(1500 + slide * 900, t, 0.1);
    const sp = Math.min(1, car.speed / 45); this.rush.g.gain.setTargetAtTime(running ? sp * sp * 0.14 : 0, t, 0.2); this.rush.fl.frequency.setTargetAtTime(300 + sp * 1600, t, 0.2);
    if (heliDist < 260) { this.chopT = (this.chopT || 0) - dt; if (this.chopT <= 0) { this.chopT = 0.072; this.noise(t, 0.06, 0.35 * (1 - heliDist / 260), 260); } }
    if (this.music) this.schedule();
  }
  schedule() { // an original 4-chord synthwave loop at 104 bpm, scheduled 0.2 s ahead
    const c = this.ctx, spb = 60 / 104 / 4, roots = [57, 53, 48, 55], chords = [[0, 3, 7], [0, 4, 7], [0, 4, 7], [0, 4, 7]], mt = (n) => 440 * Math.pow(2, (n - 69) / 12);
    while (this.nextBeat < c.currentTime + 0.2) {
      const s = this.beat % 64, bar = Math.floor(s / 16), r = roots[bar], t = this.nextBeat, b = this.musicBus;
      if (s % 2 === 0) this.tone(mt(r - 24 + (s % 8 === 6 ? 12 : 0)), t, spb * 1.8, 'sawtooth', 0.16, b);
      const arp = chords[bar][(s >> 0) % 3] + 12 * ((s >> 2) % 2); this.tone(mt(r + arp), t, spb * 0.9, 'square', 0.045, b);
      if (s % 16 === 0) for (const n of chords[bar]) this.tone(mt(r + n + 12), t, spb * 15, 'triangle', 0.035, b);
      if (s % 4 === 0) this.tone(120, t, 0.18, 'sine', 0.5, b, 0.3);
      if (s % 8 === 4) this.noise(t, 0.16, 0.22, 2200, 'bandpass', b);
      if (s % 2 === 1) this.noise(t, 0.04, 0.06, 8000, 'highpass', b);
      this.beat++; this.nextBeat += spb;
    }
  }
  honk() { if (!this.ctx) return; const t = this.ctx.currentTime; for (const f of [392, 494]) { this.tone(f, t, 0.28, 'square', 0.05); this.tone(f, t + 0.34, 0.2, 'square', 0.05); } }
  chime(n) { if (!this.ctx) return; const t = this.ctx.currentTime, base = 660 * Math.pow(2, n / 12); this.tone(base, t, 0.35, 'sine', 0.25); this.tone(base * 1.5, t + 0.06, 0.4, 'triangle', 0.14); this.tone(base * 2, t + 0.12, 0.5, 'sine', 0.1); this.tone(150, t, 0.22, 'sine', 0.4, this.sfx, 0.5); this.noise(t, 0.18, 0.12, 5000, 'highpass'); }
  launch() { if (!this.ctx) return; const t = this.ctx.currentTime; this.noise(t, 0.5, 0.35, 160); this.tone(55, t, 0.6, 'sawtooth', 0.12, this.sfx, 2.4); this.tone(110, t + 0.05, 0.7, 'square', 0.05, this.sfx, 2); }   // engine bark as the clutch drops
  nearMiss() { if (!this.ctx) return; const t = this.ctx.currentTime; this.noise(t, 0.35, 0.3, 1400, 'bandpass'); this.tone(900, t, 0.3, 'sawtooth', 0.04, this.sfx, 0.45); this.tone(1320, t + 0.05, 0.25, 'triangle', 0.08, this.sfx, 1.2); }
  crash(v) { if (!this.ctx) return; const t = this.ctx.currentTime; this.noise(t, 0.35 + v * 0.02, Math.min(0.9, 0.15 + v * 0.04), 900); this.tone(70, t, 0.3, 'sine', Math.min(0.6, v * 0.04), this.sfx, 0.5); }
  thud() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(90, t, 0.25, 'sine', 0.35, this.sfx, 0.4); this.noise(t, 0.12, 0.15, 500); }
  zap() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(1400, t, 0.25, 'sawtooth', 0.12, this.sfx, 0.2); this.noise(t, 0.2, 0.2, 4000, 'highpass'); }
  alarm() { if (!this.ctx) return; const t = this.ctx.currentTime; for (let k = 0; k < 3; k++) { this.tone(880, t + k * 0.22, 0.12, 'square', 0.08); this.tone(660, t + k * 0.22 + 0.11, 0.1, 'square', 0.08); } }
  rev() { if (!this.ctx) return; const t = this.ctx.currentTime; this.o1.frequency.setValueAtTime(40, t); this.o1.frequency.linearRampToValueAtTime(190, t + 0.35); this.o1.frequency.linearRampToValueAtTime(60, t + 0.9); this.eg.gain.setValueAtTime(0.22, t); this.eg.gain.linearRampToValueAtTime(0.08, t + 1); }
  voice(text) { // chirpy syllables under the subtitle; the music ducks
    if (!this.ctx) return; const t0 = this.ctx.currentTime, syl = text.split(/[\s-]+/).length * 1.6;
    this.musicBus.gain.setTargetAtTime(0.12, t0, 0.05); this.musicBus.gain.setTargetAtTime(0.32, t0 + syl * 0.085 + 0.3, 0.3);
    this.noise(t0, 0.08, 0.1, 3000, 'bandpass');
    for (let k = 0; k < syl; k++) this.tone(420 + Math.random() * 260, t0 + 0.08 + k * 0.085, 0.07, 'square', 0.05);
  }
  finish(win) { if (!this.ctx) return; const t = this.ctx.currentTime, seq = win ? [0, 4, 7, 12, 16] : [7, 3, 0]; seq.forEach((n, k) => this.tone(523 * Math.pow(2, n / 12), t + k * 0.11, 0.5, 'triangle', 0.2)); }
  suspend(on) { if (this.ctx) (on ? this.ctx.suspend() : this.ctx.resume()).catch(() => {}); }
}
