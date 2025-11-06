import pytest
from httpx import AsyncClient

from src.app.main import app


@pytest.mark.asyncio
async def test_health_endpoint_returns_ok():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/health")

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["version"] == "0.1.0"
