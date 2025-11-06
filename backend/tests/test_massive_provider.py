import asyncio
from typing import Any, Dict

import pytest
import respx
from httpx import Response

from src.app.services.providers import MassiveProvider


def _massive_url(path: str) -> str:
    return f"https://api.massive.com/{path.lstrip('/')}"


@pytest.mark.asyncio
@respx.mock
async def test_list_tickers_handles_pagination():
    first_page = {
        "results": [
            {"ticker": "AAA", "name": "Alpha", "market": "stocks", "currency_name": "usd"},
        ],
        "next_url": _massive_url("v3/reference/tickers?cursor=abc"),
    }
    second_page = {
        "results": [
            {"ticker": "BBB", "name": "Beta", "market": "stocks", "currency_name": "sek"},
        ],
        "next_url": None,
    }

    respx.get(
        _massive_url("v3/reference/tickers"),
        params__contains={"apiKey": "test"},
    ).mock(return_value=Response(200, json=first_page))

    respx.get(
        _massive_url("v3/reference/tickers"),
        params__contains={"cursor": "abc", "apiKey": "test"},
    ).mock(return_value=Response(200, json=second_page))

    provider = MassiveProvider(api_key="test")
    try:
        tickers = await provider.list_tickers()
    finally:
        await provider.aclose()

    assert [ticker.symbol for ticker in tickers] == ["AAA", "BBB"]
    assert tickers[0].currency == "USD"
    assert tickers[1].currency == "SEK"


@pytest.mark.asyncio
@respx.mock
async def test_get_quote_uses_cache():
    payload = {
        "ticker": {
            "ticker": "AAA",
            "todaysChangePerc": 1.5,
            "day": {"c": 100.5, "v": 1234},
        }
    }

    route = respx.get(
        _massive_url("v2/snapshot/locale/us/markets/stocks/tickers/AAA"),
        params__contains={"apiKey": "test"},
    ).mock(return_value=Response(200, json=payload))

    provider = MassiveProvider(api_key="test")
    try:
        quote1 = await provider.get_quote("AAA")
        quote2 = await provider.get_quote("AAA")  # should hit cache
    finally:
        await provider.aclose()

    assert quote1 and quote1.price == 100.5
    assert quote2 and quote2.price == 100.5
    assert route.call_count == 1


@pytest.mark.asyncio
@respx.mock
async def test_get_history_maps_ohlc():
    aggs = {
        "results": [
            {"t": 1_700_000_000, "o": 1.0, "h": 2.0, "l": 0.5, "c": 1.5, "v": 1000.0},
        ]
    }

    respx.get(
        _massive_url("v2/aggs/ticker/AAA/range/1/day/2023-03-05/2024-03-04"),
        params__contains={"apiKey": "test"},
    ).mock(return_value=Response(200, json=aggs))

    provider = MassiveProvider(api_key="test")
    # Force deterministic range
    provider._resolve_range_params = lambda period: {  # type: ignore[attr-defined]
        "from": "2023-03-05",
        "to": "2024-03-04",
    }

    try:
        candles = await provider.get_history("AAA", period="1y")
    finally:
        await provider.aclose()

    assert len(candles) == 1
    candle = candles[0]
    assert candle.open == 1.0
    assert candle.close == 1.5
    assert candle.volume == 1000.0


@pytest.mark.asyncio
@respx.mock
async def test_get_fundamentals_pick_metrics():
    payload = {
        "results": [
            {
                "metrics": {"pe_ratio": 10.5, "beta": 0.9},
                "ratios": {"debt_to_equity": 0.4, "dividend_yield": 2.1},
            }
        ]
    }
    respx.get(
        _massive_url("v2/reference/financials/AAA"),
        params__contains={"apiKey": "test"},
    ).mock(return_value=Response(200, json=payload))

    provider = MassiveProvider(api_key="test")
    try:
        fundamentals = await provider.get_fundamentals("AAA")
        cached = await provider.get_fundamentals("AAA")
    finally:
        await provider.aclose()

    assert fundamentals and fundamentals.pe == 10.5
    assert fundamentals.debt_to_equity == 0.4
    assert cached == fundamentals
