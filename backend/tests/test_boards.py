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

# direct board urls must enforce the same rules as the board list
@pytest.mark.parametrize(
    "board_id",
    ["project-archived", "team-restricted", "does-not-exist"],
)

def test_direct_board_urls_do_not_bypass_access(client, board_id):
    response = client.get(f"/api/boards/{board_id}")
    assert response.status_code == 404
    assert response.json() == {"detail": "Board not found."}

def test_accessible_board_can_be_opened(client):
    response = client.get("/api/boards/project-2")
    assert response.status_code == 200
    assert response.json() == {"id": "project-2", "name": "Sample Office Renovation","type": "Project", "openItemCount": 12}

#  values supplied by browser cannot change the server-selected mock identity
def test_current_identity_comes_from_server_not_request(client):
    response = client.get("/api/me?user_id=user-2", headers={"X-User-Id": "user-2"})
    assert response.status_code == 200
    assert response.json() == {"id": "user-1"}
    restricted = client.get("/api/boards/team-restricted", headers={"X-User-Id": "user-2"})
    assert restricted.status_code == 404

def test_access_changes_apply_on_next_board_request(client, monkeypatch):
    assert client.get("/api/boards/project-1").status_code == 200
    monkeypatch.setenv("MOCK_USER_ID", "user-2")
    assert client.get("/api/boards/project-1").status_code == 404
    assert client.get("/api/me").json() == {"id": "user-2"}


@pytest.mark.parametrize("path", ["/api/me", "/api/boards/project-1"])
def test_all_new_endpoints_require_explicit_mock_mode(client, monkeypatch, path):
    monkeypatch.delenv("APP_MODE", raising=False)
    assert client.get(path).status_code == 503