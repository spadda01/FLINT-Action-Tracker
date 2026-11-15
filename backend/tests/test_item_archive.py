from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.adapters.board_sections import MOCK_SECTIONS
from app.adapters.mock_action_items import MOCK_ARCHIVED_ACTION_ITEMS, MOCK_ACTION_ITEMS
from app.adapters.mock_employees import MockEmployeeService
from app.adapters.mock_groups import MockGroupService
from app.api.boards import get_board_service
from app.api.item_status import get_status_service
from app.db.board_repository import InMemoryBoardRepository
from app.db.item_status_repository import (
    InMemoryActionItemStore,
    InMemoryStatusHistoryStore,
)
from app.main import app
from app.services.board_service import BoardService
from app.services.status_service import StatusService


@pytest.fixture
def archive_client(monkeypatch):
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    original_items = deepcopy(MOCK_ACTION_ITEMS)
    original_archived = deepcopy(MOCK_ARCHIVED_ACTION_ITEMS)
    original_sections = deepcopy(MOCK_SECTIONS)
    MOCK_SECTIONS.clear()

    board_service = BoardService(
        InMemoryBoardRepository(), MockEmployeeService(), MockGroupService()
    )
    status_service = StatusService(
        InMemoryActionItemStore(), InMemoryStatusHistoryStore()
    )
    app.dependency_overrides[get_board_service] = lambda: board_service
    app.dependency_overrides[get_status_service] = lambda: status_service
    with TestClient(app) as client:
        board = client.post(
            "/api/boards/team",
            json={
                "name": "Archive test board",
                "members": [
                    {"id": "E001", "type": "user"},
                    {"id": "E002", "type": "user"},
                ],
                "egnyteFolderUrl": "https://example.test/archive",
            },
        ).json()
        yield client, board["id"]

    app.dependency_overrides.clear()
    MOCK_ACTION_ITEMS.clear()
    MOCK_ACTION_ITEMS.update(original_items)
    MOCK_ARCHIVED_ACTION_ITEMS.clear()
    MOCK_ARCHIVED_ACTION_ITEMS.update(original_archived)
    MOCK_SECTIONS.clear()
    MOCK_SECTIONS.update(original_sections)


def test_archive_requires_reason_and_keeps_item_for_admin_restore(archive_client):
    client, board_id = archive_client
    base = f"/api/boards/{board_id}"
    item = client.post(base + "/items", json={"title": "Incorrect action"}).json()
    item_id = item["id"]

    assert (
        client.post(
            f"{base}/items/{item_id}/archive", json={"reason": "  "}
        ).status_code
        == 422
    )
    assert client.get(base + "/items").json() == [item]

    client.patch(f"{base}/items/{item_id}/status", json={"status": "Complete"})
    archived = client.post(
        f"{base}/items/{item_id}/archive",
        json={"reason": "Entered on the wrong board"},
    )
    assert archived.status_code == 200
    assert archived.json()["id"] == item_id
    assert client.get(base + "/items").json() == []
    assert client.get(base + f"/items/{item_id}/history").status_code == 404

    archive_list = client.get(base + "/items/archived").json()
    assert archive_list["canRestore"] is True
    assert archive_list["archivedItems"][0]["reason"] == "Entered on the wrong board"
    assert archive_list["archivedItems"][0]["archivedBy"] == "user-1"
    assert archive_list["archivedItems"][0]["item"]["id"] == item_id

    restored = client.post(f"{base}/items/{item_id}/restore")
    assert restored.status_code == 200
    assert restored.json()["status"] == "Complete"
    assert client.get(base + "/items").json() == [restored.json()]
    history = client.get(base + f"/items/{item_id}/history")
    assert history.status_code == 200
    assert any(
        entry["field"] == "status" and entry["newValue"] == "Complete"
        for entry in history.json()
    )
    assert client.get(base + "/items/archived").json()["archivedItems"] == []
    archive_record = MOCK_ARCHIVED_ACTION_ITEMS[board_id][0]
    assert archive_record["reason"] == "Entered on the wrong board"
    assert archive_record["isArchived"] is False
    assert archive_record["restoredBy"] == "user-1"
    assert archive_record["restoredAt"]


def test_restore_is_server_restricted_to_board_admin(archive_client, monkeypatch):
    client, board_id = archive_client
    base = f"/api/boards/{board_id}"
    item = client.post(base + "/items", json={"title": "Mistaken action"}).json()
    item_id = item["id"]
    assert (
        client.post(
            f"{base}/items/{item_id}/archive", json={"reason": "Duplicate"}
        ).status_code
        == 200
    )

    monkeypatch.setenv("MOCK_USER_ID", "user-2")
    assert client.get(base + "/items/archived").json()["canRestore"] is False
    denied = client.post(f"{base}/items/{item_id}/restore")
    assert denied.status_code == 403
    assert client.get(base + "/items").json() == []

    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    assert client.post(f"{base}/items/{item_id}/restore").status_code == 200


def test_nonmember_cannot_archive_or_restore(archive_client, monkeypatch):
    client, board_id = archive_client
    item = client.post(
        f"/api/boards/{board_id}/items", json={"title": "Restricted action"}
    ).json()
    assert (
        client.post(
            f"/api/boards/{board_id}/items/{item['id']}/archive",
            json={"reason": "Duplicate"},
        ).status_code
        == 200
    )

    monkeypatch.setenv("MOCK_USER_ID", "user-3")
    assert client.get(f"/api/boards/{board_id}/items/archived").status_code == 404
    assert (
        client.post(f"/api/boards/{board_id}/items/{item['id']}/restore").status_code
        == 404
    )
