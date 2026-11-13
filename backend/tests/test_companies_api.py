from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.adapters.board_sections import MOCK_SECTIONS
from app.adapters.interfaces import CompanyAdapter
from app.adapters.mock_action_items import MOCK_ACTION_ITEMS
from app.adapters.mock_employees import MockEmployeeService
from app.adapters.mock_groups import MockGroupService
from app.api.boards import get_board_service
from app.api.item_status import get_status_service
from app.db.board_repository import InMemoryBoardRepository
from app.db.item_status_repository import InMemoryActionItemStore, InMemoryStatusHistoryStore
from app.main import app, get_company_adapter
from app.services.board_service import BoardService
from app.services.status_service import StatusService


class FakeCompanies(CompanyAdapter):
    def get_companies(self):
        return [{"id": "T1", "name": "Test Co"}, {"id": "T2", "name": "Other Co"}]


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    items, sections = deepcopy(MOCK_ACTION_ITEMS), deepcopy(MOCK_SECTIONS)
    MOCK_SECTIONS.clear()
    service = BoardService(InMemoryBoardRepository(), MockEmployeeService(), MockGroupService())
    app.dependency_overrides[get_board_service] = lambda: service
    statuses = StatusService(InMemoryActionItemStore(), InMemoryStatusHistoryStore())
    app.dependency_overrides[get_status_service] = lambda: statuses
    app.dependency_overrides[get_company_adapter] = lambda: FakeCompanies()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    MOCK_ACTION_ITEMS.clear(); MOCK_ACTION_ITEMS.update(items)
    MOCK_SECTIONS.clear(); MOCK_SECTIONS.update(sections)


def make_board(client, kind):
    return client.post(f"/api/boards/{kind}", json={
        "name": kind, "members": [{"id": "E001", "type": "user"}],
        "egnyteFolderUrl": "https://example.test/folder",
    }).json()["id"]


def test_companies_endpoint_uses_the_adapter(client):
    assert client.get("/api/companies").json() == FakeCompanies().get_companies()


def test_default_adapter_is_the_mock_list(monkeypatch):
    app.dependency_overrides.clear()
    with TestClient(app) as c:
        names = [x["name"] for x in c.get("/api/companies").json()]
    assert "Example Structural Engineering" in names


@pytest.mark.parametrize("kind", ["project", "team"])
def test_external_owner_keeps_organization_on_project_and_team_boards(client, kind):
    board = make_board(client, kind)
    created = client.post(f"/api/boards/{board}/items", json={
        "title": "Review", "owners": [{"name": "Pat", "isExternal": True, "organizationId": "T1"}],
    })
    assert created.status_code == 201
    assert created.json()["owners"][0]["organizationId"] == "T1"
    item_id = created.json()["id"]
    patched = client.patch(f"/api/boards/{board}/items/{item_id}", json={
        "owners": [{"name": "Pat", "isExternal": True, "organizationId": "T2"}],
    })
    assert patched.status_code == 200
    stored = client.get(f"/api/boards/{board}/items").json()
    assert stored[0]["owners"][0]["organizationId"] == "T2"


def test_owner_without_organization_is_allowed(client):
    board = make_board(client, "project")
    response = client.post(f"/api/boards/{board}/items", json={
        "title": "x", "owners": [{"name": "Pat", "isExternal": True}],
    })
    assert response.status_code == 201
    assert response.json()["owners"][0]["organizationId"] is None


def test_unknown_organization_is_rejected_and_changes_nothing(client):
    board = make_board(client, "team")
    created = client.post(f"/api/boards/{board}/items", json={"title": "x"}).json()
    bad = client.patch(f"/api/boards/{board}/items/{created['id']}", json={
        "owners": [{"name": "Pat", "isExternal": True, "organizationId": "NOPE"}],
    })
    assert bad.status_code == 422
    assert "FLINT list" in bad.json()["detail"]
    assert client.get(f"/api/boards/{board}/items").json()[0]["owners"] == []
    assert client.post(f"/api/boards/{board}/items", json={
        "title": "y", "owners": [{"name": "Pat", "isExternal": True, "organizationId": "NOPE"}],
    }).status_code == 422


def test_internal_owner_cannot_have_an_organization(client):
    board = make_board(client, "project")
    response = client.post(f"/api/boards/{board}/items", json={
        "title": "x", "owners": [{"name": "Pat", "isExternal": False, "organizationId": "T1"}],
    })
    assert response.status_code == 422
