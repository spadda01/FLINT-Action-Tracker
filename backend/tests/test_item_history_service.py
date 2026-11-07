from datetime import timedelta

from app.adapters.mock_item_history import MockItemHistoryRepository
from app.services.item_history_service import ItemHistoryService


def test_records_actor_time_field_and_before_after_values():
    service = ItemHistoryService(MockItemHistoryRepository())

    service.record_changes(
        board_id="project-1",
        item_id=1,
        actor_id="user-1",
        before={"id": 1, "priority": "High", "title": "Review drawings"},
        after={"id": 1, "priority": "Medium", "title": "Review drawings"},
    )

    entries = service.get_history("project-1", 1)

    assert len(entries) == 1
    entry = entries[0]
    assert entry.id
    assert entry.boardId == "project-1"
    assert entry.itemId == 1
    assert entry.actorId == "user-1"
    assert entry.changedAt.utcoffset() == timedelta(0)
    assert entry.field == "priority"
    assert entry.oldValue == "High"
    assert entry.newValue == "Medium"


def test_unchanged_values_create_no_history():
    service = ItemHistoryService(MockItemHistoryRepository())

    service.record_changes(
        board_id="project-1",
        item_id=1,
        actor_id="user-1",
        before={"status": "Open"},
        after={"status": "Open"},
    )

    assert service.get_history("project-1", 1) == []


def test_nested_values_cannot_change_stored_history():
    service = ItemHistoryService(MockItemHistoryRepository())
    owners = [{"name": "Austin", "isExternal": False}]

    service.record_changes(
        board_id="project-1",
        item_id=1,
        actor_id="user-1",
        before={"owners": []},
        after={"owners": owners},
    )

    # Changing the original input must not alter the saved record.
    owners[0]["name"] = "Changed outside history"
    entry = service.get_history("project-1", 1)[0]
    assert entry.newValue == [{"name": "Austin", "isExternal": False}]

    # Changing a returned nested value must not alter storage either.
    entry.newValue[0]["name"] = "Changed returned copy"
    saved = service.get_history("project-1", 1)[0]
    assert saved.newValue == [{"name": "Austin", "isExternal": False}]
