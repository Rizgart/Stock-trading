import pytest

from src.app.services.analysis import RiskProfile, SnapshotRequest, build_recommendations
from src.app.services.providers import Candle, Fundamentals, MarketDataProvider, Quote, Ticker


class DummyProvider(MarketDataProvider):
    async def list_tickers(self):
        return [
            Ticker(symbol="AAA", name="Alpha", market="stocks"),
            Ticker(symbol="BBB", name="Beta", market="stocks"),
        ]

    async def get_quote(self, symbol: str):
        return Quote(symbol=symbol, price=100.0, change_pct=1.0)

    async def get_quotes(self, symbols):
        return [await self.get_quote(symbol) for symbol in symbols]

    async def get_history(self, symbol: str, period: str = "1y"):
        candles = []
        base_price = 90.0 if symbol == "AAA" else 80.0
        for day in range(250):
            close = base_price + day * 0.2
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
        return Fundamentals(pe=12.0, growth_5y=15.0, beta=0.9, debt_to_equity=0.5)


@pytest.mark.asyncio
async def test_build_recommendations_returns_sorted_results():
    provider = DummyProvider()
    request = SnapshotRequest(symbols=["AAA", "BBB"], profile=RiskProfile.KONSERVATIV, limit=2)

    results = await build_recommendations(provider, request)

    assert len(results) == 2
    assert all(result.profile == RiskProfile.KONSERVATIV for result in results)
    assert results[0].score >= results[1].score
