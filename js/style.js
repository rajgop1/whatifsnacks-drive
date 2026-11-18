// STYLE: the GTA-flavoured score layer. Long drifts, big air, near misses and packets earn cash, chained into a combo (x1 to x5) that a crash resets.
// The bank is the lifetime total in this browser (localStorage), shown on the title and the result card; it never leaves the device.
const KEY = 'wis-bank';
const read = () => { try { return Math.max(0, +localStorage.getItem(KEY) || 0); } catch (e) { return 0; } };
export const fmt$ = (n) => '$' + Math.round(n).toLocaleString('en-US');

export class Style {
  constructor(hud) { this.hud = hud; this.bank = read(); this.reset(); }
  reset() { this.run = 0; this.combo = 1; this.comboT = 0; this.driftT = 0; this.airT = 0; this.stunts = 0; this.bestDrift = 0; this.hud.style(0, 1, 0); }
  add(label, pts) {   // the combo multiplies; every action keeps it alive 4 s and bumps it up one step
    const v = Math.round(pts * this.combo); this.run += v; this.comboT = 4; this.combo = Math.min(5, this.combo + 1);
    if (label) this.hud.plus(`${label} +${fmt$(v)}`, 'style');
    return v;
  }
  crash() { if (this.combo > 1) this.hud.plus('COMBO LOST', 'hit'); this.combo = 1; this.comboT = 0; this.driftT = 0; }
  update(dt, car, live) {
    if (!live) return;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 1; }
    // drifting: every full second of a held slide pays
    if (!car.air && car.speed > 10 && car.drift > 4.5) { this.driftT += dt; this.bestDrift = Math.max(this.bestDrift, this.driftT); if (this.driftT >= 1) { this.driftT -= 1; this.add('DRIFT', 100); } } else this.driftT = Math.max(0, this.driftT - dt * 2);
    // air: a stunt jump is a landing after at least 0.9 s in the air
    if (car.air) this.airT += dt; else { if (this.airT > 0.9) { this.stunts++; this.add('STUNT JUMP', Math.min(1500, 300 * this.airT)); this.hud.toast('STUNT JUMP', `${this.airT.toFixed(1)} S IN THE AIR`, 1.3); } this.airT = 0; }
    this.hud.style(this.run, this.combo, this.comboT);
  }
  finish() { this.bank += this.run; try { localStorage.setItem(KEY, String(Math.round(this.bank))); } catch (e) { /* private window */ } return { run: this.run, bank: this.bank, stunts: this.stunts }; }
}
export const bank = read;
// paint jobs: the first four are free, the rest unlock as the lifetime bank grows
export const PAINTS = [
  { n: 'FACTORY', c: null, cost: 0 }, { n: 'OCEAN', c: 0x2f6bff, cost: 0 }, { n: 'MINT', c: 0x2ed8a0, cost: 0 }, { n: 'SUNNY', c: 0xffd84d, cost: 0 },
  { n: 'BUBBLEGUM', c: 0xff5fa8, cost: 2000 }, { n: 'SNOW', c: 0xf2f2f6, cost: 6000 }, { n: 'MIDNIGHT', c: 0x1b1b2e, cost: 15000 }, { n: 'GOLD', c: 0xe0a82e, cost: 40000 },
];
