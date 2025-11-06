from typing import Any, Dict, List


class MassiveProviderStub:
    """Temporary stub for Massive API integration.

    This will be replaced with the real adapter that handles pagination,
    schema validation and caching as described in docs/backend_architecture.md.
    """

    async def list_tickers(self) -> List[Dict[str, Any]]:
        return [
            {
                "ticker": "AAA",
                "name": "Alpha AB",
                "market": "stocks",
                "locale": "us",
                "currency_name": "usd",
            }
        ]

    async def get_quote(self, ticker: str) -> Dict[str, Any]:
        return {
            "ticker": ticker,
            "price": 100.0,
            "change_pct": 0.5,
            "volume": 100_000,
        }
