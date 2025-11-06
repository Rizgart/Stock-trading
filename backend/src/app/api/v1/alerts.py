from typing import List

from fastapi import APIRouter, HTTPException, status

from ...services.alerts import AlertCreate, AlertRead, AlertRuleUpdate, InMemoryAlertRepository

router = APIRouter()
repository = InMemoryAlertRepository()


@router.get("/alerts", response_model=List[AlertRead], summary="List alerts")
async def list_alerts() -> List[AlertRead]:
    return await repository.list_alerts()


@router.post(
    "/alerts",
    response_model=AlertRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create new alert",
)
async def create_alert(payload: AlertCreate) -> AlertRead:
    return await repository.create_alert(payload)


@router.patch(
    "/alerts/{alert_id}",
    response_model=AlertRead,
    summary="Update alert rule or status",
)
async def update_alert(alert_id: str, payload: AlertRuleUpdate) -> AlertRead:
    updated = await repository.update_alert(alert_id, payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return updated


@router.delete("/alerts/{alert_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete alert")
async def delete_alert(alert_id: str) -> None:
    deleted = await repository.delete_alert(alert_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
