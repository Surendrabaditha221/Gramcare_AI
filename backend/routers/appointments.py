"""
Appointments Management Router for GramCare AI
Manages appointments in Firestore subcollection users/{uid}/appointments/{appointmentId}
with strict Firebase UID scoping and cross-user isolation.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from schemas.appointment import AppointmentCreate, AppointmentResponse
from services import firestore_appointment_service
from routers.auth import get_current_user_from_token

router = APIRouter(prefix="/appointments", tags=["Appointments Management"])


@router.get("", response_model=List[AppointmentResponse], summary="List All Appointments for Authenticated User")
async def get_appointments(
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Returns list of appointments for the authenticated user from Firestore users/{uid}/appointments.
    Strictly enforced by token UID.
    """
    uid = current_user["uid"]
    apts = await firestore_appointment_service.get_appointments(uid)
    return [AppointmentResponse(**a) for a in apts]


@router.post("", response_model=AppointmentResponse, summary="Create/Add Appointment")
async def create_appointment(
    appointment: AppointmentCreate,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Creates a new appointment in Firestore users/{uid}/appointments/{appointmentId}.
    Enforces verified Firebase token UID.
    """
    uid = current_user["uid"]
    apt_dict = appointment.model_dump(exclude_unset=True)
    apt_dict["userId"] = uid  # Override body spoofing

    created = await firestore_appointment_service.create_appointment(uid, apt_dict)
    return AppointmentResponse(**created)


@router.get("/{id}", response_model=AppointmentResponse, summary="Get Appointment Details by ID")
async def get_appointment_by_id(
    id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Get single appointment details by ID for authenticated user.
    """
    uid = current_user["uid"]
    found = await firestore_appointment_service.get_appointment(uid, id)
    if not found:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return AppointmentResponse(**found)


@router.put("/{id}", response_model=AppointmentResponse, summary="Update Appointment Details")
async def update_appointment(
    id: str,
    appointment_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Updates an existing appointment in Firestore users/{uid}/appointments/{id}.
    """
    uid = current_user["uid"]
    appointment_data["userId"] = uid

    updated = await firestore_appointment_service.update_appointment(uid, id, appointment_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return AppointmentResponse(**updated)


@router.post("/{id}/cancel", response_model=AppointmentResponse, summary="Cancel Appointment")
@router.put("/{id}/cancel", response_model=AppointmentResponse, summary="Cancel Appointment")
async def cancel_appointment(
    id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Cancels an appointment by setting its status to 'cancelled' in Firestore users/{uid}/appointments/{id}.
    """
    uid = current_user["uid"]
    cancelled = await firestore_appointment_service.cancel_appointment(uid, id)
    if not cancelled:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return AppointmentResponse(**cancelled)


@router.delete("/{id}", summary="Delete Appointment")
async def delete_appointment(
    id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Deletes appointment document from Firestore users/{uid}/appointments/{id}.
    """
    uid = current_user["uid"]
    success = await firestore_appointment_service.delete_appointment(uid, id)
    if not success:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return {"status": "success", "message": f"Appointment {id} deleted successfully."}
