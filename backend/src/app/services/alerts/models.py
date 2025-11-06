from __future__ import annotations

from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class AlertChannel(str, Enum):
    IN_APP = "in_app"
    DESKTOP = "desktop_push"
    EMAIL = "email"


class PriceCondition(BaseModel):
    operator: str = Field(..., pattern=r"^(>=|<=)$")
    target: float


class AlertRule(BaseModel):
    price: Optional[PriceCondition] = None


class AlertBase(BaseModel):
    symbol: str
    channels: list[AlertChannel] = Field(default_factory=lambda: [AlertChannel.IN_APP])
    rule: AlertRule


class AlertCreate(AlertBase):
    pass


class AlertRead(AlertBase):
    id: str
    active: bool = True


class AlertRuleUpdate(BaseModel):
    rule: AlertRule | None = None
    active: Optional[bool] = None
