from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse

from app.api.boards import get_board_service
from app.db.item_status_repository import (
    InMemoryActionItemStore,
    InMemoryStatusHistoryStore,
)
from app.schemas.item_status import (
    StatusChangeRequest,
    StatusChangeResult,
    StatusHistoryEntry,
)
from app.services.status_service import (
    ItemNotFoundError,
    StatusService,
    StatusValidationError,
)

router = APIRouter(prefix="/api", tags=["Item status"])

_status_service = StatusService(InMemoryActionItemStore(), InMemoryStatusHistoryStore())


# Tests replace this with a fresh service through app.dependency_overrides.
def get_status_service():
    return _status_service


# Returns the signed-in user if they can open the board. Uses the same
# identity and board access rules as GET /api/boards/{board_id}, so a user
# who can't see a board can't read or change its items either (404).
def require_board_member(
    board_id: str,
    board_service=Depends(get_board_service),
) -> str:
    # Imported here because app.main imports this router.
    from app.main import get_board, get_board_repository, get_current_user_id

    user_id = get_current_user_id()
    get_board(board_id, user_id, get_board_repository(), board_service)
    return user_id


def _item_not_found():
    return HTTPException(status_code=404, detail="Action item not found.")


@router.get("/boards/{board_id}/statuses", response_model=list[str])
def get_board_statuses(
    board_id: str,
    _user_id: str = Depends(require_board_member),
    service: StatusService = Depends(get_status_service),
):
    return service.statuses_for_board(board_id)


@router.patch(
    "/boards/{board_id}/items/{item_id}/status",
    response_model=StatusChangeResult,
)
def change_item_status(
    board_id: str,
    item_id: int,
    data: StatusChangeRequest,
    user_id: str = Depends(require_board_member),
    service: StatusService = Depends(get_status_service),
):
    try:
        return service.change_status(board_id, item_id, data.status, user_id)
    except StatusValidationError as error:
        # Same {"errors": {field: message}} shape as the team board form uses.
        return JSONResponse(status_code=422, content={"errors": {"status": error.message}})
    except ItemNotFoundError:
        raise _item_not_found()


@router.get(
    "/boards/{board_id}/items/{item_id}/history",
    response_model=list[StatusHistoryEntry],
)
def get_item_status_history(
    board_id: str,
    item_id: int,
    _user_id: str = Depends(require_board_member),
    service: StatusService = Depends(get_status_service),
):
    try:
        return service.get_history(board_id, item_id)
    except ItemNotFoundError:
        raise _item_not_found()
