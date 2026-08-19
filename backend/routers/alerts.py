"""
Health Alerts & Notifications Router for GramCare AI
Uses Firestore users/{uid}/alerts/{alertId} subcollection with strict Firebase UID scoping.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Path, status
from typing import List, Optional, Dict, Any

from schemas.alert import AlertCreate, AlertResponse
from services import firestore_alert_service
from routers.auth import get_current_user_from_token

router = APIRouter()


@router.get("/alerts", response_model=List[AlertResponse], summary="List Health Alerts & Notifications")
async def get_alerts(
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Returns active health advisories and reminder notifications for the authenticated user.
    """
    uid = current_user["uid"]
    alerts = await firestore_alert_service.get_alerts(uid)
    return [AlertResponse(**a) for a in alerts]


@router.post("/alerts", response_model=AlertResponse, summary="Create Health Alert/Reminder", status_code=status.HTTP_201_CREATED)
async def create_alert(
    alert: AlertCreate,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Creates a new health alert or notification reminder under users/{uid}/alerts/{alertId}.
    Enforces verified Firebase token UID as ownership.
    """
    uid = current_user["uid"]
    data = alert.model_dump()
    data["userId"] = uid  # Override any body spoofing

    created = await firestore_alert_service.create_alert(uid, data)
    return AlertResponse(**created)


@router.get("/alerts/{alert_id}", response_model=AlertResponse, summary="Get Single Health Alert")
async def get_alert(
    alert_id: str = Path(..., description="Alert Document ID"),
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Retrieves a single alert for the authenticated user.
    """
    uid = current_user["uid"]
    alert = await firestore_alert_service.get_alert(uid, alert_id)
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found or access denied"
        )
    return AlertResponse(**alert)


@router.put("/alerts/{alert_id}/read", response_model=AlertResponse, summary="Mark Alert as Read/Unread")
@router.put("/alerts/{alert_id}", response_model=AlertResponse, summary="Update / Mark Alert as Read")
async def update_alert_read_status(
    alert_id: str = Path(..., description="Alert Document ID"),
    is_read: bool = Query(True, alias="isRead"),
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Marks an alert as read/unread for the authenticated user.
    """
    uid = current_user["uid"]
    updated = await firestore_alert_service.mark_alert_read(uid, alert_id, is_read=is_read)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found or access denied"
        )
    return AlertResponse(**updated)


@router.delete("/alerts/{alert_id}", summary="Delete Health Alert", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(
    alert_id: str = Path(..., description="Alert Document ID"),
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Deletes a health alert for the authenticated user.
    """
    uid = current_user["uid"]
    deleted = await firestore_alert_service.delete_alert(uid, alert_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert not found or access denied"
        )
    return None
