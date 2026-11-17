// Keyboard, gamepad and touch merged into one state. Touch: drag anywhere on the left 60% to steer (a floating thumb stick),
// BRAKE and DRIFT buttons on the right. The car throttles itself during a run; brake/reverse is on S / Down / BRAKE.
export class Input {
  constructor(root) {
    this.keys = new Set(); this.steer = 0; this.brake = 0; this.handbrake = false; this.touched = false; this.any = false;
    this.touchSteer = 0; this.touchBrake = false; this.touchDrift = false; this.stickId = null; this.isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
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
    hold('#btnBrake', 'touchBrake'); hold('#btnDrift', 'touchDrift');
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
    if (this.touchSteer) steer = this.touchSteer; if (this.touchBrake) brake = 1; if (this.touchDrift) hb = true;
    this.steer = Math.max(-1, Math.min(1, steer)); this.brake = brake; this.handbrake = hb; this.throttleKey = thr;
    return this;
  }
}
