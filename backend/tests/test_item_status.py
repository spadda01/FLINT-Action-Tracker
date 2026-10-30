import pytest
from fastapi.testclient import TestClient

from app.api.item_status import get_status_service
from app.db.item_status_repository import (
    InMemoryActionItemStore,
    InMemoryStatusHistoryStore,
)
from app.main import app
from app.services.status_service import DEFAULT_STATUSES, StatusService


class FakeClock:
    def __init__(self):
        self.calls = 0

    def __call__(self):
        self.calls += 1
        return f"2026-10-28T10:00:0{self.calls}+00:00"


@pytest.fixture
def client(monkeypatch):
    # Mock identity is user-1, who can open project-1, project-2 and team-1.
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("MOCK_USER_ID", "user-1")

    # A fresh store per test so changes don't leak between tests.
    service = StatusService(
        InMemoryActionItemStore(), InMemoryStatusHistoryStore(), now=FakeClock()
    )
    app.dependency_overrides[get_status_service] = lambda: service
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def change(client, board_id, item_id, status):
    return client.patch(
        f"/api/boards/{board_id}/items/{item_id}/status", json={"status": status}
    )


def history(client, board_id, item_id):
    return client.get(f"/api/boards/{board_id}/items/{item_id}/history")


# --- Status list ---

def test_board_status_list_is_the_six_defaults_in_order(client):
    response = client.get("/api/boards/project-1/statuses")

    assert response.status_code == 200
    assert response.json() == [
        "Open",
        "Not Started",
        "In Progress",
        "Scheduled",
        "Outstanding",
        "Complete",
    ]


# --- Saving a status ---

def test_change_status_saves_the_new_status(client):
    response = change(client, "project-1", 2, "Scheduled")

    assert response.status_code == 200
    body = response.json()
    assert body["item"] == {
        "id": 2,
        "boardId": "project-1",
        "title": "Confirm material delivery",
        "status": "Scheduled",
    }


def test_change_records_actor_time_old_and_new_status(client):
    response = change(client, "project-1", 2, "Scheduled")

    assert response.json()["change"] == {
        "itemId": 2,
        "boardId": "project-1",
        "actorId": "user-1",
        "changedAt": "2026-10-28T10:00:01+00:00",
        "oldStatus": "Not Started",
        "newStatus": "Scheduled",
    }


def test_every_change_is_kept_in_history_newest_first(client):
    change(client, "project-1", 1, "Scheduled")
    change(client, "project-1", 1, "Outstanding")
    change(client, "project-1", 1, "Complete")

    response = history(client, "project-1", 1)

    assert response.status_code == 200
    entries = response.json()
    assert [(e["oldStatus"], e["newStatus"]) for e in entries] == [
        ("Outstanding", "Complete"),
        ("Scheduled", "Outstanding"),
        ("In Progress", "Scheduled"),
    ]
    assert [e["changedAt"] for e in entries] == [
        "2026-10-28T10:00:03+00:00",
        "2026-10-28T10:00:02+00:00",
        "2026-10-28T10:00:01+00:00",
    ]


def test_history_records_which_user_made_each_change(client, monkeypatch):
    change(client, "project-2", 3, "In Progress")
    monkeypatch.setenv("MOCK_USER_ID", "user-2")
    change(client, "project-2", 3, "Complete")

    actors = [e["actorId"] for e in history(client, "project-2", 3).json()]

    assert actors == ["user-2", "user-1"]


@pytest.mark.parametrize("status", DEFAULT_STATUSES)
def test_every_default_status_can_be_saved(client, status):
    response = change(client, "team-1", 4, status)

    assert response.status_code == 200
    assert response.json()["item"]["status"] == status


def test_same_status_again_changes_nothing_and_adds_no_history(client):
    response = change(client, "project-1", 1, "In Progress")

    assert response.status_code == 200
    assert response.json()["change"] is None
    assert history(client, "project-1", 1).json() == []


def test_status_is_trimmed(client):
    response = change(client, "project-1", 2, "  Complete  ")

    assert response.status_code == 200
    assert response.json()["item"]["status"] == "Complete"


def test_history_is_kept_per_item(client):
    change(client, "project-1", 1, "Complete")

    assert history(client, "project-1", 2).json() == []
    assert len(history(client, "project-1", 1).json()) == 1


def test_team_boards_support_status_changes(client):
    response = change(client, "team-1", 4, "In Progress")

    assert response.status_code == 200
    assert history(client, "team-1", 4).json()[0]["newStatus"] == "In Progress"


# --- Invalid input ---

@pytest.mark.parametrize("status", ["", "   "])
def test_status_is_required(client, status):
    response = change(client, "project-1", 1, status)

    assert response.status_code == 422
    assert response.json() == {"errors": {"status": "Status is required."}}


def test_missing_status_field_is_reported(client):
    response = client.patch("/api/boards/project-1/items/1/status", json={})

    assert response.status_code == 422
    assert response.json() == {"errors": {"status": "Status is required."}}


@pytest.mark.parametrize("status", ["Done", "complete", "On Hold"])
def test_unknown_status_is_rejected(client, status):
    response = change(client, "project-1", 1, status)

    assert response.status_code == 422
    assert "is not a status on this board" in response.json()["errors"]["status"]


def test_rejected_change_saves_nothing(client):
    change(client, "project-1", 1, "Done")

    assert history(client, "project-1", 1).json() == []
    assert change(client, "project-1", 1, "In Progress").json()["change"] is None


# --- Missing items ---

def test_unknown_item_returns_404(client):
    assert change(client, "project-1", 999, "Complete").status_code == 404
    assert history(client, "project-1", 999).status_code == 404


def test_item_from_another_board_returns_404(client):
    # Item 3 belongs to project-2, not project-1.
    assert change(client, "project-1", 3, "Complete").status_code == 404


# --- Access ---

@pytest.mark.parametrize("board_id", ["team-restricted", "project-archived", "does-not-exist"])
def test_boards_the_user_cannot_open_are_hidden(client, board_id):
    assert change(client, board_id, 1, "Complete").status_code == 404
    assert history(client, board_id, 1).status_code == 404
    assert client.get(f"/api/boards/{board_id}/statuses").status_code == 404


def test_non_member_cannot_change_status(client, monkeypatch):
    # user-2 is not a member of project-1.
    monkeypatch.setenv("MOCK_USER_ID", "user-2")

    response = change(client, "project-1", 1, "Complete")

    assert response.status_code == 404
    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    assert history(client, "project-1", 1).json() == []


def test_unknown_user_is_rejected(client, monkeypatch):
    monkeypatch.setenv("MOCK_USER_ID", "someone-else")

    assert change(client, "project-1", 1, "Complete").status_code == 401


def test_status_api_is_off_outside_mock_mode(client, monkeypatch):
    monkeypatch.delenv("APP_MODE", raising=False)

    assert change(client, "project-1", 1, "Complete").status_code == 503
