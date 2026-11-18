// The car radio: original stations synthesized with WebAudio on the music bus (no samples, nothing to license). Station 0 is the game's own synthwave loop (audio.js),
// the others are small step sequencers scheduled a fraction of a second ahead. Press M (or tap the note button) to change station; the choice is remembered.
const hz = (n) => 440 * 2 ** ((n - 69) / 12);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const KEY = 'wis-radio';

const STATIONS = [
  { id: 'synth', name: 'SNACK FM', sub: 'SUNSET SYNTH' },
  {
    id: 'lofi', name: 'LAZY LOFI', sub: 'MIDNIGHT NOODLES', bpm: 76,   // four bars: Am9, Fmaj7, Cmaj7, G6
    play(r, t, s) {
      const a = r.a, b = r.bus, bar = Math.floor(s / 16) % 4, st = s % 16, root = [57, 53, 48, 55][bar], ch = [[0, 3, 7, 14], [0, 4, 7, 11], [0, 4, 7, 11], [0, 4, 7, 9]][bar];
      if (st === 0) { for (const iv of ch) a.tone(hz(root + 12 + iv), t, 3.2, 'triangle', 0.035, b); a.tone(hz(root - 12), t, 1.4, 'sine', 0.13, b); }
      if (st === 8) a.tone(hz(root - 12), t, 0.9, 'sine', 0.09, b);
      if (st === 0 || st === 10) a.tone(150, t, 0.16, 'sine', 0.2, b, 0.35);
      if (st === 4 || st === 12) a.noise(t, 0.14, 0.07, 1500, 'bandpass', b);
      if (st % 2 === 0) a.noise(t + (st % 4 ? 0.02 : 0), 0.04, 0.025, 7000, 'highpass', b);
      if (st % 2 === 0 && Math.random() < 0.28) a.tone(hz(pick([69, 72, 74, 76, 79, 81]) + (bar === 1 ? -4 : 0)), t, 0.9, 'sine', 0.04, b);
      if (Math.random() < 0.16) a.noise(t, 0.01, 0.03, 4000, 'highpass', b);   // vinyl crackle
    },
  },
  {
    id: 'disco', name: 'NEON DISCO', sub: 'FOUR ON THE FLOOR', bpm: 124,
    play(r, t, s) {
      const a = r.a, b = r.bus, bar = Math.floor(s / 16) % 4, st = s % 16, root = [45, 45, 41, 43][bar];
      if (st % 4 === 0) a.tone(160, t, 0.2, 'sine', 0.3, b, 0.3);
      if (st % 8 === 4) a.noise(t, 0.12, 0.1, 1700, 'bandpass', b);
      if (st % 4 === 2) a.noise(t, 0.09, 0.05, 8000, 'highpass', b);
      if (st % 2 === 1) a.noise(t, 0.03, 0.02, 9000, 'highpass', b);
      if (st % 4 === 2) a.tone(hz(root), t, 0.13, 'sawtooth', 0.05, b);
      if (st === 3 || st === 6 || st === 10 || st === 14) for (const iv of [0, 3, 7, 10]) a.tone(hz(root + 24 + iv), t, 0.14, 'square', 0.014, b);
      if (st === 0 && bar % 2 === 1) for (let k = 0; k < 4; k++) a.tone(hz(root + 36 + [0, 7, 10, 12][k]), t + k * 0.121, 0.1, 'triangle', 0.03, b);
    },
  },
];

export class Radio {
  constructor(audio, hud) {
    this.a = audio; this.hud = hud; this.step = 0; this.t = 0; this.timer = null; this.paused = false;
    let i = 0; try { i = Math.trunc(+localStorage.getItem(KEY)) || 0; } catch (e) { /* private window */ }
    this.off = i < 0; this.i = i >= 0 && i < STATIONS.length ? i : 0;
  }
  get station() { return STATIONS[this.i]; }
  start() { if (!this.a.ctx) return; this.bus = this.a.musicBus; this.apply(); }   // after audio.start()
  apply() {
    const a = this.a, st = this.station; clearInterval(this.timer); this.timer = null; if (a.ctx) this.bus = a.musicBus;   // a mode's exit can call this before start()
    a.music = !this.off && !this.paused && st.id === 'synth';
    this.hud.radioBtn && this.hud.radioBtn(this.off ? 'OFF' : st.name);
    if (this.off || this.paused || !st.play || !a.ctx) return;
    this.step = 0; this.t = a.ctx.currentTime + 0.08;
    this.timer = setInterval(() => this.tick(), 60);
  }
  tick() {
    const a = this.a, c = a.ctx, st = this.station; if (!c || !st.play) return;
    if (c.state === 'suspended') { this.t = c.currentTime + 0.08; return; }
    const dur = 60 / st.bpm / 4;
    while (this.t < c.currentTime + 0.25) { st.play(this, this.t, this.step); this.t += dur; this.step++; }
  }
  next() {   // station 0, 1, 2, then off, then round again
    if (this.off) { this.off = false; this.i = 0; } else if (this.i === STATIONS.length - 1) this.off = true; else this.i++;
    try { localStorage.setItem(KEY, this.off ? '-1' : String(this.i)); } catch (e) { /* private window */ }
    this.apply(); const st = this.station;
    this.hud.toast(this.off ? 'RADIO OFF' : st.name, this.off ? '' : '♪ ' + st.sub, 1.3);
  }
  pause(p) { this.paused = p; if (this.a.ctx) this.apply(); }   // a mode (space, submarine) brings its own sound
}
