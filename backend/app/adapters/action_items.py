from app.schemas.action_items import ActionItem, TargetValue


class MockActionItemRepository:
    def __init__(self) -> None:
        self._items = {
            "project-1": [
                ActionItem(
                    id="item-1",
                    title="Confirm site access",
                    target={"type": "text", "value": "  Before job walk  "},
                ),
                ActionItem(
                    id="item-2",
                    title="Issue revised drawings",
                    target={"type": "date", "value": "2026-11-01"},
                ),
                ActionItem(
                    id="item-3",
                    title="Coordinate review",
                    target={"type": "text", "value": "ASAP"},
                ),
            ],
        }

    def list_items(self, board_id: str) -> list[ActionItem]:
        return list(self._items.get(board_id, []))

    def update_target(
        self, board_id: str, item_id: str, target: TargetValue,
    ) -> ActionItem | None:
        for index, item in enumerate(self._items.get(board_id, [])):
            if item.id == item_id:
                updated = ActionItem.model_validate(
                    {
                        "id": item.id,
                        "title": item.title,
                        "target": target,
                    }
                )
                self._items[board_id][index] = updated
                return updated
        return None
