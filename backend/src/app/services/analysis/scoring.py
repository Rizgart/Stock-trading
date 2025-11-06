from __future__ import annotations

from typing import List, Tuple

import pandas as pd

from .fundamentals import score_fundamentals
from .indicators import candles_to_dataframe, moving_average, rsi
from .models import RiskProfile, SnapshotEntry
from .risk import score_risk


def score_technical(entry: SnapshotEntry, df: pd.DataFrame | None = None) -> Tuple[float, List[str]]:
    if df is None:
        df = candles_to_dataframe(entry.history)
    if df.empty:
        return 50.0, ["Ingen historik – neutral poäng"]

    close = df["close"]
    latest_close = close.iloc[-1]

    ma20 = moving_average(close, 20).iloc[-1]
    ma50 = moving_average(close, 50).iloc[-1]
    ma200 = moving_average(close, 200).iloc[-1]
    rsi_series = rsi(close, 14)
    rsi_last = rsi_series.iloc[-1] if not rsi_series.empty else None

    score = 50.0
    factors: List[str] = []

    if not pd.isna(ma20) and latest_close > ma20:
        score += 10
        factors.append("Pris över MA20")
    if not pd.isna(ma50) and latest_close > ma50:
        score += 10
        factors.append("Pris över MA50")
    if not pd.isna(ma200) and latest_close > ma200:
        score += 10
        factors.append("Pris över MA200")

    if rsi_last is not None:
        if rsi_last < 30:
            score += 5
            factors.append("RSI < 30 (översåld)")
        elif rsi_last > 70:
            score -= 10
            factors.append("RSI > 70 (överköpt)")

    day_change = entry.quote.change_pct
    score += max(min(day_change, 5), -5)

    score = max(0.0, min(100.0, score))
    return score, factors[:3]


def compute_score(entry: SnapshotEntry, profile: RiskProfile) -> Tuple[float, List[str]]:
    df = candles_to_dataframe(entry.history)
    technical_score, technical_factors = score_technical(entry, df=df)
    fundamental_score, fundamental_factors = score_fundamentals(entry.fundamentals)
    risk_score, risk_factors = score_risk(entry.fundamentals, df, profile)

    composite = (
        technical_score * 0.45
        + fundamental_score * 0.4
        + risk_score * 0.15
    )
    composite = float(max(0.0, min(100.0, composite)))
    factors = (technical_factors + fundamental_factors + risk_factors)[:3]
    return composite, factors


def score_to_signal(score: float) -> str:
    if score >= 70:
        return "BUY"
    if score <= 45:
        return "SELL"
    return "HOLD"
