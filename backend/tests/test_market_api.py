import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.app.api.deps import get_provider
from src.app.main import app
from src.app.services.providers import (
    Candle,
    Fundamentals,
    MarketDataProvider,
    Quote,
    Ticker,
)


class FakeProvider(MarketDataProvider):
    def __init__(self) -> None:
        self.tickers = [
            Ticker(symbol="AAA", name="Alpha", market="stocks", currency="USD"),
            Ticker(symbol="BBB", name="Beta", market="stocks", currency="SEK"),
        ]

    async def list_tickers(self):
        return self.tickers

    async def get_quote(self, symbol: str):
        if symbol.upper() == "AAA":
            return Quote(symbol="AAA", price=100.0, change_pct=1.5, volume=1234)
        return None

    async def get_quotes(self, symbols):
        return [quote for quote in [await self.get_quote(s) for s in symbols] if quote]

    async def get_history(self, symbol: str, period: str = "1y"):
        if symbol.upper() != "AAA":
            return []
        return [
            Candle(
                timestamp="2024-01-01T00:00:00Z",
                open=1.0,
                high=2.0,
                low=0.5,
                close=1.5,
                volume=1000.0,
            )
        ]

    async def get_fundamentals(self, symbol: str):
        if symbol.upper() != "AAA":
            return None
        return Fundamentals(pe=10.0, ps=2.0, roe=15.0)


@pytest.fixture()
def client() -> TestClient:
    app.dependency_overrides[get_provider] = lambda: FakeProvider()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_list_tickers(client: TestClient):
    response = client.get("/v1/tickers")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["symbol"] == "AAA"


def test_get_quote(client: TestClient):
    response = client.get("/v1/quotes/AAA")
    assert response.status_code == 200
    data = response.json()
    assert data["price"] == 100.0


def test_get_quote_not_found(client: TestClient):
    response = client.get("/v1/quotes/XXX")
    assert response.status_code == 404


def test_get_history(client: TestClient):
    response = client.get("/v1/history/AAA?period=1y")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["close"] == 1.5


def test_get_fundamentals(client: TestClient):
    response = client.get("/v1/fundamentals/AAA")
    assert response.status_code == 200
    data = response.json()
    assert data["pe"] == 10.0
