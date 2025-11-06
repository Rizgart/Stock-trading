from __future__ import annotations

import asyncio
import uuid
from typing import Dict, List

from .models import AlertCreate, AlertRead, AlertRuleUpdate


class InMemoryAlertRepository:
    """Temporary in-memory alert store for prototyping."""

    def __init__(self) -> None:
        self._alerts: Dict[str, AlertRead] = {}
        self._lock = asyncio.Lock()

    async def list_alerts(self) -> List[AlertRead]:
        async with self._lock:
            return list(self._alerts.values())

    async def create_alert(self, payload: AlertCreate) -> AlertRead:
        alert = AlertRead(id=str(uuid.uuid4()), **payload.model_dump())
        async with self._lock:
            self._alerts[alert.id] = alert
        return alert

    async def update_alert(self, alert_id: str, payload: AlertRuleUpdate) -> AlertRead | None:
        async with self._lock:
            existing = self._alerts.get(alert_id)
            if not existing:
                return None
            data = existing.model_dump()
            if payload.rule is not None:
                data["rule"] = payload.rule.model_dump()
            if payload.active is not None:
                data["active"] = payload.active
            updated = AlertRead(**data)
            self._alerts[alert_id] = updated
            return updated

    async def delete_alert(self, alert_id: str) -> bool:
        async with self._lock:
            return self._alerts.pop(alert_id, None) is not None
