import pytest
from fastapi.testclient import TestClient

from app.main import app

P1 = "/api/boards/project-1/columns"
P2 = "/api/boards/project-2/columns"

DEFAULT = [
    {"id": "item", "visible": True},
    {"id": "owners", "visible": True},
    {"id": "target", "visible": True},
    {"id": "status", "visible": True},
    {"id": "priority", "visible": True},
    {"id": "attention", "visible": True},
]

# Status first, Owners hidden.
CHOSEN = [
    {"id": "status", "visible": True},
    {"id": "item", "visible": True},
    {"id": "owners", "visible": False},
    {"id": "target", "visible": True},
    {"id": "priority", "visible": True},
    {"id": "attention", "visible": True},
]


@pytest.fixture
def client(monkeypatch):
    # user-1 can open project-1 and project-2. Each test starts with no saved layouts.
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    monkeypatch.setattr("app.adapters.mock_board_columns.MOCK_BOARD_COLUMNS", {})
    with TestClient(app) as test_client:
        yield test_client


def test_a_board_without_saved_settings_shows_every_column(client):
    response = client.get(P1)

    assert response.status_code == 200
    assert response.json() == {"columns": DEFAULT}


def test_saved_settings_are_loaded_when_the_board_is_reopened(client):
    assert client.put(P1, json={"columns": CHOSEN}).json() == {"columns": CHOSEN}

    assert client.get(P1).json() == {"columns": CHOSEN}


def test_settings_are_kept_separately_for_each_board(client):
    client.put(P1, json={"columns": CHOSEN})

    assert client.get(P2).json() == {"columns": DEFAULT}


def test_the_item_column_cannot_be_hidden(client):
    hidden_item = [{**c, "visible": False} if c["id"] == "item" else c for c in DEFAULT]

    response = client.put(P1, json={"columns": hidden_item})

    assert response.status_code == 422
    assert client.get(P1).json() == {"columns": DEFAULT}


@pytest.mark.parametrize(
    "columns",
    [
        DEFAULT[:-1],  # a column missing
        DEFAULT + [{"id": "owners", "visible": True}],  # a column twice
        DEFAULT + [{"id": "budget", "visible": True}],  # a custom column
        [],
    ],
)
def test_only_the_supported_columns_each_once_can_be_saved(client, columns):
    assert client.put(P1, json={"columns": columns}).status_code == 422
    assert client.get(P1).json() == {"columns": DEFAULT}


def test_a_rejected_save_keeps_the_last_saved_layout(client):
    client.put(P1, json={"columns": CHOSEN})

    client.put(P1, json={"columns": DEFAULT[:-1]})

    assert client.get(P1).json() == {"columns": CHOSEN}


def test_non_member_cannot_read_or_save_settings(client, monkeypatch):
    # user-2 is not a member of project-1.
    monkeypatch.setenv("MOCK_USER_ID", "user-2")

    assert client.get(P1).status_code == 404
    assert client.put(P1, json={"columns": CHOSEN}).status_code == 404

    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    assert client.get(P1).json() == {"columns": DEFAULT}


def test_unknown_user_cannot_use_settings(client, monkeypatch):
    monkeypatch.setenv("MOCK_USER_ID", "someone-else")

    assert client.get(P1).status_code == 401


def test_settings_are_off_outside_mock_mode(client, monkeypatch):
    monkeypatch.delenv("APP_MODE")

    assert client.get(P1).status_code == 503
