
# AT-166: Automated tests for the Priority API
# Parent story: AT-70

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api import priorities
from app.adapters.mock_action_items import MockActionItemRepository


@pytest.fixture
def client(monkeypatch):
    # Use mock mode and a valid test user.
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("MOCK_USER_ID", "user-1")

    # Give each test its own fresh mock data.
    monkeypatch.setattr(
        priorities,
        "item_repository",
        MockActionItemRepository(),
    )

    with TestClient(app) as test_client:
        yield test_client


def test_get_priority_levels(client):
    response = client.get("/api/priorities")

    assert response.status_code == 200
    assert [level["name"] for level in response.json()] == [
        "High",
        "Medium",
        "Low",
    ]


def test_get_action_items(client):
    response = client.get("/api/boards/project-1/items")

    assert response.status_code == 200
    assert len(response.json()) == 2


def test_update_priority(client):
    response = client.patch(
        "/api/boards/project-1/items/1/priority",
        json={"priority": "Low"},
    )

    assert response.status_code == 200
    assert response.json()["priority"] == "Low"

    # Check that the change was saved in mock storage.
    saved = client.get("/api/boards/project-1/items")

    assert saved.status_code == 200
    assert saved.json()[0]["priority"] == "Low"


def test_sort_items(client):
    response = client.get(
        "/api/boards/project-1/items?sort=true"
    )

    assert response.status_code == 200
    priorities_list = [
        item["priority"] for item in response.json()
    ]
    assert priorities_list == ["High", "Medium"]


def test_filter_items(client):
    response = client.get(
        "/api/boards/project-1/items?priority=Medium"
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["priority"] == "Medium"


def test_invalid_filter(client):
    response = client.get(
        "/api/boards/project-1/items?priority=Urgent"
    )

    assert response.status_code == 422


def test_restricted_board(client):
    response = client.get(
        "/api/boards/team-restricted/items"
    )

    assert response.status_code == 403


def test_restricted_priority_update(client):
    response = client.patch(
        "/api/boards/team-restricted/items/1/priority",
        json={"priority": "High"},
    )

    assert response.status_code == 403


def test_invalid_priority(client):
    response = client.patch(
        "/api/boards/project-1/items/1/priority",
        json={"priority": "Urgent"},
    )

    assert response.status_code == 422


def test_missing_item(client):
    response = client.patch(
        "/api/boards/project-1/items/999/priority",
        json={"priority": "High"},
    )

    assert response.status_code == 404


def test_unrecognized_mock_user(client, monkeypatch):
    monkeypatch.setenv("MOCK_USER_ID", "unknown")

    response = client.get(
        "/api/boards/project-1/items"
    )

    assert response.status_code == 401


def test_mock_mode_required(client, monkeypatch):
    monkeypatch.delenv("APP_MODE", raising=False)

    response = client.get(
        "/api/boards/project-1/items"
    )

    assert response.status_code == 503


def test_failed_save(client, monkeypatch):
    def failed_save(board_id, item_id, priority):
        raise ValueError("Action item not found")

    monkeypatch.setattr(
        priorities.item_repository,
        "save_priority",
        failed_save,
    )

    response = client.patch(
        "/api/boards/project-1/items/1/priority",
        json={"priority": "High"},
    )

    assert response.status_code == 404
