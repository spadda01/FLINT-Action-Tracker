
# AT-165: Mock priority API for action items.

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.adapters.boards import MockBoardRepository
from app.adapters.mock_action_items import MockActionItemRepository
from app.services.priority_permissions import can_edit_priority
from app.services.priority_service import PriorityService

router = APIRouter(prefix="/api", tags=["Priorities"])

priority_service = PriorityService()
item_repository = MockActionItemRepository()
board_repository = MockBoardRepository()


class PriorityUpdate(BaseModel):
    priority: str

def get_mock_user():
    import os

    if os.getenv("APP_MODE") != "mock":
        raise HTTPException(
            status_code=503,
            detail="Backend integration is not configured."
        )

    user_id = os.getenv("MOCK_USER_ID", "user-1")

    if user_id not in ("user-1", "user-2", "user-3"):
        raise HTTPException(
            status_code=401,
            detail="The mock user is not recognized."
        )

    return user_id

@router.get("/priorities")
def get_priorities():
    return priority_service.get_levels()


@router.get("/boards/{board_id}/items")
def list_items(
    board_id: str,
    priority: str | None = None,
    sort: bool = False,
    user_id: str = Depends(get_mock_user),
):
    if not can_edit_priority(user_id, board_id, board_repository):
        raise HTTPException(status_code=403, detail="Access denied")

    items = item_repository.list_items(board_id)

    if priority is not None:
        try:
            items = priority_service.filter_items(items, priority)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid priority")

    if sort:
        items = priority_service.sort_items(items)

    return items


@router.patch("/boards/{board_id}/items/{item_id}/priority")
def update_item_priority(
    board_id: str,
    item_id: int,
    data: PriorityUpdate,
    user_id: str = Depends(get_mock_user),
):
    if not can_edit_priority(user_id, board_id, board_repository):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        priority_service.validate_priority(data.priority)
        return item_repository.save_priority(
            board_id, item_id, data.priority
        )
    except ValueError as error:
        if str(error) == "Invalid priority":
            raise HTTPException(status_code=422, detail=str(error))
        raise HTTPException(status_code=404, detail=str(error))
