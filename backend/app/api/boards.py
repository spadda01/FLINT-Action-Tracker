from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.db.board_repository import InMemoryBoardRepository
from app.schemas.boards import Board, TeamBoardCreate
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


@router.post("/boards/team", response_model=Board, status_code=201)
def create_team_board(
    data: TeamBoardCreate,
    service: BoardService = Depends(get_board_service),
):
    try:
        return service.create_team_board(data)
    except BoardValidationError as error:
        # {"errors": {field: message}} lets the form show each message beside its field.
        return JSONResponse(status_code=422, content={"errors": error.errors})
