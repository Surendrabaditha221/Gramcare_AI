"""
Health Records Router
"""
from fastapi import APIRouter, Query
from typing import List, Optional
from schemas import HealthRecordCreate, HealthRecordResponse
from database import crud

router = APIRouter()

@router.get("/records", response_model=List[HealthRecordResponse], summary="List Health Records")
async def get_records(
    patient_id: Optional[str] = None,
    user_id: Optional[str] = Query(None, alias="userId")
):
    """
    Returns saved health records, prescriptions, and triage summaries.
    """
    return await crud.get_records(patient_id=patient_id, user_id=user_id)

@router.post("/records", response_model=HealthRecordResponse, summary="Create Health Record")
async def create_record(record: HealthRecordCreate):
    """
    Saves a new health record to MongoDB (persists across restarts).
    """
    saved = await crud.add_record(record.model_dump())
    return HealthRecordResponse(**saved)
