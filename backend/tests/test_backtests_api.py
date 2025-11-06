import pytest
from fastapi.testclient import TestClient

from src.app.api.deps import get_provider
from src.app.main import app
from src.app.services.providers import Candle, MarketDataProvider, Quote


class FakeBacktestProvider(MarketDataProvider):
    async def list_tickers(self):
        return []

    async def get_quote(self, symbol: str):
        return Quote(symbol=symbol, price=100.0, change_pct=1.0)

    async def get_quotes(self, symbols):
        return [await self.get_quote(symbol) for symbol in symbols]

    async def get_history(self, symbol: str, period: str = "1y"):
        candles = []
        base_price = 90.0
        for day in range(100):
            close = base_price + day * 0.5
            candles.append(
                Candle(
                    timestamp=f"2023-01-01T{day:02d}:00:00Z",
                    open=close - 1,
                    high=close + 1,
                    low=close - 2,
                    close=close,
                    volume=1000.0 + day,
                )
            )
        return candles

    async def get_fundamentals(self, symbol: str):
        return None


@pytest.fixture()
def client() -> TestClient:
    app.dependency_overrides[get_provider] = lambda: FakeBacktestProvider()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_backtest_endpoint_returns_result(client: TestClient):
    response = client.post("/v1/backtests", json={"symbols": ["AAA", "BBB"], "period": "1y"})
    assert response.status_code == 200
    payload = response.json()
    assert payload["symbols"]
    assert payload["metrics"]["cagr"] >= -1


def test_backtest_requires_symbols(client: TestClient):
    response = client.post("/v1/backtests", json={"symbols": []})
    assert response.status_code == 400
