import pytest
from fastapi.testclient import TestClient
from app.main import app

@pytest.fixture
def client(monkeypatch):
    # enables fictional data and identity only for these tests
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("MOCK_USER_ID", "user-1")

    with TestClient(app) as test_client:
        yield test_client

@pytest.mark.parametrize(
    "user_id, expected_ids",
    [
        ("user-1", {"project-1", "project-2", "team-1", "team-2"}),
        ("user-2", {"project-2", "team-2", "team-restricted"}),
        ("user-3", set()),
    ]
)

def test_returns_only_accessible_active_boards(client, monkeypatch, user_id, expected_ids):
    monkeypatch.setenv("MOCK_USER_ID", user_id)
    response = client.get("/api/boards")
    assert response.status_code == 200
    boards = response.json()
    assert {board["id"] for board in boards} == expected_ids
    assert len(boards) == len(expected_ids)


def test_returns_correct_summary_without_memberships(client):
    response = client.get("/api/boards")
    assert response.status_code == 200
    boards = response.json()
    assert boards[0] == {"id": "project-1", "name": "Sample Project", "type": "Project", "openItemCount": 5}

    for board in boards:
        assert set(board) == {"id", "name", "type", "openItemCount"}


def test_unknown_mock_user_is_rejected(client, monkeypatch):
    monkeypatch.setenv("MOCK_USER_ID", "unknown-user")
    response = client.get("/api/boards")
    assert response.status_code == 401


def test_mock_access_is_disabled_by_default(client, monkeypatch):
    monkeypatch.delenv("APP_MODE", raising=False)
    response = client.get("/api/boards")
    assert response.status_code == 503