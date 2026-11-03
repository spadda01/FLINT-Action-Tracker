from pydantic import BaseModel
from app.schemas.action_items import TargetValue


class ActionOwner(BaseModel):
    name: str
    isExternal: bool


class ActionItem(BaseModel):
    id: int
    section: str
    priority: str
    title: str
    owners: list[ActionOwner]
    target: str | TargetValue
    hardDate: str | None
    status: str
    attention: bool


# data required when creating an action item
class ActionItemCreate(BaseModel):
    title: str
    section: str = "General"
    priority: str = "Medium"
    target: str = ""
    status: str = "Not Started"
