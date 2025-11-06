from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, List, Sequence

from pydantic import BaseModel


class Ticker(BaseModel):
    symbol: str
    name: str | None = None
    market: str | None = None
    exchange: str | None = None
    currency: str | None = None


class Quote(BaseModel):
    symbol: str
    price: float
    change_pct: float
    volume: int | None = None
    currency: str | None = None


class Candle(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float


class Fundamentals(BaseModel):
    pe: float | None = None
    ps: float | None = None
    roe: float | None = None
    debt_to_equity: float | None = None
    growth_5y: float | None = None
    profit_margin: float | None = None
    beta: float | None = None
    dividend_yield: float | None = None


class MarketDataProvider(ABC):
    """Abstract base class for market data providers."""

    @abstractmethod
    async def list_tickers(self) -> List[Ticker]:
        ...

    @abstractmethod
    async def get_quote(self, symbol: str) -> Quote | None:
        ...

    @abstractmethod
    async def get_quotes(self, symbols: Sequence[str]) -> List[Quote]:
        ...

    @abstractmethod
    async def get_history(self, symbol: str, period: str = "1y") -> List[Candle]:
        ...

    @abstractmethod
    async def get_fundamentals(self, symbol: str) -> Fundamentals | None:
        ...

    async def aclose(self) -> None:
        """Cleanup hook (optional)."""
        return None
