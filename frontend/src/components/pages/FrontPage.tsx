'use client';

import React from 'react';
import type { Loadable, ModelInfo, Player, Prediction, Team } from '@/lib/api';
import { teamStyle } from '@/lib/teams';
import type { Nav } from '../nav';
import {
  CountUp, Divider, Donut, ErrorPanel, LoadingPanel, ProbBar, RectTag, SlashButton, TeamLogo, TiltCard, teamVars,
} from '../ui';

function favorite(p: Prediction) {
  const homeFav = p.win_prob >= 0.5;
  return {
    abbr: homeFav ? p.home_abbr : p.away_abbr,
    prob: homeFav ? p.win_prob : 1 - p.win_prob,
  };
}

function slateDate(predictions: Prediction[]) {
  return predictions[0]?.game_time.split(' at ')[0] ?? '';
}

function StarLine({ player, abbr }: { player: Player | null; abbr: string }) {
  if (!player) return <div className="star-line muted">{abbr}: no player data yet</div>;
  return (
    <div className="star-line" style={teamVars(abbr)}>
      <span className="star-name">{player.name}</span>
      <span className="star-stats">{player.pts_per_game.toFixed(1)} PTS · {player.reb_per_game.toFixed(1)} REB · {player.ast_per_game.toFixed(1)} AST</span>
    </div>
  );
}

function ScoreRow({ abbr, name, role, prob, isFav }: { abbr: string; name: string; role: string; prob: number; isFav: boolean }) {
  return (
    <div className={`score-row ${isFav ? 'fav' : ''}`}>
      <TeamLogo abbr={abbr} size="sm" />
      <div className="score-team">
        <div className="matchup-name">{name}</div>
        <div className="matchup-role">{role}</div>
      </div>
      <div className="score-prob"><CountUp value={prob * 100} decimals={0} suffix="%" /></div>
    </div>
  );
}

function GameCard({ game, nav }: { game: Prediction; nav: Nav }) {
  const fav = favorite(game);
  return (
    <TiltCard
      className="game-card"
      style={teamVars(fav.abbr)}
      label={`${game.away_team} at ${game.home_team}, open in Matchup Lab`}
      onClick={() => nav.goTo('matchup', { matchup: { homeId: game.home_team_id, awayId: game.away_team_id } })}
    >
      <div className="card-geo-bg" />
      <div className="game-card-head tilt-layer-mid">
        <RectTag color={teamStyle(fav.abbr).color}>{game.game_time.split(' at ')[1] ?? game.game_time}</RectTag>
        <span className="pick-label">Pick: {fav.abbr}</span>
      </div>

      {game.stage && <div className="stage-tag tilt-layer-mid">{game.stage}</div>}

      <div className="score-rows tilt-layer-deep">
        <ScoreRow abbr={game.away_abbr} name={game.away_team} role="Away" prob={1 - game.win_prob} isFav={fav.abbr === game.away_abbr} />
        <ScoreRow abbr={game.home_abbr} name={game.home_team} role="Home" prob={game.win_prob} isFav={fav.abbr === game.home_abbr} />
      </div>

      <div className="tilt-layer-mid">
        <ProbBar homeProb={game.win_prob} homeAbbr={game.home_abbr} awayAbbr={game.away_abbr} />
      </div>

      <div className="stars-box tilt-layer-mid">
        <div className="stars-title">Top scorers</div>
        <StarLine player={game.away_player} abbr={game.away_abbr} />
        <StarLine player={game.home_player} abbr={game.home_abbr} />
      </div>

      <div className="team-card-foot tilt-layer-mid">
        <span className="champ-badge">{fav.abbr} · {(fav.prob * 100).toFixed(0)}%</span>
        <span className="launch-label">Matchup lab ▶</span>
      </div>
    </TiltCard>
  );
}

function ClosestCall({ games, nav }: { games: Prediction[]; nav: Nav }) {
  const game = [...games].sort((a, b) => Math.abs(a.win_prob - 0.5) - Math.abs(b.win_prob - 0.5))[0];
  const fav = favorite(game);
  return (
    <TiltCard
      className="champion-spotlight-card"
      style={teamVars(fav.abbr)}
      label="Closest call: open in Matchup Lab"
      onClick={() => nav.goTo('matchup', { matchup: { homeId: game.home_team_id, awayId: game.away_team_id } })}
    >
      <div className="spotlight-header tilt-layer-mid">
        <RectTag color={teamStyle(fav.abbr).color}>{games.length > 1 ? 'Closest call on the slate' : 'Next game'}</RectTag>
        <span className="spotlight-time">{game.game_time.split(' at ')[1]}</span>
      </div>
      <div className="spotlight-body tilt-layer-deep">
        <Donut pct={fav.prob * 100} color={teamStyle(fav.abbr).color} label={`${fav.abbr} TO WIN`} size={128} />
        <div>
          <h3 className="spotlight-title">{game.away_abbr} @ {game.home_abbr}</h3>
          <p className="spotlight-sub">{game.away_team} at {game.home_team}</p>
          <p className="spotlight-note">
            {games.length > 1 ? 'The model sees this as the tightest game of the slate.' : `The model makes ${fav.abbr} a ${(fav.prob * 100).toFixed(0)}% favorite.`}
          </p>
        </div>
      </div>
    </TiltCard>
  );
}

function KpiStrip({ teams, model, nav }: { teams: Team[] | null; model: ModelInfo | null; nav: Nav }) {
  const topElo = teams && [...teams].sort((a, b) => a.elo_rank - b.elo_rank)[0];
  const hottest = teams && [...teams].filter((t) => t.margin_10 !== null).sort((a, b) => (b.margin_10 ?? 0) - (a.margin_10 ?? 0))[0];

  return (
    <div className="kpi-strip">
      <TiltCard className="kpi-box" style={teamVars(null)}>
        <div className="kpi-top-tag tilt-layer-mid"><span>Model accuracy</span><span className="kpi-rect-pill">{model?.test_season ?? '—'}</span></div>
        <div className="kpi-big-num tilt-layer-deep">{model ? <CountUp value={model.test_metrics.accuracy * 100} suffix="%" /> : '—'}</div>
        <div className="kpi-foot tilt-layer-mid">
          {model ? <>Winners picked correctly in {model.test_games.toLocaleString()} games it never trained on</> : 'Loading…'}
        </div>
      </TiltCard>

      <TiltCard className="kpi-box" style={{ '--team-color': '#c8102e' } as React.CSSProperties}>
        <div className="kpi-top-tag tilt-layer-mid"><span>Vs. picking the home team</span><span className="kpi-rect-pill">Baseline</span></div>
        <div className="kpi-big-num tilt-layer-deep">
          {model ? <CountUp value={(model.test_metrics.accuracy - model.baseline_metrics.accuracy) * 100} signed suffix=" pts" /> : '—'}
        </div>
        <div className="kpi-foot tilt-layer-mid">
          {model ? <>Always picking the home team: {(model.baseline_metrics.accuracy * 100).toFixed(1)}%</> : 'Loading…'}
        </div>
      </TiltCard>

      {model?.playoff_metrics && (
        <TiltCard className="kpi-box" style={{ '--team-color': '#552583' } as React.CSSProperties}>
          <div className="kpi-top-tag tilt-layer-mid"><span>Playoff accuracy</span><span className="kpi-rect-pill">Play-in + playoffs</span></div>
          <div className="kpi-big-num tilt-layer-deep"><CountUp value={model.playoff_metrics.accuracy * 100} suffix="%" /></div>
          <div className="kpi-foot tilt-layer-mid">
            {model.playoff_metrics.games} postseason games, last 5 seasons (closer matchups, so lower than the regular season)
          </div>
        </TiltCard>
      )}

      {topElo ? (
        <TiltCard className="kpi-box" style={teamVars(topElo.abbr)} label={`Open ${topElo.name}`} onClick={() => nav.goTo('team', { teamId: topElo.id })}>
          <div className="kpi-top-tag tilt-layer-mid"><span>#1 in Elo rating</span><span className="kpi-rect-pill">{topElo.abbr}</span></div>
          <div className="kpi-big-num tilt-layer-deep"><CountUp value={topElo.elo} decimals={0} /></div>
          <div className="kpi-foot tilt-layer-mid">{topElo.name} · {topElo.record.wins}–{topElo.record.losses} this season</div>
        </TiltCard>
      ) : <TiltCard className="kpi-box"><LoadingPanel label="Loading ratings…" /></TiltCard>}

      {hottest ? (
        <TiltCard className="kpi-box" style={teamVars(hottest.abbr)} label={`Open ${hottest.name}`} onClick={() => nav.goTo('team', { teamId: hottest.id })}>
          <div className="kpi-top-tag tilt-layer-mid"><span>Hottest team (last 10)</span><span className="kpi-rect-pill">{hottest.abbr}</span></div>
          <div className="kpi-big-num tilt-layer-deep"><CountUp value={hottest.margin_10 ?? 0} signed /> PPG</div>
          <div className="kpi-foot tilt-layer-mid">{hottest.name} · average margin over the last 10 games</div>
        </TiltCard>
      ) : <TiltCard className="kpi-box"><LoadingPanel label="Loading form…" /></TiltCard>}
    </div>
  );
}

export function FrontPage({ predictions, teams, model, nav }: {
  predictions: Loadable<Prediction[]>; teams: Loadable<Team[]>; model: Loadable<ModelInfo>; nav: Nav;
}) {
  const games = predictions.data;
  return (
    <section>
      <div className="hero-banner">
        <div className="hero-geo-stripes" />
        <div className="hero-left">
          <div className="hero-kicker"><span>Live NBA prediction lab</span></div>
          <h2>Every game called by a model, <em>not a hunch</em>.</h2>
          <p>
            Win probabilities for every upcoming game from a model trained on {model.data?.trained_on ?? 'a decade of'} game
            logs. It weighs Elo ratings, recent form, rest and back-to-backs, then shows you exactly why it leans the way it does.
          </p>
          <div className="hero-cta-row">
            <SlashButton onClick={() => nav.goTo('rankings')}>Power rankings →</SlashButton>
            <SlashButton variant="secondary" onClick={() => nav.goTo('matchup')}>Build any matchup →</SlashButton>
          </div>
        </div>
        <div className="hero-right">
          {games && games.length > 0 && <ClosestCall games={games} nav={nav} />}
          {!games && !predictions.error && <LoadingPanel label="Pulling the schedule…" />}
        </div>
      </div>

      <Divider title={<>{games?.some((g) => g.season_type === 'Playoffs') ? 'Playoff slate' : games?.some((g) => g.season_type === 'PlayIn') ? 'Play-in slate' : 'Upcoming slate'}{games && games.length > 0 && <> · {slateDate(games)}</>}</>}
               sub={games ? `${games.length} game${games.length === 1 ? '' : 's'} · home win probability` : 'Loading…'} />
      {predictions.error && <ErrorPanel message={predictions.error} />}
      {!games && !predictions.error && <LoadingPanel label="Scoring tonight's games… (first load takes a few seconds)" />}
      {games && games.length === 0 && <div className="empty-panel">No games on the schedule today or tomorrow. Check back soon.</div>}
      {games && games.length > 0 && (
        <div className="teams-grid">
          {games.map((g) => <GameCard key={`${g.home_team_id}-${g.away_team_id}`} game={g} nav={nav} />)}
        </div>
      )}

      <Divider title="Model scorecard" sub={model.data ? `Tested on the ${model.data.test_season} season` : undefined} />
      <KpiStrip teams={teams.data} model={model.data} nav={nav} />

      <div className="portal-grid-3">
        <TiltCard className="portal-card" style={teamVars('GSW')} label="Open power rankings" onClick={() => nav.goTo('rankings')}>
          <div className="tilt-layer-deep">
            <div className="portal-num"><span>Page 02 // Rankings</span></div>
            <h3>Power Rankings</h3>
            <p>All 30 teams ranked by Elo, with recent scoring margin and form. Filter by conference and re-sort.</p>
          </div>
          <div className="portal-go tilt-layer-mid"><span>Open rankings</span><span>►</span></div>
        </TiltCard>
        <TiltCard className="portal-card" style={teamVars('BOS')} label="Open team page" onClick={() => nav.goTo('team')}>
          <div className="tilt-layer-deep">
            <div className="portal-num"><span>Page 03 // Team</span></div>
            <h3>Team Deep-Dive</h3>
            <p>Elo trend, ratings, the last 10 results and scoring margins for any team.</p>
          </div>
          <div className="portal-go tilt-layer-mid"><span>Inspect a team</span><span>►</span></div>
        </TiltCard>
        <TiltCard className="portal-card" style={teamVars('CHI')} label="Open Matchup Lab" onClick={() => nav.goTo('matchup')}>
          <div className="tilt-layer-deep">
            <div className="portal-num"><span>Page 04 // Matchup Lab</span></div>
            <h3>Matchup Lab</h3>
            <p>Pick any two teams and get the model&apos;s prediction, with a breakdown of what drives it.</p>
          </div>
          <div className="portal-go tilt-layer-mid"><span>Build a matchup</span><span>►</span></div>
        </TiltCard>
        <TiltCard className="portal-card" style={teamVars('LAL')} label="Open Parlay Lab" onClick={() => nav.goTo('parlay')}>
          <div className="tilt-layer-deep">
            <div className="portal-num"><span>Page 05 // Parlay Lab</span></div>
            <h3>Parlay Lab</h3>
            <p>Build a pick&apos;em or sportsbook slip and see each leg&apos;s odds, the chance it all hits, and the expected value.</p>
          </div>
          <div className="portal-go tilt-layer-mid"><span>Check a parlay</span><span>►</span></div>
        </TiltCard>
      </div>
    </section>
  );
}

