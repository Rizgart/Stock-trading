import pytest
from fastapi.testclient import TestClient

from src.app.main import app


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_create_and_list_alerts(client: TestClient):
    payload = {
        "symbol": "AAA",
        "rule": {"price": {"operator": ">=", "target": 120}},
        "channels": ["in_app"],
    }
    response = client.post("/v1/alerts", json=payload)
    assert response.status_code == 201
    created = response.json()
    assert created["symbol"] == "AAA"
    assert created["active"] is True

    list_response = client.get("/v1/alerts")
    assert list_response.status_code == 200
    alerts = list_response.json()
    assert len(alerts) >= 1


def test_update_alert(client: TestClient):
    payload = {
        "symbol": "BBB",
        "rule": {"price": {"operator": "<=", "target": 80}},
        "channels": ["desktop_push"],
    }
    created = client.post("/v1/alerts", json=payload).json()

    update_response = client.patch(
        f"/v1/alerts/{created['id']}",
        json={"active": False},
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["active"] is False


def test_delete_alert(client: TestClient):
    payload = {
        "symbol": "CCC",
        "rule": {"price": {"operator": ">=", "target": 50}},
        "channels": ["email"],
    }
    created = client.post("/v1/alerts", json=payload).json()
    delete_response = client.delete(f"/v1/alerts/{created['id']}")
    assert delete_response.status_code == 204
