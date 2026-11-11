from datetime import datetime, timezone
from uuid import uuid4

from pydantic import JsonValue

from app.adapters.mock_item_history import (
    MockItemHistoryRepository,
    mock_item_history,
)
from app.schemas.item_history import ItemHistoryEntry


class ItemHistoryService:
    def __init__(self, repository: MockItemHistoryRepository):
        self.repository = repository

    def record_changes(
        self,
        board_id: str,
        item_id: int,
        actor_id: str,
        before: dict[str, JsonValue],
        after: dict[str, JsonValue],
    ) -> None:
        changed_at = datetime.now(timezone.utc)
        entries = []

        # Record only fields whose values actually changed.
        for field, new_value in after.items():
            if field == "id":
                continue

            old_value = before.get(field)
            if old_value == new_value:
                continue

            entries.append(
                ItemHistoryEntry(
                    id=str(uuid4()),
                    boardId=board_id,
                    itemId=item_id,
                    actorId=actor_id,
                    changedAt=changed_at,
                    field=field,
                    oldValue=old_value,
                    newValue=new_value,
                )
            )

        self.repository.append_entries(entries)

    def get_history(
        self,
        board_id: str,
        item_id: int,
    ) -> list[ItemHistoryEntry]:
        return self.repository.list_entries(board_id, item_id)


item_history_service = ItemHistoryService(mock_item_history)
