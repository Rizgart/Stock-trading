from fastapi import Depends, HTTPException, status
from fastapi import Request

from ..services.providers import MarketDataProvider


def get_provider(request: Request) -> MarketDataProvider:
    provider = getattr(request.app.state, "provider", None)
    if provider is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Market data provider is not configured",
        )
    return provider
