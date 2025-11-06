from fastapi import APIRouter, Depends, HTTPException, status

from ..deps import get_provider
from ...services.backtesting import BacktestRequest, BacktestResult, run_backtest
from ...services.providers import MarketDataProvider


router = APIRouter()


@router.post(
    "/backtests",
    response_model=BacktestResult,
    summary="Run equal-weight backtest for selected tickers",
)
async def create_backtest(
    payload: BacktestRequest,
    provider: MarketDataProvider = Depends(get_provider),
) -> BacktestResult:
    if not payload.symbols:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one symbol must be provided",
        )

    result = await run_backtest(provider, payload)
    return result
