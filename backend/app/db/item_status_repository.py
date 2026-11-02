from abc import ABC, abstractmethod

from app.adapters.mock_action_items import MOCK_ACTION_ITEMS


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


# Reads and writes the same action items as the action items table
# (MOCK_ACTION_ITEMS), so a status change shows up in the table too.
# Kept in memory, so changes are lost when the server restarts.
class InMemoryActionItemStore(ActionItemStore):
    # Tests pass their own items so they don't change the shared ones.
    def __init__(self, items=None):
        self.items = MOCK_ACTION_ITEMS if items is None else items

    def _find(self, board_id, item_id):
        for item in self.items.get(board_id, []):
            if item.id == item_id:
                return item
        return None

    @staticmethod
    def _summary(board_id, item):
        return {"id": item.id, "boardId": board_id, "title": item.title, "status": item.status}

    def get_item(self, board_id, item_id):
        item = self._find(board_id, item_id)
        return None if item is None else self._summary(board_id, item)

    def save_status(self, board_id, item_id, status):
        item = self._find(board_id, item_id)
        if item is None:
            return None
        item.status = status
        return self._summary(board_id, item)


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
