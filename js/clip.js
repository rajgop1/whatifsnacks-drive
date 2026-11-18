// "Save my 10 s clip": records the game canvas (plus the game audio when available) with MediaRecorder.
// A WebM/MP4 file must start at its header, so instead of trimming one long recording we run two recorders staggered by 10 s
// and restart them in turn; at the finish the older one always holds the last 10-20 seconds. The browser does the encoding.
// avc3 first: the canvas size changes with adaptive resolution, and avc1 errors when the frame size changes mid-recording
const TYPES = ['video/mp4;codecs=avc3', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm', 'video/mp4;codecs=avc1','video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

export class Clip {
  constructor(canvas, audio) {
    this.canvas = canvas; this.audio = audio; this.recs = []; this.blob = null;
    this.mime = window.MediaRecorder && canvas.captureStream ? TYPES.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) : null;
    this.ok = !!this.mime;
  }
  start() {
    if (!this.ok) return; this.stop(); this.blob = null;
    try {
      this.stream = this.canvas.captureStream(30);
      const at = this.audio.streamTrack && this.audio.streamTrack(); if (at) this.stream.addTrack(at);
      this.spawn(); this.timer = setInterval(() => this.spawn(), 10000);
    } catch { this.ok = false; }
  }
  spawn() {
    const r = new MediaRecorder(this.stream, { mimeType: this.mime, videoBitsPerSecond: 5e6 }); r.chunks = [];
    r.ondataavailable = (e) => { if (e.data && e.data.size) r.chunks.push(e.data); };
    r.start(1000); r.t0 = performance.now(); this.recs.push(r);
    while (this.recs.length > 2) { const old = this.recs.shift(); if (old.state !== 'inactive') old.stop(); }
  }
  // stop and keep the recording that covers the last >= 10 s
  finish() {
    if (!this.ok || !this.recs.length) return Promise.resolve(null);
    clearInterval(this.timer); const now = performance.now();
    const pick = this.recs.find((r) => now - r.t0 >= 10000) || this.recs[0];
    return new Promise((res) => {
      pick.onstop = () => { this.blob = new Blob(pick.chunks, { type: this.mime.split(';')[0] }); res(this.blob); };
      for (const r of this.recs) if (r.state !== 'inactive') r.stop();
      this.recs = [];
    });
  }
  stop() { clearInterval(this.timer); for (const r of this.recs) if (r.state !== 'inactive') r.stop(); this.recs = []; }
  // share sheet on phones (WhatsApp, YouTube...), otherwise a download
  async save(name) {
    if (!this.blob) return 'No clip yet. Finish a run first.';
    const ext = this.blob.type.includes('mp4') ? 'mp4' : 'webm', file = new File([this.blob], `${name}.${ext}`, { type: this.blob.type });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return 'Shared.'; } } catch (e) { if (e && e.name === 'AbortError') return 'Cancelled.'; }   // closed the share sheet: no surprise download; other errors fall through to the download
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    return `Saved ${file.name}`;
  }
}

// Real local numbers only: streak of days played, personal best per daily number, attempts today. Nothing is invented.
const KEY = 'wis_drive_stats';
export const Stats = {
  load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (!s || typeof s !== 'object' || Array.isArray(s)) return {}; if (!s.best || typeof s.best !== 'object' || Array.isArray(s.best)) delete s.best; if (!s.attempts || typeof s.attempts !== 'object') delete s.attempts; return s; } catch { return {}; } },   // hand-edited storage never breaks a run
  save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: stats just don't persist */ } },
  attempt(today) { const s = this.load(); s.attempts = s.attempts && s.attempts.day === today ? { day: today, n: s.attempts.n + 1 } : { day: today, n: 1 }; this.save(s); return s; },
  // a run counts for the streak on the real calendar day it was played
  finish(today, scenarioDay, time, pct) {
    const s = this.load();
    s.streak = s.lastDay === today ? s.streak || 1 : s.lastDay === today - 1 ? (s.streak || 0) + 1 : 1; s.lastDay = today;
    s.best = s.best || {}; const b = s.best[scenarioDay], better = !b || pct > b.pct || (pct === b.pct && time < b.time);
    if (better) s.best[scenarioDay] = { time, pct };
    this.save(s); return { streak: s.streak, best: s.best[scenarioDay], newBest: better && !!b, first: !b, attemptsToday: s.attempts && s.attempts.day === today ? s.attempts.n : 1 };
  },
  summary(today, scenarioDay) { const s = this.load(); return { streak: s.lastDay === today || s.lastDay === today - 1 ? s.streak || 0 : 0, best: s.best && s.best[scenarioDay], attemptsToday: s.attempts && s.attempts.day === today ? s.attempts.n : 0 }; },
};
