import pytest

from src.app.services.backtesting import BacktestRequest, run_backtest
from src.app.services.providers import Candle, MarketDataProvider, Quote


class DummyProvider(MarketDataProvider):
    async def list_tickers(self):
        return []

    async def get_quote(self, symbol: str):
        return Quote(symbol=symbol, price=100.0, change_pct=1.0)

    async def get_quotes(self, symbols):
        return [await self.get_quote(symbol) for symbol in symbols]

    async def get_history(self, symbol: str, period: str = "1y"):
        candles = []
        base_price = 100.0
        for day in range(200):
            close = base_price * (1 + 0.001 * day)
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


@pytest.mark.asyncio
async def test_run_backtest_returns_metrics():
    provider = DummyProvider()
    request = BacktestRequest(symbols=["AAA", "BBB"], period="1y")

    result = await run_backtest(provider, request)

    assert result.symbols
    assert "cagr" in result.metrics
    assert result.metrics["cagr"] > 0
