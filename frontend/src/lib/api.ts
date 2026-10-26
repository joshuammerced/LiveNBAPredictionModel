'use client';

import { useEffect, useState } from 'react';

export interface Player {
  team: string;
  name: string;
  pts_per_game: number;
  ast_per_game: number;
  reb_per_game: number;
  efg: string;
}

export interface Prediction {
  home_team: string;
  away_team: string;
  home_team_id: number;
  away_team_id: number;
  home_abbr: string;
  away_abbr: string;
  game_time: string;
  win_prob: number;
  home_player: Player | null;
  away_player: Player | null;
}

export interface TeamGame {
  date: string;
  opponent: string;
  home: boolean;
  result: 'W' | 'L';
  pts: number;
  opp_pts: number;
}

export interface WinLoss {
  wins: number;
  losses: number;
}

export interface Team {
  id: number;
  abbr: string;
  name: string;
  city: string;
  nickname: string;
  elo: number;
  elo_rank: number;
  net_rtg_10: number | null;
  net_rtg_30: number | null;
  rest_days: number;
  record: WinLoss;
  last_season_record: WinLoss;
  last10: TeamGame[];
  elo_history: { date: string; elo: number }[];
}

export interface Metrics {
  accuracy: number;
  log_loss: number;
  brier: number;
}

export interface ModelInfo {
  features: string[];
  coef: number[];
  trained_on: string;
  trained_at: string;
  test_season: string;
  test_games: number;
  test_metrics: Metrics;
  baseline_metrics: Metrics;
  elo_only_metrics: Metrics;
}

export interface Factor {
  feature: string;
  value: number | null;
  contribution: number;
}

export interface MatchupResult {
  home_team_id: number;
  away_team_id: number;
  home_win_prob: number;
  factors: Factor[];
}

export async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`/api/${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || body?.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export interface Loadable<T> {
  data: T | null;
  error: string | null;
  updating?: boolean;
}

/** keepPrevious: while a new path loads, keep returning the last response (flagged `updating`). */
export function useBackend<T>(path: string | null, keepPrevious = false): Loadable<T> {
  const [state, setState] = useState<{ path: string | null } & Loadable<T>>({ path: null, data: null, error: null });

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    getJSON<T>(path)
      .then((data) => !cancelled && setState({ path, data, error: null }))
      .catch((err: Error) => !cancelled && setState({ path, data: null, error: err.message }));
    return () => {
      cancelled = true;
    };
  }, [path]);

  if (state.path === path) return state;
  return keepPrevious ? { ...state, updating: true } : { data: null, error: null };
}

export function winPct(r: WinLoss): number | null {
  const games = r.wins + r.losses;
  return games ? (100 * r.wins) / games : null;
}

export function fmtSigned(n: number | null | undefined, decimals = 1): string {
  if (n === null || n === undefined) return '—';
  return `${n > 0 ? '+' : ''}${n.toFixed(decimals)}`;
}
