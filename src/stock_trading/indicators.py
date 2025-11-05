"""Common technical indicator calculations used by the application."""
from __future__ import annotations

from statistics import mean, pstdev
from typing import List, Sequence


def _validate_window(prices: Sequence[float], window: int) -> None:
    if window <= 0:
        raise ValueError("window must be positive")
    if len(prices) < window:
        raise ValueError("not enough data to compute the requested window")


def simple_moving_average(prices: Sequence[float], window: int) -> float:
    """Return the simple moving average for the last ``window`` prices."""

    _validate_window(prices, window)
    window_slice = prices[-window:]
    return float(mean(window_slice))


def exponential_moving_average(prices: Sequence[float], window: int) -> float:
    """Return the exponential moving average for the last ``window`` prices."""

    _validate_window(prices, window)
    multiplier = 2 / (window + 1)
    ema = prices[-window]
    for price in prices[-window + 1 :]:
        ema = (price - ema) * multiplier + ema
    return float(ema)


def rate_of_change(prices: Sequence[float], period: int) -> float:
    """Calculate the percentage price change between today and ``period`` days ago."""

    _validate_window(prices, period + 1)
    current_price = prices[-1]
    past_price = prices[-(period + 1)]
    return float(((current_price - past_price) / past_price) * 100)


def relative_strength_index(prices: Sequence[float], period: int = 14) -> float:
    """Compute the Relative Strength Index (RSI)."""

    _validate_window(prices, period + 1)
    gains: List[float] = []
    losses: List[float] = []

    for i in range(-period, 0):
        change = prices[i] - prices[i - 1]
        if change >= 0:
            gains.append(change)
            losses.append(0.0)
        else:
            gains.append(0.0)
            losses.append(abs(change))

    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period

    if avg_loss == 0:
        return 100.0

    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return float(rsi)


def rolling_volatility(prices: Sequence[float], window: int = 20) -> float:
    """Calculate the rolling volatility (standard deviation of returns)."""

    _validate_window(prices, window)
    recent_prices = prices[-window:]
    returns = []
    prev_price = recent_prices[0]
    for price in recent_prices[1:]:
        returns.append((price - prev_price) / prev_price)
        prev_price = price

    if not returns:
        return 0.0

    return float(pstdev(returns))


def support_resistance_levels(prices: Sequence[float], window: int = 5) -> tuple[float, float]:
    """Estimate short-term support and resistance levels using the last ``window`` closes."""

    _validate_window(prices, window)
    window_slice = prices[-window:]
    return float(min(window_slice)), float(max(window_slice))


__all__ = [
    "exponential_moving_average",
    "rate_of_change",
    "relative_strength_index",
    "rolling_volatility",
    "simple_moving_average",
    "support_resistance_levels",
]
