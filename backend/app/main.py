import os

from fastapi import Depends, FastAPI, HTTPException

from app.adapters.boards import BoardRepository, MockBoardRepository
from app.schemas.board import BoardSummary
from app.services.boards import list_accessible_boards

app = FastAPI(title="FLINT Action Tracker API")

def require_mock_mode() -> None:
    # mock access has to be enabled for local development.
    if os.getenv("APP_MODE") != "mock":
        raise HTTPException(status_code=503, detail="Backend integration is not configured.",)

def get_current_user_id() -> str:
    require_mock_mode()

    # the server selects the mock identity. So replace with Entra ID later
    user_id = os.getenv("MOCK_USER_ID", "user-1")

    if user_id not in {"user-1", "user-2", "user-3"}:
        raise HTTPException(status_code=401, detail="The mock user is not recognized.",)
    return user_id

def get_board_repository() -> BoardRepository:
    require_mock_mode()
    return MockBoardRepository()

@app.get("/api/boards", response_model=list[BoardSummary])
def get_boards(
    user_id: str = Depends(get_current_user_id),
    repository: BoardRepository = Depends(get_board_repository)) -> list[BoardSummary]:
    # filter the records before any board data leaves the server
    return list_accessible_boards(user_id, repository)