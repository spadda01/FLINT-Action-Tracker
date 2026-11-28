from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.adapters.mock_board_columns import COLUMN_IDS, get_columns, save_columns
from app.api.item_status import require_board_member

# Column layout is saved per board and shared by everyone who opens it.
router = APIRouter(
    prefix="/api/boards/{board_id}",
    tags=["Board columns"],
    dependencies=[Depends(require_board_member)],
)


class ColumnSetting(BaseModel):
    id: Literal["item", "owners", "target", "status", "priority", "attention"]
    visible: bool


class ColumnLayout(BaseModel):
    columns: list[ColumnSetting]


@router.get("/columns", response_model=ColumnLayout)
def read_columns(board_id: str) -> ColumnLayout:
    return ColumnLayout(columns=get_columns(board_id))


@router.put("/columns", response_model=ColumnLayout)
def update_columns(board_id: str, layout: ColumnLayout) -> ColumnLayout:
    ids = [column.id for column in layout.columns]
    # Only the supported columns, each once: custom columns are out of scope.
    if sorted(ids) != sorted(COLUMN_IDS):
        raise HTTPException(status_code=422, detail="Include every supported column exactly once.")
    if not next(c for c in layout.columns if c.id == "item").visible:
        raise HTTPException(status_code=422, detail="The item column can't be hidden.")
    saved = save_columns(board_id, [column.model_dump() for column in layout.columns])
    return ColumnLayout(columns=saved)
