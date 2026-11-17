// The garage: every drivable vehicle is data (a body builder, wheel layout, driver seat, handling numbers). Car.setVehicle() builds from it.
// phys: vmax m/s, accel / launch (m/s²), brake, grip (side slip decay) and hgrip (handbrake grip), steer (max wheel angle at rest) and steerLoss (taken off at speed),
//       wb wheelbase for the yaw rate, boostAccel / boostV (extra push and extra top speed), boostDrain / boostRegen (energy per second).
import { carGeometry, carLightsGeometry, roadsterGeometry, roadsterLightsGeometry } from './models.js';

const WHEELS_COUPE = [[-0.86, 1.42], [0.86, 1.42], [-0.86, -1.42], [0.86, -1.42]];
const WHEELS_ROAD = [[-0.88, 1.33], [0.88, 1.33], [-0.88, -1.3], [0.88, -1.3]];

export const VEHICLES = [
  { id: 'coupe', name: 'SUN COUPE', tag: 'BALANCED · EASY TO DRIFT', paint: 0xff6b57, geo: () => carGeometry({ wheels: false }), lights: carLightsGeometry, wheels: WHEELS_COUPE, tyreR: 0.37,
    driver: { x: -0.38, y: 0.12, z: -0.2, s: 0.62 }, beams: { x: 0.62, y: 0.68, z: 2.35 }, shadow: [2.8, 5.6], rear: -2.35,
    phys: { vmax: 46, accel: 15, launch: 26, brake: 30, grip: 8.5, hgrip: 1.4, steer: 0.58, steerLoss: 0.38, wb: 2.7, boostAccel: 20, boostV: 12, boostDrain: 0.3, boostRegen: 0.1 } },
  { id: 'roadster', name: 'VOLT ROADSTER', tag: 'ELECTRIC · QUICK · LIGHT', paint: 0xd81f2a, geo: () => roadsterGeometry({ wheels: false }), lights: roadsterLightsGeometry, wheels: WHEELS_ROAD, tyreR: 0.37,
    driver: { x: -0.4, y: 0.5, z: -0.25, s: 0.58 }, helmet: true, beams: { x: 0.62, y: 0.6, z: 2.2 }, shadow: [2.7, 5.4], rear: -2.3,
    phys: { vmax: 54, accel: 19, launch: 34, brake: 34, grip: 9.6, hgrip: 1.6, steer: 0.62, steerLoss: 0.4, wb: 2.6, boostAccel: 26, boostV: 16, boostDrain: 0.32, boostRegen: 0.1 } },
];
export const vehicleById = (id) => VEHICLES.find((v) => v.id === id) || VEHICLES[0];
