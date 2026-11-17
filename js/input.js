// Keyboard, gamepad, touch and phone tilt merged into one state. Touch: hold the ◀ ▶ buttons or drag anywhere on the left 60% to steer
// (a floating thumb stick), BRAKE and DRIFT buttons on the right. The car throttles itself during a run; brake/reverse is on S / Down / BRAKE.
export class Input {
  constructor(root) {
    this.keys = new Set(); this.steer = 0; this.brake = 0; this.handbrake = false; this.touched = false; this.any = false;
    this.touchSteer = 0; this.touchBrake = false; this.touchDrift = false; this.touchL = false; this.touchR = false; this.stickId = null;
    this.isTouch = new URLSearchParams(location.search).get('touch') === '1' || matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;   // ?touch=1 forces the touch layout
    // Tilt steering: turn the phone like a wheel. The sensor is the gravity vector in the screen plane, so portrait and landscape both work.
    this.tilt = false; this.tiltSteer = 0; this.tiltZero = null; this.tiltSeen = false;
    const tb = root.querySelector('#btnTilt'), LAB = { off: 'TILT STEERING: OFF', on: 'TILT STEERING: ON · TURN LIKE A WHEEL', none: 'NO TILT SENSOR HERE' };
    this.tiltUI = (s) => { if (tb) { tb.textContent = LAB[s]; tb.classList.toggle('on', s === 'on'); } };
    this.onMotion = (e) => {
      const g = e.accelerationIncludingGravity; if (!g || g.x == null || g.y == null) return; this.tiltSeen = true;
      if (Math.hypot(g.x, g.y) < 2.5) { this.tiltSteer = 0; return; }   // phone lying flat: no wheel angle
      const a = Math.atan2(-g.x, g.y);   // iOS reports the gravity vector flipped, which only adds a constant 180 deg that the zero cancels
      if (this.tiltZero == null) this.tiltZero = a;
      const d = Math.atan2(Math.sin(a - this.tiltZero), Math.cos(a - this.tiltZero)), m = Math.max(0, Math.abs(d) - 0.07);   // 4 deg dead zone, full lock at about 33 deg
      this.tiltSteer = Math.max(-1, Math.min(1, Math.sign(d) * m / 0.5)); if (m > 0.12) this.any = true;
    };
    if (!window.DeviceMotionEvent) { if (tb) tb.remove(); } else if (tb) {
      this.tiltUI('off'); tb.addEventListener('click', () => { this.setTilt(!this.tilt); tb.blur(); });
      let saved = ''; try { saved = localStorage.getItem('wis-tilt'); } catch (e) {}
      if (saved === '1' && this.isTouch && typeof DeviceMotionEvent.requestPermission !== 'function') this.setTilt(true);   // iOS asks again on every visit, so only Android remembers
    }
    addEventListener('orientationchange', () => this.calibrate());
    addEventListener('keydown', (e) => { this.keys.add(e.code); this.any = true; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault(); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());
    const stick = root.querySelector('#stick'), knob = root.querySelector('#knob'), zone = root.querySelector('#steerzone');
    let ox = 0;
    zone.addEventListener('pointerdown', (e) => { this.stickId = e.pointerId; ox = e.clientX; stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px'; stick.classList.add('on'); this.any = this.touched = true; zone.setPointerCapture(e.pointerId); });
    zone.addEventListener('pointermove', (e) => { if (e.pointerId !== this.stickId) return; const d = Math.max(-60, Math.min(60, e.clientX - ox)); this.touchSteer = d / 60; knob.style.transform = `translate(${d}px,0)`; });
    const end = (e) => { if (e.pointerId !== this.stickId) return; this.stickId = null; this.touchSteer = 0; knob.style.transform = ''; stick.classList.remove('on'); };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    const hold = (id, k) => { const el = root.querySelector(id); el.addEventListener('pointerdown', (e) => { this[k] = true; this.any = this.touched = true; el.classList.add('down'); el.setPointerCapture(e.pointerId); e.preventDefault(); }); const up = () => { this[k] = false; el.classList.remove('down'); }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); };
    hold('#btnBrake', 'touchBrake'); hold('#btnDrift', 'touchDrift'); hold('#btnL', 'touchL'); hold('#btnR', 'touchR');
  }
  calibrate() { this.tiltZero = null; }   // the next reading becomes "straight ahead"
  async setTilt(on) {
    const save = (v) => { try { localStorage.setItem('wis-tilt', v); } catch (e) {} };
    if (!on) { removeEventListener('devicemotion', this.onMotion); this.tilt = false; this.tiltSteer = 0; this.tiltUI('off'); save('0'); return; }
    const D = window.DeviceMotionEvent;
    try { if (typeof D.requestPermission === 'function' && (await D.requestPermission()) !== 'granted') return this.tiltUI('off'); } catch (e) { return this.tiltUI('off'); }   // iOS: must come from a tap
    this.tilt = true; this.tiltSeen = false; this.calibrate(); addEventListener('devicemotion', this.onMotion); this.tiltUI('on'); save('1');
    setTimeout(() => { if (this.tilt && !this.tiltSeen) { this.setTilt(false); this.tiltUI('none'); } }, 1500);   // a touch laptop has no sensor
  }
  poll() {
    const k = this.keys; let steer = 0, brake = 0, hb = false, thr = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) steer -= 1; if (k.has('KeyD') || k.has('ArrowRight')) steer += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) brake = 1; if (k.has('KeyW') || k.has('ArrowUp')) thr = 1; if (k.has('Space')) hb = true;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p) continue; const ax = p.axes[0] || 0; if (Math.abs(ax) > 0.15) { steer = ax; this.any = true; }
      const b = (i) => p.buttons[i] && (p.buttons[i].pressed || p.buttons[i].value > 0.2);
      if (b(6)) { brake = Math.max(brake, p.buttons[6].value || 1); this.any = true; } if (b(7)) thr = 1; if (b(0) || b(1)) { hb = true; this.any = true; }
    }
    if (this.tiltSteer) steer = this.tiltSteer; const lr = (this.touchR ? 1 : 0) - (this.touchL ? 1 : 0); if (lr) steer = lr;
    if (this.touchSteer) steer = this.touchSteer; if (this.touchBrake) brake = 1; if (this.touchDrift) hb = true;
    this.steer = Math.max(-1, Math.min(1, steer)); this.brake = brake; this.handbrake = hb; this.throttleKey = thr;
    return this;
  }
}
