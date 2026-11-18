// Skid marks: a ring buffer of dark quads laid behind skidding tyres. One draw call, one preallocated BufferGeometry, no per-frame allocation;
// only the quads written this frame are uploaded. Marks fade out over FADE seconds (age is worked out in the shader).
//   const skids = new Skids(scene); skids.update(car, dt) every step (reads car.skidRear / car.skidFront); skids.reset() clears them all.
import * as THREE from 'three';
import { groundY } from './layout.js';

const N = 1600, FADE = 40;
export class Skids {
  constructor(scene) {
    this.pos = new Float32Array(N * 12); this.born = new Float32Array(N * 4).fill(-1e9);
    const idx = new Uint16Array(N * 6); for (let i = 0; i < N; i++) idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4 + 1, i * 4 + 2, i * 4 + 3], i * 6);
    const g = new THREE.BufferGeometry(); g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.pa = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage); this.ba = new THREE.BufferAttribute(this.born, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.pa); g.setAttribute('born', this.ba);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { now: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      vertexShader: `attribute float born; uniform float now; varying float vA; void main(){ vA = clamp(1.0 - (now - born) / ${FADE}.0, 0.0, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `varying float vA; void main(){ if (vA <= 0.0) discard; gl_FragColor = vec4(0.035, 0.033, 0.045, vA * 0.55); }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; scene.add(this.mesh);
    this.last = new Float32Array(4 * 8); this.ok = new Uint8Array(4); this.next = 0; this.t = 0;
  }
  cut() { this.ok.fill(0); }   // break every strip (after a teleport)
  reset() { this.born.fill(-1e9); this.ba.clearUpdateRanges(); this.ba.needsUpdate = true; this.cut(); }
  update(car, dt = 1 / 60) {
    this.t += dt; this.mat.uniforms.now.value = this.t;
    const W = car.v.wheels, sy = Math.sin(car.yaw), cy = Math.cos(car.yaw), Lb = this.last;
    for (let k = 0; k < W.length && k < 4; k++) {
      if (!(W[k][1] > 0 ? car.skidFront : car.skidRear)) { this.ok[k] = 0; continue; }
      const [x, z] = W[k], hw = (W[k][3] || 0.28) * 0.42, o = k * 8;
      const wx = car.x + cy * x + sy * z, wz = car.z - sy * x + cy * z, gy = groundY(wx, wz) + 0.02;
      if (!this.ok[k]) {   // start a strip: the first edge lies across the car
        this.ok[k] = 1; Lb[o] = wx; Lb[o + 1] = wz;
        Lb[o + 2] = wx + cy * hw; Lb[o + 3] = gy; Lb[o + 4] = wz - sy * hw; Lb[o + 5] = wx - cy * hw; Lb[o + 6] = gy; Lb[o + 7] = wz + sy * hw; continue;
      }
      const dx = wx - Lb[o], dz = wz - Lb[o + 1], d = Math.hypot(dx, dz);
      if (d > 4) { this.ok[k] = 0; continue; }
      if (d < 0.35) continue;
      const nx = -dz / d * hw, nz = dx / d * hw, i = this.next, p = this.pos, v = i * 12;
      p[v] = Lb[o + 2]; p[v + 1] = Lb[o + 3]; p[v + 2] = Lb[o + 4]; p[v + 3] = Lb[o + 5]; p[v + 4] = Lb[o + 6]; p[v + 5] = Lb[o + 7];
      p[v + 6] = wx + nx; p[v + 7] = gy; p[v + 8] = wz + nz; p[v + 9] = wx - nx; p[v + 10] = gy; p[v + 11] = wz - nz;
      // keep the strip continuous: the new far edge is the next quad's near edge (pick the pairing that does not cross)
      const flip = (p[v] - p[v + 6]) ** 2 + (p[v + 2] - p[v + 8]) ** 2 > (p[v] - p[v + 9]) ** 2 + (p[v + 2] - p[v + 11]) ** 2;
      if (flip) for (let q = 0; q < 3; q++) { const t = p[v + 6 + q]; p[v + 6 + q] = p[v + 9 + q]; p[v + 9 + q] = t; }
      this.born.fill(this.t, i * 4, i * 4 + 4);
      Lb[o] = wx; Lb[o + 1] = wz; for (let q = 0; q < 6; q++) Lb[o + 2 + q] = p[v + 6 + q];
      this.pa.addUpdateRange(v, 12); this.ba.addUpdateRange(i * 4, 4); this.pa.needsUpdate = this.ba.needsUpdate = true;
      this.next = (i + 1) % N;
    }
  }
  dispose() { this.mesh.geometry.dispose(); this.mat.dispose(); this.mesh.removeFromParent(); }
}
