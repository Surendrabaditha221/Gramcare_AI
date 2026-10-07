"""
Pydantic Schemas for Healthcare Facilities API
"""
from pydantic import BaseModel
from typing import List, Optional

class FacilitySource(BaseModel):
    provider: str
    sourceId: str

class HealthcareFacilityResponse(BaseModel):
    id: str
    name: str
    hindiName: Optional[str] = None
    type: str
    distanceKm: float
    villageOrTaluka: Optional[str] = None
    district: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    emergency24x7: Optional[bool] = None
    servicesAvailable: List[str] = []
    ashaWorkerName: Optional[str] = None
    isOpenNow: Optional[bool] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    openingHours: Optional[str] = None
    website: Optional[str] = None
    source: Optional[str] = None
    sources: List[FacilitySource] = []
