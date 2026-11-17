// Pooled particles in one THREE.Points draw call: tyre smoke, sparks, packet bursts, dust, splashes. No per-frame allocation.
// Smoke/dust (non-additive) is drawn at half alpha: near the chase camera big puffs otherwise white out the frame.
import * as THREE from 'three';

const N = 900;
export class Particles {
  constructor(scene) {
    this.pos = new Float32Array(N * 3); this.vel = new Float32Array(N * 3); this.col = new Float32Array(N * 3);
    this.life = new Float32Array(N); this.max = new Float32Array(N); this.size = new Float32Array(N); this.grow = new Float32Array(N); this.drag = new Float32Array(N); this.grav = new Float32Array(N);
    this.alpha = new Float32Array(N); this.sz = new Float32Array(N); this.add = new Float32Array(N); this.next = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('psize', new THREE.BufferAttribute(this.sz, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('additive', new THREE.BufferAttribute(this.add, 1));
    this.geo = g;
    const m = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 600 } }, transparent: true, depthWrite: false, vertexColors: true,
      vertexShader: `attribute float alpha; attribute float psize; attribute float additive; varying vec3 vC; varying float vA; varying float vAdd; uniform float scale;
        void main(){ vC = color; vA = alpha; vAdd = additive; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = psize * scale / max(1.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; varying float vAdd;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = dot(d, d) * 4.0; if (r > 1.0) discard; float a = (1.0 - r) * vA; if (vAdd > 0.5) a *= (1.0 - r); else a *= 0.5; gl_FragColor = vec4(vC * (vAdd > 0.5 ? 2.2 : 1.0), a); }`,
    });
    this.mat = m; this.points = new THREE.Points(g, m); this.points.frustumCulled = false; scene.add(this.points);
  }
  emit(x, y, z, vx, vy, vz, { life = 1, size = 1, grow = 1, drag = 1, grav = 0, r = 1, g = 1, b = 1, add = 0 } = {}) {
    const i = this.next; this.next = (this.next + 1) % N;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.max[i] = life; this.size[i] = size; this.grow[i] = grow; this.drag[i] = drag; this.grav[i] = grav;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b; this.add[i] = add;
    this.geo.attributes.additive.needsUpdate = true;
  }
  burst(x, y, z, n, speed, opts, up = 0.5) {
    for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, e = Math.random() * 2 - 1 + up, s = speed * (0.4 + Math.random() * 0.6); this.emit(x, y, z, Math.cos(a) * s, e * s, Math.sin(a) * s, opts); }
  }
  update(dt) {
    for (let i = 0; i < N; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt; const t = 1 - this.life[i] / this.max[i], k = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= k; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * k - this.grav[i] * dt; this.vel[i * 3 + 2] *= k;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.05 && this.grav[i] > 0) { this.pos[i * 3 + 1] = 0.05; this.vel[i * 3 + 1] *= -0.3; }
      this.alpha[i] = Math.min(1, (1 - t) * 1.6) * (t < 0.08 ? t / 0.08 : 1); this.sz[i] = this.size[i] * (1 + t * this.grow[i]);
    }
    const a = this.geo.attributes; a.position.needsUpdate = a.alpha.needsUpdate = a.psize.needsUpdate = a.color.needsUpdate = true;
  }
}
