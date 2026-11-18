// BADGES: 12 achievements kept in this browser only (localStorage 'wis-badges', no accounts, nothing leaves the device).
// The game calls award(runStats) once when a run ends; runStats is the finish() result plus { night, vehicle, bestDrift }:
//   { got, pct, free, near, pips (max chaos stars 0..5), style: { run, stunts }, stats: { streak }, night, vehicle, bestDrift (s) }
// The streak comes from Stats.finish() (clip.js, real calendar days) so the badge and the result card's 'N-day streak' always agree.
// evaluate() is pure (no DOM, no storage) so tools/qa_badges.js can check it in node.
const KEY = 'wis-badges';
import { VEHICLES } from './vehicles.js';
const CARS = VEHICLES.filter((v) => v.kind !== 'mode').map((v) => v.id);   // every drivable car in the garage
const C = { navy: '#141a3a', navy2: '#1f2756', sun: '#ffd84d', coral: '#ff6b57', cream: '#fff4e6' };
const ico = (g) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><circle cx="24" cy="24" r="21.5" fill="${C.navy2}" stroke="${C.sun}" stroke-width="3"/>${g}</svg>`;
const num = (t, y = 30, s = 15) => `<text x="24" y="${y}" font-family="Montserrat,Arial,sans-serif" font-weight="900" font-size="${s}" text-anchor="middle" fill="${C.sun}">${t}</text>`;
const finished = (r) => (r.free ? (r.got || 0) >= 1 : (r.pct || 0) >= 100);

export const BADGES = [
  { id: 'first_packet', title: 'FIRST PACKET', desc: 'Grab your first packet', test: (r, s) => s.got >= 1,
    icon: ico(`<rect x="14" y="17" width="20" height="16" rx="2" fill="${C.cream}"/><path d="M14 22h20M24 17v16" stroke="${C.navy}" stroke-width="2.5"/>`) },
  { id: 'ten_packets', title: '10 PACKETS', desc: 'Grab 10 packets in total', test: (r, s) => s.got >= 10,
    icon: ico(`<rect x="13" y="25" width="22" height="10" rx="2" fill="${C.cream}"/><rect x="16" y="13" width="16" height="10" rx="2" fill="${C.cream}"/>${num('10', 33, 9).replace(C.sun, C.navy)}`) },
  { id: 'drift_king', title: 'DRIFT KING', desc: 'Hold one drift for 5 seconds', test: (r) => (r.bestDrift || 0) >= 5,
    icon: ico(`<path d="M13 28l2.5-13 5.5 6.5L24 12l3 9.5 5.5-6.5L35 28z" fill="${C.sun}"/><path d="M13 33h22M16 37h16" stroke="${C.cream}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="4 3"/>`) },
  { id: 'air_time', title: 'AIR TIME', desc: 'Land a stunt jump', test: (r) => (r.style?.stunts || 0) >= 1,
    icon: ico(`<path d="M11 35Q24 6 37 35" stroke="${C.cream}" stroke-width="2.5" fill="none" stroke-dasharray="3 3"/><rect x="18" y="14" width="12" height="6" rx="2.5" fill="${C.sun}"/><circle cx="21" cy="21" r="2" fill="${C.cream}"/><circle cx="27" cy="21" r="2" fill="${C.cream}"/>`) },
  { id: 'night_owl', title: 'NIGHT OWL', desc: 'Finish a run after dark', test: (r) => !!r.night && finished(r),
    icon: ico(`<path d="M27 12a12 12 0 1 0 9 19A10 10 0 1 1 27 12z" fill="${C.sun}"/><circle cx="16" cy="16" r="1.6" fill="${C.cream}"/><circle cx="34" cy="17" r="1.2" fill="${C.cream}"/>`) },
  { id: 'free_roamer', title: 'FREE ROAMER', desc: 'Make 5 deliveries in Free Roam', test: (r) => !!r.free && (r.got || 0) >= 5,
    icon: ico(`<path d="M17 37c0-7 14-6 14-13s-8-7-8-12" stroke="${C.cream}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M17 37c0-7 14-6 14-13s-8-7-8-12" stroke="${C.navy2}" stroke-width="1.5" fill="none" stroke-dasharray="3 3"/>`) },
  { id: 'perfect_run', title: 'PERFECT RUN', desc: 'Hit 100% without one chaos star', test: (r) => !r.free && (r.pct || 0) >= 100 && !r.pips,
    icon: ico(`<path d="M24 11l3.8 8 8.7 1.1-6.4 6 1.7 8.6L24 30.4l-7.8 4.3 1.7-8.6-6.4-6 8.7-1.1z" fill="${C.sun}"/>`) },
  { id: 'garage_tour', title: 'GARAGE TOUR', desc: `Drive all ${CARS.length} cars`, test: (r, s) => CARS.every((c) => s.cars.includes(c)),
    icon: ico(`<circle cx="19" cy="19" r="6" stroke="${C.sun}" stroke-width="3.5" fill="none"/><path d="M23.5 23.5l10 10M30 30l3.5-3.5M27 27l3-3" stroke="${C.sun}" stroke-width="3.5" stroke-linecap="round"/>`) },
  { id: 'streak3', title: '3 DAY STREAK', desc: 'Play the daily run 3 days in a row', test: (r, s) => s.streak >= 3,
    icon: ico(`<path d="M24 11c2 5 9 8 9 15a9 9 0 0 1-18 0c0-4 3-6 4.5-9.5 1 3 3 4.5 4.5 4.5-1.2-3.5-1.2-6.5 0-10z" fill="${C.coral}"/>${num('3', 35, 13).replace(C.sun, C.cream)}`) },
  { id: 'close_calls', title: 'CLOSE CALLS', desc: '10 near misses in one run', test: (r) => (r.near || 0) >= 10,
    icon: ico(`<path d="M12 18h12M10 24h16M12 30h12" stroke="${C.cream}" stroke-width="3" stroke-linecap="round"/><rect x="30" y="15" width="5" height="12" rx="2" fill="${C.sun}"/><circle cx="32.5" cy="32" r="2.6" fill="${C.sun}"/>`) },
  { id: 'full_chaos', title: 'FULL CHAOS', desc: 'Max out the chaos meter', test: (r) => (r.pips || 0) >= 5,
    icon: ico(`<path d="M27 10l-11 16h7l-3 12 12-17h-7z" fill="${C.coral}" stroke="${C.cream}" stroke-width="1.5" stroke-linejoin="round"/>`) },
  { id: 'high_roller', title: 'HIGH ROLLER', desc: 'Earn $5,000 of style cash in one run', test: (r) => (r.style?.run || 0) >= 5000,
    icon: ico(num('$', 33, 24)) },
];

const fresh = () => ({ v: 1, got: 0, cars: [], streak: 0, unlocked: {} });

// pure: folds one run into the saved totals and returns the badges it unlocked, in BADGES order
export function evaluate(run, saved, now = Date.now()) {
  const s = { ...fresh(), ...saved }; s.cars = [...(s.cars || [])]; s.unlocked = { ...s.unlocked };
  s.got += Math.max(0, run.got || 0);
  if (CARS.includes(run.vehicle) && !s.cars.includes(run.vehicle)) s.cars.push(run.vehicle);
  s.streak = Math.max(s.streak || 0, run.stats?.streak || 0);   // best streak seen; Stats only sets it on daily runs
  const newlyUnlocked = BADGES.filter((b) => !s.unlocked[b.id] && b.test(run, s)).map((b) => b.id);
  for (const id of newlyUnlocked) s.unlocked[id] = now;
  return { saved: s, newlyUnlocked };
}

let mem = null;   // blocked storage (private window): badges last this page session instead of re-unlocking every run
export function load() {
  const clean = (o) => { const s = { ...fresh(), ...(o && typeof o === 'object' && !Array.isArray(o) ? o : {}) }; if (!Array.isArray(s.cars)) s.cars = []; if (!s.unlocked || typeof s.unlocked !== 'object') s.unlocked = {}; return s; };   // hand-edited storage never breaks a run
  if (mem) return clean(mem); try { return clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return fresh(); }
}
export function save(saved) { mem = saved; try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (e) { /* mem keeps it */ } }

let css = false;
function injectCss() {
  if (css) return; css = true;
  const st = document.createElement('style');
  st.textContent = `@keyframes wisBadge{0%{opacity:0;transform:translate(-50%,-140%)}12%,86%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,-140%)}}
@keyframes wisBadgeFade{0%,100%{opacity:0}12%,86%{opacity:1}}
.wis-badge{position:fixed;left:50%;top:calc(env(safe-area-inset-top,0px) + 10px);z-index:50;display:flex;align-items:center;gap:12px;box-sizing:border-box;width:min(92vw,360px);padding:10px 14px 10px 10px;border-radius:16px;background:${C.navy};border:2px solid ${C.sun};box-shadow:0 8px 28px rgba(0,0,0,.45);color:${C.cream};font-family:"Montserrat","Segoe UI",system-ui,Arial,sans-serif;pointer-events:none;animation:wisBadge 3.2s cubic-bezier(.2,.9,.3,1.2) both}
.wis-badge svg{flex:none;width:48px;height:48px}
.wis-badge small{display:block;font-size:11px;font-weight:900;letter-spacing:.16em;color:${C.sun}}
.wis-badge b{display:block;font-size:18px;font-weight:900;line-height:1.1;letter-spacing:.02em}
.wis-badge span{display:block;font-size:13px;font-weight:700;opacity:.85;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media (prefers-reduced-motion:reduce){.wis-badge{animation-name:wisBadgeFade;transform:translate(-50%,0)}}`;
  document.head.append(st);
}

// the toast animates once it is in the page (CSS animation) and removes itself when done
export function renderBadgeToast(badge) {
  injectCss();
  const el = document.createElement('div');
  el.className = 'wis-badge'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  el.innerHTML = `${badge.icon}<div><small>BADGE UNLOCKED</small><b></b><span></span></div>`;
  el.querySelector('b').textContent = badge.title; el.querySelector('span').textContent = badge.desc;
  el.addEventListener('animationend', () => el.remove());
  return el;
}

// one call for the game: load, evaluate, save, then show each new badge in turn (after the end-of-run toast)
export function award(run, { delay = 2600, gap = 3400 } = {}) {
  const { saved, newlyUnlocked } = evaluate(run, load()); save(saved);
  newlyUnlocked.forEach((id, i) => setTimeout(() => document.body.append(renderBadgeToast(BADGES.find((b) => b.id === id))), delay + i * gap));
  return newlyUnlocked;
}
