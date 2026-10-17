from typing import List, Literal, Optional

from pydantic import BaseModel


class BoardMemberInput(BaseModel):
    id: str = ""
    type: str = ""


# Fields default to empty so missing values reach the service validator
# and come back as field-level messages instead of a generic 422.
class TeamBoardCreate(BaseModel):
    name: str = ""
    members: List[BoardMemberInput] = []
    egnyteFolderUrl: str = ""
    projectId: Optional[str] = None


class BoardMember(BaseModel):
    id: str
    type: Literal["user", "group"]
    name: str


# Project and team boards share this shape so sections, items and views
# can attach to either by board id.
class Board(BaseModel):
    id: str
    name: str
    type: Literal["Project", "Team"]
    projectId: Optional[str]
    members: List[BoardMember]
    egnyteFolderUrl: str
    createdAt: str
