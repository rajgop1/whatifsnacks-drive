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
    scienceUrl: 'https://youtube.com/shorts/n_qxB8A4Hc0',   // the Short for this run (public Nov 18 2026)
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
  {
    id: 'nospin', name: 'EARTH STOPS SPINNING',
    title: 'WHAT IF #{n}: THE EARTH STOPPED SPINNING',
    radio: "The ground just stopped turning. Everything loose is still moving. Hold on!",
    meter: 'SIGNAL', startPct: 90, packetPct: 1, packets: 10,
    events: [
      { at: 0, type: 'tornado', ahead: 2 },
      { at: 18, type: 'cubeRain', count: 28, every: 0.32, size: 2.2 },
      { at: 34, type: 'tornado', ahead: 3 },
      { at: 48, type: 'cubeRain', count: 30, every: 0.3, size: 2.4 },
    ],
    fact: 'At the equator the ground moves east at about 1,670 km/h. Stop it suddenly and anything loose keeps going at that speed.',
    factSource: 'Equator circumference 40,075 km / sidereal day 23.934 h = 1,674 km/h (about 465 m/s).',
    scienceUrl: '',
  },
  {
    id: 'bigmoon', name: 'THE MOON MOVES IN',
    title: 'WHAT IF #{n}: THE MOON DOUBLED IN SIZE',
    radio: "The Moon is twice as wide and the tide is coming up our street. Go go go!",
    meter: 'UPLOAD', startPct: 90, packetPct: 1, packets: 10,
    events: [
      { at: 0, type: 'tornado', ahead: 2 },
      { at: 10, type: 'slick', grip: 0.55, duration: 30, label: 'TIDE IN TOWN', sub: 'WATER ON THE ROADS' },     // tide water over the roads
      { at: 35, type: 'gravity', g: 6.0, duration: 8, label: 'MOON PULL', sub: '8 SECONDS OF LIFT' },
      { at: 50, type: 'slick', grip: 0.55, duration: 25, label: 'HIGH TIDE', sub: 'MORE WATER ON THE ROADS' },
    ],
    fact: 'Pull the Moon to half its distance and it looks twice as wide, and its tides get 8 times stronger.',
    factSource: 'Tidal force scales with 1/d³: halving the distance gives 2³ = 8. Apparent width scales with 1/d. Mean Earth-Moon distance 384,400 km.',
    scienceUrl: '',
  },
  {
    id: 'ringall', name: 'EVERY PHONE RINGS',
    title: 'WHAT IF #{n}: EVERY PHONE RANG AT ONCE',
    radio: "Every phone in the city is ringing at the same second. Ignore them. Get the packets!",
    meter: 'SIGNAL', startPct: 90, packetPct: 1, packets: 10,
    events: [
      { at: 5, type: 'cubeRain', count: 26, every: 0.3, size: 2.0 },
      { at: 22, type: 'cubeRain', count: 32, every: 0.25, size: 2.0 },
      { at: 40, type: 'tornado', ahead: 2 },
      { at: 52, type: 'cubeRain', count: 30, every: 0.28, size: 2.2 },
    ],
    fact: 'A ringing phone is about 70 dB. Sound adds on a log scale, so 1,000 of them make 100 dB, which hearing-safety guidance allows for 15 minutes.',
    factSource: '70 + 10 x log10(1,000) = 100 dB for equal uncorrelated sources; NIOSH recommended limit is 15 minutes at 100 dBA. 70 dB per phone is a typical ringtone level, an assumption.',
    scienceUrl: '',
  },
  {
    id: 'nofriction', name: 'NO FRICTION DAY',
    title: 'WHAT IF #{n}: FRICTION TOOK A DAY OFF',
    radio: "Friction called in sick. Steering is a suggestion today. Good luck!",
    meter: 'DOWNLOAD', startPct: 90, packetPct: 1, packets: 10,
    events: [
      { at: 0, type: 'slick', grip: 0.22, duration: 40, label: 'NO FRICTION', sub: 'STEERING IS A SUGGESTION' },
      { at: 20, type: 'tornado', ahead: 2 },
      { at: 45, type: 'slick', grip: 0.22, duration: 30, label: 'STILL SLIPPERY', sub: 'FRICTION IS STILL OUT' },
      { at: 55, type: 'cubeRain', count: 24, every: 0.35, size: 2.2 },
    ],
    fact: 'Cars steer on friction. Taking a 50 m bend at 54 km/h needs a grip of at least 0.46, about two thirds of what dry asphalt gives.',
    factSource: 'Cornering needs mu >= v²/(r g) = 15² / (50 x 9.81) = 0.46 (v = 54 km/h = 15 m/s); dry asphalt mu is about 0.7.',
    scienceUrl: '',
  },
  {
    id: 'meltroads', name: 'HEATWAVE',
    title: 'WHAT IF #{n}: A HEATWAVE MELTED THE ROADS',
    radio: "It is hot. Like, melting-the-road hot. The tarmac is going soft. Drive!",
    meter: 'UPLOAD', startPct: 90, packetPct: 1, packets: 10,
    events: [
      { at: 5, type: 'slick', grip: 0.5, duration: 40, label: 'MELTING ROADS', sub: 'TARMAC GOES SOFT' },
      { at: 20, type: 'tornado', ahead: 2 },
      { at: 45, type: 'slick', grip: 0.5, duration: 30, label: 'EVEN HOTTER', sub: 'THE ROAD IS GOO' },
      { at: 55, type: 'cubeRain', count: 26, every: 0.32, size: 2.2 },
    ],
    fact: 'On a day 40 °C hotter, a 1 km steel rail grows about 48 cm, which is why rails buckle in heatwaves.',
    factSource: 'Linear expansion: dL = alpha x L x dT = 12e-6 per K x 1,000 m x 40 K = 0.48 m (alpha of steel about 12e-6 per K).',
    scienceUrl: '',
  },
];

export function scenarioFor(day) { return SCENARIOS[(day - 1) % SCENARIOS.length]; }
export const pad3 = (n) => String(n).padStart(3, '0');
