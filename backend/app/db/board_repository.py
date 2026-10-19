from abc import ABC, abstractmethod


class BoardRepository(ABC):
    @abstractmethod
    def save_board(self, board):
        pass

    @abstractmethod
    def get_board(self, board_id):
        pass


# Keeps boards in memory until the PostgreSQL database is set up.
# Data is lost when the server restarts.
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
