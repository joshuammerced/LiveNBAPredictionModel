'use client';

import React from 'react';
import type { Factor, Loadable, MatchupResult, Prediction, Team } from '@/lib/api';
import { fmtSigned, useBackend, winPct } from '@/lib/api';
import { pairColors, teamStyle } from '@/lib/teams';
import type { MatchupPair, Nav } from '../nav';
import {
  CountUp, Divider, Donut, ErrorPanel, FadeZone, GrowBar, LoadingPanel, ProbBar, RectTag, TeamLogo, TiltCard, teamVars, useGrown,
} from '../ui';

const FACTOR_LABELS: Record<string, string> = {
  HOME_COURT: 'Home-court advantage',
  ELO_DIFF: 'Elo rating gap',
  MARGIN_10_DIFF: 'Form, last 10 games',
  MARGIN_30_DIFF: 'Form, last 30 games',
  REST_DIFF: 'Rest advantage',
  HOME_B2B: 'Home team on a back-to-back',
  AWAY_B2B: 'Away team on a back-to-back',
};

function factorValue(f: Factor): string {
  if (f.value === null) return 'built in';
  if (f.feature.endsWith('B2B')) return f.value ? 'yes' : 'no';
  if (f.feature === 'ELO_DIFF') return `${fmtSigned(f.value, 0)} pts`;
  if (f.feature === 'REST_DIFF') return `${fmtSigned(f.value, 0)} days`;
  return `${fmtSigned(f.value)} pts/g`;
}

/** Diverging bars: right of center pushes toward the home team, left toward the away team. */
function FactorBars({ factors, home, away }: { factors: Factor[]; home: Team; away: Team }) {
  const grown = useGrown();
  const scale = Math.max(0.5, ...factors.map((f) => Math.abs(f.contribution)));
  const { home: homeColor, away: awayColor } = pairColors(away.abbr, home.abbr);

  return (
    <div className="factor-list">
      <div className="factor-axis">
        <span>← favors {away.abbr}</span>
        <span>favors {home.abbr} →</span>
      </div>
      {factors.map((f, i) => {
        const width = (Math.abs(f.contribution) / scale) * 50;
        const towardHome = f.contribution >= 0;
        return (
          <div className="factor-row" key={f.feature}>
            <div className="factor-label">
              <span>{FACTOR_LABELS[f.feature] ?? f.feature}</span>
              <strong>{factorValue(f)}</strong>
            </div>
            <div className="factor-track">
              <div
                className="factor-fill grow-bar"
                style={{
                  width: grown ? `${width}%` : '0%',
                  [towardHome ? 'left' : 'right']: '50%',
                  background: towardHome ? homeColor : awayColor,
                  transitionDelay: `${i * 40}ms`,
                }}
              />
              <div className="factor-center" />
            </div>
          </div>
        );
      })}
      <p className="footnote">
        Bar length is each factor&apos;s pull on the prediction (log-odds), measured from an even matchup. Factors that barely move the
        needle get short bars even when the raw gap looks big.
      </p>
    </div>
  );
}

function TapeRow({ label, a, b, aText, bText, max, min = 0, colorA, colorB }: {
  label: string; a: number; b: number; aText: string; bText: string; max: number; min?: number; colorA: string; colorB: string;
}) {
  const pct = (v: number) => Math.max(3, Math.min(100, ((v - min) / (max - min)) * 100));
  const aLeads = a >= b;
  return (
    <div className="tape-row">
      <div className="tape-row-head">
        <span className={aLeads ? 'lead' : 'trail'}>{aText}</span>
        <span className="tape-label">{label}</span>
        <span className={!aLeads ? 'lead' : 'trail'}>{bText}</span>
      </div>
      <div className="tape-dual-track">
        <div className="tape-left-side"><GrowBar className="tape-bar-l" pct={pct(a)} color={colorA} /></div>
        <div className="tape-right-side"><GrowBar className="tape-bar-r" pct={pct(b)} color={colorB} /></div>
      </div>
    </div>
  );
}

function MatchupResultView({ result, home, away, nav }: { result: MatchupResult; home: Team; away: Team; nav: Nav }) {
  const p = result.home_win_prob;
  const fav = p >= 0.5 ? home : away;
  const favProb = Math.max(p, 1 - p);
  const { away: ca, home: ch } = pairColors(away.abbr, home.abbr);
  const l10 = (t: Team) => t.last10.filter((g) => g.result === 'W').length;

  return (
    <>
      <div className="comp-header-cards">
        {[{ t: away, prob: 1 - p, role: 'Away' }, { t: home, prob: p, role: 'Home' }].map(({ t, prob, role }) => (
          <TiltCard key={t.id} className="comp-team-banner" style={teamVars(t.abbr)} label={`Open ${t.name}`} onClick={() => nav.goTo('team', { teamId: t.id })}>
            <div className="team-id-group tilt-layer-deep">
              <TeamLogo abbr={t.abbr} />
              <div>
                <h3 className="comp-team-name">{t.name}</h3>
                <div className="team-submeta">{role} · {t.record.wins}–{t.record.losses} · #{t.elo_rank} Elo</div>
              </div>
            </div>
            <div className="comp-prob tilt-layer-mid"><CountUp value={prob * 100} decimals={0} suffix="%" /></div>
          </TiltCard>
        ))}
      </div>

      <div className="verdict">
        <Donut pct={favProb * 100} color={teamStyle(fav.abbr).color} label={`${fav.abbr} TO WIN`} />
        <div className="verdict-body">
          <RectTag color={teamStyle(fav.abbr).color}>Model verdict</RectTag>
          <h3>{fav.name} win {(favProb * 100).toFixed(0)}% of the time</h3>
          <p>Scored as if {away.abbr} played at {home.abbr} tomorrow, using each team&apos;s current Elo, form and rest.</p>
          <ProbBar homeProb={p} homeAbbr={home.abbr} awayAbbr={away.abbr} tall />
          <div className="prob-labels">
            <span>{away.abbr} {((1 - p) * 100).toFixed(0)}%</span>
            <span>{home.abbr} {(p * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>

      <div className="lab-split">
        <div>
          <Divider title={`Why the model leans ${fav.abbr}`} />
          <FactorBars factors={result.factors} home={home} away={away} />
        </div>
        <div>
          <Divider title="Tale of the tape" />
          <div className="tape-rows">
            <TapeRow label="Elo rating" a={away.elo} b={home.elo} aText={away.elo.toFixed(0)} bText={home.elo.toFixed(0)} min={1300} max={1750} colorA={ca} colorB={ch} />
            <TapeRow label="Avg margin, last 10" a={away.margin_10 ?? 0} b={home.margin_10 ?? 0} aText={fmtSigned(away.margin_10)} bText={fmtSigned(home.margin_10)} min={-15} max={15} colorA={ca} colorB={ch} />
            <TapeRow label="Avg margin, last 30" a={away.margin_30 ?? 0} b={home.margin_30 ?? 0} aText={fmtSigned(away.margin_30)} bText={fmtSigned(home.margin_30)} min={-15} max={15} colorA={ca} colorB={ch} />
            <TapeRow label="Win % this season" a={winPct(away.record) ?? 0} b={winPct(home.record) ?? 0}
                     aText={`${away.record.wins}–${away.record.losses}`} bText={`${home.record.wins}–${home.record.losses}`} max={100} colorA={ca} colorB={ch} />
            <TapeRow label="Last 10 games" a={l10(away)} b={l10(home)} aText={`${l10(away)}–${away.last10.length - l10(away)}`} bText={`${l10(home)}–${home.last10.length - l10(home)}`} max={10} colorA={ca} colorB={ch} />
            <TapeRow label="Rest days" a={away.rest_days} b={home.rest_days} aText={`${away.rest_days}`} bText={`${home.rest_days}`} max={4} colorA={ca} colorB={ch} />
          </div>
        </div>
      </div>
    </>
  );
}

export function MatchupLab({ teams, predictions, pair, setPair, nav }: {
  teams: Loadable<Team[]>; predictions: Loadable<Prediction[]>; pair: MatchupPair | null; setPair: (p: MatchupPair) => void; nav: Nav;
}) {
  const result = useBackend<MatchupResult>(pair ? `matchup?home=${pair.homeId}&away=${pair.awayId}` : null, true);

  if (teams.error) return <ErrorPanel message={teams.error} />;
  if (!teams.data || !pair) return <LoadingPanel label="Loading teams…" />;

  const all = [...teams.data].sort((a, b) => a.name.localeCompare(b.name));
  const home = all.find((t) => t.id === pair.homeId)!;
  const away = all.find((t) => t.id === pair.awayId)!;
  const presets = (predictions.data ?? []).slice(0, 6);

  const pick = (side: 'home' | 'away', id: number) => {
    const next = side === 'home' ? { homeId: id, awayId: pair.awayId } : { homeId: pair.homeId, awayId: id };
    // Picking the team already on the other side swaps them instead of making a team play itself.
    if (next.homeId === next.awayId) setPair({ homeId: pair.awayId, awayId: pair.homeId });
    else setPair(next);
  };

  return (
    <section>
      <div className="tape-comparator">
        <Divider title="Matchup Lab · any two teams" sub="Live model prediction with a factor-by-factor breakdown" />

        {presets.length > 0 && (
          <div className="preset-matchups-bar">
            <span className="preset-label">On the slate:</span>
            {presets.map((g) => {
              const active = g.home_team_id === pair.homeId && g.away_team_id === pair.awayId;
              return (
                <button key={`${g.home_team_id}-${g.away_team_id}`} type="button" aria-pressed={active}
                        className={`team-mini-pill ${active ? 'active-pill' : ''}`}
                        style={{ '--pill-color': teamStyle(g.home_abbr).color } as React.CSSProperties}
                        onClick={() => setPair({ homeId: g.home_team_id, awayId: g.away_team_id })}>
                  <span>{g.away_abbr} @ {g.home_abbr}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="tape-controls">
          <label className="team-select">
            <span>Away team</span>
            <select className="sport-select" value={away.id} onChange={(e) => pick('away', Number(e.target.value))}>
              {all.map((t) => <option key={t.id} value={t.id}>{t.name} (#{t.elo_rank} Elo)</option>)}
            </select>
          </label>
          <button type="button" className="vs-rect-box" onClick={() => setPair({ homeId: pair.awayId, awayId: pair.homeId })}
                  title="Swap home and away" aria-label="Swap home and away">
            @ ⇄
          </button>
          <label className="team-select">
            <span>Home team</span>
            <select className="sport-select" value={home.id} onChange={(e) => pick('home', Number(e.target.value))}>
              {all.map((t) => <option key={t.id} value={t.id}>{t.name} (#{t.elo_rank} Elo)</option>)}
            </select>
          </label>
        </div>

        {result.updating && result.data && <div className="updating-note" role="status">Running the model…</div>}
        {result.error && !result.updating && <ErrorPanel message={result.error} />}
        {!result.data && !result.error && <LoadingPanel label="Running the model…" />}
        {result.data && (
          <FadeZone
            value={result.data}
            valueKey={`${result.data.home_team_id}-${result.data.away_team_id}`}
            render={(r) => (
              <MatchupResultView
                result={r}
                home={all.find((t) => t.id === r.home_team_id)!}
                away={all.find((t) => t.id === r.away_team_id)!}
                nav={nav}
              />
            )}
          />
        )}
      </div>
    </section>
  );
}
