from app.schemas.action_item import ActionItem

# temporary action items for the development until real project data is available
MOCK_ACTION_ITEMS = {
    "project-1": [
        ActionItem(
            id=1,
            section="Design",
            priority="High",
            title="Review construction drawings",
            owners=[
                {"name": "Austin", "isExternal": False},
                {"name": "Sarah", "isExternal": True},
            ],
            target="Before next meeting",
            hardDate="2026-10-30",
            status="In Progress",
            attention=True,
        ),
        ActionItem(
            id=2,
            section="Construction",
            priority="Medium",
            title="Confirm material delivery",
            owners=[{"name": "James", "isExternal": False}],
            target="ASAP",
            hardDate=None,
            status="Not Started",
            attention=False,
        ),
    ],
}


def get_mock_action_items(board_id: str) -> list[ActionItem]:
    # Return items belonging to the selected board.
    return MOCK_ACTION_ITEMS.get(board_id, [])


def update_mock_action_item(
    board_id: str,
    item_id: int,
    target: str | None = None,
    priority: str | None = None
) -> ActionItem | None:
    # update only the fields provided for the selected item
    for item in MOCK_ACTION_ITEMS.get(board_id, []):
        if item.id == item_id:
            if target is not None:
                item.target = target

            if priority is not None:
                item.priority = priority

            return item
    return None
