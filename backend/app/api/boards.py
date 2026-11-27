from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.db.board_repository import InMemoryBoardRepository
from app.schemas.boards import Board, TeamBoardCreate, BoardMemberInput
from app.services.board_service import BoardService, BoardValidationError
from app.services.service_factory import create_services

router = APIRouter(prefix="/api")

_services = create_services()
_board_service = BoardService(
    InMemoryBoardRepository(),
    _services["employees"],
    _services["groups"],
)


# Tests replace this with a fresh service through app.dependency_overrides.
def get_board_service():
    return _board_service

from pydantic import BaseModel


class BoardMembersUpdate(BaseModel):
    members: list[BoardMemberInput]


def _current_user_id():
    from app.main import get_current_user_id

    return get_current_user_id()


@router.post("/boards/team", response_model=Board, status_code=201)
def create_team_board(
    data: TeamBoardCreate,
    service: BoardService = Depends(get_board_service),
):
    try:
        return service.create_team_board(data, _current_user_id())
    except BoardValidationError as error:
        # {"errors": {field: message}} lets the form show each message beside its field.
        return JSONResponse(status_code=422, content={"errors": error.errors})


@router.post("/boards/project", response_model=Board, status_code=201)
def create_project_board(
    data: TeamBoardCreate,
    service: BoardService = Depends(get_board_service),
):
    try:
        return service.create_project_board(
            data, _services["projects"].get_projects(), _current_user_id()
        )
    except BoardValidationError as error:
        return JSONResponse(status_code=422, content={"errors": error.errors})
    
@router.patch("/boards/{board_id}/members", response_model=Board)
def update_board_members(
    board_id: str,
    data: BoardMembersUpdate,
    service: BoardService = Depends(get_board_service),
):
    from app.services.board_access import is_board_admin

    user_id = _current_user_id()

    board = service.get_board(board_id)
    if board is None:
        return JSONResponse(
            status_code=404,
            content={"detail": "Board not found."},
        )

    if not is_board_admin(board_id, user_id, service):
        return JSONResponse(
            status_code=403,
            content={"detail": "Only a board admin can manage board members."},
        )

    try:
        updated = service.update_members(board_id, data.members)

        if updated is None:
            return JSONResponse(
                status_code=404,
                content={"detail": "Board not found."},
            )

        return updated

    except BoardValidationError as error:
        return JSONResponse(
            status_code=422,
            content={"errors": error.errors},
        )
