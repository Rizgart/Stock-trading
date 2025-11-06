from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from ..deps import get_provider
from ...services.analysis import Recommendation, RiskProfile, SnapshotRequest, build_recommendations
from ...services.providers import MarketDataProvider


class RankingResponse(BaseModel):
    symbol: str
    price: float
    change_pct: float
    score: float
    signal: str
    factors: List[str] = Field(default_factory=list)
    profile: RiskProfile

    @classmethod
    def from_model(cls, recommendation: Recommendation) -> "RankingResponse":
        return cls(**recommendation.model_dump())


router = APIRouter()


@router.get(
    "/rankings",
    response_model=List[RankingResponse],
    summary="Build recommendation ranking",
)
async def get_rankings(
    symbols: Optional[str] = Query(None, description="Comma-separated list of tickers"),
    profile: RiskProfile = Query(RiskProfile.BALANSERAD),
    limit: int = Query(10, ge=1, le=100),
    provider: MarketDataProvider = Depends(get_provider),
) -> List[RankingResponse]:
    request = SnapshotRequest(
        symbols=symbols.split(",") if symbols else [],
        profile=profile,
        limit=limit,
    )
    recommendations = await build_recommendations(provider, request)
    return [RankingResponse.from_model(rec) for rec in recommendations]
