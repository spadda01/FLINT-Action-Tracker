from pydantic import BaseModel


class ActionOwner(BaseModel):
    name: str
    isExternal: bool


class ActionItem(BaseModel):
    id: int
    section: str
    priority: str
    title: str
    owners: list[ActionOwner]
    target: str
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
