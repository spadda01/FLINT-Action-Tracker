from pydantic import BaseModel


class ActionOwner(BaseModel):
    name: str
    isExternal: bool


class ActionItem(BaseModel):
    id: int
    priority: str
    title: str
    owners: list[ActionOwner]
    target: str
    hardDate: str | None
    status: str
    attention: bool