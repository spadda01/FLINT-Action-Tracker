from typing import Protocol

from app.schemas.board import BoardRecord


class BoardRepository(Protocol):
    def list_boards(self) -> list[BoardRecord]:
        ...


class MockBoardRepository:
    def list_boards(self) -> list[BoardRecord]:
        return [
            BoardRecord(id="project-1", name="Sample Project", type="Project", openItemCount=5, memberIds=["user-1"]),
            BoardRecord(id="project-2", name="Sample Office Renovation", type="Project", openItemCount=12, memberIds=["user-1", "user-2"]),
            BoardRecord(id="team-1", name="Sample A&E Team", type="Team", openItemCount=8, memberIds=["user-1"]),
            BoardRecord(id="team-2", name="Sample Operations Team", type="Team", openItemCount=3, memberIds=["user-1", "user-2"]),
            BoardRecord(id="project-archived", name="Sample Archived Project", type="Project", openItemCount=0, isArchived=True, memberIds=["user-1"],),
            BoardRecord(id="team-restricted", name="Sample Restricted Team", type="Team", openItemCount=4, memberIds=["user-2"]),
        ]