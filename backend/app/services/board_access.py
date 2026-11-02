from app.services.board_service import BoardService
from app.adapters.boards import BoardRepository

MOCK_EMPLOYEE_IDS = {
    "user-1": "E001",
    "user-2": "E002",
    "user-3": "E003",
}


def can_open_created_board(
    board: dict,
    user_id: str,
    service: BoardService,
) -> bool:
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


def can_access_board(
    board_id: str,
    user_id: str,
    repository: BoardRepository,
    service: BoardService,
) -> bool:
    # Check membership and archive status for predefined boards.
    for board in repository.list_boards():
        if board.id == board_id:
            return not board.isArchived and user_id in board.memberIds

    # Check individual and group membership for created boards.
    created_board = service.get_board(board_id)

    if created_board is None:
        return False

    return can_open_created_board(created_board, user_id, service)
