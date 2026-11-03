import pytest
from fastapi.testclient import TestClient

from app.adapters.mock_employees import MockEmployeeService
from app.adapters.mock_groups import MockGroupService
from app.api.boards import get_board_service
from app.db.board_repository import InMemoryBoardRepository
from app.main import app
from app.services.board_service import BoardService
from app.adapters.mock_action_items import MOCK_ACTION_ITEMS


@pytest.fixture
def client(monkeypatch):
    # Enable mock mode and select a member of the test boards.

    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("MOCK_USER_ID", "user-2")

    # Reset action items created by previous tests.
    for board_id in list(MOCK_ACTION_ITEMS):
        if board_id not in {
            "project-1",
            "project-2",
            "team-1",
            "team-2",
        }:
            del MOCK_ACTION_ITEMS[board_id]

    # Use a fresh board repository for each test.
    service = BoardService(
        InMemoryBoardRepository(),
        MockEmployeeService(),
        MockGroupService(),
    )

    app.dependency_overrides[get_board_service] = lambda: service

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
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
    assert (
        board["egnyteFolderUrl"] == "https://flint.egnyte.com/navigate/folder/ae-team"
    )
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
    [
        "flint.egnyte.com/folder",
        "/Projects/SampleProject",
        "ftp://flint.egnyte.com",
        "https://",
    ],
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


def test_created_team_board_member_can_view_priorities(client):
    created = client.post(
        "/api/boards/team",
        json=valid_board(),
    )

    assert created.status_code == 201
    board_id = created.json()["id"]

    response = client.get(f"/api/boards/{board_id}/priorities")

    assert response.status_code == 200
    assert response.json() == []


def test_created_team_board_rejects_nonmember_priority_access(client, monkeypatch):
    created = client.post(
        "/api/boards/team",
        json=valid_board(members=[{"id": "E002", "type": "user"}]),
    )

    assert created.status_code == 201
    board_id = created.json()["id"]

    # switch to a user who is not a board member
    monkeypatch.setenv("MOCK_USER_ID", "user-1")

    response = client.get(f"/api/boards/{board_id}/priorities")

    assert response.status_code == 403


def test_created_team_board_rejects_nonmember_priority_edit(client, monkeypatch):
    created = client.post(
        "/api/boards/team",
        json=valid_board(members=[{"id": "E002", "type": "user"}]),
    )

    assert created.status_code == 201
    board_id = created.json()["id"]

    # switch to a user who is not a board member
    monkeypatch.setenv("MOCK_USER_ID", "user-1")

    response = client.patch(
        f"/api/boards/{board_id}/items/1/priority",
        json={"priority": "High"},
    )

    assert response.status_code == 403


def test_created_team_board_member_can_edit_priority(client):
    created = client.post(
        "/api/boards/team",
        json=valid_board(),
    )

    assert created.status_code == 201
    board_id = created.json()["id"]

    # create an action item on the new team board
    item_response = client.post(
        f"/api/boards/{board_id}/items",
        json={"title": "Review project schedule"},
    )

    assert item_response.status_code == 201
    item_id = item_response.json()["id"]

    # update its priority through the AT-70 endpoint
    response = client.patch(
        f"/api/boards/{board_id}/items/{item_id}/priority",
        json={"priority": "High"},
    )

    assert response.status_code == 200
    assert response.json()["priority"] == "High"


def test_quick_entry_creates_action_item(client):
    created = client.post(
        "/api/boards/team",
        json=valid_board(),
    )

    assert created.status_code == 201
    board_id = created.json()["id"]

    response = client.post(
        f"/api/boards/{board_id}/items",
        json={"title": "Review construction schedule"},
    )

    assert response.status_code == 201

    item = response.json()

    assert item["title"] == "Review construction schedule"
    assert item["section"] == "General"
    assert item["priority"] == "Medium"
    assert item["status"] == "Not Started"
    assert item["owners"] == []
    assert item["target"] == ""
    assert item["hardDate"] is None
    assert item["attention"] is False

    # confirm the created item can be retrieved from its board
    items_response = client.get(f"/api/boards/{board_id}/items")

    assert items_response.status_code == 200
    assert any(saved_item["id"] == item["id"] for saved_item in items_response.json())


@pytest.mark.parametrize("title", ["", "   "])
def test_quick_entry_rejects_empty_titles(client, title):
    created = client.post(
        "/api/boards/team",
        json=valid_board(),
    )

    assert created.status_code == 201
    board_id = created.json()["id"]

    response = client.post(
        f"/api/boards/{board_id}/items",
        json={"title": title},
    )

    assert response.status_code == 422
    assert response.json()["detail"] == ("Action item title cannot be empty.")

    # invalid requests must not create action items
    items_response = client.get(f"/api/boards/{board_id}/items")
    assert items_response.status_code == 200
    assert items_response.json() == []


def test_quick_entry_rejects_nonmember(client, monkeypatch):
    created = client.post(
        "/api/boards/team",
        json=valid_board(members=[{"id": "E002", "type": "user"}]),
    )

    assert created.status_code == 201
    board_id = created.json()["id"]

    # switch to a user who is not a board member
    monkeypatch.setenv("MOCK_USER_ID", "user-1")

    response = client.post(
        f"/api/boards/{board_id}/items",
        json={"title": "Unauthorized action item"},
    )

    assert response.status_code == 404

    # confirm the unauthorized request created nothing
    monkeypatch.setenv("MOCK_USER_ID", "user-2")

    items_response = client.get(f"/api/boards/{board_id}/items")

    assert items_response.status_code == 200
    assert items_response.json() == []


def test_quick_entry_keeps_items_separate_between_boards(client):
    first = client.post(
        "/api/boards/team",
        json=valid_board(name="First Team"),
    ).json()

    second = client.post(
        "/api/boards/team",
        json=valid_board(name="Second Team"),
    ).json()

    # create an item on the first board only
    response = client.post(
        f"/api/boards/{first['id']}/items",
        json={"title": "First board action"},
    )

    assert response.status_code == 201

    first_items = client.get(f"/api/boards/{first['id']}/items").json()

    second_items = client.get(f"/api/boards/{second['id']}/items").json()

    assert len(first_items) == 1
    assert first_items[0]["title"] == "First board action"
    assert second_items == []


def test_project_board_creation_uses_shared_access_and_item_store(client):
    response = client.post('/api/boards/project', json=valid_board(projectId='P001'))
    assert response.status_code == 201
    board = response.json()
    assert board['type'] == 'Project'
    assert board['projectId'] == 'P001'
    assert any(entry['id'] == board['id'] for entry in client.get('/api/boards').json())
    assert client.get(f"/api/boards/{board['id']}").status_code == 200
    item_response = client.post(f"/api/boards/{board['id']}/items", json={'title': 'First action'})
    assert item_response.status_code == 201
    item_id = item_response.json()['id']
    assert client.get(f"/api/boards/{board['id']}/priorities").json()[0]['id'] == item_id
    status_response = client.patch(f"/api/boards/{board['id']}/items/{item_id}/status", json={'status': 'Complete'})
    assert status_response.status_code == 200
    assert client.get(f"/api/boards/{board['id']}/items").json()[0]['status'] == 'Complete'


def test_project_board_allows_no_project_and_rejects_unknown_projects(client):
    assert client.post('/api/boards/project', json=valid_board()).status_code == 201
    invalid = client.post('/api/boards/project', json=valid_board(projectId='missing'))
    assert invalid.status_code == 422
    assert 'projectId' in invalid.json()['errors']
    invalid_member = client.post('/api/boards/project', json=valid_board(members=[{'type': 'user', 'id': 'missing'}]))
    assert invalid_member.status_code == 422
