
import pytest

from app.adapters.boards import MockBoardRepository
from app.services.priority_permissions import can_edit_priority


@pytest.fixture
def repo():
    return MockBoardRepository()


def test_allowed_board(repo):
    assert can_edit_priority("user-1", "project-1", repo) is True


def test_restricted_board(repo):
    assert can_edit_priority("user-1", "team-restricted", repo) is False


def test_archived_board(repo):
    assert can_edit_priority("user-1", "project-archived", repo) is False


def test_unknown_board(repo):
    assert can_edit_priority("user-1", "missing-board", repo) is False


def test_second_user_access(repo):
    assert can_edit_priority("user-2", "project-2", repo) is True
