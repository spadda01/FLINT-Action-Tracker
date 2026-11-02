from datetime import datetime, timezone
from threading import Lock

# Initial statuses agreed with the client for story 5.3, in display order.
DEFAULT_STATUSES = [
    "Open",
    "Not Started",
    "In Progress",
    "Scheduled",
    "Outstanding",
    "Complete",
]


class StatusValidationError(Exception):
    def __init__(self, message):
        super().__init__(message)
        self.message = message


class ItemNotFoundError(Exception):
    pass


def _utc_now():
    return datetime.now(timezone.utc).isoformat()


class StatusService:
    # now is passed in so tests can control the recorded time.
    def __init__(self, items, history, now=_utc_now):
        self.items = items
        self.history = history
        self.now = now
        # Requests run on separate threads. Only one status change at a time,
        # so each history entry's old status is the one the last change saved.
        self._change_lock = Lock()

    # Every board uses the default list for now; this is where a board's
    # own status list would be looked up once boards can configure one.
    def statuses_for_board(self, board_id):
        return list(DEFAULT_STATUSES)

    def get_item(self, board_id, item_id):
        item = self.items.get_item(board_id, item_id)
        if item is None:
            raise ItemNotFoundError()
        return item

    def change_status(self, board_id, item_id, new_status, actor_id):
        new_status = new_status.strip()
        allowed = self.statuses_for_board(board_id)

        if not new_status:
            raise StatusValidationError("Status is required.")
        if new_status not in allowed:
            raise StatusValidationError(
                f"{new_status} is not a status on this board. Choose one of: {', '.join(allowed)}."
            )

        # Read, save and record as one step, so two users changing the same
        # item at once can't both read the same old status.
        with self._change_lock:
            item = self.get_item(board_id, item_id)
            old_status = item["status"]

            # Picking the same status again changes nothing, so no history row.
            if old_status == new_status:
                return {"item": item, "change": None}

            updated = self.items.save_status(board_id, item_id, new_status)
            change = self.history.add_entry({
                "itemId": item_id,
                "boardId": board_id,
                "actorId": actor_id,
                "changedAt": self.now(),
                "oldStatus": old_status,
                "newStatus": new_status,
            })

        return {"item": updated, "change": change}

    def get_history(self, board_id, item_id):
        # Confirms the item exists so an unknown item gives 404, not an empty list.
        self.get_item(board_id, item_id)
        return self.history.list_entries(board_id, item_id)
