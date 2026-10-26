export type PageId = 'home' | 'rankings' | 'team' | 'matchup';

export interface MatchupPair {
  homeId: number;
  awayId: number;
}

export interface Nav {
  goTo: (page: PageId, opts?: { teamId?: number; matchup?: MatchupPair }) => void;
}
