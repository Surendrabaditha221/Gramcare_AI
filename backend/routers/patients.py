"""
Patient & Family Management Router for GramCare AI
Manages family members in Firestore subcollection users/{uid}/familyMembers/{memberId}
with strict Firebase UID scoping and cross-user isolation.
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from schemas import PatientCreate, PatientResponse
from services import firestore_family_service
from routers.auth import get_current_user_from_token

router = APIRouter(prefix="/patients", tags=["Patient & Family Management"])


@router.get("", response_model=List[PatientResponse], summary="List All Family Members for Authenticated User")
async def get_patients(
    user_id: Optional[str] = Query(None, alias="userId"),
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Returns list of family members for the authenticated user from Firestore users/{uid}/familyMembers.
    Strictly enforced by token UID.
    """
    uid = current_user["uid"]
    members = await firestore_family_service.get_family_members(uid)
    return [PatientResponse(**m) for m in members]


@router.post("", response_model=PatientResponse, summary="Create/Add Family Member Profile")
@router.put("", response_model=PatientResponse, summary="Create/Add Family Member Profile")
async def create_patient(
    patient: PatientCreate,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Adds or updates a family member in Firestore users/{uid}/familyMembers/{memberId}.
    Enforces verified Firebase token UID.
    """
    uid = current_user["uid"]
    patient_dict = patient.model_dump(exclude_unset=True)
    patient_dict["userId"] = uid  # Override body spoofing

    member_id = patient_dict.get("id")
    if member_id:
        # Check if existing member belongs to this user
        existing = await firestore_family_service.get_family_member(uid, member_id)
        if existing:
            updated = await firestore_family_service.update_family_member(uid, member_id, patient_dict)
            return PatientResponse(**updated)

    created = await firestore_family_service.create_family_member(uid, patient_dict)
    return PatientResponse(**created)


@router.get("/{id}", response_model=PatientResponse, summary="Get Family Member Details by ID")
async def get_patient_by_id(
    id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Get single family member details by ID for authenticated user.
    """
    uid = current_user["uid"]
    found = await firestore_family_service.get_family_member(uid, id)
    if not found:
        raise HTTPException(status_code=404, detail="Family member not found")
    return PatientResponse(**found)


@router.put("/{id}", response_model=PatientResponse, summary="Update Family Member Details")
async def update_patient(
    id: str,
    patient_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Updates an existing family member profile in Firestore users/{uid}/familyMembers/{id}.
    """
    uid = current_user["uid"]
    patient_data["userId"] = uid

    updated = await firestore_family_service.update_family_member(uid, id, patient_data)
    if not updated:
        raise HTTPException(status_code=404, detail="Family member not found")
    return PatientResponse(**updated)


@router.delete("/{id}", summary="Delete Family Member")
async def delete_patient(
    id: str,
    current_user: Dict[str, Any] = Depends(get_current_user_from_token)
):
    """
    Deletes family member document from Firestore users/{uid}/familyMembers/{id}.
    """
    uid = current_user["uid"]
    success = await firestore_family_service.delete_family_member(uid, id)
    if not success:
        raise HTTPException(status_code=404, detail="Family member not found")
    return {"status": "success", "message": f"Family member {id} deleted successfully."}
