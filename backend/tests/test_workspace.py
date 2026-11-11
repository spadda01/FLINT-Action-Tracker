from copy import deepcopy

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.api.boards import get_board_service
from app.api.item_status import get_status_service
from app.db.item_status_repository import (
    InMemoryActionItemStore,
    InMemoryStatusHistoryStore,
)
from app.services.status_service import StatusService
from app.adapters.mock_action_items import MOCK_ACTION_ITEMS
from app.adapters.board_sections import MOCK_SECTIONS
from app.adapters.mock_employees import MockEmployeeService
from app.adapters.mock_groups import MockGroupService
from app.db.board_repository import InMemoryBoardRepository
from app.services.board_service import BoardService


@pytest.fixture
def workspace(monkeypatch):
    monkeypatch.setenv("APP_MODE", "mock")
    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    original_items = deepcopy(MOCK_ACTION_ITEMS)
    original_sections = deepcopy(MOCK_SECTIONS)
    MOCK_SECTIONS.clear()
    service = BoardService(
        InMemoryBoardRepository(), MockEmployeeService(), MockGroupService()
    )
    app.dependency_overrides[get_board_service] = lambda: service
    status_service = StatusService(
        InMemoryActionItemStore(), InMemoryStatusHistoryStore()
    )
    app.dependency_overrides[get_status_service] = lambda: status_service
    with TestClient(app) as client:
        boards = []
        for kind in ["project", "team"]:
            board = client.post(
                f"/api/boards/{kind}",
                json={
                    "name": kind,
                    "members": [{"id": "E001", "type": "user"}],
                    "egnyteFolderUrl": "https://example.test/folder",
                },
            ).json()
            boards.append(board["id"])
        yield client, boards
    app.dependency_overrides.clear()
    MOCK_ACTION_ITEMS.clear()
    MOCK_ACTION_ITEMS.update(original_items)
    MOCK_SECTIONS.clear()
    MOCK_SECTIONS.update(original_sections)


@pytest.mark.parametrize("index", [0, 1])
def test_full_dialog_fields_and_inline_updates_survive_reads(workspace, index):
    client, boards = workspace
    base = f"/api/boards/{boards[index]}"
    created = client.post(
        base + "/items",
        json={
            "title": "Meeting action",
            "section": "Procurement",
            "owners": [{"name": "Jim", "isExternal": True}],
            "target": {"type": "text", "value": "  Before job walk\nASAP  "},
            "hardDate": "2026-11-07",
            "priority": "High",
            "status": "Open",
            "attention": True,
        },
    )
    assert created.status_code == 201
    item = created.json()
    assert client.get(base + "/items").json() == [item]
    changed = client.patch(
        base + f"/items/{item['id']}",
        json={
            "title": "Updated action",
            "owners": [{"name": "Austin", "isExternal": False}],
            "target": {"type": "date", "value": "2026-11-06"},
            "hardDate": None,
            "attention": False,
        },
    )
    assert changed.status_code == 200
    saved = client.get(base + "/items").json()[0]
    assert saved["title"] == "Updated action"
    assert saved["owners"] == [{"name": "Austin", "isExternal": False}]
    assert saved["target"] == {"type": "date", "value": "2026-11-06"}
    assert saved["hardDate"] is None and saved["attention"] is False


@pytest.mark.parametrize("index", [0, 1])
def test_sections_and_item_moves_keep_order_and_empty_sections(workspace, index):
    client, boards = workspace
    base = f"/api/boards/{boards[index]}"
    first = client.get(base + "/sections").json()[0]
    second = client.post(base + "/sections", json={"name": "Coordination"}).json()
    items = [
        client.post(base + "/items", json={"title": title}).json()
        for title in ["A", "B", "C"]
    ]
    a, b, c = [item["id"] for item in items]
    moved = client.post(
        base + f"/items/{c}/move", json={"sectionId": first["id"], "beforeItemId": a}
    )
    assert [i["id"] for i in moved.json()] == [c, a, b]
    for iid in [c, a, b]:
        assert (
            client.post(
                base + f"/items/{iid}/move", json={"sectionId": second["id"]}
            ).status_code
            == 200
        )
    assert client.get(base + "/sections").json() == [first, second]
    assert [item["id"] for item in client.get(base + "/items").json()] == [c, a, b]
    renamed = client.patch(
        base + f"/sections/{second['id']}", json={"name": "Follow-ups"}
    )
    assert renamed.status_code == 200
    assert {i["section"] for i in client.get(base + "/items").json()} == {"Follow-ups"}
    ordered = client.put(
        base + "/sections/order", json={"sectionIds": [second["id"], first["id"]]}
    )
    assert ordered.status_code == 200
    assert client.get(base + "/sections").json()[0]["name"] == "Follow-ups"
    assert (
        len(client.get(base + "/items").json())
        == len({i["id"] for i in client.get(base + "/items").json()})
        == 3
    )


def test_invalid_moves_and_section_orders_do_not_change_state(workspace):
    client, boards = workspace
    base = f"/api/boards/{boards[0]}"
    sections = client.get(base + "/sections").json()
    a = client.post(base + "/items", json={"title": "A"}).json()
    b = client.post(base + "/items", json={"title": "B", "section": "Other"}).json()
    original = client.get(base + "/items").json()
    for data in [
        {"sectionId": "missing"},
        {"sectionId": sections[0]["id"], "beforeItemId": 999},
        {"sectionId": sections[0]["id"], "beforeItemId": b["id"]},
    ]:
        assert (
            client.post(base + f"/items/{a['id']}/move", json=data).status_code == 422
        )
        assert client.get(base + "/items").json() == original
    assert (
        client.put(base + "/sections/order", json={"sectionIds": []}).status_code == 422
    )
    assert (
        client.post(base + "/sections", json={"name": "  General  "}).status_code == 422
    )
    assert client.post(base + "/sections", json={"name": "  "}).status_code == 422


def test_rejected_combined_patch_is_atomic_and_invalid_creation_rejected(workspace):
    client, boards = workspace
    base = f"/api/boards/{boards[0]}"
    original = client.post(base + "/items", json={"title": "A"}).json()
    assert original["status"] == "Open"
    history_path = base + f"/items/{original['id']}/history"
    initial_history = client.get(history_path).json()
    assert initial_history
    for data in [
        {"status": "Complete", "priority": "Invalid"},
        {"status": "Complete", "hardDate": "2026-02-30"},
        {"attention": None},
        {"title": "  "},
    ]:
        assert (
            client.patch(base + f"/items/{original['id']}", json=data).status_code
            == 422
        )
        assert client.get(base + "/items").json()[0] == original
    assert client.get(history_path).json() == initial_history
    for data in [
        {"title": "A", "priority": "Invalid"},
        {"title": "A", "status": "Invalid"},
        {"title": "A", "hardDate": "tomorrow"},
    ]:
        assert client.post(base + "/items", json=data).status_code == 422
    assert len(client.get(base + "/items").json()) == 1


def test_live_open_counts_track_status_and_new_items(workspace):
    client, boards = workspace
    base = f"/api/boards/{boards[0]}"
    assert client.get(base).json()["openItemCount"] == 0
    item = client.post(base + "/items", json={"title": "Count me"}).json()
    assert client.get(base).json()["openItemCount"] == 1
    assert (
        next(b for b in client.get("/api/boards").json() if b["id"] == boards[0])[
            "openItemCount"
        ]
        == 1
    )
    client.patch(base + f"/items/{item['id']}/status", json={"status": "Complete"})
    assert client.get(base).json()["openItemCount"] == 0


def test_workspace_changes_require_membership_and_cannot_cross_boards(
    workspace, monkeypatch
):
    client, boards = workspace
    base = f"/api/boards/{boards[0]}"
    item = client.post(base + "/items", json={"title": "A"}).json()
    foreign = client.get(f"/api/boards/{boards[1]}/sections").json()[0]
    assert (
        client.post(
            base + f"/items/{item['id']}/move", json={"sectionId": foreign["id"]}
        ).status_code
        == 422
    )
    monkeypatch.setenv("MOCK_USER_ID", "user-2")
    for method, path, data in [
        ("GET", "/sections", None),
        ("POST", "/sections", {"name": "Hidden"}),
        ("PUT", "/sections/order", {"sectionIds": []}),
        ("POST", f"/items/{item['id']}/move", {"sectionId": foreign["id"]}),
        ("PATCH", f"/items/{item['id']}", {"attention": True}),
    ]:
        assert client.request(method, base + path, json=data).status_code == 404


def test_creation_and_inline_priority_use_same_configured_levels(
    workspace, monkeypatch
):
    from app.api.priorities import priority_service

    client, boards = workspace
    monkeypatch.setattr(
        priority_service,
        "levels",
        [{"name": "Urgent", "rank": 0}, {"name": "Medium", "rank": 1}],
    )
    assert client.get("/api/priorities").json()[0]["name"] == "Urgent"
    base = f"/api/boards/{boards[0]}"
    item = client.post(
        base + "/items", json={"title": "Configured item", "priority": "Urgent"}
    )
    assert item.status_code == 201
    updated = client.patch(
        base + f"/items/{item.json()['id']}", json={"priority": "Medium"}
    )
    assert updated.status_code == 200
    assert updated.json()["priority"] == "Medium"


@pytest.mark.parametrize("index", [0, 1])
def test_item_history_records_changes_and_ignores_unchanged_saves(workspace, index):
    client, boards = workspace
    base = f"/api/boards/{boards[index]}"
    created = client.post(base + "/items", json={"title": "History test"})
    assert created.status_code == 201

    item_id = created.json()["id"]
    item_path = base + f"/items/{item_id}"
    history_path = item_path + "/history"
    initial_history = client.get(history_path).json()

    response = client.patch(item_path, json={"title": "Updated history test"})
    assert response.status_code == 200

    entries = client.get(history_path).json()
    assert len(entries) == len(initial_history) + 1

    latest = entries[0]
    assert latest["actorId"] == "user-1"
    assert latest["changedAt"]
    assert latest["field"] == "title"
    assert latest["oldValue"] == "History test"
    assert latest["newValue"] == "Updated history test"

    # Saving the same title must leave history unchanged.
    assert (
        client.patch(item_path, json={"title": "Updated history test"}).status_code
        == 200
    )
    assert client.get(history_path).json() == entries


@pytest.mark.parametrize("index", [0, 1])
def test_item_history_is_read_only_and_requires_board_access(
    workspace, monkeypatch, index
):
    client, boards = workspace
    base = f"/api/boards/{boards[index]}"
    created = client.post(base + "/items", json={"title": "Protected history"})
    assert created.status_code == 201

    history_path = base + f"/items/{created.json()['id']}/history"
    original = client.get(history_path).json()
    assert original

    for method in ["POST", "PUT", "PATCH", "DELETE"]:
        response = client.request(method, history_path, json={"newValue": "Tampered"})
        assert response.status_code == 405

    assert client.get(history_path).json() == original

    monkeypatch.setenv("MOCK_USER_ID", "user-2")
    assert client.get(history_path).status_code == 404


@pytest.mark.parametrize("index", [0, 1])
def test_all_item_update_paths_append_history(workspace, index):
    client, boards = workspace
    base = f"/api/boards/{boards[index]}"

    created = client.post(base + "/items", json={"title": "Track changes"})
    assert created.status_code == 201
    item_path = base + f"/items/{created.json()['id']}"

    section = client.post(base + "/sections", json={"name": "Follow-ups"})
    assert section.status_code == 201
    section_id = section.json()["id"]

    operations = [
        (
            "PATCH",
            item_path + "/priority",
            {"priority": "High"},
            "priority",
            "Medium",
            "High",
        ),
        (
            "PATCH",
            item_path + "/status",
            {"status": "Complete"},
            "status",
            "Open",
            "Complete",
        ),
        (
            "POST",
            item_path + "/move",
            {"sectionId": section_id},
            "section",
            "General",
            "Follow-ups",
        ),
        (
            "PATCH",
            base + f"/sections/{section_id}",
            {"name": "Review"},
            "section",
            "Follow-ups",
            "Review",
        ),
    ]

    history_path = item_path + "/history"
    previous = client.get(history_path).json()

    for method, path, data, field, old_value, new_value in operations:
        assert client.request(method, path, json=data).status_code == 200

        entries = client.get(history_path).json()
        assert len(entries) == len(previous) + 1
        assert entries[1:] == previous
        assert entries[0]["field"] == field
        assert entries[0]["oldValue"] == old_value
        assert entries[0]["newValue"] == new_value
        assert entries[0]["actorId"] == "user-1"
        previous = entries


@pytest.mark.parametrize("index", [0, 1])
def test_owner_changes_preserve_order_types_and_saved_values(workspace, index):
    client, boards = workspace
    base = f"/api/boards/{boards[index]}"

    staff = {"name": "Austin", "isExternal": False}
    external = {"name": "Sarah", "isExternal": True}
    added = {"name": "Taylor", "isExternal": True}

    created = client.post(
        base + "/items",
        json={"title": "Owner assignment test", "owners": [staff, external]},
    )
    assert created.status_code == 201
    item_id = created.json()["id"]
    item_path = base + f"/items/{item_id}"
    history_path = item_path + "/history"
    previous_history = client.get(history_path).json()
    previous_owners = [staff, external]

    for owners in [
        [external, staff],
        [external, staff, added],
        [staff, added],
        [],
    ]:
        response = client.patch(item_path, json={"owners": owners})
        assert response.status_code == 200
        assert response.json()["owners"] == owners

        saved = next(
            item for item in client.get(base + "/items").json() if item["id"] == item_id
        )
        assert saved["owners"] == owners

        entries = client.get(history_path).json()
        assert len(entries) == len(previous_history) + 1
        assert entries[1:] == previous_history

        latest = entries[0]
        assert latest["field"] == "owners"
        assert latest["actorId"] == "user-1"
        assert latest["changedAt"]
        assert latest["oldValue"] == previous_owners
        assert latest["newValue"] == owners

        previous_history = entries
        previous_owners = owners
    # saving unchanged owners must not add another history entry
    assert client.patch(item_path, json={"owners": []}).status_code == 200
    assert client.get(history_path).json() == previous_history


@pytest.mark.parametrize("index", [0, 1])
def test_invalid_and_unauthorized_owner_changes_preserve_saved_item(
    workspace, monkeypatch, index
):
    client, boards = workspace
    base = f"/api/boards/{boards[index]}"
    owners = [{"name": "Austin", "isExternal": False}]

    created = client.post(
        base + "/items",
        json={"title": "Protected owners", "owners": owners},
    )
    assert created.status_code == 201
    original = created.json()
    item_path = base + f"/items/{original['id']}"

    for invalid_owners in [
        [{"name": "   ", "isExternal": False}],
        [{"name": "", "isExternal": True}],
        [{"name": "Taylor"}],
        None,
    ]:
        response = client.patch(item_path, json={"owners": invalid_owners})
        assert response.status_code == 422
        saved = next(
            item
            for item in client.get(base + "/items").json()
            if item["id"] == original["id"]
        )
        assert saved == original

    monkeypatch.setenv("MOCK_USER_ID", "user-2")
    assert client.patch(item_path, json={"owners": []}).status_code == 404

    monkeypatch.setenv("MOCK_USER_ID", "user-1")
    saved = next(
        item
        for item in client.get(base + "/items").json()
        if item["id"] == original["id"]
    )
    assert saved == original
