from datetime import datetime

from pydantic import BaseModel, ConfigDict, JsonValue


class ItemHistoryEntry(BaseModel):
    # Prevent reassignment of an entry's fields after creation.
    model_config = ConfigDict(frozen=True)

    id: str
    boardId: str
    itemId: int
    actorId: str
    changedAt: datetime
    field: str
    oldValue: JsonValue
    newValue: JsonValue
