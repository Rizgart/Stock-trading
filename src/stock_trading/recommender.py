"""Logic for creating human-readable stock recommendations."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Sequence

from . import indicators
from .data_loader import PriceBar


@dataclass
class IndicatorSnapshot:
    short_sma: float
    long_sma: float
    ema: float
    rsi: float
    roc_10: float
    volatility: float
    support: float
    resistance: float


@dataclass
class Recommendation:
    ticker: str
    rating: str
    rationale: List[str] = field(default_factory=list)
    indicators: IndicatorSnapshot | None = None

    def as_dict(self) -> Dict[str, object]:
        return {
            "ticker": self.ticker,
            "rating": self.rating,
            "rationale": list(self.rationale),
            "indicators": self.indicators.__dict__ if self.indicators else None,
        }


def build_indicator_snapshot(bars: Sequence[PriceBar]) -> IndicatorSnapshot:
    closes = [bar.close for bar in bars]
    short_sma = indicators.simple_moving_average(closes, 5)
    long_sma = indicators.simple_moving_average(closes, 20)
    ema = indicators.exponential_moving_average(closes, 10)
    rsi = indicators.relative_strength_index(closes, 14)
    roc_10 = indicators.rate_of_change(closes, 10)
    volatility = indicators.rolling_volatility(closes, 20)
    support, resistance = indicators.support_resistance_levels(closes, 7)

    return IndicatorSnapshot(
        short_sma=short_sma,
        long_sma=long_sma,
        ema=ema,
        rsi=rsi,
        roc_10=roc_10,
        volatility=volatility,
        support=support,
        resistance=resistance,
    )


def _score_from_indicators(snapshot: IndicatorSnapshot) -> tuple[int, List[str]]:
    score = 0
    rationale: List[str] = []

    if snapshot.short_sma > snapshot.long_sma:
        score += 1
        rationale.append(
            "Kort sikt momentum är positivt: 5-dagars glidande medel ligger över 20-dagars."
        )
    else:
        score -= 1
        rationale.append(
            "Kort sikt momentum är svagt: 5-dagars glidande medel ligger under 20-dagars."
        )

    if snapshot.rsi < 30:
        score += 2
        rationale.append("RSI indikerar översålt läge vilket kan ge rekyl uppåt.")
    elif snapshot.rsi > 70:
        score -= 2
        rationale.append("RSI visar överköpt läge vilket kan leda till rekyl nedåt.")
    else:
        rationale.append("RSI ligger i ett neutralt område.")

    if snapshot.roc_10 > 0:
        score += 1
        rationale.append("10-dagars momentum är positivt.")
    else:
        score -= 1
        rationale.append("10-dagars momentum är negativt.")

    if snapshot.volatility < 0.01:
        score += 1
        rationale.append("Volatiliteten är låg vilket minskar risken.")
    elif snapshot.volatility > 0.03:
        score -= 1
        rationale.append("Volatiliteten är hög vilket ökar risken.")
    else:
        rationale.append("Volatiliteten är måttlig.")

    return score, rationale


def _rating_from_score(score: int) -> str:
    if score >= 3:
        return "Stark Köp"
    if score == 2:
        return "Köp"
    if score == 1:
        return "Svag Köp"
    if score == 0:
        return "Behåll"
    if score == -1:
        return "Svag Sälj"
    if score <= -3:
        return "Stark Sälj"
    return "Sälj"


def make_recommendation(ticker: str, bars: Sequence[PriceBar]) -> Recommendation:
    if len(bars) < 21:
        raise ValueError("Minst 21 datapunkter krävs för att skapa en analys.")

    snapshot = build_indicator_snapshot(bars)
    score, rationale = _score_from_indicators(snapshot)

    # Lägg till tips om prisnivåer
    price_now = bars[-1].close
    if price_now <= snapshot.support * 1.01:
        rationale.append(
            "Priset handlas nära ett stöd vilket kan vara ett bra ingångsläge."
        )
    elif price_now >= snapshot.resistance * 0.99:
        rationale.append(
            "Priset närmar sig motstånd vilket kan ge ett bra läge att ta hem vinst."
        )

    rating = _rating_from_score(score)

    return Recommendation(
        ticker=ticker.upper(),
        rating=rating,
        rationale=rationale,
        indicators=snapshot,
    )


__all__ = [
    "IndicatorSnapshot",
    "Recommendation",
    "build_indicator_snapshot",
    "make_recommendation",
]
