// Daily scenarios = data + a few optional callbacks. The run engine (run.js) reads these fields:
//   id, title (mission line), radio (mascot line at 1 s), packets (how many), startPct, packetPct,
//   events: [{ at: seconds after the timer starts, type, ...params }]  types: 'tornado' | 'cubeRain' | 'gravity' | 'iceRain' | 'slick'
//   fact: one checked science line for the result card, factSource: where the number comes from, scienceUrl: the matching Short (TODO owner)
//   hooks (optional): onStart(api), onUpdate(api, dt), onPacket(api, n)
// The rotation is SCENARIOS[(day - 1) % SCENARIOS.length], so #001 is "Last 10%".
export const SCENARIOS = [
  {
    id: 'last10', name: 'LAST 10%',
    title: 'WHAT IF #{n}: 50 MILLION PEOPLE HIT DOWNLOAD',
    radio: "Bar's stuck at 90. The last 10% is across town. Go!",
    meter: 'DOWNLOAD', startPct: 90, packetPct: 1, packets: 10,
    events: [
      { at: 0, type: 'tornado', ahead: 2 },          // a data tornado two blocks ahead as the timer starts
      { at: 14, type: 'cubeRain', count: 26, every: 0.35, size: 2.2 },
      { at: 40, type: 'cubeRain', count: 30, every: 0.3, size: 2.2 },
    ],
    fact: '10 GB is 80,000 megabits. At 100 megabits per second that is 800 seconds, about 13 minutes.',
    factSource: '10 GB x 8,000 Mb/GB = 80,000 Mb; 80,000 / 100 Mb/s = 800 s (decimal units).',
    scienceUrl: '', // TODO(owner): link to the "last 10%" Short
  },
  {
    id: 'lowg', name: 'GRAVITY DROPS',
    title: 'WHAT IF #{n}: GRAVITY DROPS FOR 10 SECONDS',
    radio: "Gravity's about to glitch. Grab the packets before you float off!",
    meter: 'UPLOAD', startPct: 90, packetPct: 1, packets: 10,
    events: [
      { at: 0, type: 'tornado', ahead: 3 },
      { at: 12, type: 'gravity', g: 1.62, duration: 10 },   // Moon gravity
      { at: 45, type: 'gravity', g: 1.62, duration: 10 },
      { at: 30, type: 'cubeRain', count: 20, every: 0.4, size: 2.2 },
    ],
    fact: "The Moon pulls at 1.62 m/s², about a sixth of Earth's 9.81, so the same jump stays up about 6 times longer.",
    factSource: 'Hang time = 2v/g; 9.81 / 1.62 = 6.06.',
    scienceUrl: '',
  },
  {
    id: 'icecubes', name: 'CAR-SIZED ICE',
    title: 'WHAT IF #{n}: IT RAINED CAR-SIZED ICE CUBES',
    radio: "Forecast says ice cubes. Big ones. Like, car big. Drive!",
    meter: 'SIGNAL', startPct: 90, packetPct: 1, packets: 10,
    events: [
      { at: 3, type: 'iceRain', count: 18, every: 0.9, size: 4.0 },
      { at: 20, type: 'slick', grip: 0.45, duration: 25 },
      { at: 30, type: 'iceRain', count: 24, every: 0.7, size: 4.0 },
      { at: 50, type: 'tornado', ahead: 2 },
    ],
    fact: 'A 4 m ice cube holds 64 m³ of ice. At 917 kg per m³ that is about 59 tonnes, the weight of roughly 40 cars.',
    factSource: '4³ = 64 m³ x 917 kg/m³ = 58,688 kg; a typical car is about 1.5 t.',
    scienceUrl: '',
  },
  {
    id: 'photostorm', name: 'PHOTO STORM',
    title: 'WHAT IF #{n}: A BILLION PHONES UPLOADED AT ONCE',
    radio: "Everyone hit share at the same second. The cloud is raining photos!",
    meter: 'UPLOAD', startPct: 90, packetPct: 1, packets: 10,
    events: [
      { at: 0, type: 'tornado', ahead: 2 },
      { at: 8, type: 'cubeRain', count: 30, every: 0.3, size: 2.0 },
      { at: 26, type: 'cubeRain', count: 36, every: 0.25, size: 2.0 },
      { at: 45, type: 'tornado', ahead: 3 },
      { at: 55, type: 'cubeRain', count: 30, every: 0.3, size: 2.4 },
    ],
    fact: 'If a billion phones each sent one 3 MB photo at the same moment, that would be 3 petabytes: three million gigabytes.',
    factSource: '1,000,000,000 x 3 MB = 3,000,000,000 MB = 3 PB (decimal units); 3 MB is a typical compressed phone photo, an assumption.',
    scienceUrl: '',
  },
  {
    id: 'iceroads', name: 'ICE ROADS',
    title: 'WHAT IF #{n}: EVERY ROAD FROZE AT ONCE',
    radio: "Every road in town just froze. Brake early. Like, really early.",
    meter: 'SIGNAL', startPct: 90, packetPct: 1, packets: 10,
    events: [
      { at: 0, type: 'slick', grip: 0.4, duration: 35 },
      { at: 15, type: 'iceRain', count: 12, every: 1.0, size: 2.5 },
      { at: 40, type: 'slick', grip: 0.4, duration: 30 },
      { at: 50, type: 'tornado', ahead: 2 },
    ],
    fact: 'Tyres grip ice about a seventh as well as dry asphalt, so stopping from 50 km/h takes roughly 98 m instead of 14 m.',
    factSource: 'Stopping distance d = v²/(2μg), v = 13.9 m/s; textbook friction μ ≈ 0.7 dry asphalt, ≈ 0.1 ice: 14 m vs 98 m (braking only, no reaction time).',
    scienceUrl: '',
  },
];

export function scenarioFor(day) { return SCENARIOS[(day - 1) % SCENARIOS.length]; }
export const pad3 = (n) => String(n).padStart(3, '0');
