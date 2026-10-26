'use client';

import React, { useRef, useState } from 'react';
import type { ModelInfo, Prediction, Team } from '@/lib/api';
import { useBackend } from '@/lib/api';
import { NBA_COLOR_PALETTE } from '@/lib/teams';
import type { MatchupPair, Nav, PageId } from '@/components/nav';
import { PageWipe, type Wipe } from '@/components/PageWipe';
import { FrontPage } from '@/components/pages/FrontPage';
import { RankingsPage } from '@/components/pages/RankingsPage';
import { TeamPage } from '@/components/pages/TeamPage';
import { MatchupLab } from '@/components/pages/MatchupLab';

// The page swaps while the black wipe layer covers the screen.
const SWAP_AT_MS = 740;
const WIPE_DONE_MS = 1240;

function randomColors(count: number) {
  const pool = [...NBA_COLOR_PALETTE];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

export default function Home() {
  const predictions = useBackend<Prediction[]>('predictions');
  const teams = useBackend<Team[]>('teams');
  const model = useBackend<ModelInfo>('model');

  const [page, setPage] = useState<PageId>('home');
  const [teamId, setTeamId] = useState<number | null>(null);
  const [pair, setPair] = useState<MatchupPair | null>(null);
  const [wipe, setWipe] = useState<Wipe | null>(null);
  const transitioning = useRef(false);

  const ranked = teams.data ? [...teams.data].sort((a, b) => a.elo_rank - b.elo_rank) : [];
  const currentTeamId = teamId ?? ranked[0]?.id ?? null;
  const firstGame = predictions.data?.[0];
  const currentPair: MatchupPair | null =
    pair ??
    (firstGame ? { homeId: firstGame.home_team_id, awayId: firstGame.away_team_id }
      : ranked.length > 1 ? { homeId: ranked[0].id, awayId: ranked[1].id } : null);
  const currentTeam = teams.data?.find((t) => t.id === currentTeamId);

  const nav: Nav = {
    goTo(target, opts = {}) {
      const apply = () => {
        if (opts.teamId !== undefined) setTeamId(opts.teamId);
        if (opts.matchup) setPair(opts.matchup);
        setPage(target);
      };

      // Switching team or matchup within the same page: the page's own fade handles it.
      if (target === page) {
        apply();
        return;
      }
      if (transitioning.current) return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        apply();
        window.scrollTo({ top: 0 });
        return;
      }

      const team = teams.data?.find((t) => t.id === (opts.teamId ?? currentTeamId));
      const labels: Record<PageId, string> = {
        home: 'NBA // FRONT PAGE',
        rankings: 'NBA // POWER RANKINGS',
        team: team ? `${team.abbr} // ${team.name.toUpperCase()}` : 'NBA // TEAM',
        matchup: 'NBA // MATCHUP LAB',
      };

      transitioning.current = true;
      setWipe({ id: Date.now(), label: labels[target], colors: randomColors(4) });
      setTimeout(() => {
        apply();
        window.scrollTo({ top: 0, behavior: 'instant' });
      }, SWAP_AT_MS);
      setTimeout(() => {
        setWipe(null);
        transitioning.current = false;
      }, WIPE_DONE_MS);
    },
  };

  const tabs: { id: PageId; label: string }[] = [
    { id: 'home', label: '01 // Front page' },
    { id: 'rankings', label: '02 // Power rankings' },
    { id: 'team', label: `03 // Team${currentTeam ? ` (${currentTeam.abbr})` : ''}` },
    { id: 'matchup', label: '04 // Matchup lab' },
  ];

  return (
    <>
      <PageWipe wipe={wipe} />
      <div className="nba-top-ribbon" />

      <header className="broadcast-navbar">
        <div className="navbar-inner">
          <button type="button" className="brand-lockup" onClick={() => nav.goTo('home')}>
            <div className="nba-slash-logo"><span>NBA // LAB</span></div>
            <div className="brand-text">
              <h1>Live Prediction Lab</h1>
              <p>Win probabilities · Elo · form · rest</p>
            </div>
          </button>
          <nav className="nav-tabs" aria-label="Main">
            {tabs.map((t) => (
              <button key={t.id} type="button" className={`nav-tab-btn ${page === t.id ? 'active' : ''}`}
                      aria-current={page === t.id ? 'page' : undefined} onClick={() => nav.goTo(t.id)}>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="page-container">
        {page === 'home' && <FrontPage predictions={predictions} teams={teams} model={model} nav={nav} />}
        {page === 'rankings' && <RankingsPage teams={teams} nav={nav} />}
        {page === 'team' && <TeamPage teams={teams} teamId={currentTeamId} nav={nav} />}
        {page === 'matchup' && <MatchupLab teams={teams} predictions={predictions} pair={currentPair} setPair={setPair} nav={nav} />}
      </main>

      <footer className="footer-citations">
        Game logs, schedule and player stats from stats.nba.com via <a href="https://github.com/swar/nba_api" target="_blank" rel="noreferrer">nba_api</a>.
        {model.data && <> Model trained on {model.data.trained_on} regular seasons, last updated {model.data.trained_at}.</>}
        {' '}Predictions are probabilities, not guarantees.
      </footer>
    </>
  );
}
