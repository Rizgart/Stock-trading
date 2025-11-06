from __future__ import annotations

from typing import List, Tuple

from ..providers import Fundamentals


def score_fundamentals(fundamentals: Fundamentals | None) -> Tuple[float, List[str]]:
    if not fundamentals:
        return 50.0, ["Saknar fundamentals – neutral poäng"]

    score = 50.0
    factors: List[str] = []

    if fundamentals.pe is not None:
        if fundamentals.pe < 15:
            score += 10
            factors.append("P/E under 15")
        elif fundamentals.pe > 30:
            score -= 5

    if fundamentals.ps is not None and fundamentals.ps < 3:
        score += 5
        factors.append("P/S under 3")

    if fundamentals.roe is not None:
        if fundamentals.roe > 15:
            score += 10
            factors.append("ROE över 15%")
        elif fundamentals.roe < 5:
            score -= 5

    if fundamentals.growth_5y is not None and fundamentals.growth_5y > 10:
        score += 10
        factors.append("Tillväxt >10% (5y)")

    if fundamentals.profit_margin is not None and fundamentals.profit_margin > 15:
        score += 5
        factors.append("Stark marginal")

    if fundamentals.debt_to_equity is not None and fundamentals.debt_to_equity > 1:
        score -= 10
        factors.append("Hög skuldsättning")

    if fundamentals.dividend_yield is not None and fundamentals.dividend_yield >= 3:
        score += 5
        factors.append("Utdelning ≥3%")

    score = max(0.0, min(100.0, score))
    return score, factors
