from __future__ import annotations

from typing import Iterable, List

from ..providers import MarketDataProvider
from .models import Recommendation, RiskProfile, SnapshotEntry, SnapshotRequest
from .scoring import compute_score, score_to_signal


async def build_recommendations(
    provider: MarketDataProvider,
    request: SnapshotRequest,
) -> List[Recommendation]:
    symbols = request.normalized_symbols
    if not symbols:
        tickers = await provider.list_tickers()
        symbols = [ticker.symbol for ticker in tickers[: request.limit]]
    else:
        symbols = symbols[: request.limit]

    quotes = await provider.get_quotes(symbols)
    symbol_to_quote = {quote.symbol: quote for quote in quotes}

    entries: List[SnapshotEntry] = []
    for symbol in symbols:
        quote = symbol_to_quote.get(symbol)
        if not quote:
            continue
        fundamentals = await provider.get_fundamentals(symbol)
        history = await provider.get_history(symbol, period="1y")
        entries.append(
            SnapshotEntry(
                quote=quote,
                fundamentals=fundamentals,
                history=history,
            )
        )

    recommendations: List[Recommendation] = []
    for entry in entries:
        score, factors = compute_score(entry, request.profile)
        signal = score_to_signal(score)
        recommendations.append(
            Recommendation(
                symbol=entry.quote.symbol,
                name=None,
                sector=None,
                price=entry.quote.price,
                change_pct=entry.quote.change_pct,
                score=score,
                signal=signal,
                factors=factors,
                profile=request.profile,
            )
        )

    recommendations.sort(key=lambda rec: rec.score, reverse=True)
    return recommendations
