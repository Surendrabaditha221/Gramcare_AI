"""
Patient & Family Management Router
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from schemas import PatientCreate, PatientResponse
from database import crud

router = APIRouter()

@router.get("/patients", response_model=List[PatientResponse], summary="List All Patients & Family Members")
async def get_patients(user_id: Optional[str] = Query(None, alias="userId")):
    """
    Returns list of saved user profiles and family members filtered by userId.
    """
    return await crud.get_patients(user_id=user_id)

@router.post("/patients", response_model=PatientResponse, summary="Create/Add Family Member Profile")
async def create_patient(patient: PatientCreate):
    """
    Adds a new patient or family member. Data is persisted in MongoDB.
    """
    new_patient = await crud.upsert_patient(patient.model_dump())
    return PatientResponse(**new_patient)

@router.get("/patients/{id}", response_model=PatientResponse, summary="Get Patient Details by ID")
async def get_patient_by_id(id: str, user_id: Optional[str] = Query(None, alias="userId")):
    """
    Get single patient details by ID.
    """
    found = await crud.get_patient_by_id(id, user_id=user_id)
    if not found:
        raise HTTPException(status_code=404, detail="Patient not found")
    return PatientResponse(**found)
