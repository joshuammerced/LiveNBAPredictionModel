"""Parlay math: the model's chance for each leg, the chance they all hit, and expected value.

Two payout styles:
- pick'em (PrizePicks-style): a payout multiplier when every leg hits, and optionally
  multipliers for fewer hits (flex plays);
- sportsbook (DraftKings-style): American odds per leg, or for the whole parlay.

Legs are treated as independent. Legs that share a team (a player prop and his team's spread,
two teammates' points, ...) are correlated, so the combined chance is flagged as approximate.
"""
from scipy import stats

try:
    from backend import espn, props
    from backend.predictor import game_projection
except ImportError:
    import espn
    import props
    from predictor import game_projection


def american_to_decimal(odds):
    if odds == 0 or -100 < odds < 100:
        raise ValueError(f"Invalid American odds {odds}")
    return 1 + odds / 100 if odds > 0 else 1 + 100 / abs(odds)


def team_name(team_id):
    return next((t["abbreviation"] for t in espn.NBA_TEAMS.values() if t["id"] == team_id), str(team_id))


def leg_probability(leg):
    """(probability, label, teams involved, detail) for one leg dict."""
    kind = leg["type"]
    if kind == "prop":
        result = props.prop(leg["player_id"], leg["stat"], leg["line"])
        over = leg["side"] == "over"
        label = f"{leg.get('player_name', 'Player')} {'over' if over else 'under'} {leg['line']} {result['stat_label'].lower()}"
        return (result["prob_over"] if over else result["prob_under"]), label, {leg.get("team")}, result

    game = game_projection(leg["home_id"], leg["away_id"])
    home, away = team_name(leg["home_id"]), team_name(leg["away_id"])
    teams = {home, away}
    if kind == "moneyline":
        picked_home = leg["pick"] == "home"
        p = game["home_win_prob"] if picked_home else 1 - game["home_win_prob"]
        return p, f"{home if picked_home else away} to win ({away} @ {home})", teams, game
    if kind == "spread":
        # line is from the picked team's side: -4.5 means it must win by 5+, +4.5 means lose by 4 or fewer
        picked_home = leg["pick"] == "home"
        mean = game["margin_mean"] if picked_home else -game["margin_mean"]
        p = 1 - stats.norm.cdf((-leg["line"] - mean) / game["margin_sigma"])
        team = home if picked_home else away
        return float(p), f"{team} {leg['line']:+g} ({away} @ {home})", teams, game
    if kind == "total":
        if game["total_mean"] is None:
            raise ValueError("Not enough recent games to project a total")
        over = leg["side"] == "over"
        p_over = 1 - stats.norm.cdf((leg["line"] - game["total_mean"]) / game["total_sigma"])
        return float(p_over if over else 1 - p_over), f"{'Over' if over else 'Under'} {leg['line']} ({away} @ {home})", teams, game
    raise ValueError(f"Unknown leg type {kind}")


def hits_distribution(probs):
    """P(exactly k legs hit) for k = 0..n (independent legs with different chances)."""
    dist = [1.0]
    for p in probs:
        nxt = [0.0] * (len(dist) + 1)
        for k, q in enumerate(dist):
            nxt[k] += q * (1 - p)
            nxt[k + 1] += q * p
        dist = nxt
    return dist


def evaluate(legs, mode, payout=None, flex_payouts=None, parlay_odds=None):
    if not 1 <= len(legs) <= 10:
        raise ValueError("A parlay needs 1 to 10 legs")

    results, seen_teams, correlated = [], {}, False
    for i, leg in enumerate(legs):
        p, label, teams, detail = leg_probability(leg)
        for t in teams - {None}:
            correlated |= t in seen_teams and seen_teams[t] != i
            seen_teams.setdefault(t, i)
        entry = {"label": label, "prob": round(p, 4), "detail": detail}
        if mode == "sportsbook" and leg.get("odds") is not None:
            dec = american_to_decimal(leg["odds"])
            entry.update(odds=leg["odds"], book_prob=round(1 / dec, 4), edge=round(p - 1 / dec, 4))
        results.append(entry)

    probs = [r["prob"] for r in results]
    dist = hits_distribution(probs)
    all_hit = dist[-1]
    out = {"legs": results, "prob_all_hit": round(all_hit, 4),
           "hits_distribution": [round(q, 4) for q in dist], "correlated": correlated}

    if mode == "pickem":
        if payout:
            ev = all_hit * payout - 1
            if flex_payouts:  # {hits: multiplier}, e.g. {"5": 2, "4": 0.4} for a 6-pick flex
                ev = sum(dist[int(k)] * float(m) for k, m in flex_payouts.items() if 0 <= int(k) <= len(legs)) - 1
            out.update(payout=payout, expected_value=round(ev, 4),
                       breakeven_per_leg=round((1 / payout) ** (1 / len(legs)), 4))
    elif mode == "sportsbook":
        if parlay_odds is not None:
            decimal = american_to_decimal(parlay_odds)
        elif all(r.get("odds") is not None for r in results):
            decimal = 1.0
            for r in results:
                decimal *= american_to_decimal(r["odds"])
        else:
            decimal = None
        if decimal:
            out.update(decimal_odds=round(decimal, 3), book_prob_all_hit=round(1 / decimal, 4),
                       expected_value=round(all_hit * decimal - 1, 4))
    return out
