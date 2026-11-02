
# AT-165: Mock board permission checks for priority updates.

from app.adapters.boards import BoardRepository


def can_edit_priority(
    user_id: str,
    board_id: str,
    repository: BoardRepository,
) -> bool:
    for board in repository.list_boards():
        if board.id == board_id:
            return (
                not board.isArchived
                and user_id in board.memberIds
            )

    return False
