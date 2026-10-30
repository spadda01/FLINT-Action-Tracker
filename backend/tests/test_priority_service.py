
import pytest

from app.services.priority_service import PriorityService


def test_default_priorities():
    service = PriorityService()
    assert [p["name"] for p in service.get_levels()] == [
        "High", "Medium", "Low"
    ]


def test_sort_by_priority():
    service = PriorityService()
    items = [
        {"id": 1, "priority": "Low"},
        {"id": 2, "priority": "High"},
        {"id": 3, "priority": "Medium"},
    ]
    sorted_items = service.sort_items(items)
    assert [item["id"] for item in sorted_items] == [2, 3, 1]


def test_filter_by_priority():
    service = PriorityService()
    items = [
        {"id": 1, "priority": "Low"},
        {"id": 2, "priority": "High"},
    ]
    assert service.filter_items(items, "High") == [
        {"id": 2, "priority": "High"}
    ]


def test_update_priority():
    service = PriorityService()
    items = [{"id": 1, "priority": "Low"}]
    updated = service.update_priority(items, 1, "High")
    assert updated["priority"] == "High"
    assert items[0]["priority"] == "High"


def test_invalid_priority():
    service = PriorityService()
    items = [{"id": 1, "priority": "Low"}]
    with pytest.raises(ValueError, match="Invalid priority"):
        service.update_priority(items, 1, "Urgent")


def test_missing_item():
    service = PriorityService()
    items = [{"id": 1, "priority": "Low"}]
    with pytest.raises(ValueError, match="Action item not found"):
        service.update_priority(items, 99, "High")
