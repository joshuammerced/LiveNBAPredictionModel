'use client';

import React from 'react';
import type { Loadable, Team, TeamGame } from '@/lib/api';
import { fmtSigned, winPct } from '@/lib/api';
import { teamStyle } from '@/lib/teams';
import type { Nav } from '../nav';
import { CountUp, ErrorPanel, FadeZone, GrowBar, LoadingPanel, RectTag, TeamLogo, TiltCard, teamVars, useGrown } from '../ui';
import { streak } from './RankingsPage';

const ELO_MEAN = 1505;

function EloChart({ team }: { team: Team }) {
  const grown = useGrown();
  const pts = team.elo_history;
  const color = teamStyle(team.abbr).color;
  const W = 510, H = 200, padL = 44, padR = 16, padT = 16, padB = 28;

  const elos = pts.map((p) => p.elo);
  const lo = Math.floor((Math.min(...elos, ELO_MEAN) - 20) / 50) * 50;
  const hi = Math.ceil((Math.max(...elos, ELO_MEAN) + 20) / 50) * 50;
  const x = (i: number) => padL + (i / Math.max(1, pts.length - 1)) * (W - padL - padR);
  const y = (e: number) => padT + (1 - (e - lo) / (hi - lo)) * (H - padT - padB);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.elo).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const ticks = [lo, (lo + hi) / 2, hi];

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img"
         aria-label={`${team.name} Elo over the last ${pts.length} games, from ${pts[0].elo.toFixed(0)} to ${last.elo.toFixed(0)}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeWidth="1" />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize="10.5" fontWeight="800" fill="#64748b">{t.toFixed(0)}</text>
        </g>
      ))}
      <line x1={padL} x2={W - padR} y1={y(ELO_MEAN)} y2={y(ELO_MEAN)} stroke="#94a3b8" strokeDasharray="5 5" strokeWidth="1.5" />
      <text x={W - padR} y={y(ELO_MEAN) - 5} textAnchor="end" fontSize="10" fontWeight="800" fill="#64748b">LEAGUE AVG 1505</text>
      <path d={path} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"
            pathLength={1} strokeDasharray="1" strokeDashoffset={grown ? 0 : 1} className="draw-line" />
      <circle cx={x(pts.length - 1)} cy={y(last.elo)} r="5" fill={color} stroke="#0a0f1d" strokeWidth="2"
              className={`fade-in-late ${grown ? 'shown' : ''}`} />
      <text x={padL} y={H - 8} fontSize="10.5" fontWeight="800" fill="#64748b">{pts[0].date}</text>
      <text x={W - padR} y={H - 8} textAnchor="end" fontSize="10.5" fontWeight="800" fill="#64748b">Now</text>
    </svg>
  );
}

function MarginChart({ team }: { team: Team }) {
  const grown = useGrown();
  const games = [...team.last10].reverse(); // oldest → newest
  const color = teamStyle(team.abbr).color;
  const W = 510, H = 200, mid = 96, half = 70;
  const maxAbs = Math.max(10, ...games.map((g) => Math.abs(g.pts - g.opp_pts)));
  const slot = (W - 30) / Math.max(1, games.length);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} role="img"
         aria-label={`${team.name} scoring margin in the last ${games.length} games`}>
      <line x1="15" x2={W - 15} y1={mid} y2={mid} stroke="#0a0f1d" strokeWidth="2" />
      {games.map((g, i) => {
        const m = g.pts - g.opp_pts;
        const h = (Math.abs(m) / maxAbs) * half;
        const bx = 15 + i * slot + slot * 0.18;
        const bw = slot * 0.64;
        return (
          <g key={`${g.date}-${g.opponent}`}>
            <rect x={bx} y={m >= 0 ? mid - h : mid} width={bw} height={h}
                  fill={m >= 0 ? color : '#94a3b8'}
                  className={`svg-grow ${m >= 0 ? 'up' : 'down'} ${grown ? 'grown' : ''}`}
                  style={{ transitionDelay: `${i * 40}ms` }} />
            <text x={bx + bw / 2} y={m >= 0 ? mid - h - 6 : mid + h + 14} textAnchor="middle" fontSize="11" fontWeight="900" fill="#0a0f1d">
              {fmtSigned(m, 0)}
            </text>
            <text x={bx + bw / 2} y={H - 6} textAnchor="middle" fontSize="10" fontWeight="800" fill="#475569">
              {g.home ? '' : '@'}{g.opponent}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function GameRow({ game, color }: { game: TeamGame; color: string }) {
  const margin = game.pts - game.opp_pts;
  return (
    <div className="series-row" style={{ borderLeftColor: color }}>
      <div className="series-row-top">
        <div className="series-info-left">
          <div className="series-opp-title">{game.home ? 'vs.' : '@'} {game.opponent}</div>
          <div className="series-subnote">{game.date}</div>
        </div>
        <span className={`series-badge ${game.result === 'W' ? 'win' : 'loss'}`}>
          {game.result} · {game.pts}–{game.opp_pts}
        </span>
      </div>
      <div className="rect-progress-track thin">
        <GrowBar className="rect-progress-fill" pct={Math.min(100, (Math.abs(margin) / 30) * 100)} color={game.result === 'W' ? color : '#94a3b8'} />
      </div>
    </div>
  );
}

function TeamStage({ team, teams, nav }: { team: Team; teams: Team[]; nav: Nav }) {
  const color = teamStyle(team.abbr).color;
  const pct = winPct(team.record);
  const rival = [...teams].sort((a, b) => a.elo_rank - b.elo_rank).find((t) => t.id !== team.id)!;

  const ratingBars = [
    { name: 'Elo rating', detail: `#${team.elo_rank} of 30`, value: <CountUp value={team.elo} decimals={0} />, pct: ((team.elo - 1300) / 450) * 100, col: color },
    { name: 'Net rating, last 10', detail: 'pts per 100 poss.', value: team.net_rtg_10 === null ? '—' : <CountUp value={team.net_rtg_10} signed />, pct: (((team.net_rtg_10 ?? -15) + 15) / 30) * 100, col: '#1d428a' },
    { name: 'Net rating, last 30', detail: 'pts per 100 poss.', value: team.net_rtg_30 === null ? '—' : <CountUp value={team.net_rtg_30} signed />, pct: (((team.net_rtg_30 ?? -15) + 15) / 30) * 100, col: '#059669' },
    { name: 'Win % this season', detail: `${team.record.wins}–${team.record.losses}`, value: pct === null ? '—' : <CountUp value={pct} suffix="%" />, pct: pct ?? 0, col: '#d97706' },
    { name: 'Rest before next game', detail: team.rest_days <= 1 ? 'back-to-back' : 'days off', value: `${team.rest_days}${team.rest_days >= 4 ? '+' : ''} d`, pct: (team.rest_days / 4) * 100, col: '#c8102e' },
  ];

  return (
    <div className="telemetry-stage" style={{ '--active-team-color': color } as React.CSSProperties}>
      <div className="stage-top-bar">
        <div className="stage-identity">
          <TeamLogo abbr={team.abbr} size="lg" />
          <div className="stage-headline">
            <h2>{team.name} <RectTag color={color}>#{team.elo_rank} Elo · Streak {streak(team)}</RectTag></h2>
            <p>
              {team.record.wins}–{team.record.losses} this season · {team.last_season_record.wins}–{team.last_season_record.losses} last season ·
              Elo {team.elo.toFixed(0)} · Net L10 {fmtSigned(team.net_rtg_10)}
            </p>
          </div>
        </div>
        <div className="stage-links">
          <button type="button" className="bref-btn accent" onClick={() => nav.goTo('matchup', { matchup: { homeId: team.id, awayId: rival.id } })}>
            Compare in Matchup Lab →
          </button>
          <a className="bref-btn" href={`https://www.nba.com/team/${team.id}`} target="_blank" rel="noreferrer">
            NBA.com team page ↗
          </a>
        </div>
      </div>

      <div className="charts-4-grid">
        <TiltCard className="chart-card" style={teamVars(team.abbr)}>
          <div className="chart-head tilt-layer-mid">
            <div><h3>01 // Elo trajectory</h3><p>Rating before each of the last {team.elo_history.length - 1} games, plus today</p></div>
            <RectTag>{team.elo.toFixed(0)} Elo</RectTag>
          </div>
          <div className="tilt-layer-deep"><EloChart team={team} /></div>
        </TiltCard>

        <TiltCard className="chart-card" style={teamVars(team.abbr)}>
          <div className="chart-head tilt-layer-mid">
            <div><h3>02 // Ratings &amp; form</h3><p>The inputs the model uses for this team</p></div>
            <RectTag>Net L10 {fmtSigned(team.net_rtg_10)}</RectTag>
          </div>
          <div className="metric-bars-stack tilt-layer-deep">
            {ratingBars.map((b, i) => (
              <div className="m-bar-item" key={b.name}>
                <div className="m-bar-top"><span>{b.name} <span className="m-bar-detail">({b.detail})</span></span><strong>{b.value}</strong></div>
                <div className="m-bar-track"><GrowBar pct={b.pct} color={b.col} delay={i * 35} /></div>
              </div>
            ))}
          </div>
        </TiltCard>

        <TiltCard className="chart-card" style={teamVars(team.abbr)}>
          <div className="chart-head tilt-layer-mid">
            <div><h3>03 // Last 10 results</h3><p>Most recent first · bar = margin of victory or defeat</p></div>
            <RectTag>{team.last10.filter((g) => g.result === 'W').length}–{team.last10.filter((g) => g.result === 'L').length}</RectTag>
          </div>
          <div className="series-stack tilt-layer-deep">
            {team.last10.map((g) => <GameRow key={`${g.date}-${g.opponent}`} game={g} color={color} />)}
          </div>
        </TiltCard>

        <TiltCard className="chart-card" style={teamVars(team.abbr)}>
          <div className="chart-head tilt-layer-mid">
            <div><h3>04 // Scoring margin</h3><p>Point differential, last 10 games (oldest → newest)</p></div>
            <RectTag>Streak {streak(team)}</RectTag>
          </div>
          <div className="tilt-layer-deep"><MarginChart team={team} /></div>
        </TiltCard>
      </div>
    </div>
  );
}

export function TeamPage({ teams, teamId, nav }: { teams: Loadable<Team[]>; teamId: number | null; nav: Nav }) {
  if (teams.error) return <ErrorPanel message={teams.error} />;
  if (!teams.data) return <LoadingPanel label="Loading team data…" />;

  const all = teams.data;
  const team = all.find((t) => t.id === teamId) ?? [...all].sort((a, b) => a.elo_rank - b.elo_rank)[0];
  const pills = [...all].sort((a, b) => a.abbr.localeCompare(b.abbr));

  return (
    <section>
      <div className="team-quick-switcher">
        <button type="button" className="nav-tab-btn" onClick={() => nav.goTo('rankings')}><span>← Power rankings</span></button>
        <div className="quick-team-pills" role="group" aria-label="Switch team">
          {pills.map((t) => (
            <button key={t.id} type="button" aria-pressed={t.id === team.id}
                    className={`team-mini-pill ${t.id === team.id ? 'active-pill' : ''}`}
                    style={{ '--pill-color': teamStyle(t.abbr).color } as React.CSSProperties}
                    onClick={() => nav.goTo('team', { teamId: t.id })}>
              <span>{t.abbr}</span>
            </button>
          ))}
        </div>
      </div>
      <FadeZone value={team} valueKey={String(team.id)} render={(t) => <TeamStage team={t} teams={all} nav={nav} />} />
    </section>
  );
}
