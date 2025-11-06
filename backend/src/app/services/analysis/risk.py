from __future__ import annotations

from typing import List, Tuple

import pandas as pd

from ..providers import Fundamentals
from .indicators import atr
from .models import RiskProfile


def score_risk(
    fundamentals: Fundamentals | None,
    df: pd.DataFrame,
    profile: RiskProfile,
) -> Tuple[float, List[str]]:
    score = 50.0
    factors: List[str] = []

    atr_series = atr(df, window=14)
    last_atr = atr_series.iloc[-1] if not atr_series.empty else None
    last_close = df["close"].iloc[-1] if not df.empty else None
    atr_pct = None
    if last_atr is not None and last_close and last_close != 0:
        atr_pct = (last_atr / last_close) * 100

    if atr_pct is not None:
        if atr_pct < 2.5:
            score += 10
            factors.append("Låg ATR (%)")
        elif atr_pct > 5:
            score -= 10
            factors.append("Hög ATR (%)")

    if fundamentals and fundamentals.beta is not None:
        if fundamentals.beta < 1:
            score += 5
            factors.append("Beta < 1")
        elif fundamentals.beta > 1.3:
            score -= 5
            factors.append("Beta > 1.3")

        if profile == RiskProfile.KONSERVATIV and fundamentals.beta > 1:
            score -= 5
        elif profile == RiskProfile.AGGRESSIV and fundamentals.beta > 1.2:
            score += 5

    if atr_pct is not None and profile == RiskProfile.KONSERVATIV and atr_pct > 4:
        score -= 5
    if atr_pct is not None and profile == RiskProfile.AGGRESSIV and atr_pct < 2:
        score -= 5

    score = max(0.0, min(100.0, score))
    return score, factors
