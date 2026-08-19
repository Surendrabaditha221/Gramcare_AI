"""
Backend Schemas Package Initialization
"""
from pydantic import BaseModel

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    ai_available: bool = True
    ai_status: str = "ok"

from schemas.triage import TriageRequest, TriageResponse
from schemas.chat import ChatRequest, ChatResponse
from schemas.document import DocumentAnalyzeRequest, DocumentAnalyzeResponse
from schemas.patient import PatientCreate, PatientResponse
from schemas.record import HealthRecordCreate, HealthRecordResponse
from schemas.facility import HealthcareFacilityResponse
from schemas.alert import AlertCreate, AlertResponse
from schemas.appointment import AppointmentCreate, AppointmentResponse
from schemas.sync import SyncRequest, SyncResponse
