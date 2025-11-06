from __future__ import annotations

import math
from typing import List

import numpy as np
import pandas as pd

from ..providers import MarketDataProvider
from .models import BacktestRequest, BacktestResult, EquityPoint, SymbolBacktestResult
from ..analysis.indicators import candles_to_dataframe

TRADING_DAYS = 252
RISK_FREE_RATE = 0.005  # ~0.5% annual


def _cagr(series: pd.Series) -> float:
    if series.empty:
        return 0.0
    total_return = series.iloc[-1]
    n_periods = len(series)
    if n_periods <= 1:
        return 0.0
    try:
        return (1 + total_return) ** (TRADING_DAYS / n_periods) - 1
    except ValueError:
        return 0.0


def _sharpe(returns: pd.Series) -> float:
    if returns.empty:
        return 0.0
    excess = returns - (RISK_FREE_RATE / TRADING_DAYS)
    std = excess.std()
    if std == 0 or math.isnan(std):
        return 0.0
    return (excess.mean() * TRADING_DAYS) / std


def _max_drawdown(equity_curve: pd.Series) -> float:
    if equity_curve.empty:
        return 0.0
    cumulative = (1 + equity_curve).cumprod()
    drawdowns = cumulative / cumulative.cummax() - 1
    return float(drawdowns.min())


async def run_backtest(
    provider: MarketDataProvider,
    request: BacktestRequest,
) -> BacktestResult:
    symbols = request.normalized_symbols()
    symbol_results: List[SymbolBacktestResult] = []
    equity_values: List[pd.Series] = []

    for symbol in symbols:
        candles = await provider.get_history(symbol, period=request.period)
        df = candles_to_dataframe(candles)
        if df.empty:
            continue
        returns = df["close"].pct_change().dropna()
        if returns.empty:
            continue

        cumulative_returns = (1 + returns).cumprod() - 1
        equity_values.append(cumulative_returns)

        symbol_results.append(
            SymbolBacktestResult(
                symbol=symbol,
                cagr=float(_cagr(cumulative_returns)),
                sharpe=float(_sharpe(returns)),
                max_drawdown=float(_max_drawdown(returns)),
            )
        )

    if not equity_values:
        return BacktestResult(
            profile=request.profile,
            period=request.period,
            symbols=[],
            equity_curve=[],
            metrics={},
        )

    aligned = pd.concat(equity_values, axis=1).fillna(method="ffill").fillna(0.0)
    portfolio_returns = aligned.mean(axis=1)
    portfolio_equity = (1 + portfolio_returns).cumprod()
    equity_curve = [
        EquityPoint(timestamp=index.isoformat(), value=float(value))
        for index, value in portfolio_equity.items()
    ]

    metrics = {
        "cagr": float(_cagr(portfolio_equity - 1)),
        "sharpe": float(_sharpe(portfolio_returns)),
        "max_drawdown": float(_max_drawdown(portfolio_returns)),
    }

    return BacktestResult(
        profile=request.profile,
        period=request.period,
        symbols=symbol_results,
        equity_curve=equity_curve,
        metrics=metrics,
    )
