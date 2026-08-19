"""
Pydantic Schemas for Appointments API
"""
from pydantic import BaseModel, Field
from typing import Optional

class AppointmentBase(BaseModel):
    patientId: Optional[str] = "user_primary"
    patientName: Optional[str] = None
    doctorName: Optional[str] = None
    hospitalName: Optional[str] = None
    specialty: Optional[str] = None
    appointmentDate: Optional[str] = None
    appointmentTime: Optional[str] = None
    status: Optional[str] = "scheduled"
    reason: Optional[str] = None
    notes: Optional[str] = None

class AppointmentCreate(AppointmentBase):
    id: Optional[str] = None

class AppointmentResponse(AppointmentBase):
    id: str
    userId: str
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
