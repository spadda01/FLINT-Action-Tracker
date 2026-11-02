
import pytest

from app.adapters.mock_action_items import MockActionItemRepository


def test_list_sample_items():
    repo = MockActionItemRepository()

    items = repo.list_items("project-1")

    assert len(items) == 2
    assert items[0]["priority"] == "High"


def test_save_priority():
    repo = MockActionItemRepository()

    repo.save_priority("project-1", 1, "Low")

    items = repo.list_items("project-1")
    assert items[0]["priority"] == "Low"


def test_missing_item():
    repo = MockActionItemRepository()

    with pytest.raises(ValueError, match="Action item not found"):
        repo.save_priority("project-1", 99, "High")


def test_unknown_board():
    repo = MockActionItemRepository()

    assert repo.list_items("missing-board") == []


def test_list_returns_copy():
    repo = MockActionItemRepository()

    items = repo.list_items("project-1")
    items[0]["priority"] = "Low"

    assert repo.list_items("project-1")[0]["priority"] == "High"
