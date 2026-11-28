"""Development storage for each board's column layout (visibility and order)."""
from threading import RLock

COLUMN_IDS = ("item", "owners", "target", "status", "priority", "attention")

_LOCK = RLock()
MOCK_BOARD_COLUMNS: dict[str, list[dict]] = {}


def default_columns() -> list[dict]:
    return [{"id": column_id, "visible": True} for column_id in COLUMN_IDS]


def get_columns(board_id: str) -> list[dict]:
    with _LOCK:
        saved = MOCK_BOARD_COLUMNS.get(board_id)
        return [dict(c) for c in saved] if saved else default_columns()


def save_columns(board_id: str, columns: list[dict]) -> list[dict]:
    with _LOCK:
        MOCK_BOARD_COLUMNS[board_id] = [dict(c) for c in columns]
        return get_columns(board_id)
