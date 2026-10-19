from app.adapters.boards import BoardRepository
from app.schemas.board import BoardSummary

def list_accessible_boards(user_id: str, repository: BoardRepository) -> list[BoardSummary]:
    #check access on the server and hide any archived boards
    accessible_boards = [board for board in repository.list_boards()
        if not board.isArchived and user_id in board.memberIds
    ]

    # returns only the fields the interface needs
    return [
        BoardSummary(id=board.id, name=board.name, type=board.type, openItemCount=board.openItemCount)
        for board in accessible_boards
    ]