// Builds every static thing in the world: ground, roads, buildings (merged per 300 m chunk so they frustum-cull), rooftop kit, neon,
// billboards, street lamps, traffic lights, palms, parks, beach, water, the bay bridge, the island with its lighthouse, the airport, far hills, clouds.
import * as THREE from 'three';
import { GeoBuilder, makeRng, canvas, tex, noiseNormal, TAU, M4, bakeColored } from './util.js';
import * as L from './layout.js';
import { buildingTextures, roadTextures, noiseTex, neonAtlas, billboardAtlas, palmLeafTexture, runwayTexture, NEON_WORDS } from './textures.js';
import { carGeometry, carLightsGeometry, tintMaterial } from './models.js';
import { CONFIG } from './config.js';
const _cm = new THREE.Matrix4(), _cp = new THREE.Vector3(), _cq = new THREE.Quaternion(), _cy = new THREE.Vector3(0, 1, 0), _cs = new THREE.Vector3(1, 1, 1);

const r = makeRng(777);
const PASTEL = [[1, 0.78, 0.84], [0.78, 0.95, 0.9], [0.86, 0.82, 1], [1, 0.88, 0.74], [0.78, 0.88, 1], [1, 0.95, 0.8], [1, 0.82, 0.92]];
const COOL = [[0.9, 0.88, 0.98], [0.82, 0.86, 0.96], [0.95, 0.9, 0.92], [0.86, 0.9, 0.9], [1, 0.92, 0.9]];
const CHUNK = 300;

export function buildCity(scene, quality, progress = () => {}) {
  const T = buildingTextures();
  const mats = {
    office: new THREE.MeshStandardMaterial({ map: T.office.map, emissiveMap: T.office.emissive, emissive: 0xffffff, vertexColors: true, roughness: 0.55, metalness: 0.25 }),
    glass: new THREE.MeshStandardMaterial({ map: T.glass.map, emissiveMap: T.glass.emissive, emissive: 0xffffff, vertexColors: true, roughness: 0.12, metalness: 0.65, envMapIntensity: 1.4 }),
    resi: new THREE.MeshStandardMaterial({ map: T.resi.map, emissiveMap: T.resi.emissive, emissive: 0xffffff, vertexColors: true, roughness: 0.8, metalness: 0.05 }),
    store: new THREE.MeshStandardMaterial({ map: T.store.map, emissiveMap: T.store.emissive, emissive: 0xffffff, vertexColors: true, roughness: 0.6, metalness: 0.1 }),
    kit: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.15 }),
  };
  const UVS = { office: [24, 56], glass: [24, 56], resi: [24, 56], store: [24, 6] };
  const chunks = new Map(), kit = new GeoBuilder();
  const chunk = (x, z) => { const k = `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`; let c = chunks.get(k); if (!c) chunks.set(k, (c = { office: new GeoBuilder(), glass: new GeoBuilder(), resi: new GeoBuilder(), store: new GeoBuilder() })); return c; };
  const beacons = [], neon = [], boards = [], tanks = [], cranes = [];

  const addBox = (kind, x0, x1, y0, y1, z0, z1, col, opts = {}) => { const [uw, uh] = UVS[kind]; chunk((x0 + x1) / 2, (z0 + z1) / 2)[kind].box(x0, x1, y0, y1, z0, z1, col, { uw, uh, u0: r() * 4, ...opts }); };
  const podium = (x0, x1, z0, z1, col) => addBox('store', x0, x1, 0, 5.6, z0, z1, col, { ao: 0.9, u0: Math.floor(r() * 4) * 0.25 });
  const roofKit = (x0, x1, z0, z1, y) => {
    const n = 1 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) { const s = 2 + r() * 4, bx = x0 + 3 + r() * Math.max(0, x1 - x0 - 6 - s), bz = z0 + 3 + r() * Math.max(0, z1 - z0 - 6 - s); kit.box(bx, bx + s, y, y + 1.2 + r() * 2.2, bz, bz + s * (0.6 + r() * 0.8), [0.72, 0.7, 0.76], { roofCol: [0.5, 0.5, 0.55] }); }
    if (r() < 0.35) tanks.push([(x0 + x1) / 2 + (r() - 0.5) * 6, y, (z0 + z1) / 2 + (r() - 0.5) * 6]);
    kit.box(x0, x1, y, y + 0.6, z0, z0 + 0.4, [0.6, 0.58, 0.64]); kit.box(x0, x1, y, y + 0.6, z1 - 0.4, z1, [0.6, 0.58, 0.64]);   // parapets
    kit.box(x0, x0 + 0.4, y, y + 0.6, z0, z1, [0.6, 0.58, 0.64]); kit.box(x1 - 0.4, x1, y, y + 0.6, z0, z1, [0.6, 0.58, 0.64]);
  };
  // a sign on the facade of a low building that faces the street
  const signOn = (x0, x1, z0, z1, y, side) => {
    const w = 6.5, hh = 1.6, idx = Math.floor(r() * NEON_WORDS.length);
    let cx, cz, ang; if (side === 0) { cx = (x0 + x1) / 2; cz = z1 + 0.25; ang = 0; } else if (side === 1) { cx = x1 + 0.25; cz = (z0 + z1) / 2; ang = Math.PI / 2; } else if (side === 2) { cx = (x0 + x1) / 2; cz = z0 - 0.25; ang = Math.PI; } else { cx = x0 - 0.25; cz = (z0 + z1) / 2; ang = -Math.PI / 2; }
    neon.push({ cx, cy: y, cz, ang, w, h: hh, idx, vertical: false });
  };
  const faceToStreet = (b, x0, x1, z0, z1) => { const d = [b.z1 - z1, b.x1 - x1, z0 - b.z0, x0 - b.x0]; let m = 0; for (let i = 1; i < 4; i++) if (d[i] < d[m]) m = i; return m; };

  // ---- buildings per block
  const inset = L.RW / 2 + L.SW + 0.5;
  for (const b of L.blocks) {
    const x0 = b.x0 + inset, x1 = b.x1 - inset, z0 = b.z0 + inset, z1 = b.z1 - inset;
    if (b.kind === 'park' || b.kind === 'lot') continue;
    if (b.kind === 'downtown') {
      const core = Math.exp(-((b.dt / L.DOWNTOWN.r) ** 2) * 2.2);
      if (r() < 0.55) { // one big tower
        const fw = 40 + r() * 22, fd = 40 + r() * 22, cx = b.cx + (r() - 0.5) * 6, cz = b.cz + (r() - 0.5) * 6;
        const h = 70 + core * (120 + r() * 200) + r() * 40, glass = r() < 0.55, col = glass ? [0.85 + r() * 0.15, 0.9, 1] : r.pick(COOL);
        podium(x0, x1, z0, z1, [0.95, 0.92, 0.95]);
        if (r() < 0.3 && glass) { // round glass tower
          const rad = Math.min(fw, fd) / 2; chunk(cx, cz).glass.prism(cx, cz, rad, 5.6, h, 16, col, { uw: 24, uh: 56 });
          kit.prism(cx, cz, rad * 0.55, h, h + 6, 12, [0.7, 0.7, 0.8]); beacons.push([cx, h + 18, cz]); kit.box(cx - 0.4, cx + 0.4, h + 6, h + 18, cz - 0.4, cz + 0.4, [0.8, 0.8, 0.85]);
        } else {
          let y = 5.6, w = fw, d = fd; const tiers = h > 200 ? 3 : h > 110 ? 2 : 1, frac = tiers === 3 ? [0.55, 0.3, 0.15] : tiers === 2 ? [0.68, 0.32] : [1];
          for (let t = 0; t < tiers; t++) {
            const th = (h - 5.6) * frac[t];
            addBox(glass ? 'glass' : 'office', cx - w / 2, cx + w / 2, y, y + th, cz - d / 2, cz + d / 2, col);
            kit.box(cx - w / 2 - 0.5, cx + w / 2 + 0.5, y + th, y + th + 0.9, cz - d / 2 - 0.5, cz + d / 2 + 0.5, [0.75, 0.72, 0.8]);  // ledge
            y += th + 0.9; w *= 0.74; d *= 0.74;
          }
          if (r() < 0.45) { kit.box(cx - 0.6, cx + 0.6, y, y + 25 + r() * 25, cz - 0.6, cz + 0.6, [0.85, 0.85, 0.9]); beacons.push([cx, y + 26, cz]); }
          else { kit.prism(cx, cz, Math.min(w, d) * 0.45, y, y + 4, 8, [0.72, 0.7, 0.8]); if (r() < 0.5) beacons.push([cx, y + 5, cz]); else roofKit(cx - w / 2, cx + w / 2, cz - d / 2, cz + d / 2, y - 0.9); }
          if (r() < 0.45 && h > 100) boards.push({ cx, cz: cz + d / 2 / 0.74, y: y - 0.9 - 2, w: Math.min(26, w / 0.74 * 0.9), ang: 0, idx: r.int(0, 7) });
          if (r() < 0.22 && h > 90) cranes.push([cx + (r() - 0.5) * w * 0.5, y, cz + (r() - 0.5) * d * 0.5, r() * 6.28]);
        }
        L.addSolid(x0, z0, x1, z1, h + 30, 'building');
      } else { // a cluster of 2-4 mid towers
        const n = 2 + Math.floor(r() * 3), cells = [[0, 0], [1, 0], [0, 1], [1, 1]];
        for (let k = 0; k < n; k++) {
          const [qx, qz] = cells[k], hx = (x1 - x0) / 2, hz = (z1 - z0) / 2, bx0 = x0 + qx * hx + 1.5, bx1 = bx0 + hx - 3, bz0 = z0 + qz * hz + 1.5, bz1 = bz0 + hz - 3;
          const h = 30 + core * (60 + r() * 110) + r() * 30, glass = r() < 0.4, col = glass ? [0.9, 0.95, 1] : r.pick(COOL);
          podium(bx0, bx1, bz0, bz1, [0.95, 0.92, 0.95]);
          addBox(glass ? 'glass' : 'office', bx0 + 1, bx1 - 1, 5.6, h, bz0 + 1, bz1 - 1, col);
          roofKit(bx0 + 1, bx1 - 1, bz0 + 1, bz1 - 1, h);
          if (r() < 0.3) beacons.push([(bx0 + bx1) / 2, h + 3.5, (bz0 + bz1) / 2]);
          L.addSolid(bx0, bz0, bx1, bz1, h + 5, 'building');
        }
      }
    } else if (b.kind === 'beachfront') { // pastel deco hotels facing the sea, with a vertical neon fin
      let x = x0;
      while (x < x1 - 14) {
        const w = Math.min(x1 - x, 20 + r() * 14), d = 24 + r() * 16, h = 16 + r() * 34, col = r.pick(PASTEL), bz1 = z1, bz0 = bz1 - d;
        podium(x, x + w, bz0, bz1, col);
        addBox('resi', x + 0.6, x + w - 0.6, 5.6, h, bz0 + 0.6, bz1 - 0.6, col);
        kit.box(x, x + w, h, h + 1.2, bz0, bz1, col.map((v) => v * 0.9));                              // deco cornice
        const fx = x + w / 2; kit.box(fx - 1.2, fx + 1.2, h * 0.45, h + 9, bz1 - 0.6, bz1 + 1.6, col.map((v) => v * 0.95));  // fin
        neon.push({ cx: fx, cy: h * 0.45 + (h * 0.55 + 9) / 2, cz: bz1 + 1.7, ang: 0, w: Math.min(15, h * 0.55 + 7), h: 2.2, idx: r.pick([0, 3, 6, 8, 11, 15, 2]), vertical: true });
        roofKit(x + 0.6, x + w - 0.6, bz0 + 0.6, bz1 - 0.6, h + 1.2);
        L.addSolid(x, bz0, x + w, bz1 + 1.6, h + 10, 'building');
        x += w + 3 + r() * 6;
      }
    } else { // low-rise district: shops, apartments, a few mid blocks
      const nx = r() < 0.5 ? 2 : 3, nz = r() < 0.6 ? 2 : 3, cw = (x1 - x0) / nx, cd = (z1 - z0) / nz;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        if (r() < 0.12) continue;                                                                         // gap / alley
        const bx0 = x0 + i * cw + 0.8, bx1 = bx0 + cw - 1.6, bz0 = z0 + j * cd + 0.8, bz1 = bz0 + cd - 1.6;
        const tall = r() < 0.15, h = tall ? 24 + r() * 40 : 6 + r() * 16, kind = r() < 0.65 ? 'resi' : 'office', col = kind === 'resi' ? r.pick(PASTEL) : r.pick(COOL);
        podium(bx0, bx1, bz0, bz1, col);
        if (h > 7) addBox(kind, bx0 + 0.4, bx1 - 0.4, 5.6, h, bz0 + 0.4, bz1 - 0.4, col);
        roofKit(bx0 + 0.4, bx1 - 0.4, bz0 + 0.4, bz1 - 0.4, Math.max(h, 5.6));
        if (r() < 0.55) signOn(bx0, bx1, bz0, bz1, 6.6, faceToStreet(b, bx0, bx1, bz0, bz1));
        if (r() < 0.16 && h < 14) boards.push({ cx: (bx0 + bx1) / 2, cz: (bz0 + bz1) / 2, y: h + 1, w: 16, ang: [0, -Math.PI / 2, Math.PI, Math.PI / 2][faceToStreet(b, bx0, bx1, bz0, bz1)], idx: r.int(0, 7), legs: true });
        L.addSolid(bx0, bz0, bx1, bz1, Math.max(h, 5.6) + 3, 'building');
      }
    }
  }
  progress(0.35);

  // ---- emit chunk meshes
  const cityGroup = new THREE.Group(); scene.add(cityGroup);
  for (const c of chunks.values()) for (const k of ['office', 'glass', 'resi', 'store']) {
    if (!c[k].count) continue; const m = new THREE.Mesh(c[k].build(), mats[k]); m.castShadow = m.receiveShadow = true; cityGroup.add(m);
  }

  // ---- ground: city slab with the road tile, seawalls
  const lampSpots = [], h = L.RW / 2;
  for (const t of [25, 75]) { lampSpots.push([h + 0.8, t, -1, 0], [L.P - h - 0.8, t, 1, 0], [t, h + 0.8, 0, -1], [t, L.P - h - 0.8, 0, 1]); }
  const RT = roadTextures(L.P, L.RW, L.SW, lampSpots);
  const puddleC = canvas(512), pg = puddleC.getContext('2d'); pg.fillStyle = '#e0e0e0'; pg.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 46; i++) { // after-rain puddles: smooth patches mostly in the lanes and gutters
    const t = r() * 512, side = r() * 4 | 0, off = (r() < 0.6 ? 6 + r() * 30 : r() * 46), x = side < 2 ? (side ? 512 - off : off) : t, y = side < 2 ? t : (side === 2 ? off : 512 - off), rw = 5 + r() * 16, rh = 3 + r() * 8;
    const gr = pg.createRadialGradient(x, y, 0, x, y, rw); gr.addColorStop(0, 'rgba(90,90,90,0.9)'); gr.addColorStop(0.7, 'rgba(110,110,110,0.7)'); gr.addColorStop(1, 'rgba(224,224,224,0)'); pg.fillStyle = gr; pg.beginPath(); pg.ellipse(x, y, rw, rh, r() * 3, 0, 7); pg.fill();
  }
  const roadMat = new THREE.MeshStandardMaterial({ map: RT.map, emissiveMap: RT.emissive, emissive: 0xffffff, emissiveIntensity: 0, roughness: 1, roughnessMap: tex(puddleC, { srgb: false }), metalness: 0.0, envMapIntensity: 0.9 });
  const quad = (x0, x1, z0, z1, y, uvScale = 1 / L.P, flipV = true) => {
    const g = new THREE.BufferGeometry(), u = (x) => x * uvScale, v = (z) => (flipV ? -z : z) * uvScale;
    g.setAttribute('position', new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z0], 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([u(x0), v(z1), u(x1), v(z1), u(x1), v(z0), u(x0), v(z0)], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]); return g;
  };
  const ground = new THREE.Mesh(quad(L.LAND.x0, L.LAND.x1, L.LAND.z0, L.LAND.z1 + 1, 0), roadMat); ground.receiveShadow = true; scene.add(ground);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x8a7f8c, roughness: 0.9 });
  const slab = (x0, x1, z0, z1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 6, z1 - z0), wallMat); m.position.set((x0 + x1) / 2, -3.05, (z0 + z1) / 2); scene.add(m); };
  slab(L.LAND.x0, L.LAND.x1, L.LAND.z0, L.LAND.z1);

  // ---- parks and parking lots
  const grassC = noiseTex('#5f8f4a', ['#4d7a3c', '#78a858', '#6a9a4f', '#88b864'], 256, 0.5, 9);
  { const g = grassC.getContext('2d'); g.globalAlpha = 0.08; for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#fff' : '#000'; g.fillRect(0, i * 32, 256, 32); } }
  const grassMat = new THREE.MeshStandardMaterial({ map: tex(grassC), roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const pathMat = new THREE.MeshStandardMaterial({ color: 0xc9b8a8, roughness: 1, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  const lotC = canvas(256); { const g = lotC.getContext('2d'); g.fillStyle = '#3a3640'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#e6e2ea'; for (let x = 0; x < 256; x += 32) { g.fillRect(x, 0, 3, 90); g.fillRect(x, 166, 3, 90); } }
  const lotMat = new THREE.MeshStandardMaterial({ map: tex(lotC), roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const trees = [], parked = [];
  for (const b of L.blocks) {
    const x0 = b.x0 + inset - 0.5, x1 = b.x1 - inset + 0.5, z0 = b.z0 + inset - 0.5, z1 = b.z1 - inset + 0.5;
    if (b.kind === 'park') {
      const gm = new THREE.Mesh(quad(x0, x1, z0, z1, 0.02, 1 / 24), grassMat); gm.receiveShadow = true; scene.add(gm);
      const pm1 = new THREE.Mesh(quad(b.cx - 2, b.cx + 2, z0, z1, 0.03), pathMat), pm2 = new THREE.Mesh(quad(x0, x1, b.cz - 2, b.cz + 2, 0.03), pathMat); scene.add(pm1, pm2);
      for (let k = 0; k < 14; k++) { const tx = x0 + 4 + r() * (x1 - x0 - 8), tz = z0 + 4 + r() * (z1 - z0 - 8); if (Math.abs(tx - b.cx) < 5 || Math.abs(tz - b.cz) < 5) continue; trees.push([tx, tz, 0.8 + r() * 0.6]); L.addSolid(tx - 0.4, tz - 0.4, tx + 0.4, tz + 0.4, 6, 'tree'); }
      kit.prism(b.cx, b.cz, 5, 0, 0.8, 16, [0.85, 0.82, 0.86]); kit.prism(b.cx, b.cz, 1, 0.8, 3, 8, [0.85, 0.82, 0.86]); kit.prism(b.cx, b.cz, 2, 3, 3.3, 10, [0.85, 0.82, 0.86]);
      L.addSolid(b.cx - 5, b.cz - 5, b.cx + 5, b.cz + 5, 1, 'fountain');
    } else if (b.kind === 'lot') {
      scene.add(new THREE.Mesh(quad(x0, x1, z0, z1, 0.02, 1 / 25.6, false), lotMat));
      for (let row = 0; row < 2; row++) for (let k = 0; k < 9; k++) if (r() < 0.7) {
        const px = x0 + 3.2 + k * 8, pz = row ? z1 - 9 : z0 + 9 - 4.5 + 4.5; parked.push([px, pz, row ? 0 : Math.PI]); L.addSolid(px - 1.1, pz - 2.4, px + 1.1, pz + 2.4, 1.6, 'parked');
      }
    }
  }

  // ---- beach: sand, boardwalk, lifeguard towers, umbrellas
  const sandC = noiseTex('#e8c8a6', ['#d9b48e', '#f4dcc0', '#caa07c', '#fff0dc'], 256, 0.6, 5);
  const sandGeo = new THREE.PlaneGeometry(L.LAND.x1 - L.LAND.x0 + 200, L.BEACH.z1 - L.BEACH.z0 + 60, 2, 30); sandGeo.rotateX(-Math.PI / 2);
  { const p = sandGeo.attributes.position, uv = sandGeo.attributes.uv; for (let i = 0; i < p.count; i++) { const z = p.getZ(i) + (L.BEACH.z0 + L.BEACH.z1 + 60) / 2; p.setZ(i, z); p.setY(i, L.sandY(z) - 0.02); uv.setXY(i, p.getX(i) / 12, z / 12); } sandGeo.computeVertexNormals(); }
  const sand = new THREE.Mesh(sandGeo, new THREE.MeshStandardMaterial({ map: tex(sandC), roughness: 1 })); sand.receiveShadow = true; scene.add(sand);
  const plankC = canvas(128, 256); { const g = plankC.getContext('2d'); for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#a77a5a' : '#b78a68'; g.fillRect(0, i * 16, 128, 15); g.fillStyle = '#5a3e30'; g.fillRect(0, i * 16 + 15, 128, 1); } }
  const bw = new THREE.Mesh(new THREE.BoxGeometry(L.LAND.x1 - L.LAND.x0, 0.3, 8), new THREE.MeshStandardMaterial({ map: tex(plankC), roughness: 0.85 }));
  bw.geometry.attributes.uv.array.forEach((v, i, a) => { if (i % 2 === 0) a[i] = v * 120; }); bw.position.set(0, 0.0, L.BEACH.z0 + 4); bw.receiveShadow = true; scene.add(bw);
  const umbrellas = [], guards = [];
  for (let x = L.LAND.x0 + 40; x < L.LAND.x1 - 40; x += 18 + r() * 30) if (r() < 0.6) umbrellas.push([x, L.BEACH.z0 + 27 + r() * 30, r()]);
  for (let x = L.LAND.x0 + 120; x <= L.LAND.x1 - 80; x += 260) guards.push(x);
  const GZ = L.BEACH.z0 + 43;
  for (const gx of guards) { // pastel lifeguard huts on stilts
    const col = r.pick(PASTEL), y0 = L.sandY(GZ);
    for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) kit.box(gx + dx - 0.12, gx + dx + 0.12, y0, y0 + 2.6, GZ + dz - 0.12, GZ + dz + 0.12, [0.9, 0.9, 0.9]);
    kit.box(gx - 1.8, gx + 1.8, y0 + 2.6, y0 + 4.6, GZ - 1.8, GZ + 1.8, col); kit.box(gx - 2.1, gx + 2.1, y0 + 4.6, y0 + 4.9, GZ - 2.1, GZ + 2.1, [1, 0.4, 0.45]);
    L.addSolid(gx - 1.8, GZ - 1.8, gx + 1.8, GZ + 1.8, y0 + 5, 'hut');
  }

  // ---- water, foam
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x0c3446, roughness: 0.07, metalness: 0.0, normalMap: noiseNormal(256, 3), normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.2, ior: 1.33 });
  waterMat.normalMap.repeat.set(220, 220);
  const water = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), waterMat); water.rotation.x = -Math.PI / 2; water.position.y = L.WATER_Y; scene.add(water);
  const foamC = canvas(256, 64); { const g = foamC.getContext('2d'); for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`; g.beginPath(); g.ellipse(Math.random() * 256, 20 + Math.random() * 30 * Math.random(), 2 + Math.random() * 10, 1 + Math.random() * 2, 0, 0, 7); g.fill(); } }
  const foamMat = new THREE.MeshBasicMaterial({ map: tex(foamC), transparent: true, opacity: 0.55, depthWrite: false, color: 0xfff2ea }); foamMat.map.repeat.set(60, 1);
  const foamZ = L.BEACH.z0 + 8 + (L.BEACH.z1 - L.BEACH.z0 - 8) * Math.pow((-L.WATER_Y) / 2.6, 1 / 1.3);
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(L.LAND.x1 - L.LAND.x0 + 200, 12), foamMat); foam.rotation.x = -Math.PI / 2; foam.position.set(0, L.WATER_Y + 0.06, foamZ + 2); scene.add(foam);

  const B = L.BRIDGE, IS = L.ISLAND, AP = L.APRON, beam = new THREE.Group(), lamp = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ toneMapped: false }));
  if (L.FULL) fullWorld();
  function fullWorld() {
  // ---- bay bridge: an arched deck, two coral pylons, main cables and suspenders
  const bridgeGroup = new THREE.Group(); scene.add(bridgeGroup);
  const deckC = canvas(256, 512); { const g = deckC.getContext('2d'); g.fillStyle = '#34303a'; g.fillRect(0, 0, 256, 512); g.fillStyle = '#e8c14a'; g.fillRect(124, 0, 3, 512); g.fillRect(130, 0, 3, 512); g.fillStyle = '#e0dce6'; for (let y = 0; y < 512; y += 64) { g.fillRect(62, y, 3, 32); g.fillRect(190, y, 3, 32); } g.fillRect(6, 0, 3, 512); g.fillRect(247, 0, 3, 512); }
  const deckTex = tex(deckC, { aniso: 16 });
  {
    const n = 80, P3 = [], U = [], I = [], side = [], sideI = [], rail = [], railI = [];
    for (let i = 0; i <= n; i++) {
      const x = B.x0 + (B.x1 - B.x0) * i / n, y = L.bridgeY(x) + 0.05, v = x / 20;
      P3.push(x, y, B.z - B.w / 2, x, y, B.z + B.w / 2); U.push(0, v, 1, v);
      side.push(x, y - 0.1, B.z - B.w / 2 - 0.4, x, y - 2.8, B.z - B.w / 2 - 0.4, x, y - 0.1, B.z + B.w / 2 + 0.4, x, y - 2.8, B.z + B.w / 2 + 0.4);
      rail.push(x, y, B.z - B.w / 2 - 0.3, x, y + 1.1, B.z - B.w / 2 - 0.3, x, y, B.z + B.w / 2 + 0.3, x, y + 1.1, B.z + B.w / 2 + 0.3);
      if (i < n) { const o = i * 2; I.push(o, o + 1, o + 3, o, o + 3, o + 2); const s = i * 4; sideI.push(s, s + 4, s + 1, s + 1, s + 4, s + 5, s + 2, s + 3, s + 6, s + 3, s + 7, s + 6, s + 1, s + 5, s + 3, s + 3, s + 5, s + 7); railI.push(s, s + 4, s + 1, s + 1, s + 4, s + 5, s + 2, s + 3, s + 6, s + 3, s + 7, s + 6); }
    }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); dg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); dg.setIndex(I); dg.computeVertexNormals();
    const deck = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ map: deckTex, roughness: 0.85 })); deck.receiveShadow = true; bridgeGroup.add(deck);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(side, 3)); sg.setIndex(sideI); sg.computeVertexNormals();
    bridgeGroup.add(new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ color: 0x6a6070, roughness: 0.7, side: THREE.DoubleSide })));
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rail, 3)); rg.setIndex(railI); rg.computeVertexNormals();
    bridgeGroup.add(new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ color: 0xe8e0e8, roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide })));
  }
  const pylonX = [B.x0 + (B.x1 - B.x0) * 0.27, B.x0 + (B.x1 - B.x0) * 0.73], PH = 125, coral = new THREE.MeshStandardMaterial({ color: 0xff7a5c, roughness: 0.55, metalness: 0.2 });
  for (const px of pylonX) {
    for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(4, PH - L.WATER_Y, 4), coral); leg.position.set(px, (PH + L.WATER_Y) / 2, B.z + s * 14); leg.castShadow = true; bridgeGroup.add(leg); L.addSolid(px - 2, B.z + s * 14 - 2, px + 2, B.z + s * 14 + 2, PH, 'pylon'); }
    for (const y of [L.bridgeY(px) - 4, 70, PH - 6]) { const cb = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3, 32), coral); cb.position.set(px, y, B.z); bridgeGroup.add(cb); }
    beacons.push([px, PH + 1.5, B.z - 14], [px, PH + 1.5, B.z + 14]);
  }
  {
    const cableMat = new THREE.MeshStandardMaterial({ color: 0xff8a6a, roughness: 0.5 }), sus = [];
    const cy = (x) => { // main cable height
      const [a, b] = pylonX; if (x <= a) return L.bridgeY(B.x0) + 3 + (PH - 3) * ((x - B.x0) / (a - B.x0)) ** 1.6;
      if (x >= b) return L.bridgeY(B.x1) + 3 + (PH - 3) * ((B.x1 - x) / (B.x1 - b)) ** 1.6;
      const t = (x - a) / (b - a); return L.bridgeY(x) + 4 + (PH - L.bridgeY(x) - 4) * (2 * t - 1) ** 2;
    };
    for (const s of [-1, 1]) {
      const pts = []; for (let i = 0; i <= 120; i++) { const x = B.x0 + (B.x1 - B.x0) * i / 120; pts.push(new THREE.Vector3(x, cy(x), B.z + s * 12)); }
      bridgeGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 0.55, 6), cableMat));
      for (let x = B.x0 + 8; x < B.x1 - 4; x += 8) { if (Math.abs(x - pylonX[0]) < 3 || Math.abs(x - pylonX[1]) < 3) continue; sus.push(x, cy(x), B.z + s * 12, x, L.bridgeY(x) + 0.5, B.z + s * 10.6); }
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sus, 3));
    bridgeGroup.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xffb8a0, transparent: true, opacity: 0.7 })));
  }

  // ---- island: villas, pools, the lighthouse
  const islandTop = new THREE.Mesh(quad(IS.x0, IS.x1, IS.z0, IS.z1, 0, 1 / 24), new THREE.MeshStandardMaterial({ map: tex(grassC), roughness: 1 })); islandTop.receiveShadow = true; scene.add(islandTop);
  slab(IS.x0, IS.x1, IS.z0, IS.z1);
  const islandRoad = new THREE.Mesh(quad(IS.x0, IS.x1 - 120, B.z - 9, B.z + 9, 0.03, 1 / 20), new THREE.MeshStandardMaterial({ map: deckTex.clone(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 }));
  islandRoad.material.map.rotation = Math.PI / 2; islandRoad.material.map.needsUpdate = true; scene.add(islandRoad);
  const pools = [];
  for (let k = 0; k < 16; k++) {
    const vx = IS.x0 + 30 + r() * (IS.x1 - IS.x0 - 160), vz = IS.z0 + 30 + r() * (IS.z1 - IS.z0 - 60);
    if (Math.abs(vz - B.z) < 30) continue; const w = 14 + r() * 10, d = 12 + r() * 8, hh = 6 + r() * 5;
    addBox('resi', vx, vx + w, 0, hh, vz, vz + d, [1, 0.98, 0.96]); kit.box(vx - 1, vx + w + 1, hh, hh + 0.6, vz - 1, vz + d + 1, [0.95, 0.93, 0.92]);
    pools.push([vx + w / 2, vz + d + 6, Math.min(w - 2, 10), 5]); L.addSolid(vx, vz, vx + w, vz + d, hh + 1, 'villa');
  }
  const LH = L.LIGHTHOUSE; scene.add(lamp); lamp.geometry = new THREE.CylinderGeometry(2.3, 2.3, 3.5, 12); lamp.material.color.set(0xfff1c0);
  for (let k = 0; k < 7; k++) kit.prism(LH.x, LH.z, 4.2 - k * 0.3, k * 5, k * 5 + 5, 16, k % 2 ? [1, 0.25, 0.3] : [0.98, 0.97, 0.97]);
  kit.prism(LH.x, LH.z, 3.6, 35, 36, 16, [0.2, 0.2, 0.25]); kit.prism(LH.x, LH.z, 2.6, 39.5, 41, 12, [1, 0.25, 0.3]);
  lamp.position.set(LH.x, 37.8, LH.z);
  L.addSolid(LH.x - 4.2, LH.z - 4.2, LH.x + 4.2, LH.z + 4.2, 41, 'lighthouse');
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const beamGeo = new THREE.ConeGeometry(14, 260, 20, 1, true); beamGeo.translate(0, -130, 0); beamGeo.rotateZ(Math.PI / 2);
  beam.position.set(LH.x, 37.8, LH.z); const b1 = new THREE.Mesh(beamGeo, beamMat), b2 = new THREE.Mesh(beamGeo, beamMat); b2.rotation.y = Math.PI; beam.add(b1, b2); scene.add(beam);
  const poolMat = new THREE.MeshStandardMaterial({ color: 0x3ad6e8, emissive: 0x1a8aa8, emissiveIntensity: 0.4, roughness: 0.1, polygonOffset: true, polygonOffsetFactor: -3 });
  for (const [px, pz, w, d] of pools) scene.add(new THREE.Mesh(quad(px - w / 2, px + w / 2, pz - d / 2, pz + d / 2, 0.04), poolMat));

  // ---- airport: grass field, runway, apron, hangars, terminal, tower, edge lights, the spur road
  const A = L.AIRPORT, RWY = L.RUNWAY;
  scene.add(new THREE.Mesh(quad(A.x0, A.x1, A.z0, A.z1, 0, 1 / 24), new THREE.MeshStandardMaterial({ map: tex(grassC), roughness: 1, color: 0xd8e0b8 })));
  slab(A.x0, A.x1, A.z0, A.z1);
  const rwyGeo = quad(RWY.x - RWY.w / 2, RWY.x + RWY.w / 2, RWY.z0, RWY.z1, 0.05, 1); { const uv = rwyGeo.attributes.uv; uv.setXY(0, 0, 0); uv.setXY(1, 1, 0); uv.setXY(2, 1, 1); uv.setXY(3, 0, 1); }
  const rwy = new THREE.Mesh(rwyGeo, new THREE.MeshStandardMaterial({ map: runwayTexture(), roughness: 0.85, polygonOffset: true, polygonOffsetFactor: -2 })); rwy.receiveShadow = true; scene.add(rwy);
  const concrete = new THREE.MeshStandardMaterial({ color: 0x8e8894, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1 });
  scene.add(new THREE.Mesh(quad(AP.x0, AP.x1, AP.z0, AP.z1, 0.03), concrete));
  scene.add(new THREE.Mesh(quad(RWY.x + RWY.w / 2 - 2, AP.x0 + 2, -330, -270, 0.03), concrete));                // taxiway to the runway
  scene.add(new THREE.Mesh(quad(RWY.x + RWY.w / 2 - 2, AP.x0 + 2, 400, 440, 0.03), concrete));                  // south taxiway
  scene.add(new THREE.Mesh(quad(AP.x0 + 40, AP.x0 + 80, -270, 440, 0.03), concrete));
  const spur = new THREE.Mesh(quad(AP.x1 - 2, L.LAND.x0 + 1, L.BRIDGE.z - 9, L.BRIDGE.z + 9, 0.04, 1 / 20), islandRoad.material); scene.add(spur);
  const hangarMat = new THREE.MeshStandardMaterial({ color: 0xc8cad6, roughness: 0.45, metalness: 0.5, side: THREE.DoubleSide });
  for (let k = 0; k < 3; k++) {
    const hz = AP.z0 + 50 + k * 75, hx = AP.x1 - 22, hg = new THREE.CylinderGeometry(20, 20, 50, 20, 1, true, 0, Math.PI); hg.rotateZ(Math.PI / 2); hg.rotateY(Math.PI / 2);
    const hm = new THREE.Mesh(hg, hangarMat); hm.position.set(hx, 0, hz); hm.rotation.y = Math.PI / 2; hm.castShadow = true; scene.add(hm);
    kit.box(hx - 25, hx + 25, 0, 2, hz - 20, hz + 20, [0.5, 0.5, 0.56]); L.addSolid(hx - 25, hz - 20, hx + 25, hz + 20, 20, 'hangar');
  }
  chunk(AP.x1 + 40, -300).glass.box(AP.x1 + 20, AP.x1 + 70, 0, 14, -440, -180, [0.9, 0.95, 1], { uw: 24, uh: 56 }); L.addSolid(AP.x1 + 20, -440, AP.x1 + 70, -180, 15, 'terminal');
  const tw = [AP.x1 + 45, -500];
  kit.prism(tw[0], tw[1], 3, 0, 38, 12, [0.92, 0.9, 0.94]); chunk(tw[0], tw[1]).glass.prism(tw[0], tw[1], 6, 38, 44, 12, [0.8, 0.95, 1]); kit.prism(tw[0], tw[1], 6.8, 44, 45.5, 12, [0.4, 0.4, 0.46]);
  beacons.push([tw[0], 47, tw[1]]); L.addSolid(tw[0] - 6, tw[1] - 6, tw[0] + 6, tw[1] + 6, 46, 'tower');
  const rwyLights = [];
  for (let z = RWY.z0; z <= RWY.z1; z += 30) for (const s of [-1, 1]) rwyLights.push([RWY.x + s * (RWY.w / 2 + 1), 0.4, z, 0]);
  for (let x = -RWY.w / 2; x <= RWY.w / 2; x += 4) { rwyLights.push([RWY.x + x, 0.4, RWY.z1 + 2, 1]); rwyLights.push([RWY.x + x, 0.4, RWY.z0 - 2, 2]); }
  for (let k = 1; k < 10; k++) rwyLights.push([RWY.x, 1.2, RWY.z1 + k * 25, 3], [RWY.x - 6, 1.2, RWY.z1 + k * 25, 3], [RWY.x + 6, 1.2, RWY.z1 + k * 25, 3]);
  const rlMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 6, 4), new THREE.MeshBasicMaterial({ toneMapped: false }), rwyLights.length);
  const rlCols = [new THREE.Color(1.6, 1.5, 1.2), new THREE.Color(0.3, 2.2, 0.6), new THREE.Color(2.2, 0.3, 0.3), new THREE.Color(2.2, 2.0, 1.4)];
  rwyLights.forEach(([x, y, z, k], i) => { rlMesh.setMatrixAt(i, M4(x, y, z)); rlMesh.setColorAt(i, rlCols[k]); }); scene.add(rlMesh);
  }
  progress(0.55);

  // ---- rooftop kit, water tanks
  if (tanks.length) { const tk = new THREE.InstancedMesh(new THREE.CylinderGeometry(2.4, 2.4, 3.6, 12), new THREE.MeshStandardMaterial({ color: 0x7a5a5e, roughness: 0.85 }), tanks.length); tanks.forEach(([x, y, z], i) => tk.setMatrixAt(i, M4(x, y + 3.6, z))); scene.add(tk);
    const legs = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.6, 1.8, 1.8, 6), new THREE.MeshStandardMaterial({ color: 0x3a3440 }), tanks.length); tanks.forEach(([x, y, z], i) => legs.setMatrixAt(i, M4(x, y + 0.9, z))); scene.add(legs); }

  // ---- neon signs and billboards
  const NA = neonAtlas(), neonMat = new THREE.MeshBasicMaterial({ map: NA, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
  {
    const P3 = [], U = [], I = [];
    for (const s of neon) {
      const u0 = (s.idx % 2) * 0.5, v1 = 1 - Math.floor(s.idx / 2) / 8, v0 = v1 - 1 / 8, ca = Math.cos(s.ang), sa = Math.sin(s.ang), o = P3.length / 3;
      // local quad: width along the facade (x), height up; a vertical sign rotates the text 90 degrees
      const hw = (s.vertical ? s.h : s.w) / 2, hh = (s.vertical ? s.w : s.h) / 2;
      const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
      const uvs = s.vertical ? [[u0 + 0.5, v1], [u0 + 0.5, v0], [u0, v0], [u0, v1]].map((x, i, a) => a[(i + 1) % 4]) : [[u0, v0], [u0 + 0.5, v0], [u0 + 0.5, v1], [u0, v1]];
      corners.forEach(([lx, ly], i) => { P3.push(s.cx + lx * ca, s.cy + ly, s.cz - lx * sa); U.push(...uvs[i]); });
      I.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
    scene.add(new THREE.Mesh(g, neonMat));
  }
  const BA = billboardAtlas(), boardMat = new THREE.MeshStandardMaterial({ map: BA, emissiveMap: BA, emissive: 0xffffff, emissiveIntensity: 0.3, roughness: 0.6 });
  boards.push({ cx: 120, cz: L.BEACH.z0 + 14, y: 12, w: 30, ang: Math.PI, idx: 0, legs: true }, { cx: -26, cz: -186, y: 30, w: 40, ang: 0, idx: 0, legs: false });
  if (L.FULL) boards.push({ cx: -1100, cz: -210, y: 10, w: 36, ang: Math.PI / 2, idx: 2, legs: true }, { cx: 900, cz: -330, y: 12, w: 30, ang: -Math.PI / 2, idx: 3, legs: true });
  {
    const P3 = [], U = [], I = [];
    for (const b of boards) {
      const hw = b.w / 2, hh = b.w / 8, ca = Math.cos(b.ang), sa = Math.sin(b.ang), v1 = 1 - b.idx / 8, v0 = v1 - 1 / 8, o = P3.length / 3;
      [[-hw, 0, 0, v0], [hw, 0, 1, v0], [hw, 2 * hh, 1, v1], [-hw, 2 * hh, 0, v1]].forEach(([lx, ly, u, v]) => { P3.push(b.cx + lx * ca, b.y + 1.5 + ly, b.cz - lx * sa); U.push(u, v); });
      I.push(o, o + 1, o + 2, o, o + 2, o + 3);
      kit.box(b.cx - 0.4, b.cx + 0.4, b.legs ? 0 : b.y, b.y + 1.5, b.cz - 0.4, b.cz + 0.4, [0.4, 0.4, 0.45]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I); g.computeVertexNormals();
    const bm = new THREE.Mesh(g, boardMat); bm.material.side = THREE.DoubleSide; scene.add(bm);
  }
  // ---- across the water to the north: a far skyline and our supertall at the end of the x = 0 avenue (district only)
  if (!L.FULL) {
    const far = { office: new GeoBuilder(), glass: new GeoBuilder() }, Z0 = -620;
    const shore = new THREE.Mesh(quad(-2200, 2200, -2000, Z0 + 20, 0), new THREE.MeshStandardMaterial({ color: 0x4a3f5c, roughness: 1 })); scene.add(shore); slab(-2200, 2200, -2000, Z0 + 20);
    for (let k = 0; k < 190; k++) {
      const x = -1500 + r() * 3000, z = Z0 - 30 - r() * 1100; if (Math.abs(x) < 60 && z > -900) continue;
      const core = Math.exp(-((x / 700) ** 2)), h = 30 + r() * 70 + core * r() * 230, w = 26 + r() * 40, d = 26 + r() * 40, glass = r() < 0.45;
      far[glass ? 'glass' : 'office'].box(x - w / 2, x + w / 2, 0, h, z - d / 2, z + d / 2, glass ? [0.9, 0.92, 1] : r.pick(COOL), { u0: r() * 4 });
      if (h > 150 && r() < 0.5) beacons.push([x, h + 2, z]); if (h > 120 && r() < 0.12) cranes.push([x, h, z, r() * 6.28]);
    }
    // the supertall: four tapering glass tiers, a crown, a spire, and a lit sign in the crown
    const ST = { x: 0, z: -800 }; let y = 0, w = 64; const tiers = [150, 130, 100, 70];
    for (const th of tiers) { far.glass.box(ST.x - w / 2, ST.x + w / 2, y, y + th, ST.z - w / 2, ST.z + w / 2, [1, 0.95, 0.92], { u0: 0.3 }); kit.box(ST.x - w / 2 - 1, ST.x + w / 2 + 1, y + th, y + th + 2, ST.z - w / 2 - 1, ST.z + w / 2 + 1, [0.85, 0.8, 0.9]); y += th + 2; w *= 0.8; }
    kit.box(ST.x - w / 2, ST.x + w / 2, y, y + 34, ST.z - w / 2, ST.z + w / 2, [0.3, 0.28, 0.4]); kit.box(ST.x - 1, ST.x + 1, y + 34, y + 120, ST.z - 1, ST.z + 1, [0.9, 0.9, 0.95]);
    beacons.push([ST.x, y + 122, ST.z]);
    const sc = canvas(256), sg = sc.getContext('2d'); sg.font = '900 220px "Montserrat","Arial Black",sans-serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.shadowColor = '#ffb347'; sg.shadowBlur = 30; sg.fillStyle = '#ffd84d'; sg.fillText(CONFIG.easterSix ? '6' : '?', 128, 140);
    const signMat = new THREE.MeshBasicMaterial({ map: tex(sc, { repeat: false }), transparent: true, toneMapped: false, depthWrite: false, color: new THREE.Color(2.2, 2.2, 2.2) });
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, m = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.9, w * 0.9), signMat); m.position.set(ST.x + Math.sin(a) * (w / 2 + 0.3), y + 17, ST.z + Math.cos(a) * (w / 2 + 0.3)); m.rotation.y = a; scene.add(m); }
    for (const k of ['office', 'glass']) if (far[k].count) scene.add(new THREE.Mesh(far[k].build(), mats[k]));
    L.addSolid(ST.x - 32, ST.z - 32, ST.x + 32, ST.z + 32, 900, 'supertall');
  }
  // ---- tower cranes (swing slowly in update)
  const craneGeo = bakeColored([[new THREE.BoxGeometry(1.6, 30, 1.6), 0xffb347, M4(0, 15, 0)], [new THREE.BoxGeometry(1.2, 30.2, 1.2), 0x7a4a20, M4(0, 15, 0)], [new THREE.BoxGeometry(48, 1.1, 1.1), 0xffb347, M4(14, 31, 0)], [new THREE.BoxGeometry(3, 2.2, 2.2), 0x2a2838, M4(1.5, 29.4, 0)],
    [new THREE.BoxGeometry(5, 2.5, 2.5), 0x8a8a96, M4(-8, 30, 0)], [new THREE.BoxGeometry(0.8, 5, 0.8), 0xffb347, M4(0, 34, 0)], [new THREE.BoxGeometry(0.08, 14, 0.08), 0x2a2838, M4(26, 24, 0)], [new THREE.BoxGeometry(1, 1.2, 1), 0xffd84d, M4(26, 16.5, 0)]]);
  const craneMesh = new THREE.InstancedMesh(craneGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }), Math.max(1, cranes.length)); craneMesh.count = cranes.length; craneMesh.castShadow = true; scene.add(craneMesh);
  for (const c of cranes) beacons.push([c[0], c[1] + 37, c[2]]);
  const kitMesh = new THREE.Mesh(kit.build(), mats.kit); kitMesh.castShadow = kitMesh.receiveShadow = true; scene.add(kitMesh);

  // ---- beacons (blink in update)
  const beaconMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.2), toneMapped: false });
  const beaconMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.9, 8, 6), beaconMat, Math.max(1, beacons.length)); beacons.forEach(([x, y, z], i) => beaconMesh.setMatrixAt(i, M4(x, y, z))); scene.add(beaconMesh);

  // ---- street lamps (every 50 m on every block edge) and the bridge lamps
  const lamps = [];
  for (const b of L.blocks) for (const [lx, lz, dx, dz] of lampSpots) lamps.push([b.x0 + lx, 0, b.z0 + lz, Math.atan2(dx, dz)]);
  for (let x = B.x0 + 20; x < B.x1; x += 40) { lamps.push([x, L.bridgeY(x), B.z - B.w / 2 - 0.2, Math.PI], [x, L.bridgeY(x), B.z + B.w / 2 + 0.2, 0]); }
  if (L.FULL) for (let x = AP.x1; x < L.LAND.x0; x += 40) lamps.push([x, 0, B.z - 10, Math.PI]);
  const lampGeo = bakeColored([[new THREE.CylinderGeometry(0.11, 0.16, 8, 6), 0x3b3a48, M4(0, 4, 0)], [new THREE.BoxGeometry(0.12, 0.12, 2.4), 0x3b3a48, M4(0, 7.9, 1.1)], [new THREE.BoxGeometry(0.45, 0.18, 0.9), 0x2a2936, M4(0, 7.85, 2.3)]]);
  const lampMesh = new THREE.InstancedMesh(lampGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.5 }), lamps.length);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd8a0, toneMapped: false }), bulbMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.38, 0.06, 0.8), bulbMat, lamps.length);
  lamps.forEach(([x, y, z, a], i) => { const m = M4(x, y, z, 0, a); lampMesh.setMatrixAt(i, m); bulbMesh.setMatrixAt(i, m.clone().multiply(M4(0, 7.74, 2.3))); });
  lampMesh.castShadow = true; scene.add(lampMesh, bulbMesh);
  for (const [x, , z] of lamps) if (Math.abs(z - B.z) > 12 || x < B.x0) L.addSolid(x - 0.2, z - 0.2, x + 0.2, z + 0.2, 8, 'pole');

  // ---- traffic lights (6 instanced bulb sets: axis x colour; colours switch per phase without touching instances)
  const tl = [];
  for (let i = L.XI[0] + 1; i < L.XI[1]; i++) for (let j = L.ZJ[0] + 1; j < L.ZJ[1]; j++) for (let d = 0; d < 4; d++) {
    const [dx, dz] = L.DIRS[d], rx = -dz, rz = dx, o = h + 0.7;
    tl.push({ x: i * L.P + rx * o + dx * o, z: j * L.P + rz * o + dz * o, yaw: Math.atan2(-dx, -dz), axis: dx !== 0 ? 1 : 0 });
  }
  const tlGeo = bakeColored([[new THREE.CylinderGeometry(0.13, 0.16, 6.2, 6), 0x2e2d38, M4(0, 3.1, 0)], [new THREE.BoxGeometry(6.2, 0.16, 0.16), 0x2e2d38, M4(-3.1, 6.0, 0)], [new THREE.BoxGeometry(0.5, 1.45, 0.42), 0x24232e, M4(-5.0, 5.4, 0)], [new THREE.BoxGeometry(0.75, 1.7, 0.06), 0x111018, M4(-5.0, 5.4, -0.22)]]);
  const tlMesh = new THREE.InstancedMesh(tlGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }), tl.length);
  const bulbGeo = new THREE.CircleGeometry(0.17, 10), sets = [[], []];
  for (let axis = 0; axis < 2; axis++) for (let c = 0; c < 3; c++) { const m = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), tl.filter((t) => t.axis === axis).length); sets[axis].push(m); scene.add(m); }
  const cnt = [0, 0];
  tl.forEach((t, k) => {
    const m = M4(t.x, 0, t.z, 0, t.yaw); tlMesh.setMatrixAt(k, m);
    for (let c = 0; c < 3; c++) sets[t.axis][c].setMatrixAt(cnt[t.axis], m.clone().multiply(M4(-5.0, 5.9 - c * 0.48, 0.22)));
    cnt[t.axis]++; L.addSolid(t.x - 0.25, t.z - 0.25, t.x + 0.25, t.z + 0.25, 7, 'pole');
  });
  scene.add(tlMesh);

  // ---- palms: boulevard, boardwalk, sand, island, airport road. Trunk + frond crown, instanced, crowns sway in the vertex shader.
  const palms = [];
  for (let x = L.LAND.x0 + 10; x < L.LAND.x1; x += 22) palms.push([x + r() * 4, 0, L.BEACH.z0 + 9 + r() * 2]);
  for (let k = 0; k < (L.LAND.x1 - L.LAND.x0) / 27; k++) { const x = L.LAND.x0 + r() * (L.LAND.x1 - L.LAND.x0), z = L.BEACH.z0 + 22 + r() * 30; palms.push([x, L.sandY(z), z]); }
  for (let z = L.ZJ[0] * L.P + 20; z < L.ZJ[1] * L.P; z += 25) if (Math.abs(z % L.P) > 15 && Math.abs(z % L.P) < 85) { palms.push([-L.RW / 2 - 1.3, 0, z], [L.RW / 2 + 1.3, 0, z]); }   // the palm avenue (x = 0)
  for (let x = L.XI[0] * L.P + 20; x < L.XI[1] * L.P; x += 26) if (((x % L.P) + L.P) % L.P > 15 && ((x % L.P) + L.P) % L.P < 85) palms.push([x, 0, (L.ZJ[1] - 1) * L.P - L.RW / 2 - 1.3]);
  if (L.FULL) for (let k = 0; k < 90; k++) { const x = IS.x0 + 10 + r() * (IS.x1 - IS.x0 - 20), z = IS.z0 + 10 + r() * (IS.z1 - IS.z0 - 20); if (Math.abs(z - B.z) > 12 && !L.insideSolid(x, 1, z)) palms.push([x, 0, z]); }
  if (L.FULL) for (let x = AP.x1 + 10; x < L.LAND.x0; x += 30) palms.push([x, 0, B.z + 13]);
  const trunkGeo = new THREE.CylinderGeometry(0.17, 0.3, 11, 7, 10); trunkGeo.translate(0, 5.5, 0);
  { const p = trunkGeo.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const y = p.getY(i), s = 1 + 0.12 * Math.sin(y * 6); p.setX(i, p.getX(i) * s + 0.022 * y * y); p.setZ(i, p.getZ(i) * s); const k = 0.5 + 0.12 * Math.sin(y * 6); c[i * 3] = 0.62 * k * 1.6; c[i * 3 + 1] = 0.48 * k * 1.6; c[i * 3 + 2] = 0.38 * k * 1.6; } trunkGeo.setAttribute('color', new THREE.BufferAttribute(c, 3)); trunkGeo.computeVertexNormals(); }
  const leafTex = palmLeafTexture(), fronds = [];
  for (let k = 0; k < 10; k++) {
    const g = new THREE.PlaneGeometry(1.3, 5.2, 1, 8); g.translate(0, 2.6, 0); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = p.getY(i), t = y / 5.2; p.setXYZ(i, p.getX(i) * (1 - t * 0.5), Math.sin(t * 1.6) * 2.6 - t * t * 2.8, y * 0.95); p.setX(i, p.getX(i)); }
    g.rotateX(-0.15 * (k % 3)); g.rotateY((k / 10) * TAU + r() * 0.3); g.translate(0.022 * 121, 11, 0); fronds.push(g);
  }
  const frondGeo = mergeGeos(fronds);
  const frondMat = new THREE.MeshStandardMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: 0xcfe8b8 });
  const windU = { value: 0 };
  frondMat.onBeforeCompile = (s) => { s.uniforms.uWind = windU; s.vertexShader = 'uniform float uWind;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
    float sway = (position.y - 10.0) * 0.05; float ph = instanceMatrix[3].x * 0.05 + instanceMatrix[3].z * 0.03;
    transformed.x += sin(uWind * 1.3 + ph) * sway * (0.6 + 0.4 * sin(uWind * 0.37 + ph)); transformed.z += cos(uWind * 1.1 + ph) * sway * 0.5;`); };
  const trunkMesh = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), palms.length), frondMesh = new THREE.InstancedMesh(frondGeo, frondMat, palms.length);
  palms.forEach(([x, y, z], i) => { const s = 0.75 + r() * 0.5, m = M4(x, y, z, (r() - 0.5) * 0.12, r() * TAU, (r() - 0.5) * 0.12, s, s * (0.85 + r() * 0.35), s); trunkMesh.setMatrixAt(i, m); frondMesh.setMatrixAt(i, m); });
  trunkMesh.castShadow = frondMesh.castShadow = true; scene.add(trunkMesh, frondMesh);
  for (const [x, , z] of palms) if (z < L.BEACH.z0 + 15) L.addSolid(x - 0.3, z - 0.3, x + 0.3, z + 0.3, 11, 'palm');

  // ---- park trees and beach umbrellas
  if (trees.length) {
    const tg = bakeColored([[new THREE.CylinderGeometry(0.2, 0.3, 3, 6), 0x6a4a3a, M4(0, 1.5, 0)], [new THREE.IcosahedronGeometry(2.6, 1), 0x4f8a45, M4(0, 4.6, 0)], [new THREE.IcosahedronGeometry(1.9, 1), 0x63a052, M4(0.9, 5.8, 0.4)]]);
    const tm = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), trees.length);
    trees.forEach(([x, z, s], i) => tm.setMatrixAt(i, M4(x, 0, z, 0, r() * TAU, 0, s, s, s))); tm.castShadow = true; scene.add(tm);
  }
  const umbGeo = bakeColored([[new THREE.CylinderGeometry(0.04, 0.04, 2.4, 5), 0xeeeeee, M4(0, 1.2, 0)], [new THREE.ConeGeometry(1.4, 0.5, 8, 1, true), 0xffffff, M4(0, 2.45, 0)]]);
  const umb = new THREE.InstancedMesh(umbGeo, tintMaterial({ roughness: 0.8, side: THREE.DoubleSide }), umbrellas.length);
  const umbCols = [0xff5d6c, 0x2ec4a6, 0xffc24a, 0x6c8cff, 0xff8ad8].map((c) => new THREE.Color(c));
  umbrellas.forEach(([x, z, k], i) => { umb.setMatrixAt(i, M4(x, L.sandY(z), z, (k - 0.5) * 0.3)); umb.setColorAt(i, umbCols[Math.floor(k * 5)]); }); scene.add(umb);

  // ---- parked cars in the lots
  if (parked.length) {
    const pm = new THREE.InstancedMesh(carGeometry(), tintMaterial({ roughness: 0.35, metalness: 0.55 }), parked.length);
    const pc = [0xe8e8ee, 0x1c1c24, 0xb02a3a, 0x2a4fa0, 0x8a8a96, 0xf0c040, 0x3a8a6a].map((c) => new THREE.Color(c));
    parked.forEach(([x, z, a], i) => { pm.setMatrixAt(i, M4(x, 0, z, 0, a)); pm.setColorAt(i, r.pick(pc)); }); pm.castShadow = true; scene.add(pm);
  }

  // ---- far hills and clouds
  {
    const n = 160, P3 = [], C = [], I = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * TAU, R0 = L.FULL ? 4200 : 2000, R1 = L.FULL ? 4800 : 2500, hh = 160 + 520 * Math.abs(Math.sin(a * 3.1) * Math.cos(a * 5.3 + 1)) + 120 * r();
      P3.push(Math.cos(a) * R0, -10, Math.sin(a) * R0, Math.cos(a) * R1, hh, Math.sin(a) * R1); C.push(0.32, 0.26, 0.42, 0.55, 0.42, 0.62);
      if (i < n) { const o = i * 2; I.push(o, o + 2, o + 1, o + 1, o + 2, o + 3); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P3, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
    scene.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  }
  const cloudC = canvas(512, 256); { const g = cloudC.getContext('2d'); for (let i = 0; i < 70; i++) { const x = 60 + r() * 392, y = 70 + r() * 110, rr = 30 + r() * 70, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, 2 * rr, 2 * rr); } }
  const cloudTex = tex(cloudC, { repeat: false }), clouds = [];
  for (let i = 0; i < 30; i++) {
    const a = r() * TAU, d = (L.FULL ? 2500 : 1500) + r() * 3500, m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5 + 0.35 * r(), depthWrite: false, fog: false }));
    m.scale.set(1600 + r() * 2200, 450 + r() * 600, 1); m.position.set(Math.cos(a) * d, 500 + r() * 900, Math.sin(a) * d); scene.add(m); clouds.push(m);
  }

  progress(0.8);
  // ---- per-frame: windows on at dusk, neon, lamps, beacons, signals, wet roads, water and palms
  const tlColors = [[new THREE.Color(3, 0.25, 0.2), new THREE.Color(0.25, 0.04, 0.04)], [new THREE.Color(3, 1.9, 0.2), new THREE.Color(0.25, 0.18, 0.03)], [new THREE.Color(0.2, 3, 0.9), new THREE.Color(0.03, 0.22, 0.08)]];
  let lastPhase = '';
  return {
    mats, roadMat, waterMat, cloudSprites: clouds, beam, sets,
    update(time, dt, env) {
      const night = env.night, dusk = env.dusk;
      mats.office.emissiveIntensity = mats.resi.emissiveIntensity = 0.06 + night * 1.25 + dusk * 0.35;
      mats.glass.emissiveIntensity = 0.04 + night * 1.0 + dusk * 0.3;
      mats.store.emissiveIntensity = 0.25 + night * 1.6 + dusk * 0.4;
      neonMat.color.setScalar(0.85 + night * 2.4 + dusk * 0.8); boardMat.emissiveIntensity = 0.25 + night * 0.9;
      roadMat.emissiveIntensity = night * 1.1 + dusk * 0.25; bulbMat.color.setRGB(1, 0.85, 0.62).multiplyScalar(0.6 + night * 3 + dusk);
      beaconMat.color.setRGB(Math.sin(time * 3.2) > 0.3 ? 4 : 0.3, 0.15, 0.15);
      // wet roads: darker, glossier asphalt that mirrors the sky and lamps
      roadMat.roughness = 0.92 - env.wet * 0.6; roadMat.metalness = 0.05 + env.wet * 0.25; roadMat.color.setScalar(1 - env.wet * 0.35);
      for (let k = 0; k < cranes.length; k++) { _cm.compose(_cp.set(cranes[k][0], cranes[k][1], cranes[k][2]), _cq.setFromAxisAngle(_cy, cranes[k][3] + Math.sin(time * 0.05 + k) * 1.2), _cs); craneMesh.setMatrixAt(k, _cm); } craneMesh.instanceMatrix.needsUpdate = true;
      waterMat.normalMap.offset.set(time * 0.004, time * 0.006); foamMat.map.offset.x = time * 0.01; foamMat.opacity = 0.4 + 0.15 * Math.sin(time * 0.8);
      windU.value = time * (1 + env.wind * 2);
      beam.rotation.y = time * 0.8; beam.visible = night + dusk > 0.3; lamp.material.color.setScalar(0.6 + night * 3);
      const ph = L.signalPhase(time);
      if (ph !== lastPhase) {
        lastPhase = ph;
        for (let axis = 0; axis < 2; axis++) { const s = L.signal(axis, time); for (let c = 0; c < 3; c++) sets[axis][c].material.color.copy(tlColors[c][s === 'RYG'[c] ? 0 : 1]); }
      }
      for (const c of clouds) c.material.color.copy(env.cloudColor);
    },
  };
}

function mergeGeos(geos) {
  let n = 0, ni = 0; for (const g of geos) { n += g.attributes.position.count; ni += g.index.count; }
  const P3 = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), I = []; let o = 0;
  for (const g of geos) { g.computeVertexNormals(); P3.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); U.set(g.attributes.uv.array, o * 2); for (const i of g.index.array) I.push(i + o); o += g.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P3, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.BufferAttribute(U, 2)); g.setIndex(I); void ni; return g;
}
