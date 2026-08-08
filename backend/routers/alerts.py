"""
Health Alerts & Notifications Router
"""
from fastapi import APIRouter, Query
from typing import List, Optional
from schemas import AlertCreate, AlertResponse
from database import crud
from services.data_store import memory_store

router = APIRouter()

@router.get("/alerts", response_model=List[AlertResponse], summary="List Health Alerts & Reminders")
async def get_alerts(user_id: Optional[str] = Query(None, alias="userId")):
    """
    Returns active health advisories and reminder notifications.
    """
    alerts = await crud.get_alerts(user_id=user_id)
    if not alerts:
        alerts = memory_store.get_alerts()
    return alerts

@router.post("/alerts", response_model=AlertResponse, summary="Create Health Alert/Reminder")
async def create_alert(alert: AlertCreate):
    """
    Creates a new health alert or notification reminder.
    """
    saved = await crud.add_alert(alert.model_dump())
    memory_store.add_alert(saved)
    return AlertResponse(**saved)
