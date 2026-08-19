"""
Pydantic Schemas for Healthcare Facilities API
"""
from pydantic import BaseModel
from typing import List, Optional

class HealthcareFacilityResponse(BaseModel):
    id: str
    name: str
    hindiName: Optional[str] = None
    type: str
    distanceKm: float
    villageOrTaluka: str
    district: str
    phone: Optional[str] = None
    emergency24x7: bool
    servicesAvailable: List[str]
    ashaWorkerName: Optional[str] = None
    isOpenNow: bool
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    openingHours: Optional[str] = None
