"""Development section storage shared by the board's views and item moves."""
from threading import RLock
from uuid import uuid4

from app.adapters.mock_action_items import MOCK_ACTION_ITEMS

WORKSPACE_LOCK = RLock()
MOCK_SECTIONS: dict[str, list[dict[str, str]]] = {}


def section_name(value: str) -> str:
    return value.strip() or "General"


def list_sections(board_id: str) -> list[dict[str, str]]:
    with WORKSPACE_LOCK:
        sections = MOCK_SECTIONS.setdefault(board_id, [])
        names = {s["name"] for s in sections}
        # Existing clients still supply a section name with each item.
        for item in MOCK_ACTION_ITEMS.get(board_id, []):
            name = section_name(item.section)
            if name not in names:
                sections.append({"id": str(uuid4()), "name": name})
                names.add(name)
        if not sections:
            sections.append({"id": str(uuid4()), "name": "General"})
        return [dict(s) for s in sections]


def ensure_section(board_id: str, name: str) -> None:
    name = section_name(name)
    with WORKSPACE_LOCK:
        sections = list_sections(board_id)
        if not any(s["name"] == name for s in sections):
            MOCK_SECTIONS[board_id].append({"id": str(uuid4()), "name": name})
