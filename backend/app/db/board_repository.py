from abc import ABC, abstractmethod


class BoardRepository(ABC):
    @abstractmethod
    def save_board(self, board):
        pass

    @abstractmethod
    def get_board(self, board_id):
        pass

    @abstractmethod
    def list_boards(self):
        pass


# Temporary storage; boards are lost when the server restarts.
class InMemoryBoardRepository(BoardRepository):
    def __init__(self):
        self.boards = {}
        self.next_id = 1

    def save_board(self, board):
        board_id = "B" + str(self.next_id).zfill(3)
        self.next_id += 1

        saved = {**board, "id": board_id}
        self.boards[board_id] = saved

        return saved

    def get_board(self, board_id):
        return self.boards.get(board_id)

    # Return saved boards so the API can filter them by access.
    def list_boards(self):
        return list(self.boards.values())