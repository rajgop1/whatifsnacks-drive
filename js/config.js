// Owner-editable constants. Nothing here is fetched; the game makes no network requests.
export const CONFIG = {
  gameName: 'WHAT IF SNACKS: DRIVE',
  shareName: 'WHAT IF SNACKS DRIVE',
  disclaimer: 'Original game. Not affiliated with Rockstar Games or Take-Two.',
  // TODO(owner): set the real channel URL. The subscribe link is the channel URL plus ?sub_confirmation=1 (test it once on a phone).
  channelUrl: 'https://www.youtube.com/@WhatIfSnacks',
  get subscribeUrl() { return this.channelUrl + '?sub_confirmation=1'; },
  // TODO(owner): per-scenario "Watch the 40-second science" Short URLs live in scenarios.js (scienceUrl); this is the fallback.
  scienceFallbackUrl: 'https://www.youtube.com/@WhatIfSnacks/shorts',
  epochUtc: Date.UTC(2026, 10, 17),       // scenario #001 = Nov 17 2026 (UTC)
  runSeconds: 80,
  // Optional licensed music: put the file at games/open-city/audio/music.mp3 and set this to 'audio/music.mp3'.
  // Empty = the built-in synth bed (a missing file would log a 404 in the console, so there is no automatic probe).
  musicFile: '',
  // Easter egg: the supertall's crown shows "?" by default. "6" is a nod to the launch week, but the research risk list says
  // "no numeral logo", so it stays off unless the owner accepts that risk.
  easterSix: false,
};

// Daily number: days since the epoch (UTC) + 1. A #d=N hash overrides it (challenge links carry it).
// Launch week: the announcement Short is about #001 (the stuck-at-90% joke), so the plain link opens #001 until this moment, then the daily rotation takes over.
export const LAUNCH_PIN = { day: 1, untilUtc: Date.UTC(2026, 10, 21) };
export function featuredDay(now = Date.now()) { return now < LAUNCH_PIN.untilUtc ? LAUNCH_PIN.day : dayNumber(now); }
export function dayNumber(now = Date.now()) { return Math.max(1, Math.floor((now - CONFIG.epochUtc) / 86400000) + 1); }
