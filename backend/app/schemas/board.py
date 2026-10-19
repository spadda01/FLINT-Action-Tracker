from typing import Literal

from pydantic import BaseModel, Field


class BoardSummary(BaseModel): #BoardSummary will define the fields that react will receive
    id: str
    name: str
    type: Literal["Project", "Team"]
    openItemCount: int = Field(ge=0) # prevents negative 


class BoardRecord(BoardSummary): # BaordRecord adds information on archive and membership for filtering on the server side
    isArchived: bool = False
    memberIds: list[str] = Field(default_factory=list)