import pytest
from fastapi.testclient import TestClient

from src.app.api.deps import get_provider
from src.app.main import app
from src.app.services.providers import Candle, Fundamentals, MarketDataProvider, Quote, Ticker


class FakeProvider(MarketDataProvider):
    async def list_tickers(self):
        return [
            Ticker(symbol="AAA", name="Alpha", market="stocks"),
            Ticker(symbol="BBB", name="Beta", market="stocks"),
        ]

    async def get_quote(self, symbol: str):
        return Quote(symbol=symbol, price=100.0, change_pct=2.0)

    async def get_quotes(self, symbols):
        return [await self.get_quote(symbol) for symbol in symbols]

    async def get_history(self, symbol: str, period: str = "1y"):
        candles = []
        base_price = 95.0
        for day in range(250):
            close = base_price + day * 0.3
            candles.append(
                Candle(
                    timestamp=f"2023-01-01T{day:02d}:00:00Z",
                    open=close - 1,
                    high=close + 1,
                    low=close - 2,
                    close=close,
                    volume=2000.0 + day,
                )
            )
        return candles

    async def get_fundamentals(self, symbol: str):
        return Fundamentals(pe=10.0, growth_5y=12.0, beta=0.8, debt_to_equity=0.4)


@pytest.fixture()
def client() -> TestClient:
    app.dependency_overrides[get_provider] = lambda: FakeProvider()
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_rankings_endpoint_returns_recommendations(client: TestClient):
    response = client.get("/v1/rankings?symbols=AAA,BBB&profile=konservativ")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 2
    assert payload[0]["signal"] in {"BUY", "HOLD", "SELL"}
    assert payload[0]["profile"] == "konservativ"
