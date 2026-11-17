// Anonymous play counter: no cookies, no ids, no personal data. It adds 1 to a few named totals on a free public counter service
// (abacus.jasoncameron.dev): visits, new browsers, runs started, runs finished, wins, shares. The owner reads them on stats.html.
// Counting only happens on the real site, never in tests (localhost, headless, ?manual/?capture/?auto). Open the game once with
// ?nocount=1 on a device to stop counting your own plays there (?nocount=0 turns it back on). A failed request never touches the game.
export const COUNTER = { ns: 'wisd-q7k2m9', api: 'https://abacus.jasoncameron.dev' };

const off = (() => {
  try {
    const v = new URLSearchParams(location.search).get('nocount');
    if (v === '1') localStorage.setItem('wis-nocount', '1'); else if (v === '0') localStorage.removeItem('wis-nocount');
    return localStorage.getItem('wis-nocount') === '1';
  } catch (e) { return false; }
})();
const on = !off && !navigator.webdriver && /^(www\.)?whatifsnacks\.online$|\.github\.io$/.test(location.hostname) && !/[?&](manual|capture|auto)\b/.test(location.search);

export function count(key) {
  if (!on) return;
  try { fetch(`${COUNTER.api}/hit/${COUNTER.ns}/${key}`, { keepalive: true }).catch(() => {}); } catch (e) { /* offline or blocked: ignore */ }
}
export function countOnce(key, flag) {   // once per browser
  if (!on) return;
  try { if (localStorage.getItem(flag)) return; localStorage.setItem(flag, '1'); } catch (e) { return; }
  count(key);
}
