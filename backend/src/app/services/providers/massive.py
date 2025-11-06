from __future__ import annotations

import asyncio
import calendar
import time
from typing import Any, Dict, Iterable, List, Sequence
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import httpx
from pydantic import BaseModel, Field, ValidationError, field_validator

from .base import Candle, Fundamentals, MarketDataProvider, Quote, Ticker

DEFAULT_BASE_URL = "https://api.massive.com"
DEFAULT_RATE_LIMIT_INTERVAL = 0.25  # seconds
DEFAULT_MAX_RETRIES = 3

QUOTE_TTL_SECONDS = 30
FUNDAMENTALS_TTL_SECONDS = 24 * 60 * 60
UNIVERSE_TTL_SECONDS = 60 * 60


class MassiveTickerReference(BaseModel):
    ticker: str
    name: str | None = None
    market: str | None = None
    locale: str | None = None
    primary_exchange: str | None = Field(default=None, alias="primary_exchange")
    type: str | None = None
    active: bool | None = None
    currency_name: str | None = None

    @field_validator("ticker")
    @classmethod
    def validate_symbol(cls, value: str) -> str:
        return value.strip().upper()


class MassiveTickerListResponse(BaseModel):
    results: List[MassiveTickerReference] = Field(default_factory=list)
    next_url: str | None = None


class MassiveSnapshotTicker(BaseModel):
    ticker: str
    todaysChangePerc: float | None = None
    day: Dict[str, Any] | None = None
    lastTrade: Dict[str, Any] | None = None


class MassiveSnapshotResponse(BaseModel):
    tickers: List[MassiveSnapshotTicker] = Field(default_factory=list)


class MassiveAggRecord(BaseModel):
    t: int
    o: float | None = None
    h: float | None = None
    l: float | None = None
    c: float | None = None
    v: float | None = None


class MassiveAggsResponse(BaseModel):
    results: List[MassiveAggRecord] = Field(default_factory=list)


class MassiveFinancialRecord(BaseModel):
    metrics: Dict[str, Any] = Field(default_factory=dict)
    ratios: Dict[str, Any] = Field(default_factory=dict)


class MassiveFinancialsResponse(BaseModel):
    results: List[MassiveFinancialRecord] = Field(default_factory=list)


class TTLCache:
    """Very small in-memory TTL cache suitable for async contexts."""

    def __init__(self, ttl_seconds: float):
        self.ttl = ttl_seconds
        self._store: Dict[str, tuple[float, Any]] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Any | None:
        async with self._lock:
            entry = self._store.get(key)
            if not entry:
                return None
            expires_at, value = entry
            if expires_at < time.monotonic():
                self._store.pop(key, None)
                return None
            return value

    async def set(self, key: str, value: Any) -> None:
        async with self._lock:
            self._store[key] = (time.monotonic() + self.ttl, value)


class RateLimiter:
    def __init__(self, min_interval: float):
        self.min_interval = min_interval
        self._lock = asyncio.Lock()
        self._last_call = 0.0

    async def wait(self) -> None:
        async with self._lock:
            elapsed = time.monotonic() - self._last_call
            wait_time = self.min_interval - elapsed
            if wait_time > 0:
                await asyncio.sleep(wait_time)
            self._last_call = time.monotonic()


class MassiveProvider(MarketDataProvider):
    """Async Massive API provider with basic caching & rate limiting."""

    def __init__(
        self,
        api_key: str,
        *,
        base_url: str = DEFAULT_BASE_URL,
        rate_limit_interval: float = DEFAULT_RATE_LIMIT_INTERVAL,
        max_retries: int = DEFAULT_MAX_RETRIES,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        if not api_key:
            raise ValueError("api_key is required")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self._client = client or httpx.AsyncClient(timeout=10.0)
        self._owns_client = client is None
        self._rate_limiter = RateLimiter(rate_limit_interval)
        self._max_retries = max_retries

        self._quote_cache = TTLCache(QUOTE_TTL_SECONDS)
        self._fundamentals_cache = TTLCache(FUNDAMENTALS_TTL_SECONDS)
        self._universe_cache = TTLCache(UNIVERSE_TTL_SECONDS)

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def list_tickers(self) -> List[Ticker]:
        cached = await self._universe_cache.get("universe")
        if cached is not None:
            return cached

        tickers: List[Ticker] = []
        next_url: str | None = "v3/reference/tickers"

        while next_url:
            payload = await self._fetch_json(next_url, params={"market": "stocks", "active": "true"})
            data = MassiveTickerListResponse.model_validate(payload)
            for item in data.results:
                tickers.append(
                    Ticker(
                        symbol=item.ticker,
                        name=item.name,
                        market=item.market,
                        exchange=item.primary_exchange,
                        currency=item.currency_name.upper() if item.currency_name else None,
                    )
                )
            next_url = data.next_url

        await self._universe_cache.set("universe", tickers)
        return tickers

    async def get_quote(self, symbol: str) -> Quote | None:
        symbol = symbol.upper()
        cached = await self._quote_cache.get(symbol)
        if cached:
            return cached

        payload = await self._fetch_json(
            f"v2/snapshot/locale/us/markets/stocks/tickers/{symbol}",
            params=None,
        )
        # Snapshot endpoint returns single ticker under "ticker"
        if "ticker" not in payload:
            return None

        snapshot = MassiveSnapshotTicker.model_validate(payload["ticker"])
        price = self._resolve_price(snapshot)
        if price is None:
            return None

        quote = Quote(
            symbol=symbol,
            price=price,
            change_pct=(snapshot.todaysChangePerc or 0.0),
            volume=int(self._resolve_volume(snapshot) or 0),
        )
        await self._quote_cache.set(symbol, quote)
        return quote

    async def get_quotes(self, symbols: Sequence[str]) -> List[Quote]:
        results: List[Quote] = []
        for symbol in symbols:
            quote = await self.get_quote(symbol)
            if quote:
                results.append(quote)
        return results

    async def get_history(self, symbol: str, period: str = "1y") -> List[Candle]:
        params = self._resolve_range_params(period)
        payload = await self._fetch_json(
            f"v2/aggs/ticker/{symbol.upper()}/range/1/day/{params['from']}/{params['to']}",
            params={"adjusted": "true", "sort": "asc", "limit": 5000},
        )
        data = MassiveAggsResponse.model_validate(payload)
        candles = [
            Candle(
                timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.t)),
                open=record.o or 0.0,
                high=record.h or 0.0,
                low=record.l or 0.0,
                close=record.c or 0.0,
                volume=record.v or 0.0,
            )
            for record in data.results
        ]
        return candles

    async def get_fundamentals(self, symbol: str) -> Fundamentals | None:
        symbol = symbol.upper()
        cached = await self._fundamentals_cache.get(symbol)
        if cached:
            return cached

        payload = await self._fetch_json(
            f"v2/reference/financials/{symbol}",
            params={"limit": 1},
        )
        data = MassiveFinancialsResponse.model_validate(payload)
        if not data.results:
            return None

        record = data.results[0]
        metrics = record.metrics
        ratios = record.ratios

        fundamentals = Fundamentals(
            pe=self._pick(metrics, ratios, "pe_ratio"),
            ps=self._pick(metrics, ratios, "price_to_sales_ratio"),
            roe=self._pick(metrics, ratios, "return_on_equity"),
            debt_to_equity=self._pick(metrics, ratios, "debt_to_equity"),
            growth_5y=self._pick(metrics, ratios, "revenue_growth_five_year"),
            profit_margin=self._pick(metrics, ratios, "net_profit_margin"),
            beta=self._pick(metrics, ratios, "beta"),
            dividend_yield=self._pick(metrics, ratios, "dividend_yield"),
        )

        await self._fundamentals_cache.set(symbol, fundamentals)
        return fundamentals

    async def _fetch_json(
        self,
        path_or_url: str,
        params: Dict[str, Any] | None,
    ) -> Dict[str, Any]:
        attempt = 0
        last_error: Exception | None = None
        while attempt < self._max_retries:
            attempt += 1
            await self._rate_limiter.wait()
            url = self._build_url(path_or_url, params)
            try:
                response = await self._client.get(url)
            except (httpx.RequestError, httpx.TimeoutException) as exc:
                last_error = exc
                await asyncio.sleep(0.2 * attempt)
                continue

            if response.status_code == 429:
                retry_after = float(response.headers.get("Retry-After", "0.5"))
                await asyncio.sleep(max(retry_after, DEFAULT_RATE_LIMIT_INTERVAL))
                continue

            if response.status_code >= 500:
                await asyncio.sleep(0.2 * attempt)
                last_error = httpx.HTTPStatusError(
                    "Server error", request=response.request, response=response
                )
                continue

            response.raise_for_status()
            try:
                data = response.json()
            except ValueError as exc:
                raise ValueError(f"Invalid JSON payload from Massive API: {exc}") from exc

            if not isinstance(data, dict):
                raise TypeError("Expected Massive API to return an object")
            return data

        if last_error:
            raise last_error
        raise RuntimeError("Failed to fetch data from Massive API")

    def _build_url(self, path_or_url: str, params: Dict[str, Any] | None) -> str:
        if path_or_url.startswith("http"):
            url = path_or_url
        else:
            url = f"{self.base_url}/{path_or_url.lstrip('/')}"

        parsed = urlparse(url)
        query = dict(parse_qsl(parsed.query, keep_blank_values=True))
        if params:
            for key, value in params.items():
                if value is not None:
                    query[key] = str(value)
        query.setdefault("apiKey", self.api_key)
        new_query = urlencode(query)
        rebuilt = parsed._replace(query=new_query)
        return urlunparse(rebuilt)

    def _resolve_price(self, snapshot: MassiveSnapshotTicker) -> float | None:
        if snapshot.lastTrade and snapshot.lastTrade.get("p"):
            return float(snapshot.lastTrade["p"])
        if snapshot.day and snapshot.day.get("c"):
            return float(snapshot.day["c"])
        return None

    def _resolve_volume(self, snapshot: MassiveSnapshotTicker) -> float | None:
        if snapshot.day and snapshot.day.get("v"):
            return float(snapshot.day["v"])
        return None

    def _resolve_range_params(self, period: str) -> Dict[str, str]:
        now_struct = time.gmtime()
        end = time.strftime("%Y-%m-%d", now_struct)

        period_map: Dict[str, int] = {
            "1m": 30,
            "3m": 90,
            "6m": 180,
            "1y": 365,
            "3y": 365 * 3,
            "5y": 365 * 5,
            "10y": 365 * 10,
            "max": 365 * 15,
        }
        days = period_map.get(period, 365)
        start_ts = calendar.timegm(now_struct) - days * 24 * 60 * 60
        start_struct = time.gmtime(start_ts)
        start = time.strftime("%Y-%m-%d", start_struct)
        return {"from": start, "to": end}

    def _pick(self, metrics: Dict[str, Any], ratios: Dict[str, Any], key: str) -> float | None:
        value = metrics.get(key) if metrics else None
        if value is None and ratios:
            value = ratios.get(key)
        if value is None:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None
