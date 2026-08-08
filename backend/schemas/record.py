"""
Pydantic Schemas for Health Records API
"""
from pydantic import BaseModel, Field
from typing import Optional, List

class HealthRecordBase(BaseModel):
    patientId: str
    patientName: str
    userId: Optional[str] = None
    title: str
    teluguTitle: Optional[str] = None
    type: str = Field(..., description="triage_session | medical_document | clinical_visit")
    date: str
    summary: str
    teluguSummary: Optional[str] = None
    facilityOrDoctor: Optional[str] = None
    tags: Optional[List[str]] = None

class HealthRecordCreate(HealthRecordBase):
    pass

class HealthRecordResponse(HealthRecordBase):
    id: str
