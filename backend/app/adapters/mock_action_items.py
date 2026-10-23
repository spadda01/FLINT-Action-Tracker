
# AT-165: Temporary mock action-item storage.
# Replace with the shared action-item adapter when available.

from copy import deepcopy


class MockActionItemRepository:
    def __init__(self):
        self.items = {
            "project-1": [
                {
                    "id": 1,
                    "priority": "High",
                    "title": "Review construction drawings",
                },
                {
                    "id": 2,
                    "priority": "Medium",
                    "title": "Confirm material delivery",
                },
            ]
        }

    def list_items(self, board_id):
        return deepcopy(self.items.get(board_id, []))

    def save_priority(self, board_id, item_id, priority):
        for item in self.items.get(board_id, []):
            if item["id"] == item_id:
                item["priority"] = priority
                return deepcopy(item)

        raise ValueError("Action item not found")
