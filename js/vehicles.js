// The garage: every drivable vehicle is data (a body builder, wheel layout, driver seat, handling numbers). Car.setVehicle() builds from it.
// phys: vmax m/s, accel / launch (m/s²), brake, grip (side slip decay) and hgrip (handbrake grip), steer (max wheel angle at rest) and steerLoss (taken off at speed),
//       wb wheelbase for the yaw rate, boostAccel / boostV (extra push and extra top speed), boostDrain / boostRegen (energy per second).
//       Optional feel (defaults in car.js): steerRate (how fast the wheel follows the input), yawDamp (how fast the body follows the wheel), hbYaw (handbrake
//       yaw boost), slide (power-slide: grip lost at full lock and throttle), roll / pitch [gain, max rad], spring [stiffness, damping].
// show: showroom camera distance scale for big vehicles; wheels: [x, z, radius?, width?] front pair first; glass: a see-through cabin drawn over the driver; exhaust: pipe tips [x, y, z]; engine: audio character.
import { carGeometry, carGlassGeometry, carLightsGeometry, roadsterGeometry, roadsterLightsGeometry, vanGeometry, vanGlassGeometry, vanLightsGeometry,
  superGeometry, superGlassGeometry, superLightsGeometry, pickupGeometry, pickupGlassGeometry, pickupLightsGeometry } from './models.js';

const WHEELS_COUPE = [[-0.86, 1.42], [0.86, 1.42], [-0.86, -1.42], [0.86, -1.42]];
const WHEELS_ROAD = [[-0.88, 1.33], [0.88, 1.33], [-0.88, -1.3], [0.88, -1.3]];
const WHEELS_VAN = [[-0.93, 1.75, 0.42, 0.3], [0.93, 1.75, 0.42, 0.3], [-0.93, -1.55, 0.42, 0.3], [0.93, -1.55, 0.42, 0.3]];
const WHEELS_SUPER = [[-0.9, 1.38, 0.35, 0.27], [0.9, 1.38, 0.35, 0.27], [-0.88, -1.38, 0.37, 0.33], [0.88, -1.38, 0.37, 0.33]];
const WHEELS_PICKUP = [[-0.9, 1.62, 0.5, 0.38], [0.9, 1.62, 0.5, 0.38], [-0.9, -1.6, 0.5, 0.38], [0.9, -1.6, 0.5, 0.38]];

export const VEHICLES = [
  { id: 'coupe', name: 'SUN COUPE', tag: 'BALANCED · EASY TO DRIFT', paint: 0xff6b57, geo: () => carGeometry({ wheels: false, glass: false }), glass: carGlassGeometry, lights: carLightsGeometry, wheels: WHEELS_COUPE, tyreR: 0.37,
    driver: { x: -0.38, y: 0.08, z: -0.2, s: 0.6 }, beams: { x: 0.62, y: 0.68, z: 2.35 }, shadow: [2.8, 5.6], rear: -2.35, exhaust: [[-0.45, 0.4, -2.36], [0.45, 0.4, -2.36]],
    engine: { base: 38, range: 70, gear: 55, buzz: 0.5 },
    phys: { vmax: 46, accel: 15, launch: 26, brake: 30, grip: 8.5, hgrip: 1.4, steer: 0.58, steerLoss: 0.38, wb: 2.7, boostAccel: 20, boostV: 12, boostDrain: 0.3, boostRegen: 0.1, slide: 0.15 } },
  { id: 'roadster', name: 'VOLT ROADSTER', tag: 'ELECTRIC · QUICK · LIGHT', paint: 0xd81f2a, geo: () => roadsterGeometry({ wheels: false }), lights: roadsterLightsGeometry, wheels: WHEELS_ROAD, tyreR: 0.37,
    driver: { x: -0.4, y: 0.5, z: -0.25, s: 0.58 }, helmet: true, beams: { x: 0.62, y: 0.6, z: 2.2 }, shadow: [2.7, 5.4], rear: -2.3, exhaust: [[-0.4, 0.42, -2.3], [0.4, 0.42, -2.3]], flame: [0.35, 0.65, 1],
    engine: { base: 60, range: 160, gear: 0, buzz: 1 },
    phys: { vmax: 54, accel: 19, launch: 34, brake: 34, grip: 9.6, hgrip: 1.6, steer: 0.62, steerLoss: 0.4, wb: 2.6, boostAccel: 26, boostV: 16, boostDrain: 0.32, boostRegen: 0.1, steerRate: 12, roll: [0.003, 0.05], spring: [150, 11] } },
  { id: 'van', name: 'SNACK VAN', tag: 'DELIVERY · TALL · LOADS OF GRIP', paint: 0x5fd3bc, geo: () => vanGeometry(), glass: vanGlassGeometry, lights: vanLightsGeometry, wheels: WHEELS_VAN, tyreR: 0.42,
    driver: { x: -0.45, y: 0.78, z: 1.12, s: 0.66 }, beams: { x: 0.74, y: 1.14, z: 2.62 }, shadow: [3.0, 6.0], show: 1.3, rear: -2.6, exhaust: [[0.62, 0.42, -2.58]],
    engine: { base: 30, range: 52, gear: 40, buzz: 0.3 },
    phys: { vmax: 40, accel: 14, launch: 25, brake: 26, grip: 11, hgrip: 2.4, steer: 0.5, steerLoss: 0.3, wb: 3.3, boostAccel: 24, boostV: 20, boostDrain: 0.26, boostRegen: 0.1,
      steerRate: 6, yawDamp: 6, hbYaw: 1.3, roll: [0.01, 0.1], pitch: [0.011, 0.08], spring: [70, 6] } },
  { id: 'super', name: 'SIDEWINDER', tag: 'SUPERCAR · FAST · TWITCHY', paint: 0x7b4dff, geo: () => superGeometry(), glass: superGlassGeometry, lights: superLightsGeometry, wheels: WHEELS_SUPER, tyreR: 0.36,
    driver: { x: -0.36, y: -0.02, z: -0.25, s: 0.5 }, beams: { x: 0.66, y: 0.6, z: 2.1 }, shadow: [2.9, 5.5], rear: -2.3, exhaust: [[-0.3, 0.45, -2.3], [0.3, 0.45, -2.3]],
    engine: { base: 52, range: 120, gear: 70, buzz: 0.8 },
    phys: { vmax: 60, accel: 22, launch: 38, brake: 38, grip: 8, hgrip: 1.2, steer: 0.66, steerLoss: 0.46, wb: 2.76, boostAccel: 32, boostV: 20, boostDrain: 0.36, boostRegen: 0.1,
      steerRate: 16, yawDamp: 13, hbYaw: 1.6, slide: 0.25, roll: [0.0022, 0.035], pitch: [0.004, 0.04], spring: [170, 13] } },
  { id: 'pickup', name: 'DUST HAULER', tag: 'PICKUP · TOUGH · POWER SLIDES', paint: 0x2e7fd1, geo: () => pickupGeometry(), glass: pickupGlassGeometry, lights: pickupLightsGeometry, wheels: WHEELS_PICKUP, tyreR: 0.5,
    driver: { x: -0.42, y: 0.58, z: 0.12, s: 0.6 }, beams: { x: 0.8, y: 1.14, z: 2.55 }, shadow: [3.0, 5.9], show: 1.15, rear: -2.5, exhaust: [[-0.7, 0.55, -2.5]],
    engine: { base: 32, range: 60, gear: 48, buzz: 0.35 },
    phys: { vmax: 44, accel: 14, launch: 30, brake: 28, grip: 7.2, hgrip: 1.0, steer: 0.56, steerLoss: 0.34, wb: 3.22, boostAccel: 20, boostV: 13, boostDrain: 0.3, boostRegen: 0.11,
      steerRate: 8, yawDamp: 8, hbYaw: 1.85, slide: 0.5, roll: [0.008, 0.11], pitch: [0.009, 0.07], spring: [90, 7] } },
];
// Mode vehicles (kind 'mode') are not driven in the city: TURN THE KEY loads js/modes/<mode>.js, a self-contained world (see js/modes/README.md).
// SHIP flips a mode on for everyone; until then it is reachable only by ?v=<id> (so the modes can be tested on the live host before they appear in the garage).
const SHIP = { rocket: true, sub: true };
const WANT = new URLSearchParams(location.search).get('v');
for (const m of [
  { id: 'rocket', kind: 'mode', mode: 'space', name: 'STAR HOPPER', tag: 'ROCKET · TO ORBIT AND BEYOND' },
  { id: 'sub', kind: 'mode', mode: 'sub', name: 'DEEP SNACK', tag: 'SUBMARINE · DIVE TO THE TRENCH' },
]) if (SHIP[m.id] || WANT === m.id) VEHICLES.push(m);
export const vehicleById = (id) => VEHICLES.find((v) => v.id === id) || VEHICLES[0];
export const carById = (id) => VEHICLES.find((v) => v.id === id && v.kind !== 'mode') || VEHICLES[0];   // what the city Car can be built from
