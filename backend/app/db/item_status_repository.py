from abc import ABC, abstractmethod
from copy import deepcopy


class ActionItemStore(ABC):
    @abstractmethod
    def get_item(self, board_id, item_id):
        pass

    @abstractmethod
    def save_status(self, board_id, item_id, status):
        pass


class StatusHistoryStore(ABC):
    @abstractmethod
    def add_entry(self, entry):
        pass

    @abstractmethod
    def list_entries(self, board_id, item_id):
        pass


# Sample items until the shared action-item store is merged. Ids and titles
# match the action items table's mock data so the two line up.
SAMPLE_ITEMS = {
    "project-1": [
        {"id": 1, "title": "Review construction drawings", "status": "In Progress"},
        {"id": 2, "title": "Confirm material delivery", "status": "Not Started"},
    ],
    "project-2": [
        {"id": 3, "title": "Schedule owner walkthrough", "status": "Open"},
    ],
    "team-1": [
        {"id": 4, "title": "Update A&E drawing templates", "status": "Open"},
    ],
}


# Kept in memory, so changes are lost when the server restarts.
class InMemoryActionItemStore(ActionItemStore):
    def __init__(self, items=None):
        self.items = deepcopy(SAMPLE_ITEMS if items is None else items)

    def get_item(self, board_id, item_id):
        for item in self.items.get(board_id, []):
            if item["id"] == item_id:
                return {**item, "boardId": board_id}
        return None

    def save_status(self, board_id, item_id, status):
        for item in self.items.get(board_id, []):
            if item["id"] == item_id:
                item["status"] = status
                return {**item, "boardId": board_id}
        return None


class InMemoryStatusHistoryStore(StatusHistoryStore):
    def __init__(self):
        self.entries = []

    def add_entry(self, entry):
        self.entries.append(dict(entry))
        return dict(entry)

    # Newest change first, which is how the history view shows it.
    def list_entries(self, board_id, item_id):
        matching = [
            dict(entry) for entry in self.entries
            if entry["boardId"] == board_id and entry["itemId"] == item_id
        ]
        return list(reversed(matching))
