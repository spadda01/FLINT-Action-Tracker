from datetime import date
from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field


class TextTarget(BaseModel):
    type: Literal["text"]
    value: str


class DateTarget(BaseModel):
    type: Literal["date"]
    value: date


TargetValue = Annotated[
    Union[TextTarget, DateTarget],
    Field(discriminator="type"),
]


class ActionItem(BaseModel):
    id: str
    title: str
    target: TargetValue


class TargetUpdate(BaseModel):
    target: TargetValue
