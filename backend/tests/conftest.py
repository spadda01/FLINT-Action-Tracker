import pytest

from app.adapters.mock_item_history import MockItemHistoryRepository
from app.services.item_history_service import item_history_service


@pytest.fixture(autouse=True)
def isolated_item_history(monkeypatch):
    # Give each test fresh history without adding a production delete operation.
    monkeypatch.setattr(
        item_history_service,
        "repository",
        MockItemHistoryRepository(),
    )
