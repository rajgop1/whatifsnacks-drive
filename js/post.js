// Post chain for the medium/high tiers: bloom, then a grade pass (warm highlights, violet shadows, chromatic fringe, vignette, grain,
// speed lines, a soft anamorphic streak through the sun). The low tier renders straight to screen and uses a CSS vignette.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

export function makePost(renderer, scene, camera, tier) {
  if (tier === 'low') return { render() { renderer.render(scene, camera); }, setSize() {}, uniforms: null };
  const comp = new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType }));
  comp.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), tier === 'high' ? 0.55 : 0.45, 0.55, 0.82); comp.addPass(bloom);
  comp.addPass(new OutputPass());
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) }, sun: { value: new THREE.Vector2(0.2, 0.6) }, sunVis: { value: 1 }, speed: { value: 0 }, hit: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float time, sunVis, speed, hit; uniform vec2 res, sun; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){
        vec2 d = vUv - 0.5; float r2 = dot(d,d);
        vec2 off = d * (0.0015 + 0.01 * r2 + 0.006 * speed + 0.02 * hit);
        vec3 c = vec3(texture2D(tDiffuse, vUv + off).r, texture2D(tDiffuse, vUv).g, texture2D(tDiffuse, vUv - off).b);
        // radial speed smear toward the edges
        if (speed > 0.05) { vec3 acc = c; for (int i = 1; i < 5; i++) acc += texture2D(tDiffuse, vUv - d * float(i) * 0.012 * speed * r2 * 4.0).rgb; c = mix(c, acc / 5.0, smoothstep(0.02, 0.18, r2)); }
        float l = dot(c, vec3(0.299,0.587,0.114));
        c = mix(c, c * vec3(0.9,0.9,1.12), smoothstep(0.5, 0.0, l));
        c = mix(c, c * vec3(1.08,1.0,0.9), smoothstep(0.4, 1.0, l));
        c = (c - 0.5) * 1.12 + 0.5; c = mix(vec3(dot(c,vec3(0.299,0.587,0.114))), c, 1.12);
        vec2 ds = (vUv - sun) * vec2(res.x / res.y, 1.0); c += vec3(1.0,0.62,0.4) * exp(-abs(ds.y)*70.0) * exp(-abs(ds.x)*2.0) * 0.14 * sunVis;
        c += vec3(1.0,0.7,0.45) * exp(-length(ds) * 6.0) * 0.06 * sunVis;
        // speed lines
        float a = atan(d.y, d.x); float ln = step(0.985, h(vec2(floor(a * 90.0), floor(time * 18.0)))) * smoothstep(0.08, 0.3, r2) * speed;
        c += ln * 0.35;
        c *= mix(0.6, 1.0, smoothstep(0.85, 0.2, length(d) * 1.2));
        c += (h(vUv * res + time * 61.0) - 0.5) * 0.035;
        c = mix(c, vec3(1.0, 0.35, 0.2), hit * 0.15 * smoothstep(0.1, 0.4, r2));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  comp.addPass(grade);
  return {
    uniforms: grade.uniforms,
    render() { comp.render(); },
    setSize(w, h, pr) { comp.setPixelRatio(pr); comp.setSize(w, h); grade.uniforms.res.value.set(w * pr, h * pr); bloom.resolution.set(w * pr / 2, h * pr / 2); },
  };
}
