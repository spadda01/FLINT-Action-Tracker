
# AT-165: Configurable priority levels for action items.

DEFAULT_PRIORITIES = [
    {"name": "High", "rank": 1},
    {"name": "Medium", "rank": 2},
    {"name": "Low", "rank": 3},
]


class PriorityService:
    def __init__(self, levels=None):
        self.levels = levels if levels is not None else DEFAULT_PRIORITIES

    def get_levels(self):
        return [dict(level) for level in self.levels]

    def validate_priority(self, priority):
        allowed = [level["name"] for level in self.levels]
        if priority not in allowed:
            raise ValueError("Invalid priority")
        return priority

    def sort_items(self, items):
        ranks = {
            level["name"]: level["rank"]
            for level in self.levels
        }
        return sorted(
            items,
            key=lambda item: ranks.get(item["priority"], float("inf"))
        )

    def filter_items(self, items, priority):
        self.validate_priority(priority)
        return [
            item for item in items
            if item["priority"] == priority
        ]

    def update_priority(self, items, item_id, new_priority):
        self.validate_priority(new_priority)

        for item in items:
            if item["id"] == item_id:
                item["priority"] = new_priority
                return item.copy()

        raise ValueError("Action item not found")
