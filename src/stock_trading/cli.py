"""Command line interface for the stock analysis toolkit."""
from __future__ import annotations

import argparse
from typing import Sequence

from .data_loader import available_tickers, load_price_history
from .recommender import Recommendation, make_recommendation

RATING_PRIORITY = {
    "Stark Köp": 0,
    "Köp": 1,
    "Svag Köp": 2,
    "Behåll": 3,
    "Svag Sälj": 4,
    "Sälj": 5,
    "Stark Sälj": 6,
}


def _format_recommendation(rec: Recommendation) -> str:
    lines = [f"Ticker: {rec.ticker}", f"Rekommendation: {rec.rating}"]

    if rec.indicators:
        ind = rec.indicators
        lines.append(
            "Nyckeltal:"
            f"\n  5-dagars SMA: {ind.short_sma:.2f}"
            f"\n  20-dagars SMA: {ind.long_sma:.2f}"
            f"\n  10-dagars EMA: {ind.ema:.2f}"
            f"\n  RSI (14): {ind.rsi:.1f}"
            f"\n  ROC (10 dagar): {ind.roc_10:.2f}%"
            f"\n  Volatilitet (20 dagar): {ind.volatility:.4f}"
            f"\n  Stöd (7 dagar): {ind.support:.2f}"
            f"\n  Motstånd (7 dagar): {ind.resistance:.2f}"
        )

    if rec.rationale:
        lines.append("Analys:")
        for reason in rec.rationale:
            lines.append(f"  - {reason}")

    return "\n".join(lines)


def analyze_tickers(tickers: Sequence[str]) -> list[Recommendation]:
    recommendations: list[Recommendation] = []
    for ticker in tickers:
        bars = load_price_history(ticker)
        recommendation = make_recommendation(ticker, bars)
        recommendations.append(recommendation)
    return recommendations


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Gör en snabb teknisk analys av sample-aktier.",
    )
    parser.add_argument(
        "--ticker",
        "-t",
        action="append",
        help="Ange en eller flera tickers att analysera (t.ex. --ticker AAPL).",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="Lista alla tillgängliga tickers och avsluta.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)

    if args.list:
        tickers = available_tickers()
        if not tickers:
            print("Inga sample-data hittades.")
            return 0
        print("Tillgängliga tickers:")
        for ticker in tickers:
            print(f"  - {ticker}")
        return 0

    tickers = args.ticker or available_tickers()
    if not tickers:
        print("Ingen ticker angavs och sample-data saknas.")
        return 1

    recommendations = analyze_tickers(tickers)
    for rec in recommendations:
        print(_format_recommendation(rec))
        print("-" * 60)

    best = min(
        recommendations,
        key=lambda rec: (
            RATING_PRIORITY.get(rec.rating, len(RATING_PRIORITY)),
            -rec.indicators.roc_10 if rec.indicators else 0,
        ),
    )
    print("Bästa signal just nu:")
    print(f"  {best.ticker} - {best.rating}")
    return 0


if __name__ == "__main__":  # pragma: no cover - CLI entry point
    raise SystemExit(main())
