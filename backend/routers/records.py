"""
Health & Medical Records Router
Persists all clinical records in Firestore collection structure:
users/{uid}/medicalRecords/{recordId}

Enforces strict Firebase UID scoping for all CRUD operations.
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Query, Depends, HTTPException, status
from schemas import HealthRecordCreate, HealthRecordResponse
from services import firestore_record_service
from routers.auth import get_current_user_from_token

router = APIRouter(prefix="/records", tags=["Health Records"])


@router.get("", response_model=List[HealthRecordResponse], summary="List Health Records")
async def get_records(
    patient_id: Optional[str] = Query(None, alias="patient_id"),
    user_id: Optional[str] = Query(None, alias="userId"),
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Returns saved health records, prescriptions, and clinical visit summaries from Firestore.
    Strictly scoped to the verified authenticated UID.
    """
    uid = current_user.get("uid") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Authenticated UID required")

    records = await firestore_record_service.get_medical_records(uid, patient_id=patient_id)
    return [HealthRecordResponse(**r) for r in records]


@router.post("", response_model=HealthRecordResponse, summary="Create Health Record")
async def create_record(
    record: HealthRecordCreate,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Saves a new health record to Firestore under users/{uid}/medicalRecords/{recordId}.
    Ignores any spoofed UID in request body and enforces the verified token UID.
    """
    uid = current_user.get("uid") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Authenticated UID required")

    payload = record.model_dump()
    payload["userId"] = uid
    if not payload.get("patientId"):
        payload["patientId"] = uid

    saved = await firestore_record_service.create_medical_record(uid, payload)
    return HealthRecordResponse(**saved)


@router.get("/{record_id}", response_model=HealthRecordResponse, summary="Get Single Health Record")
async def get_record(
    record_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Retrieves a single medical record from users/{uid}/medicalRecords/{recordId}.
    Enforces UID security checks.
    """
    uid = current_user.get("uid") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Authenticated UID required")

    rec = await firestore_record_service.get_medical_record(uid, record_id)
    if not rec:
        raise HTTPException(status_code=403, detail="Access denied: Record not found or belongs to another user")

    return HealthRecordResponse(**rec)


@router.put("/{record_id}", response_model=HealthRecordResponse, summary="Update Health Record")
async def update_record(
    record_id: str,
    record: HealthRecordCreate,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Updates an existing medical record in users/{uid}/medicalRecords/{recordId}.
    """
    uid = current_user.get("uid") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Authenticated UID required")

    existing = await firestore_record_service.get_medical_record(uid, record_id)
    if not existing:
        raise HTTPException(status_code=403, detail="Access denied: Record not found or belongs to another user")

    payload = record.model_dump()
    updated = await firestore_record_service.update_medical_record(uid, record_id, payload)
    return HealthRecordResponse(**updated)


@router.delete("/{record_id}", summary="Delete Health Record")
async def delete_record(
    record_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Deletes a medical record from users/{uid}/medicalRecords/{recordId}.
    """
    uid = current_user.get("uid") or current_user.get("id")
    if not uid:
        raise HTTPException(status_code=401, detail="Authenticated UID required")

    success = await firestore_record_service.delete_medical_record(uid, record_id)
    if not success:
        raise HTTPException(status_code=404, detail="Record not found or access denied")

    return {"success": True, "message": f"Medical record {record_id} deleted successfully"}

