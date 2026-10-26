export type Conference = 'East' | 'West';

interface TeamStyle {
  color: string;
  secondary: string;
  conf: Conference;
}

// Keyed by NBA abbreviation (what the backend returns).
export const TEAM_STYLES: Record<string, TeamStyle> = {
  ATL: { color: '#e03a3e', secondary: '#26282a', conf: 'East' },
  BOS: { color: '#007a33', secondary: '#ba9653', conf: 'East' },
  BKN: { color: '#1f2937', secondary: '#777d84', conf: 'East' },
  CHA: { color: '#1d1160', secondary: '#00788c', conf: 'East' },
  CHI: { color: '#ce1141', secondary: '#0a0f1d', conf: 'East' },
  CLE: { color: '#860038', secondary: '#fdbb30', conf: 'East' },
  DAL: { color: '#00538c', secondary: '#002b5e', conf: 'West' },
  DEN: { color: '#0e2240', secondary: '#fec524', conf: 'West' },
  DET: { color: '#c8102e', secondary: '#1d42ba', conf: 'East' },
  GSW: { color: '#1d428a', secondary: '#ffc72c', conf: 'West' },
  HOU: { color: '#ce1141', secondary: '#0a0f1d', conf: 'West' },
  IND: { color: '#002d62', secondary: '#fdbb30', conf: 'East' },
  LAC: { color: '#c8102e', secondary: '#1d428a', conf: 'West' },
  LAL: { color: '#552583', secondary: '#fdb927', conf: 'West' },
  MEM: { color: '#5d76a9', secondary: '#12173f', conf: 'West' },
  MIA: { color: '#98002e', secondary: '#f9a01b', conf: 'East' },
  MIL: { color: '#00471b', secondary: '#0077c0', conf: 'East' },
  MIN: { color: '#0c2340', secondary: '#78be20', conf: 'West' },
  NOP: { color: '#0c2340', secondary: '#c8102e', conf: 'West' },
  NYK: { color: '#006bb6', secondary: '#f58426', conf: 'East' },
  OKC: { color: '#007ac1', secondary: '#ef3b24', conf: 'West' },
  ORL: { color: '#0077c0', secondary: '#0a0f1d', conf: 'East' },
  PHI: { color: '#006bb6', secondary: '#ed174c', conf: 'East' },
  PHX: { color: '#1d1160', secondary: '#e56020', conf: 'West' },
  POR: { color: '#e03a3e', secondary: '#0a0f1d', conf: 'West' },
  SAC: { color: '#5a2d81', secondary: '#63727a', conf: 'West' },
  SAS: { color: '#334155', secondary: '#0284c7', conf: 'West' },
  TOR: { color: '#ce1141', secondary: '#0a0f1d', conf: 'East' },
  UTA: { color: '#3e2680', secondary: '#0a0f1d', conf: 'West' },
  WAS: { color: '#002b5c', secondary: '#e31837', conf: 'East' },
};

const FALLBACK: TeamStyle = { color: '#1d428a', secondary: '#c8102e', conf: 'East' };

export function teamStyle(abbr: string | null | undefined): TeamStyle {
  return (abbr && TEAM_STYLES[abbr]) || FALLBACK;
}

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function colorDistance(a: string, b: string) {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

const MIN_DISTANCE = 90;

/** Colors for two teams shown side by side; the away team switches to its secondary if the primaries clash. */
export function pairColors(awayAbbr: string, homeAbbr: string) {
  const home = teamStyle(homeAbbr).color;
  const away = teamStyle(awayAbbr);
  const candidates = [away.color, away.secondary, '#94a3b8'];
  return { home, away: candidates.find((c) => colorDistance(c, home) >= MIN_DISTANCE) ?? '#94a3b8' };
}

// Used for the page-wipe transition.
export const NBA_COLOR_PALETTE = [
  '#1d428a', '#c8102e', '#f97316', '#007a33',
  '#552583', '#fdb927', '#007ac1', '#860038',
  '#00471b', '#e56020', '#00788c', '#ce1141',
  '#00538c', '#78be20', '#006bb6', '#98002e',
];
