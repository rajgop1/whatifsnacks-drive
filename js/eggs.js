// Eight easter eggs a replayer can find. Found ones persist in localStorage; the result card shows the counter.
import * as THREE from 'three';
import * as L from './layout.js';

export const EGGS = [
  { id: 'sand', name: 'SAND IN THE TIRES', hint: 'The beach is drivable.' },
  { id: 'air', name: 'SNACK-SIZED FLIGHT', hint: 'Stay airborne for over a second.' },
  { id: 'wish', name: 'MAKE A WISH', hint: 'Every park has a fountain.' },
  { id: 'snack', name: 'SECRET SNACK', hint: 'Something golden is parked in a lot.' },
  { id: 'tower', name: 'TOWER SPOTTER', hint: 'Stop at the north end of the palm avenue and look up.' },
  { id: 'donut', name: 'DONUT DELIVERY', hint: 'Hold the drift and spin a full circle.' },
  { id: 'twister', name: 'TORNADO TOURIST', hint: 'Take a ride in the data tornado.' },
  { id: 'moonwalk', name: 'MOONWALK', hint: 'Reverse fast for three seconds.' },
];
const KEY = 'wis_drive_eggs';

export class Eggs {
  constructor(scene) {
    try { this.found = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { this.found = new Set(); }
    this.run = new Set(); this.towerT = 0;
    const lot = L.blocks.find((b) => b.kind === 'lot') || L.blocks.find((b) => b.kind === 'park');
    this.snackPos = lot.kind === 'lot' ? [lot.cx, lot.cz] : [lot.x0 + 22, lot.z0 + 22];
    this.parks = L.blocks.filter((b) => b.kind === 'park').map((b) => [b.cx, b.cz]);
    this.snack = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.35), new THREE.MeshStandardMaterial({ color: 0xffd84d, metalness: 1, roughness: 0.2, emissive: 0x7a5200, emissiveIntensity: 0.6 }));
    this.snack.position.set(this.snackPos[0], 0.9, this.snackPos[1]); scene.add(this.snack);
  }
  reset() { this.run.clear(); this.towerT = 0; this.spin = 0; this.spinIdle = 0; this.revT = 0; this.snack.visible = true; }
  // returns the egg found this step, or null
  check(car, dt, time) {
    this.snack.rotation.y = time * 2; this.snack.position.y = 0.9 + Math.sin(time * 3) * 0.12;
    let hit = null;
    // donut: total yaw turned while sliding (a short pause in the slide is forgiven)
    if (!car.air && car.drift > 3) { this.spin = (this.spin || 0) + Math.abs(car.yawRate) * dt; this.spinIdle = 0; } else if ((this.spinIdle = (this.spinIdle || 0) + dt) > 0.5) this.spin = 0;
    this.revT = !car.air && car.vf < -6 ? (this.revT || 0) + dt : 0;
    if (this.spin > Math.PI * 2) { hit = 'donut'; this.spin = 0; }
    else if (car.lift > 0 && car.y > 6) hit = 'twister';
    else if (this.revT > 3) hit = 'moonwalk';
    else if (L.surface(car.x, car.z) === 'sand' && car.z > L.BEACH.z0 + 18) hit = 'sand';
    else if (car.air && car.airT > 1.1) hit = 'air';
    else if (this.parks.some(([x, z]) => Math.hypot(car.x - x, car.z - z) < 9)) hit = 'wish';
    else if (this.snack.visible && Math.hypot(car.x - this.snackPos[0], car.z - this.snackPos[1]) < 3.2) { hit = 'snack'; this.snack.visible = false; }
    else {
      const atEnd = Math.abs(car.x) < 14 && car.z < L.LAND.z0 + 60 && Math.cos(car.yaw) < -0.8 && car.speed < 1.5;
      this.towerT = atEnd ? this.towerT + dt : 0; if (this.towerT > 1.2) hit = 'tower';
    }
    if (!hit || this.run.has(hit)) return null;
    this.run.add(hit); this.found.add(hit); try { localStorage.setItem(KEY, JSON.stringify([...this.found])); } catch { /* private mode */ }
    return EGGS.find((e) => e.id === hit);
  }
}
