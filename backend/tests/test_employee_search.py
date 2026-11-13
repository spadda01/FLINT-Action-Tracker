import pytest
from fastapi.testclient import TestClient

from app.adapters.mock_employees import MockEmployeeService
from app.adapters.mock_groups import MockGroupService
from app.api.boards import get_board_service
from app.api.employees import get_employee_directory
from app.db.board_repository import InMemoryBoardRepository
from app.main import app
from app.services.board_service import BoardService
from app.services.employee_directory import EmployeeDirectory


class FailingEmployees:
    def get_employees(self):
        raise RuntimeError("Employee records are unavailable.")


@pytest.fixture
def client(monkeypatch):
    # user-1 can open project-1, project-2, team-1 and team-2.
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("MOCK_USER_ID", "user-1")

    service = BoardService(InMemoryBoardRepository(), MockEmployeeService(), MockGroupService())
    app.dependency_overrides[get_board_service] = lambda: service
    try:
        with TestClient(app, raise_server_exceptions=False) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def search(client, text, board_id="project-1"):
    return client.get(f"/api/boards/{board_id}/employees", params={"search": text})


def names(response):
    return [e["name"] for e in response.json()]


# --- Searching by name ---

def test_search_matches_the_start_of_first_or_last_name(client):
    assert names(search(client, "sar")) == ["Sarah Lee"]
    assert names(search(client, "lee")) == ["Sarah Lee"]


def test_search_ignores_case_and_extra_spaces(client):
    assert names(search(client, "  JAMES  ")) == ["James Ortiz"]


def test_every_word_must_match(client):
    assert names(search(client, "sa le")) == ["Sarah Lee"]
    assert search(client, "sarah chen").json() == []


def test_middle_of_a_name_does_not_match(client):
    # "ar" is inside "Sarah" but doesn't start a name word.
    assert "Sarah Lee" not in names(search(client, "ar"))


def test_blank_search_returns_nothing(client):
    assert search(client, "").json() == []
    assert search(client, "   ").json() == []


def test_no_match_returns_an_empty_list(client):
    response = search(client, "zzz")

    assert response.status_code == 200
    assert response.json() == []


def test_result_has_the_fields_the_picker_needs(client):
    assert search(client, "john").json() == [{
        "id": "E001",
        "name": "John Smith",
        "department": "Engineering",
        "active": True,
        "onProject": False,
    }]


def test_search_text_over_100_characters_is_rejected(client):
    assert search(client, "a" * 101).status_code == 422


def test_results_are_capped_at_ten():
    many = [{"id": f"E{i}", "name": f"Alex Person{i}", "active": True} for i in range(15)]

    class ManyEmployees:
        def get_employees(self):
            return many

    assert len(EmployeeDirectory(ManyEmployees()).search("alex")) == 10


# --- Inactive employees ---

def test_inactive_employee_is_found_but_marked_inactive(client):
    result = search(client, "dana").json()

    assert result[0]["name"] == "Dana Whitfield"
    assert result[0]["active"] is False


def test_active_people_are_listed_before_inactive_ones():
    employees = [
        {"id": "E1", "name": "Dana Old", "active": False},
        {"id": "E2", "name": "Dana New", "active": True},
    ]

    class Employees:
        def get_employees(self):
            return employees

    result = EmployeeDirectory(Employees()).search("dana")

    assert [e["name"] for e in result] == ["Dana New", "Dana Old"]


def test_owners_on_items_can_be_looked_up_by_id_including_inactive(client):
    response = client.get("/api/boards/project-1/employees", params={"ids": "E008,E002"})

    assert response.status_code == 200
    assert {e["id"]: e["active"] for e in response.json()} == {"E002": True, "E008": False}


def test_unknown_ids_are_left_out(client):
    response = client.get("/api/boards/project-1/employees", params={"ids": "E999, E001 ,"})

    assert [e["id"] for e in response.json()] == ["E001"]


# --- Project allocations ---

def test_people_on_the_boards_project_are_marked_and_listed_first(client):
    created = client.post("/api/boards/project", json={
        "name": "Allocation board",
        "projectId": "P002",
        "egnyteFolderUrl": "https://example.test/allocation",
        "members": [{"id": "E001", "type": "user"}],
    })
    board_id = created.json()["id"]

    # Mike Chen and Maranda Lopez are allocated to P002; Sarah Lee isn't.
    result = client.get(f"/api/boards/{board_id}/employees", params={"search": "m"}).json()

    assert [(e["name"], e["onProject"]) for e in result] == [
        ("Maranda Lopez", True),
        ("Mike Chen", True),
    ]
    sarah = search(client, "sarah", board_id).json()[0]
    assert sarah["onProject"] is False


def test_boards_without_a_project_mark_nobody_on_project(client):
    assert all(not e["onProject"] for e in search(client, "a", "team-1").json())


# --- Access ---

@pytest.mark.parametrize("board_id", ["team-restricted", "project-archived", "does-not-exist"])
def test_boards_the_user_cannot_open_are_hidden(client, board_id):
    assert search(client, "sarah", board_id).status_code == 404


def test_non_member_cannot_search(client, monkeypatch):
    # user-2 is not a member of project-1.
    monkeypatch.setenv("MOCK_USER_ID", "user-2")

    assert search(client, "sarah").status_code == 404


def test_unknown_user_is_rejected(client, monkeypatch):
    monkeypatch.setenv("MOCK_USER_ID", "someone-else")

    assert search(client, "sarah").status_code == 401


def test_search_is_off_outside_mock_mode(client, monkeypatch):
    monkeypatch.delenv("APP_MODE", raising=False)

    assert search(client, "sarah").status_code == 503


def test_employee_records_failing_gives_a_server_error(client):
    app.dependency_overrides[get_employee_directory] = lambda: EmployeeDirectory(FailingEmployees())

    assert search(client, "sarah").status_code == 500
