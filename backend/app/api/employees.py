from fastapi import APIRouter, Depends, Query

from app.api.boards import get_board_service
from app.schemas.employee import EmployeeSummary
from app.services.employee_directory import EmployeeDirectory
from app.services.service_factory import create_services

router = APIRouter(prefix="/api", tags=["Employees"])

_directory = EmployeeDirectory(create_services()["employees"])


# Tests replace this through app.dependency_overrides.
def get_employee_directory():
    return _directory


# Same access check as GET /api/boards/{board_id}: users who can't open the
# board get 404. Returns the board's linked project, if it has one.
def board_project_id(
    board_id: str,
    board_service=Depends(get_board_service),
) -> str | None:
    # Imported here because app.main imports this router.
    from app.main import get_board, get_board_repository, get_current_user_id

    board = get_board(board_id, get_current_user_id(), get_board_repository(), board_service)
    return getattr(board, "projectId", None)


@router.get("/boards/{board_id}/employees", response_model=list[EmployeeSummary])
def find_employees(
    search: str = Query(default="", max_length=100),
    ids: str = Query(default="", max_length=1000),
    project_id: str | None = Depends(board_project_id),
    directory: EmployeeDirectory = Depends(get_employee_directory),
):
    # ?ids=E001,E008 looks up owners already on items; otherwise search by name.
    if ids:
        return directory.find_by_ids([i.strip() for i in ids.split(",") if i.strip()], project_id)
    return directory.search(search, project_id)
