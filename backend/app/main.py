from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, Request

from app.api.auth import get_current_user_id, require_mock_mode, router as auth_router
from app.api.priorities import (
    router as priorities_router,
    priority_service as configured_priorities,
)
from app.adapters.boards import BoardRepository, MockBoardRepository
from app.api.boards import get_board_service, router as boards_router
from app.api.item_status import get_status_service, router as item_status_router
from app.schemas.board import BoardSummary
from app.schemas.boards import Board
from app.services.board_service import BoardService
from app.services.boards import list_accessible_boards
from app.services.service_factory import create_services
from app.adapters.mock_action_items import (
    archive_mock_action_item,
    create_mock_action_item,
    get_mock_action_items,
    list_mock_archived_action_items,
    restore_mock_action_item,
)
from app.schemas.action_item import (
    ActionItem,
    ActionItemCreate,
    ActionItemUpdate,
    ArchiveItemRequest,
    ArchivedActionItemsResponse,
)
from app.adapters.board_sections import WORKSPACE_LOCK, ensure_section
from app.api.workspace import router as workspace_router
from app.api.employees import get_employee_directory, router as employees_router
from app.services.employee_directory import EmployeeDirectory, OwnerAssignmentError
from app.services.status_service import (
    ItemNotFoundError,
    StatusService,
    StatusValidationError,
)
from app.adapters.interfaces import CompanyAdapter
from app.services.board_access import (
    can_open_created_board,
    is_board_admin,
)
from app.services.item_history_service import item_history_service

app = FastAPI(title="FLINT Action Tracker API")
app.include_router(auth_router)
app.include_router(priorities_router)
app.include_router(workspace_router)
services = create_services()


@app.middleware("http")
async def prevent_api_caching(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    return response


def get_company_adapter() -> CompanyAdapter:
    # Override this dependency in tests or when a real adapter is configured.
    return services["companies"]


def validate_owner_organizations(
    owners,
    companies: CompanyAdapter,
    existing_owners=None,
) -> None:
    """Preserve existing company links while validating new assignments."""
    if not owners:
        return

    existing_links = {
        (owner.name, owner.isExternal, owner.organizationId)
        for owner in (existing_owners or [])
        if owner.organizationId is not None
    }

    new_links = []

    for owner in owners:
        if owner.organizationId is None:
            continue

        if not owner.isExternal:
            raise HTTPException(
                status_code=422,
                detail="Only external owners can be assigned an organization.",
            )

        link = (owner.name, owner.isExternal, owner.organizationId)

        if link not in existing_links:
            new_links.append(owner.organizationId)

    if not new_links:
        return

    known = {company["id"] for company in companies.get_companies()}

    for organization_id in new_links:
        if organization_id not in known:
            raise HTTPException(
                status_code=422,
                detail="Choose an organization from the FLINT list.",
            )


def get_board_repository() -> BoardRepository:
    require_mock_mode()
    return MockBoardRepository()


def created_board_summary(board: dict) -> BoardSummary:
    return BoardSummary(
        id=board["id"],
        name=board["name"],
        type=board["type"],
        openItemCount=board.get("openItemCount", 0),
    )


def has_board_access(
    board_id: str,
    user_id: str,
    repository: BoardRepository,
    service: BoardService,
) -> bool:
    if any(
        board.id == board_id for board in list_accessible_boards(user_id, repository)
    ):
        return True

    saved_board = service.get_board(board_id)
    return bool(saved_board and can_open_created_board(saved_board, user_id, service))


app.include_router(boards_router)
app.include_router(item_status_router)
app.include_router(employees_router)


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
    return [
        board.model_copy(
            update={
                "openItemCount": sum(
                    item.status != "Complete"
                    for item in get_mock_action_items(board.id)
                )
            }
        )
        for board in boards
    ]


@app.get("/api/boards/{board_id}", response_model=Board | BoardSummary)
def get_board(
    board_id: str,
    user_id: str = Depends(get_current_user_id),
    repository: BoardRepository = Depends(get_board_repository),
    service: BoardService = Depends(get_board_service),
) -> Board | BoardSummary:
    for board in list_accessible_boards(user_id, repository):
        if board.id == board_id:
            return board.model_copy(
                update={
                    "openItemCount": sum(
                        item.status != "Complete"
                        for item in get_mock_action_items(board_id)
                    )
                }
            )

    # Preserve the saved board's full details, but only for an allowed member.
    saved_board = service.get_board(board_id)
    if saved_board and can_open_created_board(saved_board, user_id, service):
        return Board.model_validate(
            {
                **saved_board,
                "openItemCount": sum(
                    item.status != "Complete"
                    for item in get_mock_action_items(board_id)
                ),
            }
        )
    raise HTTPException(status_code=404, detail="Board not found.")


def require_board_access(
    board_id: str,
    user_id: str,
    repository: BoardRepository,
    service: BoardService,
) -> None:
    require_mock_mode()
    if not has_board_access(board_id, user_id, repository, service):
        raise HTTPException(status_code=404, detail="Board not found.")


@app.get("/api/boards/{board_id}/items", response_model=list[ActionItem])
def get_board_items(
    board_id: str,
    user_id: str = Depends(get_current_user_id),
    repository: BoardRepository = Depends(get_board_repository),
    service: BoardService = Depends(get_board_service),
) -> list[ActionItem]:
    require_board_access(board_id, user_id, repository, service)
    return get_mock_action_items(board_id)


# create an action item on a board the current user can access
@app.post("/api/boards/{board_id}/items", response_model=ActionItem, status_code=201)
def create_board_item(
    board_id: str,
    new_item: ActionItemCreate,
    user_id: str = Depends(get_current_user_id),
    repository: BoardRepository = Depends(get_board_repository),
    service: BoardService = Depends(get_board_service),
    status_service: StatusService = Depends(get_status_service),
    companies: CompanyAdapter = Depends(get_company_adapter),
    directory: EmployeeDirectory = Depends(get_employee_directory),
) -> ActionItem:
    require_board_access(board_id, user_id, repository, service)
    validate_owner_organizations(new_item.owners, companies)

    if not new_item.title.strip():
        raise HTTPException(
            status_code=422,
            detail="Action item title cannot be empty.",
        )

    try:
        configured_priorities.validate_priority(new_item.priority)
        if new_item.status not in status_service.statuses_for_board(board_id):
            raise ValueError("Choose a status on this board.")
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    try:
        new_item.owners = directory.check_owners(new_item.owners)
    except OwnerAssignmentError as error:
        raise HTTPException(status_code=422, detail=error.message) from error
    with WORKSPACE_LOCK:
        ensure_section(board_id, new_item.section)
        created_item = create_mock_action_item(board_id, new_item)
        # a new items fields have no previous values
        item_history_service.record_changes(
            board_id=board_id,
            item_id=created_item.id,
            actor_id=user_id,
            before={},
            after=created_item.model_dump(mode="json"),
        )
        return created_item


@app.patch("/api/boards/{board_id}/items/{item_id}", response_model=ActionItem)
def update_board_item_target(
    board_id: str,
    item_id: int,
    update: ActionItemUpdate,
    user_id: str = Depends(get_current_user_id),
    repository: BoardRepository = Depends(get_board_repository),
    service: BoardService = Depends(get_board_service),
    status_service: StatusService = Depends(get_status_service),
    companies: CompanyAdapter = Depends(get_company_adapter),
    directory: EmployeeDirectory = Depends(get_employee_directory),
) -> ActionItem:
    # Verify board access before allowing an update.
    require_board_access(board_id, user_id, repository, service)

    # Validate every requested value before changing any shared item state.
    if update.priority is not None:
        try:
            configured_priorities.validate_priority(update.priority)
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    with WORKSPACE_LOCK:
        item = next(
            (item for item in get_mock_action_items(board_id) if item.id == item_id),
            None,
        )
        if item is None:
            raise HTTPException(status_code=404, detail="Action item not found.")
        # validate owner assignments before modifying the item
        if update.owners is not None:
            try:
                update.owners = directory.check_owners(update.owners, item.owners)
            except OwnerAssignmentError as error:
                raise HTTPException(status_code=422, detail=error.message) from error

            validate_owner_organizations(
                update.owners,
                companies,
                existing_owners=item.owners,
            )

        # capture the original values for item history
        before = item.model_dump(mode="json")
        if update.status is not None:
            try:
                status_service.change_status(board_id, item_id, update.status, user_id)
            except StatusValidationError as error:
                raise HTTPException(status_code=422, detail=error.message) from error
            except ItemNotFoundError as error:
                raise HTTPException(
                    status_code=404, detail="Action item not found."
                ) from error
        for field in update.model_fields_set - {"status"}:
            setattr(item, field, getattr(update, field))

        item_history_service.record_changes(
            board_id=board_id,
            item_id=item_id,
            actor_id=user_id,
            before=before,
            after=item.model_dump(mode="json"),
        )
        return item


@app.get(
    "/api/boards/{board_id}/items/archived",
    response_model=ArchivedActionItemsResponse,
)
def get_archived_board_items(
    board_id: str,
    user_id: str = Depends(get_current_user_id),
    repository: BoardRepository = Depends(get_board_repository),
    service: BoardService = Depends(get_board_service),
) -> ArchivedActionItemsResponse:
    require_board_access(board_id, user_id, repository, service)
    with WORKSPACE_LOCK:
        archived_items = list_mock_archived_action_items(board_id)
    return ArchivedActionItemsResponse(
        archivedItems=archived_items,
        canRestore=is_board_admin(board_id, user_id, service),
    )


@app.post(
    "/api/boards/{board_id}/items/{item_id}/archive",
    response_model=ActionItem,
)
def archive_board_item(
    board_id: str,
    item_id: int,
    data: ArchiveItemRequest,
    user_id: str = Depends(get_current_user_id),
    repository: BoardRepository = Depends(get_board_repository),
    service: BoardService = Depends(get_board_service),
) -> ActionItem:
    require_board_access(board_id, user_id, repository, service)
    with WORKSPACE_LOCK:
        record = archive_mock_action_item(
            board_id,
            item_id,
            data.reason,
            user_id,
            datetime.now(timezone.utc).isoformat(),
        )
    if record is None:
        raise HTTPException(status_code=404, detail="Action item not found.")
    return record["item"]


@app.post(
    "/api/boards/{board_id}/items/{item_id}/restore",
    response_model=ActionItem,
)
def restore_board_item(
    board_id: str,
    item_id: int,
    user_id: str = Depends(get_current_user_id),
    repository: BoardRepository = Depends(get_board_repository),
    service: BoardService = Depends(get_board_service),
) -> ActionItem:
    require_board_access(board_id, user_id, repository, service)
    if not is_board_admin(board_id, user_id, service):
        raise HTTPException(
            status_code=403,
            detail="Only a board admin can restore archived items.",
        )
    with WORKSPACE_LOCK:
        item = restore_mock_action_item(
            board_id,
            item_id,
            user_id,
            datetime.now(timezone.utc).isoformat(),
        )
    if item is None:
        raise HTTPException(status_code=404, detail="Archived item not found.")
    return item


def check_access(x_mock_role: str = Header(default="viewer")):
    if x_mock_role not in ("viewer", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")


@app.get("/")
def home():
    return {"message": "FLINT Action Tracker API is running"}


@app.get("/api/projects", dependencies=[Depends(get_current_user_id), Depends(check_access)])
def get_projects():
    return services["projects"].get_projects()


@app.get("/api/employees", dependencies=[Depends(get_current_user_id), Depends(check_access)])
def get_employees():
    return services["employees"].get_employees()


@app.get("/api/groups", dependencies=[Depends(get_current_user_id)])
def get_groups():
    return services["groups"].get_groups()


@app.get("/api/organizations", dependencies=[Depends(get_current_user_id), Depends(check_access)])
def get_organizations():
    return services["organizations"].get_organizations()


@app.get("/api/companies", dependencies=[Depends(get_current_user_id), Depends(check_access)])
def get_companies(companies: CompanyAdapter = Depends(get_company_adapter)):
    return companies.get_companies()
