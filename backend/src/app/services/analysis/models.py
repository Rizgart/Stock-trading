from __future__ import annotations

from enum import Enum
from typing import List, Sequence

from pydantic import BaseModel, Field

from ..providers import Candle, Fundamentals, Quote


class RiskProfile(str, Enum):
    KONSERVATIV = "konservativ"
    BALANSERAD = "balanserad"
    AGGRESSIV = "aggressiv"


class SnapshotEntry(BaseModel):
    quote: Quote
    fundamentals: Fundamentals | None = None
    history: Sequence[Candle] = Field(default_factory=list)


class SnapshotRequest(BaseModel):
    symbols: List[str]
    profile: RiskProfile = RiskProfile.BALANSERAD
    limit: int = 10

    @property
    def normalized_symbols(self) -> List[str]:
        return [symbol.upper() for symbol in self.symbols]


class Recommendation(BaseModel):
    symbol: str
    name: str | None = None
    sector: str | None = None
    price: float
    change_pct: float
    score: float
    signal: str
    factors: List[str] = Field(default_factory=list)
    profile: RiskProfile
