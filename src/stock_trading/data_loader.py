"""Utilities for loading sample stock price data."""
from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Iterable, List


@dataclass(frozen=True)
class PriceBar:
    """Represents the OHLCV data for a single trading day."""

    date: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int


def _project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def data_directory(path: Path | None = None) -> Path:
    """Return the directory that contains sample price data."""

    if path is not None:
        return path
    return _project_root() / "data"


def available_tickers(directory: Path | None = None) -> List[str]:
    """List all tickers that have sample data available."""

    data_dir = data_directory(directory)
    if not data_dir.exists():
        return []
    return sorted(p.stem.upper() for p in data_dir.glob("*.csv") if p.is_file())


def load_price_history(ticker: str, directory: Path | None = None) -> List[PriceBar]:
    """Load daily OHLCV bars for ``ticker`` from the sample dataset."""

    normalized_ticker = ticker.upper()
    file_path = data_directory(directory) / f"{normalized_ticker}.csv"
    if not file_path.exists():
        raise FileNotFoundError(f"No data found for ticker '{normalized_ticker}' at {file_path}")

    bars: List[PriceBar] = []
    with file_path.open("r", encoding="utf-8") as fp:
        reader = csv.DictReader(fp)
        for row in reader:
            bars.append(
                PriceBar(
                    date=datetime.strptime(row["Date"], "%Y-%m-%d"),
                    open=float(row["Open"]),
                    high=float(row["High"]),
                    low=float(row["Low"]),
                    close=float(row["Close"]),
                    volume=int(row["Volume"]),
                )
            )

    bars.sort(key=lambda bar: bar.date)
    return bars


def latest_close(bars: Iterable[PriceBar]) -> float:
    """Return the most recent closing price in ``bars``."""

    last_bar = None
    for bar in bars:
        last_bar = bar
    if last_bar is None:
        raise ValueError("Price history is empty")
    return last_bar.close


__all__ = [
    "PriceBar",
    "available_tickers",
    "data_directory",
    "latest_close",
    "load_price_history",
]
