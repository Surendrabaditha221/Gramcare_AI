"""
Healthcare Facilities Router
"""
from fastapi import APIRouter
from typing import List
from schemas import HealthcareFacilityResponse
from services.data_store import memory_store

router = APIRouter()

@router.get("/facilities", response_model=List[HealthcareFacilityResponse], summary="List Nearby Rural Healthcare Facilities")
async def get_facilities():
    """
    Returns nearby PHC, CHC, and District hospital facility data sorted by distance.
    """
    return memory_store.get_facilities()
