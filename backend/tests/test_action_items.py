import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.adapters.mock_action_items import update_mock_action_item


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    with TestClient(app) as test_client:
        yield test_client


def test_authorized_user_loads_and_saves_exact_text_target(client):
    items = client.get("/api/boards/project-1/items").json()
    item = next(item for item in items if item["id"] == 1)
    original_target = item["target"]
    text = "  Before job walk \n "

    try:
        response = client.patch(
            "/api/boards/project-1/items/1",
            json={"target": {"type": "text", "value": text}},
        )
        assert response.status_code == 200
        assert response.json()["target"] == {"type": "text", "value": text}
        assert client.get("/api/boards/project-1/items").json()[0]["target"] == {
            "type": "text",
            "value": text,
        }
    finally:
        update_mock_action_item("project-1", 1, target=original_target)


def test_date_target_is_saved_and_invalid_calendar_date_is_rejected(client):
    original = client.get("/api/boards/project-1/items").json()[1]["target"]
    try:
        response = client.patch(
            "/api/boards/project-1/items/2",
            json={"target": {"type": "date", "value": "2026-11-01"}},
        )
        assert response.status_code == 200
        assert response.json()["target"] == {
            "type": "date",
            "value": "2026-11-01",
        }

        invalid = client.patch(
            "/api/boards/project-1/items/2",
            json={"target": {"type": "date", "value": "2026-02-30"}},
        )
        assert invalid.status_code == 422
    finally:
        update_mock_action_item("project-1", 2, target=original)


def test_unauthorized_user_cannot_load_or_update_board_targets(client, monkeypatch):
    monkeypatch.setenv("MOCK_USER_ID", "user-2")

    assert client.get("/api/boards/project-1/items").status_code == 404
    assert client.patch(
        "/api/boards/project-1/items/1",
        json={"target": {"type": "text", "value": "Unauthorized edit"}},
    ).status_code == 404
