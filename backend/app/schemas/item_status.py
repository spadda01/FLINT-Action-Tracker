from typing import Optional

from pydantic import BaseModel


# Defaults to empty so a missing status reaches the service and gets a clear message.
class StatusChangeRequest(BaseModel):
    status: str = ""


class ItemStatus(BaseModel):
    id: int
    boardId: str
    title: str
    status: str


# One row of an item's status history: who changed it, when, and from what to what.
class StatusHistoryEntry(BaseModel):
    itemId: int
    boardId: str
    actorId: str
    changedAt: str
    oldStatus: str
    newStatus: str


# change is None when the item already had the requested status.
class StatusChangeResult(BaseModel):
    item: ItemStatus
    change: Optional[StatusHistoryEntry]
