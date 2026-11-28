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


@pytest.fixture(autouse=True)
def mock_identity_for_legacy_api_tests(monkeypatch):
    """Keep server-selected test identities independent of browser authentication."""
    import os

    from fastapi import HTTPException

    from app.api.auth import get_current_user_id, require_mock_mode
    from app.main import app
    from app.services.board_access import MOCK_EMPLOYEE_IDS

    def test_identity():
        require_mock_mode()
        user_id = os.getenv("MOCK_USER_ID", "user-1")
        if user_id not in MOCK_EMPLOYEE_IDS:
            raise HTTPException(status_code=401, detail="The mock user is not recognized.")
        return user_id

    monkeypatch.setitem(app.dependency_overrides, get_current_user_id, test_identity)
