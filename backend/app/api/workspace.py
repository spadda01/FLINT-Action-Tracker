from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.item_status import require_board_member
from app.adapters.board_sections import (
    MOCK_SECTIONS,
    WORKSPACE_LOCK,
    list_sections,
    section_name,
)
from app.adapters.mock_action_items import MOCK_ACTION_ITEMS
from app.schemas.action_item import ActionItem
from app.services.item_history_service import item_history_service

router = APIRouter(
    prefix="/api/boards/{board_id}",
    tags=["Board workspace"],
    dependencies=[Depends(require_board_member)],
)


class SectionInput(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class SectionOrder(BaseModel):
    sectionIds: list[str]


class ItemMove(BaseModel):
    sectionId: str
    beforeItemId: int | None = None


@router.get("/sections")
def get_sections(board_id: str):
    return list_sections(board_id)


def validate_name(board_id: str, value: str, exclude_id: str | None = None):
    name = value.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Section name is required.")
    if any(
        s["id"] != exclude_id and s["name"].casefold() == name.casefold()
        for s in list_sections(board_id)
    ):
        raise HTTPException(
            status_code=422, detail="A section with this name already exists."
        )
    return name


@router.post("/sections", status_code=201)
def add_section(board_id: str, data: SectionInput):
    from uuid import uuid4

    with WORKSPACE_LOCK:
        name = validate_name(board_id, data.name)
        section = {"id": str(uuid4()), "name": name}
        MOCK_SECTIONS[board_id].append(section)
        return dict(section)


@router.put("/sections/order")
def reorder_sections(board_id: str, data: SectionOrder):
    with WORKSPACE_LOCK:
        sections = list_sections(board_id)
        by_id = {s["id"]: s for s in sections}
        if len(data.sectionIds) != len(by_id) or set(data.sectionIds) != set(by_id):
            raise HTTPException(
                status_code=422, detail="Include every section exactly once."
            )
        MOCK_SECTIONS[board_id] = [by_id[sid] for sid in data.sectionIds]
        return list_sections(board_id)


@router.patch("/sections/{section_id}")
def rename_section(
    board_id: str,
    section_id: str,
    data: SectionInput,
    user_id: str = Depends(require_board_member),
):
    with WORKSPACE_LOCK:
        list_sections(board_id)
        section = next(
            (s for s in MOCK_SECTIONS[board_id] if s["id"] == section_id), None
        )
        if section is None:
            raise HTTPException(status_code=404, detail="Section not found.")
        name = validate_name(board_id, data.name, section_id)
        old_name = section["name"]
        for item in MOCK_ACTION_ITEMS.get(board_id, []):
            if section_name(item.section) == old_name:
                before = item.model_dump(mode="json")
                item.section = name
                # record the section change for each affected item
                item_history_service.record_changes(
                    board_id=board_id,
                    item_id=item.id,
                    actor_id=user_id,
                    before=before,
                    after=item.model_dump(mode="json"),
                )
        section["name"] = name
        return dict(section)


@router.post("/items/{item_id}/move", response_model=list[ActionItem])
def move_item(
    board_id: str,
    item_id: int,
    data: ItemMove,
    user_id: str = Depends(require_board_member),
):
    with WORKSPACE_LOCK:
        sections = list_sections(board_id)
        destination = next((s for s in sections if s["id"] == data.sectionId), None)
        if destination is None:
            raise HTTPException(
                status_code=422, detail="Choose a section on this board."
            )
        items = MOCK_ACTION_ITEMS.get(board_id, [])
        moving = next((item for item in items if item.id == item_id), None)
        if moving is None:
            raise HTTPException(status_code=404, detail="Action item not found.")
        if data.beforeItemId == item_id:
            return items
        before = next((item for item in items if item.id == data.beforeItemId), None)
        if data.beforeItemId is not None and (
            before is None or section_name(before.section) != destination["name"]
        ):
            raise HTTPException(
                status_code=422,
                detail="The drop target is no longer in this section. Try again.",
            )
        remaining = [item for item in items if item.id != item_id]
        if before is not None:
            index = remaining.index(before)
        else:
            same_section = [
                i
                for i, item in enumerate(remaining)
                if section_name(item.section) == destination["name"]
            ]
            index = same_section[-1] + 1 if same_section else len(remaining)
        before_values = moving.model_dump(mode="json")
        moving.section = destination["name"]
        remaining.insert(index, moving)
        MOCK_ACTION_ITEMS[board_id] = remaining

        item_history_service.record_changes(
            board_id=board_id,
            item_id=item_id,
            actor_id=user_id,
            before=before_values,
            after=moving.model_dump(mode="json"),
        )
        return remaining
