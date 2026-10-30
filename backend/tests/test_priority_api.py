
# AT-166: Automated tests for the Priority API
# Parent story: AT-70
# Includes AT-70 + Action Items Table integration testing

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api import priorities
from app.adapters.mock_action_items import (
    MOCK_ACTION_ITEMS,
    MockActionItemRepository,
)


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
    response = client.get(
        "/api/boards/project-1/priorities"
    )

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
    saved = client.get(
        "/api/boards/project-1/priorities"
    )

    assert saved.status_code == 200
    assert saved.json()[0]["priority"] == "Low"


def test_sort_items(client):
    response = client.get(
        "/api/boards/project-1/priorities?sort=true"
    )

    assert response.status_code == 200

    priorities_list = [
        item["priority"] for item in response.json()
    ]

    assert priorities_list == ["High", "Medium"]


def test_filter_items(client):
    response = client.get(
        "/api/boards/project-1/priorities?priority=Medium"
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["priority"] == "Medium"


def test_invalid_filter(client):
    response = client.get(
        "/api/boards/project-1/priorities?priority=Urgent"
    )

    assert response.status_code == 422


def test_restricted_board(client):
    response = client.get(
        "/api/boards/team-restricted/priorities"
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
        "/api/boards/project-1/priorities"
    )

    assert response.status_code == 401


def test_mock_mode_required(client, monkeypatch):
    monkeypatch.delenv("APP_MODE", raising=False)

    response = client.get(
        "/api/boards/project-1/priorities"
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


# Integration test: Verify both backend APIs share priority changes.
def test_priority_shared_between_both_apis(client, monkeypatch):
    """Both APIs should see each other's saved priority changes."""

    # Use the same mock data that Saihaj's table API uses.
    monkeypatch.setattr(
        priorities,
        "item_repository",
        MockActionItemRepository(MOCK_ACTION_ITEMS),
    )

    item = MOCK_ACTION_ITEMS["project-1"][0]
    original_priority = item.priority

    try:
        # Step 1: Update priority through the AT-70 API.
        response = client.patch(
            "/api/boards/project-1/items/1/priority",
            json={"priority": "Low"},
        )

        assert response.status_code == 200
        assert response.json()["priority"] == "Low"

        # Step 2: Saihaj's Action Items API should see Low.
        response = client.get(
            "/api/boards/project-1/items"
        )

        assert response.status_code == 200
        assert response.json()[0]["priority"] == "Low"

        # Step 3: Update through Saihaj's shared PATCH API.
        response = client.patch(
            "/api/boards/project-1/items/1",
            json={"priority": "Medium"},
        )

        assert response.status_code == 200
        assert response.json()["priority"] == "Medium"

        # Step 4: Your AT-70 API should see Medium.
        response = client.get(
            "/api/boards/project-1/priorities"
        )

        assert response.status_code == 200
        assert response.json()[0]["priority"] == "Medium"

    finally:
        # Restore shared mock data for other tests.
        item.priority = original_priority
