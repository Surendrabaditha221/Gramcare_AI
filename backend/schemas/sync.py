"""
Pydantic Schemas for Offline Synchronization API
"""
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

class SyncRequest(BaseModel):
    patients: Optional[List[Dict[str, Any]]] = None
    records: Optional[List[Dict[str, Any]]] = None
    alerts: Optional[List[Dict[str, Any]]] = None
    triage_logs: Optional[List[Dict[str, Any]]] = None

class SyncResponse(BaseModel):
    status: str = "success"
    synced_patients_count: int
    synced_records_count: int
    synced_alerts_count: int
    synced_triage_logs_count: int
    message: str
