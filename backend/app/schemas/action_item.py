from datetime import date
import re
from pydantic import BaseModel, Field, field_validator
from app.schemas.action_items import TargetValue


class ActionOwner(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    isExternal: bool

    @field_validator("name")
    @classmethod
    def validate_owner_name(cls, value: str) -> str:
        # Store trimmed names and reject whitespace-only owners.
        name = value.strip()
        if not name:
            raise ValueError("Owner name cannot be empty.")
        return name


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


# The dialog and quick entry use the same item schema and defaults.
class ActionItemCreate(BaseModel):
    title: str = Field(max_length=2000)
    section: str = "General"
    priority: str = "Medium"
    target: str | TargetValue = ""
    status: str = "Open"
    owners: list[ActionOwner] = Field(default_factory=list)
    hardDate: str | None = None
    attention: bool = False

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value):
        return value.strip()

    @field_validator("section")
    @classmethod
    def normalize_section(cls, value):
        return value.strip() or "General"

    @field_validator("hardDate")
    @classmethod
    def valid_hard_date(cls, value):
        if value is not None:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value):
                raise ValueError("Use a calendar date in YYYY-MM-DD format.")
            date.fromisoformat(value)
        return value


class ActionItemUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=2000)
    target: str | TargetValue | None = None
    priority: str | None = None
    status: str | None = None
    owners: list[ActionOwner] | None = None
    hardDate: str | None = None
    attention: bool | None = None

    @field_validator("hardDate")
    @classmethod
    def valid_hard_date(cls, value):
        return ActionItemCreate.valid_hard_date(value)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value):
        if value is None or not value.strip():
            raise ValueError("Action item title cannot be empty.")
        return value.strip()

    @field_validator("target", "priority", "status", "owners", "attention", "title")
    @classmethod
    def non_null_update(cls, value):
        if value is None:
            raise ValueError("This field cannot be null.")
        return value
