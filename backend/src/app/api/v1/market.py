from typing import List

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pydantic import BaseModel

from ..deps import get_provider
from ...services.providers import Candle, Fundamentals, MarketDataProvider, Quote, Ticker


class TickerResponse(BaseModel):
    symbol: str
    name: str | None = None
    market: str | None = None
    exchange: str | None = None
    currency: str | None = None

    @classmethod
    def from_model(cls, ticker: Ticker) -> "TickerResponse":
        return cls(
            symbol=ticker.symbol,
            name=ticker.name,
            market=ticker.market,
            exchange=ticker.exchange,
            currency=ticker.currency,
        )


class QuoteResponse(BaseModel):
    symbol: str
    price: float
    change_pct: float
    volume: int | None = None
    currency: str | None = None

    @classmethod
    def from_model(cls, quote: Quote) -> "QuoteResponse":
        return cls(
            symbol=quote.symbol,
            price=quote.price,
            change_pct=quote.change_pct,
            volume=quote.volume,
            currency=quote.currency,
        )


class CandleResponse(BaseModel):
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    volume: float

    @classmethod
    def from_model(cls, candle: Candle) -> "CandleResponse":
        return cls(
            timestamp=candle.timestamp,
            open=candle.open,
            high=candle.high,
            low=candle.low,
            close=candle.close,
            volume=candle.volume,
        )


class FundamentalsResponse(BaseModel):
    pe: float | None = None
    ps: float | None = None
    roe: float | None = None
    debt_to_equity: float | None = None
    growth_5y: float | None = None
    profit_margin: float | None = None
    beta: float | None = None
    dividend_yield: float | None = None

    @classmethod
    def from_model(cls, fundamentals: Fundamentals) -> "FundamentalsResponse":
        return cls(**fundamentals.model_dump())


router = APIRouter()


@router.get("/tickers", response_model=List[TickerResponse], summary="List tradable tickers")
async def list_tickers(provider: MarketDataProvider = Depends(get_provider)) -> List[TickerResponse]:
    tickers = await provider.list_tickers()
    return [TickerResponse.from_model(ticker) for ticker in tickers]


@router.get("/quotes/{symbol}", response_model=QuoteResponse, summary="Get latest quote")
async def get_quote(
    symbol: str = Path(..., description="Ticker symbol, e.g. AAPL"),
    provider: MarketDataProvider = Depends(get_provider),
) -> QuoteResponse:
    quote = await provider.get_quote(symbol)
    if not quote:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No quote found for {symbol}",
        )
    return QuoteResponse.from_model(quote)


@router.get(
    "/history/{symbol}",
    response_model=List[CandleResponse],
    summary="Get historical candles",
)
async def get_history(
    symbol: str = Path(..., description="Ticker symbol, e.g. AAPL"),
    period: str = Query("1y", description="Period: 1m,3m,6m,1y,3y,5y,10y,max"),
    provider: MarketDataProvider = Depends(get_provider),
) -> List[CandleResponse]:
    candles = await provider.get_history(symbol, period=period)
    return [CandleResponse.from_model(candle) for candle in candles]


@router.get(
    "/fundamentals/{symbol}",
    response_model=FundamentalsResponse,
    summary="Get fundamental snapshot",
)
async def get_fundamentals(
    symbol: str = Path(..., description="Ticker symbol, e.g. AAPL"),
    provider: MarketDataProvider = Depends(get_provider),
) -> FundamentalsResponse:
    fundamentals = await provider.get_fundamentals(symbol)
    if fundamentals is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No fundamentals found for {symbol}",
        )
    return FundamentalsResponse.from_model(fundamentals)
