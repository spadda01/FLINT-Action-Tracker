import pytest
from fastapi.testclient import TestClient

from app.adapters.mock_employees import MockEmployeeService
from app.adapters.mock_groups import MockGroupService
from app.api.boards import get_board_service
from app.db.board_repository import InMemoryBoardRepository
from app.main import app
from app.services.board_service import BoardService


@pytest.fixture
def client():
    # A fresh in-memory store per test so saved boards don't leak between tests.
    service = BoardService(
        InMemoryBoardRepository(), MockEmployeeService(), MockGroupService()
    )
    app.dependency_overrides[get_board_service] = lambda: service
    yield TestClient(app)
    app.dependency_overrides.clear()


def valid_board(**overrides):
    board = {
        "name": "A&E Department Tasks",
        "members": [
            {"id": "E002", "type": "user"},
            {"id": "G001", "type": "group"},
        ],
        "egnyteFolderUrl": "https://flint.egnyte.com/navigate/folder/ae-team",
    }
    board.update(overrides)
    return board


def test_create_team_board(client):
    response = client.post("/api/boards/team", json=valid_board())

    assert response.status_code == 201
    board = response.json()
    assert board["id"]
    assert board["type"] == "Team"
    assert board["projectId"] is None
    assert board["name"] == "A&E Department Tasks"
    assert board["egnyteFolderUrl"] == "https://flint.egnyte.com/navigate/folder/ae-team"
    assert board["members"] == [
        {"id": "E002", "type": "user", "name": "Sarah Lee"},
        {"id": "G001", "type": "group", "name": "A&E Department"},
    ]


def test_reopened_board_keeps_saved_information(client):
    created = client.post("/api/boards/team", json=valid_board()).json()

    response = client.get(f"/api/boards/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_each_board_gets_its_own_id(client):
    first = client.post("/api/boards/team", json=valid_board(name="First")).json()
    second = client.post("/api/boards/team", json=valid_board(name="Second")).json()

    assert first["id"] != second["id"]
    assert client.get(f"/api/boards/{first['id']}").json()["name"] == "First"
    assert client.get(f"/api/boards/{second['id']}").json()["name"] == "Second"


def test_get_unknown_board_returns_404(client):
    response = client.get("/api/boards/B999")

    assert response.status_code == 404


def test_name_and_link_are_trimmed(client):
    response = client.post(
        "/api/boards/team",
        json=valid_board(
            name="  Ops Team  ",
            egnyteFolderUrl="  https://flint.egnyte.com/ops  ",
        ),
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Ops Team"
    assert response.json()["egnyteFolderUrl"] == "https://flint.egnyte.com/ops"


def test_empty_request_reports_every_required_field(client):
    response = client.post("/api/boards/team", json={})

    assert response.status_code == 422
    errors = response.json()["errors"]
    assert set(errors) == {"name", "members", "egnyteFolderUrl"}


@pytest.mark.parametrize("name", ["", "   "])
def test_name_is_required(client, name):
    response = client.post("/api/boards/team", json=valid_board(name=name))

    assert response.status_code == 422
    assert response.json()["errors"] == {"name": "Board name is required."}


def test_name_has_a_length_limit(client):
    response = client.post("/api/boards/team", json=valid_board(name="x" * 201))

    assert response.status_code == 422
    assert "name" in response.json()["errors"]


def test_at_least_one_member_is_required(client):
    response = client.post("/api/boards/team", json=valid_board(members=[]))

    assert response.status_code == 422
    assert response.json()["errors"] == {"members": "Add at least one member or group."}


def test_group_only_board_is_allowed(client):
    response = client.post(
        "/api/boards/team",
        json=valid_board(members=[{"id": "G002", "type": "group"}]),
    )

    assert response.status_code == 201


@pytest.mark.parametrize(
    "member",
    [
        {"id": "E999", "type": "user"},
        {"id": "G999", "type": "group"},
        {"id": "E001", "type": "group"},
        {"id": "E001", "type": "organization"},
        {"id": "", "type": "user"},
    ],
)
def test_unknown_members_are_rejected(client, member):
    response = client.post("/api/boards/team", json=valid_board(members=[member]))

    assert response.status_code == 422
    assert "members" in response.json()["errors"]


def test_duplicate_members_are_rejected(client):
    response = client.post(
        "/api/boards/team",
        json=valid_board(
            members=[
                {"id": "E001", "type": "user"},
                {"id": "E001", "type": "user"},
            ]
        ),
    )

    assert response.status_code == 422
    assert response.json()["errors"] == {
        "members": "John Smith was selected more than once."
    }


@pytest.mark.parametrize("link", ["", "   "])
def test_egnyte_link_is_required(client, link):
    response = client.post("/api/boards/team", json=valid_board(egnyteFolderUrl=link))

    assert response.status_code == 422
    assert response.json()["errors"] == {
        "egnyteFolderUrl": "Egnyte folder link is required."
    }


@pytest.mark.parametrize(
    "link",
    ["flint.egnyte.com/folder", "/Projects/SampleProject", "ftp://flint.egnyte.com", "https://"],
)
def test_egnyte_link_must_be_a_web_link(client, link):
    response = client.post("/api/boards/team", json=valid_board(egnyteFolderUrl=link))

    assert response.status_code == 422
    assert "egnyteFolderUrl" in response.json()["errors"]


def test_team_board_cannot_have_a_project(client):
    response = client.post("/api/boards/team", json=valid_board(projectId="P001"))

    assert response.status_code == 422
    assert response.json()["errors"] == {
        "projectId": "A team board cannot be linked to a project."
    }


def test_failed_save_stores_nothing(client):
    client.post("/api/boards/team", json=valid_board(name=""))

    created = client.post("/api/boards/team", json=valid_board()).json()

    assert created["id"] == "B001"


def test_get_groups(client):
    response = client.get("/api/groups")

    assert response.status_code == 200
    assert response.json()[0]["id"] == "G001"
