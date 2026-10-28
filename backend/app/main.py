import os

from fastapi import Depends, FastAPI, Header, HTTPException

from app.adapters.boards import BoardRepository, MockBoardRepository
from app.api.boards import get_board_service, router as boards_router
from app.schemas.board import BoardSummary
from app.schemas.boards import Board
from app.services.board_service import BoardService
from app.services.boards import list_accessible_boards
from app.services.service_factory import create_services
from app.adapters.mock_action_items import (
    get_mock_action_items,
    update_mock_action_item,
)
from app.schemas.action_item import ActionItem
from pydantic import BaseModel


class ActionItemUpdate(BaseModel):
    target: str | None = None
    priority: str | None = None


app = FastAPI(title="FLINT Action Tracker API")
services = create_services()

# Map our board-list mock identities to the shared employee adapter's IDs.
MOCK_EMPLOYEE_IDS = {
    "user-1": "E001",
    "user-2": "E002",
    "user-3": "E003",
}


def require_mock_mode() -> None:
    if os.getenv("APP_MODE") != "mock":
        raise HTTPException(
            status_code=503, detail="Backend integration is not configured."
        )


def get_current_user_id() -> str:
    require_mock_mode()
    user_id = os.getenv("MOCK_USER_ID", "user-1")
    if user_id not in MOCK_EMPLOYEE_IDS:
        raise HTTPException(status_code=401, detail="The mock user is not recognized.")
    return user_id


def get_board_repository() -> BoardRepository:
    require_mock_mode()
    return MockBoardRepository()


def can_open_created_board(board: dict, user_id: str, service: BoardService) -> bool:
    if board.get("isArchived", False):
        return False
    employee_id = MOCK_EMPLOYEE_IDS[user_id]
    group_ids = {
        group["id"]
        for group in service.groups.get_groups()
        if employee_id in group.get("memberIds", [])
    }
    return any(
        (member["type"] == "user" and member["id"] == employee_id)
        or (member["type"] == "group" and member["id"] in group_ids)
        for member in board.get("members", [])
    )


def created_board_summary(board: dict) -> BoardSummary:
    return BoardSummary(
        id=board["id"],
        name=board["name"],
        type=board["type"],
        openItemCount=board.get("openItemCount", 0),
    )


# Keep team-board creation on the shared router, with mock identity checks.
app.include_router(boards_router, dependencies=[Depends(get_current_user_id)])


@app.get("/api/me")
def get_me(user_id: str = Depends(get_current_user_id)) -> dict[str, str]:
    return {"id": user_id}


@app.get("/api/boards", response_model=list[BoardSummary])
def get_boards(
    user_id: str = Depends(get_current_user_id),
    repository: BoardRepository = Depends(get_board_repository),
    service: BoardService = Depends(get_board_service),
) -> list[BoardSummary]:
    # Combine sample boards and saved boards after checking access to each.
    boards = list_accessible_boards(user_id, repository)
    boards.extend(
        created_board_summary(board)
        for board in service.repository.list_boards()
        if can_open_created_board(board, user_id, service)
    )
    return boards


@app.get("/api/boards/{board_id}", response_model=Board | BoardSummary)
def get_board(
    board_id: str,
    user_id: str = Depends(get_current_user_id),
    repository: BoardRepository = Depends(get_board_repository),
    service: BoardService = Depends(get_board_service),
) -> Board | BoardSummary:
    for board in list_accessible_boards(user_id, repository):
        if board.id == board_id:
            return board

    # Preserve the saved board's full details, but only for an allowed member.
    saved_board = service.get_board(board_id)
    if saved_board and can_open_created_board(saved_board, user_id, service):
        return Board.model_validate(saved_board)
    raise HTTPException(status_code=404, detail="Board not found.")


@app.get("/api/boards/{board_id}/items", response_model=list[ActionItem])
def get_board_items(
    board_id: str,
    user_id: str = Depends(get_current_user_id),
    repository: BoardRepository = Depends(get_board_repository),
    service: BoardService = Depends(get_board_service),
) -> list[ActionItem]:
    # Reuse board access checks before returning its action items.
    get_board(board_id, user_id, repository, service)
    return get_mock_action_items(board_id)


@app.patch("/api/boards/{board_id}/items/{item_id}", response_model=ActionItem)
def update_board_item_target(
    board_id: str,
    item_id: int,
    update: ActionItemUpdate,
    user_id: str = Depends(get_current_user_id),
    repository: BoardRepository = Depends(get_board_repository),
    service: BoardService = Depends(get_board_service),
) -> ActionItem:
    # Verify board access before allowing an update.
    get_board(board_id, user_id, repository, service)

    updated_item = update_mock_action_item(board_id, item_id, target=update.target, priority=update.priority)

    if updated_item is None:
        raise HTTPException(
            status_code=404,
            detail="Action item not found.",
        )

    return updated_item


def check_access(x_mock_role: str = Header(default="viewer")):
    if x_mock_role not in ("viewer", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")


@app.get("/")
def home():
    return {"message": "FLINT Action Tracker API is running"}


@app.get("/api/projects", dependencies=[Depends(check_access)])
def get_projects():
    return services["projects"].get_projects()


@app.get("/api/employees", dependencies=[Depends(check_access)])
def get_employees():
    return services["employees"].get_employees()


@app.get("/api/groups")
def get_groups():
    return services["groups"].get_groups()


@app.get("/api/organizations", dependencies=[Depends(check_access)])
def get_organizations():
    return services["organizations"].get_organizations()
