from threading import RLock

from app.schemas.item_history import ItemHistoryEntry


class MockItemHistoryRepository:
    def __init__(self):
        self._entries: list[ItemHistoryEntry] = []
        self._lock = RLock()

    def append_entries(self, entries: list[ItemHistoryEntry]) -> None:
        # Copy entries so later changes to caller-owned values cannot alter history.
        saved_entries = [entry.model_copy(deep=True) for entry in entries]

        with self._lock:
            self._entries.extend(saved_entries)

    def list_entries(
        self,
        board_id: str,
        item_id: int,
    ) -> list[ItemHistoryEntry]:
        # Return independent copies, newest first.
        with self._lock:
            return [
                entry.model_copy(deep=True)
                for entry in reversed(self._entries)
                if entry.boardId == board_id and entry.itemId == item_id
            ]


mock_item_history = MockItemHistoryRepository()
