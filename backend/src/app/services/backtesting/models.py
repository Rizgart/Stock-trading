from __future__ import annotations

from typing import Dict, List

from pydantic import BaseModel, Field

from ..analysis.models import RiskProfile


class BacktestRequest(BaseModel):
    symbols: List[str]
    period: str = "1y"
    profile: RiskProfile = RiskProfile.BALANSERAD

    def normalized_symbols(self) -> List[str]:
        return [symbol.upper() for symbol in self.symbols]


class SymbolBacktestResult(BaseModel):
    symbol: str
    cagr: float
    sharpe: float
    max_drawdown: float


class EquityPoint(BaseModel):
    timestamp: str
    value: float


class BacktestResult(BaseModel):
    profile: RiskProfile
    period: str
    symbols: List[SymbolBacktestResult]
    equity_curve: List[EquityPoint] = Field(default_factory=list)
    metrics: Dict[str, float] = Field(default_factory=dict)
