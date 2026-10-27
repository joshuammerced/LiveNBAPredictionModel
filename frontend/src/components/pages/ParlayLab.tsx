'use client';

import React, { useEffect, useState } from 'react';
import type { Loadable, ParlayLeg, ParlayResult, PlayerOption, PlayersResponse, Prediction, PropResult, Team } from '@/lib/api';
import { postJSON, useBackend } from '@/lib/api';
import { teamStyle } from '@/lib/teams';
import type { Nav } from '../nav';
import { CountUp, Divider, Donut, ErrorPanel, GrowBar, LoadingPanel, RectTag, TeamLogo, teamVars } from '../ui';

type Mode = 'pickem' | 'sportsbook';
type LegKind = ParlayLeg['type'];

// Typical all-must-hit multipliers; they vary by app, state and promo, so they're editable.
const PICKEM_PAYOUTS: Record<number, number> = { 2: 3, 3: 5, 4: 10, 5: 20, 6: 37.5 };

const KIND_LABELS: Record<LegKind, string> = { prop: 'Player prop', moneyline: 'Moneyline', spread: 'Spread', total: 'Total' };

interface LegEntry {
  id: number;
  leg: ParlayLeg;
  abbr: string; // for the card's team color
}

function pct(p: number, digits = 0) {
  return `${(p * 100).toFixed(digits)}%`;
}

function money(v: number) {
  return `${v < 0 ? '−' : '+'}$${Math.abs(v).toFixed(2)}`;
}

function playerKey(p: PlayerOption) {
  return `${p.name} (${p.team})`;
}

/** Last 10 games as small bars, with the line drawn across. */
function LastTen({ values, line }: { values: number[]; line: number }) {
  const max = Math.max(line * 1.25, ...values, 1);
  return (
    <div className="last-ten" role="img" aria-label={`Last ${values.length} games: ${values.join(', ')}; line ${line}`}>
      <div className="last-ten-line" style={{ bottom: `${(line / max) * 100}%` }} />
      {values.map((v, i) => (
        <div key={i} className={`last-ten-bar ${v > line ? 'over' : 'under'}`} style={{ height: `${Math.max(4, (v / max) * 100)}%` }}>
          <span>{v}</span>
        </div>
      ))}
    </div>
  );
}

function PropBuilder({ players, onAdd, mode }: {
  players: PlayersResponse; onAdd: (entry: Omit<LegEntry, 'id'>) => void; mode: Mode;
}) {
  const [query, setQuery] = useState('');
  const [stat, setStat] = useState('PTS');
  const [line, setLine] = useState('');
  const [side, setSide] = useState<'over' | 'under'>('over');
  const [odds, setOdds] = useState('-110');

  const player = players.players.find((p) => playerKey(p) === query) ?? null;
  const lineNum = Number(line);
  const lineValid = line !== '' && Number.isFinite(lineNum) && lineNum >= 0 && lineNum <= 200;
  const preview = useBackend<PropResult>(player && lineValid ? `prop?player=${player.id}&stat=${stat}&line=${lineNum}` : null, true);

  const add = () => {
    if (!player || !lineValid) return;
    onAdd({
      abbr: player.team,
      leg: {
        type: 'prop', player_id: player.id, player_name: player.name, team: player.team, stat, line: lineNum, side,
        ...(mode === 'sportsbook' && odds ? { odds: Number(odds) } : {}),
      },
    });
    setLine('');
  };

  const p = preview.data && !preview.updating ? (side === 'over' ? preview.data.prob_over : preview.data.prob_under) : null;

  return (
    <div className="builder-form">
      <label className="field wide">
        <span>Player</span>
        <input className="text-input" list="player-options" value={query} onChange={(e) => setQuery(e.target.value)}
               placeholder="Start typing a name…" autoComplete="off" />
        <datalist id="player-options">
          {players.players.map((p) => <option key={p.id} value={playerKey(p)} />)}
        </datalist>
      </label>
      <label className="field">
        <span>Stat</span>
        <select className="sport-select" value={stat} onChange={(e) => setStat(e.target.value)}>
          {players.stats.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Line</span>
        <input className="text-input" type="number" inputMode="decimal" step="0.5" min="0" value={line}
               onChange={(e) => setLine(e.target.value)} placeholder="24.5" />
      </label>
      <div className="field">
        <span>Pick</span>
        <div className="seg-toggle" role="group" aria-label="Over or under">
          {(['over', 'under'] as const).map((s) => (
            <button key={s} type="button" aria-pressed={side === s} className={side === s ? 'on' : ''} onClick={() => setSide(s)}>
              {s === 'over' ? 'More / Over' : 'Less / Under'}
            </button>
          ))}
        </div>
      </div>
      {mode === 'sportsbook' && (
        <label className="field">
          <span>Odds (American)</span>
          <input className="text-input" type="number" value={odds} onChange={(e) => setOdds(e.target.value)} placeholder="-110" />
        </label>
      )}

      {player && lineValid && (
        <div className="preview-box" style={teamVars(player.team)}>
          {preview.error && <span className="preview-error">{preview.error}</span>}
          {!preview.error && p === null && <span className="preview-muted">Checking {player.name}&apos;s recent games…</span>}
          {!preview.error && p !== null && preview.data && (
            <>
              <div className="preview-head">
                <strong>{pct(p)}</strong>
                <span>
                  model chance · projection {preview.data.projection} · {preview.data.last10_over} of last {preview.data.last10.length} over {lineNum}
                </span>
              </div>
              <LastTen values={preview.data.last10} line={lineNum} />
            </>
          )}
        </div>
      )}

      <button type="button" className="primary-slash-btn add-leg" disabled={!player || !lineValid} onClick={add}>
        <span>+ Add leg</span>
      </button>
    </div>
  );
}

function GameBuilder({ kind, teams, slate, onAdd }: {
  kind: Exclude<LegKind, 'prop'>; teams: Team[]; slate: Prediction[]; onAdd: (entry: Omit<LegEntry, 'id'>) => void;
}) {
  const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name));
  const first = slate[0];
  const [homeId, setHomeId] = useState(first?.home_team_id ?? sorted[0].id);
  const [awayId, setAwayId] = useState(first?.away_team_id ?? sorted[1].id);
  const [pick, setPick] = useState<'home' | 'away'>('home');
  const [side, setSide] = useState<'over' | 'under'>('over');
  const [line, setLine] = useState(kind === 'total' ? '225.5' : '-3.5');
  // Moneyline odds vary too much for a sensible default; spreads and totals are usually -110.
  const [odds, setOdds] = useState(kind === 'moneyline' ? '' : '-110');

  const home = teams.find((t) => t.id === homeId)!;
  const away = teams.find((t) => t.id === awayId)!;
  const lineNum = Number(line);
  const valid = homeId !== awayId && (kind === 'moneyline' || (line !== '' && Number.isFinite(lineNum)));

  const add = () => {
    if (!valid) return;
    const base = { home_id: homeId, away_id: awayId, ...(odds ? { odds: Number(odds) } : {}) };
    const leg: ParlayLeg = kind === 'total' ? { type: 'total', ...base, side, line: lineNum }
      : kind === 'spread' ? { type: 'spread', ...base, pick, line: lineNum }
      : { type: 'moneyline', ...base, pick };
    onAdd({ leg, abbr: kind === 'total' ? home.abbr : (pick === 'home' ? home : away).abbr });
  };

  return (
    <div className="builder-form">
      {slate.length > 0 && (
        <div className="field wide">
          <span>On the slate</span>
          <div className="quick-team-pills">
            {slate.slice(0, 8).map((g) => {
              const active = g.home_team_id === homeId && g.away_team_id === awayId;
              return (
                <button key={`${g.home_team_id}-${g.away_team_id}`} type="button" aria-pressed={active}
                        className={`team-mini-pill ${active ? 'active-pill' : ''}`}
                        style={{ '--pill-color': teamStyle(g.home_abbr).color } as React.CSSProperties}
                        onClick={() => { setHomeId(g.home_team_id); setAwayId(g.away_team_id); }}>
                  <span>{g.away_abbr} @ {g.home_abbr}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <label className="field">
        <span>Away</span>
        <select className="sport-select" value={awayId} onChange={(e) => setAwayId(Number(e.target.value))}>
          {sorted.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Home</span>
        <select className="sport-select" value={homeId} onChange={(e) => setHomeId(Number(e.target.value))}>
          {sorted.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      {kind !== 'total' ? (
        <div className="field">
          <span>Pick</span>
          <div className="seg-toggle" role="group" aria-label="Team">
            {(['away', 'home'] as const).map((s) => (
              <button key={s} type="button" aria-pressed={pick === s} className={pick === s ? 'on' : ''} onClick={() => setPick(s)}>
                {(s === 'home' ? home : away).abbr}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="field">
          <span>Pick</span>
          <div className="seg-toggle" role="group" aria-label="Over or under">
            {(['over', 'under'] as const).map((s) => (
              <button key={s} type="button" aria-pressed={side === s} className={side === s ? 'on' : ''} onClick={() => setSide(s)}>
                {s === 'over' ? 'Over' : 'Under'}
              </button>
            ))}
          </div>
        </div>
      )}
      {kind !== 'moneyline' && (
        <label className="field">
          <span>{kind === 'spread' ? 'Spread (picked team)' : 'Total points'}</span>
          <input className="text-input" type="number" step="0.5" value={line} onChange={(e) => setLine(e.target.value)} />
        </label>
      )}
      <label className="field">
        <span>Odds (American)</span>
        <input className="text-input" type="number" value={odds} onChange={(e) => setOdds(e.target.value)} placeholder="-110" />
      </label>
      {homeId === awayId && <p className="preview-error">Pick two different teams.</p>}
      <button type="button" className="primary-slash-btn add-leg" disabled={!valid} onClick={add}>
        <span>+ Add leg</span>
      </button>
    </div>
  );
}

function LegCard({ entry, result, onRemove }: { entry: LegEntry; result?: ParlayResult['legs'][number]; onRemove: () => void }) {
  const color = teamStyle(entry.abbr).color;
  return (
    <div className="leg-card" style={teamVars(entry.abbr)}>
      <TeamLogo abbr={entry.abbr} size="sm" />
      <div className="leg-body">
        <div className="leg-label">{result?.label ?? 'Scoring…'}</div>
        {result && (
          <>
            <div className="rect-progress-track"><GrowBar className="rect-progress-fill" pct={result.prob * 100} color={color} /></div>
            <div className="leg-meta">
              <span>Model {pct(result.prob)}</span>
              {result.book_prob !== undefined && (
                <span className={result.edge! >= 0 ? 'edge-pos' : 'edge-neg'}>
                  Book {pct(result.book_prob)} · {result.edge! >= 0 ? '+' : ''}{(result.edge! * 100).toFixed(1)} pts
                </span>
              )}
            </div>
          </>
        )}
      </div>
      <button type="button" className="leg-remove" onClick={onRemove} aria-label="Remove leg">✕</button>
    </div>
  );
}

function ResultsPanel({ result, mode, legCount, payout, setPayout, parlayOdds, setParlayOdds, loading }: {
  result: ParlayResult | null; mode: Mode; legCount: number;
  payout: string; setPayout: (v: string) => void; parlayOdds: string; setParlayOdds: (v: string) => void; loading: boolean;
}) {
  const stake = 10;
  const ev = result?.expected_value;
  return (
    <div className="results-card">
      <RectTag>Will it hit?</RectTag>
      {!result && <p className="preview-muted">Add legs to see the model&apos;s odds.</p>}
      {result && (
        <>
          <div className="results-top">
            <Donut pct={result.prob_all_hit * 100} color="#1d428a" label={`ALL ${legCount} HIT`} size={140} />
            <div>
              <div className="results-big"><CountUp value={result.prob_all_hit * 100} decimals={1} suffix="%" /></div>
              <p className="results-sub">chance every leg hits{result.correlated ? ' (approximate, see below)' : ''}</p>
              {result.book_prob_all_hit !== undefined && (
                <p className="results-sub">Book&apos;s odds imply {pct(result.book_prob_all_hit, 1)}</p>
              )}
            </div>
          </div>

          <div className="payout-row">
            {mode === 'pickem' ? (
              <label className="field">
                <span>Payout multiplier (all must hit)</span>
                <input className="text-input" type="number" step="0.5" min="1" value={payout} onChange={(e) => setPayout(e.target.value)} />
              </label>
            ) : (
              <label className="field">
                <span>Parlay odds (blank = multiply legs)</span>
                <input className="text-input" type="number" value={parlayOdds} onChange={(e) => setParlayOdds(e.target.value)} placeholder="+600" />
              </label>
            )}
          </div>

          {ev !== undefined && (
            <div className={`ev-box ${ev >= 0 ? 'pos' : 'neg'}`}>
              <strong>{money(ev * stake)}</strong> expected per ${stake} entry ({ev >= 0 ? '+' : ''}{(ev * 100).toFixed(1)}%)
              {result.breakeven_per_leg !== undefined && (
                <span> · needs {pct(result.breakeven_per_leg, 1)} per leg to break even</span>
              )}
            </div>
          )}

          <div className="hits-title">How many legs hit</div>
          <div className="hits-bars">
            {result.hits_distribution.map((p, k) => (
              <div key={k} className="hits-col">
                <div className="hits-track"><div className="hits-fill grow-bar" style={{ height: `${Math.max(2, p * 100)}%` }} /></div>
                <span className="hits-pct">{pct(p)}</span>
                <span className="hits-k">{k}</span>
              </div>
            ))}
          </div>

          {result.correlated && (
            <div className="warning-panel">
              Some legs share a team or game, so they move together. The real chance can be noticeably higher or lower
              than this estimate, which treats legs as independent.
            </div>
          )}
          {loading && <p className="updating-note">Updating…</p>}
        </>
      )}
    </div>
  );
}

export function ParlayLab({ teams, predictions }: { teams: Loadable<Team[]>; predictions: Loadable<Prediction[]>; nav: Nav }) {
  const players = useBackend<PlayersResponse>('players');
  const [mode, setMode] = useState<Mode>('pickem');
  const [kind, setKind] = useState<LegKind>('prop');
  const [legs, setLegs] = useState<LegEntry[]>([]);
  const [nextId, setNextId] = useState(1);
  const [payoutInput, setPayoutInput] = useState<string | null>(null);
  const [parlayOdds, setParlayOdds] = useState('');
  const [result, setResult] = useState<{ key: string; data: ParlayResult | null; error: string | null }>({ key: '', data: null, error: null });

  const activeLegs = mode === 'pickem' ? legs.filter((l) => l.leg.type === 'prop') : legs;
  const payout = payoutInput ?? String(PICKEM_PAYOUTS[activeLegs.length] ?? '');
  const request = activeLegs.length
    ? {
        mode,
        legs: activeLegs.map((l) => l.leg),
        ...(mode === 'pickem' && Number(payout) > 1 ? { payout: Number(payout) } : {}),
        ...(mode === 'sportsbook' && parlayOdds ? { parlay_odds: Number(parlayOdds) } : {}),
      }
    : null;
  const requestKey = JSON.stringify(request);

  // requestKey is the serialized request, so the effect re-runs exactly when the slip changes.
  useEffect(() => {
    const body = JSON.parse(requestKey);
    if (!body) return;
    let cancelled = false;
    const t = setTimeout(() => {
      postJSON<ParlayResult>('parlay', body)
        .then((data) => !cancelled && setResult({ key: requestKey, data, error: null }))
        .catch((err: Error) => !cancelled && setResult({ key: requestKey, data: null, error: err.message }));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [requestKey]);

  const addLeg = (entry: Omit<LegEntry, 'id'>) => {
    setLegs((ls) => (ls.length >= 10 ? ls : [...ls, { ...entry, id: nextId }]));
    setNextId((n) => n + 1);
    setPayoutInput(null);
  };

  const shown = request && result.data ? result.data : null;
  const loading = Boolean(request) && result.key !== requestKey;
  const kinds: LegKind[] = mode === 'pickem' ? ['prop'] : ['prop', 'moneyline', 'spread', 'total'];

  return (
    <section>
      <div className="tape-comparator">
        <Divider title="Parlay Lab · will it hit?" sub="Model odds for each leg, the whole slip, and whether the payout is worth it" />

        <div className="filter-toolbar">
          <div className="filter-pills" role="group" aria-label="Payout style">
            {([['pickem', "Pick'em (PrizePicks-style)"], ['sportsbook', 'Sportsbook (DraftKings-style)']] as const).map(([m, label]) => (
              <button key={m} type="button" aria-pressed={mode === m} className={`nav-tab-btn ${mode === m ? 'active' : ''}`}
                      onClick={() => { setMode(m); if (m === 'pickem') setKind('prop'); }}>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <span className="toolbar-note">
            {mode === 'pickem' ? 'Player more/less picks; payout multiplier when all hit' : 'Props, moneylines, spreads and totals with American odds'}
          </span>
        </div>

        <div className="parlay-grid">
          <div>
            <div className="builder-card">
              <div className="kind-tabs" role="group" aria-label="Leg type">
                {kinds.map((k) => (
                  <button key={k} type="button" aria-pressed={kind === k} className={`team-mini-pill ${kind === k ? 'active-pill' : ''}`}
                          onClick={() => setKind(k)}>
                    <span>{KIND_LABELS[k]}</span>
                  </button>
                ))}
              </div>
              {kind === 'prop' ? (
                players.error ? <ErrorPanel message={players.error} />
                  : !players.data ? <LoadingPanel label="Loading players…" />
                  : <PropBuilder players={players.data} onAdd={addLeg} mode={mode} />
              ) : teams.data ? (
                <GameBuilder key={kind} kind={kind} teams={teams.data} slate={predictions.data ?? []} onAdd={addLeg} />
              ) : <LoadingPanel label="Loading teams…" />}
            </div>

            <div className="legs-list">
              <div className="hits-title">Your slip · {activeLegs.length} leg{activeLegs.length === 1 ? '' : 's'}</div>
              {activeLegs.length === 0 && <div className="empty-panel">No legs yet. Add one above.</div>}
              {activeLegs.map((entry, i) => (
                <LegCard key={entry.id} entry={entry} result={shown?.legs[i]}
                         onRemove={() => { setLegs((ls) => ls.filter((l) => l.id !== entry.id)); setPayoutInput(null); }} />
              ))}
              {mode === 'pickem' && legs.length > activeLegs.length && (
                <p className="footnote">Game lines are hidden in pick&apos;em mode (pick&apos;em apps only offer player picks).</p>
              )}
              {result.error && result.key === requestKey && <ErrorPanel message={result.error} />}
            </div>
          </div>

          <ResultsPanel result={shown} mode={mode} legCount={activeLegs.length}
                        payout={payout} setPayout={setPayoutInput} parlayOdds={parlayOdds} setParlayOdds={setParlayOdds} loading={loading} />
        </div>

        <div className="disclaimer">
          <strong>21+ · For entertainment and education, not betting advice.</strong> Probabilities come from each player&apos;s and
          team&apos;s recent results. They don&apos;t know about injuries, rest days, lineup changes or minutes limits, which
          sportsbooks price in, so a line can look &quot;mispriced&quot; here for a reason the model can&apos;t see. Payout
          multipliers vary by app, state and promotion; enter yours. Not affiliated with or endorsed by PrizePicks, DraftKings or
          the NBA. Gambling problem? Call or text <strong>1-800-GAMBLER</strong>.
        </div>
      </div>
    </section>
  );
}
