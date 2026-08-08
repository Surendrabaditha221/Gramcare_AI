"""
Pydantic Schemas for Patient Management API
"""
from pydantic import BaseModel, Field
from typing import Optional, List

class PatientBase(BaseModel):
    fullName: str
    userId: Optional[str] = None
    relation: Optional[str] = None
    dob: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = "male"
    maritalStatus: Optional[str] = None
    bloodGroup: Optional[str] = None
    phone: Optional[str] = None
    knownAllergies: Optional[str] = None
    medicalConditions: Optional[str] = None
    currentMedications: Optional[str] = None
    village: Optional[str] = "Primary Village"
    district: Optional[str] = "Health District"
    emergencyContactPhone: Optional[str] = None
    ashaWorkerPhone: Optional[str] = None

class PatientCreate(PatientBase):
    id: Optional[str] = None

class PatientResponse(PatientBase):
    id: str
