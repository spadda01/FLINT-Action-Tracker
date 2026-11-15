from app.schemas.action_item import ActionItem, ActionItemCreate
from app.schemas.action_items import TargetValue

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
MOCK_ARCHIVED_ACTION_ITEMS: dict[str, list[dict]] = {}


def get_mock_action_items(board_id: str) -> list[ActionItem]:
    # Return items belonging to the selected board.
    return MOCK_ACTION_ITEMS.get(board_id, [])


# create an action item for the selected board
def create_mock_action_item(
    board_id: str,
    new_item: ActionItemCreate,
) -> ActionItem:
    items = MOCK_ACTION_ITEMS.setdefault(board_id, [])

    # Generate an ID unique within the selected board.
    archived_items = MOCK_ARCHIVED_ACTION_ITEMS.get(board_id, [])
    next_id = max(
        [item.id for item in items]
        + [record["item"].id for record in archived_items],
        default=0,
    ) + 1

    created_item = ActionItem(
        id=next_id,
        section=new_item.section,
        priority=new_item.priority,
        title=new_item.title,
        owners=new_item.owners,
        target=new_item.target,
        hardDate=new_item.hardDate,
        status=new_item.status,
        attention=new_item.attention,
    )

    items.append(created_item)
    return created_item


def archive_mock_action_item(
    board_id: str,
    item_id: int,
    reason: str,
    actor_id: str,
    archived_at: str,
) -> dict | None:
    items = MOCK_ACTION_ITEMS.get(board_id, [])
    item = next((item for item in items if item.id == item_id), None)
    if item is None:
        return None

    record = {
        "item": item,
        "reason": reason,
        "archivedBy": actor_id,
        "archivedAt": archived_at,
        "isArchived": True,
        "restoredBy": None,
        "restoredAt": None,
    }
    MOCK_ARCHIVED_ACTION_ITEMS.setdefault(board_id, []).append(record)
    items.remove(item)
    return record


def list_mock_archived_action_items(board_id: str) -> list[dict]:
    return [
        record
        for record in MOCK_ARCHIVED_ACTION_ITEMS.get(board_id, [])
        if record.get("isArchived", True)
    ]


def restore_mock_action_item(
    board_id: str,
    item_id: int,
    actor_id: str,
    restored_at: str,
):
    records = MOCK_ARCHIVED_ACTION_ITEMS.get(board_id, [])
    record = next(
        (
            record
            for record in records
            if record["item"].id == item_id and record.get("isArchived", True)
        ),
        None,
    )
    if record is None:
        return None

    MOCK_ACTION_ITEMS.setdefault(board_id, []).append(record["item"])
    record["isArchived"] = False
    record["restoredBy"] = actor_id
    record["restoredAt"] = restored_at
    return record["item"]


def update_mock_action_item(
    board_id: str,
    item_id: int,
    target: str | TargetValue | None = None,
    priority: str | None = None,
    status: str | None = None,
) -> ActionItem | None:
    # update only the fields provided for the selected item
    for item in MOCK_ACTION_ITEMS.get(board_id, []):
        if item.id == item_id:
            if target is not None:
                item.target = target

            if priority is not None:
                item.priority = priority
            if status is not None:
                item.status = status

            return item
    return None


from copy import deepcopy


class MockActionItemRepository:
    def __init__(self, items=None):
        self.items = deepcopy(MOCK_ACTION_ITEMS) if items is None else items

    def list_items(self, board_id):
        return [
            {
                "id": item.id,
                "priority": item.priority,
                "title": item.title,
            }
            for item in self.items.get(board_id, [])
        ]

    def save_priority(self, board_id, item_id, priority):
        for item in self.items.get(board_id, []):
            if item.id == item_id:
                item.priority = priority
                return {
                    "id": item.id,
                    "priority": item.priority,
                    "title": item.title,
                }

        raise ValueError("Action item not found")
