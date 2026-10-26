'use client';

import React, { useState } from 'react';
import type { Loadable, Team } from '@/lib/api';
import { fmtSigned, winPct } from '@/lib/api';
import { teamStyle, type Conference } from '@/lib/teams';
import type { Nav } from '../nav';
import { CountUp, Divider, ErrorPanel, FadeZone, GrowBar, LoadingPanel, RectTag, TeamLogo, TiltCard, teamVars } from '../ui';

type SortKey = 'elo' | 'net10' | 'net30' | 'winPct';

const SORTS: { key: SortKey; label: string; value: (t: Team) => number }[] = [
  { key: 'elo', label: 'Elo rating', value: (t) => t.elo },
  { key: 'net10', label: 'Net rating, last 10', value: (t) => t.net_rtg_10 ?? -99 },
  { key: 'net30', label: 'Net rating, last 30', value: (t) => t.net_rtg_30 ?? -99 },
  { key: 'winPct', label: 'Win % this season', value: (t) => winPct(t.record) ?? -1 },
];

// Bar scales: map each stat onto 0–100% of the track.
const eloPct = (elo: number) => ((elo - 1300) / 450) * 100;
const netPct = (n: number | null) => (n === null ? 0 : ((n + 15) / 30) * 100);

export function streak(team: Team): string {
  const games = team.last10;
  if (!games.length) return '—';
  let n = 0;
  while (n < games.length && games[n].result === games[0].result) n++;
  return `${games[0].result}${n}`;
}

export function TeamCard({ team, nav }: { team: Team; nav: Nav }) {
  const color = teamStyle(team.abbr).color;
  const l10wins = team.last10.filter((g) => g.result === 'W').length;
  return (
    <TiltCard className="team-card" style={teamVars(team.abbr)} label={`Open ${team.name}`} onClick={() => nav.goTo('team', { teamId: team.id })}>
      <div className="card-geo-bg" />
      <div className="team-card-head tilt-layer-deep">
        <div className="team-id-group">
          <TeamLogo abbr={team.abbr} />
          <div className="team-title-group">
            <h3>{team.name}</h3>
            <div className="team-submeta">
              {team.record.wins}–{team.record.losses} this season · {team.last_season_record.wins}–{team.last_season_record.losses} last season
            </div>
          </div>
        </div>
        <RectTag color={color}>#{team.elo_rank} Elo</RectTag>
      </div>

      <div className="mini-telemetry-grid tilt-layer-mid">
        <div className="mini-stat-box">
          <div className="mini-stat-top"><span>Elo</span><strong><CountUp value={team.elo} decimals={0} /></strong></div>
          <div className="rect-progress-track"><GrowBar className="rect-progress-fill" pct={eloPct(team.elo)} color={color} /></div>
        </div>
        <div className="mini-stat-box">
          <div className="mini-stat-top"><span>Net L10</span><strong>{team.net_rtg_10 === null ? '—' : <CountUp value={team.net_rtg_10} signed />}</strong></div>
          <div className="rect-progress-track"><GrowBar className="rect-progress-fill" pct={netPct(team.net_rtg_10)} color="#1d428a" delay={35} /></div>
        </div>
        <div className="mini-stat-box">
          <div className="mini-stat-top"><span>Net L30</span><strong>{team.net_rtg_30 === null ? '—' : <CountUp value={team.net_rtg_30} signed />}</strong></div>
          <div className="rect-progress-track"><GrowBar className="rect-progress-fill" pct={netPct(team.net_rtg_30)} color="#059669" delay={70} /></div>
        </div>
        <div className="mini-stat-box">
          <div className="mini-stat-top"><span>Last 10</span><strong>{l10wins}–{team.last10.length - l10wins}</strong></div>
          <div className="rect-progress-track"><GrowBar className="rect-progress-fill" pct={l10wins * 10} color="#c8102e" delay={105} /></div>
        </div>
      </div>

      <div className="team-card-foot tilt-layer-mid">
        <span className="champ-badge">Streak {streak(team)}</span>
        <span className="launch-label">Open team ▶</span>
      </div>
    </TiltCard>
  );
}

export function RankingsPage({ teams, nav }: { teams: Loadable<Team[]>; nav: Nav }) {
  const [conf, setConf] = useState<'ALL' | Conference>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('elo');

  const sort = SORTS.find((s) => s.key === sortKey)!;
  const list = (teams.data ?? [])
    .filter((t) => conf === 'ALL' || teamStyle(t.abbr).conf === conf)
    .sort((a, b) => sort.value(b) - sort.value(a));
  const count = (c: Conference) => (teams.data ?? []).filter((t) => teamStyle(t.abbr).conf === c).length;

  return (
    <section>
      <Divider title="Power rankings · all 30 teams" sub="Elo updates after every game · net rating = point margin per 100 possessions" />

      <div className="filter-toolbar">
        <div className="filter-pills" role="group" aria-label="Conference">
          {(['ALL', 'East', 'West'] as const).map((c) => (
            <button key={c} type="button" aria-pressed={conf === c} className={`nav-tab-btn ${conf === c ? 'active' : ''}`} onClick={() => setConf(c)}>
              <span>{c === 'ALL' ? `All teams (${teams.data?.length ?? 30})` : `${c}ern Conference (${count(c)})`}</span>
            </button>
          ))}
        </div>
        <select className="sport-select" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} aria-label="Sort teams">
          {SORTS.map((s) => <option key={s.key} value={s.key}>Sort by: {s.label}</option>)}
        </select>
      </div>

      {teams.error && <ErrorPanel message={teams.error} />}
      {!teams.data && !teams.error && <LoadingPanel label="Loading team ratings…" />}
      {teams.data && (
        <FadeZone
          value={list}
          valueKey={`${conf}-${sortKey}`}
          render={(shown) => (
            <div className="teams-grid">
              {shown.map((t) => <TeamCard key={t.id} team={t} nav={nav} />)}
            </div>
          )}
        />
      )}
      <p className="footnote">
        Net ratings above zero mean a team has outscored opponents over that stretch; {fmtSigned(10)} is elite, {fmtSigned(-10)} is bottom-tier.
      </p>
    </section>
  );
}
