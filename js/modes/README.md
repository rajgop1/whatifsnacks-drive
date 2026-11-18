# Modes: self-contained worlds the title can start

The city is the daily run. A **mode** is a separate world with its own `THREE.Scene`, camera rig, HUD and result card. The title garage lists the mode vehicles
(`js/vehicles.js`, entries with `kind: 'mode'`); TURN THE KEY on one calls `ensureMode()` in `main.js`, which does
`new (await import('./modes/<mode>.js')).default(ctx)`, `await m.load()`, then `m.start()`.

## The contract (`export default class`)

```js
export default class XMode {
  constructor(ctx)        // keep ctx; build nothing heavy here
  async load()            // once: build the scene, textures, geometry (the title shows its own loading state). Create `this.scene = new THREE.Scene()`.
  makePreview()           // optional, once: a THREE.Group of the vehicle for the title showroom (about 4.5 m long, origin on the ground, nose toward +z, flat-vector look,
                          //   no lights needed: the city's lights are on). Main adds it to the CITY scene at the car's spot and the title camera orbits it.
  start()                 // TURN THE KEY: reset state, show your HUD in ctx.ui, set ctx.labels({...}), begin (countdown etc.)
  step(dt)                // fixed 1/60 s. Read ctx.input (below). No allocation in here.
  render(dt)              // set camera position/rotation/fov/near/far yourself, then draw: ctx.renderer.render(this.scene, ctx.camera) or your own makePost(...)
  resize(w, h, pr)        // optional; main already updated camera.aspect and the renderer size
  stop()                  // the player left (X button / Esc / your BACK button calling ctx.exit()): remove listeners, clear ctx.ui (main clears it too), stop sounds
}
```

`ctx` = `{ id, THREE, renderer, camera, input, audio, hud, makePost, count, isTouch, DAY, ui, tier, vehicle, exit(), labels(l) }`
- `ctx.camera` is the shared PerspectiveCamera. Main resets near/far/up on exit, so change them freely (space needs far 40000+, near 0.1 to 1).
- `ctx.ui` is a full-screen `div#modeui` (pointer-events none, z-index 3). Append your HUD and result card to it; set `pointer-events:auto` on buttons only. Reuse the
  look: Montserrat 900 (font var `--f`), navy panels `#141a3a` / `#1f2756`, sun yellow `#ffd84d`, coral `#ff6b57`, cream `#fff4e6`, soft `0 4px 0 rgba(0,0,0,.35)` buttons,
  all caps small labels with letter-spacing. Keep every tap target at least 44 px; mind the safe areas (`var(--sa-top)` etc.) and the top-left X exit button (40 px, always on).
  Put injected CSS in a `<style>` appended to `ctx.ui` on `start()`.
- `ctx.hud.toast(title, sub, seconds)` (big centred line), `ctx.hud.radio(text, seconds)` (the mascot radio panel at the top), `ctx.hud.plus(text, kind)` (floating +label) work in modes.
- `ctx.audio`: `chime(n)`, `whoosh(0|1|2)`, `crash(v)`, `thud()`, `alarm()`, `finish(win)`, `voice(text)` (a TTS-style radio voice), `start()` already called. Read `js/audio.js` for what is
  cheap to reuse; if you need a continuous sound (engine, rumble, sonar), make your own tiny WebAudio loop from `ctx.audio.ctx` if it exposes one (check), and fade it in `stop()`.
- `ctx.count(key)` adds 1 to an anonymous owner counter (key chars: a-z 0-9 - only). Main already counts `plays` and `car-<vehicle id>`. Add a few of your own, e.g. `space-karman`,
  `space-orbit`, `space-moon`, `sub-1000m`, `sub-trench`, so the owner can see how far people get. Never put user data in a key.
- `ctx.exit()` leaves the mode and returns to the title garage.

### Input (`ctx.input`, polled by main before each `step`)
`steer` -1..1 (A/D, arrows, gamepad stick, touch drag, hold arrows, phone tilt), `brake` 0..1 (S / Down / BRAKE button / gamepad left trigger), `handbrake` bool (Space / DRIFT button /
gamepad A), `boost` bool (W / Up / Shift / B / BOOST button / gamepad right trigger). Raw keys: `ctx.input.keys` is a `Set` of `KeyboardEvent.code`. Touch has only those five controls
(two arrows, BOOST, BRAKE, DRIFT), so every mode must be fully playable with them. Relabel the buttons with `ctx.labels({ boost: 'THRUST', brake: 'RISE', drift: 'PING' })` (names up to 7 letters).
Gamepad and keyboard may use more keys, but never require them.

## House rules
- **Look:** flat-vector explainer art, deep navy and warm accents, soft glows, original shapes (no logos, no real brand marks; generic names such as STAR HOPPER, DEEP SNACK).
  The renderer uses ACES tone mapping at exposure 0.55, so raw material colours look darker than in a plain three.js scene; push emissive and sky colours up (HDR values over 1 are fine).
  `ctx.makePost(renderer, scene, camera, tier)` gives bloom, grade, vignette and grain on tiers medium and high (see `js/post.js`; it tints for the city sun, so read it before using it); the `low` tier must stay usable (plain render).
- **Facts must be exact** and shown as short, spoken-style lines (TV-voice, contractions, one concrete detail). Sources live in the data files, not on screen. The owner's channel is science-first.
- **Performance:** a mid phone (tier medium, devicePixelRatio capped by main) must hold 30+ fps: under about 250 draw calls and 300k triangles, share geometries and materials,
  `InstancedMesh` for crowds (fish, stars, debris), no per-frame allocation, no per-frame texture upload. Build textures procedurally on a canvas (no network, no external files; the site has no build step).
  Dispose what you build in `stop()` only if you rebuild it in `start()`; otherwise keep it cached.
- **Retention:** a hook in the first 2 s, a new beat every 3 to 5 s, a fact toast at each milestone, a result card with a clear brag line, a one-tap RETRY and a BACK button. No dead air.
- **Tests:** write `tools/<mode>.js` (puppeteer-core, Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`, copy the server boilerplate from `tools/shot.js`). Boot with
  `?manual=1&v=<vehicle id>` (the garage picks it), call `window.__oc.key()` (starts the mode asynchronously), wait for `window.__oc.state === 'mode'`, then drive time with
  `window.__oc.advance(seconds)` (runs `step` at 60 Hz and one `render`). `window.__oc.mode` is your instance. Check: no console errors, the HUD fits phone (390x844, 844x390), tablet, desktop;
  look at screenshots (`node tools/shot.js out.png "?manual=1&v=rocket" 390 844 1500 "window.__oc.key()"` style) at every milestone and fix what looks wrong before reporting.
- **Do not edit** `main.js`, `hud.js`, `index.html`, `vehicles.js`, `car.js`, `models.js`, anything under `videos/`, `tools/jet3d`, `tools/uk3d`, or other modes. If you need a change there, say exactly what in your final report.
  New geometry helpers go in your own files (`js/modes/<mode>_*.js`).
- Test hosts never count visits (`counter.js` is off on localhost). Counting your keys is fine to call in tests.
